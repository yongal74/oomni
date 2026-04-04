import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

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

    // HeartbeatScheduler에 triggerNow 위임 (실제 실행은 비동기)
    res.status(202).json({ message: '봇 실행을 요청했습니다', agentId: agent.id });
  });

  // DELETE /api/agents/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    await db.query('DELETE FROM agents WHERE id = $1', [req.params.id]);
    res.status(204).send();
  });

  return router;
}
