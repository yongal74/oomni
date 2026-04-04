import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const VALID_TRIGGER_TYPES = ['interval', 'cron', 'webhook', 'bot_complete'] as const;

const CreateScheduleSchema = z.object({
  agent_id: z.string().min(1),
  mission_id: z.string().min(1),
  name: z.string().max(200).default(''),
  trigger_type: z.enum(VALID_TRIGGER_TYPES).default('interval'),
  trigger_value: z.string().max(500).default(''),
  is_active: z.boolean().default(true),
});

const PatchScheduleSchema = z.object({
  name: z.string().max(200).optional(),
  trigger_type: z.enum(VALID_TRIGGER_TYPES).optional(),
  trigger_value: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

export function schedulesRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/schedules?mission_id=&agent_id=
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { mission_id, agent_id } = req.query;
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (mission_id) {
        conditions.push(`mission_id = $${idx++}`);
        params.push(mission_id);
      }
      if (agent_id) {
        conditions.push(`agent_id = $${idx++}`);
        params.push(agent_id);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `SELECT * FROM schedules ${where} ORDER BY created_at DESC`,
        params
      );
      res.json({ data: result.rows });
    } catch (err) {
      logger.error('[schedules] GET / 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // POST /api/schedules
  router.post('/', async (req: Request, res: Response) => {
    try {
      const parsed = CreateScheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const { agent_id, mission_id, name, trigger_type, trigger_value, is_active } = parsed.data;
      const id = uuidv4();

      const result = await db.query(
        `INSERT INTO schedules (id, agent_id, mission_id, name, trigger_type, trigger_value, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [id, agent_id, mission_id, name, trigger_type, trigger_value, is_active]
      );

      res.status(201).json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[schedules] POST / 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // PATCH /api/schedules/:id
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const parsed = PatchScheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const data = parsed.data;
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(data.name);
      }
      if (data.trigger_type !== undefined) {
        updates.push(`trigger_type = $${idx++}`);
        values.push(data.trigger_type);
      }
      if (data.trigger_value !== undefined) {
        updates.push(`trigger_value = $${idx++}`);
        values.push(data.trigger_value);
      }
      if (data.is_active !== undefined) {
        updates.push(`is_active = $${idx++}`);
        values.push(data.is_active);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: '변경할 필드가 없습니다' });
        return;
      }

      values.push(req.params.id);
      const result = await db.query(
        `UPDATE schedules SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if ((result.rows as unknown[]).length === 0) {
        res.status(404).json({ error: '스케줄을 찾을 수 없습니다' });
        return;
      }
      res.json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[schedules] PATCH /:id 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // DELETE /api/schedules/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await db.query('DELETE FROM schedules WHERE id = $1', [req.params.id]);
      res.status(204).send();
    } catch (err) {
      logger.error('[schedules] DELETE /:id 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  return router;
}
