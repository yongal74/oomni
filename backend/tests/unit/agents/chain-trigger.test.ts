/**
 * TDD: Chain Trigger — 봇 간 자동 협업
 * Research Bot 완료 → Content Bot 자동 wake
 */
import { HeartbeatScheduler } from '../../../src/agents/heartbeat';
import type { Agent } from '../../../src/db/types';

const mockDb = { query: jest.fn() };
const mockRunner = { run: jest.fn() };

const makeAgent = (id: string, role: Agent['role']): Agent => ({
  id,
  mission_id: 'mission-1',
  name: `${role} Bot`,
  role,
  schedule: 'manual',
  system_prompt: '',
  budget_cents: 10000,
  is_active: true,
  reports_to: null,
  created_at: '2026-04-04T00:00:00.000Z',
});

describe('HeartbeatScheduler — Chain Trigger', () => {
  let scheduler: HeartbeatScheduler;
  const researchAgent = makeAgent('agent-research', 'research');
  const contentAgent = makeAgent('agent-content', 'content');

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new HeartbeatScheduler(mockDb as any, mockRunner as any);
  });

  afterEach(() => scheduler.stopAll());

  test('봇 실행 완료 후 chain trigger 쿼리가 실행된다', async () => {
    mockRunner.run.mockResolvedValue({ runId: 'run-1', status: 'completed' });
    mockDb.query
      // budget check
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: '0' }] })
      // chain trigger 조회 — Research 완료 시 Content 연결됨
      .mockResolvedValueOnce({
        rows: [{ id: 'schedule-1', agent_id: contentAgent.id }],
      })
      // last_run_at 업데이트
      .mockResolvedValueOnce({ rows: [] })
      // content bot 조회 (triggerNow에서 DB로 조회)
      .mockResolvedValueOnce({ rows: [contentAgent] })
      // content bot budget check
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: '0' }] })
      // content chain trigger (없음)
      .mockResolvedValueOnce({ rows: [] });

    mockRunner.run.mockResolvedValue({ runId: 'run-x', status: 'completed' });

    scheduler.schedule(researchAgent);
    await scheduler.triggerNow(researchAgent.id);

    // chain trigger 조회 쿼리가 호출됐는지 확인
    const chainQuery = mockDb.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('bot_complete')
    );
    expect(chainQuery).toBeDefined();
  });

  test('chain schedule이 없으면 추가 실행이 없다', async () => {
    mockRunner.run.mockResolvedValue({ runId: 'run-1', status: 'completed' });
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: '0' }] }) // budget
      .mockResolvedValueOnce({ rows: [] }); // chain = 없음

    scheduler.schedule(researchAgent);
    await scheduler.triggerNow(researchAgent.id);

    // runner.run은 1번만 호출됨 (research bot만)
    expect(mockRunner.run).toHaveBeenCalledTimes(1);
  });

  test('chain trigger 실행 실패해도 메인 결과가 반환된다', async () => {
    mockRunner.run.mockResolvedValue({ runId: 'run-1', status: 'completed' });
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: '0' }] })
      .mockRejectedValueOnce(new Error('DB 오류')); // chain trigger 조회 실패

    scheduler.schedule(researchAgent);
    const result = await scheduler.triggerNow(researchAgent.id);

    // 메인 실행은 성공 반환
    expect(result.skipped).toBe(false);
  });

  test('스케줄에 없는 봇도 DB 조회로 triggerNow 실행 가능', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [contentAgent] }) // agent 조회
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: '0' }] }) // budget
      .mockResolvedValueOnce({ rows: [] }); // chain trigger

    mockRunner.run.mockResolvedValue({ runId: 'run-2', status: 'completed' });

    // contentAgent는 scheduler.schedule() 안 했음
    const result = await scheduler.triggerNow(contentAgent.id);
    expect(result.skipped).toBe(false);
    expect(mockRunner.run).toHaveBeenCalledTimes(1);
  });

  test('스케줄에 없고 DB에도 없는 봇 → skipped', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await scheduler.triggerNow('non-existent-agent');
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('등록되지 않은');
  });
});
