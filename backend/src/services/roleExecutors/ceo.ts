import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 AI 스타트업의 CEO 비서입니다.
모든 봇의 활동을 종합하여 CEO에게 명확한 브리핑을 제공합니다.

브리핑 형식:
## 이번 주 핵심 현황
[봇별 주요 성과 3줄 요약]

## 즉시 조치 필요
[우선순위 높은 이슈 목록]

## 추천 액션
[구체적이고 실행 가능한 다음 단계 3가지]

## 재무 현황
[AI 비용, 예산 대비 사용률]

항상 데이터 기반으로 판단하고, 불확실할 때는 명시적으로 표현하세요.`

export async function ceoExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'aggregating', label: '전체 봇 현황 수집 중...' })
  await saveFeedItem(db, agent.id, 'info', `👔 CEO Bot 시작: ${task}`)

  // Aggregate all bot activity
  const agents = await db.query(
    `SELECT id, name, role FROM agents WHERE mission_id = $1`,
    [agent.mission_id]
  )
  const agentRows = agents.rows as Array<{ id: string; name: string; role: string }>

  const feedSummary: Record<string, unknown[]> = {}
  for (const a of agentRows) {
    const feed = await db.query(
      `SELECT type, content, created_at FROM feed_items WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [a.id]
    )
    if ((feed.rows as unknown[]).length > 0) {
      feedSummary[`${a.name}(${a.role})`] = feed.rows
    }
  }

  const researchCount = await db.query(
    `SELECT COUNT(*) as cnt, filter_decision FROM research_items WHERE mission_id = $1 GROUP BY filter_decision`,
    [agent.mission_id]
  )

  const costSummary = await db.query(
    `SELECT SUM(cost_usd) as total, COUNT(*) as runs FROM token_usage WHERE mission_id = $1`,
    [agent.mission_id]
  )

  const userMessage = `태스크: ${task}

봇 활동 현황:
${JSON.stringify(feedSummary, null, 2)}

리서치 현황:
${JSON.stringify(researchCount.rows, null, 2)}

AI 비용 현황:
${JSON.stringify(costSummary.rows, null, 2)}

위 데이터를 바탕으로 CEO 브리핑을 작성해주세요.`

  send('stage', { stage: 'briefing', label: 'CEO 브리핑 생성 중...' })
  const briefing = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, userMessage, DEFAULT_MODEL)

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', briefing, true) // requires approval
  send('ceo_done', { preview: briefing.slice(0, 300) })
}
