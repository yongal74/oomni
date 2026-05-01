/**
 * auth.ts — PIN 전용 인증 라우트 (v3.0.0)
 * POST /api/auth/setup              — 최초 PIN 설정 (admin 유저 생성)
 * POST /api/auth/login              — PIN 로그인 → 세션 토큰 발급
 * POST /api/auth/logout             — 세션 토큰 삭제
 * GET  /api/auth/status             — 로그인 상태 확인
 * POST /api/auth/pin/set            — (호환) 최초 PIN 설정
 * POST /api/auth/pin/verify         — (호환) PIN 검증 → 세션 토큰
 * POST /api/auth/change-pin         — PIN 변경
 * PATCH /api/auth/profile           — 프로필 업데이트
 * GET  /api/auth/license/status     — 라이선스 상태
 * POST /api/auth/license/activate   — 라이선스 키 활성화
 */
import { Router, type Request, type Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { getRawDb } from '../../db/client';
import { v4 as uuidv4 } from 'uuid';

// PIN 해싱 (sha256 + salt)
function hashPin(pin: string): string {
  return createHash('sha256').update(pin + 'oomni-salt').digest('hex');
}

// ── 브루트포스 방어 ───────────────────────────────────────
// 5회 실패 시 15분 잠금 (메모리 기반, 재시작 시 초기화)
const LOCKOUT_MAX   = 5;
const LOCKOUT_MS    = 15 * 60 * 1000; // 15분

interface FailRecord { count: number; until: number }
const failMap = new Map<string, FailRecord>();

function getClientKey(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? req.ip ?? 'local');
  return ip.trim();
}

function isLocked(key: string): boolean {
  const rec = failMap.get(key);
  if (!rec) return false;
  if (Date.now() > rec.until) { failMap.delete(key); return false; }
  return rec.count >= LOCKOUT_MAX;
}

function recordFailure(key: string): void {
  const rec = failMap.get(key);
  if (!rec || Date.now() > rec.until) {
    failMap.set(key, { count: 1, until: Date.now() + LOCKOUT_MS });
  } else {
    rec.count++;
  }
}

function clearFailure(key: string): void {
  failMap.delete(key);
}

// 세션 토큰 생성 (30일 만료, DB 저장)
function createSession(userId: string): string {
  const db = getRawDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at, last_used_at)
     VALUES (?, ?, datetime('now'), ?, datetime('now'))`
  ).run(token, userId, expiresAt);
  return token;
}

// 만료된 세션 정리
function cleanExpiredSessions(): void {
  try {
    getRawDb()
      .prepare(`DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`)
      .run();
  } catch {
    // 정리 실패 무시
  }
}

// 앱 시작 후 5초 뒤 만료 세션 자동 정리
setTimeout(() => {
  cleanExpiredSessions();
}, 5000);

export function authRouter(): Router {
  const router = Router();

  // POST /api/auth/setup — 최초 PIN 설정 (admin 유저 생성)
  router.post('/setup', (req: Request, res: Response) => {
    const { pin } = req.body as { pin?: unknown };
    const pinStr = String(pin ?? '');
    if (!pin || pinStr.length < 4 || pinStr.length > 20) {
      res.status(400).json({ error: 'PIN은 4~20자리여야 합니다' });
      return;
    }
    const db = getRawDb();
    const existing = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).get();
    if (existing) {
      res.status(400).json({ error: '이미 설정되어 있습니다' });
      return;
    }
    const id = uuidv4();
    db.prepare(`INSERT INTO users (id, role, pin_hash) VALUES (?, 'admin', ?)`)
      .run(id, hashPin(String(pin)));
    const token = createSession(id);
    res.json({ token });
  });

  // POST /api/auth/login — PIN 로그인
  router.post('/login', (req: Request, res: Response) => {
    const clientKey = getClientKey(req);
    if (isLocked(clientKey)) {
      res.status(429).json({ error: '로그인 시도 횟수 초과. 15분 후 다시 시도하세요.' });
      return;
    }
    const { pin } = req.body as { pin?: unknown };
    if (!pin) {
      res.status(400).json({ error: 'PIN 필요' });
      return;
    }
    const db = getRawDb();
    const user = db
      .prepare(`SELECT id FROM users WHERE role = 'admin' AND pin_hash = ?`)
      .get(hashPin(String(pin))) as { id: string } | undefined;
    if (!user) {
      recordFailure(clientKey);
      res.status(401).json({ error: 'PIN이 올바르지 않습니다' });
      return;
    }
    clearFailure(clientKey);
    const token = createSession(user.id);
    res.json({ token });
  });

  // POST /api/auth/logout — 세션 삭제
  router.post('/logout', (req: Request, res: Response) => {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      getRawDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    }
    res.json({ ok: true });
  });

  // GET /api/auth/status — 로그인 상태 확인
  router.get('/status', (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : (req.query['token'] as string | undefined);

    const db = getRawDb();
    const hasPin = !!db.prepare(`SELECT id FROM users WHERE role = 'admin'`).get();

    if (!token) {
      res.json({ authenticated: false, hasPin, pin_set: hasPin });
      return;
    }

    const session = db
      .prepare(
        `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(token);

    if (session) {
      // last_used_at 갱신
      db.prepare(`UPDATE sessions SET last_used_at = datetime('now') WHERE token = ?`).run(token);
    }

    res.json({ authenticated: !!session, hasPin, pin_set: hasPin });
  });

  // ── 하위 호환 PIN 엔드포인트 (/pin/set, /pin/verify) ──────────────

  // POST /api/auth/pin/set — 최초 PIN 설정 (호환)
  router.post('/pin/set', (req: Request, res: Response) => {
    const { pin } = req.body as { pin?: unknown };
    const pinStr = String(pin ?? '');
    if (!pin || pinStr.length < 4 || pinStr.length > 20) {
      res.status(400).json({ error: 'PIN은 4~20자리여야 합니다' });
      return;
    }
    const db = getRawDb();
    const existing = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).get();
    if (existing) {
      res.status(409).json({ error: 'PIN이 이미 설정되어 있습니다' });
      return;
    }
    const id = uuidv4();
    db.prepare(`INSERT INTO users (id, role, pin_hash) VALUES (?, 'admin', ?)`)
      .run(id, hashPin(String(pin)));
    res.json({ success: true, message: 'PIN이 설정되었습니다' });
  });

  // POST /api/auth/pin/verify — PIN 검증 → 세션 토큰 (호환)
  router.post('/pin/verify', (req: Request, res: Response) => {
    const clientKey = getClientKey(req);
    if (isLocked(clientKey)) {
      res.status(429).json({ error: '로그인 시도 횟수 초과. 15분 후 다시 시도하세요.' });
      return;
    }
    const { pin } = req.body as { pin?: unknown };
    if (!pin) {
      res.status(400).json({ error: 'PIN 필요' });
      return;
    }
    const db = getRawDb();
    const hasAdmin = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).get();
    if (!hasAdmin) {
      res.status(404).json({ error: 'PIN이 설정되지 않았습니다' });
      return;
    }
    const user = db
      .prepare(`SELECT id FROM users WHERE role = 'admin' AND pin_hash = ?`)
      .get(hashPin(String(pin))) as { id: string } | undefined;
    if (!user) {
      recordFailure(clientKey);
      res.status(401).json({ error: 'PIN이 올바르지 않습니다' });
      return;
    }
    clearFailure(clientKey);
    const token = createSession(user.id);
    res.json({ success: true, session_token: token });
  });

  // POST /api/auth/change-pin — PIN 변경
  router.post('/change-pin', (req: Request, res: Response) => {
    const { currentPin, newPin } = req.body as {
      currentPin?: unknown;
      newPin?: unknown;
    };
    if (!currentPin || !newPin) {
      res.status(400).json({ error: 'currentPin, newPin 필요' });
      return;
    }
    const newPinStr = String(newPin);
    if (newPinStr.length < 4 || newPinStr.length > 20) {
      res.status(400).json({ error: '새 PIN은 4~20자리여야 합니다' });
      return;
    }
    const db = getRawDb();
    const user = db
      .prepare(`SELECT id FROM users WHERE role = 'admin' AND pin_hash = ?`)
      .get(hashPin(String(currentPin))) as { id: string } | undefined;
    if (!user) {
      res.status(401).json({ error: '현재 PIN이 올바르지 않습니다' });
      return;
    }
    db.prepare(`UPDATE users SET pin_hash = ? WHERE id = ?`).run(
      hashPin(String(newPin)),
      user.id
    );
    res.json({ ok: true });
  });

  // PATCH /api/auth/profile — 프로필 업데이트 (display_name)
  router.patch('/profile', (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      (req.query['token'] as string | undefined);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const db = getRawDb();
    const session = db
      .prepare(
        `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(token) as { user_id?: string } | undefined;
    if (!session) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    const userId = session.user_id;
    if (!userId) {
      res.status(400).json({ error: 'No user linked to session' });
      return;
    }

    const { display_name } = req.body as { display_name?: string };
    if (!display_name?.trim()) {
      res.status(400).json({ error: 'display_name is required' });
      return;
    }

    db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`).run(
      display_name.trim(),
      userId
    );
    res.json({ data: { success: true } });
  });

  // POST /api/auth/license/activate — 라이선스 키 활성화
  router.post('/license/activate', (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      (req.query['token'] as string | undefined);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { license_key } = req.body as { license_key?: string };
    if (!license_key?.trim()) {
      res.status(400).json({ error: 'license_key is required' });
      return;
    }

    const db = getRawDb();
    const session = db
      .prepare(
        `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(token) as { user_id?: string } | undefined;
    if (!session) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    const userId = session.user_id;
    if (!userId) {
      res.status(400).json({ error: 'No user linked to session' });
      return;
    }

    const keyPattern = /^OOMNI-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyPattern.test(license_key.trim())) {
      res.status(400).json({ error: '유효하지 않은 라이선스 키 형식입니다.' });
      return;
    }

    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    db.prepare(
      `UPDATE users SET license_key = ?, license_valid_until = ? WHERE id = ?`
    ).run(license_key.trim(), validUntil.toISOString(), userId);

    res.json({ data: { success: true, license_valid_until: validUntil.toISOString() } });
  });

  // GET /api/auth/license/status — 라이선스/구독 상태 확인
  router.get('/license/status', (req: Request, res: Response) => {
    // 개발자 모드 우회
    if (process.env.OOMNI_DEV_MODE === 'true') {
      res.json({ valid: true, reason: 'dev_mode', unlimited: true, plan: 'admin' });
      return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query['token'] as string | undefined);

    if (!token) {
      res.json({ valid: false, reason: 'not_authenticated', plan: 'free' });
      return;
    }

    const db = getRawDb();
    const session = db
      .prepare(
        `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(token) as { user_id?: string } | undefined;

    if (!session) {
      res.json({ valid: false, reason: 'session_expired', plan: 'free' });
      return;
    }

    const userId = session.user_id;
    if (!userId) {
      res.json({ valid: true, reason: 'pin_auth', plan: 'free', unlimited: false });
      return;
    }

    try {
      const userRow = db
        .prepare(
          `SELECT role, license_key, license_valid_until FROM users WHERE id = ?`
        )
        .get(userId) as {
          role?: string;
          license_key?: string;
          license_valid_until?: string;
        } | undefined;

      // admin이면 무제한
      if (userRow?.role === 'admin') {
        res.json({ valid: true, reason: 'admin', plan: 'admin', unlimited: true });
        return;
      }

      // 활성 구독 확인
      const subRow = db
        .prepare(
          `SELECT plan, status, current_period_end FROM subscriptions
           WHERE user_id = ? AND status = 'active'
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(userId) as {
          plan?: string;
          status?: string;
          current_period_end?: string;
        } | undefined;

      if (subRow?.plan && subRow.plan !== 'free') {
        res.json({
          valid: true,
          reason: 'subscription_active',
          plan: subRow.plan,
          unlimited: true,
          current_period_end: subRow.current_period_end ?? null,
        });
        return;
      }

      // 라이선스 키 유효성 확인
      if (userRow?.license_valid_until) {
        const validUntil = new Date(userRow.license_valid_until);
        if (validUntil > new Date()) {
          res.json({
            valid: true,
            reason: 'license_key',
            plan: 'personal',
            unlimited: true,
            license_valid_until: userRow.license_valid_until,
          });
          return;
        }
      }

      // 무료 플랜
      res.json({ valid: true, reason: 'free_plan', plan: 'free', unlimited: false });
    } catch {
      // DB 오류 시 fallback
      res.json({ valid: true, reason: 'fallback', plan: 'free', unlimited: false });
    }
  });

  return router;
}

// 세션 유효성 헬퍼 (외부에서 사용 가능)
export function isValidSession(token: string): boolean {
  try {
    const session = getRawDb()
      .prepare(
        `SELECT token FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(token);
    return !!session;
  } catch {
    return false;
  }
}
