import { researchExecutor } from './research'
import { contentExecutor } from './content'
import { buildExecutor } from './build'
import { growthExecutor } from './growth'
import { opsExecutor } from './ops'
import { ceoExecutor } from './ceo'
import { designExecutor } from './design'
import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const DEFAULT_SYSTEM = `당신은 유능한 AI 어시스턴트입니다. 주어진 태스크를 최선을 다해 완료하세요.`

// Generic executor for integration role
async function genericExecutor(ctx: ExecutorContext): Promise<void> {
  await saveFeedItem(ctx.db, ctx.agent.id, 'info', `🤖 ${ctx.agent.name} 시작: ${ctx.task}`)
  const result = await streamClaude(ctx, ctx.agent.system_prompt || DEFAULT_SYSTEM, ctx.task)
  await saveFeedItem(ctx.db, ctx.agent.id, 'result', result)
  ctx.send('done_generic', { preview: result.slice(0, 200) })
}

export async function routeToExecutor(ctx: ExecutorContext): Promise<void> {
  const role = ctx.agent.role
  switch (role) {
    case 'research': return researchExecutor(ctx)
    case 'content': return contentExecutor(ctx)
    case 'build': return buildExecutor(ctx)
    case 'growth': return growthExecutor(ctx)
    case 'ops': return opsExecutor(ctx)
    case 'ceo': return ceoExecutor(ctx)
    case 'design': return designExecutor(ctx)
    default: return genericExecutor(ctx)
  }
}
