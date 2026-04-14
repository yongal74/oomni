import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { BarChart2, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

type Period = 'daily' | 'weekly' | 'monthly'

const PERIOD_LABELS: Record<Period, string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '월간',
}

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗',
}

interface ReportData {
  period: string
  cost_usd: number
  completed_runs: number
  failed_runs: number
  top_agents: Array<{
    agent_id: string
    agent_name: string
    agent_role: string
    run_count: number
    cost_usd: number
  }>
  feed_highlights: Array<{
    id: string
    agent_name: string
    agent_role: string
    type: string
    content: string
    created_at: string
  }>
}

export default function ReportPage() {
  const { currentMission } = useAppStore()
  const missionId = currentMission?.id
  const [period, setPeriod] = useState<Period>('weekly')

  const { data: report, isLoading, isError, error } = useQuery<ReportData>({
    queryKey: ['report', missionId, period],
    queryFn: () => reportsApi.get(missionId!, period),
    enabled: !!missionId,
    retry: 1,
  })

  if (!missionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <BarChart2 size={40} className="text-muted" />
        <h2 className="text-xl font-semibold text-text">미션을 먼저 선택해주세요</h2>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">리포트</h1>
          <p className="text-[13px] text-muted mt-0.5">AI 팀 활동 요약</p>
        </div>
        {/* 기간 탭 */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded text-[13px] transition-colors ${
                period === p ? 'bg-[#2A2A2C] text-text' : 'text-muted hover:text-text'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={36} className="text-muted mb-3" />
          <p className="text-muted text-[13px]">리포트를 불러오지 못했습니다</p>
          <p className="text-[11px] text-muted mt-1">
            {error instanceof Error ? error.message : '서버 오류'}
          </p>
        </div>
      )}

      {!isLoading && !isError && report && (
        <div className="space-y-5">
          {/* 요약 카드 4개 */}
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard
              title="총 비용"
              value={`$${Number(report.cost_usd ?? 0).toFixed(2)}`}
              color="text-primary"
              icon="💰"
            />
            <SummaryCard
              title="완료 실행"
              value={report.completed_runs ?? 0}
              suffix="건"
              color="text-green-400"
              icon="✅"
            />
            <SummaryCard
              title="실패 실행"
              value={report.failed_runs ?? 0}
              suffix="건"
              color="text-red-400"
              icon="❌"
            />
            <SummaryCard
              title="성공률"
              value={
                report.completed_runs + report.failed_runs > 0
                  ? `${Math.round(report.completed_runs / (report.completed_runs + report.failed_runs) * 100)}%`
                  : '-'
              }
              color="text-blue-400"
              icon="📊"
            />
          </div>

          {/* 가장 활발한 봇 */}
          {report.top_agents && report.top_agents.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-text mb-3">활발한 봇 TOP</h3>
              <div className="space-y-2">
                {report.top_agents.map((agent, idx) => (
                  <div key={agent.agent_id} className="flex items-center gap-3">
                    <span className="text-[12px] text-muted w-5 text-right">{idx + 1}</span>
                    <span className="text-base">{BOT_EMOJI[agent.agent_role] ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-text">{agent.agent_name}</span>
                        <span className="text-[11px] text-muted">{agent.run_count}회 실행</span>
                      </div>
                      {/* 프로그레스 바 */}
                      <div className="mt-1 h-1 bg-[#2A2A2C] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${report.top_agents.length > 0
                              ? Math.round(agent.run_count / report.top_agents[0].run_count * 100)
                              : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[12px] text-muted">${Number(agent.cost_usd ?? 0).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 피드 하이라이트 */}
          {report.feed_highlights && report.feed_highlights.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-text mb-3">주요 활동</h3>
              <div className="space-y-2">
                {report.feed_highlights.map(item => (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-sm mt-0.5">{BOT_EMOJI[item.agent_role] ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12px] font-medium text-text">{item.agent_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          item.type === 'error'
                            ? 'bg-red-900/30 text-red-400'
                            : item.type === 'result'
                            ? 'bg-blue-900/30 text-blue-400'
                            : 'bg-[#2A2A2C] text-muted'
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-[10px] text-muted">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted leading-relaxed line-clamp-2">{item.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 빈 상태 */}
          {(!report.top_agents || report.top_agents.length === 0) &&
           (!report.feed_highlights || report.feed_highlights.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart2 size={36} className="text-muted mb-3" />
              <p className="text-muted text-[13px]">이 기간의 활동 데이터가 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title, value, suffix, color, icon,
}: {
  title: string
  value: string | number
  suffix?: string
  color: string
  icon: string
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-[12px] text-muted">{title}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-muted ml-1">{suffix}</span>}
      </div>
    </div>
  )
}
