import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { feedApi, type FeedItem } from '../../../lib/api'
import { ChevronRight, TrendingUp, Users, MessageSquare, BarChart2 } from 'lucide-react'
import { cn } from '../../../lib/utils'

const TABS = [
  { key: 'marketing', label: '마케팅 실행', icon: TrendingUp },
  { key: 'analytics', label: '웹로그 분석', icon: BarChart2 },
  { key: 'cs', label: 'CS 현황', icon: MessageSquare },
  { key: 'segments', label: '세그먼트', icon: Users },
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

// RIGHT: AI 추천 + 다음봇
export function GrowthRightPanel({ agentId, nextBotName, onNextBot }: {
  agentId: string
  nextBotName?: string
  onNextBot?: () => void
}) {
  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => feedApi.list({ limit: 5 }),
    select: (data: FeedItem[]) => data.filter(f => f.agent_id === agentId && f.type === 'result'),
    refetchInterval: 3000,
  })

  return (
    <div className="p-4 h-full flex flex-col gap-4">
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
      {nextBotName && (
        <div className="pt-3 border-t border-border">
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
