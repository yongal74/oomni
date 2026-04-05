import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ClaudeCodeExecutor } from '../../services/claudeCodeExecutor';
import { ParallelExecutor, type ParallelResult } from '../../services/parallelExecutor';

const VALID_ROLES = ['research','build','design','content','growth','ops','integration','n8n','ceo'] as const;
const VALID_SCHEDULES = ['manual','hourly','daily','weekly'] as const;

const CreateAgentSchema = z.object({
  mission_id: z.string().min(1),
  name: z.string().min(1).max(100),
  role: z.enum(VALID_ROLES),
  schedule: z.enum(VALID_SCHEDULES).default('manual'),
  system_prompt: z.string().max(10000).default(''),
  budget_cents: z.number().int().min(0).max(100000).default(500),
  reports_to: z.string().nullable().optional(),
});

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export function agentsRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/agents
  router.get('/', async (req: Request, res: Response) => {
    const { mission_id } = req.query;
    let sql = 'SELECT * FROM agents ORDER BY created_at DESC';
    const params: unknown[] = [];

    if (mission_id) {
      sql = 'SELECT * FROM agents WHERE mission_id = $1 ORDER BY created_at DESC';
      params.push(mission_id);
    }

    const result = await db.query(sql, params);
    res.json({ data: result.rows });
  });

  // POST /api/agents
  router.post('/', async (req: Request, res: Response) => {
    const parsed = CreateAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
      return;
    }

    const { mission_id, name, role, schedule, system_prompt, budget_cents, reports_to } = parsed.data;
    const id = uuidv4();

    const result = await db.query(
      `INSERT INTO agents (id, mission_id, name, role, schedule, system_prompt, budget_cents, reports_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [id, mission_id, name, role, schedule, system_prompt, budget_cents, reports_to ?? null],
    );

    res.status(201).json({ data: (result.rows as unknown[])[0] });
  });

  // GET /api/agents/:id
  router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    if ((result.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }
    res.json({ data: (result.rows as unknown[])[0] });
  });

  // PATCH /api/agents/:id
  router.patch('/:id', async (req: Request, res: Response) => {
    const allowed = ['name', 'schedule', 'system_prompt', 'budget_cents', 'is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: '변경할 필드가 없습니다' });
      return;
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if ((result.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }
    res.json({ data: (result.rows as unknown[])[0] });
  });

  // POST /api/agents/:id/trigger — 봇 즉시 실행
  router.post('/:id/trigger', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    const rows = result.rows as Array<{ id: string; is_active: boolean; budget_cents: number }>;

    if (rows.length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }

    const agent = rows[0];
    if (!agent.is_active) {
      res.status(409).json({ error: '비활성 봇은 실행할 수 없습니다' });
      return;
    }

    const task: string | undefined = typeof req.body?.task === 'string' ? req.body.task : undefined;

    // Claude Code CLI 실행 시도
    const claudeAvailable = await ClaudeCodeExecutor.isAvailable();

    if (claudeAvailable && task) {
      // 시작 feed item 저장
      const startId = uuidv4();
      await db.query(
        `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [startId, agent.id, null, 'info', `🤖 Claude Code 실행 시작: ${task}`, null, null, false],
      );

      try {
        const executor = new ClaudeCodeExecutor();
        const execResult = await executor.execute(task);

        if (execResult.success) {
          // 성공 결과 저장
          const resultId = uuidv4();
          await db.query(
            `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [resultId, agent.id, null, 'result', execResult.output || '(출력 없음)', null, null, false],
          );

          res.status(200).json({
            success: true,
            output: execResult.output,
            exitCode: execResult.exitCode,
            method: 'claude_code',
            agentId: agent.id,
            task,
          });
        } else {
          // 비정상 종료 — error feed item
          const errId = uuidv4();
          await db.query(
            `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [errId, agent.id, null, 'error', `Claude Code 실행 실패 (exit ${execResult.exitCode}): ${execResult.output}`, null, null, false],
          );

          res.status(200).json({
            success: false,
            output: execResult.output,
            exitCode: execResult.exitCode,
            method: 'claude_code',
            agentId: agent.id,
            task,
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        // 예외 → error feed item
        const errId = uuidv4();
        await db.query(
          `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [errId, agent.id, null, 'error', `Claude Code 실행 중 오류: ${errMsg}`, null, null, false],
        );

        res.status(500).json({
          success: false,
          output: errMsg,
          method: 'claude_code',
          agentId: agent.id,
          task,
        });
      }
      return;
    }

    // Fallback: Claude CLI 없거나 task 없음 — mock 응답
    res.status(202).json({
      success: true,
      message: '봇 실행을 요청했습니다',
      output: task ? `(mock) task 수신: ${task}` : '(mock) 태스크 없음',
      method: 'mock',
      agentId: agent.id,
      task,
    });
  });

  // GET /api/agents/:id/stream — SSE: Claude Code 실시간 출력 스트리밍
  // Usage: GET /api/agents/:id/stream?task=<encoded_task>
  router.get('/:id/stream', async (req: Request, res: Response) => {
    const agentResult = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    const agentRows = agentResult.rows as Array<{ id: string; is_active: boolean }>;

    if (agentRows.length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }

    const agent = agentRows[0];
    if (!agent.is_active) {
      res.status(409).json({ error: '비활성 봇은 실행할 수 없습니다' });
      return;
    }

    const task: string | undefined =
      typeof req.query.task === 'string' && req.query.task.length > 0
        ? req.query.task
        : undefined;

    // SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const claudeAvailable = await ClaudeCodeExecutor.isAvailable();

    if (!claudeAvailable) {
      send('error', { message: 'claude CLI를 찾을 수 없습니다' });
      res.end();
      return;
    }

    if (!task) {
      send('error', { message: 'task 파라미터가 필요합니다 (?task=...)' });
      res.end();
      return;
    }

    // 시작 feed item
    const startId = uuidv4();
    await db.query(
      `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [startId, agent.id, null, 'info', `🤖 Claude Code 실행 시작: ${task}`, null, null, false],
    );

    send('start', { agentId: agent.id, task });

    const executor = new ClaudeCodeExecutor();

    executor.on('output', (chunk: string) => {
      send('output', { chunk });
    });

    executor.on('error', (err: Error) => {
      send('error', { message: err.message });
    });

    // Client disconnect → kill process
    req.on('close', () => {
      executor.kill();
    });

    try {
      const execResult = await executor.execute(task);

      // 결과 feed item 저장
      const feedType = execResult.success ? 'result' : 'error';
      const feedContent = execResult.success
        ? (execResult.output || '(출력 없음)')
        : `Claude Code 실행 실패 (exit ${execResult.exitCode}): ${execResult.output}`;

      const doneId = uuidv4();
      await db.query(
        `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [doneId, agent.id, null, feedType, feedContent, null, null, false],
      );

      send('done', {
        success: execResult.success,
        exitCode: execResult.exitCode,
        agentId: agent.id,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      const errId = uuidv4();
      await db.query(
        `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [errId, agent.id, null, 'error', `Claude Code 실행 중 오류: ${errMsg}`, null, null, false],
      );

      send('error', { message: errMsg });
    }

    res.end();
  });

  // DELETE /api/agents/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    await db.query('DELETE FROM agents WHERE id = $1', [req.params.id]);
    res.status(204).send();
  });

  // POST /api/agents/batch-trigger — 여러 봇 동시 실행
  router.post('/batch-trigger', async (req: Request, res: Response) => {
    const { agent_ids, task, mission_id } = req.body as {
      agent_ids?: unknown;
      task?: unknown;
      mission_id?: unknown;
    };

    if (!Array.isArray(agent_ids) || agent_ids.length === 0) {
      res.status(400).json({ error: 'agent_ids 배열이 필요합니다' });
      return;
    }

    const ids = agent_ids as string[];
    const taskStr: string = typeof task === 'string' && task.length > 0 ? task : '정기 작업 실행';

    // Fetch agents from DB
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const agentResult = await db.query(
      `SELECT id, name, is_active FROM agents WHERE id IN (${placeholders})`,
      ids,
    );
    const agentRows = agentResult.rows as Array<{ id: string; name: string; is_active: boolean }>;

    const foundIds = new Set(agentRows.map((a) => a.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      res.status(404).json({ error: `봇을 찾을 수 없습니다: ${missingIds.join(', ')}` });
      return;
    }

    const activeAgents = agentRows.filter((a) => a.is_active);
    if (activeAgents.length === 0) {
      res.status(409).json({ error: '실행 가능한 활성 봇이 없습니다' });
      return;
    }

    const jobs = activeAgents.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      task: taskStr,
    }));

    const onProgress = async (result: ParallelResult): Promise<void> => {
      const feedType = result.success ? 'result' : 'error';
      const feedContent = result.success
        ? result.output
        : `병렬 실행 실패 (${result.error ?? 'unknown'}): ${result.output}`;

      const feedId = uuidv4();
      await db.query(
        `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [feedId, result.agentId, mission_id ?? null, feedType, feedContent, null, null, false],
      );
    };

    const allResults = await ParallelExecutor.run(jobs, 3, (result) => {
      onProgress(result).catch(() => {/* best-effort feed save */});
    });

    const successCount = allResults.filter((r) => r.success).length;
    const failedCount = allResults.length - successCount;

    res.status(200).json({
      data: {
        results: allResults,
        total: allResults.length,
        success: successCount,
        failed: failedCount,
      },
    });
  });

  // POST /api/missions/:id/run-all — 미션의 모든 활성 봇 병렬 실행
  router.post('/missions/:id/run-all', async (req: Request, res: Response) => {
    const missionId = req.params.id;

    const agentResult = await db.query(
      'SELECT id, name FROM agents WHERE mission_id = $1 AND is_active = true',
      [missionId],
    );
    const agentRows = agentResult.rows as Array<{ id: string; name: string }>;

    if (agentRows.length === 0) {
      res.status(404).json({ error: '해당 미션에 활성 봇이 없습니다' });
      return;
    }

    const defaultTask = '정기 작업 실행';
    const jobs = agentRows.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      task: defaultTask,
    }));

    const onProgress = async (result: ParallelResult): Promise<void> => {
      const feedType = result.success ? 'result' : 'error';
      const feedContent = result.success
        ? result.output
        : `병렬 실행 실패 (${result.error ?? 'unknown'}): ${result.output}`;

      const feedId = uuidv4();
      await db.query(
        `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [feedId, result.agentId, missionId, feedType, feedContent, null, null, false],
      );
    };

    const allResults = await ParallelExecutor.run(jobs, 3, (result) => {
      onProgress(result).catch(() => {/* best-effort feed save */});
    });

    const successCount = allResults.filter((r) => r.success).length;
    const failedCount = allResults.length - successCount;

    res.status(200).json({
      data: {
        results: allResults,
        total: allResults.length,
        success: successCount,
        failed: failedCount,
      },
    });
  });

  return router;
}
