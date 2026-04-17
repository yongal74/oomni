import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 React/TypeScript UI 전문 개발자입니다. Tailwind CSS + shadcn/ui 기반 프론트엔드 코드를 생성합니다.
## 핵심 규칙
1. 즉시 파일을 작성하세요 — 분석만 하지 말 것
2. TypeScript strict 모드 — any 금지
3. shadcn/ui 컴포넌트 우선 사용
4. mobile-first 반응형 (Tailwind)
5. OOMNI 앱 자체 코드 수정 절대 금지
완성된 코드를 workspaces/{agentId}/ 에 저장하세요.`

export async function frontendExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx
  send('stage', { stage: 'coding', label: 'UI 컴포넌트 생성 중...' })
  await saveFeedItem(db, agent.id, 'info', `⚛️ Frontend Bot 시작: ${task}`)
  const issueId = uuidv4()
  await db.query(`INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`, [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high'])
  const result = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task, DEFAULT_MODEL)
  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])
  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('frontend_done', { issueId })
}
