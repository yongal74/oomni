import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, schedulesApi, type FeedItem, type Schedule } from '../../../lib/api'
import { Zap, Download, ChevronDown, ChevronRight, Copy, ExternalLink, AlertCircle } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

// ── 워크플로우 노드 타입 ────────────────────────────────────────────────────────
export interface OpsWorkflowNode {
  id: string
  name: string
  type: string
  typeLabel: string
  emoji: string
  position: number
}

// ── n8n 노드 타입 매핑 ──────────────────────────────────────────────────────────
const NODE_TYPE_MAP: Record<string, { label: string; emoji: string }> = {
  scheduleTrigger:      { label: 'Schedule Trigger', emoji: '⏰' },
  webhook:              { label: 'Webhook', emoji: '🔗' },
  gmail:                { label: 'Gmail', emoji: '📧' },
  slack:                { label: 'Slack', emoji: '💬' },
  httpRequest:          { label: 'HTTP Request', emoji: '🌐' },
  code:                 { label: 'Code (JS)', emoji: '⚙️' },
  googleSheets:         { label: 'Google Sheets', emoji: '📊' },
  notion:               { label: 'Notion', emoji: '📝' },
  set:                  { label: 'Set (변환)', emoji: '🔄' },
  if:                   { label: 'IF (분기)', emoji: '🔀' },
  merge:                { label: 'Merge', emoji: '🔀' },
  openAi:               { label: 'OpenAI', emoji: '🤖' },
  anthropicClaude:      { label: 'Claude AI', emoji: '🧠' },
  postgres:             { label: 'Postgres', emoji: '🗄️' },
  mysql:                { label: 'MySQL', emoji: '🗄️' },
  mongoDb:              { label: 'MongoDB', emoji: '🗄️' },
  googleDrive:          { label: 'Google Drive', emoji: '📁' },
  telegram:             { label: 'Telegram', emoji: '✈️' },
  discord:              { label: 'Discord', emoji: '🎮' },
  github:               { label: 'GitHub', emoji: '🐙' },
  supabase:             { label: 'Supabase', emoji: '🟢' },
  manualTrigger:        { label: 'Manual Trigger', emoji: '▶️' },
  emailSend:            { label: 'Email Send', emoji: '📤' },
  respondToWebhook:     { label: 'Respond to Webhook', emoji: '↩️' },
}

function getNodeMeta(type: string): { label: string; emoji: string } {
  const key = type.replace('n8n-nodes-base.', '').replace('n8n-nodes-community.', '')
  return NODE_TYPE_MAP[key] ?? { label: key, emoji: '📦' }
}

// ── 노드별 연결 가이드 ──────────────────────────────────────────────────────────
interface NodeGuide {
  steps: { title: string; body: string }[]
  tips?: string
  credentialName?: string
}

const NODE_GUIDES: Record<string, NodeGuide> = {
  scheduleTrigger: {
    steps: [
      { title: '① n8n 에디터에서 노드 클릭', body: '워크플로우 캔버스에서 "Schedule Trigger" 노드를 클릭하세요.' },
      { title: '② 실행 주기 설정', body: '우측 패널에서 Trigger Interval을 선택하세요.\n• Every X minutes — 빠른 테스트용\n• Cron Expression — 정밀 일정 (예: 0 9 * * 1-5 = 평일 오전 9시)' },
      { title: '③ 저장 & 활성화', body: '상단 "Save" → "Active" 토글 ON → 스케줄이 자동으로 시작됩니다.' },
    ],
    tips: '처음에는 "Every 1 minute"으로 테스트하고, 확인 후 실제 주기로 변경하세요.',
  },
  webhook: {
    steps: [
      { title: '① 노드 클릭 → Webhook URL 복사', body: 'Webhook 노드 클릭 → "Test URL" 복사 (테스트용)\n실서비스는 "Production URL" 사용' },
      { title: '② 외부 서비스에 URL 등록', body: '복사한 URL을 GitHub Webhook, Slack, 결제 서비스 등의 "Webhook URL" 설정에 붙여넣으세요.' },
      { title: '③ HTTP Method 설정', body: '대부분의 서비스는 POST. GitHub는 POST, Stripe도 POST.\n헤더 인증이 필요하면 Header Auth 설정.' },
      { title: '④ 테스트', body: '"Listen for Test Event" 클릭 → 외부 서비스에서 이벤트 발생 → n8n에 데이터 수신 확인' },
    ],
    tips: 'Webhook URL은 Workflow Active 상태일 때만 Production URL이 활성화됩니다.',
  },
  gmail: {
    credentialName: 'Google OAuth2',
    steps: [
      { title: '① Credential 연결', body: '노드 클릭 → Credential → "Create New Credential"\nGoogle OAuth2 선택 → Google 계정 로그인 허용' },
      { title: '② Google Cloud Console 설정', body: 'console.cloud.google.com → APIs & Services → Credentials\nOAuth 클라이언트 ID 생성 → redirect URI:\nhttp://localhost:5678/rest/oauth2-credential/callback' },
      { title: '③ 작업 설정', body: '• Resource: Message / Draft / Thread\n• Operation: Get Many / Send / Reply\n• Filters: 날짜, 라벨, 검색어' },
      { title: '④ 테스트', body: '"Execute Node" 클릭 → Output 탭에서 수신된 이메일 확인' },
    ],
    tips: 'Gmail API를 Google Cloud Console에서 활성화해야 합니다.',
  },
  slack: {
    credentialName: 'Slack OAuth',
    steps: [
      { title: '① Slack 앱 생성', body: 'api.slack.com/apps → "Create New App"\nWorkspace 선택 → OAuth Scopes:\nchat:write, channels:read, users:read' },
      { title: '② Credential 연결', body: 'n8n 노드 → Credential → Slack OAuth → Bot Token 입력\n(xoxb-로 시작하는 토큰)' },
      { title: '③ 채널/메시지 설정', body: '• Channel: #채널명 또는 채널 ID\n• Message: 전송할 텍스트\n• Blocks: JSON으로 리치 메시지 (선택)' },
      { title: '④ 테스트', body: '"Execute Node" → Slack 채널에 메시지 수신 확인' },
    ],
    tips: 'Slack 앱을 채널에 초대해야 합니다: /invite @앱이름',
  },
  httpRequest: {
    steps: [
      { title: '① URL & Method 설정', body: 'API 엔드포인트 URL 입력\nMethod: GET / POST / PUT / DELETE' },
      { title: '② 인증 설정 (필요 시)', body: '• API Key: Header에 Authorization: Bearer {token}\n• Basic Auth: 사용자명/비밀번호\n• OAuth2: Credential 생성 후 연결' },
      { title: '③ Body/Query 파라미터', body: 'POST: Body → JSON 형식으로 데이터 입력\nGET: Query Parameters → key=value 형식' },
      { title: '④ 응답 처리', body: '"Execute Node" → Response 확인\nResponse 데이터를 다음 노드에서 {{$json.field}}로 참조' },
    ],
    tips: '대부분의 REST API를 HTTP Request 노드 하나로 연결할 수 있습니다.',
  },
  code: {
    steps: [
      { title: '① JavaScript 코드 작성', body: '노드 클릭 → Code 탭\n입력 데이터: $input.all() 또는 $input.first()\n반환: return [{json: { ...변환된데이터 }}]' },
      { title: '② 이전 노드 데이터 참조', body: 'const items = $input.all()\nconst data = items[0].json\n// data.fieldName 으로 접근' },
      { title: '③ 여러 아이템 처리', body: 'return $input.all().map(item => ({\n  json: { processed: item.json.value * 2 }\n}))' },
      { title: '④ 실행 & 결과 확인', body: '"Execute Node" → Output 탭에서 변환된 데이터 확인' },
    ],
    tips: 'console.log()로 디버그 가능. n8n 로그에서 확인하세요.',
  },
  googleSheets: {
    credentialName: 'Google Sheets OAuth2',
    steps: [
      { title: '① Credential 연결', body: 'Google OAuth2 Credential 생성\nGoogle Sheets API를 Cloud Console에서 활성화' },
      { title: '② 스프레드시트 연결', body: '• Spreadsheet ID: URL의 /d/{ID}/ 부분\n• Sheet Name: 시트 탭 이름\n• 또는 URL로 직접 입력' },
      { title: '③ 작업 설정', body: '• Append Row: 새 행 추가\n• Update Row: 특정 행 수정 (row number 필요)\n• Get Many: 전체 행 조회\n• Clear: 데이터 삭제' },
      { title: '④ 매핑 설정', body: 'Columns → "Map Each Column Manually" 선택\n컬럼명과 데이터 값을 1:1 매핑' },
    ],
    tips: '스프레드시트 첫 행을 헤더로 설정하면 컬럼명 자동 인식됩니다.',
  },
  notion: {
    credentialName: 'Notion API',
    steps: [
      { title: '① Notion Integration 생성', body: 'notion.so/my-integrations → "New Integration"\n이름 입력 → Workspace 선택 → Submit\n"Internal Integration Token" 복사' },
      { title: '② Credential 입력', body: 'n8n → Credentials → Notion API\n위에서 복사한 토큰 붙여넣기' },
      { title: '③ DB/Page에 Integration 연결', body: 'Notion에서 대상 Database 열기\n우상단 ... → "Add Connections" → 생성한 Integration 추가' },
      { title: '④ 작업 설정', body: '• Database ID: Notion URL의 마지막 32자리\n• Filter: 조건 설정\n• Properties: 읽거나 쓸 필드 선택' },
    ],
    tips: 'Notion API는 rich_text 타입이 복잡합니다. Code 노드로 후처리하세요.',
  },
  openAi: {
    credentialName: 'OpenAI API',
    steps: [
      { title: '① API 키 발급', body: 'platform.openai.com → API Keys → "Create New Secret Key"\n생성된 sk-... 키 복사' },
      { title: '② Credential 연결', body: 'n8n → Credentials → OpenAI\nAPI Key 붙여넣기' },
      { title: '③ 모델 & 프롬프트 설정', body: '• Model: gpt-4o (추천) / gpt-3.5-turbo (저렴)\n• System Message: AI 역할 설명\n• User Message: {{$json.content}} 로 이전 노드 데이터 참조' },
      { title: '④ 응답 파싱', body: '응답: {{$json.choices[0].message.content}}\nJSON 응답이면 Code 노드에서 JSON.parse() 처리' },
    ],
    tips: 'temperature: 0~0.3 = 일관된 응답, 0.7~1 = 창의적 응답',
  },
  set: {
    steps: [
      { title: '① 설정할 필드 추가', body: '"Add Field" 클릭 → 필드명 입력\nValue Type: String / Number / Boolean / Expression' },
      { title: '② Expression 사용', body: '이전 노드 데이터: {{$json.fieldName}}\n가공: {{$json.price * 1.1}}\n날짜: {{$now.toISODate()}}' },
      { title: '③ 기존 필드 유지 여부', body: '"Keep Only Set" OFF → 기존 데이터 + 새 필드\n"Keep Only Set" ON → 새로 설정한 필드만 전달' },
    ],
    tips: 'Expression 탭에서 직접 JavaScript 표현식 입력 가능합니다.',
  },
  if: {
    steps: [
      { title: '① 조건 설정', body: '"Add Condition" 클릭\n좌측: {{$json.status}} 같은 필드\n연산자: Equals / Contains / Larger / Smaller\n우측: 비교값' },
      { title: '② True/False 경로', body: 'True 출력: 조건 충족 시 데이터 흐름\nFalse 출력: 조건 미충족 시 데이터 흐름\n두 경로에 각각 다음 노드 연결' },
      { title: '③ 복합 조건', body: '"AND" 모드: 모든 조건 충족 시 True\n"OR" 모드: 하나라도 충족 시 True' },
    ],
    tips: '빈 값 체크: Operation "Is Empty" 사용 (null/undefined 모두 처리)',
  },
}

function getNodeGuide(type: string): NodeGuide {
  const key = type.replace('n8n-nodes-base.', '').replace('n8n-nodes-community.', '')
  return NODE_GUIDES[key] ?? {
    steps: [
      { title: '① 노드 클릭', body: 'n8n 캔버스에서 이 노드를 클릭하세요.' },
      { title: '② Credential 설정 (필요 시)', body: 'Credential 탭에서 API 키 또는 OAuth 계정을 연결하세요.' },
      { title: '③ 파라미터 입력', body: '노드에서 필요한 설정값을 입력하세요.' },
      { title: '④ 테스트', body: '"Execute Node" 클릭 → Output에서 결과 확인' },
    ],
    tips: `n8n 공식 문서에서 "${type}" 노드 사용법을 확인하세요: docs.n8n.io`,
  }
}

// ── 워크플로우 JSON 파싱 ────────────────────────────────────────────────────────
function parseWorkflowNodes(content: string): OpsWorkflowNode[] {
  try {
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) ?? content.match(/(\{[\s\S]*"nodes"[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1] : content
    const wf = JSON.parse(jsonStr)
    if (!Array.isArray(wf.nodes)) return []
    return wf.nodes.map((node: { id?: string; name?: string; type?: string; position?: number[] }, i: number): OpsWorkflowNode => {
      const meta = getNodeMeta(node.type ?? '')
      return {
        id: node.id ?? String(i),
        name: node.name ?? meta.label,
        type: node.type ?? '',
        typeLabel: meta.label,
        emoji: meta.emoji,
        position: i,
      }
    })
  } catch {
    return []
  }
}

// ── 5개 최상위 탭 ────────────────────────────────────────────────────────────
const OPS_MAIN_TABS = [
  { key: 'ops',         label: '운영' },
  { key: 'infra',       label: '인프라' },
  { key: 'integration', label: '연동' },
  { key: 'env',         label: '환경변수' },
  { key: 'security',    label: '보안' },
]

const AUTOMATION_CATEGORIES = [
  {
    id: 'general', label: '일반',
    presets: [
      { name: '이슈 자동생성',     triggerType: 'cron' as const, triggerValue: '0 9 * * 1-5' },
      { name: '일일 리포트 자동화', triggerType: 'cron' as const, triggerValue: '0 18 * * 1-5' },
      { name: '주간 비용 정산',     triggerType: 'cron' as const, triggerValue: '0 10 * * 1' },
    ],
  },
  {
    id: 'finance', label: '재무',
    presets: [
      { name: '월별 손익계산서 자동생성', triggerType: 'cron' as const, triggerValue: '0 9 1 * *' },
      { name: 'Stripe 매출 집계',        triggerType: 'cron' as const, triggerValue: '0 8 * * 1' },
      { name: '미수금 알림',             triggerType: 'cron' as const, triggerValue: '0 10 * * 3' },
    ],
  },
  {
    id: 'tax', label: '세무',
    presets: [
      { name: '분기별 부가세 정리', triggerType: 'cron' as const, triggerValue: '0 9 1 1,4,7,10 *' },
      { name: '영수증 수집/분류',   triggerType: 'cron' as const, triggerValue: '0 9 * * 1' },
    ],
  },
  {
    id: 'hr', label: '인사',
    presets: [
      { name: '주간 업무일지',   triggerType: 'cron' as const, triggerValue: '0 17 * * 5' },
      { name: '월간 성과 정리',  triggerType: 'cron' as const, triggerValue: '0 9 28 * *' },
    ],
  },
]

const INFRA_CATEGORIES = [
  {
    id: 'vercel', label: 'Vercel 배포', emoji: '▲',
    skills: [
      { label: '신규 프로젝트 배포', desc: 'vercel.json + 환경변수', prompt: '현재 프로젝트를 Vercel에 처음 배포하는 전체 과정을 진행해줘. vercel.json 생성, 환경변수 정리, vercel --prod 배포 커맨드 안내, 배포 후 도메인 확인 방법까지 포함해줘.' },
      { label: 'Preview 배포 설정',  desc: 'PR별 자동 프리뷰 URL',  prompt: 'GitHub PR마다 자동으로 Vercel Preview URL이 생성되도록 GitHub Actions .github/workflows/vercel-preview.yml을 작성해줘.' },
      { label: '커스텀 도메인 연결', desc: '도메인 DNS + SSL',       prompt: 'Vercel 프로젝트에 커스텀 도메인을 연결하는 DNS 설정(A레코드, CNAME), SSL 발급, www 리다이렉트 vercel.json 설정을 안내해줘.' },
    ],
  },
  {
    id: 'docker', label: 'Docker', emoji: '🐳',
    skills: [
      { label: '프로덕션 Dockerfile', desc: '멀티스테이지 빌드', prompt: '현재 프로젝트에 맞는 프로덕션용 멀티스테이지 Dockerfile을 작성해줘. builder → runner 구조, non-root 유저, HEALTHCHECK 포함.' },
      { label: 'docker-compose',      desc: 'dev/prod 환경 분리',  prompt: 'docker-compose.yml을 dev/prod 환경별로 분리해서 작성해줘.' },
    ],
  },
  {
    id: 'github', label: 'GitHub', emoji: '🐙',
    skills: [
      { label: 'Branch Protection', desc: 'main 브랜치 보호',      prompt: 'GitHub 브랜치 보호 규칙(PR 필수, CI 통과 필수, force push 금지)을 설정하는 방법을 안내해줘.' },
      { label: 'Release 자동화',    desc: '태그 → 릴리즈노트',     prompt: 'GitHub 태그 push 시 자동으로 Release를 생성하고 Changelog를 작성하는 GitHub Actions YAML을 만들어줘.' },
      { label: 'PR 자동화',         desc: '라벨·리뷰어 자동화',    prompt: 'GitHub PR 생성 시 라벨 자동 부여, 리뷰어 배정, Dependabot 설정을 포함한 자동화를 구성해줘.' },
    ],
  },
]

const N8N_CATEGORIES = [
  { label: 'Slack 알림',    emoji: '💬', prompt: 'n8n으로 특정 이벤트 발생 시 Slack 채널에 포맷된 메시지를 자동 전송하는 워크플로우를 만들어줘. 스레드 답글, 에러 처리와 재시도 로직 포함.' },
  { label: 'Gmail 자동화',  emoji: '📧', prompt: 'n8n으로 이메일 수신 시 내용 분석 후 자동 분류/응답하는 워크플로우를 만들어줘. Gmail OAuth2 설정, 첨부파일 처리 포함.' },
  { label: 'GitHub 연동',   emoji: '🐙', prompt: 'n8n으로 GitHub Webhook으로 PR/Issue/Push 이벤트별 분기 처리 → Slack 알림 + 자동 라벨링 워크플로우를 만들어줘.' },
  { label: '데이터 파이프라인', emoji: '🔄', prompt: 'n8n으로 외부 API 페이지네이션 수집 → Loop Over Items → Code 노드 변환 → DB/Google Sheet upsert 파이프라인을 만들어줘.' },
  { label: 'CRM 연동',      emoji: '👥', prompt: 'n8n으로 리드 생성 → 중복 제거 → CRM Upsert + Slack 알림 + 팔로업 스케줄 등록 워크플로우를 만들어줘.' },
  { label: '스케줄 리포트', emoji: '📊', prompt: 'n8n으로 Schedule Trigger → DB/API 쿼리 → Code 노드 집계 → Slack + 이메일 발송 자동 리포트 워크플로우를 만들어줘.' },
  { label: 'AI 자동화',     emoji: '🤖', prompt: 'n8n으로 Webhook → OpenAI/Claude API 호출 → JSON 파싱 → 후속 액션(DB저장/슬랙알림) 워크플로우를 만들어줘.' },
  { label: 'Google Sheet', emoji: '📋', prompt: 'n8n으로 외부 데이터 → Google Sheets 행 추가/업데이트 + 중복 체크 워크플로우를 만들어줘.' },
  { label: 'Webhook 허브',  emoji: '🔗', prompt: 'n8n으로 단일 Webhook 엔드포인트로 여러 서비스 이벤트 수신 → Switch 노드로 분기 처리. HMAC 서명 검증 포함.' },
]

const EXTERNAL_SKILLS = [
  { label: 'Slack 연동',    emoji: '💬', prompt: 'Slack 워크스페이스에 봇을 연동하고 이벤트를 수신하는 설정을 알려줘.' },
  { label: 'Notion 연동',   emoji: '📝', prompt: 'Notion API를 연동해서 데이터베이스를 읽고 쓰는 코드를 작성해줘.' },
  { label: 'GitHub 웹훅',   emoji: '🐙', prompt: 'GitHub 웹훅을 설정해서 PR, Issue, Push 이벤트를 처리하는 엔드포인트를 만들어줘.' },
  { label: '웹훅 허브',     emoji: '🔗', prompt: '단일 웹훅 엔드포인트로 여러 서비스의 이벤트를 수신하고 라우팅하는 허브를 구축해줘.' },
]

const ENV_ACTIONS = [
  { label: 'NEXT_PUBLIC_ 스캔', desc: '누락된 환경변수 찾기',          prompt: '프로젝트 전체에서 사용하는 환경변수를 스캔하고 .env.example과 비교해서 누락된 것을 찾아줘.' },
  { label: '로컬↔Vercel 동기화', desc: '.env.local과 Vercel env 비교', prompt: '로컬 .env.local 파일과 Vercel 환경변수를 비교하고 동기화 방법을 알려줘.' },
  { label: '.env 템플릿 생성',   desc: '.env.example 자동 생성',       prompt: '현재 코드베이스를 분석해서 .env.example 파일을 생성해줘. 각 변수 설명 포함.' },
]

const SECURITY_ACTIONS = [
  { label: 'OWASP 스캔', desc: 'OWASP Top 10 취약점 점검', prompt: '현재 코드베이스의 OWASP Top 10 기준 보안 취약점을 점검해줘. 결과를 🔴CRITICAL/🟠HIGH/🟡MEDIUM/🟢LOW 심각도로 분류해서 보고해줘.' },
  { label: 'npm audit',  desc: '의존성 취약점 검사',       prompt: 'npm audit를 실행하고 발견된 취약점을 심각도별로 정리해서 수정 방법을 알려줘.' },
  { label: 'RLS 검증',   desc: 'Supabase RLS 점검',       prompt: 'Supabase 데이터베이스의 RLS 정책을 검증하고 취약한 부분을 찾아줘.' },
]

// ── InfraCategoryAccordion ─────────────────────────────────────────────────────
function InfraCategoryAccordion({ category, onSkillSelect }: { category: typeof INFRA_CATEGORIES[0]; onSkillSelect?: (prompt: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full px-3 py-2.5 bg-surface hover:bg-border/30 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-base">{category.emoji}</span>
          <span className="text-xs font-medium text-dim">{category.label}</span>
          <span className="text-[10px] text-muted/60">{category.skills.length}개</span>
        </div>
        {open ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
      </button>
      {open && (
        <div className="divide-y divide-border/50">
          {category.skills.map(skill => (
            <button key={skill.label} onClick={() => onSkillSelect?.(skill.prompt)} title={skill.desc}
              className="flex flex-col items-start gap-0.5 w-full px-3 py-2.5 bg-bg hover:bg-surface/60 transition-colors text-left">
              <span className="text-sm text-dim font-medium">{skill.label}</span>
              <span className="text-[11px] text-muted">{skill.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CategoryAccordion ─────────────────────────────────────────────────────────
function CategoryAccordion({ category, activeScheduleNames, onPresetClick }: {
  category: typeof AUTOMATION_CATEGORIES[0]
  activeScheduleNames: Set<string>
  onPresetClick: (preset: { name: string; triggerType: 'interval' | 'cron'; triggerValue: string }) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full px-3 py-2 bg-surface hover:bg-border/30 transition-colors">
        <span className="text-xs font-medium text-dim">{category.label}</span>
        {open ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
      </button>
      {open && (
        <div className="divide-y divide-border/50">
          {category.presets.map(preset => {
            const isActive = activeScheduleNames.has(preset.name)
            return (
              <button key={preset.name} onClick={() => onPresetClick(preset)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-bg hover:bg-surface/60 transition-colors text-left group">
                <div className={cn('w-2 h-2 rounded-full shrink-0', isActive ? 'bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]' : 'bg-border group-hover:bg-border/80')} />
                <span className="text-sm text-dim flex-1 leading-snug">{preset.name}</span>
                {isActive && <span className="text-[10px] text-blue-400 shrink-0">활성</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── SecurityResultCard ────────────────────────────────────────────────────────
function SecurityResultCard({ content }: { content: string }) {
  const severities = [
    { key: '🔴CRITICAL', label: 'CRITICAL', color: 'border-red-500/50 bg-red-500/10 text-red-400' },
    { key: '🟠HIGH',     label: 'HIGH',     color: 'border-orange-500/50 bg-orange-500/10 text-orange-400' },
    { key: '🟡MEDIUM',   label: 'MEDIUM',   color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
    { key: '🟢LOW',      label: 'LOW',      color: 'border-green-500/50 bg-green-500/10 text-green-400' },
  ]
  const found = severities.filter(s => content.includes(s.key))
  if (found.length === 0) return null
  return (
    <div className="space-y-1.5 mt-3">
      <p className="text-[10px] text-muted uppercase tracking-widest">보안 스캔 결과</p>
      <div className="flex flex-wrap gap-1.5">
        {found.map(s => (
          <div key={s.key} className={cn('px-2.5 py-1 rounded border text-xs font-medium', s.color)}>
            {s.key.slice(0, 2)} {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── WorkflowFlowchart (좌측 패널용) ──────────────────────────────────────────
function WorkflowFlowchart({ nodes, selectedNode, onNodeSelect }: {
  nodes: OpsWorkflowNode[]
  selectedNode: OpsWorkflowNode | null
  onNodeSelect: (node: OpsWorkflowNode) => void
}) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-4 px-3">
        <p className="text-[11px] text-muted/60 leading-relaxed">
          봇에게 n8n 워크플로우를 요청하면<br />여기에 노드 순서도가 표시됩니다
        </p>
        <p className="text-[10px] text-muted/40 mt-1">예: "Slack 알림 자동화 만들어줘"</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {nodes.map((node, i) => (
        <div key={node.id}>
          <button
            onClick={() => onNodeSelect(node)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors group',
              selectedNode?.id === node.id
                ? 'bg-primary/10 border-l-2 border-primary'
                : 'hover:bg-surface/60 border-l-2 border-transparent'
            )}
          >
            <span className="text-base shrink-0">{node.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={cn('text-[12px] font-medium truncate', selectedNode?.id === node.id ? 'text-primary' : 'text-dim')}>
                {node.name}
              </p>
              <p className="text-[10px] text-muted truncate">{node.typeLabel}</p>
            </div>
            {selectedNode?.id === node.id && (
              <ChevronRight size={10} className="text-primary shrink-0" />
            )}
          </button>
          {i < nodes.length - 1 && (
            <div className="flex items-center justify-center h-3">
              <div className="w-px h-3 bg-border/60" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── LEFT: 5탭 최상위 레이아웃 ─────────────────────────────────────────────────
export function OpsLeftPanel({
  agentId,
  onSkillSelect,
  onNodeSelect,
  selectedNode,
}: {
  agentId: string
  onSkillSelect?: (task: string) => void
  onNodeSelect?: (node: OpsWorkflowNode) => void
  selectedNode?: OpsWorkflowNode | null
}) {
  const [mainTab, setMainTab] = useState('ops')
  const [n8nLocal, setN8nLocal] = useState<'checking' | 'online' | 'offline'>('checking')
  const [creatingPreset, setCreatingPreset] = useState<string | null>(null)

  const { data: securityFeed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })
  const latestSecurityContent = securityFeed[0]?.content ?? ''

  // 워크플로우 파싱: 최신 결과에서 JSON 추출
  const workflowNodes: OpsWorkflowNode[] = (() => {
    const wfFeed = securityFeed.find(f => f.content.includes('"nodes"'))
    return wfFeed ? parseWorkflowNodes(wfFeed.content) : []
  })()

  useEffect(() => {
    const controller = new AbortController()
    fetch('http://localhost:5678', { mode: 'no-cors', signal: controller.signal })
      .then(() => setN8nLocal('online'))
      .catch(() => setN8nLocal('offline'))
    return () => controller.abort()
  }, [])

  const { data: schedulesData, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', agentId],
    queryFn: () => schedulesApi.list({ agent_id: agentId }),
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const activeScheduleNames = new Set<string>(
    ((schedulesData ?? []) as Schedule[]).filter(s => s.is_active).map(s => s.name)
  )

  const handlePresetClick = async (preset: { name: string; triggerType: 'interval' | 'cron'; triggerValue: string }) => {
    setCreatingPreset(preset.name)
    const n8nTask = `"${preset.name}" n8n 워크플로우를 생성해줘. Cron 스케줄: ${preset.triggerValue}. 실제로 n8n에 import할 수 있는 완전한 JSON을 만들어줘.`
    onSkillSelect?.(n8nTask)
    if (!activeScheduleNames.has(preset.name)) {
      try {
        await schedulesApi.create({ agent_id: agentId, mission_id: agentId, name: preset.name, trigger_type: preset.triggerType, trigger_value: preset.triggerValue })
        await refetchSchedules()
      } catch {}
    }
    setCreatingPreset(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 최상위 5탭 */}
      <div className="shrink-0 flex border-b border-border overflow-x-auto">
        {OPS_MAIN_TABS.map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)}
            className={cn('px-3 py-2.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
              mainTab === tab.key ? 'border-primary text-text' : 'border-transparent text-muted hover:text-dim')}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── [운영] 탭 ── */}
        {mainTab === 'ops' && (
          <div className="p-3 space-y-3">
            {/* n8n 상태 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted uppercase tracking-widest">n8n 연동</p>
                <div className="flex items-center gap-1">
                  <div className={cn('w-1.5 h-1.5 rounded-full', n8nLocal === 'online' ? 'bg-green-500' : n8nLocal === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse')} />
                  <span className="text-[10px] text-muted">{n8nLocal === 'online' ? '로컬 실행 중' : n8nLocal === 'offline' ? '미실행' : '확인 중'}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <a href="http://localhost:5678" target="_blank" rel="noreferrer"
                  className={cn('flex-1 text-center py-1.5 rounded text-[11px] border transition-colors',
                    n8nLocal === 'online' ? 'border-green-500/40 text-green-400 hover:bg-green-500/10' : 'border-border text-muted/40 pointer-events-none')}>
                  로컬 열기
                </a>
                <a href="https://n8n.cloud" target="_blank" rel="noreferrer"
                  className="flex-1 text-center py-1.5 rounded text-[11px] border border-primary/30 text-primary hover:bg-primary/5 transition-colors">
                  n8n.cloud ↗
                </a>
              </div>
            </div>

            {/* 워크플로우 노드 순서도 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-muted uppercase tracking-widest">워크플로우 순서도</p>
                {workflowNodes.length > 0 && (
                  <span className="text-[10px] text-primary">{workflowNodes.length}개 노드</span>
                )}
              </div>
              <div className="border border-border rounded-lg overflow-hidden bg-bg">
                <WorkflowFlowchart nodes={workflowNodes} selectedNode={selectedNode ?? null} onNodeSelect={node => onNodeSelect?.(node)} />
              </div>
              {workflowNodes.length > 0 && (
                <p className="text-[10px] text-muted/60 mt-1 text-center">노드 클릭 → 중앙 패널에 설정 가이드 표시</p>
              )}
            </div>

            {/* 카테고리별 자동화 프리셋 */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]" />
                <span className="text-[10px] text-muted">활성 스케줄</span>
              </div>
              <div className="space-y-1.5">
                {AUTOMATION_CATEGORIES.map(cat => (
                  <CategoryAccordion key={cat.id} category={cat} activeScheduleNames={activeScheduleNames} onPresetClick={handlePresetClick} />
                ))}
              </div>
            </div>

            {creatingPreset && (
              <p className="text-[10px] text-muted text-center animate-pulse">"{creatingPreset}" 스케줄 생성 중...</p>
            )}
          </div>
        )}

        {/* ── [인프라] 탭 ── */}
        {mainTab === 'infra' && (
          <div className="p-3 space-y-2">
            {INFRA_CATEGORIES.map(cat => (
              <InfraCategoryAccordion key={cat.id} category={cat} onSkillSelect={onSkillSelect} />
            ))}
          </div>
        )}

        {/* ── [연동] 탭 ── */}
        {mainTab === 'integration' && (
          <div className="p-3 space-y-4">
            {/* n8n 템플릿 */}
            <div>
              <p className="text-[10px] text-muted uppercase tracking-widest mb-2">📚 n8n 워크플로우 템플릿</p>
              <div className="flex flex-wrap gap-1.5">
                {N8N_CATEGORIES.map(cat => (
                  <button key={cat.label} onClick={() => onSkillSelect?.(cat.prompt)} title={cat.prompt}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors">
                    <span>{cat.emoji}</span><span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* 외부 서비스 */}
            <div>
              <p className="text-[10px] text-muted uppercase tracking-widest mb-2">외부 서비스 연동</p>
              <div className="flex flex-wrap gap-1.5">
                {EXTERNAL_SKILLS.map(skill => (
                  <button key={skill.label} onClick={() => onSkillSelect?.(skill.prompt)} title={skill.prompt}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors">
                    <span>{skill.emoji}</span><span>{skill.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* AX-Clinic 크로스셀 */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-[11px] font-semibold text-primary mb-1">🤝 AX Clinic 자동화 컨설팅</p>
              <p className="text-[10px] text-muted leading-relaxed mb-2">
                n8n 워크플로우 설계부터 운영까지 전문 컨설팅.<br />
                벡터 DB 기반 자동화 지식 검색 지원.
              </p>
              <a href="https://ax-clinic.vercel.app" target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors">
                <ExternalLink size={10} /> AX Clinic 방문하기
              </a>
            </div>
          </div>
        )}

        {/* ── [환경변수] 탭 ── */}
        {mainTab === 'env' && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-muted uppercase tracking-widest">환경변수 관리</p>
            {ENV_ACTIONS.map(action => (
              <button key={action.label} onClick={() => onSkillSelect?.(action.prompt)} title={action.prompt}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-3 rounded-lg border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
                <span className="text-sm text-dim font-medium">{action.label}</span>
                <span className="text-[11px] text-muted">{action.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── [보안] 탭 ── */}
        {mainTab === 'security' && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-muted uppercase tracking-widest">보안 감사</p>
            {SECURITY_ACTIONS.map(action => (
              <button key={action.label} onClick={() => onSkillSelect?.(action.prompt)} title={action.prompt}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-3 rounded-lg border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
                <span className="text-sm text-dim font-medium">{action.label}</span>
                <span className="text-[11px] text-muted">{action.desc}</span>
              </button>
            ))}
            {latestSecurityContent && <SecurityResultCard content={latestSecurityContent} />}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CENTER (TOP): 노드 상세 연결 가이드 ──────────────────────────────────────
export function OpsNodeGuidePanel({ node, agentId }: { node: OpsWorkflowNode | null; agentId: string }) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 4000,
  })

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4 bg-bg/50">
        <Zap size={28} className="text-muted/30" />
        <p className="text-sm text-muted">좌측 순서도에서 노드를 클릭하면<br />상세 연결 가이드가 여기에 표시됩니다</p>
        <p className="text-[11px] text-muted/50">n8n 초보자도 단계별로 쉽게 따라할 수 있습니다</p>
        {feed[0]?.content && (
          <div className="mt-2 w-full max-w-lg text-left bg-surface/50 border border-border rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">최근 봇 출력</p>
            <p className="text-[11px] text-dim leading-relaxed whitespace-pre-wrap">{feed[0].content.slice(0, 300)}{feed[0].content.length > 300 ? '...' : ''}</p>
          </div>
        )}
      </div>
    )
  }

  const guide = getNodeGuide(node.type)

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface/50 shrink-0">
        <span className="text-xl">{node.emoji}</span>
        <div>
          <h3 className="text-sm font-semibold text-text">{node.name}</h3>
          <p className="text-[10px] text-muted">{node.typeLabel} — n8n 노드 연결 가이드</p>
        </div>
        {guide.credentialName && (
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle size={10} className="text-yellow-400" />
            <span className="text-[10px] text-yellow-400">{guide.credentialName} 필요</span>
          </div>
        )}
      </div>

      {/* 단계별 가이드 */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {guide.steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[11px] text-primary font-bold">{i + 1}</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-text mb-1">{step.title}</p>
              <p className="text-[12px] text-dim leading-relaxed whitespace-pre-wrap bg-bg border border-border rounded-lg px-3 py-2">{step.body}</p>
            </div>
          </div>
        ))}

        {guide.tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-[13px]">💡</span>
            <p className="text-[12px] text-primary/80 leading-relaxed">{guide.tips}</p>
          </div>
        )}

        {/* n8n 문서 링크 */}
        <a
          href={`https://docs.n8n.io/integrations/builtin/`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-muted hover:text-primary transition-colors"
        >
          <ExternalLink size={10} /> n8n 공식 통합 문서 보기
        </a>
      </div>
    </div>
  )
}

const OPS_SKILLS = [
  { label: 'n8n 워크플로우', prompt: '/new-n8n-workflow Slack 메시지가 오면 자동으로 이슈를 생성하는 n8n 워크플로우를 만들어줘' },
  { label: '월간 재무',       prompt: '/monthly-finance 이번 달 수입/지출 현황을 정리하고 MRR, 순이익, API 비용을 분석해줘' },
  { label: '비용 감사',       prompt: '/audit-costs 현재 모든 구독 서비스와 API 비용을 감사하고 절감 방안을 제시해줘' },
  { label: '장애 보고서',     prompt: '/incident-report 오늘 발생한 장애의 원인, 영향, 재발 방지 방안을 정리해줘' },
  { label: '세금 준비',       prompt: '/tax-prep 이번 분기 세금 신고를 위한 수입/지출 데이터를 정리해줘' },
]

// ── CENTER (alias for UnifiedBotPage compatibility) ──────────────────────────
export function OpsCenterPanel({ agentId }: { agentId: string; streamOutput?: string; isRunning?: boolean }) {
  return <OpsNodeGuidePanel node={null} agentId={agentId} />
}

// ── RIGHT: n8n 워크플로우 관리 + import + AX-Clinic + 다음봇 ─────────────────
export function OpsRightPanel({ agentId, onSkillSelect, currentRole = 'ops', content = '' }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  currentRole?: string
  content?: string
}) {
  const [n8nStatus, setN8nStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('http://localhost:5678', { mode: 'no-cors', signal: ctrl.signal })
      .then(() => setN8nStatus('online'))
      .catch(() => setN8nStatus('offline'))
    return () => ctrl.abort()
  }, [])

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  const workflowResults = feed.filter(f => f.content.includes('"nodes"'))

  const extractJson = (wfContent: string): string => {
    const match = wfContent.match(/```json\n([\s\S]+?)\n```/)
    return match ? match[1] : wfContent
  }

  const handleDownloadWorkflow = (wfContent: string, idx: number) => {
    const json = extractJson(wfContent)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oomni-workflow-${idx + 1}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyWorkflow = (wfContent: string) => {
    navigator.clipboard.writeText(extractJson(wfContent))
    setImportMsg('클립보드에 복사됨!')
    setTimeout(() => setImportMsg(null), 2000)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string
        JSON.parse(json)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        setImportMsg('다운로드 완료! n8n에서 Import하세요')
      } catch {
        setImportMsg('유효하지 않은 JSON 파일입니다')
      }
      setTimeout(() => setImportMsg(null), 3000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-y-auto">
      {/* n8n 연동 — 크게 강조 */}
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2">n8n 연동</p>
        <div className="space-y-2">
          {/* 로컬 n8n */}
          <div className="rounded-lg border border-border bg-bg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', n8nStatus === 'online' ? 'bg-green-500' : n8nStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse')} />
                <span className="text-[12px] text-dim font-medium">로컬 n8n (localhost:5678)</span>
              </div>
              {n8nStatus === 'online' ? (
                <a href="http://localhost:5678" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 transition-colors">
                  열기 <ExternalLink size={9} />
                </a>
              ) : (
                <span className="text-[10px] text-muted">미실행</span>
              )}
            </div>
            {n8nStatus === 'offline' && (
              <div className="px-3 pb-2 border-t border-border/50">
                <p className="text-[10px] text-muted mt-1.5">터미널에서 실행: <code className="text-primary bg-primary/10 px-1 rounded">npx n8n</code></p>
              </div>
            )}
          </div>
          {/* 클라우드 n8n */}
          <a href="https://n8n.cloud" target="_blank" rel="noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-[12px] text-dim font-medium">n8n Cloud</span>
            </div>
            <span className="text-[11px] text-primary flex items-center gap-1">접속 <ExternalLink size={9} /></span>
          </a>
        </div>
      </div>

      {/* 워크플로우 JSON 관리 */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-muted uppercase tracking-widest">워크플로우 JSON</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => fileInputRef.current?.click()}
              className="text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors">
              JSON 불러오기
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        {importMsg && (
          <div className="mb-2 px-2 py-1.5 rounded bg-primary/10 border border-primary/20 text-[11px] text-primary">{importMsg}</div>
        )}

        {workflowResults.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-border rounded-lg">
            <p className="text-[11px] text-muted/60 mb-1">AI가 생성한 워크플로우가 없습니다</p>
            <p className="text-[10px] text-muted/40">n8n 워크플로우 생성을 요청하면<br />여기에 JSON이 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflowResults.map((wf, i) => (
              <div key={wf.id} className="px-3 py-3 rounded-lg bg-bg border border-border">
                <p className="text-[11px] text-dim mb-2 font-medium">워크플로우 #{i + 1}</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => handleDownloadWorkflow(wf.content, i)}
                    className="flex items-center gap-1 text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors">
                    <Download size={9} /> 다운로드
                  </button>
                  <button onClick={() => handleCopyWorkflow(wf.content)}
                    className="flex items-center gap-1 text-[10px] text-muted border border-border rounded px-1.5 py-0.5 hover:text-text transition-colors">
                    <Copy size={9} /> 복사
                  </button>
                  {n8nStatus === 'online' && (
                    <a href="http://localhost:5678/workflow/new" target="_blank" rel="noreferrer"
                      onClick={() => handleCopyWorkflow(wf.content)}
                      className="flex items-center gap-1 text-[10px] text-green-400 border border-green-500/30 rounded px-1.5 py-0.5 hover:bg-green-500/10 transition-colors"
                      title="JSON이 클립보드에 복사됩니다. n8n에서 붙여넣기 하세요.">
                      n8n Import ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 빠른 실행 */}
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {OPS_SKILLS.map(skill => (
            <button key={skill.label} onClick={() => onSkillSelect?.(skill.prompt)} title={skill.prompt}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-[11px] text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors">
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      <ArchiveButton content={feed[0]?.content ?? ''} title={feed[0]?.content?.slice(0, 50)} botRole="ops" tags={['OOMNI', 'ops']} />
      <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />
    </div>
  )
}
