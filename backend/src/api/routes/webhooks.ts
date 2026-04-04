import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../../logger';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

interface WebhooksOptions {
  db: DbClient;
  apiKey: string;
  triggerAgent: (agentId: string, task?: string) => Promise<{ skipped: boolean }>;
}

const WebhookBodySchema = z.object({
  agent_id: z.string().min(1),
  task: z.string().max(5000).optional(),
});

export function webhooksRouter(options: WebhooksOptions): Router {
  const router = Router();

  // POST /webhooks/:key
  // 인증: query param ?api_key=OOMNI_INTERNAL_API_KEY
  router.post('/:key', async (req: Request, res: Response) => {
    try {
      // API key 검증
      const { api_key } = req.query;
      if (api_key !== options.apiKey) {
        res.status(401).json({ error: '인증이 필요합니다' });
        return;
      }

      // 요청 body 검증
      const parsed = WebhookBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const { agent_id, task } = parsed.data;
      const webhookKey = req.params.key;

      // 웹훅 키가 schedules 테이블의 trigger_value와 일치하는지 확인 (선택적 검증)
      const scheduleResult = await options.db.query(
        `SELECT * FROM schedules
         WHERE trigger_type = 'webhook'
           AND trigger_value = $1
           AND agent_id = $2
           AND is_active = 1`,
        [webhookKey, agent_id]
      );

      if ((scheduleResult.rows as unknown[]).length > 0) {
        // last_run_at 업데이트
        const schedule = (scheduleResult.rows as Array<{ id: string }>)[0];
        await options.db.query(
          `UPDATE schedules SET last_run_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = $1`,
          [schedule.id]
        );
      }

      logger.info(`[webhooks] 웹훅 트리거: key=${webhookKey} agent=${agent_id}`);

      const result = await options.triggerAgent(agent_id, task);

      if (result.skipped) {
        res.status(202).json({ message: '봇 실행이 건너뛰어졌습니다', agentId: agent_id, skipped: true });
        return;
      }

      res.status(202).json({ message: '봇 실행을 요청했습니다', agentId: agent_id, skipped: false });
    } catch (err) {
      logger.error('[webhooks] POST /:key 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  return router;
}
