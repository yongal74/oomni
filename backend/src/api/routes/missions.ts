import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const CreateMissionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
});

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export function missionsRouter(db: DbClient): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM missions ORDER BY created_at DESC');
    res.json({ data: result.rows });
  });

  router.post('/', async (req: Request, res: Response) => {
    const parsed = CreateMissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }
    const { name, description } = parsed.data;
    const result = await db.query(
      'INSERT INTO missions (id, name, description) VALUES ($1,$2,$3) RETURNING *',
      [uuidv4(), name, description],
    );
    res.status(201).json({ data: (result.rows as unknown[])[0] });
  });

  router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM missions WHERE id = $1', [req.params.id]);
    if ((result.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '미션을 찾을 수 없습니다' });
      return;
    }
    res.json({ data: (result.rows as unknown[])[0] });
  });

  return router;
}
