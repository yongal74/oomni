import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  agentsApi, feedApi, schedulesApi,
  type Agent, type Schedule,
} from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Play, Trash2, Save, Settings, Activity, Loader2, Link2, X, ArrowRight, Plus } from 'lucide-react'
import { BotRunModal } from '../components/BotRunModal'
import { BotStreamOutput } from '../components/BotStreamOutput'
import { BotRunHistory } from '../components/BotRunHistory'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡',
}
const SCHEDULE_LABELS = { manual: '수동', hourly: '매시간', daily: '매일', weekly: '매주' }

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { currentMission } = useAppStore()
  const missionId = currentMission?.id

  const [tab, setTab] = useState<'activity' | 'settings' | 'triggers'>('activity')
  const [showRunModal, setShowRunModal] = useState(false)
  const [showStream, setShowStream] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [editedBudget, setEditedBudget] = useState<number>(0)
  const [editedSchedule, setEditedSchedule] = useState<string>('manual')
  const [saveMsg, setSaveMsg] = useState('')
  const [selectedConnectBot, setSelectedConnectBot] = useState('')
  const [connectScheduleName, setConnectScheduleName] = useState('')

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.list().then(list => list.find((a: Agent) => a.id === id)!),
    enabled: !!id,
  })
  useEffect(() => {
    if (agent) {
      setEditedPrompt(agent.system_prompt)
      setEditedBudget(agent.budget_cents)
      setEditedSchedule(agent.schedule)
    }
  }, [agent])

  // 모든 에이전트 (같은 미션)
  const { data: allAgents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', missionId],
    queryFn: () => agentsApi.list(missionId),
    enabled: !!missionId,
  })

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', id],
    queryFn: () => feedApi.list({ limit: 20 }),
    select: (data: FeedItemAny[]) => data.filter(f => f.agent_id === id),
  })

  // 이 봇과 관련된 스케줄
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ['schedules', missionId],
    queryFn: () => schedulesApi.list({ mission_id: missionId }),
    enabled: !!missionId,
  })

  // 이 봇을 트리거하는 스케줄 (trigger_value === id, bot_complete 타입)
  const incomingTriggers = schedules.filter(
    s => s.trigger_type === 'bot_complete' && s.agent_id === id
  )
  // 이 봇이 완료되면 실행할 스케줄 (trigger_value === id, bot_complete 타입, agent_id !== id)
  const outgoingTriggers = schedules.filter(
    s => s.trigger_type === 'bot_complete' && s.trigger_value === id
  )

  const update = useMutation({
    mutationFn: () => agentsApi.update(id!, {
      system_prompt: editedPrompt,
      budget_cents: editedBudget,
      schedule: editedSchedule as Agent['schedule'],
    }),
    onSuccess: () => {
      setSaveMsg('저장됨!')
      setTimeout(() => setSaveMsg(''), 2000)
      qc.invalidateQueries({ queryKey: ['agent', id] })
    },
  })

  const remove = useMutation({
    mutationFn: () => agentsApi.delete(id!),
    onSuccess: () => navigate('/dashboard'),
  })

  // 봇 완료 시 자동 실행 연결 추가
  const addOutgoingTrigger = useMutation({
    mutationFn: () => schedulesApi.create({
      agent_id: selectedConnectBot,
      mission_id: missionId!,
      name: connectScheduleName || `${agent?.name} 완료 → ${allAgents.find(a => a.id === selectedConnectBot)?.name ?? ''} 실행`,
      trigger_type: 'bot_complete',
      trigger_value: id!,
    }),
    onSuccess: () => {
      setSelectedConnectBot('')
      setConnectScheduleName('')
      qc.invalidateQueries({ queryKey: ['schedules'] })
    },
  })

  // 스케줄 삭제
  const deleteSchedule = useMutation({
    mutationFn: (scheduleId: string) => schedulesApi.delete(scheduleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const getAgentName = (agentId: string) =>
    allAgents.find(a => a.id === agentId)?.name ?? agentId

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!agent) return <div className="p-6 text-muted">봇을 찾을 수 없습니다</div>

  const otherAgents = allAgents.filter(a => a.id !== id)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{BOT_EMOJI[agent.role] ?? '🤖'}</span>
          <div>
            <h1 className="text-xl font-semibold text-text">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted">{agent.role}</span>
              <span className="text-[11px] text-muted">•</span>
              <span className="text-[11px] text-muted">{SCHEDULE_LABELS[agent.schedule as keyof typeof SCHEDULE_LABELS]}</span>
              <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-[#444]'}`} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRunModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A]"
          >
            <Play size={13} />
            즉시 실행
          </button>
          <button
            onClick={() => remove.mutate()}
            className="p-1.5 text-muted hover:text-red-400 border border-border rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {([
          ['activity', Activity, '활동'],
          ['settings', Settings, '설정'],
          ['triggers', Link2, '트리거 연결'],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <Icon size={13} />{label}
            {key === 'triggers' && (incomingTriggers.length + outgoingTriggers.length) > 0 && (
              <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {incomingTriggers.length + outgoingTriggers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* SSE 스트림 출력 패널 */}
      {showStream && agent && (
        <div className="mb-5">
          <BotStreamOutput
            agentId={agent.id}
            onDone={() => {
              setShowStream(false)
              qc.invalidateQueries()
            }}
          />
        </div>
      )}

      {/* 활동 탭 */}
      {tab === 'activity' && (
        <div>
          {feed.length === 0 && (
            <div className="mb-4 text-center">
              <button
                onClick={() => setShowRunModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] mx-auto"
              >
                <Play size={13} />
                지금 실행하기
              </button>
            </div>
          )}
          <BotRunHistory agentId={agent.id} />
        </div>
      )}

      {/* 설정 탭 */}
      {tab === 'settings' && (
        <div className="space-y-5">
          <div>
            <label className="text-[12px] text-muted block mb-1.5">실행 스케줄</label>
            <select
              value={editedSchedule}
              onChange={e => setEditedSchedule(e.target.value)}
              className="bg-bg border border-border rounded px-3 py-2 text-[13px] text-text focus:outline-none focus:border-primary"
            >
              {Object.entries(SCHEDULE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-muted block mb-1.5">월 예산 한도 (cents, $1 = 100)</label>
            <input
              type="number"
              value={editedBudget}
              onChange={e => setEditedBudget(parseInt(e.target.value) || 0)}
              min={0}
              className="w-48 bg-bg border border-border rounded px-3 py-2 text-[13px] text-text focus:outline-none focus:border-primary"
            />
            <span className="text-[11px] text-muted ml-2">${(editedBudget / 100).toFixed(2)}/월</span>
          </div>
          <div>
            <label className="text-[12px] text-muted block mb-1.5">시스템 프롬프트</label>
            <textarea
              value={editedPrompt}
              onChange={e => setEditedPrompt(e.target.value)}
              rows={8}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-[12px] text-text font-mono focus:outline-none focus:border-primary resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] disabled:opacity-50"
            >
              {update.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              저장
            </button>
            {saveMsg && <span className="text-[12px] text-green-400">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* 트리거 연결 탭 */}
      {tab === 'triggers' && (
        <div className="space-y-6">
          {/* 이 봇을 트리거하는 스케줄 */}
          <div>
            <h3 className="text-[12px] font-medium text-muted uppercase tracking-wider mb-3">
              이 봇을 실행시키는 트리거
            </h3>
            {incomingTriggers.length === 0 ? (
              <div className="text-center py-6 text-muted text-[12px] bg-surface border border-border rounded-lg">
                이 봇을 자동으로 실행하는 트리거가 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {incomingTriggers.map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[12px] text-muted">
                        {s.trigger_type === 'bot_complete' ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-text font-medium">{getAgentName(s.trigger_value)}</span>
                            <span>완료 시 자동 실행</span>
                          </span>
                        ) : (
                          <span>{s.name}</span>
                        )}
                      </span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-[#444]'}`} />
                    <button
                      onClick={() => deleteSchedule.mutate(s.id)}
                      className="text-muted hover:text-red-400 p-1 rounded"
                      title="연결 제거"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 이 봇 완료 후 자동 실행할 봇 */}
          <div>
            <h3 className="text-[12px] font-medium text-muted uppercase tracking-wider mb-3">
              이 봇 완료 시 자동 실행할 봇
            </h3>
            {outgoingTriggers.length === 0 ? (
              <div className="text-center py-4 text-muted text-[12px] bg-surface border border-border rounded-lg mb-3">
                연결된 봇이 없습니다
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                {outgoingTriggers.map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-text font-medium text-[12px]">{agent.name}</span>
                      <ArrowRight size={12} className="text-primary" />
                      <span className="text-text font-medium text-[12px]">{getAgentName(s.agent_id)}</span>
                      <span className="text-[11px] text-muted">자동 실행</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-[#444]'}`} />
                    <button
                      onClick={() => deleteSchedule.mutate(s.id)}
                      className="text-muted hover:text-red-400 p-1 rounded"
                      title="연결 제거"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 연결 추가 폼 */}
            {otherAgents.length > 0 ? (
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="text-[12px] text-muted mb-3">연결할 봇 선택</div>
                <div className="space-y-3">
                  <select
                    value={selectedConnectBot}
                    onChange={e => setSelectedConnectBot(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text focus:outline-none focus:border-primary"
                  >
                    <option value="">봇 선택 (이 봇 완료 후 자동 실행)</option>
                    {otherAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  {selectedConnectBot && (
                    <div className="flex items-center gap-2 text-[12px] text-muted">
                      <span className="text-text">{agent.name}</span>
                      <span>완료</span>
                      <ArrowRight size={12} className="text-primary" />
                      <span className="text-text">{getAgentName(selectedConnectBot)}</span>
                      <span>자동 실행</span>
                    </div>
                  )}
                  <input
                    type="text"
                    value={connectScheduleName}
                    onChange={e => setConnectScheduleName(e.target.value)}
                    placeholder="스케줄 이름 (선택)"
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => addOutgoingTrigger.mutate()}
                    disabled={!selectedConnectBot || addOutgoingTrigger.isPending || !missionId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[12px] hover:bg-[#C5664A] disabled:opacity-50"
                  >
                    {addOutgoingTrigger.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    연결 추가
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted text-[12px] bg-surface border border-border rounded-lg">
                연결 가능한 다른 봇이 없습니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* 봇 실행 모달 */}
      {showRunModal && agent && (
        <BotRunModal
          agent={agent}
          onClose={() => setShowRunModal(false)}
          onSuccess={() => setShowStream(true)}
        />
      )}
    </div>
  )
}

// 로컬 타입 (feedApi 반환값용)
interface FeedItemAny {
  id: string
  agent_id: string
  type: string
  content: string
  created_at: string
}
