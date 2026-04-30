/**
 * TDD: Agents API — 통합 테스트 (supertest)
 * 실제 Express 앱 + 메모리 DB mock
 */
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../../src/api/app';

// DB를 mock해서 실제 postgres 없이 API 동작 검증
const mockDb = {
  query: jest.fn(),
};

jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn(() => mockDb),
}));

describe('Agents API', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp({ db: mockDb as any, apiKey: 'test-internal-key' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    test('200 OK + 봇 목록 반환', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: '1', name: 'Research Bot', role: 'research', is_active: true },
          { id: '2', name: 'Build Bot', role: 'build', is_active: true },
        ]
      });

      const res = await request(app).get('/api/agents').set('Authorization', 'Bearer test-internal-key');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    test('mission_id 쿼리 파라미터로 필터링된다', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const res = await request(app).get('/api/agents?mission_id=m-1').set('Authorization', 'Bearer test-internal-key');
      expect(res.status).toBe(200);
      // SQL에 mission_id가 포함되어야 함
      expect(mockDb.query.mock.calls[0][1]).toContain('m-1');
    });
  });

  describe('POST /api/agents', () => {
    test('유효한 데이터로 봇 생성 → 201', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'new-id', name: 'Content Bot', role: 'content' }]
      });

      const res = await request(app).post('/api/agents').set('Authorization', 'Bearer test-internal-key').send({
        mission_id: 'm-1',
        name: 'Content Bot',
        role: 'content',
        schedule: 'daily',
        system_prompt: '너는 콘텐츠 봇이다',
        budget_cents: 2000,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Content Bot');
    });

    test('role이 없으면 400 Bad Request', async () => {
      const res = await request(app).post('/api/agents').set('Authorization', 'Bearer test-internal-key').send({
        mission_id: 'm-1',
        name: 'Bad Bot',
        // role 누락
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    test('유효하지 않은 role이면 400', async () => {
      const res = await request(app).post('/api/agents').set('Authorization', 'Bearer test-internal-key').send({
        mission_id: 'm-1',
        name: 'Bad Bot',
        role: 'hacker', // 허용되지 않는 role
      });
      expect(res.status).toBe(400);
    });

    test('budget_cents가 음수이면 400', async () => {
      const res = await request(app).post('/api/agents').set('Authorization', 'Bearer test-internal-key').send({
        mission_id: 'm-1',
        name: 'Bot',
        role: 'research',
        budget_cents: -100,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/agents/:id/trigger', () => {
    test('존재하는 봇 trigger → 202 Accepted', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'agent-1', name: 'Research Bot', role: 'research', is_active: true, budget_cents: 5000 }]
      });

      const res = await request(app).post('/api/agents/agent-1/trigger').set('Authorization', 'Bearer test-internal-key').send({});
      expect(res.status).toBe(202);
      expect(res.body.message).toBeTruthy();
    });

    test('비활성 봇 trigger → 409', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'agent-1', is_active: false }]
      });

      const res = await request(app).post('/api/agents/agent-1/trigger').set('Authorization', 'Bearer test-internal-key').send({});
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/agents/:id/design-outputs', () => {
    test('Design Bot 저장된 출력 목록 반환 → 200', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'out-1', agent_id: 'agent-1', mission_id: 'm-1', title: '랜딩 페이지', created_at: '2026-01-01T00:00:00Z' },
        ]
      });

      const res = await request(app)
        .get('/api/agents/agent-1/design-outputs')
        .set('Authorization', 'Bearer test-internal-key');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('랜딩 페이지');
      // html_content는 목록에서 제외 (성능)
      expect(res.body.data[0].html_content).toBeUndefined();
    });

    test('결과 없으면 빈 배열 반환', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get('/api/agents/agent-x/design-outputs')
        .set('Authorization', 'Bearer test-internal-key');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/agents/:id/design-outputs/:outputId', () => {
    test('특정 출력 상세 조회 (html_content 포함) → 200', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'out-1', agent_id: 'agent-1', html_content: '<html>...</html>', title: '랜딩', created_at: '2026-01-01' }]
      });

      const res = await request(app)
        .get('/api/agents/agent-1/design-outputs/out-1')
        .set('Authorization', 'Bearer test-internal-key');

      expect(res.status).toBe(200);
      expect(res.body.data.html_content).toBe('<html>...</html>');
    });

    test('존재하지 않는 outputId → 404', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get('/api/agents/agent-1/design-outputs/not-exist')
        .set('Authorization', 'Bearer test-internal-key');

      expect(res.status).toBe(404);
    });
  });

  describe('보안 헤더', () => {
    test('응답에 X-Content-Type-Options 헤더가 있다', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const res = await request(app).get('/api/agents').set('Authorization', 'Bearer test-internal-key');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('응답에 X-Frame-Options 헤더가 있다', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const res = await request(app).get('/api/agents').set('Authorization', 'Bearer test-internal-key');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
});
