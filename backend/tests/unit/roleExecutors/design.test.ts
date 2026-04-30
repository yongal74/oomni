/**
 * TDD: Design Bot executor 단위 테스트
 * - HTML 추출 로직
 * - design_outputs DB 저장
 * - 파일 저장 및 이벤트 발행
 * - streamClaude 모델 강제 (DESIGN_MODEL)
 */
import { designExecutor } from '../../../src/services/roleExecutors/design'
import type { ExecutorContext } from '../../../src/services/roleExecutors/base'

const MOCK_HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>테스트 디자인</title>
</head><body><div>테스트 컴포넌트</div></body></html>`

const MOCK_RESULT = `\`\`\`html\n${MOCK_HTML}\n\`\`\`\n\n## 디자인 결정\n미니멀한 레이아웃 채택.`

jest.mock('../../../src/services/roleExecutors/base', () => ({
  ...jest.requireActual('../../../src/services/roleExecutors/base'),
  streamClaude: jest.fn().mockResolvedValue(MOCK_RESULT),
  saveFeedItem: jest.fn().mockResolvedValue('feed-id-1'),
  DESIGN_MODEL: 'claude-opus-4-7',
}))

// 파일 시스템 mock
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}))

const { streamClaude, saveFeedItem } = jest.requireMock('../../../src/services/roleExecutors/base')

function buildCtx(task: string): { ctx: ExecutorContext; events: Array<[string, unknown]>; db: { query: jest.Mock } } {
  const events: Array<[string, unknown]> = []
  const db = { query: jest.fn().mockResolvedValue({ rows: [] }) }
  const ctx: ExecutorContext = {
    agent: { id: 'agent-1', mission_id: 'mission-1', role: 'design', name: 'Design Bot' } as any,
    task,
    db: db as any,
    send: (type: string, data: unknown) => { events.push([type, data]) },
  }
  return { ctx, events, db }
}

describe('Design Bot executor', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('기본 실행 흐름', () => {
    it('stage 이벤트: planning → designing → done', async () => {
      const { ctx, events } = buildCtx('랜딩 페이지 만들어줘')
      await designExecutor(ctx)

      const stages = events.filter(([t]) => t === 'stage').map(([, d]) => (d as any).stage)
      expect(stages).toContain('planning')
      expect(stages).toContain('designing')
      expect(stages[stages.length - 1]).toBe('done')
    })

    it('design_done 이벤트가 발행된다', async () => {
      const { ctx, events } = buildCtx('대시보드 UI 만들어줘')
      await designExecutor(ctx)

      const done = events.find(([t]) => t === 'design_done')
      expect(done).toBeDefined()
    })

    it('feed_item이 2개 저장된다 (info + result)', async () => {
      const { ctx } = buildCtx('버튼 컴포넌트 만들어줘')
      await designExecutor(ctx)

      expect(saveFeedItem).toHaveBeenCalledTimes(2)
      const calls = saveFeedItem.mock.calls
      expect(calls[0][2]).toBe('info')
      expect(calls[1][2]).toBe('result')
    })
  })

  describe('HTML 추출 및 DB 저장', () => {
    it('HTML이 추출되면 design_outputs에 INSERT 호출', async () => {
      const { ctx, db } = buildCtx('로그인 폼 만들어줘')
      await designExecutor(ctx)

      const insertCall = db.query.mock.calls.find(
        ([sql]: [string]) => sql.includes('INSERT INTO design_outputs')
      )
      expect(insertCall).toBeDefined()
    })

    it('design_outputs INSERT에 올바른 파라미터 전달', async () => {
      const { ctx, db } = buildCtx('로그인 폼 만들어줘')
      await designExecutor(ctx)

      const insertCall = db.query.mock.calls.find(
        ([sql]: [string]) => sql.includes('INSERT INTO design_outputs')
      )
      const params = insertCall[1] as unknown[]
      expect(params[1]).toBe('agent-1')   // agent_id
      expect(params[2]).toBe('mission-1') // mission_id
      expect(typeof params[3]).toBe('string') // title
      expect(params[4]).toContain('<!DOCTYPE html>') // html_content
    })

    it('HTML 없이 끝난 경우에도 크래시 없이 완료', async () => {
      streamClaude.mockResolvedValueOnce('디자인 설명만 있고 코드블록 없음')
      const { ctx } = buildCtx('디자인 설명해줘')
      await expect(designExecutor(ctx)).resolves.not.toThrow()
    })
  })

  describe('DESIGN_MODEL 강제', () => {
    it('ctx.overrideModel이 DESIGN_MODEL로 설정된다', async () => {
      const { ctx } = buildCtx('랜딩 페이지 만들어줘')
      await designExecutor(ctx)

      expect((ctx as any).overrideModel).toBe('claude-opus-4-7')
    })
  })
})
