# OOMNI v3.1 — 아키텍처 & 기술 스펙

> 작성일: 2026-04-18 | 대상 버전: v3.1.0 (Phase 2)
> Phase 2 신규 봇: BOT-08 ProjectSetup / BOT-09 Env / BOT-10 SecurityAudit / BOT-11 Build 세분화

---

## 1. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    OOMNI Electron Desktop App                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Frontend (React + Vite)                     │   │
│  │                                                         │   │
│  │  DashboardPage   PtyBotPage   SetupWizardPage (신규)    │   │
│  │  UnifiedBotPage  ResearchPage CostPage                  │   │
│  │                                                         │   │
│  │  [Zustand Store] [React Query] [xterm.js WebSocket]     │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                         │ HTTP / WebSocket                      │
│  ┌─────────────────────▼───────────────────────────────────┐   │
│  │              Backend (Express + Node.js)                  │   │
│  │                                                         │   │
│  │  Routes: agents, missions, feed, cost, reports          │   │
│  │          ↕ NEW: /api/agents/:id/setup-wizard            │   │
│  │                                                         │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │           ClaudeCodeService (핵심 실행 엔진)       │  │   │
│  │  │                                                  │  │   │
│  │  │  역할별 모델 라우팅:                                │  │   │
│  │  │   research/growth → Haiku-4.5                    │  │   │
│  │  │   build/design/ops/content → Sonnet-4.6          │  │   │
│  │  │   ceo → Opus-4.6                                 │  │   │
│  │  │   project_setup/env/security_audit → Sonnet-4.6  │  │   │
│  │  │   frontend/backend/infra → Sonnet-4.6            │  │   │
│  │  │                                                  │  │   │
│  │  │  역할별 MCP 서버:                                  │  │   │
│  │  │   design → Pencil MCP (local binary, stdio)      │  │   │
│  │  │   ops → n8n-mcp (global npm, stdio)              │  │   │
│  │  │   기타 역할 → MCP 없음                             │  │   │
│  │  │                                                  │  │   │
│  │  │  실행 방식:                                        │  │   │
│  │  │   --print mode → SSE 스트리밍 (/chat)             │  │   │
│  │  │   PTY mode → WebSocket 실시간 (/terminal)         │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │  AgentRunner  │  │  PtyService  │  │ roleExecutors│  │   │
│  │  │ (heartbeat)  │  │ (WS+node-pty)│  │ (SDK direct) │  │   │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │   │
│  │                                                         │   │
│  │  SQLite (better-sqlite3)  |  Winston Logger             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Claude Code CLI subprocess (node_modules 절대경로 직접 실행)    │
│   └─ --mcp-config (design/ops만 해당)                           │
│   └─ --dangerously-skip-permissions                            │
│   └─ workspace: C:/oomni-data/workspaces/{agentId}/            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 2 신규 봇 — 역할 정의

### 2-1. 역할 타입 확장

```typescript
// backend/src/db/types.ts (현재 → v3.1)
export type AgentRole =
  // Phase 1 (기존)
  | 'research' | 'build' | 'design' | 'content'
  | 'growth' | 'ops' | 'integration' | 'ceo'
  // Phase 2 (신규)
  | 'project_setup'    // BOT-08: 프로젝트 초기화 자동화
  | 'env'              // BOT-09: 환경변수 통합 관리
  | 'security_audit'   // BOT-10: 보안 감사 자동화
  | 'frontend'         // BOT-11-A: UI/React 전문 빌드
  | 'backend'          // BOT-11-B: API/DB 전문 빌드
  | 'infra';           // BOT-11-C: CI/CD/배포 전문
```

### 2-2. 역할별 실행 스택

| 봇 | 역할 | 모델 | 실행 방식 | MCP |
|---|---|---|---|---|
| ProjectSetup Bot | `project_setup` | Sonnet-4.6 | PTY | 없음 |
| Env Bot | `env` | Sonnet-4.6 | PTY | 없음 |
| SecurityAudit Bot | `security_audit` | Sonnet-4.6 | PTY | 없음 |
| Frontend Bot | `frontend` | Sonnet-4.6 | PTY | 없음 |
| Backend Bot | `backend` | Sonnet-4.6 | PTY | 없음 |
| Infra Bot | `infra` | Sonnet-4.6 | PTY | 없음 |

> **원칙**: Phase 2 봇은 모두 PTY 모드 (Build Bot과 동일한 실행 방식). Claude Code CLI subprocess → `--dangerously-skip-permissions`

---

## 3. BOT-08 ProjectSetup Bot — 상세 아키텍처

### 3-1. 입력 플로우 (5-Question Wizard)

```
SetupWizardPage (React)
  ↓ POST /api/agents/:id/setup-wizard
Backend: buildSetupPrompt(answers) → PTY 세션 실행
  ↓ Claude Code CLI
  → npx create-next-app@latest {appName}
  → .env.local 생성 (스택 기반 템플릿)
  → supabase db push (Supabase CLI)
  → gh repo create {appName}
  → vercel link + vercel env add
  → npx shadcn@latest init
  → .github/workflows/deploy.yml 생성
```

### 3-2. 5개 질문 → 자동 작업 매핑

```typescript
interface SetupAnswers {
  appName: string;          // Q1. 앱 이름
  appType: 'web' | 'mobile' | 'desktop'; // Q2. 형태
  needsAI: boolean;         // Q3. AI 기능?
  needsPayment: boolean;    // Q4. 결제?
  market: 'domestic' | 'global'; // Q5. 국내/글로벌
}

// 답변 기반 자동 스택 결정
function resolveStack(answers: SetupAnswers): StackConfig {
  return {
    framework: 'next.js',
    auth: 'supabase',
    db: 'supabase-postgres',
    ai: answers.needsAI ? 'anthropic' : null,
    payment: answers.needsPayment
      ? (answers.market === 'domestic' ? 'toss' : 'stripe')
      : null,
    email: 'resend',
    analytics: 'posthog',
  };
}
```

### 3-3. .env.local 템플릿 자동 생성

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # 브라우저 노출 OK
SUPABASE_SERVICE_ROLE_KEY=       # ⚠️ 절대 NEXT_PUBLIC_ 붙이지 말 것
ANTHROPIC_API_KEY=               # ⚠️ 서버 전용
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # 결제 (글로벌)
STRIPE_SECRET_KEY=               # ⚠️ 서버 전용
RESEND_API_KEY=                  # 이메일 발송
NEXT_PUBLIC_POSTHOG_KEY=         # 분석
```

### 3-4. 반자동 항목 가이드 생성

```typescript
// Google OAuth: API 제한으로 자동화 불가
// → Claude가 등록해야 할 URI 목록 텍스트 생성
const oauthGuide = {
  redirectUris: [
    `http://localhost:3000`,
    `https://{projectId}.supabase.co/auth/v1/callback`,
    `https://{appName}.vercel.app/auth/callback`,
  ],
  consoleUrl: 'https://console.cloud.google.com/apis/credentials',
};

// Stripe 타임라인 알림
// → 신청일 입력 → 예상 완료일 계산
```

---

## 4. BOT-09 Env Bot — 상세 아키텍처

### 4-1. 기능 구성

```
Env Bot
├── 스캔 (정적 분석)
│   ├── NEXT_PUBLIC_ 오용 탐지
│   │   ├── 서버전용 키에 붙인 경우 (ANTHROPIC_API_KEY → 위험)
│   │   └── 브라우저 키에 안 붙인 경우 (SUPABASE_URL → 경고)
│   └── 하드코딩된 시크릿 패턴 탐지
│       ├── API 키 패턴: /sk-[a-zA-Z0-9]{48}/
│       ├── Supabase Service Role: /eyJ.{100,}/
│       └── GitHub PAT: /ghp_[a-zA-Z0-9]{36}/
│
├── 동기화 (실행)
│   ├── .env.local 읽기/쓰기
│   ├── Vercel env add (CLI)
│   └── 로컬 ↔ Vercel 불일치 리포트
│
└── 가이드 생성
    ├── 서비스별 API 키 발급 URL
    └── 체크리스트 자동 생성
```

### 4-2. 위험도 분류

```typescript
type EnvRisk = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const ENV_RULES: EnvRule[] = [
  { pattern: /ANTHROPIC_API_KEY/, prefix: 'NEXT_PUBLIC_', risk: 'CRITICAL',
    message: 'Anthropic API 키가 브라우저에 노출됩니다!' },
  { pattern: /SUPABASE_SERVICE_ROLE_KEY/, prefix: 'NEXT_PUBLIC_', risk: 'CRITICAL',
    message: 'Supabase 서비스 롤 키가 노출되면 RLS 우회 가능!' },
  { pattern: /STRIPE_SECRET_KEY/, prefix: 'NEXT_PUBLIC_', risk: 'CRITICAL',
    message: 'Stripe 비밀 키 노출 — 결제 조작 위험' },
  { pattern: /SUPABASE_URL$/, noPrefixWarning: true, risk: 'MEDIUM',
    message: 'NEXT_PUBLIC_SUPABASE_URL로 변경 권장' },
];
```

---

## 5. BOT-10 SecurityAudit Bot — 상세 아키텍처

### 5-1. 점검 파이프라인

```
SecurityAudit Bot
├── Phase 1: 의존성 취약점
│   └── npm audit --json → 파싱 → HIGH/CRITICAL 필터
│
├── Phase 2: 코드 정적 분석
│   ├── 하드코딩 시크릿 (Env Bot과 동일 엔진)
│   ├── SQL Injection 패턴 (문자열 직접 연결)
│   ├── XSS 위험 (dangerouslySetInnerHTML)
│   └── NEXT_PUBLIC_ 오용
│
├── Phase 3: Supabase RLS 검증
│   ├── supabase db dump → 테이블 목록
│   ├── RLS enabled 여부 확인
│   └── SELECT/INSERT/UPDATE/DELETE 4개 정책 존재 확인
│
└── Phase 4: 인증/인가 검증
    ├── 미인증 API 엔드포인트 탐지
    └── CORS 설정 확인
```

### 5-2. 결과 포맷

```
🔴 CRITICAL (즉시 수정)
  - [C001] ANTHROPIC_API_KEY가 NEXT_PUBLIC_ 접두사로 노출
    위치: src/lib/client.ts:14
    수정: NEXT_PUBLIC_ 제거 + 서버 API 라우트로 이동

🟠 HIGH (배포 전 수정)
  - [H001] users 테이블 RLS 미설정
    Supabase Dashboard → Authentication → RLS → Enable
  - [H002] npm audit: 2 high severity vulnerabilities
    실행: npm audit fix

🟡 MEDIUM (다음 Sprint)
  - [M001] dangerouslySetInnerHTML 사용 감지
    위치: src/components/BlogPost.tsx:45
```

---

## 6. BOT-11 Build Bot 세분화 — 상세 아키텍처

### 6-1. 3분할 구조

```
기존 Build Bot (build role) — 유지, 일반 목적
  ↓ (필요 시 분기)
┌─────────────┬────────────────┬──────────────────┐
│ Frontend Bot│  Backend Bot   │   Infra Bot      │
│ (frontend)  │  (backend)     │   (infra)        │
├─────────────┼────────────────┼──────────────────┤
│ React/TSX   │ API Routes     │ GitHub Actions   │
│ Tailwind    │ Supabase       │ Vercel CLI       │
│ shadcn/ui   │ Prisma/Drizzle │ Docker           │
│ Storybook   │ Auth Logic     │ Environment      │
│ Responsive  │ Middleware     │ Monitoring       │
└─────────────┴────────────────┴──────────────────┘
```

### 6-2. 역할별 시스템 프롬프트 차별화

```typescript
const FRONTEND_SYSTEM_PROMPT = `
당신은 React/TypeScript UI 전문 개발자입니다.
- Tailwind CSS + shadcn/ui 컴포넌트 우선 사용
- 반응형 디자인 (mobile-first)
- 접근성 (ARIA 레이블, 키보드 네비게이션)
- 컴포넌트: Atomic Design (atoms → molecules → organisms)
- 상태관리: 로컬은 useState, 글로벌은 Zustand
- 데이터 페칭: React Query (TanStack)
`;

const BACKEND_SYSTEM_PROMPT = `
당신은 Next.js API + Supabase 전문 백엔드 개발자입니다.
- API Routes: /app/api/... (Next.js 14 App Router)
- RLS 정책 필수 생성 (테이블당 SELECT/INSERT/UPDATE/DELETE)
- auth.uid() 기반 Row Level Security
- Zod 스키마로 입력 검증
- 에러: HTTP 상태코드 표준 준수
`;

const INFRA_SYSTEM_PROMPT = `
당신은 DevOps/Infra 전문 엔지니어입니다.
- GitHub Actions: .github/workflows/*.yml
- Vercel: vercel.json + 환경변수 설정
- Docker: 멀티스테이지 빌드 최적화
- 모니터링: 헬스체크 엔드포인트 필수
- 시크릿: GitHub Secrets / Vercel Env 만 사용
`;
```

---

## 7. 데이터 레이어 변경 사항

### 7-1. DB Schema 변경 (schema.ts)

```sql
-- 현재 role CHECK
CHECK (role IN ('research','build','design','content','growth','ops','integration','ceo'))

-- v3.1 role CHECK (신규 6개 추가)
CHECK (role IN (
  'research','build','design','content','growth','ops','integration','ceo',
  'project_setup','env','security_audit','frontend','backend','infra'
))
```

### 7-2. 신규 테이블: setup_wizard_sessions

```sql
CREATE TABLE IF NOT EXISTS setup_wizard_sessions (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  app_name    TEXT NOT NULL,
  app_type    TEXT NOT NULL CHECK (app_type IN ('web','mobile','desktop')),
  needs_ai    INTEGER NOT NULL DEFAULT 0,
  needs_payment INTEGER NOT NULL DEFAULT 0,
  market      TEXT NOT NULL CHECK (market IN ('domestic','global')),
  stack_json  TEXT,           -- JSON: 결정된 스택 상세
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','running','completed','failed')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 8. API 엔드포인트 변경 사항

### 8-1. 신규 엔드포인트

```
POST /api/agents/:id/setup-wizard
  Body: { appName, appType, needsAI, needsPayment, market }
  → 5개 답변 저장 → PTY 세션 실행 (SSE 스트리밍)

GET  /api/agents/:id/setup-wizard/status
  → 현재 진행 단계, 완료된 작업 목록

POST /api/agents/:id/env-scan
  Body: { projectPath }
  → 코드베이스 스캔 → 위험도별 결과 반환

POST /api/agents/:id/security-audit
  Body: { projectPath }
  → npm audit + 정적 분석 + RLS 검증
```

### 8-2. 기존 엔드포인트 수정

```
POST /api/agents (봇 생성)
  → role 필드 허용 범위 확장
  → template 목록에 6개 신규 봇 추가
```

---

## 9. Frontend 변경 사항

### 9-1. 신규 페이지

```
SetupWizardPage.tsx (신규)
  - 5-question 순차 입력 UI
  - 스택 미리보기 (Q1~5 입력 시 실시간 업데이트)
  - 실행 후 PtyBotPage로 전환 (PTY 터미널)
```

### 9-2. 기존 UI 수정

```
UnifiedBotPage.tsx (기존 봇 선택/생성 UI)
  → 봇 템플릿 목록에 6개 신규 봇 추가
  → ProjectSetup Bot 선택 시 SetupWizardPage로 이동

PtyBotPage.tsx
  → 역할별 아이콘/색상 추가 (project_setup, env 등)
  → 역할별 기본 프롬프트 힌트 추가
```

### 9-3. 컴포넌트

```
SetupWizardStep.tsx — 단계별 질문 카드
SetupStackPreview.tsx — 선택된 스택 실시간 미리보기
SecurityAuditResult.tsx — HIGH/MEDIUM/LOW 결과 카드
EnvChecklist.tsx — 환경변수 체크리스트
```

---

## 10. 파일 변경 목록 (Full Impact)

### Backend

| 파일 | 변경 유형 | 내용 |
|---|---|---|
| `db/types.ts` | 수정 | AgentRole 6개 추가 |
| `db/schema.ts` | 수정 | role CHECK 확장, setup_wizard_sessions 테이블 추가 |
| `services/claudeCodeService.ts` | 수정 | ROLE_MODELS 6개 추가, buildRolePrompts() 확장 |
| `agents/runner.ts` | 수정 | ROLE_INSTRUCTIONS 6개 추가 |
| `services/roleExecutors/projectSetup.ts` | 신규 | ProjectSetup Bot executor |
| `services/roleExecutors/env.ts` | 신규 | Env Bot executor |
| `services/roleExecutors/securityAudit.ts` | 신규 | SecurityAudit Bot executor |
| `services/roleExecutors/frontend.ts` | 신규 | Frontend Bot executor |
| `services/roleExecutors/backend.ts` | 신규 | Backend Bot executor |
| `services/roleExecutors/infra.ts` | 신규 | Infra Bot executor |
| `services/roleExecutors/index.ts` | 수정 | 6개 executor 등록 |
| `api/routes/agents.ts` | 수정 | setup-wizard, env-scan, security-audit 엔드포인트 추가 |

### Frontend

| 파일 | 변경 유형 | 내용 |
|---|---|---|
| `pages/SetupWizardPage.tsx` | 신규 | 5-question wizard UI |
| `components/bots/SetupWizardStep.tsx` | 신규 | 단계별 질문 카드 |
| `components/bots/SetupStackPreview.tsx` | 신규 | 스택 미리보기 |
| `components/bots/SecurityAuditResult.tsx` | 신규 | 감사 결과 카드 |
| `components/bots/EnvChecklist.tsx` | 신규 | 환경변수 체크리스트 |
| `pages/UnifiedBotPage.tsx` | 수정 | 봇 템플릿 목록 확장 |
| `pages/PtyBotPage.tsx` | 수정 | 신규 역할 아이콘/힌트 |
| `router.tsx` | 수정 | /setup-wizard 라우트 추가 |

---

## 11. 의존성 (신규 패키지 없음)

> **원칙**: Claude Code CLI subprocess가 시스템 CLI를 직접 실행하므로 npm 패키지 추가 불필요.
> 시스템에 사전 설치 가정: `gh` CLI, `vercel` CLI, `supabase` CLI, `npx`

---

*ARCH v3.1 — 2026-04-18*
*참고: PRD-v3.md, WBS-v3.1.0.md, feature-ids.md*
