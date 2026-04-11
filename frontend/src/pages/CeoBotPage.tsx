import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { feedApi, type Agent, type FeedItem } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { BotRunModal } from '../components/BotRunModal'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Play, Loader2, AlertCircle, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡', ceo: '👔',
}

interface AgentWithStats extends Agent {
  last_run_at?: string | null
  last_run_status?: string | null
  run_count?: number
}

interface FeedSummary {
  total: number
  approvals_pending: number
  errors_today: number
  completed_today: number
}

interface CeoSummaryData {
  mission: Record<string, unknown> | null
  agents: AgentWithStats[]
  feed_summary: FeedSummary
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '기록 없음'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ko })
  } catch {
    return '알 수 없음'
  }
}

function FeedItemRow({ item }: { item: FeedItem }) {
  const typeColor: Record<string, string> = {
    info: 'border-[#2A2A2C] text-muted',
    result: 'border-blue-800/40 text-blue-300',
    approval: 'border-yellow-800/40 text-yellow-300',
    error: 'border-red-800/40 text-red-300',
  }
  const typeLabel: Record<string, string> = {
    info: '정보', result: '결과', approval: '승인 요청', error: '오류',
  }
  return (
    <div className={`border rounded-lg p-3 ${typeColor[item.type] ?? 'border-[#2A2A2C]'}`}>
      <div className="flex items-start gap-2">
        <span className="text-sm mt-0.5 shrink-0">{BOT_EMOJI[item.agent_role ?? ''] ?? '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[12px] font-medium text-text truncate">{item.agent_name ?? item.agent_id}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${typeColor[item.type] ?? ''}`}>
              {typeLabel[item.type] ?? item.type}
            </span>
            <span className="text-[11px] text-muted ml-auto shrink-0">{formatRelativeTime(item.created_at)}</span>
          </div>
          <p className="text-[12px] text-muted leading-relaxed line-clamp-2">{item.content}</p>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, suffix, color }: {
  icon: React.ReactNode; label: string; value: number; suffix: string; color: string
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>{icon}</div>
      <div>
        <p className="text-[11px] text-muted mb-0.5">{label}</p>
        <p className={`text-xl font-bold ${color}`}>
          {value.toLocaleString()}
          <span className="text-xs font-normal text-muted ml-1">{suffix}</span>
        </p>
      </div>
    </div>
  )
}

/** CEO 요약 SSE 훅 */
function useCeoSummaryStream(missionId: string | undefined) {
  const [data, setData] = useState<CeoSummaryData | null>(null)
  const [aiSummary, setAiSummary] = useState('')
  const [aiChunks, setAiChunks] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const connect = () => {
    esRef.current?.close()
    setLoading(true)
    setAiSummary('')
    setAiChunks('')

    const url = `http://localhost:3001/api/ceo/summary-stream${missionId ? `?mission_id=${missionId}` : ''}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('data', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as CeoSummaryData
      setData(d)
      setLoading(false)
    })
    es.addEventListener('progress', () => {
      setAiLoading(true)
    })
    es.addEventListener('ai_chunk', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { text: string }
      setAiChunks(prev => prev + d.text)
    })
    es.addEventListener('ai_summary', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { text: string }
      setAiSummary(d.text)
      setAiLoading(false)
    })
    es.addEventListener('done', () => {
      setLoading(false)
      setAiLoading(false)
      es.close()
      esRef.current = null
    })
    es.addEventListener('error', (e) => {
      const rawData = (e as MessageEvent).data
      if (rawData) {
        try {
          const d = JSON.parse(rawData) as { message: string }
          setAiSummary(`오류: ${d.message}`)
        } catch { /* ignore */ }
      }
      setLoading(false)
      setAiLoading(false)
      es.close()
      esRef.current = null
    })
    es.onerror = () => {
      setLoading(false)
      setAiLoading(false)
      es.close()
      esRef.current = null
    }
  }

  useEffect(() => {
    if (!missionId) return
    connect()
    return () => { esRef.current?.close() }
  }, [missionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayAi = aiSummary || aiChunks

  return { data, aiSummary: displayAi, loading, aiLoading, refresh: connect }
}

export default function CeoBotPage() {
  const { currentMission } = useAppStore()
  const [runModalAgent, setRunModalAgent] = useState<Agent | null>(null)
  const missionId = currentMission?.id

  const { data: summaryData, loading: summaryLoading, aiSummary, aiLoading, refresh } = useCeoSummaryStream(missionId)

  const { data: feedItems = [], isLoading: feedLoading } = useQuery<FeedItem[]>({
    queryKey: ['feed-preview', missionId],
    queryFn: () => feedApi.list({ mission_id: missionId, limit: 5 }),
    enabled: !!missionId,
    refetchInterval: 15000,
  })

  const agents = summaryData?.agents ?? []
  const feedSummary = summaryData?.feed_summary ?? {
    total: 0, approvals_pending: 0, errors_today: 0, completed_today: 0,
  }

  if (!missionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="text-5xl">👔</div>
        <h2 className="text-xl font-semibold text-text">CEO 대시보드</h2>
        <p className="text-muted text-sm">미션을 선택하거나 생성해야 CEO 대시보드를 사용할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">👔</span>
            <h1 className="text-xl font-semibold text-text">CEO 대시보드</h1>
          </div>
          <p className="text-[13px] text-muted">{currentMission?.name} — Solo Factory OS 전체 현황</p>
        </div>
        <div className="flex items-center gap-2">
          {summaryLoading && (
            <div className="flex items-center gap-1.5 text-muted text-[12px]">
              <Loader2 size={12} className="animate-spin" />
              로딩 중
            </div>
          )}
          <button
            onClick={refresh}
            disabled={summaryLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted hover:text-text hover:bg-surface transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} />
            새로고침
          </button>
        </div>
      </div>

      {/* AI 요약 카드 */}
      <div className="bg-gradient-to-r from-primary/10 to-blue-900/10 border border-primary/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🤖</span>
          <h2 className="text-[13px] font-semibold text-text">AI 주간 요약</h2>
          {aiLoading && (
            <span className="flex items-center gap-1 text-[11px] text-muted ml-auto">
              <Loader2 size={11} className="animate-spin" />
              생성 중...
            </span>
          )}
        </div>
        {summaryLoading && !aiSummary ? (
          <div className="flex items-center gap-2 text-muted text-[13px]">
            <Loader2 size={13} className="animate-spin" />
            데이터 로딩 중...
          </div>
        ) : (
          <p className="text-[13px] text-muted leading-relaxed whitespace-pre-wrap">
            {aiSummary || 'Claude API 키를 설정하면 AI 요약이 생성됩니다.'}
            {aiLoading && <span className="inline-block w-1.5 h-3.5 bg-primary/70 animate-pulse ml-1 align-middle" />}
          </p>
        )}
      </div>

      {/* 오늘의 지표 */}
      <div>
        <h2 className="text-[13px] font-medium text-text mb-3">오늘의 지표</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Play size={16} className="text-blue-400" />} label="총 실행" value={feedSummary.total} suffix="회" color="text-blue-400" />
          <KpiCard icon={<Clock size={16} className="text-yellow-400" />} label="승인 대기" value={feedSummary.approvals_pending} suffix="건" color="text-yellow-400" />
          <KpiCard icon={<AlertCircle size={16} className="text-red-400" />} label="오류" value={feedSummary.errors_today} suffix="건" color="text-red-400" />
          <KpiCard icon={<CheckCircle2 size={16} className="text-green-400" />} label="완료" value={feedSummary.completed_today} suffix="건" color="text-green-400" />
        </div>
      </div>

      {/* 봇 현황 Grid */}
      <div>
        <h2 className="text-[13px] font-medium text-text mb-3">봇 현황</h2>
        {agents.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted text-[13px]">
            {summaryLoading
              ? <div className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />봇 로딩 중...</div>
              : <>봇이 없습니다. 대시보드에서 봇을 추가해보세요.</>
            }
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map(agent => (
              <BotCard key={agent.id} agent={agent} onRun={() => setRunModalAgent(agent)} />
            ))}
          </div>
        )}
      </div>

      {/* 피드 미리보기 */}
      <div>
        <h2 className="text-[13px] font-medium text-text mb-3">피드 미리보기 (최근 5건)</h2>
        <div className="space-y-2">
          {feedLoading
            ? <div className="flex items-center justify-center gap-2 py-6 text-muted text-[13px]"><Loader2 size={13} className="animate-spin" />피드 로딩 중...</div>
            : feedItems.length === 0
              ? <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted text-[13px]">아직 피드 항목이 없습니다. 봇을 실행해보세요.</div>
              : feedItems.map(item => <FeedItemRow key={item.id} item={item} />)
          }
        </div>
      </div>

      {runModalAgent && <BotRunModal agent={runModalAgent} onClose={() => setRunModalAgent(null)} />}
    </div>
  )
}

function BotCard({ agent, onRun }: { agent: AgentWithStats; onRun: () => void }) {
  const emoji = BOT_EMOJI[agent.role] ?? '🤖'
  const isActive = agent.is_active
  const statusDot = isActive ? 'bg-green-500' : 'bg-[#444]'
  const statusColor = isActive ? 'text-green-400' : 'text-muted'
  const lastRunStatus = agent.last_run_status
  let statusIcon: React.ReactNode = null
  if (lastRunStatus === 'result') statusIcon = <CheckCircle2 size={12} className="text-green-400" />
  else if (lastRunStatus === 'error') statusIcon = <XCircle size={12} className="text-red-400" />

  return (
    <div className="bg-surface border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-text truncate">{agent.name}</h3>
            <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
          </div>
          <p className={`text-[11px] mt-0.5 ${statusColor}`}>{isActive ? '활성' : '비활성'}</p>
        </div>
      </div>
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          {statusIcon}<Clock size={11} /><span>마지막 실행: {formatRelativeTime(agent.last_run_at)}</span>
        </div>
        <div className="text-[11px] text-muted">총 {(agent.run_count ?? 0).toLocaleString()}회 실행</div>
      </div>
      <button
        onClick={onRun}
        disabled={!isActive}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded text-[12px] hover:bg-primary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Play size={11} />실행
      </button>
    </div>
  )
}
