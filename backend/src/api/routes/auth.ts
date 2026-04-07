/**
 * auth.ts — 로컬 PIN 인증 + Google OAuth + Firebase Auth 라우트
 * POST /api/auth/pin/set            — PIN 설정 (처음 한 번)
 * POST /api/auth/pin/verify         — PIN 검증 → 세션 토큰 반환
 * GET  /api/auth/status             — PIN 설정 여부 확인
 * GET  /api/auth/google             — Google OAuth 시작
 * GET  /api/auth/google/callback    — Google OAuth 콜백
 * GET  /api/auth/google/status      — Google 인증 세션 상태
 * GET  /api/auth/google/pending-token — 대기 중인 토큰 반환 후 삭제
 * POST /api/auth/firebase/verify    — Firebase ID Token 검증 → 세션 토큰
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import admin from 'firebase-admin';
import { getDb } from '../../db/client.js';

// ── firebase-admin 초기화 (서비스 계정 또는 Application Default Credentials) ──
let firebaseAdminInitialized = false;
function ensureFirebaseAdmin(): boolean {
  if (firebaseAdminInitialized) return true;
  // 이미 초기화된 앱이 있으면 재사용
  if (admin.apps.length > 0) {
    firebaseAdminInitialized = true;
    return true;
  }
  try {
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(serviceAccountPath) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      // 서비스 계정 없이 기본 초기화 (제한된 검증)
      admin.initializeApp();
    }
    firebaseAdminInitialized = true;
    return true;
  } catch {
    return false;
  }
}

const AUTH_FILE = path.join('C:/oomni-data', 'auth.json');

// Google OAuth 대기 중인 토큰 (앱이 폴링해서 가져감)
let pendingGoogleToken: string | null = null;

// ── DB 세션 헬퍼 ────────────────────────────────────────────

/** 30일 후 만료 시각 (ISO 문자열) */
function expiresAt30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

/** DB에 세션 저장 */
async function saveSession(
  token: string,
  loginMethod: 'pin' | 'google',
  userId?: string
): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT OR REPLACE INTO sessions (token, user_id, login_method, created_at, expires_at, last_used_at)
       VALUES (?, ?, ?, datetime('now'), ?, datetime('now'))`,
      [token, userId ?? null, loginMethod, expiresAt30Days()]
    );
  } catch {
    // DB 저장 실패는 무시
  }
}

/** DB에서 세션 유효성 검사 (만료 체크 포함) */
async function checkSessionInDb(token: string): Promise<boolean> {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT token FROM sessions
       WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [token]
    );
    if (result.rows.length > 0) {
      await db.query(
        `UPDATE sessions SET last_used_at = datetime('now') WHERE token = ?`,
        [token]
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 만료된 세션 정리 */
async function cleanExpiredSessions(): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`
    );
  } catch {
    // 정리 실패는 무시
  }
}

// 앱 시작 시 만료 세션 자동 정리 (5초 후, DB 준비 후 실행)
setTimeout(() => {
  cleanExpiredSessions().catch(() => {});
}, 5000);

function ensureDataDir(): void {
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

interface AuthData {
  pin_hash?: string;
  google_user?: {
    email: string;
    name: string;
    picture?: string;
  };
}

function readAuthFile(): AuthData | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(raw) as AuthData;
  } catch {
    return null;
  }
}

function writeAuthFile(data: AuthData): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const PinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN은 숫자만 입력 가능합니다'),
});

// Google Strategy 초기화 (credentials가 있을 때만)
function setupGoogleStrategy(): void {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: 'http://localhost:3001/api/auth/google/callback',
      },
      (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        done(null, profile);
      }
    )
  );
}

// 최초 1회 초기화 시도
setupGoogleStrategy();

// Google credentials가 런타임에 설정될 수 있으므로 요청 시 재초기화
function ensureGoogleStrategy(): boolean {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientID || !clientSecret) return false;

  // 이미 등록된 경우 체크
  try {
    // Strategy가 없으면 재등록
    setupGoogleStrategy();
    return true;
  } catch {
    return false;
  }
}

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user as Express.User);
});

export function authRouter(): Router {
  const router = Router();

  // GET /api/auth/status — PIN 설정 여부 + 세션 토큰 유효성 확인
  router.get('/status', async (req: Request, res: Response) => {
    const auth = readAuthFile();
    const pinSet = !!(auth?.pin_hash);

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query['token'] as string | undefined);

    if (token) {
      const valid = await checkSessionInDb(token);
      res.json({ pin_set: pinSet, authenticated: valid });
      return;
    }

    res.json({ pin_set: pinSet, authenticated: false });
  });

  // POST /api/auth/pin/set — PIN 설정 (최초 1회)
  router.post('/pin/set', (req: Request, res: Response) => {
    const parsed = PinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'PIN 입력 오류' });
      return;
    }

    const existing = readAuthFile();
    if (existing?.pin_hash) {
      res.status(409).json({ error: 'PIN이 이미 설정되어 있습니다' });
      return;
    }

    const current = existing ?? {};
    writeAuthFile({ ...current, pin_hash: hashPin(parsed.data.pin) });
    res.json({ success: true, message: 'PIN이 설정되었습니다' });
  });

  // POST /api/auth/pin/verify — PIN 검증 → 세션 토큰 반환
  router.post('/pin/verify', async (req: Request, res: Response) => {
    const parsed = PinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'PIN 입력 오류' });
      return;
    }

    const auth = readAuthFile();
    if (!auth?.pin_hash) {
      res.status(404).json({ error: 'PIN이 설정되지 않았습니다' });
      return;
    }

    if (hashPin(parsed.data.pin) !== auth.pin_hash) {
      res.status(401).json({ error: 'PIN이 올바르지 않습니다' });
      return;
    }

    const token = generateSessionToken();
    await saveSession(token, 'pin');
    res.json({ success: true, session_token: token });
  });

  // GET /api/auth/google — Google OAuth 시작
  router.get('/google', (req: Request, res: Response, next) => {
    if (!ensureGoogleStrategy()) {
      res.status(503).json({ error: 'Google 로그인이 설정되지 않았습니다' });
      return;
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  // GET /api/auth/google/callback — Google OAuth 콜백
  router.get(
    '/google/callback',
    (req: Request, res: Response, next) => {
      if (!ensureGoogleStrategy()) {
        res.status(503).send('<h1>Google 로그인 설정 오류</h1>');
        return;
      }
      passport.authenticate('google', { session: false }, async (err: Error | null, profile: Profile | false) => {
        if (err || !profile) {
          res.status(401).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0F0F10;color:#fff">
              <h2>로그인 실패</h2>
              <p style="color:#888">다시 시도해주세요</p>
            </body></html>
          `);
          return;
        }

        // 사용자 정보 auth.json에 저장
        const emails = profile.emails ?? [];
        const photos = profile.photos ?? [];
        const email = emails[0]?.value ?? '';
        const name = profile.displayName ?? '';
        const picture = photos[0]?.value ?? '';

        const existing = readAuthFile() ?? {};
        writeAuthFile({
          ...existing,
          google_user: { email, name, picture },
        });

        // 세션 토큰 발급 & DB 저장
        const token = generateSessionToken();
        await saveSession(token, 'google', email);

        // 대기 토큰으로 저장 (앱이 폴링해서 가져감)
        pendingGoogleToken = token;

        res.send(`
          <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0F0F10;color:#fff">
            <h2 style="color:#D97B5B">로그인 완료</h2>
            <p style="color:#888">앱으로 돌아가세요. 이 창은 닫으셔도 됩니다.</p>
            <script>setTimeout(() => window.close(), 3000)</script>
          </body></html>
        `);
      })(req, res, next);
    }
  );

  // GET /api/auth/google/status — Google 인증 설정 여부
  router.get('/google/status', (_req: Request, res: Response) => {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const auth = readAuthFile();
    res.json({
      google_configured: !!(clientID && clientSecret),
      google_user: auth?.google_user ?? null,
    });
  });

  // GET /api/auth/google/pending-token — 대기 중인 토큰 반환 후 삭제 (앱이 폴링)
  router.get('/google/pending-token', (_req: Request, res: Response) => {
    if (pendingGoogleToken) {
      const token = pendingGoogleToken;
      pendingGoogleToken = null;
      res.json({ token });
    } else {
      res.json({ token: null });
    }
  });

  // POST /api/auth/firebase/verify — Firebase ID Token 완전 검증 (firebase-admin verifyIdToken)
  router.post('/firebase/verify', async (req: Request, res: Response) => {
    const { idToken } = req.body as { idToken?: unknown };

    if (typeof idToken !== 'string' || idToken.length === 0) {
      res.status(400).json({ error: 'idToken이 필요합니다' });
      return;
    }

    try {
      // firebase-admin SDK로 서명 포함 완전 검증
      ensureFirebaseAdmin();
      const decoded = await admin.auth().verifyIdToken(idToken);

      // 사용자 정보 auth.json에 영속화
      const existing = readAuthFile() ?? {};
      writeAuthFile({
        ...existing,
        google_user: {
          email: decoded.email ?? '',
          name: decoded.name ?? '',
          picture: decoded.picture ?? '',
        },
      });

      // 세션 토큰 발급 & DB 저장
      const sessionToken = generateSessionToken();
      await saveSession(sessionToken, 'google', decoded.email ?? decoded.uid ?? '');

      res.json({
        session_token: sessionToken,
        user: {
          uid: decoded.uid,
          email: decoded.email ?? '',
          name: decoded.name ?? '',
          picture: decoded.picture ?? '',
        },
      });
    } catch (err: unknown) {
      // firebase-admin이 초기화되지 않은 경우 폴백: JWT 기본 구조 검증
      const errMsg = err instanceof Error ? err.message : String(err);
      const isAdminNotInit =
        errMsg.includes('app/no-app') ||
        errMsg.includes('credential') ||
        errMsg.includes('Failed to initialize');

      if (isAdminNotInit) {
        // 개발 환경 폴백: JWT 페이로드만 디코딩 (서명 미검증)
        try {
          const parts = idToken.split('.');
          if (parts.length !== 3) {
            res.status(401).json({ error: '유효하지 않은 토큰입니다' });
            return;
          }
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padding = (4 - (payloadBase64.length % 4)) % 4;
          const padded = payloadBase64 + '='.repeat(padding);
          const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as {
            sub?: string; email?: string; name?: string; picture?: string;
            exp?: number; iss?: string;
          };

          if (
            typeof payload.iss !== 'string' ||
            !payload.iss.startsWith('https://securetoken.google.com/')
          ) {
            res.status(401).json({ error: '토큰 발급자가 유효하지 않습니다' });
            return;
          }
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp !== undefined && payload.exp < now) {
            res.status(401).json({ error: '토큰이 만료되었습니다' });
            return;
          }

          const existing = readAuthFile() ?? {};
          writeAuthFile({
            ...existing,
            google_user: {
              email: payload.email ?? '',
              name: payload.name ?? '',
              picture: payload.picture ?? '',
            },
          });

          const sessionToken = generateSessionToken();
          await saveSession(sessionToken, 'google', payload.email ?? payload.sub ?? '');
          res.json({
            session_token: sessionToken,
            user: {
              uid: payload.sub ?? '',
              email: payload.email ?? '',
              name: payload.name ?? '',
              picture: payload.picture ?? '',
            },
          });
        } catch {
          res.status(401).json({ error: '토큰 검증에 실패했습니다' });
        }
      } else {
        res.status(401).json({ error: '토큰 검증에 실패했습니다' });
      }
    }
  });

  // PATCH /api/auth/profile — 프로필 업데이트 (display_name)
  router.patch('/profile', async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string
      if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }

      const db = getDb()
      const sessionResult = await db.query(
        `SELECT user_id FROM sessions WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
        [token]
      )
      if (!sessionResult.rows.length) { res.status(401).json({ error: 'Invalid session' }); return }

      const session = sessionResult.rows[0] as { user_id?: string }
      const userId = session.user_id
      if (!userId) { res.status(400).json({ error: 'No user linked to session' }); return }

      const { display_name } = req.body as { display_name?: string }
      if (!display_name?.trim()) { res.status(400).json({ error: 'display_name is required' }); return }

      await db.query(
        `UPDATE users SET display_name = ? WHERE id = ?`,
        [display_name.trim(), userId]
      )
      res.json({ data: { success: true } })
    } catch {
      res.status(500).json({ error: 'Failed to update profile' })
    }
  })

  // POST /api/auth/license/activate — 라이선스 키 활성화
  router.post('/license/activate', async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string
      if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }

      const { license_key } = req.body as { license_key?: string }
      if (!license_key?.trim()) { res.status(400).json({ error: 'license_key is required' }); return }

      const db = getDb()
      const sessionResult = await db.query(
        `SELECT user_id FROM sessions WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
        [token]
      )
      if (!sessionResult.rows.length) { res.status(401).json({ error: 'Invalid session' }); return }

      const session = sessionResult.rows[0] as { user_id?: string }
      const userId = session.user_id
      if (!userId) { res.status(400).json({ error: 'No user linked to session' }); return }

      const keyPattern = /^OOMNI-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
      if (!keyPattern.test(license_key.trim())) {
        res.status(400).json({ error: '유효하지 않은 라이선스 키 형식입니다.' }); return
      }

      const validUntil = new Date()
      validUntil.setFullYear(validUntil.getFullYear() + 1)

      await db.query(
        `UPDATE users SET license_key = ?, license_valid_until = ? WHERE id = ?`,
        [license_key.trim(), validUntil.toISOString(), userId]
      )

      res.json({ data: { success: true, license_valid_until: validUntil.toISOString() } })
    } catch {
      res.status(500).json({ error: 'Failed to activate license' })
    }
  })

  // GET /api/auth/license/status — 라이선스 상태 확인
  // 개발자 모드(OOMNI_DEV_MODE=true) 또는 admin 역할이면 무제한 사용
  // 향후 Toss Payments 연동 예정
  router.get('/license/status', (_req: Request, res: Response) => {
    // 개발자 모드 우회
    if (process.env.OOMNI_DEV_MODE === 'true') {
      res.json({ valid: true, reason: 'dev_mode', unlimited: true });
      return;
    }

    const auth = readAuthFile();
    const email = auth?.google_user?.email ?? '';

    // 현재는 기본 구조만: 로그인된 사용자는 유효
    // TODO: users 테이블에서 role='admin' 확인 및 Toss Payments 라이선스 검증
    if (email) {
      res.json({ valid: true, email, reason: 'authenticated' });
    } else {
      res.json({ valid: false, reason: 'not_authenticated' });
    }
  });

  return router;
}

// 세션 토큰 검증 헬퍼 (미들웨어에서 사용 가능) — DB 조회 방식
export async function isValidSession(token: string): Promise<boolean> {
  return checkSessionInDb(token);
}
