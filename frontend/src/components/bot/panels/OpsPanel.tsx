import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, schedulesApi, type FeedItem, type Schedule } from '../../../lib/api'
import { Zap, Download, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

// ── 5개 최상위 탭 ────────────────────────────────────────────────────────────
const OPS_MAIN_TABS = [
  { key: 'ops', label: '운영' },
  { key: 'infra', label: '인프라' },
  { key: 'integration', label: '연동' },
  { key: 'env', label: '환경변수' },
  { key: 'security', label: '보안' },
]

const OPS_TABS = [
  { key: 'automation', label: '자동화' },
  { key: 'finance', label: '재무' },
  { key: 'tax', label: '세무' },
  { key: 'hr', label: '인사' },
]

// ── 카테고리별 자동화 프리셋 정의 ────────────────────────────────────────────
interface AutomationPreset {
  name: string
  /** schedules API에 POST할 기본값 */
  triggerType: 'interval' | 'cron'
  triggerValue: string
}

interface AutomationCategory {
  id: string
  label: string
  presets: AutomationPreset[]
}

const AUTOMATION_CATEGORIES: AutomationCategory[] = [
  {
    id: 'general',
    label: '일반',
    presets: [
      { name: '이슈 자동생성', triggerType: 'cron', triggerValue: '0 9 * * 1-5' },
      { name: '일일 리포트 자동화', triggerType: 'cron', triggerValue: '0 18 * * 1-5' },
      { name: '주간 비용 정산', triggerType: 'cron', triggerValue: '0 10 * * 1' },
    ],
  },
  {
    id: 'finance',
    label: '재무',
    presets: [
      { name: '월별 손익계산서 자동생성', triggerType: 'cron', triggerValue: '0 9 1 * *' },
      { name: 'Stripe 매출 집계', triggerType: 'cron', triggerValue: '0 8 * * 1' },
      { name: '미수금 알림', triggerType: 'cron', triggerValue: '0 10 * * 3' },
    ],
  },
  {
    id: 'tax',
    label: '세무',
    presets: [
      { name: '분기별 부가세 정리', triggerType: 'cron', triggerValue: '0 9 1 1,4,7,10 *' },
      { name: '영수증 수집/분류', triggerType: 'cron', triggerValue: '0 9 * * 1' },
    ],
  },
  {
    id: 'hr',
    label: '인사',
    presets: [
      { name: '주간 업무일지', triggerType: 'cron', triggerValue: '0 17 * * 5' },
      { name: '월간 성과 정리', triggerType: 'cron', triggerValue: '0 9 28 * *' },
    ],
  },
]

// ── [인프라] 탭 스킬 ─────────────────────────────────────────────────────────
const INFRA_SKILLS = [
  { label: 'Vercel 배포', emoji: '▲', prompt: '/deploy-vercel 현재 프로젝트를 Vercel에 배포하고 배포 URL을 알려줘. vercel.json 설정도 최적화해줘.' },
  { label: 'Docker 빌드', emoji: '🐳', prompt: '/docker-build 프로덕션용 Dockerfile을 작성하고 docker-compose.yml도 만들어줘. 멀티스테이지 빌드 적용.' },
  { label: 'GitHub Actions', emoji: '⚙️', prompt: '/setup-github-actions CI/CD 파이프라인을 설정해줘. PR 시 lint+test, main 머지 시 자동 배포.' },
  { label: 'CI 파이프라인', emoji: '🔄', prompt: '/setup-ci 타입체크, 린트, 테스트, 빌드를 순서대로 실행하는 CI 파이프라인을 설정해줘.' },
]

// ── [연동] 탭 외부 서비스 ────────────────────────────────────────────────────
const EXTERNAL_SKILLS = [
  { label: 'Slack 연동', emoji: '💬', prompt: '/integrate-slack Slack 워크스페이스에 봇을 연동하고 이벤트를 수신하는 설정을 알려줘.' },
  { label: 'Notion 연동', emoji: '📝', prompt: '/integrate-notion Notion API를 연동해서 데이터베이스를 읽고 쓰는 코드를 작성해줘.' },
  { label: 'GitHub 웹훅', emoji: '🐙', prompt: '/integrate-github-webhook GitHub 웹훅을 설정해서 PR, Issue, Push 이벤트를 처리하는 엔드포인트를 만들어줘.' },
  { label: '웹훅 허브', emoji: '🔗', prompt: '/integrate-webhook-hub 단일 웹훅 엔드포인트로 여러 서비스의 이벤트를 수신하고 라우팅하는 허브를 구축해줘.' },
]

// ── [환경변수] 탭 액션 ───────────────────────────────────────────────────────
const ENV_ACTIONS = [
  {
    label: 'NEXT_PUBLIC_ 스캔',
    desc: '누락된 환경변수 찾기',
    prompt: '/scan-env 프로젝트 전체에서 사용하는 환경변수를 스캔하고 .env.example과 비교해줘. 누락된 것을 찾아줘.',
  },
  {
    label: '로컬↔Vercel 동기화',
    desc: '.env.local과 Vercel env 비교',
    prompt: '/sync-env 로컬 .env.local 파일과 Vercel 환경변수를 비교하고 동기화 방법을 알려줘.',
  },
  {
    label: '.env 템플릿 생성',
    desc: '.env.example 자동 생성',
    prompt: '/gen-env-template 현재 코드베이스를 분석해서 .env.example 파일을 생성해줘. 각 변수 설명 포함.',
  },
]

// ── [보안] 탭 액션 ───────────────────────────────────────────────────────────
const SECURITY_ACTIONS = [
  {
    label: 'OWASP 스캔',
    desc: 'OWASP Top 10 취약점 점검',
    prompt: '/security-audit 현재 코드베이스의 OWASP Top 10 기준 보안 취약점을 점검해줘. 결과를 🔴CRITICAL/🟠HIGH/🟡MEDIUM/🟢LOW 심각도로 분류해서 보고해줘.',
  },
  {
    label: 'npm audit',
    desc: '의존성 취약점 검사',
    prompt: '/npm-audit npm audit를 실행하고 발견된 취약점을 심각도별로 정리해서 수정 방법을 알려줘.',
  },
  {
    label: 'RLS 검증',
    desc: 'Supabase Row Level Security',
    prompt: '/check-rls Supabase 데이터베이스의 RLS 정책을 검증하고 취약한 부분을 찾아줘.',
  },
]

// ── 공식 n8n 템플릿 카테고리 프리셋 ──────────────────────────────────────────
const N8N_CATEGORIES = [
  {
    label: 'Slack 알림',
    emoji: '💬',
    prompt: 'n8n.io/workflows, community.n8n.io, blog.n8n.io에서 Slack 연동 공식 템플릿과 커뮤니티 사례를 조회한 뒤, 다음을 구현해줘: 특정 이벤트 발생 시 Slack 채널에 포맷된 메시지 자동 전송. 스레드 답글(thread_ts 보존), 에러 처리와 재시도 로직 포함.',
  },
  {
    label: 'Gmail 자동화',
    emoji: '📧',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations, blog.n8n.io에서 Gmail 자동화 템플릿과 베스트 프랙티스를 조회한 뒤, 다음을 구현해줘: 이메일 수신 시 내용 분석 후 자동 분류/응답. OAuth2 설정, 첨부파일 Binary Data 처리, HTML 템플릿 변수 포함.',
  },
  {
    label: 'GitHub 연동',
    emoji: '🐙',
    prompt: 'n8n.io/workflows, github.com/n8n-io/n8n/discussions에서 GitHub 연동 공식 템플릿과 커뮤니티 사례를 조회한 뒤, 다음을 구현해줘: Webhook으로 PR/Issue/Push 이벤트별 분기 처리 → Slack 알림 + 자동 라벨링. Switch 노드로 이벤트 타입 분기.',
  },
  {
    label: '데이터 파이프라인',
    emoji: '🔄',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations, community.n8n.io/c/show-and-tell에서 데이터 파이프라인 패턴을 조회한 뒤, 다음을 구현해줘: 외부 API 페이지네이션 수집 → Loop Over Items → Code 노드 변환 → DB/Google Sheet upsert. Rate limit 처리 포함.',
  },
  {
    label: 'CRM 연동',
    emoji: '👥',
    prompt: 'n8n.io/workflows, blog.n8n.io에서 CRM 자동화 템플릿(HubSpot/Salesforce)을 조회한 뒤, 다음을 구현해줘: 리드 생성 → 중복 제거(Merge 노드) → CRM Upsert + 담당자 Slack 알림 + 팔로업 스케줄 자동 등록.',
  },
  {
    label: '스케줄 리포트',
    emoji: '📊',
    prompt: 'n8n.io/workflows, community.n8n.io에서 자동 리포트 공식 템플릿을 조회한 뒤, 다음을 구현해줘: Schedule Trigger → DB/API 쿼리 → Code 노드 집계/포맷 → Slack 메시지 + 이메일 발송 → 결과 파일 저장.',
  },
  {
    label: 'AI 자동화',
    emoji: '🤖',
    prompt: 'n8n.io/workflows?categories=25, blog.n8n.io에서 AI 자동화 공식 템플릿을 조회한 뒤, 다음을 구현해줘: Webhook → OpenAI/Anthropic API 호출 → JSON 파싱 → 후속 액션(DB저장/슬랙알림). 토큰 비용 최적화와 에러 핸들링 포함.',
  },
  {
    label: 'Notion 연동',
    emoji: '📝',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations/builtin에서 Notion 연동 패턴을 조회한 뒤, 다음을 구현해줘: Webhook 또는 Schedule → Notion DB 쿼리/업데이트 → rich_text 타입 처리 → 관련 팀원 Slack 알림.',
  },
  {
    label: 'Google Sheet',
    emoji: '📋',
    prompt: 'n8n.io/workflows, community.n8n.io/c/show-and-tell에서 Google Sheets 자동화 패턴을 조회한 뒤, 다음을 구현해줘: 외부 데이터 → Google Sheets 행 추가/업데이트 + 중복 체크. Batch 처리와 API 할당량 관리 포함.',
  },
  {
    label: 'Webhook 허브',
    emoji: '🔗',
    prompt: 'n8n.io/workflows, docs.n8n.io/integrations/builtin, community.n8n.io에서 Webhook 허브 패턴을 조회한 뒤, 다음을 구현해줘: 단일 Webhook 엔드포인트로 여러 서비스 이벤트 수신 → Switch 노드로 분기 → 각 서비스별 처리 플로우. HMAC 서명 검증 포함.',
  },
]

// ── CategoryAccordion ─────────────────────────────────────────────────────────
function CategoryAccordion({
  category,
  activeScheduleNames,
  onPresetClick,
}: {
  category: AutomationCategory
  activeScheduleNames: Set<string>
  onPresetClick: (preset: AutomationPreset) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2 bg-surface hover:bg-border/30 transition-colors"
      >
        <span className="text-xs font-medium text-dim">{category.label}</span>
        {open
          ? <ChevronDown size={12} className="text-muted" />
          : <ChevronRight size={12} className="text-muted" />}
      </button>

      {/* Presets */}
      {open && (
        <div className="divide-y divide-border/50">
          {category.presets.map(preset => {
            const isActive = activeScheduleNames.has(preset.name)
            return (
              <button
                key={preset.name}
                onClick={() => onPresetClick(preset)}
                title={isActive ? '활성 자동화 스케줄 — 클릭하여 관리' : '클릭하여 자동화 스케줄 생성'}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-bg hover:bg-surface/60 transition-colors text-left group"
              >
                {/* 파란 불 (활성 표시) */}
                <div
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                    isActive
                      ? 'bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]'
                      : 'bg-border group-hover:bg-border/80'
                  )}
                />
                <span className="text-sm text-dim flex-1 leading-snug">{preset.name}</span>
                {isActive && (
                  <span className="text-[10px] text-blue-400 shrink-0">활성</span>
                )}
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
    { key: '🟠HIGH', label: 'HIGH', color: 'border-orange-500/50 bg-orange-500/10 text-orange-400' },
    { key: '🟡MEDIUM', label: 'MEDIUM', color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
    { key: '🟢LOW', label: 'LOW', color: 'border-green-500/50 bg-green-500/10 text-green-400' },
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

// ── LEFT: 5탭 최상위 레이아웃 ─────────────────────────────────────────────────
export function OpsLeftPanel({ agentId, onSkillSelect }: { agentId: string; onSkillSelect?: (task: string) => void }) {
  const [mainTab, setMainTab] = useState('ops')
  const [n8nLocal, setN8nLocal] = useState<'checking' | 'online' | 'offline'>('checking')
  const [creatingPreset, setCreatingPreset] = useState<string | null>(null)

  // 보안 탭: feed 에서 최신 결과
  const { data: securityFeed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })
  const latestSecurityContent = securityFeed[0]?.content ?? ''

  useEffect(() => {
    const controller = new AbortController()
    fetch('http://localhost:5678', { mode: 'no-cors', signal: controller.signal })
      .then(() => setN8nLocal('online'))
      .catch(() => setN8nLocal('offline'))
    return () => controller.abort()
  }, [])

  // 현재 agentId에 연결된 스케줄 목록 조회
  const { data: schedulesData, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', agentId],
    queryFn: () => schedulesApi.list({ agent_id: agentId }),
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const activeScheduleNames = new Set<string>(
    ((schedulesData ?? []) as Schedule[])
      .filter(s => s.is_active)
      .map(s => s.name)
  )

  // 프리셋 클릭: AI로 n8n JSON 생성 + 스케줄 등록
  const handlePresetClick = async (preset: AutomationPreset) => {
    setCreatingPreset(preset.name)

    const n8nTask = `"${preset.name}" n8n 워크플로우를 생성해줘. Cron 스케줄: ${preset.triggerValue}. 실제로 n8n에 import할 수 있는 완전한 JSON을 만들어줘.`
    onSkillSelect?.(n8nTask)

    if (!activeScheduleNames.has(preset.name)) {
      try {
        await schedulesApi.create({
          agent_id: agentId,
          mission_id: agentId,
          name: preset.name,
          trigger_type: preset.triggerType,
          trigger_value: preset.triggerValue,
        })
        await refetchSchedules()
      } catch {
        // 스케줄 생성 실패는 조용히 무시
      }
    }

    setCreatingPreset(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 최상위 5탭 */}
      <div className="shrink-0 flex border-b border-border overflow-x-auto">
        {OPS_MAIN_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={cn(
              'px-3 py-2.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
              mainTab === tab.key
                ? 'border-primary text-text'
                : 'border-transparent text-muted hover:text-dim'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭별 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {/* ── [운영] 탭: 기존 OpsLeftPanel 콘텐츠 ── */}
        {mainTab === 'ops' && (
          <div className="p-4 space-y-4">
            {/* n8n 상태 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted uppercase tracking-widest">n8n 연동</p>
                <div className="flex items-center gap-1">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    n8nLocal === 'online' ? 'bg-green-500' :
                    n8nLocal === 'offline' ? 'bg-red-400' :
                    'bg-yellow-400 animate-pulse'
                  )} />
                  <span className="text-[10px] text-muted">
                    {n8nLocal === 'online' ? '로컬 실행 중' :
                     n8nLocal === 'offline' ? '미실행' : '확인 중'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href="http://localhost:5678"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'flex-1 text-center py-1.5 rounded text-xs border transition-colors',
                    n8nLocal === 'online'
                      ? 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                      : 'border-border text-muted/40 pointer-events-none'
                  )}
                >
                  로컬 열기
                </a>
                <a
                  href="https://n8n.cloud"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1.5 rounded text-xs border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                >
                  n8n.cloud ↗
                </a>
              </div>
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_1px_rgba(59,130,246,0.5)]" />
              <span className="text-[10px] text-muted">활성화된 자동화 스케줄</span>
            </div>

            {/* 카테고리별 자동화 프리셋 */}
            <div className="space-y-2">
              {AUTOMATION_CATEGORIES.map(cat => (
                <CategoryAccordion
                  key={cat.id}
                  category={cat}
                  activeScheduleNames={activeScheduleNames}
                  onPresetClick={handlePresetClick}
                />
              ))}
            </div>

            {creatingPreset && (
              <p className="text-[10px] text-muted text-center animate-pulse">
                "{creatingPreset}" 스케줄 생성 중...
              </p>
            )}
          </div>
        )}

        {/* ── [인프라] 탭 ── */}
        {mainTab === 'infra' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted uppercase tracking-widest">인프라 & 배포</p>
            <div className="grid grid-cols-2 gap-2">
              {INFRA_SKILLS.map(skill => (
                <button
                  key={skill.label}
                  onClick={() => onSkillSelect?.(skill.prompt)}
                  title={skill.prompt}
                  className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-colors text-center"
                >
                  <span className="text-2xl">{skill.emoji}</span>
                  <span className="text-xs text-dim leading-snug">{skill.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── [연동] 탭 ── */}
        {mainTab === 'integration' && (
          <div className="p-4 space-y-4">
            {/* n8n 템플릿 */}
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">📚 n8n 멀티소스 템플릿</p>
              <div className="flex flex-wrap gap-1.5">
                {N8N_CATEGORIES.map(cat => (
                  <button
                    key={cat.label}
                    onClick={() => onSkillSelect?.(cat.prompt)}
                    title={cat.prompt}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 외부 서비스 연동 */}
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">외부 서비스 연동</p>
              <div className="flex flex-wrap gap-1.5">
                {EXTERNAL_SKILLS.map(skill => (
                  <button
                    key={skill.label}
                    onClick={() => onSkillSelect?.(skill.prompt)}
                    title={skill.prompt}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <span>{skill.emoji}</span>
                    <span>{skill.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── [환경변수] 탭 ── */}
        {mainTab === 'env' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted uppercase tracking-widest">환경변수 관리</p>
            <div className="space-y-2">
              {ENV_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => onSkillSelect?.(action.prompt)}
                  title={action.prompt}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-3 rounded-lg border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                >
                  <span className="text-sm text-dim font-medium">{action.label}</span>
                  <span className="text-[11px] text-muted">{action.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── [보안] 탭 ── */}
        {mainTab === 'security' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted uppercase tracking-widest">보안 감사</p>
            <div className="space-y-2">
              {SECURITY_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => onSkillSelect?.(action.prompt)}
                  title={action.prompt}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-3 rounded-lg border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                >
                  <span className="text-sm text-dim font-medium">{action.label}</span>
                  <span className="text-[11px] text-muted">{action.desc}</span>
                </button>
              ))}
            </div>

            {/* 보안 스캔 결과 카드 */}
            {latestSecurityContent && (
              <SecurityResultCard content={latestSecurityContent} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// CENTER: 운영 탭
export function OpsCenterPanel({ agentId, streamOutput, isRunning }: { agentId: string; streamOutput?: string; isRunning?: boolean }) {
  const [activeTab, setActiveTab] = useState('automation')
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  const latest = feed[0]

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border px-4 shrink-0">
        {OPS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-primary text-text'
                : 'border-transparent text-muted hover:text-dim'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isRunning ? (
          <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput || '자동화 구성 중...'}</pre>
        ) : !latest ? (
          streamOutput ? (
            <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Zap size={36} className="text-muted/30" />
              <p className="text-base text-muted">하단 입력창에서 자동화를 지시하세요</p>
              <p className="text-sm text-muted/60">"Slack 알림 자동화 워크플로우 만들어줘" 등</p>
            </div>
          )
        ) : (
          <div className="text-base text-dim leading-relaxed whitespace-pre-wrap">
            {latest.content}
          </div>
        )}
      </div>
    </div>
  )
}

const OPS_SKILLS = [
  { label: 'n8n 워크플로우', prompt: '/new-n8n-workflow Slack 메시지가 오면 자동으로 이슈를 생성하는 n8n 워크플로우를 만들어줘' },
  { label: '월간 재무', prompt: '/monthly-finance 이번 달 수입/지출 현황을 정리하고 MRR, 순이익, API 비용을 분석해줘' },
  { label: '비용 감사', prompt: '/audit-costs 현재 모든 구독 서비스와 API 비용을 감사하고 절감 방안을 제시해줘' },
  { label: '장애 보고서', prompt: '/incident-report 오늘 발생한 장애의 원인, 영향, 재발 방지 방안을 정리해줘' },
  { label: '세금 준비', prompt: '/tax-prep 이번 분기 세금 신고를 위한 수입/지출 데이터를 정리해줘' },
]

// RIGHT: n8n 워크플로우 관리 + import + 다음봇
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
        JSON.parse(json) // validate
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
      {/* n8n 연동 상태 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">n8n 연동</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg border border-border">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', n8nStatus === 'online' ? 'bg-green-500' : n8nStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse')} />
              <span className="text-xs text-dim">로컬 n8n</span>
            </div>
            {n8nStatus === 'online' ? (
              <a href="http://localhost:5678" target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">열기 ↗</a>
            ) : (
              <span className="text-[10px] text-muted">미실행</span>
            )}
          </div>
          <a href="https://n8n.cloud" target="_blank" rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg border border-border hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-dim">n8n Cloud</span>
            </div>
            <span className="text-[10px] text-primary">접속 ↗</span>
          </a>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted uppercase tracking-widest">워크플로우 관리</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors"
          >
            JSON 불러오기
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>

        {importMsg && (
          <div className="mb-2 px-2 py-1.5 rounded bg-primary/10 border border-primary/20 text-[11px] text-primary">
            {importMsg}
          </div>
        )}

        {workflowResults.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted/60 mb-1">AI가 생성한 워크플로우가 없습니다</p>
            <p className="text-[10px] text-muted/40">봇에게 n8n 워크플로우 생성을 요청하세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflowResults.map((wf, i) => (
              <div key={wf.id} className="px-3 py-3 rounded-lg bg-bg border border-border">
                <p className="text-xs text-dim mb-2 font-medium">워크플로우 #{i + 1}</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleDownloadWorkflow(wf.content, i)}
                    className="flex items-center gap-1 text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5 hover:bg-primary/5 transition-colors"
                  >
                    <Download size={9} /> 다운로드
                  </button>
                  <button
                    onClick={() => handleCopyWorkflow(wf.content)}
                    className="flex items-center gap-1 text-[10px] text-muted border border-border rounded px-1.5 py-0.5 hover:text-text transition-colors"
                  >
                    <Copy size={9} /> 복사
                  </button>
                  {n8nStatus === 'online' && (
                    <a
                      href="http://localhost:5678/workflow/new"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleCopyWorkflow(wf.content)}
                      className="flex items-center gap-1 text-[10px] text-green-400 border border-green-500/30 rounded px-1.5 py-0.5 hover:bg-green-500/10 transition-colors"
                      title="JSON이 클립보드에 복사됩니다. n8n에서 붙여넣기 하세요."
                    >
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
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {OPS_SKILLS.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(skill.prompt)}
              title={skill.prompt}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs text-dim hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      <ArchiveButton
        content={feed[0]?.content ?? ''}
        title={feed[0]?.content?.slice(0, 50)}
        botRole="ops"
        tags={['OOMNI', 'ops']}
      />

      <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />
    </div>
  )
}
