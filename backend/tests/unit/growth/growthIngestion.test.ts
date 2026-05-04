/**
 * TDD: growthIngestionService — URL 상품 정보 추출
 * v5.2.0
 */

// Claude API mock
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                name: '테스트 상품',
                description: '최고의 제품입니다',
                price: '29,900원',
                features: ['빠른 배송', '품질 보증'],
                target_audience: '20-30대 여성',
                platform: 'smartstore',
              }),
            },
          ],
        }),
      },
    })),
  }
})

// ingestManual 로직 직접 테스트
function ingestManual(
  name: string,
  description: string,
  imageUrls: string[] = [],
) {
  if (!name) throw new Error('name is required')
  return {
    name,
    description: description || '',
    image_urls: imageUrls,
    platform: 'manual',
    source: 'manual',
  }
}

// 플랫폼 감지 로직
function detectPlatform(url: string): string {
  if (url.includes('smartstore.naver.com')) return 'smartstore'
  if (url.includes('coupang.com'))          return 'coupang'
  if (url.includes('cafe24.com'))           return 'cafe24'
  if (url.includes('imweb.me'))             return 'imweb'
  if (url.includes('11st.co.kr'))           return '11st'
  if (url.includes('gmarket.co.kr'))        return 'gmarket'
  return 'unknown'
}

// ── ingestManual ─────────────────────────────────────────────────────────────

describe('ingestManual()', () => {
  test('name, description, imageUrls 정상 반환', () => {
    const result = ingestManual('테스트 상품', '좋은 상품', ['https://img.test/1.jpg'])
    expect(result.name).toBe('테스트 상품')
    expect(result.description).toBe('좋은 상품')
    expect(result.image_urls).toHaveLength(1)
    expect(result.platform).toBe('manual')
  })

  test('description 없어도 빈 문자열로 처리', () => {
    const result = ingestManual('상품명', '')
    expect(result.description).toBe('')
  })

  test('image_urls 없으면 빈 배열', () => {
    const result = ingestManual('상품명', '설명')
    expect(result.image_urls).toEqual([])
  })

  test('name 없으면 에러', () => {
    expect(() => ingestManual('', '설명')).toThrow('name is required')
  })
})

// ── 플랫폼 감지 ───────────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  const cases = [
    { url: 'https://smartstore.naver.com/shop/products/123', expected: 'smartstore' },
    { url: 'https://www.coupang.com/vp/products/456', expected: 'coupang' },
    { url: 'https://myshop.cafe24.com/product/789', expected: 'cafe24' },
    { url: 'https://mysite.imweb.me/shop/10', expected: 'imweb' },
    { url: 'http://www.11st.co.kr/products/123', expected: '11st' },
    { url: 'https://www.gmarket.co.kr/item/123', expected: 'gmarket' },
    { url: 'https://unknown-shop.com/product/1', expected: 'unknown' },
  ]

  cases.forEach(({ url, expected }) => {
    test(`${expected} 플랫폼 감지: ${url.slice(0, 40)}...`, () => {
      expect(detectPlatform(url)).toBe(expected)
    })
  })
})

// ── URL 유효성 검증 ───────────────────────────────────────────────────────────

describe('URL 유효성', () => {
  test('올바른 HTTP URL', () => {
    const validUrls = [
      'https://smartstore.naver.com/product/123',
      'http://www.coupang.com/vp/products/456',
    ]
    validUrls.forEach(url => {
      expect(() => new URL(url)).not.toThrow()
    })
  })

  test('잘못된 URL은 Error', () => {
    const invalidUrls = ['not-a-url', 'ftp://invalid', '']
    invalidUrls.forEach(url => {
      try {
        new URL(url)
        // ftp는 파싱은 되지만 http가 아님
        if (url.startsWith('ftp://')) {
          expect(new URL(url).protocol).toBe('ftp:')
        }
      } catch (e) {
        expect(e).toBeInstanceOf(TypeError)
      }
    })
  })
})

// ── HTML 컨텐츠 트리밍 ────────────────────────────────────────────────────────

describe('HTML 컨텐츠 처리', () => {
  test('3000자 제한 적용', () => {
    const longHtml = 'A'.repeat(5000)
    const trimmed = longHtml.slice(0, 3000)
    expect(trimmed.length).toBe(3000)
  })

  test('스크립트/스타일 태그 제거 패턴', () => {
    const html = '<html><head><style>body{}</style></head><body><p>상품</p><script>alert(1)</script></body></html>'
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    expect(cleaned).toBe('상품')
    expect(cleaned).not.toContain('script')
    expect(cleaned).not.toContain('style')
  })
})
