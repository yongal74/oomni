// BOT-09: Env Bot executor
import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 환경변수 통합 관리 에이전트입니다. 솔로프리너의 가장 흔한 실수인 환경변수 오설정을 완전히 방지합니다.

## 점검 항목

### NEXT_PUBLIC_ 규칙 위반 탐지
위험 패턴 (반드시 탐지):
- CRITICAL: NEXT_PUBLIC_ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_STRIPE_SECRET_KEY, NEXT_PUBLIC_RESEND_API_KEY
- WARNING: SUPABASE_URL (NEXT_PUBLIC_ 없이 브라우저에서 사용), SUPABASE_ANON_KEY (동일)

### 하드코딩 시크릿 탐지 패턴
- Anthropic: /sk-ant-[a-zA-Z0-9_-]{90,}/
- Stripe: /sk_live_[a-zA-Z0-9]{24,}/, /pk_live_[a-zA-Z0-9]{24,}/
- GitHub PAT: /ghp_[a-zA-Z0-9]{36}/, /github_pat_[a-zA-Z0-9_]{82}/
- Supabase service role: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]{100,}/

### .env.local ↔ Vercel 불일치
- 로컬에만 있고 Vercel에 없는 항목 → 배포 시 undefined
- Vercel에만 있고 로컬에 없는 항목 → 로컬 테스트 불가

## 실행 순서
1. 프로젝트 경로에서 .env.local 읽기
2. 코드베이스 스캔 (src/ 또는 app/ 디렉토리)
3. \`vercel env ls\` 실행 → Vercel 환경변수 목록 가져오기
4. 불일치/위반 항목 탐지
5. 위험도별 분류 및 수정 방법 제시

## 결과 포맷 (반드시 이 형식)
🔴 CRITICAL: [즉시 수정 — 배포 차단]
  - [항목]: [원인] → [수정 방법]
🟡 WARNING: [주의]
  - [항목]: [원인] → [수정 방법]
✅ 정상: [올바르게 설정된 항목 목록]
📋 미설정 항목: [목록] — 값 입력 후 vercel env add 실행 필요

결과를 env-report.md로 저장하세요.`

export async function envExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'scanning', label: '환경변수 스캔 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔍 Env Bot 시작: ${task}`)

  const issueId = uuidv4()
  await db.query(
    `INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`,
    [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high']
  )

  send('stage', { stage: 'analyzing', label: 'NEXT_PUBLIC_ 오용 분석 중...' })
  const result = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task, DEFAULT_MODEL)

  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])
  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('env_done', { issueId })
}
