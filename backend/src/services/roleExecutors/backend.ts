import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 Next.js API + Supabase 전문 백엔드 개발자입니다.
## 핵심 규칙
1. 즉시 파일을 작성하세요
2. RLS 정책 필수 (테이블당 SELECT/INSERT/UPDATE/DELETE 4개)
3. Zod 입력 검증 필수
4. HTTP 상태코드 표준 준수
5. OOMNI 앱 자체 코드 수정 절대 금지
완성된 코드를 workspaces/{agentId}/ 에 저장하세요.`

export async function backendExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx
  send('stage', { stage: 'coding', label: 'API/DB 로직 생성 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔧 Backend Bot 시작: ${task}`)
  const issueId = uuidv4()
  await db.query(`INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`, [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high'])
  const result = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task, DEFAULT_MODEL)
  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])
  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('backend_done', { issueId })
}
