/**
 * leadScoringService.ts — 리드 스코어 계산 엔진
 * v5.2.0
 *
 * 시그널별 가중치:
 *   content_click    +25 (콘텐츠 3회+ 클릭 7일 이내)
 *   multilink_visit  +15 (멀티링크 방문 후 이탈)
 *   repeat_browse    +20 (동일 카테고리 반복 탐색)
 *   email_click      +30 (이메일 오픈 + 링크 클릭)
 *   sns_save         +15 (SNS 저장/공유)
 *   cart_abandon     +40 (장바구니 추가 후 미결제)
 *   content_generated +10 (콘텐츠 생성 완료)
 *
 * 티어:
 *   hot     70+
 *   nurture 40~69
 *   cold    0~39
 */
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../logger'

export type SignalType =
  | 'content_click'
  | 'multilink_visit'
  | 'repeat_browse'
  | 'email_click'
  | 'sns_save'
  | 'cart_abandon'
  | 'content_generated'

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  content_click:     25,
  multilink_visit:   15,
  repeat_browse:     20,
  email_click:       30,
  sns_save:          15,
  cart_abandon:      40,
  content_generated: 10,
}

type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
}

type LeadRow = {
  id: string
  mission_id: string
  profile_id: string | null
  score: number
  tier: 'hot' | 'nurture' | 'cold'
  signals: string
  last_signal_at: string
  created_at: string
  updated_at: string
}

function calcTier(score: number): 'hot' | 'nurture' | 'cold' {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'nurture'
  return 'cold'
}

/**
 * 시그널 수신 + 점수 업데이트
 * profileId가 null이면 미션 레벨 집계 리드
 */
export async function scoreLead(
  db: DbClient,
  missionId: string,
  profileId: string | null,
  signal: SignalType,
  customScore?: number,
): Promise<LeadRow> {
  const weight = customScore ?? SIGNAL_WEIGHTS[signal] ?? 5
  const now = new Date().toISOString()

  // 기존 리드 조회
  const params: unknown[] = profileId
    ? [missionId, profileId]
    : [missionId]

  const { rows } = await db.query(
    `SELECT * FROM growth_leads
     WHERE mission_id = $1
     ${profileId ? 'AND profile_id = $2' : 'AND profile_id IS NULL'}
     LIMIT 1`,
    params,
  )

  const existing = rows[0] as LeadRow | undefined

  if (existing) {
    // 기존 리드 업데이트
    const newScore = existing.score + weight
    const newTier = calcTier(newScore)
    const signals = JSON.parse(existing.signals || '[]') as Array<{ type: string; at: string }>
    signals.push({ type: signal, at: now })

    await db.query(
      `UPDATE growth_leads
       SET score = $1, tier = $2, signals = $3, last_signal_at = $4, updated_at = $5
       WHERE id = $6`,
      [newScore, newTier, JSON.stringify(signals.slice(-50)), now, now, existing.id],
    )

    logger.info(`[leadScoring] mission=${missionId} score=${existing.score}→${newScore} tier=${newTier}`)

    return { ...existing, score: newScore, tier: newTier }
  } else {
    // 신규 리드 생성
    const id = uuidv4()
    const tier = calcTier(weight)
    const signals = JSON.stringify([{ type: signal, at: now }])

    await db.query(
      `INSERT INTO growth_leads (id, mission_id, profile_id, score, tier, signals, last_signal_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, missionId, profileId, weight, tier, signals, now, now, now],
    )

    logger.info(`[leadScoring] 신규 리드 생성 mission=${missionId} score=${weight} tier=${tier}`)

    return {
      id, mission_id: missionId, profile_id: profileId,
      score: weight, tier, signals,
      last_signal_at: now, created_at: now, updated_at: now,
    }
  }
}

/**
 * 미션의 리드 목록 조회
 */
export async function getLeads(
  db: DbClient,
  missionId: string,
  tier?: 'hot' | 'nurture' | 'cold',
  limit = 50,
): Promise<LeadRow[]> {
  const tierFilter = tier ? `AND tier = '${tier}'` : ''
  const { rows } = await db.query(
    `SELECT * FROM growth_leads
     WHERE mission_id = $1 ${tierFilter}
     ORDER BY score DESC, updated_at DESC
     LIMIT ${limit}`,
    [missionId],
  )
  return rows as LeadRow[]
}

/**
 * 리드 점수 요약 통계
 */
export async function getLeadStats(
  db: DbClient,
  missionId: string,
): Promise<{ hot: number; nurture: number; cold: number; total: number; avgScore: number }> {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN tier='hot' THEN 1 ELSE 0 END) as hot,
       SUM(CASE WHEN tier='nurture' THEN 1 ELSE 0 END) as nurture,
       SUM(CASE WHEN tier='cold' THEN 1 ELSE 0 END) as cold,
       AVG(score) as avg_score
     FROM growth_leads WHERE mission_id = $1`,
    [missionId],
  )
  const row = rows[0] as Record<string, number> | undefined
  return {
    hot:      row?.hot ?? 0,
    nurture:  row?.nurture ?? 0,
    cold:     row?.cold ?? 0,
    total:    row?.total ?? 0,
    avgScore: Math.round(row?.avg_score ?? 0),
  }
}
