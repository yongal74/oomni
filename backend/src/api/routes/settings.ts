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
  key: z.string().min(10, 'API 키가 너무 짧습니다').max(300, 'API 키가 너무 깁니다'),
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

  // GET /api/settings/obsidian — Obsidian vault path 반환
  router.get('/obsidian', (_req: Request, res: Response) => {
    const settings = readSettings();
    res.json({ vault_path: settings.obsidian_vault_path ?? '' });
  });

  // POST /api/settings/obsidian — Obsidian vault path 저장
  router.post('/obsidian', (req: Request, res: Response) => {
    const { vault_path } = req.body as { vault_path?: string };
    if (typeof vault_path !== 'string') {
      res.status(400).json({ error: 'vault_path is required' });
      return;
    }
    saveSettings({ obsidian_vault_path: vault_path });
    res.json({ success: true });
  });

  // GET /api/settings/integrations — CDP + video 연동 상태
  router.get('/integrations', (_req: Request, res: Response) => {
    const settings = readSettings();
    res.json({
      cdp_configured: !!settings.cdp_api_key,
      cdp_key_masked: settings.cdp_api_key ? maskApiKey(settings.cdp_api_key) : null,
      video_configured: !!settings.video_api_key,
      video_key_masked: settings.video_api_key ? maskApiKey(settings.video_api_key) : null,
    });
  });

  // POST /api/settings/cdp-key — oomni-cdp API 키 저장
  router.post('/cdp-key', (req: Request, res: Response) => {
    const { key } = req.body as { key?: string };
    if (!key || key.length < 8) {
      res.status(400).json({ error: 'CDP API 키를 입력하세요' });
      return;
    }
    saveSettings({ cdp_api_key: key });
    res.json({ success: true, message: 'oomni-cdp API 키가 저장되었습니다' });
  });

  // DELETE /api/settings/cdp-key — CDP 연동 해제
  router.delete('/cdp-key', (_req: Request, res: Response) => {
    saveSettings({ cdp_api_key: undefined });
    res.json({ success: true });
  });

  // POST /api/settings/video-key — oomni-video API 키 저장
  router.post('/video-key', (req: Request, res: Response) => {
    const { key } = req.body as { key?: string };
    if (!key || key.length < 8) {
      res.status(400).json({ error: 'Video API 키를 입력하세요' });
      return;
    }
    saveSettings({ video_api_key: key });
    res.json({ success: true, message: 'oomni-video API 키가 저장되었습니다' });
  });

  // DELETE /api/settings/video-key — video 연동 해제
  router.delete('/video-key', (_req: Request, res: Response) => {
    saveSettings({ video_api_key: undefined });
    res.json({ success: true });
  });

  // POST /api/settings/google-oauth — Google OAuth 클라이언트 ID/Secret 저장
  router.post('/google-oauth', (req: Request, res: Response) => {
    const { client_id, client_secret } = req.body as { client_id?: string; client_secret?: string };
    if (!client_id || client_id.length < 10) {
      res.status(400).json({ error: 'Google 클라이언트 ID를 입력하세요' });
      return;
    }
    if (!client_secret || client_secret.length < 8) {
      res.status(400).json({ error: 'Google 클라이언트 Secret을 입력하세요' });
      return;
    }
    saveSettings({ google_client_id: client_id, google_client_secret: client_secret });
    // 즉시 process.env 업데이트 (재시작 없이 반영)
    process.env.GOOGLE_CLIENT_ID = client_id;
    process.env.GOOGLE_CLIENT_SECRET = client_secret;
    res.json({ success: true, message: 'Google OAuth 설정이 저장되었습니다.' });
  });

  // GET /api/settings/google-oauth — Google OAuth 설정 상태
  router.get('/google-oauth', (_req: Request, res: Response) => {
    const settings = readSettings();
    res.json({
      configured: !!(settings.google_client_id && settings.google_client_secret),
      client_id_masked: settings.google_client_id ? maskApiKey(settings.google_client_id) : null,
    });
  });

  return router;
}
