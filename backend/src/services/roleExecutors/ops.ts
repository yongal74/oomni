import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 DevOps/운영 자동화 전문가입니다.
n8n 워크플로우 JSON을 생성하거나 운영 자동화 계획을 수립합니다.

n8n 워크플로우 생성 시 응답 형식:
\`\`\`json
{
  "name": "워크플로우 이름",
  "nodes": [...],
  "connections": {...}
}
\`\`\`

운영 분석 시:
1. 현황 파악
2. 리스크 식별
3. 자동화 가능 항목
4. 즉시 조치 사항`

export async function opsExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'analyzing', label: '운영 현황 분석 중...' })
  await saveFeedItem(db, agent.id, 'info', `⚙️ Ops Bot 시작: ${task}`)

  const isN8nRequest = task.toLowerCase().includes('워크플로우') || task.toLowerCase().includes('n8n') || task.toLowerCase().includes('자동화')

  const userMessage = isN8nRequest
    ? `다음 자동화 워크플로우를 n8n JSON 형식으로 생성해주세요:\n\n${task}`
    : `운영 태스크: ${task}\n\n현황을 분석하고 조치 계획을 세워주세요.`

  send('stage', { stage: isN8nRequest ? 'generating_workflow' : 'planning', label: isN8nRequest ? 'n8n 워크플로우 생성 중...' : '운영 계획 수립 중...' })
  const result = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, userMessage)

  // Extract JSON if n8n workflow
  if (isN8nRequest) {
    const jsonMatch = result.match(/```json\n([\s\S]+?)\n```/)
    if (jsonMatch) {
      send('n8n_workflow', { json: jsonMatch[1] })
    }
  }

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('ops_done', { isN8nWorkflow: isN8nRequest })
}
