/**
 * sns.ts — SNS OAuth 연결 라우터
 * GET  /api/sns/connections?mission_id=      — 연결된 계정 목록
 * POST /api/sns/connect/:platform            — OAuth URL 발급
 * GET  /api/sns/callback/:platform           — OAuth 콜백 (토큰 교환)
 * DELETE /api/sns/connections/:platform      — 연결 해제
 */
import { randomBytes } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../middleware/apiError';
import {
  getOAuthUrl, exchangeCodeAndSave, getConnections, disconnectPlatform,
  type Platform,
} from '../../services/snsPublisherService';

const PLATFORMS: Platform[] = ['instagram', 'youtube', 'tiktok', 'x', 'naver_blog', 'linkedin'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 인메모리 state 저장 (TTL 3분 — OAuth 표준 권장)
const stateStore = new Map<string, { missionId: string; expiresAt: number }>();

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function html(msg: string, success: boolean): string {
  const color = success ? '#22c55e' : '#f59e0b';
  const icon  = success ? '✓' : '⚠';
  // msg is already escaped at call site
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{background:#0d0d0f;color:#e4e4e7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .box{text-align:center;padding:40px 60px;border:1px solid ${color};border-radius:12px;max-width:400px}
  .icon{font-size:48px;color:${color}}.msg{margin:16px 0;font-size:14px;line-height:1.5}.note{font-size:12px;color:#52525b}
</style></head>
<body><div class="box">
  <div class="icon">${icon}</div>
  <div class="msg">${msg}</div>
  <div class="note">이 창을 닫으세요 (3초 후 자동 닫힘)</div>
</div>
<script>setTimeout(()=>window.close(),3000)</script></body></html>`;
}

export function snsRouter(db: Db) {
  const router = Router();

  // ── GET /api/sns/connections ─────────────────────────────────────────────
  router.get('/connections', async (req: Request, res: Response) => {
    const missionId = req.query.mission_id as string;
    if (!missionId || !UUID_RE.test(missionId)) {
      throw new ApiError(400, 'mission_id must be a valid UUID', 'VALIDATION_ERROR');
    }
    const connections = await getConnections(db, missionId);
    res.json({ data: connections });
  });

  // ── POST /api/sns/connect/:platform ─────────────────────────────────────
  router.post('/connect/:platform', async (req: Request, res: Response) => {
    const platform = req.params.platform as Platform;
    if (!PLATFORMS.includes(platform)) {
      throw new ApiError(400, '지원하지 않는 플랫폼', 'VALIDATION_ERROR');
    }
    const parse = z.object({ mission_id: z.string().uuid() }).safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');
    const { mission_id } = parse.data;

    // 만료된 state 정리
    for (const [k, v] of stateStore) {
      if (v.expiresAt < Date.now()) stateStore.delete(k);
    }

    // crypto-random state (충돌·예측 불가)
    const state = randomBytes(32).toString('base64url');
    stateStore.set(state, { missionId: mission_id, expiresAt: Date.now() + 180_000 }); // 3분 TTL

    const authUrl = getOAuthUrl(platform, state);
    res.json({ data: { auth_url: authUrl } });
  });

  // ── GET /api/sns/callback/:platform ─────────────────────────────────────
  router.get('/callback/:platform', async (req: Request, res: Response) => {
    const platform = req.params.platform as Platform;
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code || !state) {
      res.send(html('OAuth 코드가 없습니다', false));
      return;
    }

    const stateData = stateStore.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      res.send(html('OAuth state가 만료되었습니다. 다시 시도해주세요.', false));
      return;
    }
    stateStore.delete(state);

    try {
      const conn = await exchangeCodeAndSave(db, platform, stateData.missionId, code);
      const name = escHtml(conn.account_name ?? platform); // XSS 방지
      res.send(html(`${name} (${escHtml(platform)}) 연결 완료`, true));
    } catch (e) {
      // 내부 오류 상세 노출 방지 — 사용자용 메시지만 표시
      const safe = e instanceof Error && e.message.length < 120
        ? escHtml(e.message)
        : '인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
      res.send(html(`연결 실패: ${safe}`, false));
    }
  });

  // ── DELETE /api/sns/connections/:platform ────────────────────────────────
  router.delete('/connections/:platform', async (req: Request, res: Response) => {
    const platform = req.params.platform as Platform;
    if (!PLATFORMS.includes(platform)) {
      throw new ApiError(400, '지원하지 않는 플랫폼', 'VALIDATION_ERROR');
    }
    const missionId = req.query.mission_id as string;
    if (!missionId || !UUID_RE.test(missionId)) {
      throw new ApiError(400, 'mission_id must be a valid UUID', 'VALIDATION_ERROR');
    }

    await disconnectPlatform(db, missionId, platform);
    res.json({ data: { disconnected: true, platform } });
  });

  return router;
}
