/**
 * geminiService.ts — AI 이미지(Ideogram) + 영상(Veo 3.1) 생성
 * v5.2.0
 *
 * 이미지: Ideogram v2 API (ideogram_api_key)
 * 영상:   Google Veo 3.1 Lite (gemini_api_key)
 */
import { readSettings } from '../config'
import { logger } from '../logger'

// 채널별 Ideogram 종횡비
const IDEOGRAM_ASPECT: Record<string, string> = {
  youtube:    'ASPECT_16_9',
  tiktok:     'ASPECT_9_16',
  instagram:  'ASPECT_1_1',
  x:          'ASPECT_1_1',
  naver_blog: 'ASPECT_4_3',
  linkedin:   'ASPECT_4_3',
  blog:       'ASPECT_4_3',
}

/**
 * Ideogram v2 API로 마케팅 이미지 생성
 * 반환: Ideogram CDN 공개 URL
 */
export async function generateImage(prompt: string, channel: string): Promise<string> {
  const settings = readSettings() as Record<string, string | undefined>
  const apiKey = settings['ideogram_api_key']

  if (!apiKey) {
    logger.warn('[geminiService] ideogram_api_key 미설정 — stub 반환')
    return `__STUB_IMAGE__:${Buffer.from(prompt.slice(0, 50)).toString('base64')}`
  }

  const aspectRatio = IDEOGRAM_ASPECT[channel] ?? 'ASPECT_1_1'

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio: aspectRatio,
        model: 'V_2',
        magic_prompt_option: 'AUTO',
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Ideogram 이미지 생성 실패 (${res.status}): ${await res.text()}`)
  }

  const data = await res.json() as { data?: Array<{ url: string }> }
  const url = data.data?.[0]?.url
  if (!url) throw new Error('Ideogram: 이미지 URL 없음')

  logger.info(`[geminiService] Ideogram 이미지 완료 channel=${channel}`)
  return url
}

/**
 * Google Veo 3.1 Lite API로 숏폼 영상 생성
 * 반환: Veo CDN URI
 */
export async function generateVideo(script: string, aspectRatio: string): Promise<string> {
  const settings = readSettings() as Record<string, string | undefined>
  const apiKey = settings['gemini_api_key']

  if (!apiKey) {
    logger.warn('[geminiService] gemini_api_key 미설정 — stub 반환')
    return `__STUB_VIDEO__:${Buffer.from(script.slice(0, 50)).toString('base64')}`
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{
          prompt: script,
          parameters: {
            aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
            sampleCount: 1,
            durationSeconds: 8,
          },
        }],
      }),
    },
  )

  if (!res.ok) throw new Error(`Veo API 오류 (${res.status}): ${await res.text()}`)

  const op = await res.json() as { name?: string }
  if (!op.name) throw new Error('Veo: 작업 ID 없음')

  // 완료까지 최대 120초 폴링 (5초 간격)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${op.name}?key=${apiKey}`,
    )
    const pollData = await pollRes.json() as {
      done?: boolean
      response?: { predictions?: Array<{ video?: { uri: string } }> }
    }
    if (pollData.done) {
      const videoUri = pollData.response?.predictions?.[0]?.video?.uri
      if (!videoUri) throw new Error('Veo: 영상 URI 없음')
      logger.info('[geminiService] Veo 영상 완료')
      return videoUri
    }
  }
  throw new Error('Veo: 타임아웃 (120초)')
}

/** Ideogram 이미지 생성 가능 여부 */
export function isImageConfigured(): boolean {
  const s = readSettings() as Record<string, string | undefined>
  return !!(s['ideogram_api_key'])
}

/** Veo 영상 생성 가능 여부 */
export function isVideoConfigured(): boolean {
  const s = readSettings() as Record<string, string | undefined>
  return !!(s['gemini_api_key'])
}

/** 둘 중 하나라도 설정 시 true (기존 API 호환) */
export function isGeminiConfigured(): boolean {
  return isImageConfigured() || isVideoConfigured()
}
