/**
 * growth.ts — Growth API 라우터
 * v5.2.0 — Lead Generation 전체 엔드포인트
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../middleware/apiError';
import { generateGrowthContent, type GrowthChannel } from '../../services/growthService';
import { ingestUrl, ingestManual } from '../../services/growthIngestionService';
import { generateImage } from '../../services/geminiService';
import { generateVideoKling, isKlingConfigured, type KlingDuration, type KlingAspect } from '../../services/klingService';
import { publishContent, type Platform } from '../../services/snsPublisherService';
import { scoreLead, getLeads, getLeadStats, type SignalType } from '../../services/leadScoringService';
import { manualTrigger, getActiveTriggers } from '../../services/cdpTriggerService';
import { getAttributionReport } from '../../services/attributionService';
import { linkIdentity, getIdGraphStats, detectAndRetarget, type IdType } from '../../services/cdpIdGraphService';
import { v4 as uuidv4 } from 'uuid';

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

// ── Zod 스키마 ─────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  mission_id:   z.string().uuid(),
  channel:      z.enum(['x', 'instagram', 'youtube', 'linkedin', 'blog', 'tiktok', 'naver_blog']),
  seed_content: z.string().min(1).max(2000),
  tone:         z.enum(['humor', 'authority', 'empathy', 'contrarian', 'proof']).optional(),
  segment:      z.enum(['new_visitor', 're_purchase', 'churn_risk', 'vip']).optional(),
  with_image:      z.boolean().optional().default(false),
  with_video:      z.boolean().optional().default(false),
  video_duration:  z.enum(['5', '10', '20', '60']).optional().default('5'),
});

const IngestSchema = z.object({
  url:         z.string().url().optional(),
  name:        z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  image_urls:  z.array(z.string().url()).optional(),
}).refine(d => d.url || d.name, { message: 'url 또는 name 중 하나는 필수' });

const PublishSchema = z.object({
  content_id:   z.string().uuid(),
  mission_id:   z.string().uuid(),
  platforms:    z.array(z.enum(['instagram','youtube','tiktok','x','naver_blog','linkedin'])).min(1),
  schedule_at:  z.string().datetime().optional().nullable(),
});

const SignalSchema = z.object({
  mission_id:  z.string().uuid(),
  profile_id:  z.string().uuid().optional().nullable(),
  signal:      z.enum(['content_click','multilink_visit','repeat_browse','email_click','sns_save','cart_abandon','content_generated']),
  score:       z.number().int().min(1).max(100).optional(),
});

const TriggerSchema = z.object({
  mission_id: z.string().uuid(),
  reason:     z.string().optional(),
});

// ── 라우터 ─────────────────────────────────────────────────────────────────

export function growthRouter(db: Db) {
  const router = Router();

  // ── POST /api/growth/ingest — URL 상품 정보 추출 ───────────────────────
  router.post('/ingest', async (req: Request, res: Response) => {
    const parse = IngestSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { url, name, description, image_urls } = parse.data;
    let productInfo;
    if (url) {
      productInfo = await ingestUrl(url);
    } else {
      productInfo = await ingestManual(name!, description ?? '', image_urls ?? []);
    }
    res.json({ data: productInfo });
  });

  // ── POST /api/growth/generate — 콘텐츠 3종 생성 ───────────────────────
  router.post('/generate', async (req: Request, res: Response) => {
    const parse = GenerateSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { mission_id, channel, seed_content, tone, segment, with_image, with_video, video_duration } = parse.data;

    // 텍스트 생성
    const textResult = await generateGrowthContent(
      db, mission_id, channel as GrowthChannel, seed_content, tone,
    );

    // 이미지·영상 병렬 생성 (non-fatal)
    const imagePromise = with_image
      ? generateImage(`Product marketing image for: "${seed_content.slice(0, 100)}". Channel: ${channel}. Style: professional, eye-catching.`, channel)
          .catch(() => null)
      : Promise.resolve(null);

    const videoPromise = with_video
      ? generateVideoKling(
          `${channel} video about: ${seed_content.slice(0, 200)}`,
          (channel === 'youtube' ? '16:9' : '9:16') as KlingAspect,
          video_duration as KlingDuration,
        ).catch(() => null)
      : Promise.resolve(null);

    const [imageUrl, videoUrl] = await Promise.all([imagePromise, videoPromise]);

    // segment / 미디어 URL 업데이트 (COALESCE로 기존 값 보호)
    if (segment || imageUrl || videoUrl) {
      await db.query(
        `UPDATE growth_content
         SET segment=$1,
             image_url=COALESCE($2, image_url),
             video_url=COALESCE($3, video_url)
         WHERE id=$4`,
        [segment ?? null, imageUrl, videoUrl, textResult.id],
      );
    }

    res.json({ data: { ...textResult, image_url: imageUrl, video_url: videoUrl } });
  });

  // ── GET /api/growth/content — 생성된 콘텐츠 목록 ─────────────────────
  router.get('/content', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId) throw new ApiError(400, 'mission_id required', 'VALIDATION_ERROR');

    const channel   = req.query.channel as string | undefined;
    const segment   = req.query.segment as string | undefined;
    const params: unknown[] = [missionId];
    let sql = 'SELECT * FROM growth_content WHERE mission_id = $1';
    if (channel) { sql += ` AND channel = $${params.push(channel)}`; }
    if (segment) { sql += ` AND segment = $${params.push(segment)}`; }
    sql += ' ORDER BY created_at DESC LIMIT 50';

    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  });

  // ── POST /api/growth/publish — SNS 자동 발사 ──────────────────────────
  router.post('/publish', async (req: Request, res: Response) => {
    const parse = PublishSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { content_id, mission_id, platforms, schedule_at } = parse.data;

    // 콘텐츠 조회
    const { rows } = await db.query(
      `SELECT * FROM growth_content WHERE id = $1 AND mission_id = $2`,
      [content_id, mission_id],
    );
    const content = rows[0] as Record<string, unknown> | undefined;
    if (!content) throw new ApiError(404, '콘텐츠를 찾을 수 없습니다', 'NOT_FOUND');

    if (schedule_at) {
      // 예약 발사: scheduled_at 업데이트 후 즉시 응답
      await db.query(
        `UPDATE growth_content SET status='scheduled', scheduled_at=$1 WHERE id=$2`,
        [schedule_at, content_id],
      );
      res.json({ data: { scheduled: true, scheduled_at: schedule_at } });
      return;
    }

    // 즉시 발사
    const results = await publishContent(
      db, mission_id,
      platforms as Platform[],
      {
        textContent: String(content.content ?? ''),
        imageUrl:    content.image_url as string | null,
        videoUrl:    content.video_url as string | null,
      },
      content_id,
    );

    // 발사 성공 → 리드 시그널 기록
    if (results.some(r => r.success)) {
      await scoreLead(db, mission_id, null, 'content_generated', 10);
    }

    res.json({ data: results });
  });

  // ── POST /api/growth/lead/signal — 리드 시그널 수신 ───────────────────
  router.post('/lead/signal', async (req: Request, res: Response) => {
    const parse = SignalSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { mission_id, profile_id, signal, score } = parse.data;
    const lead = await scoreLead(db, mission_id, profile_id ?? null, signal as SignalType, score);
    res.json({ data: lead });
  });

  // ── GET /api/growth/leads — 리드 목록 ─────────────────────────────────
  router.get('/leads', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId) throw new ApiError(400, 'mission_id required', 'VALIDATION_ERROR');

    const tier = req.query.tier as 'hot' | 'nurture' | 'cold' | undefined;
    const [leads, stats] = await Promise.all([
      getLeads(db, missionId, tier),
      getLeadStats(db, missionId),
    ]);
    res.json({ data: { leads, stats } });
  });

  // ── POST /api/growth/trigger — CDP 수동 트리거 ────────────────────────
  router.post('/trigger', async (req: Request, res: Response) => {
    const parse = TriggerSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { mission_id, reason } = parse.data;
    await manualTrigger(db, mission_id, reason ?? '수동 트리거', async (mId, triggerReason) => {
      // TODO: Growth Bot 자동 실행 연결 (triggerAgent 콜백 필요)
      await db.query(
        `INSERT INTO feed_items (id, agent_id, type, content, requires_approval, created_at)
         SELECT $1, id, 'info', $2, 0, datetime('now') FROM agents
         WHERE mission_id=$3 AND role='growth' AND is_active=1 LIMIT 1`,
        [uuidv4(), `[CDP 트리거] ${triggerReason}`, mId],
      );
    });

    res.json({ data: { triggered: true, mission_id, reason } });
  });

  // ── GET /api/growth/status ────────────────────────────────────────────
  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      data: {
        kling_configured: isKlingConfigured(),
        active_triggers:   getActiveTriggers(),
      },
    });
  });

  // ── GET /api/growth/attribution — AI 기여도 분석 ─────────────────────
  router.get('/attribution', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId) throw new ApiError(400, 'mission_id required', 'VALIDATION_ERROR');
    const report = await getAttributionReport(db, missionId);
    res.json({ data: report });
  });

  // ── POST /api/growth/identity-link — CDP ID Graph 연결 ───────────────
  router.post('/identity-link', async (req: Request, res: Response) => {
    const schema = z.object({
      mission_id:  z.string().uuid(),
      hash:        z.string().min(1).max(512),
      type:        z.enum(['anonymous_id', 'email', 'phone', 'cookie', 'device']),
      profile_id:  z.string().uuid(),
      confidence:  z.number().min(0).max(1).optional().default(1.0),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { mission_id, hash, type, profile_id, confidence } = parse.data;
    await linkIdentity(db, mission_id, hash, type as IdType, profile_id, confidence);

    const stats = await getIdGraphStats(db, mission_id);
    res.json({ data: { linked: true, stats } });
  });

  // ── GET /api/growth/id-graph — ID Graph 통계 ─────────────────────────
  router.get('/id-graph', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId) throw new ApiError(400, 'mission_id required', 'VALIDATION_ERROR');
    const stats = await getIdGraphStats(db, missionId);
    res.json({ data: stats });
  });

  // ── POST /api/growth/retarget — CDP 리타겟팅 실행 ────────────────────
  router.post('/retarget', async (req: Request, res: Response) => {
    const { mission_id } = z.object({ mission_id: z.string().uuid() }).parse(req.body);
    const result = await detectAndRetarget(db, mission_id);
    res.json({ data: result });
  });

  return router;
}
