/**
 * TDD: Schedules API — 통합 테스트
 */
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../../src/api/app';

const mockDb = { query: jest.fn() };

describe('Schedules API', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp({ db: mockDb as any, apiKey: 'test-key' });
  });

  beforeEach(() => jest.clearAllMocks());

  const AUTH = { Authorization: 'Bearer test-key' };

  describe('GET /api/schedules', () => {
    test('200 OK + 스케줄 목록 반환', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 's-1', name: 'Research→Content', trigger_type: 'bot_complete', is_active: true },
        ],
      });
      const res = await request(app).get('/api/schedules').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('agent_id 필터 적용', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await request(app).get('/api/schedules?agent_id=a-1').set(AUTH);
      expect(mockDb.query.mock.calls[0][1]).toContain('a-1');
    });
  });

  describe('POST /api/schedules', () => {
    test('201 Created — bot_complete 트리거 생성', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 's-new', trigger_type: 'bot_complete', trigger_value: 'agent-1' }],
      });
      const res = await request(app).post('/api/schedules').set(AUTH).send({
        agent_id: 'agent-2',
        mission_id: 'm-1',
        name: 'Research 완료 후 Content 실행',
        trigger_type: 'bot_complete',
        trigger_value: 'agent-1',
      });
      expect(res.status).toBe(201);
    });

    test('201 — trigger_type 없으면 interval 기본값으로 생성', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 's-new', trigger_type: 'interval', trigger_value: 'agent-1' }],
      });
      const res = await request(app).post('/api/schedules').set(AUTH).send({
        agent_id: 'agent-2',
        mission_id: 'm-1',
        name: '테스트',
        trigger_value: 'agent-1',
        // trigger_type 없어도 됨 — 기본값 'interval'
      });
      expect(res.status).toBe(201);
    });

    test('400 — 유효하지 않은 trigger_type', async () => {
      const res = await request(app).post('/api/schedules').set(AUTH).send({
        agent_id: 'agent-2',
        mission_id: 'm-1',
        name: '테스트',
        trigger_type: 'magic', // 허용 안 됨
        trigger_value: 'x',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/schedules/:id', () => {
    test('200 — is_active 토글', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's-1', is_active: false }] });
      const res = await request(app).patch('/api/schedules/s-1').set(AUTH).send({ is_active: false });
      expect(res.status).toBe(200);
    });

    test('404 — 존재하지 않는 스케줄', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const res = await request(app).patch('/api/schedules/not-exist').set(AUTH).send({ is_active: true });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/schedules/:id', () => {
    test('204 No Content', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const res = await request(app).delete('/api/schedules/s-1').set(AUTH);
      expect(res.status).toBe(204);
    });
  });
});
