import { linkIdentity, resolveIdentity, getIdGraphStats, detectAndRetarget } from '../cdpIdGraphService';

// logger 목
jest.mock('../../logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

// ── 순수 인메모리 DB 목 (better-sqlite3 네이티브 모듈 불필요) ────────────────

type IdentityRow = {
  hash: string; type: string; profile_id: string; mission_id: string;
  id_class: string; confidence: number; created_at: string;
};
type LeadRow = {
  id: string; mission_id: string; profile_id: string | null;
  tier: string; score: number; last_signal_at: string;
};
type AgentRow = { id: string; mission_id: string; role: string; is_active: number };
type FeedRow = {
  id: string; agent_id: string; type: string; content: string;
  requires_approval: number; created_at: string;
};

function makeDb() {
  const identity: IdentityRow[] = [];
  const leads: LeadRow[]        = [];
  const agents: AgentRow[]      = [];
  const feeds: FeedRow[]        = [];

  const query = async (sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> => {
    const s = sql.trim();

    // INSERT INTO cdp_identity_index ... ON CONFLICT DO UPDATE
    if (s.startsWith('INSERT INTO cdp_identity_index') && s.includes('ON CONFLICT')) {
      const [hash, type, profile_id, mission_id, , confidence] =
        params as [string, string, string, string, string, number];
      const idx = identity.findIndex(r => r.hash === hash);
      if (idx >= 0) {
        identity[idx].profile_id = profile_id;
        identity[idx].confidence = confidence as number;
      } else {
        identity.push({
          hash, type, profile_id, mission_id,
          id_class: 'deterministic', confidence: confidence as number,
          created_at: new Date().toISOString(),
        });
      }
      return { rows: [] };
    }

    // SELECT profile_id FROM cdp_identity_index WHERE hash=... AND mission_id=...
    if (s.includes('SELECT profile_id FROM cdp_identity_index')) {
      const [hash, mid] = params as [string, string];
      const rows = identity
        .filter(r => r.hash === hash && r.mission_id === mid)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 1)
        .map(r => ({ profile_id: r.profile_id }));
      return { rows };
    }

    // SELECT type, COUNT(*) FROM cdp_identity_index GROUP BY type
    if (s.includes('FROM cdp_identity_index') && s.includes('GROUP BY type')) {
      const [mid] = params as [string];
      const grouped: Record<string, number> = {};
      identity.filter(r => r.mission_id === mid).forEach(r => {
        grouped[r.type] = (grouped[r.type] ?? 0) + 1;
      });
      return { rows: Object.entries(grouped).map(([type, cnt]) => ({ type, cnt })) };
    }

    // SELECT COUNT(DISTINCT profile_id) FROM cdp_identity_index
    if (s.includes('COUNT(DISTINCT profile_id)')) {
      const [mid] = params as [string];
      const unique = new Set(
        identity.filter(r => r.mission_id === mid).map(r => r.profile_id)
      );
      return { rows: [{ cnt: unique.size }] };
    }

    // SELECT ... FROM growth_leads WHERE tier IN ('cold','nurture')
    if (s.includes('FROM growth_leads')) {
      const [mid] = params as [string];
      const rows = leads
        .filter(r => r.mission_id === mid && ['cold', 'nurture'].includes(r.tier))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      return { rows };
    }

    // SELECT id FROM feed_items WHERE content LIKE $1
    if (s.includes('FROM feed_items')) {
      const [likeParam] = params as [string];
      const needle = likeParam.replace(/^%|%$/g, '');
      const rows = feeds.filter(r => r.content.includes(needle)).slice(0, 1);
      return { rows };
    }

    // INSERT INTO feed_items ... SELECT FROM agents
    if (s.startsWith('INSERT INTO feed_items') && s.includes('FROM agents')) {
      const [id, content, mid] = params as [string, string, string];
      const agent = agents.find(
        a => a.mission_id === mid && a.role === 'growth' && a.is_active === 1
      );
      if (agent) {
        feeds.push({
          id, agent_id: agent.id, type: 'info', content,
          requires_approval: 1, created_at: new Date().toISOString(),
        });
      }
      return { rows: [] };
    }

    return { rows: [] };
  };

  return { query, identity, leads, agents, feeds };
}

const MID = '11111111-1111-1111-1111-111111111111';
let db: ReturnType<typeof makeDb>;

beforeEach(() => { db = makeDb(); });

// ── linkIdentity ─────────────────────────────────────────────────────────────

describe('linkIdentity', () => {
  test('새 hash 삽입', async () => {
    await linkIdentity(db, MID, 'abc123', 'anonymous_id', 'prof-1');
    expect(db.identity).toHaveLength(1);
    expect(db.identity[0].profile_id).toBe('prof-1');
    expect(db.identity[0].id_class).toBe('deterministic');
  });

  test('동일 hash 재삽입 → UPSERT (중복 없음)', async () => {
    await linkIdentity(db, MID, 'abc123', 'anonymous_id', 'prof-1');
    await linkIdentity(db, MID, 'abc123', 'anonymous_id', 'prof-2');
    expect(db.identity).toHaveLength(1);
    expect(db.identity[0].profile_id).toBe('prof-2');
  });

  test('대소문자 정규화 — ABC123 == abc123', async () => {
    await linkIdentity(db, MID, 'ABC123', 'anonymous_id', 'prof-1');
    await linkIdentity(db, MID, 'abc123', 'anonymous_id', 'prof-2');
    expect(db.identity).toHaveLength(1);
  });

  test('공백 트리밍 — " abc " → "abc"', async () => {
    await linkIdentity(db, MID, '  abc  ', 'anonymous_id', 'prof-1');
    expect(db.identity[0].hash).toBe('abc');
  });
});

// ── resolveIdentity ──────────────────────────────────────────────────────────

describe('resolveIdentity', () => {
  test('연결된 profile_id 반환', async () => {
    await linkIdentity(db, MID, 'token-x', 'cookie', 'prof-99');
    const resolved = await resolveIdentity(db, MID, 'token-x');
    expect(resolved).toBe('prof-99');
  });

  test('미연결 hash → null', async () => {
    const resolved = await resolveIdentity(db, MID, 'unknown-hash');
    expect(resolved).toBeNull();
  });
});

// ── getIdGraphStats ──────────────────────────────────────────────────────────

describe('getIdGraphStats', () => {
  test('타입별 집계', async () => {
    await linkIdentity(db, MID, 'h1', 'anonymous_id', 'p1');
    await linkIdentity(db, MID, 'h2', 'anonymous_id', 'p2');
    await linkIdentity(db, MID, 'h3', 'email', 'p1');

    const stats = await getIdGraphStats(db, MID);
    expect(stats.totalLinks).toBe(3);
    expect(stats.byType['anonymous_id']).toBe(2);
    expect(stats.byType['email']).toBe(1);
    expect(stats.uniqueProfiles).toBe(2);
  });
});

// ── detectAndRetarget ────────────────────────────────────────────────────────

describe('detectAndRetarget', () => {
  beforeEach(() => {
    db.agents.push({ id: 'agent-1', mission_id: MID, role: 'growth', is_active: 1 });
  });

  test('cold/nurture 리드를 피드 아이템으로 변환', async () => {
    db.leads.push(
      { id: 'l1', mission_id: MID, profile_id: 'p1', tier: 'cold',   score: 10, last_signal_at: new Date().toISOString() },
      { id: 'l2', mission_id: MID, profile_id: 'p2', tier: 'nurture', score: 40, last_signal_at: new Date().toISOString() },
      { id: 'l3', mission_id: MID, profile_id: 'p3', tier: 'hot',    score: 90, last_signal_at: new Date().toISOString() },
    );

    const result = await detectAndRetarget(db, MID);
    expect(result.targeted).toBe(2); // hot 제외
    expect(result.segments.cold).toBe(1);
    expect(result.segments.nurture).toBe(1);
    expect(db.feeds).toHaveLength(2);
  });

  test('24시간 내 중복 리타겟 방지', async () => {
    db.leads.push(
      { id: 'l1', mission_id: MID, profile_id: 'p1', tier: 'cold', score: 10, last_signal_at: new Date().toISOString() },
    );

    await detectAndRetarget(db, MID);
    await detectAndRetarget(db, MID); // 두 번째 호출

    expect(db.feeds).toHaveLength(1); // 중복 없음
  });
});
