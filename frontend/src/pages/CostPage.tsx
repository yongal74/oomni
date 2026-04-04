import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { costApi } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { TrendingUp, DollarSign, Zap, BarChart2 } from 'lucide-react'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡',
}

type Period = 'day' | 'week' | 'month'

export default function CostPage() {
  const missionId = useAppStore(s => s.currentMission?.id)
  const [period, setPeriod] = useState<Period>('month')

  const { data, isLoading } = useQuery({
    queryKey: ['cost', missionId, period],
    queryFn: () => costApi.summary(missionId, period),
    enabled: !!missionId,
  })

  const rows = (data?.data ?? []) as Array<{
    id: string; name: string; role: string;
    total_cost_usd: string; total_tokens: string; run_count: string;
  }>
  const totalCost = rows.reduce((s, r) => s + parseFloat(r.total_cost_usd ?? 0), 0)
  const totalTokens = rows.reduce((s, r) => s + parseInt(r.total_tokens ?? 0), 0)
  const maxCost = Math.max(...rows.map(r => parseFloat(r.total_cost_usd ?? 0)), 0.001)

  const PERIOD_LABELS: Record<Period, string> = { day: '오늘', week: '이번 주', month: '이번 달' }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text">비용 추적</h1>
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-[12px] ${period === p ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:text-text'}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-muted text-[12px]"><DollarSign size={13} /> 총 비용</div>
          <div className="text-2xl font-bold text-primary">${totalCost.toFixed(4)}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-muted text-[12px]"><Zap size={13} /> 총 토큰</div>
          <div className="text-2xl font-bold text-text">{(totalTokens / 1000).toFixed(1)}k</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-muted text-[12px]"><BarChart2 size={13} /> 실행 수</div>
          <div className="text-2xl font-bold text-text">{rows.reduce((s, r) => s + parseInt(r.run_count ?? 0), 0)}회</div>
        </div>
      </div>

      {/* 봇별 비용 바 차트 */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-[13px] font-medium text-text mb-4">봇별 비용</h3>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted text-[13px] py-6">아직 비용 데이터가 없습니다</p>
        ) : (
          <div className="space-y-4">
            {rows.map(row => {
              const cost = parseFloat(row.total_cost_usd ?? 0)
              const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0
              return (
                <div key={row.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{BOT_EMOJI[row.role] ?? '🤖'}</span>
                      <span className="text-[12px] text-text">{row.name}</span>
                      <span className="text-[10px] text-muted">{row.run_count}회 실행</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] text-primary">${cost.toFixed(4)}</div>
                      <div className="text-[10px] text-muted">{(parseInt(row.total_tokens)/1000).toFixed(1)}k tokens</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#2A2A2C] rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 비용 절감 팁 */}
      <div className="mt-4 bg-surface border border-border rounded-lg p-4">
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
