/**
 * TDD: 유틸리티 함수 검증
 */
import { describe, test, expect } from 'vitest'
import { cn } from '../lib/utils'

describe('cn (클래스명 유틸)', () => {
  test('단일 클래스 반환', () => {
    expect(cn('text-white')).toBe('text-white')
  })

  test('여러 클래스 병합', () => {
    const result = cn('flex', 'items-center', 'gap-2')
    expect(result).toContain('flex')
    expect(result).toContain('items-center')
    expect(result).toContain('gap-2')
  })

  test('조건부 클래스 처리 (false 제외)', () => {
    const result = cn('base', false && 'excluded', 'included')
    expect(result).toContain('base')
    expect(result).toContain('included')
    expect(result).not.toContain('excluded')
  })

  test('조건부 클래스 처리 (true 포함)', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')
    expect(result).toContain('base')
    expect(result).toContain('active')
  })

  test('Tailwind 충돌 클래스 병합 (마지막 우선)', () => {
    // text-red-500과 text-blue-500 충돌 → 마지막 것 우선
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).toContain('text-blue-500')
    expect(result).not.toContain('text-red-500')
  })

  test('undefined/null 값 무시', () => {
    const result = cn('base', undefined, null, 'end')
    expect(result).toContain('base')
    expect(result).toContain('end')
  })
})
