/**
 * TDD: Webhooks API — 통합 테스트
 * POST /webhooks/:key?api_key=... → 202 Accepted
 */
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../../src/api/app';

const mockDb = { query: jest.fn() };
const mockTriggerAgent = jest.fn();

describe('Webhooks API', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp({
      db: mockDb as any,
      apiKey: 'test-key',
      triggerAgent: mockTriggerAgent,
    });
  });

  beforeEach(() => jest.clearAllMocks());

  describe('POST /webhooks/:key', () => {
    test('202 Accepted — 유효한 api_key로 봇 트리거 성공', async () => {
      // schedule 없어도 동작 (optional 검증)
      mockDb.query.mockResolvedValue({ rows: [] });
      mockTriggerAgent.mockResolvedValue({ skipped: false });

      const res = await request(app)
        .post('/webhooks/my-key?api_key=test-key')
        .send({ agent_id: 'agent-1' });

      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('agentId', 'agent-1');
    });

    test('401 — api_key 없으면 인증 거부', async () => {
      const res = await request(app).post('/webhooks/my-key').send({ agent_id: 'agent-1' });
      expect(res.status).toBe(401);
    });

    test('401 — api_key 틀리면 인증 거부', async () => {
      const res = await request(app)
        .post('/webhooks/my-key?api_key=wrong-key')
        .send({ agent_id: 'agent-1' });
      expect(res.status).toBe(401);
    });

    test('400 — agent_id 누락', async () => {
      const res = await request(app)
        .post('/webhooks/my-key?api_key=test-key')
        .send({});
      expect(res.status).toBe(400);
    });

    test('triggerAgent가 agent_id로 호출된다', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      mockTriggerAgent.mockResolvedValue({ skipped: false });

      await request(app)
        .post('/webhooks/my-key?api_key=test-key')
        .send({ agent_id: 'agent-1' });

      expect(mockTriggerAgent).toHaveBeenCalledWith('agent-1', undefined);
    });

    test('task 파라미터가 triggerAgent에 전달된다', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      mockTriggerAgent.mockResolvedValue({ skipped: false });

      await request(app)
        .post('/webhooks/my-key?api_key=test-key')
        .send({ agent_id: 'agent-1', task: '결제 완료 처리' });

      expect(mockTriggerAgent).toHaveBeenCalledWith('agent-1', '결제 완료 처리');
    });

    test('skipped=true이면 202 + skipped 응답', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      mockTriggerAgent.mockResolvedValue({ skipped: true });

      const res = await request(app)
        .post('/webhooks/my-key?api_key=test-key')
        .send({ agent_id: 'agent-1' });

      expect(res.status).toBe(202);
      expect(res.body.skipped).toBe(true);
    });

    test('webhook key가 schedule에 있으면 last_run_at 업데이트', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 's-1', agent_id: 'agent-1' }] }) // schedule 조회
        .mockResolvedValueOnce({ rows: [] }); // last_run_at 업데이트
      mockTriggerAgent.mockResolvedValue({ skipped: false });

      await request(app)
        .post('/webhooks/registered-key?api_key=test-key')
        .send({ agent_id: 'agent-1' });

      // last_run_at update 쿼리가 호출됐는지 확인
      const updateCall = mockDb.query.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('last_run_at')
      );
      expect(updateCall).toBeDefined();
    });
  });
});
