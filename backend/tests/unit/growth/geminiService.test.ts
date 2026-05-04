/**
 * TDD: geminiService — Ideogram 이미지 + Veo 영상 생성
 * v5.2.0
 *
 * API 키 미설정 시 stub 반환, 설정 시 실제 API 호출 동작 검증
 */

// fetch mock
const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

// readSettings mock
jest.mock('../../../src/config', () => ({
  readSettings: jest.fn(),
}))

import { readSettings } from '../../../src/config'
import { generateImage, generateVideo, isImageConfigured, isVideoConfigured, isGeminiConfigured } from '../../../src/services/geminiService'

const mockedReadSettings = readSettings as jest.MockedFunction<typeof readSettings>

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockReset()
})

// ── isConfigured 함수들 ───────────────────────────────────────────────────────

describe('isImageConfigured()', () => {
  test('ideogram_api_key 없으면 false', () => {
    mockedReadSettings.mockReturnValue({} as ReturnType<typeof readSettings>)
    expect(isImageConfigured()).toBe(false)
  })

  test('ideogram_api_key 있으면 true', () => {
    mockedReadSettings.mockReturnValue({ ideogram_api_key: 'test-key' } as ReturnType<typeof readSettings>)
    expect(isImageConfigured()).toBe(true)
  })
})

describe('isVideoConfigured()', () => {
  test('gemini_api_key 없으면 false', () => {
    mockedReadSettings.mockReturnValue({} as ReturnType<typeof readSettings>)
    expect(isVideoConfigured()).toBe(false)
  })

  test('gemini_api_key 있으면 true', () => {
    mockedReadSettings.mockReturnValue({ gemini_api_key: 'AIza-test' } as ReturnType<typeof readSettings>)
    expect(isVideoConfigured()).toBe(true)
  })
})

describe('isGeminiConfigured()', () => {
  test('둘 다 없으면 false', () => {
    mockedReadSettings.mockReturnValue({} as ReturnType<typeof readSettings>)
    expect(isGeminiConfigured()).toBe(false)
  })

  test('ideogram만 있어도 true', () => {
    mockedReadSettings.mockReturnValue({ ideogram_api_key: 'key' } as ReturnType<typeof readSettings>)
    expect(isGeminiConfigured()).toBe(true)
  })

  test('gemini만 있어도 true', () => {
    mockedReadSettings.mockReturnValue({ gemini_api_key: 'AIza' } as ReturnType<typeof readSettings>)
    expect(isGeminiConfigured()).toBe(true)
  })
})

// ── generateImage (Ideogram) ──────────────────────────────────────────────────

describe('generateImage()', () => {
  test('ideogram_api_key 미설정 시 __STUB_IMAGE__ 반환', async () => {
    mockedReadSettings.mockReturnValue({} as ReturnType<typeof readSettings>)
    const result = await generateImage('test prompt', 'instagram')
    expect(result).toMatch(/^__STUB_IMAGE__:/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('API 호출 시 Ideogram 엔드포인트로 요청', async () => {
    mockedReadSettings.mockReturnValue({ ideogram_api_key: 'test-ideogram-key' } as ReturnType<typeof readSettings>)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://ideogram.ai/generated/img1.jpg' }] }),
    } as Response)

    const result = await generateImage('product photo', 'instagram')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.ideogram.ai/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Api-Key': 'test-ideogram-key' }),
      }),
    )
    expect(result).toBe('https://ideogram.ai/generated/img1.jpg')
  })

  test('채널별 올바른 aspect_ratio 사용', async () => {
    mockedReadSettings.mockReturnValue({ ideogram_api_key: 'key' } as ReturnType<typeof readSettings>)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://img.test/1.jpg' }] }),
    } as Response)

    await generateImage('test', 'youtube')
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      image_request: { aspect_ratio: string }
    }
    expect(body.image_request.aspect_ratio).toBe('ASPECT_16_9')

    mockFetch.mockClear()
    await generateImage('test', 'tiktok')
    const body2 = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      image_request: { aspect_ratio: string }
    }
    expect(body2.image_request.aspect_ratio).toBe('ASPECT_9_16')
  })

  test('API 오류 시 예외 발생', async () => {
    mockedReadSettings.mockReturnValue({ ideogram_api_key: 'key' } as ReturnType<typeof readSettings>)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response)

    await expect(generateImage('test', 'instagram')).rejects.toThrow('Ideogram 이미지 생성 실패')
  })
})

// ── generateVideo (Veo) ───────────────────────────────────────────────────────

describe('generateVideo()', () => {
  test('gemini_api_key 미설정 시 __STUB_VIDEO__ 반환', async () => {
    mockedReadSettings.mockReturnValue({} as ReturnType<typeof readSettings>)
    const result = await generateVideo('30-second ad', '9:16')
    expect(result).toMatch(/^__STUB_VIDEO__:/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('API 호출 시 Veo 엔드포인트로 요청', async () => {
    mockedReadSettings.mockReturnValue({ gemini_api_key: 'AIza-test' } as ReturnType<typeof readSettings>)
    // First call: start operation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'operations/test-op-123' }),
    } as Response)
    // Second call: poll - done
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        done: true,
        response: { predictions: [{ video: { uri: 'https://veo.googleapis.com/v1/video.mp4' } }] },
      }),
    } as Response)

    const result = await generateVideo('short video script', '9:16')
    expect(mockFetch.mock.calls[0][0]).toContain('veo-2.0-generate-001:predictLongRunning')
    expect(result).toBe('https://veo.googleapis.com/v1/video.mp4')
  })
})
