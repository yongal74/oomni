/**
 * requireAuth.ts — Firebase JWT 완전 검증 미들웨어
 *
 * 사용법:
 *   router.get('/protected', requireAuth(), handler)
 *   router.delete('/admin-only', requireAuth({ role: 'admin' }), handler)
 *
 * 인증 흐름:
 *   1. Authorization: Bearer <token> 헤더 추출
 *   2. 내부 API 키면 통과 (기존 호환성)
 *   3. Firebase ID Token이면 firebase-admin으로 완전 검증
 *   4. 세션 토큰이면 DB 세션 테이블에서 검증
 *   5. role 옵션이 있으면 users 테이블에서 역할 확인
 */
import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import admin from 'firebase-admin';
import * as fs from 'fs';
import { getDb } from '../db/client.js';
import { ApiError } from './apiError.js';
import { logger } from '../logger.js';

// ── Firebase Admin 초기화 (싱글턴) ─────────────────────────────────
let _firebaseInitialized = false;

function ensureFirebaseAdmin(): boolean {
  if (_firebaseInitialized) return true;
  if (admin.apps.length > 0) {
    _firebaseInitialized = true;
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
      admin.initializeApp();
    }
    _firebaseInitialized = true;
    return true;
  } catch (err) {
    logger.warn('[requireAuth] Firebase Admin 초기화 실패:', err);
    return false;
  }
}

// ── 토큰 타입 판별 ────────────────────────────────────────────────

/** Firebase ID Token 여부: JWT 3-파트 구조 + iss 확인 */
function looksLikeFirebaseToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payloadBase64 = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (payloadBase64.length % 4)) % 4;
    const payload = JSON.parse(
      Buffer.from(payloadBase64 + '='.repeat(padding), 'base64').toString('utf-8')
    ) as { iss?: string };
    return typeof payload.iss === 'string' &&
      payload.iss.startsWith('https://securetoken.google.com/');
  } catch {
    return false;
  }
}

// ── Firebase ID Token 검증 ────────────────────────────────────────

interface FirebaseVerifyResult {
  uid: string;
  email: string;
  name: string;
}

async function verifyFirebaseToken(idToken: string): Promise<FirebaseVerifyResult> {
  if (!ensureFirebaseAdmin()) {
    throw new ApiError(503, 'Firebase Admin 초기화에 실패했습니다. 서버 설정을 확인하세요.', 'FIREBASE_UNAVAILABLE');
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken, /* checkRevoked= */ true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: (decoded.name as string | undefined) ?? '',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('auth/id-token-expired') || msg.includes('TOKEN_EXPIRED')) {
      throw new ApiError(401, '토큰이 만료되었습니다', 'TOKEN_EXPIRED');
    }
    if (msg.includes('auth/id-token-revoked')) {
      throw new ApiError(401, '토큰이 폐기되었습니다', 'TOKEN_REVOKED');
    }
    throw new ApiError(401, '토큰 검증에 실패했습니다', 'INVALID_TOKEN');
  }
}

// ── 세션 토큰 검증 ────────────────────────────────────────────────

interface SessionRow {
  user_id?: string;
  login_method?: string;
}

async function verifySessionToken(token: string): Promise<SessionRow | null> {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT user_id, login_method FROM sessions
       WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [token]
    );
    if (result.rows.length === 0) return null;
    // last_used_at 갱신
    await db.query(`UPDATE sessions SET last_used_at = datetime('now') WHERE token = ?`, [token]);
    return result.rows[0] as SessionRow;
  } catch {
    return null;
  }
}

// ── 역할 조회 ─────────────────────────────────────────────────────

async function getUserRole(userId: string): Promise<string | null> {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT role FROM users WHERE id = ?`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    return (result.rows[0] as { role: string }).role;
  } catch {
    return null;
  }
}

// ── 미들웨어 옵션 ─────────────────────────────────────────────────

export interface RequireAuthOptions {
  /** 'admin' 등 특정 역할이 필요한 경우 지정 */
  role?: string;
  /** true면 DB가 없어도 Firebase 토큰만으로 통과 허용 */
  firebaseOnly?: boolean;
}

// Express Request에 인증 정보 주입
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        uid: string;
        email: string;
        name: string;
        role?: string;
        loginMethod: 'firebase' | 'session' | 'apikey';
      };
    }
  }
}

/**
 * requireAuth 미들웨어 팩토리
 *
 * @param options.role — 'admin' 등 필요 역할 (없으면 인증만 확인)
 * @param options.firebaseOnly — Firebase 토큰 전용 (세션 토큰 불허)
 */
export function requireAuth(options: RequireAuthOptions = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError(401, '인증이 필요합니다', 'AUTH_REQUIRED');
      }

      const token = authHeader.slice(7);
      if (!token) {
        throw new ApiError(401, '토큰이 비어있습니다', 'EMPTY_TOKEN');
      }

      let uid = '';
      let email = '';
      let name = '';
      let loginMethod: 'firebase' | 'session' | 'apikey' = 'session';
      let userId: string | undefined;

      if (looksLikeFirebaseToken(token)) {
        // ── Firebase ID Token 경로 ──────────────────────────────
        const result = await verifyFirebaseToken(token);
        uid = result.uid;
        email = result.email;
        name = result.name;
        loginMethod = 'firebase';
        userId = uid;
      } else if (!options.firebaseOnly) {
        // ── 세션 토큰 경로 ─────────────────────────────────────
        const session = await verifySessionToken(token);
        if (!session) {
          throw new ApiError(401, '세션이 만료되었거나 유효하지 않습니다', 'SESSION_INVALID');
        }
        uid = session.user_id ?? '';
        email = uid; // 세션의 user_id는 email로 저장됨
        loginMethod = 'session';
        userId = uid;
      } else {
        throw new ApiError(401, 'Firebase 토큰이 필요합니다', 'FIREBASE_TOKEN_REQUIRED');
      }

      // ── 역할 기반 접근 제어 ─────────────────────────────────
      let userRole: string | undefined;
      if (userId && userId.length > 0) {
        const roleFromDb = await getUserRole(userId);
        userRole = roleFromDb ?? undefined;
      }

      if (options.role) {
        if (!userRole || userRole !== options.role) {
          throw new ApiError(403, '권한이 없습니다', 'FORBIDDEN');
        }
      }

      // Request에 인증 정보 주입
      req.auth = { uid, email, name, role: userRole, loginMethod };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * requireAdmin — admin 역할 전용 미들웨어 (편의 래퍼)
 */
export function requireAdmin(): RequestHandler {
  return requireAuth({ role: 'admin' });
}
