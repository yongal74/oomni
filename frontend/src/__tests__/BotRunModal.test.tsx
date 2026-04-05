/**
 * TDD: BotRunModal 컴포넌트 테스트
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BotRunModal } from '../components/BotRunModal'

// agentsApi mock
vi.mock('../lib/api', () => ({
  agentsApi: {
    trigger: vi.fn().mockResolvedValue({ message: '봇 실행을 요청했습니다' }),
  },
}))

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

describe('BotRunModal', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders modal when open is true', () => {
    render(<BotRunModal agent={mockAgent} onClose={onClose} />)
    expect(screen.getByText('Research Bot')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('어떤 작업을 실행할까요?')).toBeInTheDocument()
  })

  test('shows example prompts for research bot role', () => {
    render(<BotRunModal agent={mockAgent} onClose={onClose} />)
    expect(screen.getByText('예시 프롬프트')).toBeInTheDocument()
    expect(
      screen.getByText('AI/블록체인/테크 분야 이번 주 주요 트렌드 수집 및 1차 필터링')
    ).toBeInTheDocument()
  })

  test('clicking example prompt fills textarea', async () => {
    render(<BotRunModal agent={mockAgent} onClose={onClose} />)
    const chip = screen.getByText('경쟁 서비스 분석 리포트 작성')
    fireEvent.click(chip)
    const textarea = screen.getByPlaceholderText('어떤 작업을 실행할까요?') as HTMLTextAreaElement
    expect(textarea.value).toBe('경쟁 서비스 분석 리포트 작성')
  })

  test('submit calls agentsApi.trigger with task', async () => {
    const { agentsApi } = await import('../lib/api')
    render(<BotRunModal agent={mockAgent} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('어떤 작업을 실행할까요?')
    await userEvent.type(textarea, '테스트 작업')

    const runButton = screen.getByRole('button', { name: /실행/ })
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(agentsApi.trigger).toHaveBeenCalledWith('agent-1', '테스트 작업')
    })
  })

  test('shows loading state during execution', async () => {
    const { agentsApi } = await import('../lib/api')
    // Never resolves during test
    ;(agentsApi.trigger as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}))

    render(<BotRunModal agent={mockAgent} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('어떤 작업을 실행할까요?')
    await userEvent.type(textarea, '테스트 작업')

    const runButton = screen.getByRole('button', { name: /실행/ })
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /실행 중/ })).toBeInTheDocument()
    })
  })

  test('closes on success', async () => {
    const { agentsApi } = await import('../lib/api')
    ;(agentsApi.trigger as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      message: '봇 실행을 요청했습니다',
    })

    render(<BotRunModal agent={mockAgent} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('어떤 작업을 실행할까요?')
    await userEvent.type(textarea, '테스트 작업')

    const runButton = screen.getByRole('button', { name: /실행/ })
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  test('cancel button calls onClose', () => {
    render(<BotRunModal agent={mockAgent} onClose={onClose} />)
    const cancelButton = screen.getByRole('button', { name: /취소/ })
    fireEvent.click(cancelButton)
    expect(onClose).toHaveBeenCalled()
  })
})
