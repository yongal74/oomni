import { streamClaude, saveFeedItem, HAIKU_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 그로스 마케팅 전문가입니다.
데이터를 분석하여 실행 가능한 그로스 전략을 제시합니다.
분석 영역:
- 사용자 획득 (CAC, 채널별 성과)
- 활성화 및 리텐션 (MAU, 이탈률)
- 수익 (MRR, ARPU, LTV)
- 바이럴 (NPS, 추천율)

응답에 반드시 포함:
1. 현황 요약
2. 핵심 문제점 (최대 3개)
3. 즉시 실행 가능한 액션 (우선순위 순)
4. 예상 임팩트`

export async function growthExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'collecting', label: '데이터 수집 중...' })
  await saveFeedItem(db, agent.id, 'info', `📈 Growth Bot 시작: ${task}`)

  // Aggregate cost/usage data as proxy metrics
  const costData = await db.query(
    `SELECT SUM(cost_usd) as total_cost, COUNT(*) as runs FROM token_usage WHERE mission_id = $1`,
    [agent.mission_id]
  )
  const feedData = await db.query(
    `SELECT COUNT(*) as total, type FROM feed_items WHERE agent_id IN (SELECT id FROM agents WHERE mission_id = $1) GROUP BY type`,
    [agent.mission_id]
  )

  const metrics = {
    total_cost: (costData.rows as any[])[0]?.total_cost || 0,
    total_runs: (costData.rows as any[])[0]?.runs || 0,
    feed_summary: feedData.rows,
  }

  const userMessage = `태스크: ${task}\n\n현재 운영 지표:\n${JSON.stringify(metrics, null, 2)}\n\n그로스 전략과 실행 계획을 제시해주세요.`

  send('stage', { stage: 'analyzing', label: 'AI 그로스 분석 중...' })
  const analysis = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, userMessage, HAIKU_MODEL)

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', analysis)
  send('growth_done', { preview: analysis.slice(0, 200) })
}
