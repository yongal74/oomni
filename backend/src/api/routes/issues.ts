import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const VALID_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

const CreateIssueSchema = z.object({
  mission_id: z.string().min(1),
  agent_id: z.string().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(VALID_STATUSES).default('open'),
  priority: z.enum(VALID_PRIORITIES).default('medium'),
  parent_id: z.string().nullable().optional(),
});

const PatchIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(VALID_STATUSES).optional(),
  priority: z.enum(VALID_PRIORITIES).optional(),
  agent_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
});

export function issuesRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/issues?mission_id=&status=&priority=
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { mission_id, status, priority } = req.query;
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (mission_id) {
        conditions.push(`mission_id = $${idx++}`);
        params.push(mission_id);
      }
      if (status) {
        conditions.push(`status = $${idx++}`);
        params.push(status);
      }
      if (priority) {
        conditions.push(`priority = $${idx++}`);
        params.push(priority);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `SELECT * FROM issues ${where} ORDER BY created_at DESC`,
        params
      );
      res.json({ data: result.rows });
    } catch (err) {
      logger.error('[issues] GET / 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // POST /api/issues
  router.post('/', async (req: Request, res: Response) => {
    try {
      const parsed = CreateIssueSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const { mission_id, agent_id, title, description, status, priority, parent_id } = parsed.data;
      const id = uuidv4();

      const result = await db.query(
        `INSERT INTO issues (id, mission_id, agent_id, title, description, status, priority, parent_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [id, mission_id, agent_id ?? null, title, description ?? null, status, priority, parent_id ?? null]
      );

      res.status(201).json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[issues] POST / 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // PATCH /api/issues/:id
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const parsed = PatchIssueSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const data = parsed.data;
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const PATCHABLE_KEYS = ['title', 'description', 'status', 'priority', 'agent_id', 'parent_id'] as const;
      for (const key of PATCHABLE_KEYS) {
        if (data[key] !== undefined) {
          updates.push(`${key} = $${idx++}`);
          values.push(data[key] ?? null);
        }
      }

      if (updates.length === 0) {
        res.status(400).json({ error: '변경할 필드가 없습니다' });
        return;
      }

      values.push(req.params.id);
      const result = await db.query(
        `UPDATE issues SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if ((result.rows as unknown[]).length === 0) {
        res.status(404).json({ error: '이슈를 찾을 수 없습니다' });
        return;
      }
      res.json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[issues] PATCH /:id 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // DELETE /api/issues/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await db.query('DELETE FROM issues WHERE id = $1', [req.params.id]);
      res.status(204).send();
    } catch (err) {
      logger.error('[issues] DELETE /:id 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  return router;
}
