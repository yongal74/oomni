import { Router, type Request, type Response } from 'express';
import { logger } from '../../logger';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

type Period = 'daily' | 'weekly' | 'monthly';

function getStartDate(period: Period): string {
  const now = new Date();
  switch (period) {
    case 'daily':
      // 오늘 00:00:00 UTC
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    case 'weekly': {
      // 이번 주 월요일 00:00:00 UTC
      const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
      const diffToMonday = (day === 0 ? -6 : 1 - day);
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday));
      return monday.toISOString();
    }
    case 'monthly':
      // 이번 달 1일 00:00:00 UTC
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
}

interface AgentCostRow {
  agent_id: string;
  agent_name: string;
  total_cost_usd: number;
  run_count: number;
}

interface FeedHighlightRow {
  id: string;
  agent_id: string;
  agent_name: string;
  type: string;
  content: string;
  created_at: string;
}

export function reportsRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/reports?mission_id=&period=daily|weekly|monthly
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { mission_id } = req.query;
      const periodParam = req.query.period as string | undefined;

      if (!mission_id || typeof mission_id !== 'string') {
        res.status(400).json({ error: 'mission_id가 필요합니다' });
        return;
      }

      if (periodParam && !['daily', 'weekly', 'monthly'].includes(periodParam)) {
        res.status(400).json({ error: 'period는 daily|weekly|monthly 중 하나여야 합니다' });
        return;
      }

      const period: Period = (periodParam === 'daily' || periodParam === 'weekly' || periodParam === 'monthly')
        ? periodParam
        : 'daily';

      const startDate = getStartDate(period);

      // 미션 필터 조건 구성
      const agentWhere = mission_id
        ? `WHERE a.mission_id = ?`
        : '';
      const agentParams: unknown[] = mission_id ? [mission_id] : [];

      // 1. 해당 미션의 에이전트 ID 목록 수집
      const agentListResult = await db.query(
        `SELECT id FROM agents ${agentWhere}`,
        agentParams
      );
      const agentIds = (agentListResult.rows as Array<{ id: string }>).map(r => r.id);

      if (agentIds.length === 0) {
        res.json({
          period,
          generated_at: new Date().toISOString(),
          summary: {
            total_cost_usd: 0,
            runs_completed: 0,
            runs_failed: 0,
            top_agents: [],
            feed_highlights: [],
          },
        });
        return;
      }

      const placeholders = agentIds.map(() => '?').join(',');

      // 2. 총 비용 (cost_events 기준)
      const costResult = await db.query(
        `SELECT COALESCE(SUM(cost_usd), 0) as total_cost_usd
         FROM cost_events
         WHERE agent_id IN (${placeholders})
           AND created_at >= ?`,
        [...agentIds, startDate]
      );
      const totalCostRow = (costResult.rows as Array<{ total_cost_usd: number }>)[0];
      const totalCostUsd = Number(totalCostRow?.total_cost_usd ?? 0);

      // 3. 완료/실패 runs 집계
      const runsResult = await db.query(
        `SELECT
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as runs_completed,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as runs_failed
         FROM heartbeat_runs
         WHERE agent_id IN (${placeholders})
           AND started_at >= ?`,
        [...agentIds, startDate]
      );
      const runsRow = (runsResult.rows as Array<{ runs_completed: number; runs_failed: number }>)[0];
      const runsCompleted = Number(runsRow?.runs_completed ?? 0);
      const runsFailed = Number(runsRow?.runs_failed ?? 0);

      // 4. top_agents: 비용 기준 상위 5개
      const topAgentsResult = await db.query(
        `SELECT
           ce.agent_id,
           a.name as agent_name,
           COALESCE(SUM(ce.cost_usd), 0) as total_cost_usd,
           COUNT(DISTINCT ce.run_id) as run_count
         FROM cost_events ce
         JOIN agents a ON a.id = ce.agent_id
         WHERE ce.agent_id IN (${placeholders})
           AND ce.created_at >= ?
         GROUP BY ce.agent_id, a.name
         ORDER BY total_cost_usd DESC
         LIMIT 5`,
        [...agentIds, startDate]
      );
      const topAgents = (topAgentsResult.rows as AgentCostRow[]).map(row => ({
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        total_cost_usd: Number(row.total_cost_usd),
        run_count: Number(row.run_count),
      }));

      // 5. feed_highlights: approval 또는 result 타입 최신 10개
      const feedResult = await db.query(
        `SELECT
           fi.id,
           fi.agent_id,
           a.name as agent_name,
           fi.type,
           fi.content,
           fi.created_at
         FROM feed_items fi
         JOIN agents a ON a.id = fi.agent_id
         WHERE fi.agent_id IN (${placeholders})
           AND fi.created_at >= ?
           AND fi.type IN ('result','approval')
         ORDER BY fi.created_at DESC
         LIMIT 10`,
        [...agentIds, startDate]
      );
      const feedHighlights = (feedResult.rows as FeedHighlightRow[]).map(row => ({
        id: row.id,
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        type: row.type,
        content: row.content,
        created_at: row.created_at,
      }));

      res.json({
        period,
        generated_at: new Date().toISOString(),
        summary: {
          total_cost_usd: totalCostUsd,
          runs_completed: runsCompleted,
          runs_failed: runsFailed,
          top_agents: topAgents,
          feed_highlights: feedHighlights,
        },
      });
    } catch (err) {
      logger.error('[reports] GET / 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  return router;
}
