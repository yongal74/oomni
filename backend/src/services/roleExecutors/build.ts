import fs from 'fs'
import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

type BuildTrack = 'architecture' | 'bootstrap' | 'review' | 'security' | 'build'

const DATA_ROOT =
  process.platform === 'win32'
    ? 'C:/oomni-data'
    : path.join(os.homedir(), 'oomni-data')

// ── Track Classification ───────────────────────────────────────────────────────
function classifyBuildTrack(task: string): BuildTrack {
  const t = task.toLowerCase()
  if (/arch|설계|시스템 설계|컴포넌트|데이터 모델|erd|아키텍처|wbs|prd/.test(t)) return 'architecture'
  if (/bootstrap|부트스트랩|초기세팅|초기 세팅|scaffold|boilerplate|프로젝트 생성|프로젝트 초기/.test(t)) return 'bootstrap'
  if (/review|리뷰|코드 리뷰|검토|코드 검토|점검/.test(t)) return 'review'
  if (/security|보안|owasp|취약점|security audit|보안 감사/.test(t)) return 'security'
  return 'build'
}

// ── System Prompts ─────────────────────────────────────────────────────────────
const ARCH_PROMPT = `당신은 시니어 소프트웨어 아키텍트입니다. 다음 순서로 문서를 작성하세요.

## 1. 시스템 컨텍스트
- 목적, 핵심 사용자, 외부 시스템 의존성

## 2. 컴포넌트 분해
- 레이어 구조 (프론트엔드 / 백엔드 / DB / 외부 API)
- 각 컴포넌트 책임 한 줄 요약

## 3. 데이터 모델
- 핵심 엔티티와 관계 (텍스트 ERD)
- 주요 필드와 타입

## 4. 기술스택 결정 (ADR 형식)
- 결정 사항, 이유 (pros/cons), 대안

## 5. 핵심 리스크 & 완화
- 리스크 3가지, 각각 완화 방안

## 6. WBS (작업 분해)
- 에픽 → 스토리 → 태스크 (3레벨)
- 우선순위: P1(필수) / P2(중요) / P3(선택)`

const BOOTSTRAP_PROMPT = `당신은 풀스택 개발자입니다. 프로젝트 초기 세팅 파일들을 생성하세요.

각 파일을 \`\`\`<언어> // <파일경로>\` 형식으로 구분하세요.

포함 파일:
- package.json (의존성 완전 포함, scripts: dev/build/test/lint)
- .env.example (모든 필수 환경변수, 실제 값 절대 금지)
- .gitignore
- CLAUDE.md (프로젝트 운영 원칙, 표준 명령, 완료 기준)
- README.md (설치/실행 방법)

필수 규칙:
- .env.example에 실제 시크릿 값 포함 절대 금지
- 모든 쉘 명령어 앞에 \`# 실행:\` 주석 추가`

const REVIEW_PROMPT = `당신은 시니어 코드 리뷰어입니다. 다음 기준으로 분석하세요.

심각도 분류: CRITICAL / HIGH / MEDIUM / LOW
- CRITICAL: 데이터 손실, 보안 취약점, 서비스 중단 가능성
- HIGH: 잘못된 동작, 예외 미처리
- MEDIUM: 엣지케이스 누락, 성능 저하
- LOW: 코드 스타일, 미사용 변수

🚨 CRITICAL 항목은 반드시 "🚨 CRITICAL:" 접두어 사용.

## 버그 분석
각 버그: 파일명:줄번호, 심각도, 설명, 수정 방법

## 성능 분석
N+1 쿼리, 불필요한 re-render, 메모리 누수

## 코드 품질
기술부채, 코드 냄새, 복잡도

## 개선 제안
각 항목에 Before/After 코드 포함`

const SECURITY_PROMPT = `당신은 보안 전문가입니다. OWASP Top 10 기준으로 분석하세요.

🚨 CRITICAL 발견 시 반드시 "🚨 CRITICAL:" 접두어 사용.

## Gate A — 사전 체크
- A1: 하드코딩된 시크릿/API 키 여부
- A2: 인증 없는 데이터 변경 엔드포인트
- A3: DB RLS/권한 미설정

## Gate B — 코드 분석 (OWASP Top 10)
- B1: Broken Access Control
- B2: Cryptographic Failures
- B3: Injection (SQL, NoSQL, Command)
- B4: Insecure Design
- B5: Security Misconfiguration
- B6: Vulnerable Components
- B7: Authentication Failures
- B8: Software Integrity Failures
- B9: Logging Failures
- B10: SSRF

## Gate C — 배포 전 체크
- C1: HTTPS 강제 여부
- C2: Rate Limiting 설정
- C3: 에러 메시지 정보 노출
- C4: 의존성 취약점 (npm audit)

각 항목: ✅ 안전 / ⚠️ 주의 / 🚨 CRITICAL 로 표시`

const SECURITY_GATE_PROMPT = `당신은 보안 자동화 시스템입니다. 방금 생성된 코드를 빠르게 스캔하세요.

CRITICAL 이슈 발견 시 "🚨 CRITICAL: " 접두어로 시작하는 줄을 추가하세요.

체크 항목:
1. 하드코딩된 API 키, 패스워드, 시크릿 → CRITICAL
2. SQL 쿼리 직접 문자열 결합 (SQL Injection) → CRITICAL
3. eval() 또는 innerHTML 사용 → HIGH
4. 인증 없는 데이터 변경 API → CRITICAL
5. 환경변수 미검증 process.env 직접 사용 → MEDIUM
6. console.log에 민감 데이터 출력 → HIGH

결과: "✅ 보안 이상 없음" 또는 발견된 이슈 목록 (파일명:줄번호 포함)`

const BUILD_PROMPT = `당신은 시니어 풀스택 개발자입니다.
요청된 기능을 TypeScript/React/Node.js로 구현합니다.
코드는 실제로 작동해야 하며, 주요 로직을 포함해야 합니다.

각 파일을 \`\`\`<언어> // <파일경로>\` 형식으로 구분하세요.

응답 형식:
1. 구현 계획 (bullet points)
2. 코드 (파일별로 구분)
3. 테스트 방법`

// ── File Saving ────────────────────────────────────────────────────────────────
function saveResultFiles(agentId: string, code: string): string[] {
  const workspaceDir = path.join(DATA_ROOT, 'workspaces', agentId)
  fs.mkdirSync(workspaceDir, { recursive: true })

  const savedPaths: string[] = []
  const codeBlockRegex = /```(?:[a-z]*)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  let blockIndex = 0

  while ((match = codeBlockRegex.exec(code)) !== null) {
    const body = match[1]
    const firstLine = body.split('\n')[0].trim()
    const filenameHint = firstLine.match(/^(?:\/\/|#)\s*(.+\.\w+)\s*$/)

    let relPath: string
    if (filenameHint) {
      relPath = filenameHint[1].replace(/^[/\\]/, '')
    } else {
      blockIndex++
      relPath = `result-${blockIndex}.md`
    }

    const absPath = path.join(workspaceDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, body, 'utf-8')
    savedPaths.push(relPath)
  }

  if (savedPaths.length === 0) {
    const absPath = path.join(workspaceDir, 'result.md')
    fs.writeFileSync(absPath, code, 'utf-8')
    savedPaths.push('result.md')
  }

  return savedPaths
}

// ── Security Gate — runs after code generation ─────────────────────────────────
async function runSecurityGate(ctx: ExecutorContext, generatedCode: string): Promise<{ hasCritical: boolean; report: string }> {
  ctx.send('stage', { stage: 'security_scan', label: '🔒 보안 자동 스캔 중...' })
  const snippet = generatedCode.slice(0, 8000) // context limit
  const report = await streamClaude(
    ctx,
    SECURITY_GATE_PROMPT,
    `다음 코드를 보안 스캔하세요:\n\n${snippet}`,
    DEFAULT_MODEL,
    1024
  )
  const hasCritical = report.includes('🚨 CRITICAL:')
  return { hasCritical, report }
}

// ── Read workspace files for review/security tracks ────────────────────────────
function readWorkspaceContext(agentId: string, extensions: RegExp, maxFiles = 6, maxCharsPerFile = 2000): string {
  const workspaceDir = path.join(DATA_ROOT, 'workspaces', agentId)
  let context = ''
  try {
    const allFiles = fs.readdirSync(workspaceDir, { recursive: true }) as string[]
    const codeFiles = allFiles.filter(f => extensions.test(String(f))).slice(0, maxFiles)
    for (const f of codeFiles) {
      const content = fs.readFileSync(path.join(workspaceDir, String(f)), 'utf-8')
      context += `\n\n### ${f}\n\`\`\`\n${content.slice(0, maxCharsPerFile)}\n\`\`\``
    }
  } catch { /* no workspace yet */ }
  return context
}

// ── Main Executor ──────────────────────────────────────────────────────────────
export async function buildExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx
  const track = classifyBuildTrack(task)

  await saveFeedItem(db, agent.id, 'info', `🔨 Build Bot [${track.toUpperCase()}] 시작: ${task}`)

  const issueId = uuidv4()
  await db.query(
    `INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`,
    [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high']
  )
  send('issue_created', { issueId, title: task, track })

  let output = ''
  let savedFiles: string[] = []

  // ── Architecture Track ───────────────────────────────────────────────────────
  if (track === 'architecture') {
    send('stage', { stage: 'architecture', label: '🏗️ 아키텍처 설계 중...' })
    output = await streamClaude(ctx, ARCH_PROMPT, task)

    send('stage', { stage: 'saving', label: '문서 저장 중...' })
    try {
      savedFiles = saveResultFiles(agent.id, output)
      send('files_saved', { files: savedFiles })
    } catch { /* ignore */ }

    await saveFeedItem(db, agent.id, 'result', output)

  // ── Bootstrap Track ──────────────────────────────────────────────────────────
  } else if (track === 'bootstrap') {
    send('stage', { stage: 'bootstrap', label: '🚀 프로젝트 부트스트랩 중...' })
    output = await streamClaude(ctx, BOOTSTRAP_PROMPT, task)

    const { hasCritical, report } = await runSecurityGate(ctx, output)
    if (hasCritical) {
      await saveFeedItem(db, agent.id, 'approval', `🚨 보안 이슈 발견 — 파일 저장 전 검토하세요:\n\n${report}`, true)
      send('security_critical', { report })
    } else {
      await saveFeedItem(db, agent.id, 'info', `✅ 보안 사전 체크 통과\n\n${report}`)
    }

    send('stage', { stage: 'saving', label: '파일 저장 중...' })
    try {
      savedFiles = saveResultFiles(agent.id, output)
      send('files_saved', { files: savedFiles })
    } catch { /* ignore */ }

    await saveFeedItem(db, agent.id, 'result', output)

  // ── Review Track ─────────────────────────────────────────────────────────────
  } else if (track === 'review') {
    send('stage', { stage: 'review', label: '🔍 코드 리뷰 중...' })
    const fileContext = readWorkspaceContext(agent.id, /\.(ts|tsx|js|jsx|py|go)$/)
    const userMsg = task + (fileContext ? `\n\n워크스페이스 파일:\n${fileContext}` : '')
    output = await streamClaude(ctx, REVIEW_PROMPT, userMsg)

    const hasCritical = output.includes('🚨 CRITICAL:')
    if (hasCritical) {
      await saveFeedItem(db, agent.id, 'approval', `🚨 리뷰 결과 — CRITICAL 이슈 발견 (승인 필요):\n\n${output}`, true)
      send('security_critical', { report: output })
    } else {
      await saveFeedItem(db, agent.id, 'result', output)
    }

  // ── Security Track ───────────────────────────────────────────────────────────
  } else if (track === 'security') {
    send('stage', { stage: 'security_full', label: '🔒 전체 보안 감사 중...' })
    const fileContext = readWorkspaceContext(agent.id, /\.(ts|tsx|js|jsx|py)$/, 8, 1500)
    const userMsg = task + (fileContext ? `\n\n분석 대상:\n${fileContext}` : '')
    output = await streamClaude(ctx, SECURITY_PROMPT, userMsg)

    const hasCritical = output.includes('🚨 CRITICAL:')
    if (hasCritical) {
      await saveFeedItem(db, agent.id, 'approval', `🚨 보안 감사 결과 (승인 필요):\n\n${output}`, true)
      send('security_critical', { report: output })
    } else {
      await saveFeedItem(db, agent.id, 'result', output)
    }

  // ── Build Track (default) ────────────────────────────────────────────────────
  } else {
    send('stage', { stage: 'coding', label: '💻 코드 생성 중...' })
    output = await streamClaude(ctx, agent.system_prompt || BUILD_PROMPT, task)

    const { hasCritical, report } = await runSecurityGate(ctx, output)
    if (hasCritical) {
      await saveFeedItem(db, agent.id, 'approval', `🚨 보안 이슈 발견 — 검토 후 승인하세요:\n\n${report}`, true)
      send('security_critical', { report })
    } else {
      await saveFeedItem(db, agent.id, 'info', `✅ 보안 검사 통과`)
    }

    send('stage', { stage: 'saving', label: '파일 저장 중...' })
    try {
      savedFiles = saveResultFiles(agent.id, output)
      send('files_saved', { files: savedFiles, workspaceDir: path.join(DATA_ROOT, 'workspaces', agent.id) })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await saveFeedItem(db, agent.id, 'error', `파일 저장 실패: ${errMsg}`)
    }

    const savedSummary = savedFiles.length > 0
      ? `\n\n---\n**저장된 파일 (${savedFiles.length}개)**\n${savedFiles.map(f => `- \`${f}\``).join('\n')}`
      : ''
    await saveFeedItem(db, agent.id, 'result', output + savedSummary)
  }

  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])
  send('stage', { stage: 'done', label: '✅ 완료' })
  send('build_done', { issueId, savedFiles, track })
}
