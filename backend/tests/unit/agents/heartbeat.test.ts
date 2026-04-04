/**
 * TDD: 하트비트 스케줄러 엔진
 * 봇이 주기적으로 wake → 실행 → 결과 저장하는 핵심 엔진
 */
import { HeartbeatScheduler } from '../../../src/agents/heartbeat';
import type { Agent } from '../../../src/db/types';

// DB와 Runner를 mock
const mockDb = {
  query: jest.fn(),
};
const mockRunner = {
  run: jest.fn(),
};

const sampleAgent: Agent = {
  id: 'agent-uuid-1',
  mission_id: 'mission-1',
  name: 'Research Bot',
  role: 'research',
  schedule: 'manual',
  system_prompt: '너는 리서치 봇이다',
  budget_cents: 1000,
  is_active: true,
  reports_to: null,
  created_at: '2026-04-04T00:00:00.000Z',
};

describe('HeartbeatScheduler', () => {
  let scheduler: HeartbeatScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new HeartbeatScheduler(mockDb as any, mockRunner as any);
  });

  afterEach(() => {
    scheduler.stopAll();
  });

  test('초기 상태: 실행 중인 잡이 없다', () => {
    expect(scheduler.getRunningCount()).toBe(0);
  });

  test('schedule(agent)이 잡을 등록한다', () => {
    scheduler.schedule(sampleAgent);
    expect(scheduler.getRunningCount()).toBe(1);
  });

  test('같은 agent를 두 번 schedule하면 1개만 유지한다 (중복 방지)', () => {
    scheduler.schedule(sampleAgent);
    scheduler.schedule(sampleAgent);
    expect(scheduler.getRunningCount()).toBe(1);
  });

  test('unschedule(agentId)로 잡을 제거한다', () => {
    scheduler.schedule(sampleAgent);
    scheduler.unschedule(sampleAgent.id);
    expect(scheduler.getRunningCount()).toBe(0);
  });

  test('stopAll()로 모든 잡이 제거된다', () => {
    const agent2 = { ...sampleAgent, id: 'agent-uuid-2', role: 'build' as const };
    scheduler.schedule(sampleAgent);
    scheduler.schedule(agent2);
    scheduler.stopAll();
    expect(scheduler.getRunningCount()).toBe(0);
  });

  test('is_active=false인 봇은 schedule해도 실행되지 않는다', () => {
    const inactiveAgent = { ...sampleAgent, is_active: false };
    scheduler.schedule(inactiveAgent);
    expect(scheduler.getRunningCount()).toBe(0);
  });

  test('triggerNow(agentId)를 호출하면 runner.run이 즉시 호출된다', async () => {
    mockRunner.run.mockResolvedValue({ status: 'completed', cost_usd: 0.01 });
    // budget check + chain trigger check
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: '0' }] }) // budget
      .mockResolvedValueOnce({ rows: [] }); // chain trigger

    scheduler.schedule(sampleAgent);
    await scheduler.triggerNow(sampleAgent.id);

    expect(mockRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({ id: sampleAgent.id }),
      undefined
    );
  });

  test('runner.run이 실패해도 스케줄러가 크래시하지 않는다 (격리)', async () => {
    mockRunner.run.mockRejectedValue(new Error('Claude CLI 오류'));
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: '0' }] }) // budget
      .mockResolvedValueOnce({ rows: [] }); // chain trigger (호출 안 될 수도 있음)

    scheduler.schedule(sampleAgent);
    await expect(scheduler.triggerNow(sampleAgent.id)).resolves.not.toThrow();
    expect(scheduler.getRunningCount()).toBe(1); // 여전히 스케줄 유지
  });

  test('budget 초과 시 triggerNow가 실행을 거부한다', async () => {
    // clearAllMocks 간섭 없는 완전 격리 mock 사용
    const localDb = {
      query: jest.fn().mockResolvedValue({ rows: [{ total_cost_usd: '15.00' }] }),
    };
    const localRunner = { run: jest.fn() };
    const localScheduler = new HeartbeatScheduler(localDb as any, localRunner as any);

    const tightBudgetAgent = { ...sampleAgent, budget_cents: 100 }; // $1 예산
    localScheduler.schedule(tightBudgetAgent);

    const result = await localScheduler.triggerNow(tightBudgetAgent.id);
    localScheduler.stopAll();

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('budget');
    expect(localRunner.run).not.toHaveBeenCalled();
  });
});
