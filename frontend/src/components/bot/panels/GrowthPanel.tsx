import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { feedApi, videoApi, type FeedItem } from '../../../lib/api'
import { ChevronRight, TrendingUp, Users, MessageSquare, BarChart2, Video, Film } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Player } from '@remotion/player'
import { GrowthStoryVideo, type GrowthStoryProps, type MetricType } from '../../video/GrowthStoryVideo'

const TABS = [
  { key: 'marketing', label: '마케팅 실행', icon: TrendingUp },
  { key: 'analytics', label: '웹로그 분석', icon: BarChart2 },
  { key: 'cs', label: 'CS 현황', icon: MessageSquare },
  { key: 'segments', label: '세그먼트', icon: Users },
]

const METRIC_OPTIONS: { value: MetricType; label: string; emoji: string; unit: string }[] = [
  { value: 'users', label: '유저 수', emoji: '👥', unit: '명' },
  { value: 'revenue', label: '매출', emoji: '💰', unit: '만원' },
  { value: 'signups', label: '신규 가입', emoji: '✍️', unit: '명' },
  { value: 'mau', label: 'MAU', emoji: '📈', unit: '명' },
  { value: 'mrr', label: 'MRR', emoji: '💎', unit: '만원' },
]

// LEFT: KPI + 세그먼트 현황
export function GrowthLeftPanel() {
  const kpis = [
    { label: 'DAU', value: '—', change: '' },
    { label: 'MRR', value: '—', change: '' },
    { label: '전환율', value: '—', change: '' },
    { label: '이탈률', value: '—', change: '' },
  ]

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">KPI 현황</p>
        <div className="space-y-2">
          {kpis.map(kpi => (
            <div key={kpi.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-bg border border-border">
              <span className="text-sm text-muted">{kpi.label}</span>
              <span className="text-base font-semibold text-dim">{kpi.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted/60 mt-2">봇 실행 시 자동 집계됩니다</p>
      </div>

      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">AI CDP 세그먼트</p>
        {['파워유저', '이탈위험', '신규가입', '재구매'].map(seg => (
          <div key={seg} className="flex items-center justify-between px-3 py-2 rounded hover:bg-surface transition-colors">
            <span className="text-sm text-dim">{seg}</span>
            <span className="text-xs text-muted">—명</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// CENTER: 탭별 분석 결과
export function GrowthCenterPanel({ agentId }: { agentId: string }) {
  const [activeTab, setActiveTab] = useState('marketing')
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 20 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  const latest = feed[0]

  return (
    <div className="h-full flex flex-col">
      {/* 탭 */}
      <div className="flex border-b border-border px-4 shrink-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-primary text-text'
                : 'border-transparent text-muted hover:text-dim'
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div className="flex-1 overflow-y-auto p-5">
        {!latest ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <TrendingUp size={36} className="text-muted/30" />
            <p className="text-sm text-muted">하단 입력창에서 그로스 분석을 지시하세요</p>
            <p className="text-xs text-muted/60">"이번 주 성장 현황 분석해줘" 등</p>
          </div>
        ) : (
          <div className="text-sm text-dim leading-relaxed whitespace-pre-wrap">
            {latest.content}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 성장 영상 생성 패널 ────────────────────────────────────────────────────────
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

    const props: GrowthStoryProps = {
      metricType,
      startValue: start,
      endValue: end,
      days: d,
      brandName: brandName || 'OOMNI',
    }
    setPreviewProps(props)
  }

  const renderMutation = useMutation({
    mutationFn: () => {
      // Generate a script for growth story and render
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
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Video size={16} className="text-primary" />
        <p className="text-xs text-muted uppercase tracking-widest">성장 스토리 영상</p>
      </div>

      {/* Metric type selector */}
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

      {/* Values */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted mb-1 block">시작 값</label>
          <div className="relative">
            <input
              value={startValue}
              onChange={e => setStartValue(e.target.value)}
              type="number"
              placeholder="0"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              {selectedMetric.unit}
            </span>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">최종 값</label>
          <div className="relative">
            <input
              value={endValue}
              onChange={e => setEndValue(e.target.value)}
              type="number"
              placeholder="1000"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              {selectedMetric.unit}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted mb-1 block">기간 (일)</label>
          <input
            value={days}
            onChange={e => setDays(e.target.value)}
            type="number"
            placeholder="30"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">브랜드명</label>
          <input
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            placeholder="OOMNI"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Preview button */}
      <button
        onClick={handlePreview}
        disabled={!isValid}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-primary/40 text-primary hover:bg-primary/5 text-sm rounded-lg disabled:opacity-40 transition-colors"
      >
        <Video size={14} />
        미리보기
      </button>

      {/* Remotion Player Preview */}
      {previewProps && (
        <div>
          <p className="text-xs text-muted mb-2">미리보기</p>
          <div className="rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: '9/16' }}>
            <Player
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              component={GrowthStoryVideo as any}
              inputProps={previewProps}
              durationInFrames={1800}
              fps={30}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: '100%', height: '100%' }}
              controls
              loop
            />
          </div>
        </div>
      )}

      {/* Growth stats preview */}
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
            <span className="text-dim">
              {startValue}{selectedMetric.unit} → {endValue}{selectedMetric.unit}
            </span>
          </div>
        </div>
      )}

      {/* Render button */}
      <button
        onClick={() => renderMutation.mutate()}
        disabled={!isValid || renderMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
      >
        <Film size={14} />
        {renderMutation.isPending ? '생성 중...' : '성장 스토리 영상 생성'}
      </button>

      {/* Status */}
      {renderStatus && (
        <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-xs text-green-400">{renderStatus}</p>
        </div>
      )}
    </div>
  )
}

// RIGHT: AI 추천 + 성장 영상 + 다음봇
export function GrowthRightPanel({ agentId, nextBotName, onNextBot }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
}) {
  const [showVideoPanel, setShowVideoPanel] = useState(false)
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 5 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-y-auto">
      {/* Toggle between AI actions and video */}
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => setShowVideoPanel(false)}
          className={cn(
            'flex-1 py-2 text-xs font-medium rounded-lg transition-colors',
            !showVideoPanel
              ? 'bg-primary/10 border border-primary/40 text-primary'
              : 'bg-bg border border-border text-muted hover:border-primary/20'
          )}
        >
          AI 추천
        </button>
        <button
          onClick={() => setShowVideoPanel(true)}
          className={cn(
            'flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1',
            showVideoPanel
              ? 'bg-primary/10 border border-primary/40 text-primary'
              : 'bg-bg border border-border text-muted hover:border-primary/20'
          )}
        >
          <Video size={12} />
          성장 영상
        </button>
      </div>

      {showVideoPanel ? (
        <GrowthVideoPanel />
      ) : (
        <div className="flex-1">
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

      {nextBotName && (
        <div className="pt-3 border-t border-border shrink-0">
          <button
            onClick={onNextBot}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-sm">{nextBotName}으로 이어서</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
