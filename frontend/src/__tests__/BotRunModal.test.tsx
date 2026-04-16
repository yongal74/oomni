/**
 * TDD: BotRunModal 컴포넌트 테스트
 * 동작: 예시 클릭 or 제출 → navigate(/dashboard/bots/:id?autorun=...)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BotRunModal } from '../components/BotRunModal'

// navigate mock
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual as object, useNavigate: () => mockNavigate }
})

const mockAgent = {
  id: 'agent-1',
  mission_id: 'mission-1',
  name: 'Research Bot',
  role: 'research' as const,
  schedule: 'manual' as const,
  system_prompt: '',
  budget_cents: 1000,
  is_active: true,
  reports_to: null,
  created_at: new Date().toISOString(),
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('BotRunModal', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('봇 이름이 표시된다', () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    expect(screen.getByText('Research Bot')).toBeInTheDocument()
  })

  test('textarea placeholder가 표시된다', () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    expect(screen.getByPlaceholderText('어떤 작업을 실행할까요?')).toBeInTheDocument()
  })

  test('research 봇 예시 프롬프트가 표시된다', () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    expect(screen.getByText('예시 프롬프트')).toBeInTheDocument()
    expect(screen.getByText('AI/블록체인/테크 분야 이번 주 주요 트렌드 수집 및 1차 필터링')).toBeInTheDocument()
  })

  test('예시 프롬프트 클릭 시 onClose + navigate 호출', () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    const chip = screen.getByText('경쟁 서비스 분석 리포트 작성')
    fireEvent.click(chip)
    expect(onClose).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/dashboard/bots/agent-1')
    )
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('autorun=')
    )
  })

  test('textarea에 입력 후 실행 버튼 클릭 시 navigate 호출', async () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('어떤 작업을 실행할까요?')
    await userEvent.type(textarea, '테스트 작업')
    const runButton = screen.getByRole('button', { name: /실행/ })
    fireEvent.click(runButton)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('autorun=%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EC%9E%91%EC%97%85')
      )
    })
  })

  test('취소 버튼 클릭 시 onClose 호출', () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    const cancelButton = screen.getByRole('button', { name: /취소/ })
    fireEvent.click(cancelButton)
    expect(onClose).toHaveBeenCalled()
  })

  test('닫기(X) 버튼 클릭 시 onClose 호출', () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: /닫기/ })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  test('빈 task로 실행 버튼 클릭 시 navigate 호출 안 됨', () => {
    renderWithRouter(<BotRunModal agent={mockAgent} onClose={onClose} />)
    const runButton = screen.getByRole('button', { name: /실행/ })
    fireEvent.click(runButton)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
