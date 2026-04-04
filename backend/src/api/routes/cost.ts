import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const RecordCostSchema = z.object({
  agent_id: z.string().min(1),
  run_id: z.string().min(1),
  tokens_input: z.number().int().min(0),
  tokens_output: z.number().int().min(0),
  cost_usd: z.number().min(0),
});

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export function costRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/cost/summary?mission_id=&period=month
  router.get('/summary', async (req: Request, res: Response) => {
    const { mission_id, period } = req.query;
    const interval = period === 'week' ? '7 days' : period === 'day' ? '1 day' : '30 days';

    let sql = `
      SELECT
        a.id, a.name, a.role,
        COALESCE(SUM(ce.cost_usd), 0) as total_cost_usd,
        COALESCE(SUM(ce.tokens_input + ce.tokens_output), 0) as total_tokens,
        COUNT(ce.id) as run_count
      FROM agents a
      LEFT JOIN cost_events ce ON ce.agent_id = a.id
        AND ce.created_at >= NOW() - INTERVAL '${interval}'
    `;
    const params: unknown[] = [];

    if (mission_id) {
      sql += ` WHERE a.mission_id = $1`;
      params.push(mission_id);
    }
    sql += ` GROUP BY a.id, a.name, a.role ORDER BY total_cost_usd DESC`;

    const result = await db.query(sql, params);
    res.json({ data: result.rows, period: interval });
  });

  // POST /api/cost — 봇이 비용 기록
  router.post('/', async (req: Request, res: Response) => {
    const parsed = RecordCostSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }
    const d = parsed.data;
    await db.query(
      `INSERT INTO cost_events (id, agent_id, run_id, tokens_input, tokens_output, cost_usd)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuidv4(), d.agent_id, d.run_id, d.tokens_input, d.tokens_output, d.cost_usd],
    );
    res.status(201).json({ message: '비용 기록 완료' });
  });

  return router;
}
