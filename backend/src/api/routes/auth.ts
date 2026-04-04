/**
 * auth.ts — 로컬 PIN 인증 라우트
 * POST /api/auth/pin/set    — PIN 설정 (처음 한 번)
 * POST /api/auth/pin/verify — PIN 검증 → 세션 토큰 반환
 * GET  /api/auth/status     — PIN 설정 여부 확인
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const AUTH_FILE = path.join('C:/oomni-data', 'auth.json');

// 메모리 세션 토큰 Set (재시작 시 초기화 → 재로그인 필요)
const activeSessions = new Set<string>();

function ensureDataDir(): void {
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function readAuthFile(): { pin_hash: string } | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(raw) as { pin_hash: string };
  } catch {
    return null;
  }
}

function writeAuthFile(data: { pin_hash: string }): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const PinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN은 숫자만 입력 가능합니다'),
});

export function authRouter(): Router {
  const router = Router();

  // GET /api/auth/status — PIN 설정 여부 확인
  router.get('/status', (_req: Request, res: Response) => {
    const auth = readAuthFile();
    res.json({ pin_set: auth !== null });
  });

  // POST /api/auth/pin/set — PIN 설정 (최초 1회)
  router.post('/pin/set', (req: Request, res: Response) => {
    const parsed = PinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'PIN 입력 오류' });
      return;
    }

    const existing = readAuthFile();
    if (existing !== null) {
      res.status(409).json({ error: 'PIN이 이미 설정되어 있습니다' });
      return;
    }

    writeAuthFile({ pin_hash: hashPin(parsed.data.pin) });
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
    if (auth === null) {
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

  return router;
}

// 세션 토큰 검증 헬퍼 (미들웨어에서 사용 가능)
export function isValidSession(token: string): boolean {
  return activeSessions.has(token);
}
