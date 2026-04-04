import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issuesApi, agentsApi, type Issue } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Plus, X, ChevronDown, Loader2, Ticket } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const STATUS_LABELS: Record<Issue['status'], string> = {
  open: '열림',
  in_progress: '진행 중',
  done: '완료',
  cancelled: '취소',
}
const STATUS_COLORS: Record<Issue['status'], string> = {
  open: 'bg-blue-900/30 text-blue-400',
  in_progress: 'bg-yellow-900/30 text-yellow-400',
  done: 'bg-green-900/30 text-green-400',
  cancelled: 'bg-[#2A2A2C] text-muted',
}
const PRIORITY_LABELS: Record<Issue['priority'], string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
}
const PRIORITY_COLORS: Record<Issue['priority'], string> = {
  low: 'bg-[#2A2A2C] text-muted',
  medium: 'bg-orange-900/30 text-orange-400',
  high: 'bg-red-900/30 text-red-400',
}

const STATUS_OPTIONS: Issue['status'][] = ['open', 'in_progress', 'done', 'cancelled']
const PRIORITY_OPTIONS: Issue['priority'][] = ['low', 'medium', 'high']

export default function IssuesPage() {
  const qc = useQueryClient()
  const { currentMission } = useAppStore()
  const missionId = currentMission?.id

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<Issue['priority']>('medium')
  const [newAgentId, setNewAgentId] = useState<string>('')
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null)

  const { data: issues = [], isLoading } = useQuery<Issue[]>({
    queryKey: ['issues', missionId, statusFilter, priorityFilter],
    queryFn: () => issuesApi.list({
      mission_id: missionId,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    }),
    enabled: !!missionId,
    refetchInterval: 15000,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents', missionId],
    queryFn: () => agentsApi.list(missionId),
    enabled: !!missionId,
  })

  const createIssue = useMutation({
    mutationFn: () => issuesApi.create({
      mission_id: missionId!,
      title: newTitle,
      description: newDesc || undefined,
      priority: newPriority,
      agent_id: newAgentId || undefined,
    }),
    onSuccess: () => {
      setShowAddForm(false)
      setNewTitle('')
      setNewDesc('')
      setNewPriority('medium')
      setNewAgentId('')
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Issue['status'] }) =>
      issuesApi.update(id, { status }),
    onSuccess: () => {
      setOpenStatusMenu(null)
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })

  const deleteIssue = useMutation({
    mutationFn: (id: string) => issuesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
  })

  if (!missionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Ticket size={40} className="text-muted" />
        <h2 className="text-xl font-semibold text-text">미션을 먼저 선택해주세요</h2>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">티켓 / 이슈</h1>
          <p className="text-[13px] text-muted mt-0.5">봇이 처리할 작업 목록</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] transition-colors"
        >
          <Plus size={14} />
          이슈 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-5">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded text-[12px] transition-colors ${statusFilter === 'all' ? 'bg-[#2A2A2C] text-text' : 'text-muted hover:text-text'}`}
          >
            전체
          </button>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-[12px] transition-colors ${statusFilter === s ? 'bg-[#2A2A2C] text-text' : 'text-muted hover:text-text'}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          <button
            onClick={() => setPriorityFilter('all')}
            className={`px-3 py-1 rounded text-[12px] transition-colors ${priorityFilter === 'all' ? 'bg-[#2A2A2C] text-text' : 'text-muted hover:text-text'}`}
          >
            모든 우선순위
          </button>
          {PRIORITY_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1 rounded text-[12px] transition-colors ${priorityFilter === p ? 'bg-[#2A2A2C] text-text' : 'text-muted hover:text-text'}`}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 이슈 추가 폼 */}
      {showAddForm && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-text">새 이슈</span>
            <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-text">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="이슈 제목"
              autoFocus
              className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary"
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="설명 (선택)"
              rows={2}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary resize-none"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-muted block mb-1">우선순위</label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as Issue['priority'])}
                  className="w-full bg-bg border border-border rounded px-3 py-1.5 text-[13px] text-text focus:outline-none focus:border-primary"
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-muted block mb-1">담당 봇 (선택)</label>
                <select
                  value={newAgentId}
                  onChange={e => setNewAgentId(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-3 py-1.5 text-[13px] text-text focus:outline-none focus:border-primary"
                >
                  <option value="">없음</option>
                  {agents.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createIssue.mutate()}
                disabled={!newTitle.trim() || createIssue.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[12px] hover:bg-[#C5664A] disabled:opacity-50"
              >
                {createIssue.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                추가
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-muted hover:text-text border border-border rounded text-[12px]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이슈 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Ticket size={36} className="text-muted mb-3" />
          <p className="text-muted text-[13px]">등록된 이슈가 없습니다</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-primary text-[12px] hover:underline"
          >
            이슈 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map(issue => (
            <div key={issue.id} className="bg-surface border border-border rounded-lg p-4 hover:border-[#333] transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[13px] font-medium text-text">{issue.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[issue.priority]}`}>
                      {PRIORITY_LABELS[issue.priority]}
                    </span>
                  </div>
                  {issue.description && (
                    <p className="text-[12px] text-muted mb-2 leading-relaxed line-clamp-2">{issue.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted">
                    {issue.agent_id && (
                      <span>{agents.find((a: any) => a.id === issue.agent_id)?.name ?? '봇'}</span>
                    )}
                    <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true, locale: ko })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 상태 변경 드롭다운 */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenStatusMenu(openStatusMenu === issue.id ? null : issue.id)}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded ${STATUS_COLORS[issue.status]}`}
                    >
                      {STATUS_LABELS[issue.status]}
                      <ChevronDown size={10} />
                    </button>
                    {openStatusMenu === issue.id && (
                      <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg overflow-hidden z-10 min-w-[120px]">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatus.mutate({ id: issue.id, status: s })}
                            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#2A2A2C] transition-colors ${issue.status === s ? 'text-text font-medium' : 'text-muted'}`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteIssue.mutate(issue.id)}
                    className="text-muted hover:text-red-400 p-1 rounded"
                    title="삭제"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 드롭다운 닫기 오버레이 */}
      {openStatusMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenStatusMenu(null)} />
      )}
    </div>
  )
}
