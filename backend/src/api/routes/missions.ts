import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/client.js';
import { logger } from '../../logger.js';

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
    try {
      const parsed = CreateMissionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message });
        return;
      }
      const { name, description } = parsed.data;
      const missionId = uuidv4();
      const result = await db.query(
        'INSERT INTO missions (id, name, description) VALUES ($1,$2,$3) RETURNING *',
        [missionId, name, description],
      );

      // CEO Bot 자동 생성 (실패해도 미션 생성은 성공 — 구버전 DB 호환, 중복 생성 방지)
      try {
        const ceoBotDb = getDb();
        const existing = await ceoBotDb.query(
          `SELECT id FROM agents WHERE mission_id = $1 AND role = 'ceo' LIMIT 1`,
          [missionId],
        );
        if ((existing.rows as unknown[]).length === 0) {
          const ceoBotId = uuidv4();
          await ceoBotDb.query(
            `INSERT INTO agents (id, mission_id, name, role, system_prompt, schedule, budget_cents, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              ceoBotId,
              missionId,
              'CEO Bot',
              'ceo',
              '너는 CEO AI 봇이다. 모든 봇의 활동을 종합하고 전략적 보고서를 생성해라.',
              'manual',
              1000,
              true,
            ],
          );
        }
      } catch (ceoErr) {
        logger.warn('[missions POST] CEO Bot 자동 생성 실패 (무시):', ceoErr);
      }

      res.status(201).json({ data: (result.rows as unknown[])[0] });
    } catch (err) {
      logger.error('[missions POST]', err);
      res.status(500).json({ error: '미션 생성에 실패했습니다' });
    }
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
