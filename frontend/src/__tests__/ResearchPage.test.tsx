/**
 * TDD: ResearchPage 컴포넌트 테스트
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock react-query
vi.mock('../lib/api', () => ({
  researchApi: {
    list: vi.fn().mockResolvedValue([]),
    collect: vi.fn().mockResolvedValue({
      id: 'r-1',
      mission_id: 'm-1',
      source_type: 'url',
      title: 'AI 분석 제목',
      summary: 'AI 요약',
      tags: ['tag1'],
      signal_score: 75,
      filter_decision: 'pending',
      created_at: '2026-04-05T00:00:00Z',
    }),
    filter: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({}),
    convert: vi.fn().mockResolvedValue({ content: '변환된 콘텐츠' }),
  },
}))

// Mock useAppStore
vi.mock('../store/app.store', () => ({
  useAppStore: vi.fn(() => ({
    currentMission: { id: 'm-1', name: '테스트 미션' },
    pendingApprovals: 0,
    agents: [],
  })),
}))

// Mock ws
vi.mock('../lib/ws', () => ({
  oomniWs: { connect: vi.fn(), disconnect: vi.fn() },
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

// Lazy import needs dynamic import workaround
let ResearchPage: React.ComponentType

describe('ResearchPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../pages/ResearchHub')
    ResearchPage = mod.default
  })

  test('renders source input section', () => {
    renderWithQuery(<ResearchPage />)
    expect(screen.getByText('Research Studio')).toBeInTheDocument()
    expect(screen.getByText('소스 등록')).toBeInTheDocument()
  })

  test('shows source type tabs', () => {
    renderWithQuery(<ResearchPage />)
    expect(screen.getByText('URL')).toBeInTheDocument()
    expect(screen.getByText('RSS')).toBeInTheDocument()
    expect(screen.getByText('키워드')).toBeInTheDocument()
    expect(screen.getByText('직접입력')).toBeInTheDocument()
  })

  test('collect button is disabled when input is empty', () => {
    renderWithQuery(<ResearchPage />)
    const button = screen.getByRole('button', { name: /수집 시작/ })
    expect(button).toBeDisabled()
  })

  test('collect button becomes enabled when input is filled', async () => {
    renderWithQuery(<ResearchPage />)
    const input = screen.getByPlaceholderText('https://example.com')
    fireEvent.change(input, { target: { value: 'https://test.com' } })
    const button = screen.getByRole('button', { name: /수집 시작/ })
    expect(button).not.toBeDisabled()
  })

  test('submit URL triggers collect API', async () => {
    const { researchApi } = await import('../lib/api')
    renderWithQuery(<ResearchPage />)

    const input = screen.getByPlaceholderText('https://example.com')
    fireEvent.change(input, { target: { value: 'https://test.com' } })

    const button = screen.getByRole('button', { name: /수집 시작/ })
    fireEvent.click(button)

    await waitFor(() => {
      expect(researchApi.collect).toHaveBeenCalledWith(expect.objectContaining({
        mission_id: 'm-1',
        source_type: 'url',
        source_url: 'https://test.com',
      }))
    })
  })

  test('filter tabs are rendered', () => {
    renderWithQuery(<ResearchPage />)
    expect(screen.getByText('전체')).toBeInTheDocument()
    expect(screen.getByText('대기중')).toBeInTheDocument()
    expect(screen.getByText('Keep')).toBeInTheDocument()
    expect(screen.getByText('Watch')).toBeInTheDocument()
    expect(screen.getByText('Drop')).toBeInTheDocument()
  })

  test('shows empty state when no items', async () => {
    renderWithQuery(<ResearchPage />)
    await waitFor(() => {
      expect(screen.getByText(/아직 수집된 리서치가 없습니다/)).toBeInTheDocument()
    })
  })

  test('renders cards with signal scores when items exist', async () => {
    const { researchApi } = await import('../lib/api')
    vi.mocked(researchApi.list).mockResolvedValueOnce([
      {
        id: 'r-1',
        mission_id: 'm-1',
        source_type: 'url',
        title: '테스트 항목',
        summary: '요약 내용',
        tags: ['AI', '테크'],
        signal_score: 80,
        filter_decision: 'pending',
        created_at: '2026-04-05T00:00:00Z',
      },
    ])

    renderWithQuery(<ResearchPage />)

    await waitFor(() => {
      expect(screen.getByText('테스트 항목')).toBeInTheDocument()
      expect(screen.getByText('80')).toBeInTheDocument()
    })
  })

  test('Keep/Drop/Watch buttons are visible on pending cards', async () => {
    const { researchApi } = await import('../lib/api')
    vi.mocked(researchApi.list).mockResolvedValueOnce([
      {
        id: 'r-1',
        mission_id: 'm-1',
        source_type: 'url',
        title: '테스트 항목',
        tags: [],
        signal_score: 60,
        filter_decision: 'pending',
        created_at: '2026-04-05T00:00:00Z',
      },
    ])

    renderWithQuery(<ResearchPage />)

    await waitFor(() => {
      expect(screen.getByText('테스트 항목')).toBeInTheDocument()
    })

    // Cards have action buttons; there will be multiple Keep/Watch/Drop buttons (filter tabs + card actions)
    // We verify that there are at least the card's action buttons in addition to the filter tabs
    const keepButtons = screen.getAllByRole('button', { name: /Keep/ })
    expect(keepButtons.length).toBeGreaterThanOrEqual(2) // filter tab + card button
    const watchButtons = screen.getAllByRole('button', { name: /Watch/ })
    expect(watchButtons.length).toBeGreaterThanOrEqual(2)
    const dropButtons = screen.getAllByRole('button', { name: /Drop/ })
    expect(dropButtons.length).toBeGreaterThanOrEqual(2)
  })

  test('clicking Keep on card calls filter API with keep decision', async () => {
    const { researchApi } = await import('../lib/api')
    vi.mocked(researchApi.list).mockResolvedValueOnce([
      {
        id: 'r-1',
        mission_id: 'm-1',
        source_type: 'url',
        title: '테스트 항목',
        tags: [],
        signal_score: 60,
        filter_decision: 'pending',
        created_at: '2026-04-05T00:00:00Z',
      },
    ])

    renderWithQuery(<ResearchPage />)

    await waitFor(() => {
      expect(screen.getByText('테스트 항목')).toBeInTheDocument()
    })

    // Click the last Keep button (card button, not filter tab)
    const keepButtons = screen.getAllByRole('button', { name: /Keep/ })
    fireEvent.click(keepButtons[keepButtons.length - 1]!)

    await waitFor(() => {
      expect(researchApi.filter).toHaveBeenCalledWith('r-1', 'keep')
    })
  })

  test('clicking Drop on card calls filter API with drop decision', async () => {
    const { researchApi } = await import('../lib/api')
    vi.mocked(researchApi.list).mockResolvedValueOnce([
      {
        id: 'r-1',
        mission_id: 'm-1',
        source_type: 'url',
        title: '테스트 항목',
        tags: [],
        signal_score: 30,
        filter_decision: 'pending',
        created_at: '2026-04-05T00:00:00Z',
      },
    ])

    renderWithQuery(<ResearchPage />)

    await waitFor(() => {
      expect(screen.getByText('테스트 항목')).toBeInTheDocument()
    })

    const dropButtons = screen.getAllByRole('button', { name: /Drop/ })
    fireEvent.click(dropButtons[dropButtons.length - 1]!)

    await waitFor(() => {
      expect(researchApi.filter).toHaveBeenCalledWith('r-1', 'drop')
    })
  })

  test('shows no mission message when currentMission is null', async () => {
    const { useAppStore } = await import('../store/app.store')
    vi.mocked(useAppStore).mockReturnValueOnce({
      currentMission: null,
      pendingApprovals: 0,
      agents: [],
    } as any)

    renderWithQuery(<ResearchPage />)
    expect(screen.getByText('미션을 먼저 선택해주세요')).toBeInTheDocument()
  })
})
