/**
 * OOMNI Backend 서버 진입점
 */
import http from 'http';
import { loadConfig, loadSettings } from './config';
import { initDb, shutdownDb } from './db/client';
import { initVault } from './crypto/vault';
import { createApp } from './api/app';
import { OomniWebSocketServer } from './ws/server';
import { HeartbeatScheduler } from './agents/heartbeat';
import { AgentRunner } from './agents/runner';
import { EventEmitter } from 'events';
import { logger } from './logger';

async function main() {
  // settings.json에서 API 키 로드 (loadConfig 전에 실행)
  loadSettings();
  const config = loadConfig();

  // 1. Vault 초기화
  initVault(config.OOMNI_MASTER_KEY);

  // 2. DB 초기화 (SQLite — 동기)
  const db = initDb();

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
  process.exit(1);
});
