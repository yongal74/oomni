/**
 * cdpIdGraphService.ts — CDP ID Graph + 리타겟팅 루프
 *
 * ID Graph:
 *   익명 ID(hash) → profile_id 연결 (cdp_identity_index 테이블)
 *   type: 'anonymous_id' | 'email' | 'phone' | 'cookie'
 *
 * 리타겟팅:
 *   cold/nurture 리드 감지 → Growth Bot feed_items에 재참여 작업 생성
 */
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export type IdType = 'anonymous_id' | 'email' | 'phone' | 'cookie' | 'device';

// ── ID 연결 ──────────────────────────────────────────────────���─────────────────

export async function linkIdentity(
  db: Db,
  missionId: string,
  hash: string,
  type: IdType,
  profileId: string,
  confidence = 1.0,
): Promise<void> {
  // 정규화 — 대소문자·공백 차이로 인한 중복 방지
  const normalizedHash = hash.trim().toLowerCase();

  // 원자적 UPSERT — SELECT+INSERT 패턴의 TOCTOU 경쟁 조건 방지
  await db.query(
    `INSERT INTO cdp_identity_index (hash, type, profile_id, mission_id, id_class, confidence, created_at)
     VALUES ($1, $2, $3, $4, 'deterministic', $5, datetime('now'))
     ON CONFLICT(hash) DO UPDATE
       SET profile_id = excluded.profile_id,
           confidence = excluded.confidence`,
    [normalizedHash, type, profileId, missionId, confidence],
  );
  logger.info(`[cdpIdGraph] upsert: hash=${normalizedHash.slice(0, 12)}… type=${type} → profile=${profileId.slice(0, 8)}`);
}

// ── 익명 ID 해석 ───────────────────────────────────────────────────────────────

export async function resolveIdentity(
  db: Db,
  missionId: string,
  hash: string,
): Promise<string | null> {
  const { rows } = await db.query(
    `SELECT profile_id FROM cdp_identity_index WHERE hash = $1 AND mission_id = $2 ORDER BY confidence DESC LIMIT 1`,
    [hash, missionId],
  );
  return rows.length > 0 ? (rows[0] as { profile_id: string }).profile_id : null;
}

// ── ID Graph 통계 ─────────────────────────────────────────────────────────────

export async function getIdGraphStats(db: Db, missionId: string): Promise<{
  totalLinks:  number;
  uniqueProfiles: number;
  byType: Record<string, number>;
}> {
  const { rows } = await db.query(
    `SELECT type, COUNT(*) AS cnt FROM cdp_identity_index WHERE mission_id = $1 GROUP BY type`,
    [missionId],
  );
  const byType: Record<string, number> = {};
  let totalLinks = 0;
  for (const r of rows as Array<{ type: string; cnt: number }>) {
    byType[r.type] = Number(r.cnt);
    totalLinks += Number(r.cnt);
  }
  const { rows: pRows } = await db.query(
    `SELECT COUNT(DISTINCT profile_id) AS cnt FROM cdp_identity_index WHERE mission_id = $1`,
    [missionId],
  );
  return {
    totalLinks,
    uniqueProfiles: Number((pRows[0] as { cnt: number })?.cnt ?? 0),
    byType,
  };
}

// ── 리타겟팅 루프 ─────────────────────────────────────────────────────────────

export interface RetargetResult {
  targeted: number;
  segments: { cold: number; nurture: number };
}

export async function detectAndRetarget(
  db: Db,
  missionId: string,
): Promise<RetargetResult> {
  // cold/nurture 리드 (최근 7일 내 시그널, 상위 30)
  const { rows } = await db.query(
    `SELECT id, profile_id, tier, score FROM growth_leads
     WHERE mission_id = $1 AND tier IN ('cold','nurture')
       AND last_signal_at >= datetime('now','-7 days')
     ORDER BY score DESC LIMIT 30`,
    [missionId],
  );

  const leads = rows as Array<{ id: string; profile_id: string | null; tier: string; score: number }>;
  const segments = { cold: 0, nurture: 0 };

  for (const lead of leads) {
    segments[lead.tier as 'cold' | 'nurture'] += 1;

    const content = JSON.stringify({
      task: 'retarget',
      tier: lead.tier,
      score: lead.score,
      profile_id: lead.profile_id,
      message: `[리타겟] ${lead.tier.toUpperCase()} 리드 재활성화 — score ${lead.score}`,
    });

    // 중복 방지 — 동일 리드에 대해 24시간 내 기존 리타겟 피드 있으면 건너뜀
    const { rows: existing } = await db.query(
      `SELECT id FROM feed_items
       WHERE content LIKE $1 AND created_at >= datetime('now','-1 day')
       LIMIT 1`,
      [`%"profile_id":"${lead.profile_id ?? ''}"%`],
    );
    if (existing.length > 0) continue;

    await db.query(
      `INSERT INTO feed_items (id, agent_id, type, content, requires_approval, created_at)
       SELECT $1, id, 'info', $2, 1, datetime('now')
       FROM agents WHERE mission_id = $3 AND role='growth' AND is_active=1 LIMIT 1`,
      [uuidv4(), content, missionId],
    );
  }

  logger.info(`[cdpRetarget] mission=${missionId} 대상=${leads.length} ${JSON.stringify(segments)}`);
  return { targeted: leads.length, segments };
}
