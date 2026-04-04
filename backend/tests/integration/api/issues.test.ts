/**
 * TDD: Issues API — 통합 테스트
 */
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../../src/api/app';

const mockDb = { query: jest.fn() };

describe('Issues API', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp({ db: mockDb as any, apiKey: 'test-key' });
  });

  beforeEach(() => jest.clearAllMocks());

  const AUTH = { Authorization: 'Bearer test-key' };

  describe('GET /api/issues', () => {
    test('200 OK + 이슈 목록 반환', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'i-1', title: '버그 수정', status: 'open', priority: 'high' },
        ],
      });
      const res = await request(app).get('/api/issues').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    test('mission_id 필터 쿼리에 반영', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await request(app).get('/api/issues?mission_id=m-1').set(AUTH);
      expect(mockDb.query.mock.calls[0][1]).toContain('m-1');
    });

    test('status 필터 적용', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await request(app).get('/api/issues?status=open').set(AUTH);
      expect(mockDb.query.mock.calls[0][1]).toContain('open');
    });
  });

  describe('POST /api/issues', () => {
    test('201 Created — 유효한 이슈 생성', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'i-new', title: '신규 기능', status: 'open', priority: 'medium' }],
      });
      const res = await request(app).post('/api/issues').set(AUTH).send({
        mission_id: 'm-1',
        title: '신규 기능',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('신규 기능');
    });

    test('400 — title 없으면 오류', async () => {
      const res = await request(app).post('/api/issues').set(AUTH).send({
        mission_id: 'm-1',
      });
      expect(res.status).toBe(400);
    });

    test('400 — mission_id 없으면 오류', async () => {
      const res = await request(app).post('/api/issues').set(AUTH).send({
        title: '테스트',
      });
      expect(res.status).toBe(400);
    });

    test('400 — 유효하지 않은 priority', async () => {
      const res = await request(app).post('/api/issues').set(AUTH).send({
        mission_id: 'm-1',
        title: '테스트',
        priority: 'critical', // 허용 안 됨
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/issues/:id', () => {
    test('200 — status 변경', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'i-1', status: 'done' }],
      });
      const res = await request(app).patch('/api/issues/i-1').set(AUTH).send({ status: 'done' });
      expect(res.status).toBe(200);
    });

    test('400 — 변경할 필드 없으면 오류', async () => {
      const res = await request(app).patch('/api/issues/i-1').set(AUTH).send({});
      expect(res.status).toBe(400);
    });

    test('404 — 존재하지 않는 이슈', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const res = await request(app).patch('/api/issues/not-exist').set(AUTH).send({ status: 'done' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/issues/:id', () => {
    test('204 No Content — 삭제 성공', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const res = await request(app).delete('/api/issues/i-1').set(AUTH);
      expect(res.status).toBe(204);
    });
  });

  describe('보안', () => {
    test('인증 없으면 401', async () => {
      const res = await request(app).get('/api/issues');
      expect(res.status).toBe(401);
    });
  });
});
