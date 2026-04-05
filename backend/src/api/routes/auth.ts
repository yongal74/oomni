/**
 * auth.ts — 로컬 PIN 인증 + Google OAuth 라우트
 * POST /api/auth/pin/set            — PIN 설정 (처음 한 번)
 * POST /api/auth/pin/verify         — PIN 검증 → 세션 토큰 반환
 * GET  /api/auth/status             — PIN 설정 여부 확인
 * GET  /api/auth/google             — Google OAuth 시작
 * GET  /api/auth/google/callback    — Google OAuth 콜백
 * GET  /api/auth/google/status      — Google 인증 세션 상태
 * GET  /api/auth/google/pending-token — 대기 중인 토큰 반환 후 삭제
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';

const AUTH_FILE = path.join('C:/oomni-data', 'auth.json');

// 메모리 세션 토큰 Set (재시작 시 초기화 → 재로그인 필요)
const activeSessions = new Set<string>();

// Google OAuth 대기 중인 토큰 (앱이 폴링해서 가져감)
let pendingGoogleToken: string | null = null;

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

  // GET /api/auth/status — PIN 설정 여부 확인
  router.get('/status', (_req: Request, res: Response) => {
    const auth = readAuthFile();
    res.json({ pin_set: !!(auth?.pin_hash) });
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
  router.post('/pin/verify', (req: Request, res: Response) => {
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
    activeSessions.add(token);
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
      passport.authenticate('google', { session: false }, (err: Error | null, profile: Profile | false) => {
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

        // 세션 토큰 발급
        const token = generateSessionToken();
        activeSessions.add(token);

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

  return router;
}

// 세션 토큰 검증 헬퍼 (미들웨어에서 사용 가능)
export function isValidSession(token: string): boolean {
  return activeSessions.has(token);
}
