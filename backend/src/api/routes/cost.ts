import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

const RecordCostSchema = z.object({
  agent_id: z.string().min(1),
  mission_id: z.string().min(1),
  run_id: z.string().optional(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  cost_usd: z.number().min(0),
  model: z.string().optional(),
});

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

type AgentRow = {
  agent_id: string;
  agent_name: string;
  role: string;
  budget_cents: number;
  mission_id: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  run_count: number;
};

type DailyRow = {
  date: string;
  cost_usd: number;
};

const BUDGET_ALERT_THRESHOLD = 0.8;

function buildDateFilter(period: string): string | null {
  if (period === '7d') return `datetime('now', '-7 days')`;
  if (period === '1d') return `datetime('now', '-1 day')`;
  if (period === '30d') return `datetime('now', '-30 days')`;
  // 'all' — no filter
  return null;
}

function buildMockData(agentCount: number) {
  const mockAgents = Array.from({ length: Math.max(agentCount, 0) }, (_, i) => ({
    agent_id: `mock-agent-${i}`,
    agent_name: `봇 ${i + 1}`,
    cost_usd: 0,
    input_tokens: 0,
    output_tokens: 0,
    run_count: 0,
    budget_cents: 500,
    budget_used_pct: 0,
  }));
  return {
    total_cost_usd: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    by_agent: mockAgents,
    daily: [],
    period: '7d',
    budget_alerts: [],
  };
}

export function costRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/cost/summary?mission_id=&period=7d|30d|1d|all
  router.get('/summary', async (req: Request, res: Response): Promise<void> => {
    try {
      const { mission_id, period = '7d' } = req.query as Record<string, string>;
      const dateFilter = buildDateFilter(period);

      // --- Per-agent aggregation from token_usage and heartbeat_runs ---
      const missionFilter = mission_id ? `AND a.mission_id = ?` : '';
      const missionParams: unknown[] = mission_id ? [mission_id] : [];

      // Build date condition for token_usage
      const tuDateCond = dateFilter ? `AND tu.created_at >= ${dateFilter}` : '';
      // Build date condition for heartbeat_runs
      const hrDateCond = dateFilter ? `AND hr.started_at >= ${dateFilter}` : '';

      // Aggregate from token_usage (primary source)
      const tuSql = `
        SELECT
          a.id as agent_id,
          a.name as agent_name,
          a.role,
          a.budget_cents,
          a.mission_id,
          COALESCE(SUM(tu.cost_usd), 0) as cost_usd,
          COALESCE(SUM(tu.input_tokens), 0) as input_tokens,
          COALESCE(SUM(tu.output_tokens), 0) as output_tokens,
          COUNT(tu.id) as run_count
        FROM agents a
        LEFT JOIN token_usage tu ON tu.agent_id = a.id ${tuDateCond}
        WHERE 1=1 ${missionFilter}
        GROUP BY a.id, a.name, a.role, a.budget_cents, a.mission_id
      `;

      // Also aggregate from heartbeat_runs (fallback / supplemental)
      const hrSql = `
        SELECT
          a.id as agent_id,
          a.name as agent_name,
          a.role,
          a.budget_cents,
          a.mission_id,
          COALESCE(SUM(hr.cost_usd), 0) as cost_usd,
          COALESCE(SUM(hr.tokens_input), 0) as input_tokens,
          COALESCE(SUM(hr.tokens_output), 0) as output_tokens,
          COUNT(hr.id) as run_count
        FROM agents a
        LEFT JOIN heartbeat_runs hr ON hr.agent_id = a.id ${hrDateCond}
          AND hr.status = 'completed'
        WHERE 1=1 ${missionFilter}
        GROUP BY a.id, a.name, a.role, a.budget_cents, a.mission_id
      `;

      const [tuResult, hrResult] = await Promise.all([
        db.query(tuSql, missionParams),
        db.query(hrSql, missionParams),
      ]);

      const tuRows = tuResult.rows as AgentRow[];
      const hrRows = hrResult.rows as AgentRow[];

      // Merge: prefer token_usage data; supplement with heartbeat_runs
      const agentMap = new Map<string, AgentRow>();
      for (const row of hrRows) {
        agentMap.set(row.agent_id, { ...row });
      }
      for (const row of tuRows) {
        const existing = agentMap.get(row.agent_id);
        if (existing) {
          // Use token_usage data if it has actual records
          if (row.cost_usd > 0 || row.run_count > 0) {
            agentMap.set(row.agent_id, {
              ...existing,
              cost_usd: row.cost_usd,
              input_tokens: row.input_tokens,
              output_tokens: row.output_tokens,
              run_count: row.run_count,
            });
          }
        } else {
          agentMap.set(row.agent_id, { ...row });
        }
      }

      const byAgent = Array.from(agentMap.values()).sort((a, b) => b.cost_usd - a.cost_usd);

      const totalCostUsd = byAgent.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
      const totalInputTokens = byAgent.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
      const totalOutputTokens = byAgent.reduce((s, r) => s + (r.output_tokens ?? 0), 0);

      // If no real data at all, return mock
      if (totalCostUsd === 0 && byAgent.length === 0) {
        const agentCountRes = await db.query(
          `SELECT COUNT(*) as cnt FROM agents${mission_id ? ' WHERE mission_id = ?' : ''}`,
          mission_id ? [mission_id] : [],
        );
        const cnt = (agentCountRes.rows[0] as { cnt: number })?.cnt ?? 0;
        res.json({ data: buildMockData(cnt) }); return;
      }

      // Budget alerts (>80%)
      const budgetAlerts = byAgent
        .filter(r => {
          const budgetCents = r.budget_cents ?? 0;
          if (budgetCents <= 0) return false;
          const spentCents = (r.cost_usd ?? 0) * 100;
          return spentCents / budgetCents > BUDGET_ALERT_THRESHOLD;
        })
        .map(r => ({
          agent_id: r.agent_id,
          agent_name: r.agent_name,
          budget_cents: r.budget_cents,
          spent_cents: Math.round((r.cost_usd ?? 0) * 100),
          pct: Math.round(((r.cost_usd ?? 0) * 100) / (r.budget_cents ?? 1)),
        }));

      // Daily cost — from token_usage + heartbeat_runs combined
      const dailyTuSql = `
        SELECT
          date(tu.created_at) as date,
          COALESCE(SUM(tu.cost_usd), 0) as cost_usd
        FROM token_usage tu
        JOIN agents a ON a.id = tu.agent_id
        WHERE 1=1 ${missionFilter.replace('a.mission_id', 'a.mission_id')}
          ${dateFilter ? `AND tu.created_at >= ${dateFilter}` : ''}
        GROUP BY date(tu.created_at)
        ORDER BY date ASC
      `;
      const dailyHrSql = `
        SELECT
          date(hr.started_at) as date,
          COALESCE(SUM(hr.cost_usd), 0) as cost_usd
        FROM heartbeat_runs hr
        JOIN agents a ON a.id = hr.agent_id
        WHERE hr.status = 'completed'
          ${mission_id ? 'AND a.mission_id = ?' : ''}
          ${dateFilter ? `AND hr.started_at >= ${dateFilter}` : ''}
        GROUP BY date(hr.started_at)
        ORDER BY date ASC
      `;

      const [dailyTuRes, dailyHrRes] = await Promise.all([
        db.query(dailyTuSql, missionParams),
        db.query(dailyHrSql, missionParams),
      ]);

      // Merge daily data
      const dailyMap = new Map<string, number>();
      for (const row of dailyHrRes.rows as DailyRow[]) {
        dailyMap.set(row.date, (dailyMap.get(row.date) ?? 0) + (row.cost_usd ?? 0));
      }
      for (const row of dailyTuRes.rows as DailyRow[]) {
        if ((row.cost_usd ?? 0) > 0) {
          dailyMap.set(row.date, (row.cost_usd ?? 0));
        }
      }
      const daily = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, cost_usd]) => ({ date, cost_usd }));

      // Format by_agent response
      const byAgentResponse = byAgent.map(r => {
        const budgetCents = r.budget_cents ?? 0;
        const spentCents = (r.cost_usd ?? 0) * 100;
        const budgetUsedPct = budgetCents > 0 ? Math.round((spentCents / budgetCents) * 100) : 0;
        return {
          agent_id: r.agent_id,
          agent_name: r.agent_name,
          cost_usd: r.cost_usd ?? 0,
          input_tokens: r.input_tokens ?? 0,
          output_tokens: r.output_tokens ?? 0,
          run_count: r.run_count ?? 0,
          budget_cents: budgetCents,
          budget_used_pct: budgetUsedPct,
        };
      });

      res.json({
        data: {
          total_cost_usd: totalCostUsd,
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          by_agent: byAgentResponse,
          daily,
          period,
          budget_alerts: budgetAlerts,
        },
      });
    } catch (err) {
      console.error('[cost/summary]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/cost — 봇이 토큰 사용량 기록
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = RecordCostSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message });
        return;
      }
      const d = parsed.data;
      await db.query(
        `INSERT INTO token_usage (agent_id, mission_id, run_id, input_tokens, output_tokens, cost_usd, model)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          d.agent_id,
          d.mission_id,
          d.run_id ?? null,
          d.input_tokens,
          d.output_tokens,
          d.cost_usd,
          d.model ?? 'claude-3-5-sonnet',
        ],
      );
      res.status(201).json({ message: '비용 기록 완료' });
    } catch (err) {
      console.error('[cost POST]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
