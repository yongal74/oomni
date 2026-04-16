/**
 * TDD: ErrorBoundary 컴포넌트 테스트 (2-C-1)
 * IDE 수준 안정성: 봇 패널 크래시가 앱 전체에 전파되지 않아야 함
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../components/ErrorBoundary'

// 에러를 throw하는 테스트용 컴포넌트
function BrokenComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('봇 패널 크래시 시뮬레이션')
  return <div>정상 컴포넌트</div>
}

describe('ErrorBoundary', () => {
  let consoleError: typeof console.error

  beforeEach(() => {
    // React의 에러 경고 억제
    consoleError = console.error
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = consoleError
  })

  test('정상 자식 컴포넌트를 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('정상 컴포넌트')).toBeInTheDocument()
  })

  test('자식 컴포넌트 크래시 시 Fallback UI를 표시한다', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    // 앱 전체가 흰 화면이 아닌 에러 UI를 보여야 함
    expect(screen.queryByText('정상 컴포넌트')).not.toBeInTheDocument()
    // 에러 경계가 fallback 렌더링
    const errorEl = document.body.textContent
    expect(errorEl).toBeTruthy()
  })

  test('커스텀 fallback을 렌더링한다', () => {
    render(
      <ErrorBoundary fallback={<div>커스텀 에러 UI</div>}>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('커스텀 에러 UI')).toBeInTheDocument()
  })

  test('중첩 ErrorBoundary: 내부 크래시가 외부에 전파되지 않는다', () => {
    render(
      <ErrorBoundary fallback={<div>외부 에러</div>}>
        <div>
          <span>외부 정상</span>
          <ErrorBoundary fallback={<div>내부 에러</div>}>
            <BrokenComponent shouldThrow={true} />
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    )
    // 외부는 정상, 내부만 에러 표시
    expect(screen.getByText('외부 정상')).toBeInTheDocument()
    expect(screen.getByText('내부 에러')).toBeInTheDocument()
    expect(screen.queryByText('외부 에러')).not.toBeInTheDocument()
  })
})
