/**
 * HeartbeatScheduler — 봇 자율 실행 엔진
 * Paperclip 검증 방식: setInterval 하트비트, 봇이 wake → 작업 확인 → 실행 → 보고
 */
import type { Agent } from '../db/types';
import type { AgentRunner } from './runner';
import { logger } from '../logger';

interface ScheduledJob {
  agent: Agent;
  timer: ReturnType<typeof setInterval> | null;
}

interface TriggerResult {
  skipped: boolean;
  reason?: string;
  runId?: string;
}

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const SCHEDULE_INTERVALS: Record<string, number> = {
  manual: 0,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export class HeartbeatScheduler {
  private jobs = new Map<string, ScheduledJob>();
  private readonly db: DbClient;
  private readonly runner: Pick<AgentRunner, 'run'>;

  constructor(
    db: DbClient,
    runner: Pick<AgentRunner, 'run'>
  ) {
    this.db = db;
    this.runner = runner;
  }

  getRunningCount(): number {
    return this.jobs.size;
  }

  schedule(agent: Agent): void {
    if (!agent.is_active) return;
    if (this.jobs.has(agent.id)) {
      // 이미 등록된 경우 기존 잡 유지 (중복 방지)
      return;
    }

    const interval = SCHEDULE_INTERVALS[agent.schedule] ?? 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    if (interval > 0) {
      timer = setInterval(() => {
        this.triggerNow(agent.id).catch((err) => {
          logger.error(`[HeartbeatScheduler] 자동 트리거 오류 agent=${agent.id}`, err);
        });
      }, interval);
    }

    this.jobs.set(agent.id, { agent, timer });
    logger.info(`[HeartbeatScheduler] 봇 스케줄 등록: ${agent.name} (${agent.schedule})`);
  }

  unschedule(agentId: string): void {
    const job = this.jobs.get(agentId);
    if (!job) return;
    if (job.timer) clearInterval(job.timer);
    this.jobs.delete(agentId);
    logger.info(`[HeartbeatScheduler] 봇 스케줄 해제: ${agentId}`);
  }

  stopAll(): void {
    for (const [id] of this.jobs) {
      this.unschedule(id);
    }
  }

  async triggerNow(agentId: string, task?: string): Promise<TriggerResult> {
    const job = this.jobs.get(agentId);
    if (!job) {
      // 스케줄에 없더라도 DB에서 agent를 조회해서 실행 시도
      try {
        const agentResult = await this.db.query('SELECT * FROM agents WHERE id = $1', [agentId]);
        const rows = agentResult.rows as Agent[];
        if (rows.length === 0) {
          return { skipped: true, reason: '등록되지 않은 봇입니다' };
        }
        const agent = rows[0];
        if (!agent.is_active) {
          return { skipped: true, reason: '비활성 봇입니다' };
        }
        // 임시 등록 후 실행
        this.jobs.set(agentId, { agent, timer: null });
        const result = await this._runAgent(agent, task);
        this.jobs.delete(agentId);
        return result;
      } catch (err) {
        logger.error(`[HeartbeatScheduler] 봇 조회 실패: ${agentId}`, err);
        return { skipped: true, reason: '봇 조회 실패' };
      }
    }

    // 예산 초과 체크
    const budgetCheck = await this.checkBudget(job.agent);
    if (budgetCheck.exceeded) {
      logger.warn(`[HeartbeatScheduler] 예산 초과 — 실행 건너뜀: ${job.agent.name}`);
      return { skipped: true, reason: `budget 초과: $${budgetCheck.spent.toFixed(2)} / $${(job.agent.budget_cents / 100).toFixed(2)}` };
    }

    return this._runAgent(job.agent, task);
  }

  private async _runAgent(agent: Agent, task?: string): Promise<TriggerResult> {
    try {
      const result = await this.runner.run(agent, task);
      const runResult: TriggerResult = { skipped: false, runId: (result as { runId?: string }).runId };

      // chain trigger: bot_complete 타입 스케줄 확인 후 연쇄 실행
      await this.triggerChainSchedules(agent.id);

      return runResult;
    } catch (err) {
      // 봇 실행 실패가 스케줄러 전체를 중단시키지 않도록 격리
      logger.error(`[HeartbeatScheduler] 봇 실행 실패 (격리됨): ${agent.name}`, err);
      return { skipped: false };
    }
  }

  private async triggerChainSchedules(completedAgentId: string): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT * FROM schedules
         WHERE trigger_type = 'bot_complete'
           AND trigger_value = $1
           AND is_active = 1`,
        [completedAgentId]
      );

      const chainSchedules = result.rows as Array<{ id: string; agent_id: string }>;
      if (chainSchedules.length === 0) return;

      for (const schedule of chainSchedules) {
        logger.info(`[HeartbeatScheduler] chain trigger 실행: schedule=${schedule.id} → agent=${schedule.agent_id}`);

        // last_run_at 업데이트
        await this.db.query(
          `UPDATE schedules SET last_run_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = $1`,
          [schedule.id]
        );

        // 연쇄 실행 (비동기, 오류 격리)
        this.triggerNow(schedule.agent_id).catch((err) => {
          logger.error(`[HeartbeatScheduler] chain trigger 오류 agent=${schedule.agent_id}`, err);
        });
      }
    } catch (err) {
      logger.error(`[HeartbeatScheduler] chain trigger 조회 오류 completedAgent=${completedAgentId}`, err);
    }
  }

  private async checkBudget(agent: Agent): Promise<{ exceeded: boolean; spent: number }> {
    try {
      const result = await this.db.query(
        `SELECT COALESCE(SUM(cost_usd), 0) as total_cost_usd
         FROM cost_events
         WHERE agent_id = $1
           AND created_at >= strftime('%Y-%m-01', 'now')`,
        [agent.id]
      );
      const rows = result.rows as Array<{ total_cost_usd: string }>;
      const spent = parseFloat(rows[0]?.total_cost_usd ?? '0');
      const budgetUsd = agent.budget_cents / 100;
      return { exceeded: spent >= budgetUsd, spent };
    } catch {
      // DB 오류 시 실행 허용 (conservative fail-open)
      return { exceeded: false, spent: 0 };
    }
  }
}
