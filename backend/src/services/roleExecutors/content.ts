import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 전문 콘텐츠 작가입니다.
리서치 데이터를 기반으로 고품질 콘텐츠를 한국어로 작성합니다.
타겟: B2B SaaS 스타트업 팀
톤: 전문적이지만 읽기 쉬운 스타일
항상 구체적인 인사이트와 실행 가능한 조언을 포함하세요.`

export async function contentExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'preparing', label: '리서치 데이터 로딩...' })
  await saveFeedItem(db, agent.id, 'info', `✍️ Content Bot 시작: ${task}`)

  // Get kept research items
  const researchItems = await db.query(
    `SELECT title, summary, tags FROM research_items WHERE mission_id = $1 AND filter_decision = 'keep' ORDER BY signal_score DESC LIMIT 10`,
    [agent.mission_id]
  )
  const items = researchItems.rows as Array<{ title: string; summary: string; tags: string }>

  let userMessage = `태스크: ${task}\n\n`
  if (items.length > 0) {
    userMessage += `활용할 리서치 데이터:\n`
    for (const item of items) {
      userMessage += `\n• ${item.title}: ${item.summary}\n`
    }
  }

  send('stage', { stage: 'writing', label: 'AI 콘텐츠 생성 중...' })
  const content = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, userMessage)

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', content)
  send('content_done', { preview: content.slice(0, 200) })
}
