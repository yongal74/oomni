/**
 * Express App 팩토리
 * 보안: helmet, CORS, rate-limit, input validation (zod)
 */
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { ApiError } from '../middleware/apiError';
import { agentsRouter } from './routes/agents';
import { feedRouter } from './routes/feed';
import { integrationsRouter } from './routes/integrations';
import { costRouter } from './routes/cost';
import { missionsRouter } from './routes/missions';
import { issuesRouter } from './routes/issues';
import { schedulesRouter } from './routes/schedules';
import { webhooksRouter } from './routes/webhooks';
import { reportsRouter } from './routes/reports';
import { researchRouter } from './routes/research';
import { authRouter } from './routes/auth';
import { settingsRouter } from './routes/settings';
import { ceoRouter } from './routes/ceo';
import { templatesRouter } from './routes/templates';
import { obsidianRouter } from './routes/obsidian';
import { backupRouter } from './routes/backup';
import { designSystemsRouter } from './routes/design-systems';
import { logger } from '../logger';

interface AppOptions {
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  apiKey: string;
  triggerAgent?: (agentId: string, task?: string) => Promise<{ skipped: boolean }>;
}

export function createApp(options: AppOptions): Application {
  const app = express();

  // ── 보안 헤더 (helmet) ──────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws://localhost:*'],
      },
    },
  }));

  // ── CORS — Electron renderer만 허용 ──────────────────────
  app.use(cors({
    origin: (origin, callback) => {
      // Electron renderer (file://) 또는 localhost dev 허용
      if (!origin || origin.startsWith('file://') || /^https?:\/\/localhost/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS 정책 위반'));
      }
    },
    credentials: true,
  }));

  // ── Rate Limiting ────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1분
    max: 120,             // 분당 120 요청
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
  });

  // Agent trigger는 별도 제한 (비용 보호)
  const triggerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: '봇 트리거 요청이 너무 많습니다.' },
  });

  app.use(limiter);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── express-session (Google OAuth 콜백용) ────────────────
  app.use(session({
    secret: process.env.OOMNI_MASTER_KEY ?? 'oomni-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 5 * 60 * 1000 }, // 5분 (OAuth 플로우용)
  }));

  // ── 설정 라우터 (인증 없이 접근 가능, 온보딩용) ──────────
  app.use('/api/settings', settingsRouter());

  // ── 인증 라우터 (Bearer 인증 제외) ──────────────────────
  app.use('/api/auth', authRouter());

  // ── 웹훅 라우터 (/api 인증 밖) ───────────────────────────
  const triggerFn = options.triggerAgent ?? (async (_agentId: string, _task?: string) => ({ skipped: true }));
  app.use('/webhooks', webhooksRouter({
    db: options.db,
    apiKey: options.apiKey,
    triggerAgent: triggerFn,
  }));

  // ── 내부 API 키 인증 ─────────────────────────────────────
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${options.apiKey}`) {
      next();
      return;
    }
    // 헬스체크, auth, settings 경로는 인증 제외
    // SSE 스트림 엔드포인트: EventSource는 헤더 설정 불가 → agents 라우터에서 ?token= 검증
    const isPublicPath =
      req.path === '/health' ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/settings') ||
      /^\/agents\/[^/]+\/stream/.test(req.path) ||
      /^\/agents\/[^/]+\/chat$/.test(req.path);

    if (isPublicPath) {
      next();
      return;
    }
    res.status(401).json({ error: '인증이 필요합니다' });
  });

  // ── 라우터 ───────────────────────────────────────────────
  app.use('/api/missions', missionsRouter(options.db));
  app.use('/api/agents', agentsRouter(options.db));
  app.use('/api/agents', triggerLimiter);
  app.use('/api/feed', feedRouter(options.db));
  app.use('/api/integrations', integrationsRouter(options.db));
  app.use('/api/cost', costRouter(options.db));
  app.use('/api/issues', issuesRouter(options.db));
  app.use('/api/schedules', schedulesRouter(options.db));
  app.use('/api/reports', reportsRouter(options.db));
  app.use('/api/research', researchRouter(options.db));
  app.use('/api/ceo', ceoRouter(options.db));
  app.use('/api/templates', templatesRouter(options.db));
  app.use('/api/obsidian', obsidianRouter());
  app.use('/api/backup', backupRouter());
  app.use('/api/design-systems', designSystemsRouter(options.db));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── 전역 에러 핸들러 ──────────────────────────────────────
  // ApiError: 정의된 HTTP 상태코드 + 코드 반환
  // 그 외 Error: 500 반환 (개발 환경에서만 메시지 노출)
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      // 4xx는 warn, 5xx는 error 레벨 로깅
      if (err.statusCode >= 500) {
        logger.error(`[API ${err.statusCode}] ${req.method} ${req.path} — ${err.code}: ${err.message}`, err);
      } else {
        logger.warn(`[API ${err.statusCode}] ${req.method} ${req.path} — ${err.code}: ${err.message}`);
      }
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }

    const isDev = process.env.NODE_ENV !== 'production';
    logger.error(`[Error 500] ${req.method} ${req.path}`, err);
    res.status(500).json({
      error: isDev ? err.message : '서버 오류가 발생했습니다',
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}
