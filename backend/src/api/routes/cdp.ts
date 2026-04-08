/**
 * cdp.ts — oomni-cdp 연동 라우트
 * GET  /api/cdp/status      — CDP 연동 상태
 * GET  /api/cdp/segments    — 세그먼트 목록 (mock or real)
 * POST /api/cdp/campaign    — 캠페인 발송
 */
import { Router, type Request, type Response } from 'express';
import { readSettings } from '../../config';

// 데모 세그먼트 데이터 (API 키 미설정 시 표시 — 날짜 기반 안정적 값)
function getMockSegments() {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const pseudo = (n: number) => Math.abs((seed * n * 1664525 + 1013904223) & 0x7fffffff);
  return [
    { id: 'power',  label: '파워유저', icon: '⚡', color: 'yellow', count: pseudo(1) % 200 + 480 },
    { id: 'churn',  label: '이탈위험', icon: '⚠️', color: 'red',    count: pseudo(2) % 80  + 120 },
    { id: 'new',    label: '신규가입', icon: '🌱', color: 'green',  count: pseudo(3) % 150 + 310 },
    { id: 'repeat', label: '재구매',  icon: '🔄', color: 'blue',   count: pseudo(4) % 300 + 670 },
  ];
}

export function cdpRouter(): Router {
  const router = Router();

  // GET /api/cdp/status
  router.get('/status', (_req: Request, res: Response) => {
    const settings = readSettings();
    res.json({
      connected: !!settings.cdp_api_key,
      mode: settings.cdp_api_key ? 'live' : 'demo',
    });
  });

  // GET /api/cdp/segments — 세그먼트 반환
  router.get('/segments', async (_req: Request, res: Response) => {
    const settings = readSettings();

    if (!settings.cdp_api_key) {
      // 데모 모드: mock 데이터
      const segments = getMockSegments();
      res.json({ data: segments, mode: 'demo' });
      return;
    }

    // 실제 oomni-cdp API 호출 (연동됐을 때)
    try {
      const { default: axios } = await import('axios');
      const cdpBaseUrl = process.env.OOMNI_CDP_BASE_URL ?? 'https://api.oomni-cdp.com';
      const resp = await axios.get(`${cdpBaseUrl}/v1/segments`, {
        headers: { Authorization: `Bearer ${settings.cdp_api_key}` },
        timeout: 8000,
      });
      res.json({ data: resp.data, mode: 'live' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `CDP API 호출 실패: ${msg}`, mode: 'live' });
    }
  });

  // POST /api/cdp/campaign — 캠페인 발송
  router.post('/campaign', async (req: Request, res: Response) => {
    const settings = readSettings();
    const { segment_id, channel, message } = req.body as {
      segment_id?: string;
      channel?: 'email' | 'sms' | 'push';
      message?: string;
    };

    if (!segment_id || !channel || !message) {
      res.status(400).json({ error: 'segment_id, channel, message가 필요합니다' });
      return;
    }

    if (!settings.cdp_api_key) {
      // 데모 모드: 발송 시뮬레이션
      res.json({
        success: true,
        mode: 'demo',
        message: `[데모] ${segment_id} 세그먼트에 ${channel} 캠페인 발송 시뮬레이션 완료`,
        sent_count: Math.floor(Math.random() * 200) + 50,
      });
      return;
    }

    // 실제 API 호출
    try {
      const { default: axios } = await import('axios');
      const cdpBaseUrl = process.env.OOMNI_CDP_BASE_URL ?? 'https://api.oomni-cdp.com';
      const resp = await axios.post(
        `${cdpBaseUrl}/v1/campaigns`,
        { segment_id, channel, message },
        { headers: { Authorization: `Bearer ${settings.cdp_api_key}` }, timeout: 10000 }
      );
      res.json({ success: true, mode: 'live', ...resp.data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `캠페인 발송 실패: ${msg}` });
    }
  });

  return router;
}
