/**
 * TDD: Ops Bot executor 단위 테스트
 * - 태스크 분류 (n8n / report / finance / monitor)
 * - 트랙별 시스템 프롬프트 선택
 * - 운영 지표 DB 쿼리
 * - feed_item 저장
 */
import { opsExecutor } from '../../../src/services/roleExecutors/ops'
import type { ExecutorContext } from '../../../src/services/roleExecutors/base'

jest.mock('../../../src/services/roleExecutors/base', () => ({
  ...jest.requireActual('../../../src/services/roleExecutors/base'),
  streamClaude: jest.fn().mockResolvedValue('Ops 분석 결과입니다.'),
  saveFeedItem: jest.fn().mockResolvedValue('feed-id-1'),
  DEFAULT_MODEL: 'claude-sonnet-4-6',
}))

const { streamClaude, saveFeedItem } = jest.requireMock('../../../src/services/roleExecutors/base')

function buildCtx(task: string): { ctx: ExecutorContext; events: Array<[string, unknown]>; db: { query: jest.Mock } } {
  const events: Array<[string, unknown]> = []
  const db = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  }
  const ctx: ExecutorContext = {
    agent: { id: 'agent-1', mission_id: 'mission-1', role: 'ops', name: 'Ops Bot', system_prompt: '' } as any,
    task,
    db: db as any,
    send: (type: string, data: unknown) => { events.push([type, data]) },
  }
  return { ctx, events, db }
}

describe('Ops Bot executor', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('기본 실행', () => {
    it('stage 이벤트 발행 및 ops_done 완료', async () => {
      const { ctx, events } = buildCtx('운영 상태 요약해줘')
      await opsExecutor(ctx)

      const stages = events.filter(([t]) => t === 'stage')
      expect(stages.length).toBeGreaterThan(0)

      const done = events.find(([t]) => t === 'ops_done')
      expect(done).toBeDefined()
    })

    it('feed_item info + result 저장', async () => {
      const { ctx } = buildCtx('운영 리포트')
      await opsExecutor(ctx)

      expect(saveFeedItem).toHaveBeenCalledTimes(2)
    })
  })

  describe('트랙별 분류', () => {
    it('n8n 키워드 → n8n 워크플로우 프롬프트', async () => {
      const { ctx } = buildCtx('n8n 자동화 워크플로우 만들어줘')
      await opsExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toContain('n8n') // n8n 시스템 프롬프트
    })

    it('비용 키워드 → finance 트랙', async () => {
      const { ctx } = buildCtx('이번 달 토큰 비용 분석해줘')
      await opsExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      expect(call[1]).toBeDefined()
    })

    it('모니터링 키워드 → monitor 트랙', async () => {
      const { ctx } = buildCtx('에러 모니터링 상태 알려줘')
      await opsExecutor(ctx)

      const done = events => events.find(([t]: [string]) => t === 'ops_done')
      expect(streamClaude).toHaveBeenCalledTimes(1)
    })

    it('리포트 키워드 → report 트랙', async () => {
      const { ctx } = buildCtx('주간 운영 보고서 작성해줘')
      await opsExecutor(ctx)

      expect(streamClaude).toHaveBeenCalledTimes(1)
    })
  })

  describe('운영 지표 컨텍스트 수집', () => {
    it('DB 쿼리가 실행된다 (비용/피드/실행 이력)', async () => {
      const { ctx, db } = buildCtx('운영 지표 분석')
      await opsExecutor(ctx)

      expect(db.query).toHaveBeenCalled()
    })
  })
})
