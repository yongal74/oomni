/**
 * identity.ts — CDP ID-Graphing API
 * v5.0.1
 *
 * POST /api/identity/resolve   — 식별자 제출 → 프로필 생성/병합
 * POST /api/identity/event     — 이벤트 수집 → 프로필 event_count 증가
 * GET  /api/identity/profile/:id — 프로필 조회
 * GET  /api/identity/profiles?mission_id= — 프로필 목록
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../../middleware/apiError';
import { resolveIdentity, getProfileSegment, getIdentityGraph } from '../../services/idGraph';

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const ResolveSchema = z.object({
  mission_id:          z.string().uuid(),
  email:               z.string().email().optional(),
  phone:               z.string().optional(),
  user_id:             z.string().optional(),
  anonymous_id:        z.string().optional(),
  device_fingerprint:  z.string().optional(),
  fbclid:              z.string().optional(),
  gclid:               z.string().optional(),
  ttclid:              z.string().optional(),
  source:              z.string().default('api'),
  traits:              z.record(z.unknown()).optional(),
});

const EventSchema = z.object({
  mission_id:   z.string().uuid(),
  profile_id:   z.string().optional(),
  anonymous_id: z.string().optional(),
  event_type:   z.string().min(1),
  properties:   z.record(z.unknown()).optional(),
  channel:      z.string().optional(),
  source:       z.string().optional(),
});

export function identityRouter(db: Db) {
  const router = Router();

  // POST /resolve — 식별자 → 프로필 (생성/매칭/병합)
  router.post('/resolve', async (req: Request, res: Response) => {
    const parse = ResolveSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { mission_id, email, phone, user_id, anonymous_id,
            device_fingerprint, fbclid, gclid, ttclid, source, traits } = parse.data;

    const result = await resolveIdentity(db, mission_id, {
      email, phone, userId: user_id, anonymousId: anonymous_id,
      deviceFingerprint: device_fingerprint, fbclid, gclid, ttclid, source, traits,
    });

    res.json({ data: result });
  });

  // POST /event — 이벤트 수집
  router.post('/event', async (req: Request, res: Response) => {
    const parse = EventSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { mission_id, profile_id, anonymous_id, event_type,
            properties, channel, source } = parse.data;

    const eventId = uuidv4();
    await db.query(
      `INSERT INTO cdp_events (id, mission_id, profile_id, event_type, properties, channel, source, anonymous_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [eventId, mission_id, profile_id ?? null, event_type,
       JSON.stringify(properties ?? {}), channel ?? null, source ?? null, anonymous_id ?? null],
    );

    // event_count 증가
    if (profile_id) {
      await db.query(
        "UPDATE cdp_profiles SET event_count = event_count + 1, last_seen_at = datetime('now') WHERE id = $1",
        [profile_id],
      );
    }

    res.json({ data: { event_id: eventId } });
  });

  // GET /profile/:id
  router.get('/profile/:id', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId) throw new ApiError(400, 'mission_id required', 'VALIDATION_ERROR');

    const { rows } = await db.query(
      'SELECT * FROM cdp_profiles WHERE id = $1 AND mission_id = $2',
      [req.params.id, missionId],
    );
    if (!rows.length) throw new ApiError(404, '프로필을 찾을 수 없습니다', 'NOT_FOUND');

    const profile = rows[0] as Record<string, unknown>;
    const segment = await getProfileSegment(db, missionId, req.params.id as string);

    res.json({ data: { ...profile, segment } });
  });

  // GET /graph/:profileId?mission_id= — Obsidian 그래프 데이터
  router.get('/graph/:profileId', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId) throw new ApiError(400, 'mission_id required', 'VALIDATION_ERROR');

    const graph = await getIdentityGraph(db, missionId, req.params.profileId as string);
    if (!graph) throw new ApiError(404, '프로필을 찾을 수 없습니다', 'NOT_FOUND');

    res.json({ data: graph });
  });

  // GET /profiles?mission_id=&limit=&offset=
  router.get('/profiles', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId) throw new ApiError(400, 'mission_id required', 'VALIDATION_ERROR');

    const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);

    const { rows } = await db.query(
      'SELECT * FROM cdp_profiles WHERE mission_id = $1 ORDER BY last_seen_at DESC LIMIT $2 OFFSET $3',
      [missionId, limit, offset],
    );

    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) as total FROM cdp_profiles WHERE mission_id = $1',
      [missionId],
    );

    res.json({
      data: rows,
      total: (countRows[0] as { total: number }).total,
    });
  });

  return router;
}
