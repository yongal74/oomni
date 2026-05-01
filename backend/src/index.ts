/**
 * OOMNI Backend 서버 진입점
 */
import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, loadSettings } from './config';
import { initDb, shutdownDb } from './db/client';
import { attachPtyWebSocket } from './services/ptyService';
import { initVault } from './crypto/vault';
import { createApp } from './api/app';
import { OomniWebSocketServer } from './ws/server';
import { HeartbeatScheduler } from './agents/heartbeat';
import { AgentRunner } from './agents/runner';
import { EventEmitter } from 'events';
import { logger } from './logger';
import { initSkills, WORKSPACE_ROOT, SKILLS_DEST } from './services/claudeCodeService';
import { seedResearchSources } from './db/seedResearchSources';
const WORKSPACE_BASE = WORKSPACE_ROOT;
const SKILLS_BASE = SKILLS_DEST;

/**
 * Initialize OOMNI data directories on startup.
 * Creates C:/oomni-data/workspaces/ and C:/oomni-data/.claude/commands/
 * if they do not already exist.
 */
function initWorkspaceDirectories(): void {
  const dirs = [
    WORKSPACE_BASE,
    SKILLS_BASE,
    // Role-specific skill command directories
    path.join(SKILLS_BASE, 'research'),
    path.join(SKILLS_BASE, 'build'),
    path.join(SKILLS_BASE, 'design'),
    path.join(SKILLS_BASE, 'content'),
    path.join(SKILLS_BASE, 'growth'),
    path.join(SKILLS_BASE, 'ops'),
    path.join(SKILLS_BASE, 'ceo'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`[Init] 디렉토리 생성: ${dir}`);
    }
  }

  // Copy bundled skills from app resources if running in Electron
  const resourcesDir = process.env.RESOURCES_PATH;
  if (resourcesDir) {
    const srcSkills = path.join(resourcesDir, 'skills');
    if (fs.existsSync(srcSkills)) {
      copyDirIfNotExists(srcSkills, SKILLS_BASE);
      logger.info(`[Init] 스킬 복사 완료: ${srcSkills} → ${SKILLS_BASE}`);
    }
  }
}

function copyDirIfNotExists(src: string, dest: string): void {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirIfNotExists(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  // settings.json에서 API 키 로드 (loadConfig 전에 실행)
  loadSettings();
  const config = loadConfig();

  // 워크스페이스 및 스킬 디렉토리 초기화
  initWorkspaceDirectories();
  initSkills(); // skills/ → C:/oomni-data/.claude/commands/ 복사

  // 1. Vault 초기화
  initVault(config.OOMNI_MASTER_KEY);

  // 2. DB 초기화 (SQLite — 동기)
  const db = initDb();
  seedResearchSources(); // 최초 실행 시 기본 소스 시드

  // 3. Agent Runner + Heartbeat 스케줄러 (app보다 먼저 생성해야 triggerAgent 주입 가능)
  const emitter = new EventEmitter();
  const runner = new AgentRunner(emitter, {
    oomniApiUrl: `http://localhost:${config.PORT}`,
    oomniApiKey: config.OOMNI_INTERNAL_API_KEY,
  });
  const scheduler = new HeartbeatScheduler(db, runner);

  // triggerAgent 함수: webhooks 라우터에 주입
  const triggerAgent = async (agentId: string, task?: string) => {
    return scheduler.triggerNow(agentId, task);
  };

  // 4. Express 앱 생성
  const app = createApp({ db, apiKey: config.OOMNI_INTERNAL_API_KEY, triggerAgent });

  // 5. HTTP 서버
  const server = http.createServer(app);

  // 6. WebSocket 서버
  const wss = new OomniWebSocketServer(server);

  // 6a. PTY WebSocket 연결 (Build Bot 터미널)
  attachPtyWebSocket(server);

  // Runner 스트림 이벤트 → WS 브로드캐스트
  runner.on('stream', (data: { agentId: string; chunk: string }) => {
    wss.broadcastAgentStatus(data.agentId, 'running');
  });

  // 7. 기존 활성 봇 스케줄 복원
  const agents = await db.query(
    "SELECT * FROM agents WHERE is_active = 1 AND schedule != 'manual'"
  );
  for (const agent of agents.rows as import('./db/types').Agent[]) {
    scheduler.schedule(agent);
  }
  logger.info(`[Main] ${agents.rows.length}개 봇 스케줄 복원 완료`);

  // 8. 서버 시작
  // EADDRINUSE: uncaughtException으로 올라가지 않도록 server.on('error') 필수
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(
        `[Main] 포트 ${config.PORT} 이미 사용 중 — 다른 OOMNI 인스턴스가 실행 중입니다. ` +
        '앱을 완전히 종료 후 재시작하세요.'
      );
      // 프로세스를 죽이지 않음: Electron이 uncaughtException 다이얼로그를 띄우는 것을 방지
    } else {
      throw err;
    }
  });
  server.listen(config.PORT, () => {
    logger.info(`[Main] OOMNI 서버 시작: http://localhost:${config.PORT}`);
    logger.info(`[Main] WebSocket: ws://localhost:${config.PORT}/ws`);
    logger.info(`[Main] 환경: ${config.NODE_ENV}`);
    logger.info(`[Main] AI Provider: ${config.AI_PROVIDER}`);
  });

  // 9. 안전한 종료 처리
  const shutdown = async (signal: string) => {
    logger.info(`[Main] ${signal} 수신 — 종료 중...`);
    scheduler.stopAll();
    runner.killAll();
    server.close(async () => {
      await shutdownDb();
      logger.info('[Main] 정상 종료 완료');
      process.exit(0);
    });
    // 10초 후 강제 종료
    setTimeout(() => {
      logger.error('[Main] 강제 종료 (타임아웃)');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('[Main] 처리되지 않은 예외', err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('[Main] 처리되지 않은 Promise 거부', reason);
  });
}

main().catch((err) => {
  console.error('서버 시작 실패:', err);
  // Electron 인-프로세스 실행 시 process.exit() 금지 — Electron 앱 전체가 종료됨
  if (process.env.OOMNI_IN_PROCESS !== 'true') {
    process.exit(1);
  }
});
