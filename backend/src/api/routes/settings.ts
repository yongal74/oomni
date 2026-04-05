/**
 * settings.ts — 앱 설정 라우트 (인증 없이 접근 가능, 온보딩용)
 * GET  /api/settings             — 현재 설정 반환 (API 키 마스킹)
 * POST /api/settings/api-key     — Anthropic API 키 저장
 * GET  /api/settings/api-key/status — API 키 설정 여부 반환
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { saveSettings, readSettings } from '../../config';

const ApiKeySchema = z.object({
  key: z.string().min(10, 'API 키가 너무 짧습니다'),
});

function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '***';
  return key.slice(0, 8) + '...' + key.slice(-4);
}

export function settingsRouter(): Router {
  const router = Router();

  // GET /api/settings — 현재 설정 반환 (API 키 마스킹)
  router.get('/', (_req: Request, res: Response) => {
    const settings = readSettings();
    res.json({
      anthropic_api_key: settings.anthropic_api_key
        ? maskApiKey(settings.anthropic_api_key)
        : null,
      google_configured: !!(settings.google_client_id && settings.google_client_secret),
    });
  });

  // POST /api/settings/api-key — API 키 저장
  router.post('/api-key', (req: Request, res: Response) => {
    const parsed = ApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'API 키 입력 오류' });
      return;
    }

    const { key } = parsed.data;
    saveSettings({ anthropic_api_key: key });

    // process.env도 즉시 업데이트 (재시작 없이 반영)
    process.env.ANTHROPIC_API_KEY = key;

    res.json({ success: true, message: 'API 키가 저장되었습니다' });
  });

  // GET /api/settings/api-key/status — API 키 설정 여부
  router.get('/api-key/status', (_req: Request, res: Response) => {
    const settings = readSettings();
    const fromEnv = process.env.ANTHROPIC_API_KEY ?? '';
    const isSet = !!(settings.anthropic_api_key || fromEnv);
    res.json({ api_key_set: isSet });
  });

  return router;
}
