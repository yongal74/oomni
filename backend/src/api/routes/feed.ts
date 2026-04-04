import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const CreateFeedSchema = z.object({
  agent_id: z.string().min(1),
  run_id: z.string().nullable().optional(),
  type: z.enum(['info', 'result', 'approval', 'error']),
  content: z.string().min(1).max(50000),
  action_label: z.string().max(100).nullable().optional(),
  action_data: z.record(z.unknown()).nullable().optional(),
  requires_approval: z.boolean().default(false),
});

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export function feedRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/feed?mission_id=&limit=&approval_only=
  router.get('/', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const approvalOnly = req.query.approval_only === 'true';

    let sql = `SELECT f.*, a.name as agent_name, a.role as agent_role
               FROM feed_items f
               JOIN agents a ON f.agent_id = a.id`;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (req.query.mission_id) {
      conditions.push(`a.mission_id = $${params.length + 1}`);
      params.push(req.query.mission_id);
    }
    if (approvalOnly) {
      conditions.push('f.requires_approval = true AND f.approved_at IS NULL AND f.rejected_at IS NULL');
    }
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` ORDER BY f.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(sql, params);
    res.json({ data: result.rows });
  });

  // POST /api/feed — 봇이 결과 보고
  router.post('/', async (req: Request, res: Response) => {
    const parsed = CreateFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }

    const d = parsed.data;
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [id, d.agent_id, d.run_id ?? null, d.type, d.content,
       d.action_label ?? null, d.action_data ? JSON.stringify(d.action_data) : null,
       d.requires_approval],
    );
    res.status(201).json({ data: (result.rows as unknown[])[0] });
  });

  // POST /api/feed/:id/approve
  router.post('/:id/approve', async (req: Request, res: Response) => {
    const result = await db.query(
      `UPDATE feed_items SET approved_at = NOW()
       WHERE id = $1 AND requires_approval = true AND approved_at IS NULL
       RETURNING *`,
      [req.params.id],
    );
    if ((result.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '항목을 찾을 수 없거나 이미 처리됨' });
      return;
    }
    res.json({ data: (result.rows as unknown[])[0] });
  });

  // POST /api/feed/:id/reject
  router.post('/:id/reject', async (req: Request, res: Response) => {
    const result = await db.query(
      `UPDATE feed_items SET rejected_at = NOW()
       WHERE id = $1 AND requires_approval = true AND rejected_at IS NULL
       RETURNING *`,
      [req.params.id],
    );
    if ((result.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '항목을 찾을 수 없거나 이미 처리됨' });
      return;
    }
    res.json({ data: (result.rows as unknown[])[0] });
  });

  return router;
}
