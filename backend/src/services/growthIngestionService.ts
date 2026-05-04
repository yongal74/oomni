/**
 * growthIngestionService.ts — URL 크롤링 + 상품 정보 추출
 * v5.2.0
 *
 * URL → 상품명, 가격, 이미지, 설명, 카테고리, 키워드 추출
 * 지원: 스마트스토어, 쿠팡, 카페24, 아임웹, 일반 웹페이지
 * 실패 시: 상품명 + 이미지 업로드 fallback
 */
import Anthropic from '@anthropic-ai/sdk'
import { readSettings } from '../config'
import { logger } from '../logger'

export interface ProductInfo {
  name: string
  price: string | null
  description: string
  imageUrls: string[]
  category: string | null
  keywords: string[]
  url: string
  platform: string
}

// 플랫폼별 메타 태그 선택자 힌트
const PLATFORM_HINTS: Record<string, string> = {
  'smartstore.naver.com': 'naver_smartstore',
  'coupang.com':          'coupang',
  'cafe24.com':           'cafe24',
  'imweb.me':             'imweb',
  'domeggook.com':        'domeggook',
  'domae.co.kr':          'domaemail',
}

function detectPlatform(url: string): string {
  for (const [domain, name] of Object.entries(PLATFORM_HINTS)) {
    if (url.includes(domain)) return name
  }
  return 'general'
}

/**
 * URL에서 HTML을 가져와 Claude로 상품 정보 추출
 * 응답시간 목표: 15초 이내
 */
export async function ingestUrl(url: string): Promise<ProductInfo> {
  const platform = detectPlatform(url)
  logger.info(`[growthIngestion] platform=${platform} url=${url}`)

  // HTML 크롤링
  let html = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    })
    clearTimeout(timeout)
    html = await res.text()
  } catch (e) {
    throw new Error(`URL 크롤링 실패: ${e instanceof Error ? e.message : String(e)}`)
  }

  // HTML에서 핵심 텍스트만 추출 (크기 제한)
  const cleanedHtml = extractRelevantHtml(html)

  // Claude로 구조화된 상품 정보 추출
  const settings = readSettings()
  const apiKey = settings.anthropic_api_key
  if (!apiKey) throw new Error('Anthropic API 키 없음')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // 빠른 추출용 haiku
    max_tokens: 1024,
    system: `당신은 웹페이지에서 상품 정보를 추출하는 전문가입니다.
주어진 HTML에서 상품 정보를 추출하여 반드시 아래 JSON 형식으로만 응답하세요.
JSON 외 다른 텍스트는 절대 포함하지 마세요.`,
    messages: [{
      role: 'user',
      content: `다음 HTML에서 상품 정보를 추출하세요:\n\n${cleanedHtml}\n\n출력 형식:\n{"name":"상품명","price":"가격(없으면 null)","description":"상품 설명 (2~3문장)","imageUrls":["이미지URL"],"category":"카테고리(없으면 null)","keywords":["키워드1","키워드2","키워드3"]}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? '{}') as Partial<ProductInfo>
    return {
      name:        parsed.name        ?? '상품명 미확인',
      price:       parsed.price       ?? null,
      description: parsed.description ?? '',
      imageUrls:   Array.isArray(parsed.imageUrls) ? parsed.imageUrls.slice(0, 3) : [],
      category:    parsed.category    ?? null,
      keywords:    Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
      url,
      platform,
    }
  } catch {
    return {
      name: '상품명 미확인',
      price: null,
      description: cleanedHtml.slice(0, 200),
      imageUrls: [],
      category: null,
      keywords: [],
      url,
      platform,
    }
  }
}

/**
 * HTML에서 핵심 콘텐츠만 추출 (토큰 절약)
 * - script/style 제거
 * - meta 태그, title, og 태그 보존
 * - 최대 3000자
 */
function extractRelevantHtml(html: string): string {
  // script, style 제거
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // og: / meta 태그 추출
  const metaTags = (cleaned.match(/<meta[^>]+>/gi) ?? [])
    .filter(tag => /og:|twitter:|description|keywords/i.test(tag))
    .join('\n')

  const title = (cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[0] ?? ''
  const h1 = (cleaned.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? [])[0] ?? ''

  // 텍스트 노드만 추출
  const textContent = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)

  return [title, h1, metaTags, textContent].filter(Boolean).join('\n').slice(0, 3000)
}

/**
 * URL 없이 직접 입력 (fallback)
 */
export async function ingestManual(
  name: string,
  description: string,
  imageUrls: string[] = [],
): Promise<ProductInfo> {
  return {
    name,
    price: null,
    description,
    imageUrls,
    category: null,
    keywords: name.split(/\s+/).slice(0, 5),
    url: '',
    platform: 'manual',
  }
}
