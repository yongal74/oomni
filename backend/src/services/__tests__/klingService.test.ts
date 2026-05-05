/**
 * klingService 단위 테스트
 * - 실제 API 호출 없음 (fetch 목킹)
 * - 파일시스템: 실제 tempdir 사용 후 정리
 */
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// fetch 전역 목
const mockFetch = jest.fn();
global.fetch = mockFetch;

// readSettings 목
jest.mock('../../config', () => ({
  readSettings: () => ({ kling_api_key: 'key_id:key_secret' }),
}));

// logger 목
jest.mock('../../logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

// Anthropic 목
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '["Scene 1","Scene 2"]' }],
      }),
    },
  })),
}));

// ffmpeg-static 목
jest.mock('ffmpeg-static', () => '/usr/bin/ffmpeg', { virtual: true });

// child_process.spawn 목
jest.mock('child_process', () => ({
  spawn: jest.fn().mockImplementation(() => {
    const EventEmitter = require('events');
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();
    process.nextTick(() => proc.emit('close', 0));
    return proc;
  }),
}));

// VIDEOS_DIR를 temp로 오버라이드
const TEMP_DIR = path.join(os.tmpdir(), `kling-test-${Date.now()}`);
jest.mock('../klingService', () => {
  const original = jest.requireActual('../klingService');
  return { ...original, VIDEOS_DIR: TEMP_DIR };
});

describe('klingService', () => {
  beforeAll(() => { if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true }); });
  afterAll(() => { try { fs.rmdirSync(TEMP_DIR, { recursive: true }); } catch {} });

  afterEach(() => mockFetch.mockReset());

  // ── JWT 생성 ────────────────────────────────────────────────────────────
  describe('JWT (getToken via kling_api_key)', () => {
    test('"id:secret" 형식에서 HS256 JWT 반환', async () => {
      const { generateVideoKling } = await import('../klingService');

      // stub: 즉시 stub 반환 (no API key 경로가 아닌 실제 JWT 경로 테스트)
      // generateVideoKling이 isKlingConfigured=true이므로 klingFetch 호출
      // 여기서는 첫 번째 fetch가 401 반환하도록 설정
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });

      await expect(generateVideoKling('test prompt', '9:16', '5')).rejects.toThrow();

      // fetch가 호출됐고 Authorization 헤더에 Bearer JWT가 있는지 확인
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers?.Authorization).toMatch(/^Bearer eyJ/);
    });

    test('"id:secret:extra" — extra 포함해서 secret으로 사용', async () => {
      jest.resetModules();
      jest.doMock('../../config', () => ({
        readSettings: () => ({ kling_api_key: 'myid:part1:part2' }),
      }));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => '' });
      const { generateVideoKling: gv } = await import('../klingService');
      await gv('test', '9:16', '5').catch(() => {});
      const auth = (mockFetch.mock.calls[0][1]?.headers as Record<string, string>)?.Authorization ?? '';
      // JWT가 있어야 함 (secret에 콜론 포함해도 동작)
      expect(auth).toMatch(/^Bearer eyJ/);
    });
  });

  // ── 폴링 타임아웃 ──────────────────────────────────────────────────────
  describe('generateSingleClip 폴링', () => {
    beforeEach(() => {
      // 작업 생성 응답
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, data: { task_id: 'task-abc' } }),
      });
    });

    test('항상 processing → 타임아웃 에러', async () => {
      jest.useFakeTimers();
      // 모든 폴링 응답 = processing
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { task_status: 'processing' } }),
      });

      const { generateVideoKling } = await import('../klingService');

      // catch를 즉시 붙여 unhandled-rejection 경고 방지
      let caught: unknown;
      const done = generateVideoKling('test', '9:16', '5').catch(e => { caught = e; });

      // 타이머 전진 (300초 × 1.1)
      await jest.advanceTimersByTimeAsync(330_000);
      jest.useRealTimers();
      await done;

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain('타임아웃');
    }, 10_000);

    test('failed 상태 → 즉시 에러', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { task_status: 'failed', task_status_msg: '크레딧 부족' },
        }),
      });

      const { generateVideoKling } = await import('../klingService');
      await expect(generateVideoKling('test', '9:16', '5'))
        .rejects.toThrow('크레딧 부족');
    });
  });

  // ── SSRF 방어 ──────────────────────────────────────────────────────────
  describe('SSRF 방어 (downloadToFile)', () => {
    test('내부 IP URL 다운로드 거부', async () => {
      // klingFetch 응답 = succeed with internal IP
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ code: 0, data: { task_id: 't1' } }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://192.168.1.1/evil.mp4' }] } },
          }),
        });

      const { generateVideoKling } = await import('../klingService');
      await expect(generateVideoKling('test', '9:16', '5'))
        .rejects.toThrow('허용되지 않는 다운로드 도메인');
    });
  });
});
