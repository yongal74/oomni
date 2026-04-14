import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { costApi } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { TrendingUp, DollarSign, Zap, BarChart2, AlertTriangle, Activity } from 'lucide-react'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', ceo: '👔',
}

type Period = '1d' | '7d' | '30d' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  '1d': '오늘',
  '7d': '7일',
  '30d': '30일',
  'all': '전체',
}

type ByAgentItem = {
  agent_id: string
  agent_name: string
  cost_usd: number
  input_tokens: number
  output_tokens: number
  run_count: number
  budget_cents: number
  budget_used_pct: number
}

type BudgetAlert = {
  agent_id: string
  agent_name: string
  budget_cents: number
  spent_cents: number
  pct: number
}

type DailyItem = {
  date: string
  cost_usd: number
}

type SummaryData = {
  total_cost_usd: number
  total_input_tokens: number
  total_output_tokens: number
  by_agent: ByAgentItem[]
  daily: DailyItem[]
  period: string
  budget_alerts: BudgetAlert[]
}

function fmtUsd(v: number) {
  if (v === 0) return '$0.00'
  if (v < 0.01) return `$${v.toFixed(5)}`
  return `$${v.toFixed(2)}`
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtBudget(cents: number) {
  if (cents === 0) return '미설정'
  return `$${(cents / 100).toFixed(2)}`
}

function progressBarColor(pct: number): string {
  if (pct > 100) return 'bg-red-500'
  if (pct >= 80) return 'bg-yellow-500'
  return 'bg-green-500'
}

export default function CostPage() {
  const missionId = useAppStore(s => s.currentMission?.id)
  const [period, setPeriod] = useState<Period>('7d')

  const { data: raw, isLoading } = useQuery({
    queryKey: ['cost', missionId, period],
    queryFn: () => costApi.summary(missionId, period),
    enabled: !!missionId,
    refetchInterval: 60_000,
  })

  // The API wraps in { data: { ... } } — handle both shapes
  const summary: SummaryData | null = (() => {
    if (!raw) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (raw as any)?.data
    if (d && 'total_cost_usd' in d) return d as SummaryData
    // Legacy shape: array of by_agent rows
    return null
  })()

  const byAgent: ByAgentItem[] = summary?.by_agent ?? []
  const budgetAlerts: BudgetAlert[] = summary?.budget_alerts ?? []
  const daily: DailyItem[] = summary?.daily ?? []

  const totalCost = summary?.total_cost_usd ?? 0
  const totalInput = summary?.total_input_tokens ?? 0
  const totalOutput = summary?.total_output_tokens ?? 0
  const totalBudgetCents = byAgent.reduce((s, r) => s + (r.budget_cents ?? 0), 0)

  const maxDailyCost = Math.max(...daily.map(d => d.cost_usd), 0.001)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text">비용 추적</h1>
        <div className="flex gap-1">
          {(['1d', '7d', '30d', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-[12px] transition-colors ${
                period === p
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-muted hover:text-text'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-muted text-[12px]">
            <DollarSign size={13} /> 총 비용
          </div>
          <div className="text-2xl font-bold text-primary">{fmtUsd(totalCost)}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-muted text-[12px]">
            <Zap size={13} /> 입력 토큰
          </div>
          <div className="text-2xl font-bold text-text">{fmtTokens(totalInput)}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-muted text-[12px]">
            <Activity size={13} /> 출력 토큰
          </div>
          <div className="text-2xl font-bold text-text">{fmtTokens(totalOutput)}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-muted text-[12px]">
            <BarChart2 size={13} /> 이번 달 예산
          </div>
          <div className="text-2xl font-bold text-text">{fmtBudget(totalBudgetCents)}</div>
        </div>
      </div>

      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-[13px] font-medium text-text mb-2 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-yellow-400" /> 예산 경보
          </h3>
          {budgetAlerts.map(alert => (
            <div
              key={alert.agent_id}
              className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                alert.pct > 100
                  ? 'bg-red-500/10 border-red-500/40 text-red-400'
                  : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} />
                <span className="text-[13px] font-medium">{alert.agent_name}</span>
                <span className="text-[11px] opacity-70">
                  {alert.pct > 100 ? '예산 초과!' : `예산 ${alert.pct}% 소진`}
                </span>
              </div>
              <div className="text-[12px]">
                {fmtUsd(alert.spent_cents / 100)} / {fmtBudget(alert.budget_cents)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-bot breakdown */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-4">
        <h3 className="text-[13px] font-medium text-text mb-4">봇별 비용 분석</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : byAgent.length === 0 ? (
          <p className="text-center text-muted text-[13px] py-6">아직 비용 데이터가 없습니다</p>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_80px_50px_140px] gap-2 text-[11px] text-muted mb-3 px-1">
              <span>봇</span>
              <span className="text-right">비용</span>
              <span className="text-right">토큰</span>
              <span className="text-right">실행</span>
              <span className="text-right">예산</span>
            </div>
            <div className="space-y-3">
              {byAgent.map(row => {
                const emoji = BOT_EMOJI[row.agent_name?.toLowerCase()] ?? '🤖'
                const barColor = progressBarColor(row.budget_used_pct)
                const budgetPct = Math.min(row.budget_used_pct, 100)
                return (
                  <div key={row.agent_id} className="px-1">
                    <div className="grid grid-cols-[1fr_80px_80px_50px_140px] gap-2 items-center mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm flex-shrink-0">{emoji}</span>
                        <span className="text-[12px] text-text truncate">{row.agent_name}</span>
                      </div>
                      <span className="text-[12px] text-primary text-right">{fmtUsd(row.cost_usd)}</span>
                      <span className="text-[11px] text-muted text-right">
                        {fmtTokens(row.input_tokens + row.output_tokens)}
                      </span>
                      <span className="text-[11px] text-muted text-right">{row.run_count}회</span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-[#2A2A2C] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${budgetPct}%` }}
                          />
                        </div>
                        <span className={`text-[10px] flex-shrink-0 ${
                          row.budget_used_pct > 100 ? 'text-red-400' :
                          row.budget_used_pct >= 80 ? 'text-yellow-400' : 'text-muted'
                        }`}>
                          {row.budget_cents > 0 ? `${row.budget_used_pct}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Daily cost chart */}
      {daily.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-4">
          <h3 className="text-[13px] font-medium text-text mb-4">일별 비용</h3>
          <div className="flex items-end gap-1 h-24">
            {daily.map(d => {
              const heightPct = maxDailyCost > 0 ? (d.cost_usd / maxDailyCost) * 100 : 0
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full flex items-end justify-center" style={{ height: '80px' }}>
                    <div
                      className="w-full bg-primary/60 hover:bg-primary rounded-sm transition-all cursor-default"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                      title={`${d.date}: ${fmtUsd(d.cost_usd)}`}
                    />
                  </div>
                  <span className="text-[9px] text-muted">{d.date.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cost tips */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-green-400" />
          <span className="text-[12px] font-medium text-text">비용 최적화 팁</span>
        </div>
        <ul className="text-[11px] text-muted space-y-1 list-disc list-inside">
          <li>단순 작업(리서치 요약, 콘텐츠)은 claude-haiku로 80% 절감 가능</li>
          <li>OpenRouter 연동 시 모델 자동 라우팅으로 추가 절감</li>
          <li>봇 월 예산 한도 설정으로 초과 방지</li>
        </ul>
      </div>
    </div>
  )
}
