/**
 * tasks.ts — Mission Board 태스크 CRUD + 실행 API
 * v5.0.1
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';
import { executionRouter } from '../../services/executionRouter';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

// ── 검증 스키마 ──────────────────────────────────────────────────────────────

const LAYERS   = ['build','frontend','backend','infra','content','research','design','marketing','ops'] as const;
const ENGINES  = ['claude_code','codex','claude_design','research','growth','ops','chat'] as const;
const STATUSES = ['todo','in_progress','review','done'] as const;
const PRIOS    = ['P0','P1','P2'] as const;

const CreateTaskSchema = z.object({
  mission_id:         z.string().uuid(),
  project_id:         z.string().uuid().optional(),
  title:              z.string().min(1).max(300),
  description:        z.string().max(10000).default(''),
  layer:              z.enum(LAYERS).default('build'),
  engine:             z.enum(ENGINES).default('claude_code'),
  priority:           z.enum(PRIOS).default('P1'),
  status:             z.enum(STATUSES).default('todo'),
  due_date:           z.string().optional(),
  estimated_hours:    z.number().min(0).max(999).optional(),
  recipe_id:          z.string().optional(),
  requires_approval:  z.boolean().default(false),
});

const UpdateTaskSchema = CreateTaskSchema.partial().omit({ mission_id: true });

const ExecuteTaskSchema = z.object({
  model:    z.string().optional(),       // 모델 오버라이드 (기본은 엔진별 기본값)
});

export function tasksRouter(db: DbClient): Router {
  const router = Router();

  // ── GET /tasks?mission_id=&status=&layer=&engine=&priority= ──────────────
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { mission_id, status, layer, engine, priority } = req.query as Record<string, string>;
      if (!mission_id) {
        res.status(400).json({ error: 'mission_id 필수' });
        return;
      }

      let sql = 'SELECT * FROM tasks WHERE mission_id = $1';
      const params: unknown[] = [mission_id];
      let idx = 2;

      if (status)   { sql += ` AND status = $${idx++}`;   params.push(status); }
      if (layer)    { sql += ` AND layer = $${idx++}`;    params.push(layer); }
      if (engine)   { sql += ` AND engine = $${idx++}`;   params.push(engine); }
      if (priority) { sql += ` AND priority = $${idx++}`; params.push(priority); }

      sql += ' ORDER BY sort_order ASC, created_at ASC';

      const result = await db.query(sql, params);
      res.json({ data: result.rows });
    } catch (err) {
      logger.error('[tasks GET /]', err);
      res.status(500).json({ error: '태스크 목록 조회 실패' });
    }
  });

  // ── POST /tasks ───────────────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    try {
      const parsed = CreateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message });
        return;
      }
      const d = parsed.data;
      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO tasks (id, mission_id, project_id, title, description, layer, engine,
          priority, status, due_date, estimated_hours, recipe_id, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [id, d.mission_id, d.project_id ?? null, d.title, d.description,
         d.layer, d.engine, d.priority, d.status, d.due_date ?? null,
         d.estimated_hours ?? null, d.recipe_id ?? null, d.requires_approval],
      );
      res.status(201).json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[tasks POST]', err);
      res.status(500).json({ error: '태스크 생성 실패' });
    }
  });

  // ── GET /tasks/:id ────────────────────────────────────────────────────────
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const result = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
      if ((result.rows as unknown[]).length === 0) {
        res.status(404).json({ error: '태스크를 찾을 수 없습니다' });
        return;
      }
      res.json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[tasks GET /:id]', err);
      res.status(500).json({ error: '태스크 조회 실패' });
    }
  });

  // ── PUT /tasks/:id ────────────────────────────────────────────────────────
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const parsed = UpdateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message });
        return;
      }
      const d = parsed.data;
      const fields = Object.keys(d) as (keyof typeof d)[];
      if (fields.length === 0) {
        res.status(400).json({ error: '수정할 필드 없음' });
        return;
      }

      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map(f => d[f]);

      await db.query(
        `UPDATE tasks SET ${setClauses}, updated_at = datetime('now') WHERE id = $1`,
        [req.params.id, ...values],
      );

      const result = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
      res.json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[tasks PUT /:id]', err);
      res.status(500).json({ error: '태스크 수정 실패' });
    }
  });

  // ── DELETE /tasks/:id ─────────────────────────────────────────────────────
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await db.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      logger.error('[tasks DELETE /:id]', err);
      res.status(500).json({ error: '태스크 삭제 실패' });
    }
  });

  // ── POST /tasks/:id/execute ───────────────────────────────────────────────
  router.post('/:id/execute', async (req: Request, res: Response) => {
    try {
      const taskResult = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
      if ((taskResult.rows as unknown[]).length === 0) {
        res.status(404).json({ error: '태스크를 찾을 수 없습니다' });
        return;
      }
      const task = (taskResult.rows as unknown[])[0] as Record<string, unknown>;

      // checkout_lock 확인 — 이미 실행 중이면 거부
      if (task.checkout_lock) {
        res.status(409).json({ error: '이미 실행 중인 태스크입니다' });
        return;
      }

      const parsed = ExecuteTaskSchema.safeParse(req.body);
      const modelOverride = parsed.success ? parsed.data.model : undefined;

      // 승인 필요 태스크 — review 상태 아닌 경우만 체크
      if (task.requires_approval && task.status !== 'review') {
        // 승인 대기 상태로만 전환 (실제 실행 안 함)
        await db.query(
          "UPDATE tasks SET status = 'review', updated_at = datetime('now') WHERE id = $1",
          [req.params.id],
        );
        res.json({ queued: true, message: '승인 대기 중으로 전환되었습니다' });
        return;
      }

      // checkout_lock 설정
      await db.query(
        "UPDATE tasks SET checkout_lock = $1, status = 'in_progress', updated_at = datetime('now') WHERE id = $2",
        [Date.now().toString(), req.params.id],
      );

      res.json({ started: true, task_id: req.params.id });

      // 비동기 실행 (SSE는 별도 /stream 엔드포인트로)
      executionRouter(db, task, modelOverride).catch(err => {
        logger.error('[tasks execute]', err);
      });
    } catch (err) {
      logger.error('[tasks POST /:id/execute]', err);
      res.status(500).json({ error: '실행 시작 실패' });
    }
  });

  // ── POST /tasks/:id/approve ───────────────────────────────────────────────
  router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
      await db.query(
        "UPDATE tasks SET status = 'in_progress', requires_approval = 0, updated_at = datetime('now') WHERE id = $1",
        [req.params.id],
      );
      res.json({ ok: true });
    } catch (err) {
      logger.error('[tasks approve]', err);
      res.status(500).json({ error: '승인 처리 실패' });
    }
  });

  // ── POST /tasks/:id/reject ────────────────────────────────────────────────
  router.post('/:id/reject', async (req: Request, res: Response) => {
    try {
      const { reason } = req.body as { reason?: string };
      await db.query(
        "UPDATE tasks SET status = 'todo', checkout_lock = NULL, updated_at = datetime('now') WHERE id = $1",
        [req.params.id],
      );
      // 거절 사유를 feed_item으로 기록 (optional)
      if (reason) {
        logger.info(`[tasks reject] ${req.params.id}: ${reason}`);
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error('[tasks reject]', err);
      res.status(500).json({ error: '거절 처리 실패' });
    }
  });

  // ── GET /tasks/:id/results ────────────────────────────────────────────────
  router.get('/:id/results', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        'SELECT * FROM task_results WHERE task_id = $1 ORDER BY created_at DESC',
        [req.params.id],
      );
      res.json({ data: result.rows });
    } catch (err) {
      logger.error('[tasks GET /:id/results]', err);
      res.status(500).json({ error: '실행 결과 조회 실패' });
    }
  });

  // ── PUT /tasks/reorder ────────────────────────────────────────────────────
  // body: { items: [{ id, status, sort_order }] }
  router.put('/reorder', async (req: Request, res: Response) => {
    try {
      const { items } = req.body as { items: { id: string; status: string; sort_order: number }[] };
      if (!Array.isArray(items)) {
        res.status(400).json({ error: 'items 배열 필요' });
        return;
      }
      for (const item of items) {
        await db.query(
          "UPDATE tasks SET status = $1, sort_order = $2, updated_at = datetime('now') WHERE id = $3",
          [item.status, item.sort_order, item.id],
        );
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error('[tasks reorder]', err);
      res.status(500).json({ error: '순서 변경 실패' });
    }
  });

  return router;
}
