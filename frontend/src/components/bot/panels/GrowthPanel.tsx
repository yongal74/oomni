import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { agentsApi, videoApi, type FeedItem } from '../../../lib/api'
import {
  TrendingUp, Users, MessageSquare, BarChart2, Video, Film,
  Mail, Smartphone, Link2, ChevronRight, Zap, BarChart, ArrowUpRight,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'
import { Player } from '@remotion/player'
import { GrowthStoryVideo, type GrowthStoryProps, type MetricType } from '../../video/GrowthStoryVideo'

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

// CDP 연동 상태 (Phase 4에서 실제 API 연동)
const CDP_CONNECTED = false

const CDP_SEGMENTS = [
  { label: '파워유저',  icon: '⚡', color: 'text-yellow-400', count: null },
  { label: '이탈위험',  icon: '⚠️', color: 'text-red-400',    count: null },
  { label: '신규가입',  icon: '🌱', color: 'text-green-400',  count: null },
  { label: '재구매',   icon: '🔄', color: 'text-blue-400',   count: null },
]

// ── LEFT: KPI + CDP 세그먼트 + 빠른 캠페인 ──────────────────────────────────
export function GrowthLeftPanel() {
  const kpis = [
    { label: '총 고객',  value: '—', sub: '명' },
    { label: 'DAU',      value: '—', sub: '명' },
    { label: 'MRR',      value: '—', sub: '원' },
    { label: '전환율',   value: '—', sub: '%' },
  ]

  return (
    <div className="p-4 space-y-5">
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

      {/* CDP 세그먼트 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted uppercase tracking-widest">CDP 세그먼트</p>
          {CDP_CONNECTED && (
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              연동됨
            </span>
          )}
        </div>

        {CDP_CONNECTED ? (
          <div className="space-y-1">
            {CDP_SEGMENTS.map(seg => (
              <div key={seg.label} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface transition-colors cursor-pointer group">
                <span className="flex items-center gap-2 text-sm text-dim">
                  <span>{seg.icon}</span>{seg.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs font-medium', seg.color)}>{seg.count ?? '—'}명</span>
                  <ChevronRight size={11} className="text-muted/40 group-hover:text-muted transition-colors" />
                </div>
              </div>
            ))}
            <button className="w-full mt-1 text-xs text-primary/70 hover:text-primary text-center py-1.5 transition-colors">
              + 전체 세그먼트 보기
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-bg/50 p-4 text-center">
            <Link2 size={20} className="text-muted/40 mx-auto mb-2" />
            <p className="text-xs text-dim mb-0.5">oomni-cdp 연동 예정</p>
            <p className="text-[10px] text-muted/60 mb-3">Phase 4에서 실시간 세그먼트 연동</p>
            <div className="space-y-1">
              {CDP_SEGMENTS.map(seg => (
                <div key={seg.label} className="flex items-center justify-between px-2 py-1.5 rounded-lg opacity-40">
                  <span className="text-xs text-dim flex items-center gap-1.5">
                    <span>{seg.icon}</span>{seg.label}
                  </span>
                  <span className="text-[10px] text-muted">—명</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 빠른 캠페인 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">빠른 캠페인</p>
        <div className="space-y-1.5">
          {[
            { icon: Mail,       label: '이메일 캠페인', desc: '세그먼트별 발송' },
            { icon: Smartphone, label: 'SMS 캠페인',    desc: '문자 발송' },
            { icon: Video,      label: 'AI 영상 캠페인', desc: 'oomni-video 연동' },
          ].map(({ icon: Icon, label, desc }) => (
            <button
              key={label}
              disabled
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-bg/30 text-left opacity-50 cursor-not-allowed"
            >
              <Icon size={14} className="text-muted shrink-0" />
              <div>
                <p className="text-xs text-dim">{label}</p>
                <p className="text-[10px] text-muted/60">{desc} · Phase 4</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
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

  const latest = feed[0]

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
          <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans">{streamOutput || '분석 중...'}</pre>
        ) : !latest ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <TrendingUp size={36} className="text-muted/30" />
            {streamOutput ? (
              <pre className="text-base text-dim leading-relaxed whitespace-pre-wrap font-sans text-left">{streamOutput}</pre>
            ) : (
              <>
                <p className="text-base text-muted">하단 입력창에서 그로스 분석을 지시하세요</p>
                <p className="text-sm text-muted/60">"이번 주 성장 현황 분석해줘" 등</p>
              </>
            )}
          </div>
        ) : (
          <div className="text-base text-dim leading-relaxed whitespace-pre-wrap">
            {latest.content}
          </div>
        )}
      </div>
    </div>
  )
}

// CDP 세그먼트 탭 내용
function CdpSegmentTab() {
  return (
    <div className="h-full flex flex-col gap-4">
      {/* 연동 배너 */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text mb-0.5">oomni-cdp 연동 예정 (Phase 4)</p>
            <p className="text-xs text-muted leading-relaxed">
              연동 후 세그먼트 실시간 현황, 캠페인 성과, 고객 유입 채널을 이 탭에서 통합 관리할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 연동 시 사용 가능한 기능 미리보기 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">연동 후 사용 가능</p>
        <div className="space-y-2">
          {[
            { icon: Users,      label: '세그먼트별 고객 수',          desc: '파워유저/이탈위험/신규가입/재구매 실시간 인원' },
            { icon: BarChart,   label: '캠페인 성과',                 desc: '오픈율 / 클릭율 / 전환율 대시보드' },
            { icon: ArrowUpRight, label: '고객 유입 채널 분석',       desc: '웹 SDK / QR / CSV / Webhook 채널별 현황' },
            { icon: Zap,        label: 'AI 세그먼트 캠페인 즉시 실행', desc: '분석 결과 → oomni-cdp 캠페인 직접 생성' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 px-3 py-3 rounded-lg bg-bg border border-border opacity-60">
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
  const [previewProps, setPreviewProps] = useState<GrowthStoryProps | null>(null)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)

  const selectedMetric = METRIC_OPTIONS.find(m => m.value === metricType)!

  const handlePreview = () => {
    const start = parseInt(startValue) || 0
    const end = parseInt(endValue) || 100
    const d = parseInt(days) || 30
    setPreviewProps({ metricType, startValue: start, endValue: end, days: d, brandName: brandName || 'OOMNI' })
  }

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

      <button onClick={handlePreview} disabled={!isValid}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-primary/40 text-primary hover:bg-primary/5 text-sm rounded-lg disabled:opacity-40 transition-colors">
        <Video size={14} />미리보기
      </button>

      {previewProps && (
        <div>
          <p className="text-xs text-muted mb-2">미리보기</p>
          <div className="rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: '9/16' }}>
            <Player
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              component={GrowthStoryVideo as any}
              inputProps={previewProps}
              durationInFrames={1800} fps={30}
              compositionWidth={1080} compositionHeight={1920}
              style={{ width: '100%', height: '100%' }}
              controls loop
            />
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
