/**
 * idGraph.ts — 3계층 Union-Find ID-Graphing Engine
 * v5.1.0
 *
 * 논문 기반 3계층 식별자 모델:
 *   Layer 1 — Deterministic (확정적): email, phone, user_id → confidence 1.0
 *   Layer 2 — Probabilistic (확률적): device_fingerprint, fbclid, gclid, ttclid → 0.6~0.85
 *   Layer 3 — Behavioral (행동적): anonymous_id, session → 0.4~0.55
 *
 * 세그멘테이션 + 동적 마케팅 신호 → Growth Bot 연동
 */
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

// ─────────────────────────────────────────────────────────────────────────────
// 식별자 분류 상수
// ─────────────────────────────────────────────────────────────────────────────

export type IdClass = 'deterministic' | 'probabilistic' | 'behavioral';

const ID_CLASS_MAP: Record<string, IdClass> = {
  email_hash:         'deterministic',
  phone_hash:         'deterministic',
  user_id:            'deterministic',
  device_fingerprint: 'probabilistic',
  fbclid:             'probabilistic',
  gclid:              'probabilistic',
  ttclid:             'probabilistic',
  anonymous_id:       'behavioral',
};

const ID_CONFIDENCE_MAP: Record<string, number> = {
  email_hash:         1.0,
  phone_hash:         1.0,
  user_id:            1.0,
  device_fingerprint: 0.70,
  fbclid:             0.82,
  gclid:              0.82,
  ttclid:             0.80,
  anonymous_id:       0.50,
};

export function classifyIdentifier(type: string): IdClass {
  return ID_CLASS_MAP[type] ?? 'behavioral';
}

export function getConfidenceForType(type: string): number {
  return ID_CONFIDENCE_MAP[type] ?? 0.40;
}

// ─────────────────────────────────────────────────────────────────────────────
// PII 해싱
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeEmail(email: string): string {
  let normalized = email.trim().toLowerCase();
  const atIdx = normalized.indexOf('@');
  if (atIdx === -1) return normalized;
  const local  = normalized.slice(0, atIdx);
  const domain = normalized.slice(atIdx + 1);
  if (domain === 'gmail.com') {
    return local.replace(/\./g, '') + '@' + domain;
  }
  return normalized;
}

export function normalizePhone(phone: string): string {
  let normalized = phone.trim();
  if (normalized.startsWith('+82')) {
    normalized = '0' + normalized.slice(3);
  }
  return normalized.replace(/[\s\-\(\)\.]/g, '');
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function hashEmail(email: string): Promise<string> {
  return sha256(normalizeEmail(email));
}

export async function hashPhone(phone: string): Promise<string> {
  return sha256(normalizePhone(phone));
}

// ─────────────────────────────────────────────────────────────────────────────
// Index 조회 / 등록
// ─────────────────────────────────────────────────────────────────────────────

export async function findProfileByHash(
  db: Db,
  missionId: string,
  hash: string,
): Promise<string | null> {
  const { rows } = await db.query(
    'SELECT profile_id FROM cdp_identity_index WHERE hash = $1 AND mission_id = $2',
    [hash, missionId],
  );
  return rows.length > 0 ? (rows[0] as { profile_id: string }).profile_id : null;
}

async function linkIdentifierToProfile(
  db: Db,
  missionId: string,
  profileId: string,
  type: string,
  hash: string,
): Promise<void> {
  const idClass    = classifyIdentifier(type);
  const confidence = getConfidenceForType(type);
  await db.query(
    `INSERT INTO cdp_identity_index (hash, type, profile_id, mission_id, id_class, confidence)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT(hash) DO UPDATE SET profile_id = excluded.profile_id`,
    [hash, type, profileId, missionId, idClass, confidence],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 프로필 스코어 (병합 우선순위)
// ─────────────────────────────────────────────────────────────────────────────

interface CdpProfile {
  id:           string;
  mission_id:   string;
  user_id?:     string;
  anonymous_id?: string;
  email_hash?:  string;
  phone_hash?:  string;
  channel?:     string;
  sources?:     string;
  traits?:      string;
  event_count?: number;
  ltv?:         number;
  last_seen_at?: string;
}

function scoreProfile(profile: CdpProfile): number {
  let score = 0;
  if (profile.user_id)    score += 3;
  if (profile.email_hash) score += 2;
  if (profile.phone_hash) score += 2;
  const traits = safeJsonParse(profile.traits, {}) as Record<string, unknown>;
  score += Object.values(traits).filter(v => v != null && v !== '').length;
  return score;
}

function safeJsonParse<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

async function getProfile(db: Db, missionId: string, profileId: string): Promise<CdpProfile | null> {
  const { rows } = await db.query(
    'SELECT * FROM cdp_profiles WHERE id = $1 AND mission_id = $2',
    [profileId, missionId],
  );
  return rows.length > 0 ? rows[0] as CdpProfile : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveIdentity — 메인 Union-Find 엔진
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveParams {
  email?:             string;
  phone?:             string;
  userId?:            string;
  anonymousId?:       string;
  deviceFingerprint?: string;
  fbclid?:            string;
  gclid?:             string;
  ttclid?:            string;
  source:             string;
  traits?:            Record<string, unknown>;
}

export interface ResolveResult {
  profileId:   string;
  isNew:       boolean;
  merged:      boolean;
  mergedCount: number;
}

export async function resolveIdentity(
  db: Db,
  missionId: string,
  params: ResolveParams,
): Promise<ResolveResult> {
  const { email, phone, userId, anonymousId, deviceFingerprint,
          fbclid, gclid, ttclid, source, traits } = params;

  // Step 1: Hash PII
  const emailHash = email ? await hashEmail(email) : null;
  const phoneHash = phone ? await hashPhone(phone) : null;

  // Step 2: 식별자 목록 (hash 값 사용)
  // Deterministic: email/phone/userId → 실제 해시
  // Probabilistic/Behavioral: raw value를 hash로 직접 사용 (PII 아님)
  const identifiers: Array<{ type: string; hash: string }> = [];
  if (emailHash)         identifiers.push({ type: 'email_hash',         hash: emailHash });
  if (phoneHash)         identifiers.push({ type: 'phone_hash',         hash: phoneHash });
  if (userId)            identifiers.push({ type: 'user_id',            hash: userId });
  if (anonymousId)       identifiers.push({ type: 'anonymous_id',       hash: anonymousId });
  if (deviceFingerprint) identifiers.push({ type: 'device_fingerprint', hash: deviceFingerprint });
  if (fbclid)            identifiers.push({ type: 'fbclid',             hash: fbclid });
  if (gclid)             identifiers.push({ type: 'gclid',              hash: gclid });
  if (ttclid)            identifiers.push({ type: 'ttclid',             hash: ttclid });

  // Step 3: Index 조회 (병렬)
  const matchedIds = new Set<string>();
  const lookups = await Promise.all(
    identifiers.map(({ hash }) => findProfileByHash(db, missionId, hash)),
  );
  for (const id of lookups) {
    if (id) matchedIds.add(id);
  }

  // Step 4: 프로필 로드 (병렬)
  const profileDocs = await Promise.all(
    Array.from(matchedIds).map(id => getProfile(db, missionId, id)),
  );
  const matchedProfiles = profileDocs.filter(Boolean) as CdpProfile[];

  // ── Case A: 신규 프로필 ──────────────────────────────────────────────────
  if (matchedProfiles.length === 0) {
    const newId = uuidv4();
    await db.query(
      `INSERT INTO cdp_profiles
         (id, mission_id, email_hash, phone_hash, user_id, anonymous_id,
          channel, sources, traits, event_count, first_seen_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,datetime('now'),datetime('now'))`,
      [newId, missionId, emailHash, phoneHash, userId ?? null,
       anonymousId ?? null, source, JSON.stringify([source]), JSON.stringify(traits ?? {})],
    );
    for (const { type, hash } of identifiers) {
      await linkIdentifierToProfile(db, missionId, newId, type, hash);
    }
    // 세그먼트 초기화
    await trackSegmentTransition(db, newId, missionId, null, 'low', 'new_profile');
    logger.info(`[idGraph] NEW profile=${newId} mission=${missionId}`);
    return { profileId: newId, isNew: true, merged: false, mergedCount: 0 };
  }

  // ── Case B: 1개 매칭 → 업데이트 ─────────────────────────────────────────
  if (matchedProfiles.length === 1) {
    const existing = matchedProfiles[0];
    const existingTraits = safeJsonParse<Record<string, unknown>>(existing.traits, {});
    const newTraits = { ...existingTraits };
    if (traits) {
      for (const [k, v] of Object.entries(traits)) {
        if (v != null && v !== '') newTraits[k] = v;
      }
    }
    const existingSources = safeJsonParse<string[]>(existing.sources, []);
    if (!existingSources.includes(source)) existingSources.push(source);

    const prevTier = getLtvTierFromCount(existing.event_count ?? 0);

    await db.query(
      `UPDATE cdp_profiles SET
         traits = $1, sources = $2, last_seen_at = datetime('now'),
         email_hash = COALESCE($3, email_hash),
         phone_hash = COALESCE($4, phone_hash),
         user_id = COALESCE($5, user_id),
         anonymous_id = COALESCE($6, anonymous_id)
       WHERE id = $7`,
      [JSON.stringify(newTraits), JSON.stringify(existingSources),
       emailHash, phoneHash, userId ?? null, anonymousId ?? null, existing.id],
    );
    for (const { type, hash } of identifiers) {
      const ep = await findProfileByHash(db, missionId, hash);
      if (!ep) await linkIdentifierToProfile(db, missionId, existing.id, type, hash);
    }

    const newTier = getLtvTierFromCount(existing.event_count ?? 0);
    if (prevTier !== newTier) {
      await trackSegmentTransition(db, existing.id, missionId, prevTier, newTier, 'event_update');
    }

    return { profileId: existing.id, isNew: false, merged: false, mergedCount: 0 };
  }

  // ── Case C: 2+ 매칭 → 병합 ──────────────────────────────────────────────
  const scored = matchedProfiles.map(p => ({ profile: p, score: scoreProfile(p) }));
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0].profile;
  const losers = scored.slice(1).map(s => s.profile);

  // traits 병합 (loser → winner → incoming 순)
  let mergedTraits: Record<string, unknown> = {};
  for (const loser of [...losers].reverse()) {
    Object.assign(mergedTraits, safeJsonParse(loser.traits, {}));
  }
  Object.assign(mergedTraits, safeJsonParse(winner.traits, {}));
  if (traits) {
    for (const [k, v] of Object.entries(traits)) {
      if (v != null && v !== '') mergedTraits[k] = v;
    }
  }

  const allSources = new Set<string>([source]);
  for (const p of matchedProfiles) {
    for (const s of safeJsonParse<string[]>(p.sources, [])) allSources.add(s);
  }
  const totalEvents = matchedProfiles.reduce((n, p) => n + (p.event_count ?? 0), 0);

  let winnerEmailHash = winner.email_hash ?? emailHash;
  let winnerPhoneHash = winner.phone_hash ?? phoneHash;
  let winnerUserId    = winner.user_id ?? userId ?? null;
  let winnerAnonId    = winner.anonymous_id ?? anonymousId ?? null;
  for (const loser of losers) {
    if (!winnerEmailHash) winnerEmailHash = loser.email_hash ?? null;
    if (!winnerPhoneHash) winnerPhoneHash = loser.phone_hash ?? null;
    if (!winnerUserId)    winnerUserId    = loser.user_id ?? null;
    if (!winnerAnonId)    winnerAnonId    = loser.anonymous_id ?? null;
  }

  await db.query(
    `UPDATE cdp_profiles SET
       traits = $1, sources = $2, event_count = $3, last_seen_at = datetime('now'),
       email_hash = $4, phone_hash = $5, user_id = $6, anonymous_id = $7
     WHERE id = $8`,
    [JSON.stringify(mergedTraits), JSON.stringify([...allSources]), totalEvents,
     winnerEmailHash ?? null, winnerPhoneHash ?? null, winnerUserId, winnerAnonId, winner.id],
  );

  // loser index → winner로 재연결 + loser 삭제 + merge_log 기록
  for (const loser of losers) {
    await db.query(
      'UPDATE cdp_identity_index SET profile_id = $1 WHERE profile_id = $2',
      [winner.id, loser.id],
    );
    await db.query(
      `INSERT INTO cdp_merge_log (id, mission_id, winner_id, loser_id)
       VALUES ($1,$2,$3,$4)`,
      [uuidv4(), missionId, winner.id, loser.id],
    );
    await db.query('DELETE FROM cdp_profiles WHERE id = $1', [loser.id]);
    logger.info(`[idGraph] MERGED loser=${loser.id} → winner=${winner.id}`);
  }

  // 신규 식별자 연결
  for (const { type, hash } of identifiers) {
    await linkIdentifierToProfile(db, missionId, winner.id, type, hash);
  }

  // 세그먼트 업데이트
  const newTier = getLtvTierFromCount(totalEvents);
  await trackSegmentTransition(db, winner.id, missionId, null, newTier, 'merge');

  return {
    profileId:   winner.id,
    isNew:       false,
    merged:      true,
    mergedCount: losers.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getIdentityGraph — Obsidian 그래프 데이터 조회
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id:          string;
  type:        'profile' | 'email_hash' | 'phone_hash' | 'user_id' | 'device_fingerprint' | 'anonymous_id' | 'fbclid' | 'gclid' | 'ttclid' | string;
  label:       string;
  idClass?:    IdClass;
  confidence?: number;
  ltvTier?:    'high' | 'mid' | 'low';
  eventCount?: number;
}

export interface GraphEdge {
  source:     string;
  target:     string;
  idClass:    IdClass;
  confidence: number;
}

export interface IdentityGraph {
  profileId:  string;
  nodes:      GraphNode[];
  edges:      GraphEdge[];
  mergedFrom: string[];  // loser profile IDs that were merged into this profile
}

export async function getIdentityGraph(
  db: Db,
  missionId: string,
  profileId: string,
): Promise<IdentityGraph | null> {
  const profile = await getProfile(db, missionId, profileId);
  if (!profile) return null;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Profile 노드
  const ltvTier = getLtvTierFromCount(profile.event_count ?? 0);
  const traits  = safeJsonParse<Record<string, unknown>>(profile.traits, {});
  const displayName = traits.name
    ? String(traits.name)
    : profile.user_id
    ? `User ${profile.user_id.slice(0, 8)}`
    : profile.anonymous_id
    ? `Anon ${profile.anonymous_id.slice(0, 8)}`
    : `Profile ${profileId.slice(0, 8)}`;

  nodes.push({
    id:         `profile:${profileId}`,
    type:       'profile',
    label:      displayName,
    ltvTier,
    eventCount: profile.event_count ?? 0,
  });

  // 식별자 노드 + 엣지
  const { rows: indexRows } = await db.query(
    `SELECT hash, type, id_class, confidence
     FROM cdp_identity_index
     WHERE profile_id = $1 AND mission_id = $2`,
    [profileId, missionId],
  );

  for (const row of indexRows as Array<{ hash: string; type: string; id_class: string; confidence: number }>) {
    const nodeId = `${row.type}:${row.hash.slice(0, 12)}`;
    let label: string;
    switch (row.type) {
      case 'email_hash':         label = 'email ****'; break;
      case 'phone_hash':         label = 'phone ****'; break;
      case 'user_id':            label = `UID ${row.hash.slice(0, 8)}`; break;
      case 'anonymous_id':       label = `Anon ${row.hash.slice(0, 8)}`; break;
      case 'device_fingerprint': label = `Device ${row.hash.slice(0, 8)}`; break;
      case 'fbclid':             label = 'FB Click'; break;
      case 'gclid':              label = 'Google Click'; break;
      case 'ttclid':             label = 'TikTok Click'; break;
      default:                   label = `${row.type} ${row.hash.slice(0, 6)}`;
    }

    nodes.push({
      id:         nodeId,
      type:       row.type,
      label,
      idClass:    row.id_class as IdClass,
      confidence: row.confidence,
    });

    edges.push({
      source:     `profile:${profileId}`,
      target:     nodeId,
      idClass:    row.id_class as IdClass,
      confidence: row.confidence,
    });
  }

  // 병합 히스토리
  const { rows: mergeRows } = await db.query(
    'SELECT loser_id FROM cdp_merge_log WHERE winner_id = $1 AND mission_id = $2',
    [profileId, missionId],
  );
  const mergedFrom = (mergeRows as Array<{ loser_id: string }>).map(r => r.loser_id);

  return { profileId, nodes, edges, mergedFrom };
}

// ─────────────────────────────────────────────────────────────────────────────
// 세그먼트 전이 추적
// ─────────────────────────────────────────────────────────────────────────────

function getLtvTierFromCount(count: number): 'high' | 'mid' | 'low' {
  return count >= 50 ? 'high' : count >= 10 ? 'mid' : 'low';
}

async function trackSegmentTransition(
  db: Db,
  profileId: string,
  missionId: string,
  fromTier: string | null,
  toTier: string,
  trigger: string,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO cdp_segment_history (id, profile_id, mission_id, from_tier, to_tier, trigger)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuidv4(), profileId, missionId, fromTier, toTier, trigger],
    );
  } catch {
    // non-fatal
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getProfileSegment — Growth Bot n8n payload용
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileSegment {
  profileId:   string;
  ltvTier:     'high' | 'mid' | 'low';
  eventCount:  number;
  sources:     string[];
  lastSeenAt?: string;
}

export async function getProfileSegment(
  db: Db,
  missionId: string,
  profileId: string,
): Promise<ProfileSegment | null> {
  const profile = await getProfile(db, missionId, profileId);
  if (!profile) return null;
  const sources   = safeJsonParse<string[]>(profile.sources, []);
  const count     = profile.event_count ?? 0;
  const ltvTier   = getLtvTierFromCount(count);
  return { profileId, ltvTier, eventCount: count, sources, lastSeenAt: profile.last_seen_at };
}

// ─────────────────────────────────────────────────────────────────────────────
// getDynamicMarketingSignal — 동적 마케팅 신호 (Growth Bot 톤 결정)
// ─────────────────────────────────────────────────────────────────────────────

export type ContentTone = 'humor' | 'authority' | 'empathy' | 'contrarian' | 'proof';

export interface MarketingSignal {
  recommendedTone:         ContentTone;
  priority:                'high' | 'mid' | 'low';
  shouldTriggerReactivation: boolean;
  reason:                  string;
}

const REACTIVATION_THRESHOLD_DAYS = 14;

export function getDynamicMarketingSignal(segment: {
  ltvTier:     'high' | 'mid' | 'low';
  eventCount:  number;
  sources:     string[];
  lastSeenAt?: string;
}): MarketingSignal {
  const { ltvTier, eventCount, sources, lastSeenAt } = segment;

  // 이탈 감지
  let shouldTriggerReactivation = false;
  if (lastSeenAt) {
    const daysSince = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= REACTIVATION_THRESHOLD_DAYS) {
      shouldTriggerReactivation = true;
    }
  }

  // 톤 결정 로직
  let recommendedTone: ContentTone;
  let priority: 'high' | 'mid' | 'low';
  let reason: string;

  if (ltvTier === 'high') {
    // 고가치 고객 → 신뢰/증거 기반
    recommendedTone = eventCount >= 100 ? 'proof' : 'authority';
    priority = 'high';
    reason = `High LTV (${eventCount} events) — 신뢰/증거 기반 콘텐츠로 유지`;
  } else if (ltvTier === 'mid') {
    const hasEmail = sources.some(s => s.toLowerCase().includes('email'));
    if (hasEmail) {
      recommendedTone = 'empathy';
      reason = 'Mid LTV + email 채널 — 공감 기반 육성';
    } else if (shouldTriggerReactivation) {
      recommendedTone = 'contrarian';
      reason = `Mid LTV + ${REACTIVATION_THRESHOLD_DAYS}일+ 미반응 — 역발상으로 재활성화`;
    } else {
      recommendedTone = 'authority';
      reason = 'Mid LTV — 전문성으로 업셀';
    }
    priority = 'mid';
  } else {
    // low LTV 신규
    if (eventCount <= 3) {
      recommendedTone = 'humor';
      reason = '신규 유저 (≤3 events) — 유머로 첫 인상';
    } else {
      recommendedTone = 'contrarian';
      reason = 'Low LTV 잠재 — 역발상으로 관심 유도';
    }
    priority = 'low';
  }

  return { recommendedTone, priority, shouldTriggerReactivation, reason };
}
