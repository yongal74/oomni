/**
 * executionRouter.ts — 태스크 엔진 라우터
 * v5.0.1
 *
 * - checkout_lock으로 중복 실행 방지 (Paperclip 패턴)
 * - 엔진별 서비스로 라우팅
 * - 실행 결과를 task_results에 저장
 * - 태스크 상태 자동 업데이트
 */
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
type Task = Record<string, unknown>;

export async function executionRouter(
  db: DbClient,
  task: Task,
  modelOverride?: string,
): Promise<void> {
  const taskId = task.id as string;
  const engine = task.engine as string;
  const startedAt = new Date().toISOString();
  const resultId = uuidv4();

  try {
    let output = '';
    let model = modelOverride ?? getDefaultModel(engine);
    let filePaths: string[] = [];

    logger.info(`[executionRouter] START task=${taskId} engine=${engine} model=${model}`);

    switch (engine) {
      case 'claude_design': {
        const { executeDesign } = await import('./designService');
        const result = await executeDesign(db, task);
        output = result.html;
        filePaths = result.filePaths;
        model = 'claude-opus-4-7';
        break;
      }

      case 'codex': {
        const { executeCodex } = await import('./codexService');
        output = await executeCodex(db, task, modelOverride);
        model = modelOverride ?? 'o3';
        break;
      }

      case 'research': {
        // Research는 기존 researchExecutor 재활용 (agent 컨텍스트 필요)
        output = '리서치는 Research Hub에서 에이전트를 통해 실행됩니다.';
        break;
      }

      case 'growth': {
        const { executeGrowthForTask } = await import('./growthService');
        output = await executeGrowthForTask(db, task);
        break;
      }

      case 'ops': {
        output = 'Ops는 Ops Center에서 에이전트를 통해 실행됩니다.';
        break;
      }

      case 'chat':
      case 'claude_code':
      default: {
        // Claude Code는 PTY 터미널 방식 — 결과는 별도 WebSocket 스트림
        // 여기서는 상태만 업데이트 (실제 실행은 PtyBotPage에서 처리)
        output = 'Claude Code PTY 터미널에서 실행됩니다.';
        break;
      }
    }

    // 완료 처리
    await db.query(
      `INSERT INTO task_results (id, task_id, engine, model, status, output, file_paths, started_at, completed_at)
       VALUES ($1,$2,$3,$4,'success',$5,$6,$7,$8)`,
      [resultId, taskId, engine, model, output,
       JSON.stringify(filePaths), startedAt, new Date().toISOString()],
    );

    await db.query(
      "UPDATE tasks SET status = 'done', checkout_lock = NULL, updated_at = datetime('now') WHERE id = $1",
      [taskId],
    );

    logger.info(`[executionRouter] DONE task=${taskId}`);
  } catch (err) {
    logger.error(`[executionRouter] FAIL task=${taskId}`, err);

    // 실패 기록
    await db.query(
      `INSERT INTO task_results (id, task_id, engine, model, status, output, started_at, completed_at)
       VALUES ($1,$2,$3,$4,'failed',$5,$6,$7)`,
      [resultId, taskId, engine, modelOverride ?? getDefaultModel(engine),
       String(err), startedAt, new Date().toISOString()],
    ).catch(() => {});

    // lock 해제 + todo로 복구
    await db.query(
      "UPDATE tasks SET status = 'todo', checkout_lock = NULL, updated_at = datetime('now') WHERE id = $1",
      [taskId],
    ).catch(() => {});
  }
}

function getDefaultModel(engine: string): string {
  switch (engine) {
    case 'claude_design': return 'claude-opus-4-7';
    case 'codex':         return 'o3';
    case 'research':      return 'claude-haiku-4-5-20251001';
    default:              return 'claude-sonnet-4-6';
  }
}
