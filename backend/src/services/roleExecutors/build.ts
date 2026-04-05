import { streamClaude, saveFeedItem, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 시니어 풀스택 개발자입니다.
요청된 기능을 TypeScript/React/Node.js로 구현합니다.
코드는 실제로 작동해야 하며, 주요 로직을 포함해야 합니다.
응답 형식:
1. 구현 계획 (bullet points)
2. 코드 (파일별로 구분)
3. 테스트 방법`

export async function buildExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'planning', label: '구현 계획 수립 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔨 Build Bot 시작: ${task}`)

  // Create issue for tracking
  const { v4: uuidv4 } = require('uuid')
  const issueId = uuidv4()
  await db.query(
    `INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`,
    [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high']
  )
  send('issue_created', { issueId, title: task })

  send('stage', { stage: 'coding', label: 'AI 코드 생성 중...' })
  const code = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task)

  // Update issue to done
  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])

  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', code)
  send('build_done', { issueId })
}
