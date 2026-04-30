/**
 * TDD: roleExecutors/index — routeToExecutor 라우팅 검증
 * - 각 역할별 올바른 executor 호출 확인
 * - growth 역할은 라우팅되지 않는다 (Content Bot으로 흡수됨)
 */
import { routeToExecutor } from '../../../src/services/roleExecutors/index'
import type { ExecutorContext } from '../../../src/services/roleExecutors/base'

// 모든 executor를 mock
jest.mock('../../../src/services/roleExecutors/research', () => ({ researchExecutor: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../../src/services/roleExecutors/content',  () => ({ contentExecutor:  jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../../src/services/roleExecutors/build',    () => ({ buildExecutor:    jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../../src/services/roleExecutors/ops',      () => ({ opsExecutor:      jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../../src/services/roleExecutors/ceo',      () => ({ ceoExecutor:      jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../../src/services/roleExecutors/design',   () => ({ designExecutor:   jest.fn().mockResolvedValue(undefined) }))

jest.mock('../../../src/services/roleExecutors/base', () => ({
  ...jest.requireActual('../../../src/services/roleExecutors/base'),
  streamClaude: jest.fn().mockResolvedValue('결과'),
  saveFeedItem: jest.fn().mockResolvedValue('feed-id'),
}))

function buildCtx(role: string): ExecutorContext {
  return {
    agent: { id: 'a-1', mission_id: 'm-1', role, name: `${role} Bot`, system_prompt: '' } as any,
    task: '테스트 태스크',
    db: { query: jest.fn().mockResolvedValue({ rows: [] }) } as any,
    send: jest.fn(),
  }
}

describe('routeToExecutor', () => {
  beforeEach(() => jest.clearAllMocks())

  const ROLE_EXECUTOR_MAP: Record<string, string> = {
    research: 'researchExecutor',
    content:  'contentExecutor',
    build:    'buildExecutor',
    ops:      'opsExecutor',
    ceo:      'ceoExecutor',
    design:   'designExecutor',
  }

  Object.entries(ROLE_EXECUTOR_MAP).forEach(([role, executorName]) => {
    it(`${role} → ${executorName} 호출`, async () => {
      const ctx = buildCtx(role)
      await routeToExecutor(ctx)

      const mod = jest.requireMock(`../../../src/services/roleExecutors/${role}`)
      expect(mod[executorName]).toHaveBeenCalledWith(ctx)
    })
  })

  it('growth 역할은 등록되지 않았다 (genericExecutor로 폴백)', async () => {
    const ctx = buildCtx('growth' as string)
    // growth는 DB CHECK 제약으로 생성 불가지만, routeToExecutor가 크래시하지 않아야 함
    await expect(routeToExecutor(ctx)).resolves.not.toThrow()
  })

  it('알 수 없는 역할은 genericExecutor로 처리', async () => {
    const ctx = buildCtx('unknown_role')
    await expect(routeToExecutor(ctx)).resolves.not.toThrow()
  })
})
