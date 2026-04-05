/**
 * TDD: Research API — 통합 테스트 (supertest)
 */
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../../src/api/app';

const mockDb = {
  query: jest.fn(),
};

jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn(() => mockDb),
}));

// LLMProvider mock (AI 호출 없이 테스트)
jest.mock('../../../src/agents/llm-provider', () => ({
  LLMProvider: jest.fn().mockImplementation(() => ({
    complete: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        title: 'AI 분석 제목',
        summary: 'AI 요약',
        tags: ['tag1', 'tag2'],
        signal_score: 75,
      }),
      tokensInput: 100,
      tokensOutput: 200,
      costUsd: 0.001,
      model: 'claude-haiku-4-5-20251001',
    }),
  })),
}));

describe('Research API', () => {
  let app: Application;

  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    app = createApp({ db: mockDb as any, apiKey: 'test-internal-key' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const AUTH = { Authorization: 'Bearer test-internal-key' };

  describe('POST /api/research', () => {
    test('유효한 데이터로 리서치 항목 생성 → 201', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r-1',
          mission_id: 'm-1',
          source_type: 'manual',
          title: '테스트 항목',
          summary: null,
          content: null,
          tags: '[]',
          signal_score: 0,
          filter_decision: 'pending',
          next_action: null,
          converted_output: null,
          created_at: '2026-04-05 00:00:00',
        }],
      });

      const res = await request(app)
        .post('/api/research')
        .set(AUTH)
        .send({
          mission_id: 'm-1',
          source_type: 'manual',
          title: '테스트 항목',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe('테스트 항목');
    });

    test('title 없으면 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/research')
        .set(AUTH)
        .send({ mission_id: 'm-1', source_type: 'manual' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    test('mission_id 없으면 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/research')
        .set(AUTH)
        .send({ title: '테스트', source_type: 'manual' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/research', () => {
    test('mission_id로 목록 반환 → 200', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: 'r-1',
            mission_id: 'm-1',
            source_type: 'url',
            title: '아이템 1',
            tags: '["tag1"]',
            signal_score: 80,
            filter_decision: 'pending',
            created_at: '2026-04-05 00:00:00',
          },
          {
            id: 'r-2',
            mission_id: 'm-1',
            source_type: 'keyword',
            title: '아이템 2',
            tags: '[]',
            signal_score: 40,
            filter_decision: 'keep',
            created_at: '2026-04-05 00:00:01',
          },
        ],
      });

      const res = await request(app)
        .get('/api/research?mission_id=m-1')
        .set(AUTH);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      // tags should be parsed arrays
      expect(Array.isArray(res.body.data[0].tags)).toBe(true);
    });

    test('mission_id 없으면 400 Bad Request', async () => {
      const res = await request(app).get('/api/research').set(AUTH);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/research/collect', () => {
    test('URL 수집 → AI 분석 후 201 반환', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r-collect-1',
          mission_id: 'm-1',
          source_type: 'url',
          source_url: 'https://example.com',
          title: 'AI 분석 제목',
          summary: 'AI 요약',
          tags: '["tag1","tag2"]',
          signal_score: 75,
          filter_decision: 'pending',
          created_at: '2026-04-05 00:00:00',
        }],
      });

      const res = await request(app)
        .post('/api/research/collect')
        .set(AUTH)
        .send({
          mission_id: 'm-1',
          source_type: 'url',
          source_url: 'https://example.com',
          content: '테스트 콘텐츠 내용',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
    });

    test('mission_id 없으면 400', async () => {
      const res = await request(app)
        .post('/api/research/collect')
        .set(AUTH)
        .send({ source_type: 'url' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/research/:id/filter', () => {
    test('keep 결정으로 업데이트 → 200', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r-1',
          mission_id: 'm-1',
          title: '테스트',
          tags: '[]',
          filter_decision: 'keep',
          created_at: '2026-04-05 00:00:00',
        }],
      });

      const res = await request(app)
        .post('/api/research/r-1/filter')
        .set(AUTH)
        .send({ decision: 'keep' });

      expect(res.status).toBe(200);
      expect(res.body.data.filter_decision).toBe('keep');
    });

    test('drop 결정 → 200', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r-1',
          mission_id: 'm-1',
          title: '테스트',
          tags: '[]',
          filter_decision: 'drop',
          created_at: '2026-04-05 00:00:00',
        }],
      });

      const res = await request(app)
        .post('/api/research/r-1/filter')
        .set(AUTH)
        .send({ decision: 'drop' });

      expect(res.status).toBe(200);
    });

    test('잘못된 decision → 400', async () => {
      const res = await request(app)
        .post('/api/research/r-1/filter')
        .set(AUTH)
        .send({ decision: 'invalid' });

      expect(res.status).toBe(400);
    });

    test('존재하지 않는 id → 404', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/research/nonexistent/filter')
        .set(AUTH)
        .send({ decision: 'watch' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/research/:id', () => {
    test('삭제 → 204 No Content', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .delete('/api/research/r-1')
        .set(AUTH);

      expect(res.status).toBe(204);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.arrayContaining(['r-1'])
      );
    });
  });

  describe('인증', () => {
    test('Authorization 헤더 없으면 401', async () => {
      const res = await request(app).get('/api/research?mission_id=m-1');
      expect(res.status).toBe(401);
    });
  });
});
