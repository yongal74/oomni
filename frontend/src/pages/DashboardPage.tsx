import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  agentsApi, feedApi, costApi, issuesApi, schedulesApi, reportsApi,
  api,
  type FeedItem, type Agent, type Issue, type Schedule,
} from '../lib/api'
import { useAppStore } from '../store/app.store'
import { oomniWs } from '../lib/ws'
import {
  Play, Plus, X, Check, XCircle, Loader2,
  ArrowRight, Layers, Archive,
} from 'lucide-react'
import { BotRunModal } from '../components/BotRunModal'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

// 봇 템플릿
const BOT_TEMPLATES = [
  { role: 'research', name: 'Research Bot', emoji: '🔬', desc: '웹 리서치, 경쟁사 분석, 트렌드 조사' },
  { role: 'build', name: 'Build Bot', emoji: '🔨', desc: '코딩, 버그 수정, PR 생성, 테스트' },
  { role: 'design', name: 'Design Bot', emoji: '🎨', desc: 'UI/UX 디자인, 컴포넌트 생성' },
  { role: 'content', name: 'Content Bot', emoji: '✍️', desc: '블로그, 뉴스레터, SNS 콘텐츠' },
  { role: 'growth', name: 'Growth Bot', emoji: '📈', desc: 'SEO, 광고 카피, A/B 테스트' },
  { role: 'ops', name: 'Ops Bot', emoji: '⚙️', desc: '운영 모니터링, 세무/재무, 리포트' },
  { role: 'integration', name: 'Integration Bot', emoji: '🔗', desc: '외부 서비스 연동, 데이터 동기화' },
  { role: 'n8n', name: 'n8n Bot', emoji: '⚡', desc: '자동화 워크플로우 생성/관리' },
  { role: 'ceo', name: 'CEO Bot', emoji: '👔', desc: '전체 봇 결과 종합, 일일/주간 보고서 자동 생성' },
] as const

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  research: '너는 리서치 전문 AI 봇이다. 주어진 주제를 철저히 조사하고 구조화된 보고서로 정리해라.',
  build: '너는 풀스택 개발 AI 봇이다. TDD 방식으로 코드를 작성하고 PR을 생성해라.',
  design: '너는 UI/UX 디자인 AI 봇이다. 사용자 친화적인 디자인을 생성해라.',
  content: '너는 콘텐츠 제작 AI 봇이다. SEO 최적화된 고품질 콘텐츠를 작성해라.',
  growth: '너는 그로스 마케팅 AI 봇이다. 데이터 기반으로 성장 전략을 실행해라.',
  ops: '너는 운영/재무 AI 봇이다. 비용, 수익, 세무 데이터를 자동으로 정리하고 리포트를 생성해라.',
  integration: '너는 시스템 통합 AI 봇이다. 외부 서비스들을 연결하고 데이터를 동기화해라.',
  n8n: '너는 n8n 자동화 전문 AI 봇이다. 사용자 요구에 맞는 워크플로우를 생성하고 배포해라.',
  ceo: '너는 CEO AI 봇이다. 모든 봇의 활동을 종합하고 전략적 보고서를 생성해라.',
}

const STATUS_COLORS: Record<Issue['status'], string> = {
  open: 'bg-blue-900/30 text-blue-400',
  in_progress: 'bg-yellow-900/30 text-yellow-400',
  done: 'bg-green-900/30 text-green-400',
  cancelled: 'bg-border/40 text-muted',
}
const STATUS_LABELS: Record<Issue['status'], string> = {
  open: '열림',
  in_progress: '진행 중',
  done: '완료',
  cancelled: '취소',
}
const PRIORITY_COLORS: Record<Issue['priority'], string> = {
  low: 'bg-border/40 text-muted',
  medium: 'bg-orange-900/30 text-orange-400',
  high: 'bg-red-900/30 text-red-400',
}
const PRIORITY_LABELS: Record<Issue['priority'], string> = {
  low: '낮음', medium: '중간', high: '높음',
}
const TRIGGER_TYPE_LABELS: Record<Schedule['trigger_type'], string> = {
  interval: '반복',
  cron: '크론',
  webhook: '웹훅',
  bot_complete: '봇 완료 시',
}

type DashTab = 'feed' | 'issues' | 'cost' | 'schedules' | 'report'

const DASH_TABS: { key: DashTab; label: string }[] = [
  { key: 'feed', label: '피드' },
  { key: 'issues', label: '티켓' },
  { key: 'cost', label: '비용' },
  { key: 'schedules', label: '자동화 스케줄' },
  { key: 'report', label: '리포트' },
]

// TODO item type
interface TodoItem {
  id: string
  text: string
  agent_id?: string
  created_at: string
  done_at?: string
}

export default function DashboardPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { currentMission, agents, setAgents, setPendingApprovals } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAddBot, setShowAddBot] = useState(() => searchParams.get('addBot') === 'true')
  const preselectedRole = searchParams.get('role')
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [creatingRole, setCreatingRole] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DashTab>('feed')
  const [runModalAgent, setRunModalAgent] = useState<Agent | null>(null)

  // TODO/DONE state
  const [todoItems, setTodoItems] = useState<TodoItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('oomni_todos') ?? '[]') } catch { return [] }
  })
  const [doneItems, setDoneItems] = useState<TodoItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('oomni_dones') ?? '[]') } catch { return [] }
  })
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [newTodoText, setNewTodoText] = useState('')

  const missionId = currentMission?.id

  // 에이전트 로드
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', missionId],
    queryFn: () => agentsApi.list(missionId),
    enabled: !!missionId,
  })
  useEffect(() => { if (agentsData) setAgents(agentsData) }, [agentsData, setAgents])

  // 피드 로드
  const { data: feedData } = useQuery({
    queryKey: ['feed', missionId],
    queryFn: () => feedApi.list({ mission_id: missionId, limit: 30 }),
    enabled: !!missionId,
    refetchInterval: 10000,
  })
  useEffect(() => { if (feedData) setFeedItems(feedData) }, [feedData])

  // 비용
  const { data: costData } = useQuery({
    queryKey: ['cost', missionId],
    queryFn: () => costApi.summary(missionId, 'month'),
    enabled: !!missionId,
  })

  // 승인 대기
  const { data: approvalData } = useQuery({
    queryKey: ['approvals', missionId],
    queryFn: () => feedApi.list({ mission_id: missionId, approval_only: true }),
    enabled: !!missionId,
  })
  useEffect(() => {
    if (approvalData) setPendingApprovals(approvalData.length)
  }, [approvalData, setPendingApprovals])

  // 이슈 (탭 미리 로드)
  const { data: issuesData = [] } = useQuery<Issue[]>({
    queryKey: ['issues', missionId],
    queryFn: () => issuesApi.list({ mission_id: missionId }),
    enabled: !!missionId,
    refetchInterval: 15000,
  })

  // 스케줄
  const { data: schedulesData = [] } = useQuery<Schedule[]>({
    queryKey: ['schedules', missionId],
    queryFn: () => schedulesApi.list({ mission_id: missionId }),
    enabled: !!missionId,
    refetchInterval: 15000,
  })

  // 리포트 (오늘 요약)
  const { data: reportData } = useQuery({
    queryKey: ['report', missionId, 'daily'],
    queryFn: () => reportsApi.get(missionId!, 'daily'),
    enabled: !!missionId && activeTab === 'report',
    retry: 1,
  })

  // WS 실시간
  useEffect(() => {
    const off = oomniWs.on('feed', (data) => {
      setFeedItems(prev => [data as FeedItem, ...prev.slice(0, 49)])
      qc.invalidateQueries({ queryKey: ['approvals'] })
    })
    return () => { off() }
  }, [qc])

  // Solo Factory OS 템플릿 적용
  const applyTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await api.post(`/api/templates/${templateId}/apply`, { mission_id: missionId })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })

  // 봇 생성
  const createBot = useMutation({
    mutationFn: async (role: string) => {
      const tmpl = BOT_TEMPLATES.find(t => t.role === role)!
      return agentsApi.create({
        mission_id: missionId!,
        name: tmpl.name,
        role: role as Agent['role'],
        schedule: 'manual',
        system_prompt: ROLE_SYSTEM_PROMPTS[role] ?? '',
        budget_cents: 1000,
      })
    },
    onSuccess: () => {
      setCreatingRole(null)
      setShowAddBot(false)
      setSearchParams({})
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) => feedApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed', 'approvals'] }),
  })
  const reject = useMutation({
    mutationFn: (id: string) => feedApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed', 'approvals'] }),
  })

  // KPI 계산
  const runningBots = agents.filter(a => a.is_active).length
  const totalCost = (costData?.data as Record<string, unknown>)?.total_cost_usd as number ?? 0

  // TODO/DONE helpers
  const saveTodos = (items: TodoItem[]) => {
    setTodoItems(items)
    localStorage.setItem('oomni_todos', JSON.stringify(items))
    window.dispatchEvent(new Event('oomni-todos-updated'))
  }
  const saveDones = (items: TodoItem[]) => {
    setDoneItems(items)
    localStorage.setItem('oomni_dones', JSON.stringify(items))
  }

  const addTodoItem = () => {
    if (!newTodoText.trim()) return
    const item: TodoItem = { id: crypto.randomUUID(), text: newTodoText.trim(), created_at: new Date().toISOString() }
    saveTodos([item, ...todoItems])
    setNewTodoText('')
    setShowAddTodo(false)
  }

  const moveItemToDone = (id: string) => {
    const item = todoItems.find(i => i.id === id)
    if (!item) return
    saveTodos(todoItems.filter(i => i.id !== id))
    saveDones([{ ...item, done_at: new Date().toISOString() }, ...doneItems])
  }

  const moveItemToTodo = (id: string) => {
    const item = doneItems.find(i => i.id === id)
    if (!item) return
    saveDones(doneItems.filter(i => i.id !== id))
    saveTodos([{ ...item, done_at: undefined }, ...todoItems])
  }

  const deleteTodoItem = (id: string) => {
    saveTodos(todoItems.filter(i => i.id !== id))
  }

  const handleArchiveTodo = async (item: TodoItem) => {
    try {
      const { obsidianApi } = await import('../lib/api')
      const status = await obsidianApi.status()
      if (status.configured) {
        await obsidianApi.archive({
          title: item.text,
          content: `# ${item.text}\n\n완료일: ${item.done_at ? new Date(item.done_at).toLocaleString('ko-KR') : ''}\n생성일: ${new Date(item.created_at).toLocaleString('ko-KR')}`,
          bot_role: 'todo',
          tags: ['OOMNI', 'todo', 'done'],
        })
      }
    } catch {}
  }

  if (!missionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="text-4xl">🚀</div>
        <h2 className="text-xl font-semibold text-text">미션을 시작해보세요</h2>
        <p className="text-muted text-sm">아직 미션이 없습니다. 먼저 미션을 생성하거나 온보딩을 완료해주세요.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">{currentMission?.name}</h1>
          <p className="text-[13px] text-muted mt-0.5">{currentMission?.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => applyTemplate.mutate('solo-factory-os')}
            disabled={applyTemplate.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[13px] hover:bg-primary-hover transition-colors disabled:opacity-60"
            title="Solo Factory OS 템플릿 적용"
          >
            {applyTemplate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
            템플릿
          </button>
          <button
            onClick={() => { createBot.reset(); setShowAddBot(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] transition-colors"
          >
            <Plus size={14} />
            봇 추가
          </button>
        </div>
      </div>

      {/* 3단 메인 레이아웃 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* 봇 현황 */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-text">봇 현황</h3>
          </div>
          <div className="space-y-2">
            {agentsLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted text-[12px]">
                <Loader2 size={14} className="animate-spin" />
                <span>불러오는 중...</span>
              </div>
            ) : agents.length === 0 ? (
              <div className="space-y-3">
                {/* Solo Factory OS 배너 */}
                <div className="rounded-lg border border-[#D4763B]/50 bg-primary/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🚀</span>
                    <span className="text-[13px] font-semibold text-primary">Solo Factory OS</span>
                  </div>
                  <p className="text-[11px] text-primary/80 mb-2 leading-relaxed">
                    6개 AI 봇으로 혼자서 팀처럼 일하기
                  </p>
                  <button
                    onClick={() => applyTemplate.mutate('solo-factory-os')}
                    disabled={applyTemplate.isPending}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[12px] hover:bg-primary-hover transition-colors disabled:opacity-60"
                  >
                    {applyTemplate.isPending
                      ? <><Loader2 size={12} className="animate-spin" /> 생성 중...</>
                      : '바로 시작하기'}
                  </button>
                </div>
                <div className="text-center text-muted text-[12px]">
                  또는{' '}
                  <button onClick={() => { createBot.reset(); setShowAddBot(true) }} className="text-primary hover:underline">
                    봇 직접 추가하기
                  </button>
                </div>
              </div>
            ) : agents.map(agent => (
              <Link key={agent.id} to={`/dashboard/bots/${agent.id}`}>
                <div className="flex items-center gap-2 p-2 rounded hover:bg-bg transition-colors cursor-pointer">
                  <span className="text-base">{BOT_TEMPLATES.find(t => t.role === agent.role)?.emoji ?? '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-text truncate">{agent.name}</div>
                  </div>
                  <button
                    onClick={e => { e.preventDefault(); setRunModalAgent(agent) }}
                    className="p-1 text-muted hover:text-primary rounded"
                  >
                    <Play size={12} />
                  </button>
                  <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-[#444]'}`} />
                </div>
              </Link>
            ))}
          </div>
          {/* mini KPIs */}
          <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">{runningBots}</div>
              <div className="text-[10px] text-muted">활성 봇</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">{approvalData?.length ?? 0}</div>
              <div className="text-[10px] text-muted">승인 대기</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-primary">${totalCost.toFixed(2)}</div>
              <div className="text-[10px] text-muted">이번 달</div>
            </div>
          </div>
        </div>

        {/* TODO */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-text">📌 TODO</h3>
            <span className="text-[11px] text-muted">{todoItems.length}개</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {todoItems.map(item => (
              <TodoCard key={item.id} item={item} onDone={() => moveItemToDone(item.id)} onDelete={() => deleteTodoItem(item.id)} />
            ))}
            {todoItems.length === 0 && (
              <p className="text-[12px] text-muted/60 text-center py-4">오늘의 할일을 추가하세요</p>
            )}
          </div>
          {showAddTodo && (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={newTodoText}
                onChange={e => setNewTodoText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTodoItem(); if (e.key === 'Escape') setShowAddTodo(false) }}
                placeholder="할일 입력..."
                className="flex-1 bg-bg border border-border rounded px-2.5 py-1.5 text-[12px] text-text placeholder-muted focus:outline-none focus:border-primary"
              />
              <button onClick={addTodoItem} className="px-2.5 py-1.5 bg-primary text-white rounded text-[12px]">추가</button>
            </div>
          )}
          <button
            onClick={() => setShowAddTodo(true)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-border text-muted hover:border-primary/40 hover:text-primary rounded text-[12px] transition-colors"
          >
            <Plus size={12} /> 태스크 추가
          </button>
        </div>

        {/* DONE */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-text">✅ DONE</h3>
            <span className="text-[11px] text-muted">{doneItems.length}개</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {doneItems.map(item => (
              <DoneCard key={item.id} item={item} onUndo={() => moveItemToTodo(item.id)} onArchive={() => handleArchiveTodo(item)} />
            ))}
            {doneItems.length === 0 && (
              <p className="text-[12px] text-muted/60 text-center py-4">완료된 항목이 여기 표시됩니다</p>
            )}
          </div>
        </div>
      </div>

      {/* 탭 바 */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex border-b border-border">
          {DASH_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-[13px] transition-colors border-b-2 -mb-px ${
                activeTab === t.key
                  ? 'border-primary text-text'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t.label}
              {t.key === 'issues' && issuesData.filter(i => i.status === 'open').length > 0 && (
                <span className="ml-1.5 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {issuesData.filter(i => i.status === 'open').length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* 피드 탭 */}
          {activeTab === 'feed' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {feedItems.length === 0 ? (
                <div className="text-center text-muted text-[12px] py-6">아직 피드가 없습니다</div>
              ) : feedItems.map(item => (
                <FeedCard
                  key={item.id}
                  item={item}
                  onApprove={() => approve.mutate(item.id)}
                  onReject={() => reject.mutate(item.id)}
                  onView={item.agent_id ? () => navigate(`/dashboard/bots/${item.agent_id}`) : undefined}
                />
              ))}
            </div>
          )}

          {/* 티켓 탭 */}
          {activeTab === 'issues' && (
            <div>
              <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
                {issuesData.length === 0 ? (
                  <div className="text-center text-muted text-[12px] py-6">등록된 이슈가 없습니다</div>
                ) : issuesData.slice(0, 8).map(issue => (
                  <div key={issue.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] text-text">{issue.title}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[issue.priority]}`}>
                      {PRIORITY_LABELS[issue.priority]}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[issue.status]}`}>
                      {STATUS_LABELS[issue.status]}
                    </span>
                  </div>
                ))}
              </div>
              <Link to="/dashboard/issues" className="text-[12px] text-primary hover:underline">
                전체 보기 →
              </Link>
            </div>
          )}

          {/* 비용 탭 */}
          {activeTab === 'cost' && (
            <div className="max-h-80 overflow-y-auto">
              {(costData?.data ?? []).length === 0 ? (
                <div className="text-center text-muted text-[12px] py-6">비용 데이터가 없습니다</div>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-muted text-left border-b border-border">
                      <th className="pb-2 font-normal">봇</th>
                      <th className="pb-2 font-normal text-right">실행 수</th>
                      <th className="pb-2 font-normal text-right">총 비용</th>
                      <th className="pb-2 font-normal text-right">토큰</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(costData?.data ?? []).map((row: Record<string, unknown>, i: number) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 text-text">{String(row.agent_name ?? '-')}</td>
                        <td className="py-2 text-right text-muted">{String(row.run_count ?? 0)}</td>
                        <td className="py-2 text-right text-primary">${parseFloat(String(row.total_cost_usd ?? '0')).toFixed(4)}</td>
                        <td className="py-2 text-right text-muted">{Number(row.total_tokens ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 스케줄 탭 */}
          {activeTab === 'schedules' && (
            <div>
              <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
                {schedulesData.length === 0 ? (
                  <div className="text-center text-muted text-[12px] py-6">등록된 스케줄이 없습니다</div>
                ) : schedulesData.slice(0, 6).map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-text">{s.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/40 text-muted">
                          {TRIGGER_TYPE_LABELS[s.trigger_type]}
                        </span>
                      </div>
                      {s.trigger_type === 'bot_complete' && (
                        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted">
                          <span>{agentsData?.find((a: Agent) => a.id === s.trigger_value)?.name ?? s.trigger_value}</span>
                          <ArrowRight size={10} className="text-primary" />
                          <span>{agentsData?.find((a: Agent) => a.id === s.agent_id)?.name ?? s.agent_id}</span>
                        </div>
                      )}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-[#444]'}`} />
                  </div>
                ))}
              </div>
              <Link to="/dashboard/schedules" className="text-[12px] text-primary hover:underline">
                전체 보기 →
              </Link>
            </div>
          )}

          {/* 리포트 탭 */}
          {activeTab === 'report' && (
            <div>
              {!reportData ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-bg border border-border rounded-lg p-3 text-center">
                      <div className="text-[11px] text-muted mb-1">오늘 총 비용</div>
                      <div className="text-lg font-bold text-primary">${Number(reportData?.cost_usd ?? 0).toFixed(3)}</div>
                    </div>
                    <div className="bg-bg border border-border rounded-lg p-3 text-center">
                      <div className="text-[11px] text-muted mb-1">완료 실행</div>
                      <div className="text-lg font-bold text-green-400">{reportData?.completed_runs ?? 0}</div>
                    </div>
                    <div className="bg-bg border border-border rounded-lg p-3 text-center">
                      <div className="text-[11px] text-muted mb-1">실패 실행</div>
                      <div className="text-lg font-bold text-red-400">{reportData?.failed_runs ?? 0}</div>
                    </div>
                  </div>
                  <Link to="/dashboard/reports" className="text-[12px] text-primary hover:underline">
                    전체 리포트 보기 →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 봇 실행 모달 */}
      {runModalAgent && (
        <BotRunModal agent={runModalAgent} onClose={() => setRunModalAgent(null)} />
      )}

      {/* 봇 추가 모달 */}
      {showAddBot && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-semibold text-text">봇 추가</h2>
              <button onClick={() => { setShowAddBot(false); setSearchParams({}) }} className="text-muted hover:text-text"><X size={18} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {BOT_TEMPLATES.map(tmpl => {
                const existingAgent = agents.find(a => a.role === tmpl.role)
                return (
                  <button
                    key={tmpl.role}
                    onClick={() => {
                      if (existingAgent) {
                        setShowAddBot(false)
                        setSearchParams({})
                        navigate(`/dashboard/bots/${existingAgent.id}`)
                      } else {
                        setCreatingRole(tmpl.role)
                        createBot.mutate(tmpl.role)
                      }
                    }}
                    disabled={createBot.isPending && creatingRole === tmpl.role}
                    className={`text-left p-3 rounded-lg border transition-colors disabled:opacity-50 ${
                      preselectedRole === tmpl.role
                        ? 'border-primary bg-primary/5 hover:border-primary hover:bg-primary/10'
                        : 'border-border hover:border-primary hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{tmpl.emoji}</span>
                      <span className="text-[13px] font-medium text-text">{tmpl.name}</span>
                      {existingAgent && (
                        <span className="ml-auto text-[10px] text-green-400">추가됨 →</span>
                      )}
                      {creatingRole === tmpl.role && <Loader2 size={12} className="ml-auto animate-spin text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted">{tmpl.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TodoCard({ item, onDone, onDelete }: { item: TodoItem; onDone: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-bg group">
      <button onClick={onDone} className="mt-0.5 w-4 h-4 rounded border border-border hover:border-green-500 hover:bg-green-500/10 flex items-center justify-center shrink-0 transition-colors">
        <Check size={10} className="text-transparent group-hover:text-green-400" />
      </button>
      <span className="text-[12px] text-text flex-1 leading-relaxed">{item.text}</span>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all shrink-0">
        <X size={12} />
      </button>
    </div>
  )
}

function DoneCard({ item, onUndo, onArchive }: { item: TodoItem; onUndo: () => void; onArchive: () => void }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-bg/50 group">
      <button onClick={onUndo} className="mt-0.5 w-4 h-4 rounded bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
        <Check size={10} className="text-green-400" />
      </button>
      <span className="text-[12px] text-muted line-through flex-1 leading-relaxed">{item.text}</span>
      <button onClick={onArchive} title="Obsidian 아카이브" className="opacity-0 group-hover:opacity-100 text-muted hover:text-primary transition-all shrink-0">
        <Archive size={11} />
      </button>
    </div>
  )
}

function FeedCard({
  item, onApprove, onReject, onView,
}: {
  item: FeedItem
  onApprove: () => void
  onReject: () => void
  onView?: () => void
}) {
  const emoji: Record<string, string> = {
    research: '🔬', build: '🔨', design: '🎨', content: '✍️',
    growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡', ceo: '👔',
  }
  const typeColor: Record<string, string> = {
    info: 'border-border',
    result: 'border-blue-800/40',
    approval: 'border-yellow-800/40',
    error: 'border-red-800/40',
  }
  return (
    <div
      className={`border rounded-lg p-3 ${typeColor[item.type] ?? 'border-border'} ${onView ? 'cursor-pointer hover:bg-surface/50 transition-colors' : ''}`}
      onClick={onView}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm mt-0.5">{emoji[item.agent_role ?? ''] ?? '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-medium text-text">{item.agent_name}</span>
            <span className="text-[10px] text-muted">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}
            </span>
            {item.type === 'error' && <span className="text-[10px] text-red-400">오류</span>}
          </div>
          <p className="text-[12px] text-muted leading-relaxed line-clamp-3">{item.content}</p>
          {item.requires_approval && !item.approved_at && !item.rejected_at && (
            <div className="flex gap-2 mt-2">
              <button onClick={onApprove} className="flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 rounded text-[11px] hover:bg-green-900/50">
                <Check size={10} /> 승인
              </button>
              <button onClick={onReject} className="flex items-center gap-1 px-2 py-1 bg-red-900/30 text-red-400 rounded text-[11px] hover:bg-red-900/50">
                <XCircle size={10} /> 거절
              </button>
            </div>
          )}
          {item.approved_at && <span className="text-[10px] text-green-400 mt-1 block">✓ 승인됨</span>}
          {item.rejected_at && <span className="text-[10px] text-red-400 mt-1 block">✗ 거절됨</span>}
        </div>
      </div>
    </div>
  )
}
