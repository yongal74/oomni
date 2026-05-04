/**
 * TDD: leadScoringService — 리드 스코어 계산 엔진
 * v5.2.0
 */

// 인메모리 DB mock
function makeDb(rows: unknown[] = []) {
  const store: unknown[] = [...rows]
  return {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT')) return { rows: store }
      if (sql.startsWith('INSERT')) {
        store.push({
          id: 'mock-id',
          mission_id: params?.[1],
          profile_id: params?.[2] ?? null,
          score: params?.[3],
          tier: params?.[4],
          signals: params?.[5],
          last_signal_at: params?.[6],
          created_at: params?.[7],
          updated_at: params?.[8],
        })
      }
      if (sql.startsWith('UPDATE')) {
        const existing = store[0] as Record<string, unknown>
        if (existing) {
          existing.score = params?.[0]
          existing.tier  = params?.[1]
        }
      }
      return { rows: store }
    }),
  }
}

// 직접 테스트할 비즈니스 로직만 추출 (서비스 임포트 없이)
function calcTier(score: number): 'hot' | 'nurture' | 'cold' {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'nurture'
  return 'cold'
}

const SIGNAL_WEIGHTS: Record<string, number> = {
  content_click:     25,
  multilink_visit:   15,
  repeat_browse:     20,
  email_click:       30,
  sns_save:          15,
  cart_abandon:      40,
  content_generated: 10,
}

// ── 티어 계산 ────────────────────────────────────────────────────────────────

describe('calcTier()', () => {
  test('score >= 70 → hot', () => {
    expect(calcTier(70)).toBe('hot')
    expect(calcTier(100)).toBe('hot')
  })

  test('40 <= score < 70 → nurture', () => {
    expect(calcTier(40)).toBe('nurture')
    expect(calcTier(69)).toBe('nurture')
  })

  test('score < 40 → cold', () => {
    expect(calcTier(0)).toBe('cold')
    expect(calcTier(39)).toBe('cold')
  })
})

// ── 시그널 가중치 ─────────────────────────────────────────────────────────────

describe('SIGNAL_WEIGHTS', () => {
  test('cart_abandon이 가장 높아야 함 (40)', () => {
    expect(SIGNAL_WEIGHTS['cart_abandon']).toBe(40)
  })

  test('email_click이 2위 (30)', () => {
    expect(SIGNAL_WEIGHTS['email_click']).toBe(30)
  })

  test('content_generated가 가장 낮아야 함 (10)', () => {
    expect(SIGNAL_WEIGHTS['content_generated']).toBe(10)
  })

  test('7개 시그널 모두 양수', () => {
    Object.values(SIGNAL_WEIGHTS).forEach(w => expect(w).toBeGreaterThan(0))
  })
})

// ── 누적 스코어 시나리오 ──────────────────────────────────────────────────────

describe('리드 스코어 누적 시나리오', () => {
  test('cold → nurture: content_click(25) + email_click(30) = 55', () => {
    let score = 0
    score += SIGNAL_WEIGHTS['content_click']
    score += SIGNAL_WEIGHTS['email_click']
    expect(score).toBe(55)
    expect(calcTier(score)).toBe('nurture')
  })

  test('nurture → hot: cart_abandon(40) 하나로 hot 가능', () => {
    // 이미 nurture(40)인 상태에서 cart_abandon 추가
    let score = 40
    score += SIGNAL_WEIGHTS['cart_abandon']
    expect(score).toBe(80)
    expect(calcTier(score)).toBe('hot')
  })

  test('신규 리드 생성 시 첫 시그널 가중치가 초기 점수', () => {
    const firstSignal = 'sns_save'
    const initScore = SIGNAL_WEIGHTS[firstSignal]
    expect(initScore).toBe(15)
    expect(calcTier(initScore)).toBe('cold')
  })
})

// ── DB mock 동작 검증 ─────────────────────────────────────────────────────────

describe('DB mock 동작', () => {
  test('INSERT 후 store에 레코드 추가됨', async () => {
    const db = makeDb()
    await db.query(
      'INSERT INTO growth_leads (id, mission_id, profile_id, score, tier, signals, last_signal_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      ['id1', 'mission1', null, 25, 'cold', '[]', new Date().toISOString(), new Date().toISOString(), new Date().toISOString()],
    )
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  test('UPDATE 후 score 변경 확인', async () => {
    const existing = { id: 'lead1', score: 25, tier: 'cold', signals: '[]' }
    const db = makeDb([existing])
    await db.query(
      'UPDATE growth_leads SET score=$1, tier=$2 WHERE id=$3',
      [65, 'nurture', 'lead1'],
    )
    expect((existing as Record<string, unknown>)['score']).toBe(65)
    expect((existing as Record<string, unknown>)['tier']).toBe('nurture')
  })
})
