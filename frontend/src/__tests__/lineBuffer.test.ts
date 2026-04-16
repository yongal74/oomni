/**
 * TDD: lineBuffer 스트리밍 파싱 단위 테스트 (3-A-2)
 *
 * HTTP chunked 스트리밍에서 JSON 라인이 청크 경계에서 잘릴 경우
 * lineBuffer 패턴이 올바르게 처리하는지 검증
 */
import { describe, test, expect } from 'vitest'

// lineBuffer 패턴 순수 함수로 추출
function parseChunkedLines(chunks: string[]): Array<{ event: string; data: unknown }> {
  let lineBuffer = ''
  const results: Array<{ event: string; data: unknown }> = []

  for (const chunk of chunks) {
    lineBuffer += chunk
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.event) results.push(parsed)
      } catch {
        // incomplete JSON — 무시
      }
    }
  }

  // 남은 버퍼 처리
  if (lineBuffer.trim()) {
    try {
      const parsed = JSON.parse(lineBuffer.trim())
      if (parsed.event) results.push(parsed)
    } catch { /* 불완전 라인 */ }
  }

  return results
}

describe('lineBuffer 스트리밍 파싱', () => {
  test('단일 청크에서 완전한 JSON 라인 파싱', () => {
    const chunks = ['{"event":"output","data":{"chunk":"Hello"}}\n']
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(1)
    expect(result[0]?.event).toBe('output')
    expect((result[0]?.data as any).chunk).toBe('Hello')
  })

  test('청크 경계에서 JSON이 잘려도 올바르게 재조립', () => {
    // JSON이 두 청크로 분리됨
    const chunks = [
      '{"event":"output","dat',
      'a":{"chunk":"split"}}\n',
    ]
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(1)
    expect(result[0]?.event).toBe('output')
    expect((result[0]?.data as any).chunk).toBe('split')
  })

  test('한 청크에 여러 JSON 라인 포함', () => {
    const chunks = [
      '{"event":"start","data":{}}\n{"event":"output","data":{"chunk":"A"}}\n{"event":"done","data":{}}\n',
    ]
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(3)
    expect(result[0]?.event).toBe('start')
    expect(result[1]?.event).toBe('output')
    expect(result[2]?.event).toBe('done')
  })

  test('여러 청크에 걸친 여러 JSON 라인', () => {
    const line1 = '{"event":"stage","data":{"stage":"collecting"}}\n'
    const line2 = '{"event":"output","data":{"chunk":"Hello World"}}\n'
    // 두 라인이 3개 청크로 분리됨
    const chunks = [
      line1.slice(0, 20),
      line1.slice(20) + line2.slice(0, 15),
      line2.slice(15),
    ]
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(2)
    expect(result[0]?.event).toBe('stage')
    expect(result[1]?.event).toBe('output')
  })

  test('빈 청크 무시', () => {
    const chunks = ['', '{"event":"done","data":{}}\n', '']
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(1)
    expect(result[0]?.event).toBe('done')
  })

  test('한국어 포함 JSON 파싱', () => {
    const chunks = ['{"event":"output","data":{"chunk":"안녕하세요 Claude"}}\n']
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(1)
    expect((result[0]?.data as any).chunk).toBe('안녕하세요 Claude')
  })

  test('stage 이벤트 순서 보장', () => {
    const chunks = [
      '{"event":"start","data":{}}\n',
      '{"event":"stage","data":{"stage":"collecting","label":"수집 중"}}\n',
      '{"event":"stage","data":{"stage":"analyzing","label":"분석 중"}}\n',
      '{"event":"done","data":{"success":true}}\n',
    ]
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(4)
    const stages = result.filter(r => r.event === 'stage')
    expect(stages[0]).toMatchObject({ data: { stage: 'collecting' } })
    expect(stages[1]).toMatchObject({ data: { stage: 'analyzing' } })
  })

  test('에러 이벤트 파싱', () => {
    const chunks = ['{"event":"error","data":{"message":"API 키가 유효하지 않습니다"}}\n']
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(1)
    expect(result[0]?.event).toBe('error')
    expect((result[0]?.data as any).message).toContain('API 키')
  })

  test('극단적 분할: 1바이트씩 나뉜 청크', () => {
    const json = '{"event":"output","data":{"chunk":"X"}}\n'
    const chunks = json.split('')
    const result = parseChunkedLines(chunks)
    expect(result).toHaveLength(1)
    expect(result[0]?.event).toBe('output')
  })
})
