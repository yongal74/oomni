/**
 * idGraph.test.ts — 3계층 ID-Graphing TDD (in-memory SQLite)
 *
 * 확정적(Deterministic) + 확률적(Probabilistic) + 행동적(Behavioral)
 * 3계층 식별자 모델 기반 Union-Find 고객 ID 그래프
 *
 * TDD 원칙: 테스트 먼저 → 구현 검증
 */
import Database from 'better-sqlite3';
import {
  normalizeEmail, normalizePhone, hashEmail, hashPhone,
  resolveIdentity, findProfileByHash,
  classifyIdentifier, getConfidenceForType,
  getIdentityGraph, getProfileSegment, getDynamicMarketingSignal,
} from '../idGraph';
import { SCHEMA_SQL } from '../../db/schema';

// ── In-memory SQLite DB 팩토리 ──────────────────────────────────────────────
function makeInMemoryDb() {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  raw.exec(SCHEMA_SQL);

  function pgToSqlite(sql: string): string {
    return sql.replace(/\$\d+/g, '?');
  }

  const client = {
    raw,
    query: async (sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> => {
      const sqliteSql = pgToSqlite(sql.trim());
      const normalizedParams = params.map(p =>
        p === true ? 1 : p === false ? 0 : p instanceof Date ? p.toISOString() : p
      );
      const upper = sqliteSql.toUpperCase().trimStart();
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');
      if (isSelect) {
        const rows = raw.prepare(sqliteSql).all(...normalizedParams) as Record<string, unknown>[];
        return { rows };
      }
      raw.prepare(sqliteSql).run(...normalizedParams);
      return { rows: [] };
    },
  };
  return client;
}

const MISSION_ID = '00000000-0000-0000-0000-000000000001';

function insertMission(db: ReturnType<typeof makeInMemoryDb>) {
  db.raw.prepare(
    "INSERT OR IGNORE INTO missions (id, name) VALUES (?, ?)"
  ).run(MISSION_ID, 'Test Mission');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PII 정규화 / 해시
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeEmail', () => {
  it('소문자 변환', () => {
    expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });
  it('앞뒤 공백 제거', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });
  it('Gmail 점(.) 무시', () => {
    expect(normalizeEmail('u.s.e.r@gmail.com')).toBe('user@gmail.com');
  });
  it('Gmail 이 아닌 도메인 점 유지', () => {
    expect(normalizeEmail('u.s.e.r@naver.com')).toBe('u.s.e.r@naver.com');
  });
});

describe('normalizePhone', () => {
  it('+82 국가코드 → 0 변환', () => {
    expect(normalizePhone('+82-10-1234-5678')).toBe('01012345678');
  });
  it('공백/하이픈/괄호 제거', () => {
    expect(normalizePhone('010 1234 5678')).toBe('01012345678');
    expect(normalizePhone('(010) 1234-5678')).toBe('01012345678');
  });
});

describe('hashEmail', () => {
  it('같은 이메일 → 같은 해시', async () => {
    const h1 = await hashEmail('user@example.com');
    const h2 = await hashEmail('USER@EXAMPLE.COM');
    expect(h1).toBe(h2);
  });
  it('64자 hex 문자열 반환', async () => {
    const h = await hashEmail('test@test.com');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashPhone', () => {
  it('+82와 010 동일 해시', async () => {
    const h1 = await hashPhone('+82-10-1234-5678');
    const h2 = await hashPhone('010-1234-5678');
    expect(h1).toBe(h2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 3계층 식별자 분류 (확정적/확률적/행동적)
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyIdentifier', () => {
  it('email_hash → deterministic', () => {
    expect(classifyIdentifier('email_hash')).toBe('deterministic');
  });
  it('phone_hash → deterministic', () => {
    expect(classifyIdentifier('phone_hash')).toBe('deterministic');
  });
  it('user_id → deterministic', () => {
    expect(classifyIdentifier('user_id')).toBe('deterministic');
  });
  it('device_fingerprint → probabilistic', () => {
    expect(classifyIdentifier('device_fingerprint')).toBe('probabilistic');
  });
  it('fbclid → probabilistic', () => {
    expect(classifyIdentifier('fbclid')).toBe('probabilistic');
  });
  it('gclid → probabilistic', () => {
    expect(classifyIdentifier('gclid')).toBe('probabilistic');
  });
  it('ttclid → probabilistic', () => {
    expect(classifyIdentifier('ttclid')).toBe('probabilistic');
  });
  it('anonymous_id → behavioral', () => {
    expect(classifyIdentifier('anonymous_id')).toBe('behavioral');
  });
});

describe('getConfidenceForType', () => {
  it('deterministic 식별자는 confidence 1.0', () => {
    expect(getConfidenceForType('email_hash')).toBe(1.0);
    expect(getConfidenceForType('phone_hash')).toBe(1.0);
    expect(getConfidenceForType('user_id')).toBe(1.0);
  });
  it('probabilistic 식별자는 0.5 < confidence < 1.0', () => {
    const c = getConfidenceForType('device_fingerprint');
    expect(c).toBeGreaterThan(0.5);
    expect(c).toBeLessThan(1.0);
  });
  it('click ID (fbclid/gclid)는 device보다 높은 confidence', () => {
    const clickConf = getConfidenceForType('fbclid');
    const deviceConf = getConfidenceForType('device_fingerprint');
    expect(clickConf).toBeGreaterThanOrEqual(deviceConf);
  });
  it('behavioral 식별자는 confidence < 0.6', () => {
    const c = getConfidenceForType('anonymous_id');
    expect(c).toBeLessThan(0.6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. resolveIdentity — 통합 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveIdentity', () => {
  let db: ReturnType<typeof makeInMemoryDb>;

  beforeEach(() => {
    db = makeInMemoryDb();
    insertMission(db);
  });

  it('신규 프로필 생성 — isNew=true', async () => {
    const result = await resolveIdentity(db, MISSION_ID, {
      email: 'new@example.com', source: 'web',
    });
    expect(result.isNew).toBe(true);
    expect(result.merged).toBe(false);
    expect(result.profileId).toBeTruthy();
  });

  it('기존 프로필 매칭 — 동일 이메일 재방문', async () => {
    const first = await resolveIdentity(db, MISSION_ID, {
      email: 'returning@example.com', source: 'web',
    });
    const second = await resolveIdentity(db, MISSION_ID, {
      email: 'returning@example.com', source: 'email',
    });
    expect(second.isNew).toBe(false);
    expect(second.profileId).toBe(first.profileId);
  });

  it('이메일 + 전화번호 병합 — 2프로필 → 1프로필', async () => {
    const profileA = await resolveIdentity(db, MISSION_ID, {
      email: 'user@example.com', source: 'web',
    });
    const profileB = await resolveIdentity(db, MISSION_ID, {
      phone: '010-1234-5678', source: 'sms',
    });
    expect(profileA.profileId).not.toBe(profileB.profileId);

    const merged = await resolveIdentity(db, MISSION_ID, {
      email: 'user@example.com', phone: '010-1234-5678', source: 'app',
    });
    expect(merged.merged).toBe(true);
    expect(merged.mergedCount).toBe(1);

    // 두 해시 모두 winner를 가리켜야 함
    const emailHash = await hashEmail('user@example.com');
    const phoneHash = await hashPhone('010-1234-5678');
    expect(await findProfileByHash(db, MISSION_ID, emailHash)).toBe(merged.profileId);
    expect(await findProfileByHash(db, MISSION_ID, phoneHash)).toBe(merged.profileId);

    // loser 삭제 확인
    const loserId = merged.profileId === profileA.profileId ? profileB.profileId : profileA.profileId;
    const loserRow = db.raw.prepare('SELECT * FROM cdp_profiles WHERE id = ?').get(loserId);
    expect(loserRow).toBeUndefined();
  });

  it('익명 ID → 실명 ID 스티칭', async () => {
    const anon = await resolveIdentity(db, MISSION_ID, {
      anonymousId: 'anon-abc123', source: 'web',
    });
    expect(anon.isNew).toBe(true);

    const identified = await resolveIdentity(db, MISSION_ID, {
      anonymousId: 'anon-abc123', email: 'user@example.com', source: 'web',
    });
    expect(identified.profileId).toBe(anon.profileId);
    expect(identified.isNew).toBe(false);
  });

  it('traits 머지 — 기존 보존, 신규 추가, 신규로 덮어쓰기', async () => {
    await resolveIdentity(db, MISSION_ID, {
      email: 'user@example.com', source: 'web',
      traits: { name: '홍길동', age: 30, plan: 'free' },
    });
    const updated = await resolveIdentity(db, MISSION_ID, {
      email: 'user@example.com', source: 'app',
      traits: { plan: 'premium', age: 31, city: '서울' },
    });
    const profile = db.raw.prepare('SELECT traits FROM cdp_profiles WHERE id = ?').get(updated.profileId) as { traits: string } | undefined;
    const traits = JSON.parse(profile!.traits);
    expect(traits.name).toBe('홍길동');   // 기존 보존
    expect(traits.plan).toBe('premium'); // 덮어쓰기
    expect(traits.age).toBe(31);         // 업데이트
    expect(traits.city).toBe('서울');    // 신규 추가
  });

  it('병합 점수 — user_id 보유 프로필이 winner', async () => {
    const profileA = await resolveIdentity(db, MISSION_ID, {
      userId: 'user-001', email: 'user@example.com', source: 'web',
    });
    await resolveIdentity(db, MISSION_ID, {
      phone: '010-9999-1234', source: 'sms',
    });
    const merged = await resolveIdentity(db, MISSION_ID, {
      email: 'user@example.com', phone: '010-9999-1234', source: 'app',
    });
    expect(merged.merged).toBe(true);
    expect(merged.profileId).toBe(profileA.profileId);
    const winner = db.raw.prepare('SELECT * FROM cdp_profiles WHERE id = ?').get(merged.profileId) as Record<string, unknown>;
    expect(winner.phone_hash).toBeTruthy();
    expect(winner.user_id).toBe('user-001');
  });

  it('다른 mission_id는 격리', async () => {
    const missionB = '00000000-0000-0000-0000-000000000002';
    db.raw.prepare("INSERT INTO missions (id, name) VALUES (?, ?)").run(missionB, 'Mission B');
    const inA = await resolveIdentity(db, MISSION_ID, { email: 'shared@example.com', source: 'web' });
    const inB = await resolveIdentity(db, missionB, { email: 'shared@example.com', source: 'web' });
    expect(inA.profileId).not.toBe(inB.profileId);
    expect(inA.isNew).toBe(true);
    expect(inB.isNew).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. id_class 및 confidence 저장 검증
// ─────────────────────────────────────────────────────────────────────────────

describe('identity index id_class and confidence', () => {
  let db: ReturnType<typeof makeInMemoryDb>;

  beforeEach(() => {
    db = makeInMemoryDb();
    insertMission(db);
  });

  it('email_hash는 deterministic, confidence 1.0으로 저장', async () => {
    await resolveIdentity(db, MISSION_ID, {
      email: 'det@example.com', source: 'web',
    });
    const emailHash = await hashEmail('det@example.com');
    const row = db.raw.prepare(
      'SELECT id_class, confidence FROM cdp_identity_index WHERE hash = ? AND mission_id = ?'
    ).get(emailHash, MISSION_ID) as { id_class: string; confidence: number } | undefined;

    expect(row).toBeDefined();
    expect(row!.id_class).toBe('deterministic');
    expect(row!.confidence).toBe(1.0);
  });

  it('anonymous_id는 behavioral, confidence < 0.6으로 저장', async () => {
    await resolveIdentity(db, MISSION_ID, {
      anonymousId: 'anon-test-001', source: 'web',
    });
    const row = db.raw.prepare(
      'SELECT id_class, confidence FROM cdp_identity_index WHERE hash = ? AND mission_id = ?'
    ).get('anon-test-001', MISSION_ID) as { id_class: string; confidence: number } | undefined;

    expect(row).toBeDefined();
    expect(row!.id_class).toBe('behavioral');
    expect(row!.confidence).toBeLessThan(0.6);
  });

  it('device_fingerprint는 probabilistic으로 저장', async () => {
    await resolveIdentity(db, MISSION_ID, {
      deviceFingerprint: 'fp-abc123', source: 'web',
    });
    const row = db.raw.prepare(
      'SELECT id_class, confidence FROM cdp_identity_index WHERE hash = ? AND mission_id = ?'
    ).get('fp-abc123', MISSION_ID) as { id_class: string; confidence: number } | undefined;

    expect(row).toBeDefined();
    expect(row!.id_class).toBe('probabilistic');
    expect(row!.confidence).toBeGreaterThan(0.5);
    expect(row!.confidence).toBeLessThan(1.0);
  });

  it('병합 시 cdp_merge_log에 기록됨', async () => {
    const profileA = await resolveIdentity(db, MISSION_ID, {
      email: 'merge@example.com', source: 'web',
    });
    const profileB = await resolveIdentity(db, MISSION_ID, {
      phone: '010-5555-6666', source: 'sms',
    });
    const merged = await resolveIdentity(db, MISSION_ID, {
      email: 'merge@example.com', phone: '010-5555-6666', source: 'app',
    });

    const logs = db.raw.prepare(
      'SELECT * FROM cdp_merge_log WHERE winner_id = ? AND mission_id = ?'
    ).all(merged.profileId, MISSION_ID) as Array<{ winner_id: string; loser_id: string }>;

    expect(logs.length).toBeGreaterThan(0);
    const loserId = merged.profileId === profileA.profileId ? profileB.profileId : profileA.profileId;
    expect(logs.some(l => l.loser_id === loserId)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. getIdentityGraph — 그래프 데이터 조회
// ─────────────────────────────────────────────────────────────────────────────

describe('getIdentityGraph', () => {
  let db: ReturnType<typeof makeInMemoryDb>;

  beforeEach(() => {
    db = makeInMemoryDb();
    insertMission(db);
  });

  it('프로필 노드와 식별자 노드를 반환함', async () => {
    const result = await resolveIdentity(db, MISSION_ID, {
      email: 'graph@example.com',
      phone: '010-1111-2222',
      source: 'web',
    });

    const graph = await getIdentityGraph(db, MISSION_ID, result.profileId);

    expect(graph).not.toBeNull();
    expect(graph!.nodes.length).toBeGreaterThanOrEqual(3); // profile + email + phone
    expect(graph!.edges.length).toBeGreaterThanOrEqual(2);

    const profileNode = graph!.nodes.find(n => n.id === `profile:${result.profileId}`);
    expect(profileNode).toBeDefined();
    expect(profileNode!.type).toBe('profile');
  });

  it('노드에 id_class 정보가 포함됨', async () => {
    const result = await resolveIdentity(db, MISSION_ID, {
      email: 'classtest@example.com',
      anonymousId: 'anon-class-test',
      source: 'web',
    });

    const graph = await getIdentityGraph(db, MISSION_ID, result.profileId);
    const emailNode = graph!.nodes.find(n => n.type === 'email_hash');
    const anonNode  = graph!.nodes.find(n => n.type === 'anonymous_id');

    expect(emailNode?.idClass).toBe('deterministic');
    expect(anonNode?.idClass).toBe('behavioral');
  });

  it('엣지에 confidence 값이 포함됨', async () => {
    const result = await resolveIdentity(db, MISSION_ID, {
      email: 'conftest@example.com',
      deviceFingerprint: 'fp-conftest',
      source: 'web',
    });

    const graph = await getIdentityGraph(db, MISSION_ID, result.profileId);
    const emailEdge  = graph!.edges.find(e => e.idClass === 'deterministic');
    const deviceEdge = graph!.edges.find(e => e.idClass === 'probabilistic');

    expect(emailEdge?.confidence).toBe(1.0);
    expect(deviceEdge?.confidence).toBeGreaterThan(0.5);
    expect(deviceEdge?.confidence).toBeLessThan(1.0);
  });

  it('병합된 프로필의 merge_log 포함', async () => {
    await resolveIdentity(db, MISSION_ID, {
      email: 'mg@example.com', source: 'web',
    });
    await resolveIdentity(db, MISSION_ID, {
      phone: '010-7777-8888', source: 'sms',
    });
    const merged = await resolveIdentity(db, MISSION_ID, {
      email: 'mg@example.com', phone: '010-7777-8888', source: 'app',
    });

    const graph = await getIdentityGraph(db, MISSION_ID, merged.profileId);
    expect(graph!.mergedFrom.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 세그먼트 + 동적 마케팅 신호
// ─────────────────────────────────────────────────────────────────────────────

describe('getProfileSegment', () => {
  let db: ReturnType<typeof makeInMemoryDb>;

  beforeEach(() => {
    db = makeInMemoryDb();
    insertMission(db);
  });

  it('event_count 기반 LTV tier 계산 — 50+ = high', async () => {
    const result = await resolveIdentity(db, MISSION_ID, {
      email: 'hltv@example.com', source: 'web',
    });
    // event_count 강제 업데이트
    db.raw.prepare('UPDATE cdp_profiles SET event_count = 55 WHERE id = ?').run(result.profileId);

    const segment = await getProfileSegment(db, MISSION_ID, result.profileId);
    expect(segment?.ltvTier).toBe('high');
    expect(segment?.eventCount).toBe(55);
  });

  it('10~49 이벤트 = mid tier', async () => {
    const result = await resolveIdentity(db, MISSION_ID, {
      email: 'mltv@example.com', source: 'web',
    });
    db.raw.prepare('UPDATE cdp_profiles SET event_count = 25 WHERE id = ?').run(result.profileId);
    const segment = await getProfileSegment(db, MISSION_ID, result.profileId);
    expect(segment?.ltvTier).toBe('mid');
  });

  it('10 미만 이벤트 = low tier', async () => {
    const result = await resolveIdentity(db, MISSION_ID, {
      email: 'lltv@example.com', source: 'web',
    });
    const segment = await getProfileSegment(db, MISSION_ID, result.profileId);
    expect(segment?.ltvTier).toBe('low');
  });
});

describe('getDynamicMarketingSignal', () => {
  it('high LTV → authority/proof 톤 권장', () => {
    const signal = getDynamicMarketingSignal({ ltvTier: 'high', eventCount: 80, sources: ['web', 'app'] });
    expect(['authority', 'proof']).toContain(signal.recommendedTone);
    expect(signal.priority).toBe('high');
  });

  it('mid LTV + email 채널 → empathy 톤 권장', () => {
    const signal = getDynamicMarketingSignal({ ltvTier: 'mid', eventCount: 20, sources: ['email'] });
    expect(signal.recommendedTone).toBe('empathy');
  });

  it('low LTV 신규 → contrarian/humor 톤 권장', () => {
    const signal = getDynamicMarketingSignal({ ltvTier: 'low', eventCount: 2, sources: ['web'] });
    expect(['contrarian', 'humor']).toContain(signal.recommendedTone);
    expect(signal.priority).toBe('low');
  });

  it('이탈 징후 (14일 미반응) → n8n 재활성화 트리거', () => {
    const twoWeeksAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const signal = getDynamicMarketingSignal({
      ltvTier: 'mid', eventCount: 30, sources: ['email'],
      lastSeenAt: twoWeeksAgo,
    });
    expect(signal.shouldTriggerReactivation).toBe(true);
  });

  it('최근 활성 사용자는 재활성화 트리거 없음', () => {
    const signal = getDynamicMarketingSignal({
      ltvTier: 'mid', eventCount: 30, sources: ['app'],
      lastSeenAt: new Date().toISOString(),
    });
    expect(signal.shouldTriggerReactivation).toBe(false);
  });
});
