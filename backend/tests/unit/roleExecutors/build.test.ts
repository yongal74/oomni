/**
 * TDD: Build Bot executor 단위 테스트
 * - 코드 생성 및 파일 저장
 * - feed_item 저장
 * - build_done 이벤트 발행
 */
import { buildExecutor } from '../../../src/services/roleExecutors/build'
import type { ExecutorContext } from '../../../src/services/roleExecutors/base'

const MOCK_CODE = `
## 구현 계획
- Express 라우터 설정
- SQLite 연결

\`\`\`typescript
// src/api/routes/hello.ts
import { Router } from 'express'
const router = Router()
router.get('/hello', (_req, res) => res.json({ message: 'Hello' }))
export default router
\`\`\`
`

jest.mock('../../../src/services/roleExecutors/base', () => ({
  ...jest.requireActual('../../../src/services/roleExecutors/base'),
  streamClaude: jest.fn().mockResolvedValue(MOCK_CODE),
  saveFeedItem: jest.fn().mockResolvedValue('feed-id-1'),
}))

// 파일 시스템 mock
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
}))

const { streamClaude, saveFeedItem } = jest.requireMock('../../../src/services/roleExecutors/base')

function buildCtx(task: string): { ctx: ExecutorContext; events: Array<[string, unknown]> } {
  const events: Array<[string, unknown]> = []
  const ctx: ExecutorContext = {
    agent: { id: 'agent-1', mission_id: 'mission-1', role: 'build', name: 'Build Bot', system_prompt: '' } as any,
    task,
    db: { query: jest.fn().mockResolvedValue({ rows: [] }) } as any,
    send: (type: string, data: unknown) => { events.push([type, data]) },
  }
  return { ctx, events }
}

describe('Build Bot executor', () => {
  beforeEach(() => jest.clearAllMocks())

  it('stage 이벤트가 발행된다', async () => {
    const { ctx, events } = buildCtx('Express API 라우터 만들어줘')
    await buildExecutor(ctx)

    const stages = events.filter(([t]) => t === 'stage')
    expect(stages.length).toBeGreaterThan(0)
  })

  it('build_done 이벤트가 발행된다', async () => {
    const { ctx, events } = buildCtx('REST API 코드 생성해줘')
    await buildExecutor(ctx)

    const done = events.find(([t]) => t === 'build_done')
    expect(done).toBeDefined()
  })

  it('feed_item info + result 저장', async () => {
    const { ctx } = buildCtx('컴포넌트 만들어줘')
    await buildExecutor(ctx)

    expect(saveFeedItem).toHaveBeenCalledTimes(2)
  })

  it('streamClaude가 호출된다', async () => {
    const { ctx } = buildCtx('TypeScript 유틸 함수 작성해줘')
    await buildExecutor(ctx)

    expect(streamClaude).toHaveBeenCalledTimes(1)
  })
})
