/**
 * TDD: Content Bot executor 단위 테스트
 * - 파라미터 파싱 (outputType, platform 감지)
 * - 시스템 프롬프트 선택
 * - 리서치 컨텍스트 빌드
 * - DB 저장 및 이벤트 발행
 */
import { contentExecutor } from '../../../src/services/roleExecutors/content'
import type { ExecutorContext } from '../../../src/services/roleExecutors/base'

// streamClaude mock — 실제 AI 호출 없이 텍스트 반환
jest.mock('../../../src/services/roleExecutors/base', () => ({
  ...jest.requireActual('../../../src/services/roleExecutors/base'),
  streamClaude: jest.fn().mockResolvedValue('## 콘텐츠 결과\n테스트 콘텐츠 생성 완료.'),
  saveFeedItem: jest.fn().mockResolvedValue('feed-id-1'),
}))

const { streamClaude, saveFeedItem } = jest.requireMock('../../../src/services/roleExecutors/base')

function buildCtx(task: string, researchRows: unknown[] = []): { ctx: ExecutorContext; events: Array<[string, unknown]> } {
  const events: Array<[string, unknown]> = []
  const db = {
    query: jest.fn().mockResolvedValue({ rows: researchRows }),
  }
  const ctx: ExecutorContext = {
    agent: { id: 'agent-1', mission_id: 'mission-1', role: 'content', system_prompt: '기본 프롬프트', name: 'Content Bot' } as any,
    task,
    db: db as any,
    send: (type: string, data: unknown) => { events.push([type, data]) },
  }
  return { ctx, events }
}

describe('Content Bot executor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('기본 실행', () => {
    it('실행 완료 시 feed_item 저장 및 content_done 이벤트', async () => {
      const { ctx, events } = buildCtx('블로그 글 작성해줘')
      await contentExecutor(ctx)

      expect(saveFeedItem).toHaveBeenCalledWith(expect.anything(), 'agent-1', 'result', expect.any(String))
      const done = events.find(([type]) => type === 'content_done')
      expect(done).toBeDefined()
    })

    it('stage 이벤트 순서: preparing → writing → done', async () => {
      const { ctx, events } = buildCtx('기본 콘텐츠')
      await contentExecutor(ctx)

      const stages = events.filter(([t]) => t === 'stage').map(([, d]) => (d as any).stage)
      expect(stages[0]).toBe('preparing')
      expect(stages[stages.length - 1]).toBe('done')
    })
  })

  describe('outputType 자동 감지', () => {
    it('[outputType:blog] 파라미터 → 블로그 프롬프트 선택', async () => {
      const { ctx } = buildCtx('[outputType:blog] 블로그 작성해줘')
      await contentExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toContain('4단계') // 블로그 시스템 프롬프트
    })

    it('[outputType:informational] → 정보성 프롬프트', async () => {
      const { ctx } = buildCtx('[outputType:informational] AI 트렌드 포스트 작성해줘')
      await contentExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toContain('정보성 콘텐츠')
    })

    it('[outputType:business] → 사업성 프롬프트', async () => {
      const { ctx } = buildCtx('[outputType:business] 시장 분석 리포트 작성해줘')
      await contentExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toContain('비즈니스 콘텐츠')
    })

    it('[platform:aiwx_blog] → AIWX 프롬프트', async () => {
      const { ctx } = buildCtx('[platform:aiwx_blog] AIWX 포스팅 작성해줘')
      await contentExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toContain('AIWX') // AIWX 시스템 프롬프트
    })

    it('자연어 "링크드인" → linkedin 프롬프트', async () => {
      const { ctx } = buildCtx('링크드인 포스트 작성해줘')
      await contentExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toContain('LinkedIn')
    })

    it('자연어 "블로그 글" → blog 프롬프트', async () => {
      const { ctx } = buildCtx('4단계 구조로 블로그 글 작성해줘')
      await contentExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toContain('4단계')
    })
  })

  describe('소팅 태스크', () => {
    it('소팅 키워드 → sorting 실행 (streamClaude 호출, 결과 저장)', async () => {
      const researchRows = [
        { title: '아이템 1', summary: '요약 1', tags: 'AI', signal_score: 0.9 },
        { title: '아이템 2', summary: '요약 2', tags: 'Tech', signal_score: 0.5 },
      ]
      const { ctx, events } = buildCtx('리서치 아이템들을 소팅해줘', researchRows)
      await contentExecutor(ctx)

      expect(streamClaude).toHaveBeenCalledTimes(1)
      const done = events.find(([t]) => t === 'content_done')
      expect(done).toBeDefined()
    })
  })

  describe('리서치 컨텍스트 주입', () => {
    it('keep된 리서치 아이템이 있으면 userMessage에 포함', async () => {
      const rows = [
        { title: 'GPT-4 분석', summary: '최신 AI 연구', tags: 'AI', signal_score: 0.85 },
      ]
      const { ctx } = buildCtx('블로그 작성해줘', rows)
      await contentExecutor(ctx)

      const userMessage = streamClaude.mock.calls[0][2] as string
      expect(userMessage).toContain('GPT-4 분석')
    })

    it('리서치 아이템이 없으면 빈 컨텍스트로 실행', async () => {
      const { ctx } = buildCtx('블로그 작성해줘', [])
      await contentExecutor(ctx)

      expect(streamClaude).toHaveBeenCalledTimes(1)
    })
  })
})
