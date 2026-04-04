/**
 * TDD: Reports API — 통합 테스트
 * 응답 구조: { period, generated_at, summary: { total_cost_usd, runs_completed, runs_failed, top_agents, feed_highlights } }
 */
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../../src/api/app';

const mockDb = { query: jest.fn() };

describe('Reports API', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp({ db: mockDb as any, apiKey: 'test-key' });
  });

  beforeEach(() => jest.clearAllMocks());

  const AUTH = { Authorization: 'Bearer test-key' };

  // agents 조회 → [] 반환 시 빈 리포트 반환
  const mockEmptyAgents = () => {
    mockDb.query.mockResolvedValue({ rows: [] });
  };

  // agents 있을 때 full mock
  const mockFullReport = () => {
    mockDb.query
      // 1. agent 목록 조회
      .mockResolvedValueOnce({ rows: [{ id: 'a-1' }] })
      // 2. 총 비용 집계
      .mockResolvedValueOnce({ rows: [{ total_cost_usd: 1.5 }] })
      // 3. runs 집계
      .mockResolvedValueOnce({ rows: [{ runs_completed: 10, runs_failed: 2 }] })
      // 4. top_agents
      .mockResolvedValueOnce({ rows: [{ agent_id: 'a-1', agent_name: 'Research Bot', total_cost_usd: 0.8, run_count: 5 }] })
      // 5. feed_highlights
      .mockResolvedValueOnce({ rows: [{ id: 'f-1', agent_id: 'a-1', agent_name: 'Research Bot', type: 'result', content: '완료', created_at: '2026-04-04T00:00:00Z' }] });
  };

  describe('GET /api/reports', () => {
    test('200 OK — daily 리포트 반환 (에이전트 없는 경우)', async () => {
      mockEmptyAgents();
      const res = await request(app).get('/api/reports?mission_id=m-1&period=daily').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('period', 'daily');
      expect(res.body).toHaveProperty('summary');
    });

    test('200 OK — 에이전트 있을 때 전체 집계', async () => {
      mockFullReport();
      const res = await request(app).get('/api/reports?mission_id=m-1&period=daily').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.summary.total_cost_usd).toBe(1.5);
      expect(res.body.summary.runs_completed).toBe(10);
      expect(res.body.summary.runs_failed).toBe(2);
    });

    test('200 OK — weekly 리포트', async () => {
      mockEmptyAgents();
      const res = await request(app).get('/api/reports?mission_id=m-1&period=weekly').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('weekly');
    });

    test('200 OK — monthly 리포트', async () => {
      mockEmptyAgents();
      const res = await request(app).get('/api/reports?mission_id=m-1&period=monthly').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('monthly');
    });

    test('400 — mission_id 없으면 오류', async () => {
      const res = await request(app).get('/api/reports?period=daily').set(AUTH);
      expect(res.status).toBe(400);
    });

    test('400 — 유효하지 않은 period', async () => {
      const res = await request(app).get('/api/reports?mission_id=m-1&period=yearly').set(AUTH);
      expect(res.status).toBe(400);
    });

    test('top_agents 배열 포함', async () => {
      mockFullReport();
      const res = await request(app).get('/api/reports?mission_id=m-1&period=daily').set(AUTH);
      expect(Array.isArray(res.body.summary.top_agents)).toBe(true);
      expect(res.body.summary.top_agents[0]).toHaveProperty('agent_name');
    });

    test('feed_highlights 배열 포함', async () => {
      mockFullReport();
      const res = await request(app).get('/api/reports?mission_id=m-1&period=daily').set(AUTH);
      expect(Array.isArray(res.body.summary.feed_highlights)).toBe(true);
    });

    test('generated_at ISO 날짜 포함', async () => {
      mockEmptyAgents();
      const res = await request(app).get('/api/reports?mission_id=m-1').set(AUTH);
      expect(res.body).toHaveProperty('generated_at');
      expect(new Date(res.body.generated_at).getTime()).not.toBeNaN();
    });
  });
});
