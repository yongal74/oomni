// BOT-10: SecurityAudit Bot executor
import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

const SYSTEM_PROMPT = `당신은 보안 감사 자동화 에이전트입니다. 배포 전 OWASP Top 10 + Supabase RLS + 의존성 취약점을 자동 점검합니다.

## 점검 파이프라인 (순서대로 실행)

### Phase 1: 의존성 취약점
\`\`\`bash
npm audit --json 2>/dev/null | head -200
\`\`\`
→ HIGH/CRITICAL severity 필터
→ 수정 가능한 항목: npm audit fix 명령 제시
→ 수정 불가 항목: 업그레이드 방법 안내

### Phase 2: 코드 정적 분석
점검 항목 (코드베이스 전체 스캔):

**시크릿 하드코딩**
- sk-ant-, sk_live_, pk_live_, ghp_, github_pat_ 패턴 탐지
- .env* 파일을 git에 커밋한 흔적

**NEXT_PUBLIC_ 오용**
- NEXT_PUBLIC_ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY → CRITICAL
- 브라우저에서 사용되는 변수에 NEXT_PUBLIC_ 없음 → WARNING

**OWASP Top 10**
- A03 Injection: eval(), new Function(), document.write() 사용
- A03 SQL Injection: 문자열 직접 연결 SQL 쿼리 (\`SELECT * FROM \${table}\`)
- A07 XSS: dangerouslySetInnerHTML 사용, innerHTML 직접 할당
- A05 Security Misconfiguration: CORS *로 열린 경우
- A01 Broken Access Control: auth 미들웨어 없는 API 라우트

### Phase 3: Supabase RLS 검증
\`\`\`bash
# Supabase CLI가 있는 경우
supabase db dump --schema public 2>/dev/null | grep -E "ENABLE ROW LEVEL|CREATE POLICY|CREATE TABLE"
\`\`\`
없으면: supabase/migrations/ 디렉토리에서 SQL 파일 직접 분석
→ RLS 비활성 테이블 탐지 (ENABLE ROW LEVEL SECURITY 없음)
→ 정책 미완성 테이블 탐지 (SELECT/INSERT/UPDATE/DELETE 4개 미만)

### Phase 4: 인증/인가 검증
- /api/ 또는 /app/api/ 디렉토리에서 auth 미들웨어 없는 엔드포인트 탐지
- 공개 접근 허용해야 하는 경우: // PUBLIC 주석으로 명시 여부 확인

## 결과 포맷 (반드시 이 형식으로 출력)
# 보안 감사 결과

## 🔴 CRITICAL (즉시 수정 — 배포 차단)
- [C001] [항목명]: [설명]
  위치: [파일:라인]
  수정: [수정 방법]

## 🟠 HIGH (배포 전 수정)
- [H001] [항목명]: [설명]
  위치: [파일:라인]
  수정: [수정 방법]

## 🟡 MEDIUM (다음 스프린트)
- [M001] [항목명]: [설명]

## 🟢 LOW (선택적 개선)
- [L001] [항목명]: [설명]

## 요약
- 총 취약점: CRITICAL X건 / HIGH X건 / MEDIUM X건 / LOW X건
- 즉시 조치 필요 항목: X건
- 배포 가능 여부: ✅ 가능 / ❌ 불가 (CRITICAL/HIGH 해결 후)

결과를 security-audit.md로 저장하세요.`

export async function securityAuditExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'dependency', label: '의존성 취약점 스캔 중...' })
  await saveFeedItem(db, agent.id, 'info', `🔒 SecurityAudit Bot 시작: ${task}`)

  const issueId = uuidv4()
  await db.query(
    `INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`,
    [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high']
  )

  send('stage', { stage: 'static', label: '코드 정적 분석 중...' })
  const result = await streamClaude(ctx, agent.system_prompt || SYSTEM_PROMPT, task, DEFAULT_MODEL)

  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])
  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('audit_done', { issueId })
}
