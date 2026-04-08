import { useEffect, useState, useMemo } from 'react'
import { agentsApi, type Agent, type HeartbeatRun } from '../lib/api'
import { useAppStore } from '../store/app.store'

type Period = 'today' | 'week' | 'month'

interface AgentStats {
  agent: Agent
  runs: HeartbeatRun[]
  totalRuns: number
  successCount: number
  failCount: number
  cost: number
}

function filterByPeriod(runs: HeartbeatRun[], period: Period): HeartbeatRun[] {
  const now = new Date()
  const cutoff = new Date()
  if (period === 'today') {
    cutoff.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    cutoff.setDate(now.getDate() - 7)
  } else {
    cutoff.setMonth(now.getMonth() - 1)
  }
  return runs.filter(r => new Date(r.started_at) >= cutoff)
}

export default function MonitoringPage() {
  const { agents } = useAppStore()
  const [period, setPeriod] = useState<Period>('today')
  const [allRuns, setAllRuns] = useState<Map<string, HeartbeatRun[]>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (agents.length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(
      agents.map(agent =>
        agentsApi.heartbeatRuns(agent.id, 200)
          .then(runs => ({ agentId: agent.id, runs }))
          .catch(() => ({ agentId: agent.id, runs: [] as HeartbeatRun[] }))
      )
    ).then(results => {
      const map = new Map<string, HeartbeatRun[]>()
      results.forEach(({ agentId, runs }) => map.set(agentId, runs))
      setAllRuns(map)
    }).finally(() => setLoading(false))
  }, [agents])

  const agentStats: AgentStats[] = useMemo(() => {
    return agents.map(agent => {
      const raw = allRuns.get(agent.id) ?? []
      const runs = filterByPeriod(raw, period)
      const successCount = runs.filter(r => r.status === 'completed').length
      const failCount = runs.filter(r => r.status === 'failed').length
      const cost = runs.reduce((acc, r) => acc + (r.cost_usd ?? 0), 0)
      return { agent, runs, totalRuns: runs.length, successCount, failCount, cost }
    })
  }, [agents, allRuns, period])

  const totals = useMemo(() => {
    const totalRuns = agentStats.reduce((a, s) => a + s.totalRuns, 0)
    const totalSuccess = agentStats.reduce((a, s) => a + s.successCount, 0)
    const totalCost = agentStats.reduce((a, s) => a + s.cost, 0)
    const successRate = totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0
    const allFilteredRuns = agentStats.flatMap(s => s.runs)
    const completedRuns = allFilteredRuns.filter(r => r.status === 'completed' && r.started_at && r.finished_at)
    const avgTimeMs = completedRuns.length > 0
      ? completedRuns.reduce((acc, r) => {
          const diff = new Date(r.finished_at!).getTime() - new Date(r.started_at).getTime()
          return acc + diff
        }, 0) / completedRuns.length
      : 0
    return { totalRuns, successRate, totalCost, avgTimeSec: avgTimeMs / 1000 }
  }, [agentStats])

  const recentErrors = useMemo(() => {
    return agentStats
      .flatMap(s =>
        s.runs
          .filter(r => r.status === 'failed' && r.error)
          .map(r => ({ ...r, agentName: s.agent.name }))
      )
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 10)
  }, [agentStats])

  const periodLabel: Record<Period, string> = { today: '오늘', week: '이번 주', month: '이번 달' }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">모니터링</h1>
        <div className="flex gap-1">
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-[13px] transition-colors ${
                period === p
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-muted hover:text-text'
              }`}
            >
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[12px] text-muted mb-1">총 실행</div>
          <div className="text-2xl font-bold text-text">
            {loading ? '—' : totals.totalRuns}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[12px] text-muted mb-1">성공률</div>
          <div className="text-2xl font-bold text-text">
            {loading ? '—' : `${totals.successRate.toFixed(1)}%`}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[12px] text-muted mb-1">총 비용</div>
          <div className="text-2xl font-bold text-text">
            {loading ? '—' : `$${totals.totalCost.toFixed(4)}`}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[12px] text-muted mb-1">평균 시간</div>
          <div className="text-2xl font-bold text-text">
            {loading ? '—' : totals.avgTimeSec > 0 ? `${totals.avgTimeSec.toFixed(1)}s` : '—'}
          </div>
        </div>
      </div>

      {/* 봇별 현황 */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[14px] font-semibold text-text">봇별 현황</h2>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-muted font-medium">봇명</th>
              <th className="text-right px-4 py-2.5 text-muted font-medium">실행수</th>
              <th className="text-right px-4 py-2.5 text-muted font-medium">성공</th>
              <th className="text-right px-4 py-2.5 text-muted font-medium">실패</th>
              <th className="text-right px-4 py-2.5 text-muted font-medium">비용</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted">로딩 중...</td>
              </tr>
            ) : agentStats.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted">봇이 없습니다</td>
              </tr>
            ) : (
              agentStats.map(s => (
                <tr key={s.agent.id} className="border-b border-border/50 hover:bg-bg/40 transition-colors">
                  <td className="px-4 py-2.5 text-text">{s.agent.name}</td>
                  <td className="px-4 py-2.5 text-right text-text">{s.totalRuns}</td>
                  <td className="px-4 py-2.5 text-right text-green-400">{s.successCount}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">{s.failCount}</td>
                  <td className="px-4 py-2.5 text-right text-muted">${s.cost.toFixed(4)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 최근 에러 */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[14px] font-semibold text-text">최근 에러</h2>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted text-[13px]">로딩 중...</div>
        ) : recentErrors.length === 0 ? (
          <div className="text-center py-8 text-muted text-[13px]">에러 없음</div>
        ) : (
          <div className="divide-y divide-border/50">
            {recentErrors.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                <div className="text-[11px] text-muted shrink-0 mt-0.5 w-36">
                  {new Date(r.started_at).toLocaleString('ko-KR', {
                    month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                <div className="text-[12px] text-primary/80 shrink-0 w-24 truncate">{r.agentName}</div>
                <div className="text-[12px] text-red-400 flex-1 truncate">{r.error}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
