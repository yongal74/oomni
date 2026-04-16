import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, videoApi, cdpApi, type FeedItem } from '../../../lib/api'
import {
  TrendingUp, Users, MessageSquare, BarChart2, Video, Film,
  Mail, Smartphone, Link2, ChevronRight, Zap, BarChart, ArrowUpRight,
  Lock, DollarSign, RefreshCw, GitBranch, FlaskConical,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

type MetricType = 'users' | 'revenue' | 'signups' | 'mau' | 'mrr'

const TABS = [
  { key: 'marketing', label: '마케팅 실행', icon: TrendingUp },
  { key: 'analytics', label: '웹로그 분석', icon: BarChart2 },
  { key: 'cs', label: 'CS 현황', icon: MessageSquare },
  { key: 'cdp', label: 'CDP 세그먼트', icon: Users },
]

const METRIC_OPTIONS: { value: MetricType; label: string; emoji: string; unit: string }[] = [
  { value: 'users', label: '유저 수', emoji: '👥', unit: '명' },
  { value: 'revenue', label: '매출', emoji: '💰', unit: '만원' },
  { value: 'signups', label: '신규 가입', emoji: '✍️', unit: '명' },
  { value: 'mau', label: 'MAU', emoji: '📈', unit: '명' },
  { value: 'mrr', label: 'MRR', emoji: '💎', unit: '만원' },
]

const COLOR_MAP: Record<string, string> = {
  yellow: 'text-yellow-400',
  red: 'text-red-400',
  green: 'text-green-400',
  blue: 'text-blue-400',
}

// ── 구조화된 Growth 결과 컴포넌트 ────────────────────────────────────────────
function StructuredGrowthResult({ content }: { content: string }) {
  // 마크다운 섹션으로 파싱 (## 헤더 기준)
  const sections = content.split(/\n(?=#{1,3}\s)/).map(section => {
    const lines = section.trim().split('\n')
    const headerLine = lines[0] ?? ''
    const headerMatch = headerLine.match(/^(#{1,3})\s+(.+)/)
    const body = lines.slice(1).join('\n').trim()
    return {
      level: headerMatch ? headerMatch[1].length : 0,
      title: headerMatch ? headerMatch[2] : headerLine,
      body,
      isHeader: !!headerMatch,
    }
  }).filter(s => s.title || s.body)

  if (sections.length === 0) {
    return <pre className="text-sm text-dim leading-relaxed whitespace-pre-wrap font-sans">{content}</pre>
  }

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <div key={i} className={cn(
          'rounded-lg border p-3',
          section.level === 1 ? 'border-primary/30 bg-primary/5' :
          section.level === 2 ? 'border-border bg-surface/60' :
          'border-border/50 bg-bg/50'
        )}>
          {section.isHeader && (
            <p className={cn(
              'font-semibold mb-2',
              section.level === 1 ? 'text-sm text-text' :
              section.level === 2 ? 'text-xs text-dim' :
              'text-xs text-muted'
            )}>
              {section.title}
            </p>
          )}
          {section.body && (
            <pre className="text-xs text-muted leading-relaxed whitespace-pre-wrap font-sans">
              {section.body}
            </pre>
          )}
          {!section.isHeader && (
            <p className="text-xs text-dim leading-relaxed whitespace-pre-wrap">{section.title}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── LEFT: KPI + CDP 세그먼트 + 빠른 캠페인 ──────────────────────────────────
export function GrowthLeftPanel({ onCampaign }: { onCampaign?: (segId: string, channel: 'email' | 'sms' | 'push') => void }) {
  const qc = useQueryClient()
  const kpis = [
    { label: '총 고객',  value: '—', sub: '명' },
    { label: 'DAU',      value: '—', sub: '명' },
    { label: 'MRR',      value: '—', sub: '원' },
    { label: '전환율',   value: '—', sub: '%' },
  ]

  const { data: cdpStatus } = useQuery({
    queryKey: ['cdp-status'],
    queryFn: cdpApi.status,
    staleTime: 30_000,
  })
  const { data: segmentsResult } = useQuery({
    queryKey: ['cdp-segments'],
    queryFn: cdpApi.segments,
    staleTime: 60_000,
  })

  const segments = segmentsResult?.data ?? []
  const isDemo = segmentsResult?.mode === 'demo'
  const cdpConnected = cdpStatus?.connected ?? false

  const campaignMutation = useMutation({
    mutationFn: (vars: { segment_id: string; channel: 'email' | 'sms' | 'push'; message: string }) =>
      cdpApi.campaign(vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cdp-segments'] }),
  })
  const [activeCampaignSeg, setActiveCampaignSeg] = useState<string | null>(null)

  const handleCampaignClick = useCallback((segId: string, channel: 'email' | 'sms' | 'push') => {
    const seg = segments.find(s => s.id === segId)
    if (!seg) return
    setActiveCampaignSeg(segId)
    campaignMutation.mutate(
      { segment_id: segId, channel, message: `[${seg.label}] 자동 캠페인 메시지` },
      { onSettled: () => setActiveCampaignSeg(null) }
    )
    onCampaign?.(segId, channel)
  }, [segments, campaignMutation, onCampaign])

  const [cdpToast, setCdpToast] = useState(false)
  const cdpToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (cdpToastTimerRef.current) clearTimeout(cdpToastTimerRef.current) }
  }, [])

  const showCdpToast = () => {
    if (cdpToastTimerRef.current) clearTimeout(cdpToastTimerRef.current)
    setCdpToast(true)
    cdpToastTimerRef.current = setTimeout(() => setCdpToast(false), 3000)
  }

  return (
    <div className="p-4 space-y-5">
      {/* CDP 토스트 알림 */}
      {cdpToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-surface border border-amber-500/30 shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Lock size={13} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">oomni-cdp 연동 후 사용 가능합니다</p>
        </div>
      )}

      {/* KPI */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">KPI 현황</p>
        <div className="grid grid-cols-2 gap-2">
          {kpis.map(kpi => (
            <div key={kpi.label} className="px-3 py-2.5 rounded-lg bg-bg border border-border">
              <p className="text-[10px] text-muted mb-0.5">{kpi.label}</p>
              <p className="text-base font-semibold text-dim">
                {kpi.value}<span className="text-xs text-muted ml-0.5">{kpi.sub}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted/60 mt-1.5">봇 실행 시 자동 집계됩니다</p>
      </div>

      {/* 자체 기능 섹션 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">자체 기능 (현재 사용 가능)</p>
        <div className="space-y-1.5">
          {[
            { icon: DollarSign, label: 'CAC 분석',    desc: '고객 획득 비용 분석' },
            { icon: RefreshCw,  label: '리텐션 분석', desc: '이탈률 · MAU 추이' },
            { icon: TrendingUp, label: 'MRR 예측',    desc: '월간 반복 매출 예측' },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-bg border border-border"
            >
              <Icon size={14} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-dim font-medium">{label}</p>
                <p className="text-[10px] text-muted/70">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CDP 연동 필요 기능 섹션 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-xs text-muted uppercase tracking-widest">CDP 연동 후 가능</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">향후 연동 예정</span>
        </div>
        <div className="space-y-1.5">
          {[
            { icon: Users,       label: '고객 세그먼트 분석', desc: 'RFM · 행동 기반 세그먼트' },
            { icon: GitBranch,   label: '코호트 분석',        desc: '유입 시점별 리텐션 추이' },
            { icon: FlaskConical, label: 'A/B 테스트 자동화', desc: '실험 설계 · 결과 분석' },
          ].map(({ icon: Icon, label, desc }) => (
            <button
              key={label}
              onClick={showCdpToast}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg bg-bg/50 border border-border/60 opacity-60 hover:opacity-80 transition-opacity text-left"
            >
              <Icon size={14} className="text-muted mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-dim font-medium">{label}</p>
                  <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                    <Lock size={8} />CDP 연동 필요
                  </span>
                </div>
                <p className="text-[10px] text-muted/60">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CDP 세그먼트 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted uppercase tracking-widest">CDP 세그먼트</p>
          <span className="flex items-center gap-1 text-[10px]">
            <span className={cn('w-1.5 h-1.5 rounded-full', cdpConnected ? 'bg-green-400' : 'bg-yellow-400')} />
            <span className={cdpConnected ? 'text-green-400' : 'text-yellow-400'}>
              {cdpConnected ? '연동됨' : isDemo ? '데모' : '미연동'}
            </span>
          </span>
        </div>

        <div className="space-y-1">
          {segments.map(seg => (
            <div
              key={seg.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface transition-colors cursor-pointer group"
              onClick={() => handleCampaignClick(seg.id, 'email')}
            >
              <span className="flex items-center gap-2 text-sm text-dim">
                <span>{seg.icon}</span>{seg.label}
              </span>
              <div className="flex items-center gap-1.5">
                {activeCampaignSeg === seg.id ? (
                  <span className="text-[10px] text-primary">발송 중...</span>
                ) : (
                  <span className={cn('text-xs font-medium', COLOR_MAP[seg.color] ?? 'text-muted')}>
                    {seg.count.toLocaleString()}명
                  </span>
                )}
                <ChevronRight size={11} className="text-muted/40 group-hover:text-muted transition-colors" />
              </div>
            </div>
          ))}
          {isDemo && (
            <p className="text-[10px] text-yellow-400/70 text-center pt-1">데모 데이터 · oomni-cdp 연동 시 실제 고객 데이터</p>
          )}
        </div>
      </div>

      {/* 빠른 캠페인 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">빠른 캠페인</p>
        <div className="space-y-1.5">
          {[
            { icon: Mail,       label: '이메일 캠페인', channel: 'email' as const, desc: '세그먼트별 발송' },
            { icon: Smartphone, label: 'SMS 캠페인',    channel: 'sms'   as const, desc: '문자 발송' },
            { icon: Video,      label: 'AI 영상 캠페인', channel: 'push'  as const, desc: 'oomni-video 연동' },
          ].map(({ icon: Icon, label, channel, desc }) => (
            <button
              key={label}
              onClick={() => segments[0] && handleCampaignClick(segments[0].id, channel)}
              disabled={segments.length === 0}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                segments.length > 0
                  ? 'border-border bg-bg hover:bg-surface'
                  : 'border-dashed border-border bg-bg/30 opacity-50 cursor-not-allowed'
              )}
            >
              <Icon size={14} className="text-primary shrink-0" />
              <div>
                <p className="text-xs text-dim">{label}</p>
                <p className="text-[10px] text-muted/60">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const GROWTH_TAB_KEYWORDS: Record<string, string[]> = {
  marketing: ['마케팅', '광고', 'SEO', '캠페인', 'marketing', '유입', '채널', '검색', '퍼포먼스'],
  analytics: ['웹로그', '분석', '트래픽', 'analytics', 'GA', 'pageview', '방문', '세션', '페이지뷰', '유입경로'],
  cs:        ['CS', '고객지원', '고객 지원', '문의', '상담', 'customer', '피드백', '불만', '지원'],
}

// ── CENTER: 탭별 분석 결과 ───────────────────────────────────────────────────
export function GrowthCenterPanel({ agentId, streamOutput, isRunning }: {
  agentId: string
  streamOutput?: string
  isRunning?: boolean
}) {
  const [activeTab, setActiveTab] = useState('marketing')
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  // 탭별 키워드 필터링, 매칭 없으면 최신 항목 fallback
  const keywords = GROWTH_TAB_KEYWORDS[activeTab] ?? []
  const tabItems = keywords.length > 0
    ? feed.filter(item => keywords.some(kw => item.content.toLowerCase().includes(kw.toLowerCase())))
    : []
  const displayItem = tabItems.length > 0 ? tabItems[0] : feed[0]

  return (
    <div className="h-full flex flex-col">
      {/* 탭 */}
      <div className="flex border-b border-border px-4 shrink-0 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-3 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
              activeTab === key
                ? 'border-primary text-text'
                : 'border-transparent text-muted hover:text-dim'
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'cdp' ? (
          <CdpSegmentTab />
        ) : isRunning ? (
          streamOutput && streamOutput.includes('\n##') ? (
            <StructuredGrowthResult content={streamOutput} />
          ) : (
            <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput || '분석 중...'}</pre>
          )
        ) : !displayItem ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <TrendingUp size={36} className="text-muted/30" />
            {streamOutput ? (
              streamOutput.includes('\n##') ? (
                <StructuredGrowthResult content={streamOutput} />
              ) : (
                <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans text-left">{streamOutput}</pre>
              )
            ) : (
              <>
                <p className="text-base text-muted">하단 입력창에서 그로스 분석을 지시하세요</p>
                <p className="text-sm text-muted/60">"이번 주 성장 현황 분석해줘" 등</p>
              </>
            )}
          </div>
        ) : (
          <StructuredGrowthResult content={displayItem.content} />
        )}
      </div>
    </div>
  )
}

// CDP 세그먼트 탭 내용
function CdpSegmentTab() {
  const { data: statusData } = useQuery({ queryKey: ['cdp-status'], queryFn: cdpApi.status, staleTime: 30_000 })
  const { data: segsData } = useQuery({ queryKey: ['cdp-segments'], queryFn: cdpApi.segments, staleTime: 60_000 })
  const segments = segsData?.data ?? []
  const isDemo = segsData?.mode === 'demo'
  const connected = statusData?.connected ?? false

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 상태 배너 */}
      <div className={cn('rounded-xl border p-4', connected ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5')}>
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', connected ? 'bg-green-500/10' : 'bg-yellow-500/10')}>
            <Link2 size={15} className={connected ? 'text-green-400' : 'text-yellow-400'} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-medium text-text">oomni-cdp</p>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', connected ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400')}>
                {connected ? '연동됨' : isDemo ? '데모 모드' : '미연동'}
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {connected
                ? '실시간 고객 세그먼트 데이터가 연동되어 있습니다.'
                : '설정 → oomni-cdp 연동에서 API 키를 입력하면 실제 고객 데이터가 표시됩니다.'}
            </p>
          </div>
        </div>
      </div>

      {/* 세그먼트 카드 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">세그먼트 현황</p>
        <div className="grid grid-cols-2 gap-2">
          {segments.map(seg => (
            <div key={seg.id} className="rounded-xl bg-bg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-lg">{seg.icon}</span>
                <p className="text-xs text-muted">{seg.label}</p>
              </div>
              <p className={cn('text-xl font-bold', COLOR_MAP[seg.color] ?? 'text-text')}>
                {seg.count.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">명</p>
            </div>
          ))}
        </div>
        {isDemo && <p className="text-[10px] text-yellow-400/70 text-center mt-2">데모 데이터 — API 키 연동 시 실제 수치 표시</p>}
      </div>

      {/* 기능 목록 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">사용 가능 기능</p>
        <div className="space-y-2">
          {[
            { icon: BarChart,    label: '캠페인 성과',            desc: '오픈율 / 클릭율 / 전환율' },
            { icon: ArrowUpRight, label: '고객 유입 채널',        desc: '웹 SDK / QR / CSV / Webhook' },
            { icon: Zap,         label: 'AI 캠페인 즉시 실행',   desc: '세그먼트 → 이메일/SMS 자동 발송' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className={cn('flex items-start gap-3 px-3 py-3 rounded-lg bg-bg border border-border', !connected && 'opacity-50')}>
              <Icon size={15} className="text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-dim">{label}</p>
                <p className="text-xs text-muted/70">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 가격 안내 */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="text-xs font-medium text-yellow-400 mb-2">💰 OOMNI 사용자 특별 혜택</p>
        <div className="space-y-1.5 text-xs text-muted">
          <div className="flex items-center justify-between">
            <span>oomni-cdp 무료 플랜</span>
            <span className="text-dim">최대 100명</span>
          </div>
          <div className="flex items-center justify-between">
            <span>oomni-cdp Pro (단독)</span>
            <span className="text-dim line-through opacity-50">월 29,000원</span>
          </div>
          <div className="flex items-center justify-between font-medium">
            <span className="text-yellow-400">OOMNI 연동 시</span>
            <span className="text-yellow-400">월 14,500원 (50% ↓)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 성장 영상 패널 ────────────────────────────────────────────────────────────
function GrowthVideoPanel() {
  const [metricType, setMetricType] = useState<MetricType>('users')
  const [startValue, setStartValue] = useState('')
  const [endValue, setEndValue] = useState('')
  const [days, setDays] = useState('30')
  const [brandName, setBrandName] = useState('')
  const [renderStatus, setRenderStatus] = useState<string | null>(null)

  const selectedMetric = METRIC_OPTIONS.find(m => m.value === metricType)!

  const renderMutation = useMutation({
    mutationFn: () => {
      const topic = `${selectedMetric.label} ${days}일 성장: ${startValue}→${endValue}${selectedMetric.unit}`
      return videoApi.generateScript(topic, 'growth').then(r =>
        videoApi.renderVideo(r.script.id, 0)
      )
    },
    onSuccess: (data) => {
      setRenderStatus(`렌더링 시작! 저장 경로: ${data.output_path}`)
      setTimeout(() => setRenderStatus(null), 5000)
    },
    onError: () => {
      setRenderStatus('렌더링 요청 실패')
      setTimeout(() => setRenderStatus(null), 3000)
    },
  })

  const isValid = startValue && endValue && days

  return (
    <div className="space-y-4">
      {/* oomni-video 연동 안내 */}
      <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <Video size={14} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-primary">oomni-video 연동 예정 (Phase 4)</p>
            <p className="text-[10px] text-muted mt-0.5">연동 시 AI 스크립트 + B-roll + TTS 고품질 숏폼 영상 생성</p>
            <p className="text-[10px] text-yellow-400 mt-0.5">OOMNI 사용자 50% 할인 적용</p>
          </div>
        </div>
      </div>

      {/* 현재: Remotion 기반 성장 스토리 영상 */}
      <div className="flex items-center gap-2">
        <Film size={14} className="text-primary" />
        <p className="text-xs text-muted uppercase tracking-widest">성장 스토리 영상</p>
      </div>

      <div>
        <p className="text-xs text-muted mb-2">지표 선택</p>
        <div className="grid grid-cols-3 gap-1.5">
          {METRIC_OPTIONS.map(metric => (
            <button
              key={metric.value}
              onClick={() => setMetricType(metric.value)}
              className={cn(
                'flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-colors',
                metricType === metric.value
                  ? 'bg-primary/10 border border-primary/40 text-text'
                  : 'bg-bg border border-border text-dim hover:border-primary/20'
              )}
            >
              <span className="text-lg mb-0.5">{metric.emoji}</span>
              <span>{metric.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted mb-1 block">시작 값</label>
          <div className="relative">
            <input value={startValue} onChange={e => setStartValue(e.target.value)} type="number" placeholder="0"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 pr-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{selectedMetric.unit}</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">최종 값</label>
          <div className="relative">
            <input value={endValue} onChange={e => setEndValue(e.target.value)} type="number" placeholder="1000"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 pr-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{selectedMetric.unit}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted mb-1 block">기간 (일)</label>
          <input value={days} onChange={e => setDays(e.target.value)} type="number" placeholder="30"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">브랜드명</label>
          <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="OOMNI"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50" />
        </div>
      </div>

      {startValue && endValue && (
        <div className="bg-bg rounded-lg border border-border p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">성장률</span>
            <span className="font-bold text-green-400">
              +{Math.round(((parseInt(endValue) - parseInt(startValue)) / Math.max(parseInt(startValue), 1)) * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted">{parseInt(days)}일 기준</span>
            <span className="text-dim">{startValue}{selectedMetric.unit} → {endValue}{selectedMetric.unit}</span>
          </div>
        </div>
      )}

      <button onClick={() => renderMutation.mutate()} disabled={!isValid || renderMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
        <Film size={14} />
        {renderMutation.isPending ? '생성 중...' : '성장 스토리 영상 생성'}
      </button>

      {renderStatus && (
        <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-xs text-green-400">{renderStatus}</p>
        </div>
      )}
    </div>
  )
}

// CDP 캠페인 탭 내용
function CdpCampaignPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-border bg-bg/50 p-4 text-center">
        <Mail size={24} className="text-muted/30 mx-auto mb-2" />
        <p className="text-sm text-dim mb-1">oomni-cdp 캠페인 발송</p>
        <p className="text-xs text-muted/70 mb-3 leading-relaxed">
          Phase 4 연동 후 세그먼트별 이메일/SMS/AI 영상 캠페인을 OOMNI에서 직접 발송할 수 있습니다.
        </p>
        <div className="space-y-2">
          {[
            { icon: Mail,       label: '이메일 캠페인', color: 'text-blue-400' },
            { icon: Smartphone, label: 'SMS 캠페인',    color: 'text-green-400' },
            { icon: Video,      label: 'AI 영상 캠페인', color: 'text-purple-400' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-bg opacity-50">
              <Icon size={14} className={color} />
              <span className="text-sm text-dim">{label}</span>
              <span className="ml-auto text-[10px] text-muted">Phase 4</span>
            </div>
          ))}
        </div>
      </div>

      {/* 가격 안내 */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
        <p className="text-xs font-medium text-yellow-400 mb-2">💰 OOMNI 사용자 특별 혜택</p>
        <div className="space-y-1 text-xs text-muted">
          <div className="flex justify-between">
            <span>oomni-cdp Pro (단독)</span>
            <span className="line-through opacity-50">월 29,000원</span>
          </div>
          <div className="flex justify-between font-medium text-yellow-400">
            <span>OOMNI 연동 시</span>
            <span>월 14,500원 (50% ↓)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const GROWTH_SKILLS = [
  { label: '주간 성장 보고서', prompt: '/weekly-report 이번 주 사용자 증가, 전환율, 이탈률 지표를 분석하고 개선 방안을 제시해줘' },
  { label: '사용자 세그먼트', prompt: '/segment-users RFM 분석으로 사용자를 세그먼트하고 각 그룹별 액션 플랜을 만들어줘' },
  { label: '캠페인 기획',     prompt: '/campaign-plan 다음 달 성장 캠페인을 채널별 실행 계획과 KPI와 함께 기획해줘' },
  { label: 'A/B 테스트',     prompt: '/ab-test 온보딩 전환율을 높이기 위한 A/B 테스트를 설계하고 PostHog Feature Flag 코드를 작성해줘' },
  { label: '퍼널 분석',      prompt: '/funnel-analysis 현재 전환 퍼널의 병목 구간을 찾고 ICE 스코어로 개선 우선순위를 정해줘' },
]

const RIGHT_TABS = [
  { key: 'ai',       label: 'AI 추천' },
  { key: 'campaign', label: 'CDP 캠페인' },
  { key: 'video',    label: '성장 영상' },
]

// ── RIGHT: AI 추천 + CDP 캠페인 + 성장 영상 ────────────────────────────────
export function GrowthRightPanel({ agentId, onSkillSelect, currentRole = 'growth', content = '' }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  currentRole?: string
  content?: string
}) {
  const [activeTab, setActiveTab] = useState<'ai' | 'campaign' | 'video'>('ai')
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: 3000,
  })

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-y-auto">
      {/* 탭 토글 */}
      <div className="flex gap-1 shrink-0 bg-bg rounded-lg p-1 border border-border">
        {RIGHT_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors',
              activeTab === tab.key
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-dim'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'ai' && (
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-3">AI 추천 액션</p>
            {feed.length === 0 ? (
              <p className="text-sm text-muted/60">분석 실행 후 추천이 표시됩니다</p>
            ) : (
              <div className="space-y-3">
                {['퍼포먼스 마케팅 최적화', '이탈 유저 리인게이지', '신규 세그먼트 캠페인'].map(action => (
                  <div key={action} className="px-3 py-3 rounded-lg bg-bg border border-border">
                    <p className="text-sm text-dim">💡 {action}</p>
                    <button className="mt-2 text-xs text-primary hover:text-primary-hover transition-colors">
                      실행하기 →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'campaign' && <CdpCampaignPanel />}
        {activeTab === 'video' && <GrowthVideoPanel />}
      </div>

      {/* 빠른 실행 */}
      <div className="shrink-0">
        <p className="text-xs text-muted uppercase tracking-widest mb-2.5">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {GROWTH_SKILLS.map(skill => (
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
        botRole="growth"
        tags={['OOMNI', 'growth']}
      />

      <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />
    </div>
  )
}
