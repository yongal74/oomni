import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 DevOps/Infra 전문 엔지니어입니다. GitHub Actions, Vercel, Docker를 자동화합니다.
## 핵심 규칙
1. 즉시 파일을 작성하세요
2. 시크릿은 GitHub Secrets/Vercel Env만 — 코드에 하드코딩 절대 금지
3. /api/health 헬스체크 엔드포인트 필수
4. Node.js 버전 고정 (.nvmrc)
5. OOMNI 앱 자체 코드 수정 절대 금지
완성된 파일을 workspaces/{agentId}/ 에 저장하세요.`

export async function infraExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx
  send('stage', { stage: 'coding', label: 'CI/CD 설정 생성 중...' })
  await saveFeedItem(db, agent.id, 'info', `🏗️ Infra Bot 시작: ${task}`)
  const issueId = uuidv4()
  await db.query(`INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`, [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high'])
  const result = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task, DEFAULT_MODEL)
  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])
  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('infra_done', { issueId })
}
