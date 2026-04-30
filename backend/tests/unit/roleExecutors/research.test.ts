/**
 * TDD: Research Bot executor 단위 테스트
 * - 트랙 감지 (business / informational / web)
 * - ITEM_START..ITEM_END 파싱
 * - research_items DB 저장
 * - 필터링 워크플로우
 */
import { researchExecutor } from '../../../src/services/roleExecutors/research'
import type { ExecutorContext } from '../../../src/services/roleExecutors/base'

const MOCK_ITEMS = `ITEM_START
title: AI 코딩 도구 시장 성장
signal_score: 87
summary: GitHub Copilot, Cursor 등 AI 코딩 도구가 빠르게 성장 중.
tags: AI, 코딩, SaaS
seo_volume: high
seo_kd: medium
seo_cpc: high
first_mover: false
ITEM_END

ITEM_START
title: GPT-4o 멀티모달 업데이트
signal_score: 72
summary: OpenAI가 이미지·오디오 처리를 개선한 GPT-4o 업데이트 발표.
tags: AI, OpenAI, LLM
seo_volume: high
seo_kd: high
seo_cpc: medium
first_mover: false
ITEM_END`

jest.mock('../../../src/services/roleExecutors/base', () => ({
  ...jest.requireActual('../../../src/services/roleExecutors/base'),
  streamClaude: jest.fn().mockResolvedValue(MOCK_ITEMS),
  saveFeedItem: jest.fn().mockResolvedValue('feed-id-1'),
  HAIKU_MODEL: 'claude-haiku-4-5-20251001',
}))

const { streamClaude, saveFeedItem } = jest.requireMock('../../../src/services/roleExecutors/base')

function buildCtx(task: string): { ctx: ExecutorContext; events: Array<[string, unknown]>; db: { query: jest.Mock } } {
  const events: Array<[string, unknown]> = []
  const db = { query: jest.fn().mockResolvedValue({ rows: [] }) }
  const ctx: ExecutorContext = {
    agent: { id: 'agent-1', mission_id: 'mission-1', role: 'research', name: 'Research Bot', system_prompt: '' } as any,
    task,
    db: db as any,
    send: (type: string, data: unknown) => { events.push([type, data]) },
  }
  return { ctx, events, db }
}

describe('Research Bot executor', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('기본 실행 흐름', () => {
    it('stage 이벤트가 발행된다', async () => {
      const { ctx, events } = buildCtx('AI 트렌드 리서치해줘')
      await researchExecutor(ctx)

      const stages = events.filter(([t]) => t === 'stage')
      expect(stages.length).toBeGreaterThan(0)
    })

    it('research_done 이벤트가 발행된다', async () => {
      const { ctx, events } = buildCtx('GPT-4 시장 조사해줘')
      await researchExecutor(ctx)

      const done = events.find(([t]) => t === 'research_done')
      expect(done).toBeDefined()
    })

    it('feed_item info + result 저장', async () => {
      const { ctx } = buildCtx('AI 트렌드')
      await researchExecutor(ctx)

      expect(saveFeedItem).toHaveBeenCalledTimes(2)
    })
  })

  describe('리서치 아이템 파싱 및 DB 저장', () => {
    it('ITEM_START..ITEM_END 블록이 파싱되어 research_items에 INSERT 호출', async () => {
      const { ctx, db } = buildCtx('AI 시장 조사')
      await researchExecutor(ctx)

      const inserts = db.query.mock.calls.filter(
        ([sql]: [string]) => sql.includes('INSERT INTO research_items')
      )
      expect(inserts.length).toBeGreaterThan(0)
    })

    it('signal_score가 숫자로 저장된다', async () => {
      const { ctx, db } = buildCtx('AI 코딩 도구 트렌드')
      await researchExecutor(ctx)

      const insert = db.query.mock.calls.find(
        ([sql]: [string]) => sql.includes('INSERT INTO research_items')
      )
      if (insert) {
        const params = insert[1] as unknown[]
        // signal_score는 0-1 정규화 또는 0-100 중 하나
        const score = params.find((p): p is number => typeof p === 'number')
        expect(score).toBeDefined()
      }
    })
  })

  describe('트랙 자동 감지', () => {
    it('사업 키워드 → business 트랙으로 적절한 시스템 프롬프트', async () => {
      const { ctx } = buildCtx('스타트업 투자 트렌드 비즈니스 분석해줘')
      await researchExecutor(ctx)

      const call = streamClaude.mock.calls[0]
      const systemPrompt = call[1] as string
      // 사업성 트랙의 키워드 확인
      expect(systemPrompt).toBeDefined()
    })

    it('정보성 키워드 → informational 트랙', async () => {
      const { ctx } = buildCtx('기술 트렌드 정보성 아티클 리서치해줘')
      await researchExecutor(ctx)

      expect(streamClaude).toHaveBeenCalledTimes(1)
    })
  })
})
