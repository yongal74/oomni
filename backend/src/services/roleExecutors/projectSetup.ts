// BOT-08: ProjectSetup Bot executor
import { v4 as uuidv4 } from 'uuid'
import { streamClaude, saveFeedItem, DEFAULT_MODEL, type ExecutorContext } from './base'

export interface SetupAnswers {
  appName: string
  appType: 'web' | 'mobile' | 'desktop'
  needsAI: boolean
  needsPayment: boolean
  market: 'domestic' | 'global'
}

interface StackConfig {
  framework: string
  auth: string
  db: string
  ai: string | null
  payment: string | null
  email: string
  analytics: string
}

function resolveStack(answers: SetupAnswers): StackConfig {
  return {
    framework: 'next.js 14 (App Router)',
    auth: 'supabase auth',
    db: 'supabase postgres',
    ai: answers.needsAI ? 'anthropic claude api' : null,
    payment: answers.needsPayment
      ? (answers.market === 'domestic' ? 'toss payments' : 'stripe')
      : null,
    email: 'resend',
    analytics: 'posthog',
  }
}

function buildEnvTemplate(answers: SetupAnswers, stack: StackConfig): string {
  const lines: string[] = [
    `# ${answers.appName} — 환경변수`,
    `# OOMNI ProjectSetup Bot이 자동 생성함`,
    `# ⚠️ NEXT_PUBLIC_ 규칙: 브라우저에 노출되는 변수만 붙일 것`,
    ``,
    `# ── Supabase ──────────────────────────────────`,
    `NEXT_PUBLIC_SUPABASE_URL=       # Supabase → Settings → API → Project URL`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase → Settings → API → anon public`,
    `SUPABASE_SERVICE_ROLE_KEY=      # ⚠️ 서버 전용 — NEXT_PUBLIC_ 절대 금지`,
    ``,
  ]

  if (stack.ai) {
    lines.push(
      `# ── Anthropic ─────────────────────────────────`,
      `ANTHROPIC_API_KEY=              # ⚠️ 서버 전용 — NEXT_PUBLIC_ 절대 금지`,
      ``,
    )
  }

  if (stack.payment === 'stripe') {
    lines.push(
      `# ── Stripe ───────────────────────────────────`,
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # 브라우저 노출 OK`,
      `STRIPE_SECRET_KEY=                   # ⚠️ 서버 전용`,
      `STRIPE_WEBHOOK_SECRET=               # ⚠️ 서버 전용`,
      ``,
    )
  } else if (stack.payment === 'toss payments') {
    lines.push(
      `# ── 토스페이먼츠 ──────────────────────────────`,
      `NEXT_PUBLIC_TOSS_CLIENT_KEY=    # 브라우저 노출 OK`,
      `TOSS_SECRET_KEY=                # ⚠️ 서버 전용`,
      ``,
    )
  }

  lines.push(
    `# ── Resend (이메일) ───────────────────────────`,
    `RESEND_API_KEY=                 # ⚠️ 서버 전용`,
    ``,
    `# ── PostHog (분석) ────────────────────────────`,
    `NEXT_PUBLIC_POSTHOG_KEY=        # 브라우저 노출 OK`,
    `NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com`,
  )

  return lines.join('\n')
}

function buildOAuthGuide(answers: SetupAnswers): string {
  return `
## Google OAuth 설정 (수동 필요)
Google Cloud Console API 제한으로 자동화 불가 — 아래 URI를 직접 등록하세요.

1. https://console.cloud.google.com/apis/credentials 접속
2. OAuth 2.0 클라이언트 ID → 승인된 리디렉션 URI에 아래 3개 추가:

\`\`\`
http://localhost:3000
https://[프로젝트ID].supabase.co/auth/v1/callback
https://${answers.appName}.vercel.app/auth/callback
\`\`\`

3. Supabase → Authentication → URL Configuration → Redirect URLs에도 동일하게 추가
`.trim()
}

function buildSetupPrompt(answers: SetupAnswers): string {
  const stack = resolveStack(answers)
  const envTemplate = buildEnvTemplate(answers, stack)
  const oauthGuide = buildOAuthGuide(answers)

  const stackLines = [
    `- Framework: ${stack.framework}`,
    `- Auth/DB: ${stack.auth} + ${stack.db}`,
    stack.ai ? `- AI: ${stack.ai}` : null,
    stack.payment ? `- Payment: ${stack.payment}` : null,
    `- Email: ${stack.email}`,
    `- Analytics: ${stack.analytics}`,
  ].filter(Boolean).join('\n')

  return `# ProjectSetup Bot — 프로젝트 자동 초기화

## 입력 정보
- 앱 이름: ${answers.appName}
- 형태: ${answers.appType}
- AI 기능: ${answers.needsAI ? '필요' : '불필요'}
- 결제: ${answers.needsPayment ? '필요' : '불필요'}
- 마켓: ${answers.market === 'domestic' ? '국내' : '글로벌'}

## 결정된 기술 스택
${stackLines}

## 실행 순서 (반드시 순서대로)

### Step 1: Next.js 스캐폴딩
\`\`\`bash
npx create-next-app@latest ${answers.appName} --typescript --tailwind --app --src-dir --import-alias "@/*"
cd ${answers.appName}
\`\`\`
완료 후: ✅ Next.js 스캐폴딩 완료

### Step 2: .env.local 생성
아래 내용으로 .env.local 파일 생성:
\`\`\`
${envTemplate}
\`\`\`
완료 후: ✅ .env.local 템플릿 생성

### Step 3: shadcn/ui 설치
\`\`\`bash
npx shadcn@latest init -y --base-color slate
npx shadcn@latest add button card input label badge
\`\`\`
완료 후: ✅ shadcn/ui 설치

### Step 4: GitHub 레포 생성
\`\`\`bash
git init
git add .
git commit -m "init: ${answers.appName} scaffolded by OOMNI"
gh repo create ${answers.appName} --public --push --source=.
\`\`\`
완료 후: ✅ GitHub 레포 생성

### Step 5: Vercel 배포 연결
\`\`\`bash
vercel link --yes
\`\`\`
.env.local의 각 항목을 vercel env add로 등록하세요.
완료 후: ✅ Vercel 연결

### Step 6: GitHub Actions CI/CD
.github/workflows/deploy.yml 파일 생성:
\`\`\`yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
\`\`\`
.nvmrc 파일 생성 (현재 Node.js 버전):
\`\`\`
20
\`\`\`
완료 후: ✅ GitHub Actions 설정

### Step 7: Supabase 스키마 생성
supabase/migrations/0001_init.sql 파일 생성:
\`\`\`sql
-- users 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
\`\`\`
완료 후: ✅ Supabase 스키마 생성

### Step 8: 반자동 필요 항목 안내

${oauthGuide}

${answers.needsPayment && answers.market === 'domestic' ? `
## 토스페이먼츠 타임라인 알림
사업자 등록이 필요합니다. 아래 순서로 진행:
1. 사업자 등록 (0~2일): https://www.ftc.go.kr
2. 토스페이먼츠 심사 신청 (2~5일 소요): https://developers.tosspayments.com
총 소요: 최대 7일 → 개발 Day 1에 동시 신청 권장
` : ''}

${answers.needsPayment && answers.market === 'global' ? `
## Stripe 타임라인 알림
한국에서 Stripe 사용 시:
1. 사업자 등록 필요 (0~2일)
2. Stripe 심사 (1~3일, 영업일 기준)
총 소요: 최대 5일 → 개발 Day 1에 동시 신청 권장: https://stripe.com/ko
` : ''}

## 최종 완료 후 출력
✅ 스캐폴딩 완료: ${answers.appName}/
✅ .env.local 템플릿 생성
✅ shadcn/ui 설치
✅ GitHub 레포: https://github.com/{username}/${answers.appName}
✅ Vercel 연결
✅ GitHub Actions 설정
✅ Supabase 스키마 생성
⚠️ 수동 필요: Google OAuth URI 등록, .env.local 실제 값 입력
`
}

export async function projectSetupExecutor(ctx: ExecutorContext): Promise<void> {
  const { agent, task, db, send } = ctx

  send('stage', { stage: 'analyzing', label: '프로젝트 설정 분석 중...' })
  await saveFeedItem(db, agent.id, 'info', `🚀 ProjectSetup Bot 시작: ${task}`)

  const issueId = uuidv4()
  await db.query(
    `INSERT INTO issues (id, mission_id, agent_id, title, status, priority) VALUES ($1,$2,$3,$4,$5,$6)`,
    [issueId, agent.mission_id, agent.id, task, 'in_progress', 'high']
  )

  // task 문자열에서 SetupAnswers 파싱 시도 (JSON 포함 시)
  let answers: SetupAnswers | null = null
  try {
    const match = task.match(/\{[\s\S]*\}/)
    if (match) {
      answers = JSON.parse(match[0]) as SetupAnswers
    }
  } catch { /* 파싱 실패 시 task 전체를 프롬프트로 사용 */ }

  let systemPrompt: string
  let userMessage: string

  if (answers) {
    systemPrompt = agent.system_prompt || buildSetupPrompt(answers)
    userMessage = `위 프로젝트 설정 지침에 따라 ${answers.appName} 프로젝트를 초기화하세요. 각 단계를 순서대로 실행하고 완료 시 ✅를 출력하세요.`
  } else {
    systemPrompt = agent.system_prompt || `당신은 프로젝트 초기화 자동화 에이전트입니다. 사용자의 요청에 따라 Next.js 프로젝트를 초기화하고 필요한 설정을 자동화하세요.`
    userMessage = task
  }

  send('stage', { stage: 'executing', label: '프로젝트 초기화 실행 중...' })
  const result = await streamClaude(ctx, systemPrompt, userMessage, DEFAULT_MODEL)

  await db.query(`UPDATE issues SET status = 'done' WHERE id = $1`, [issueId])
  send('stage', { stage: 'done', label: '완료' })
  await saveFeedItem(db, agent.id, 'result', result)
  send('setup_done', { issueId })
}
