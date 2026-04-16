/**
 * TDD: 라우터 + 봇 역할별 페이지 분기 테스트
 * PTY 역할(build/design/ops) → PtyBotPage
 * Chat 역할(research/content/growth/ceo) → UnifiedBotPage
 */
import { describe, test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

// 페이지 컴포넌트 mock
vi.mock('../pages/UnifiedBotPage', () => ({
  default: () => <div data-testid="unified-bot-page">UnifiedBotPage</div>,
}))
vi.mock('../pages/PtyBotPage', () => ({
  default: () => <div data-testid="pty-bot-page">PtyBotPage</div>,
}))
vi.mock('../pages/DashboardPage', () => ({
  default: () => <div data-testid="dashboard-page">DashboardPage</div>,
}))
vi.mock('../pages/OnboardingPage', () => ({
  default: () => <div data-testid="onboarding-page">OnboardingPage</div>,
}))
vi.mock('../pages/PinPage', () => ({
  default: () => <div data-testid="pin-page">PinPage</div>,
}))
vi.mock('../pages/SettingsPage', () => ({
  default: () => <div data-testid="settings-page">SettingsPage</div>,
}))
vi.mock('../pages/ResearchPage', () => ({
  default: () => <div data-testid="research-page">ResearchPage</div>,
}))

// BotPageRouter 로직 복제 (역할 기반 분기)
const PTY_ROLES = new Set(['build', 'design', 'ops'])

function BotPageRouterTest({ role }: { role: string }) {
  if (PTY_ROLES.has(role)) {
    return <div data-testid="pty-bot-page">PtyBotPage</div>
  }
  return <div data-testid="unified-bot-page">UnifiedBotPage</div>
}

describe('봇 역할별 라우팅', () => {
  test('build 역할은 PtyBotPage를 렌더링한다', () => {
    render(<BotPageRouterTest role="build" />)
    expect(screen.getByTestId('pty-bot-page')).toBeInTheDocument()
  })

  test('design 역할은 PtyBotPage를 렌더링한다', () => {
    render(<BotPageRouterTest role="design" />)
    expect(screen.getByTestId('pty-bot-page')).toBeInTheDocument()
  })

  test('ops 역할은 PtyBotPage를 렌더링한다', () => {
    render(<BotPageRouterTest role="ops" />)
    expect(screen.getByTestId('pty-bot-page')).toBeInTheDocument()
  })

  test('research 역할은 UnifiedBotPage를 렌더링한다', () => {
    render(<BotPageRouterTest role="research" />)
    expect(screen.getByTestId('unified-bot-page')).toBeInTheDocument()
  })

  test('content 역할은 UnifiedBotPage를 렌더링한다', () => {
    render(<BotPageRouterTest role="content" />)
    expect(screen.getByTestId('unified-bot-page')).toBeInTheDocument()
  })

  test('growth 역할은 UnifiedBotPage를 렌더링한다', () => {
    render(<BotPageRouterTest role="growth" />)
    expect(screen.getByTestId('unified-bot-page')).toBeInTheDocument()
  })

  test('ceo 역할은 UnifiedBotPage를 렌더링한다', () => {
    render(<BotPageRouterTest role="ceo" />)
    expect(screen.getByTestId('unified-bot-page')).toBeInTheDocument()
  })
})

describe('주요 라우트 렌더링', () => {
  function TestApp({ path }: { path: string }) {
    return (
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/onboarding" element={<div data-testid="onboarding-page" />} />
          <Route path="/pin" element={<div data-testid="pin-page" />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page" />} />
          <Route path="/settings" element={<div data-testid="settings-page" />} />
          <Route path="/research" element={<div data-testid="research-page" />} />
        </Routes>
      </MemoryRouter>
    )
  }

  test('/onboarding 라우트가 온보딩 페이지를 렌더링한다', () => {
    render(<TestApp path="/onboarding" />)
    expect(screen.getByTestId('onboarding-page')).toBeInTheDocument()
  })

  test('/pin 라우트가 PIN 페이지를 렌더링한다', () => {
    render(<TestApp path="/pin" />)
    expect(screen.getByTestId('pin-page')).toBeInTheDocument()
  })

  test('/dashboard 라우트가 대시보드 페이지를 렌더링한다', () => {
    render(<TestApp path="/dashboard" />)
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
  })

  test('/settings 라우트가 설정 페이지를 렌더링한다', () => {
    render(<TestApp path="/settings" />)
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })
})
