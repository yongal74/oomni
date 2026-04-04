import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulesApi, agentsApi, type Schedule, type Agent } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Plus, X, Loader2, Calendar, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const TRIGGER_TYPE_LABELS: Record<Schedule['trigger_type'], string> = {
  interval: '반복 실행',
  cron: '크론 식',
  webhook: '웹훅',
  bot_complete: '봇 완료 시',
}
const TRIGGER_TYPE_DESCS: Record<Schedule['trigger_type'], string> = {
  interval: '일정 주기로 자동 실행',
  cron: '크론 표현식으로 정밀 스케줄',
  webhook: '외부 HTTP 요청으로 트리거',
  bot_complete: '다른 봇이 완료되면 자동 실행',
}

const INTERVAL_OPTIONS = [
  { label: '매시간', value: 'hourly' },
  { label: '매일', value: 'daily' },
  { label: '매주', value: 'weekly' },
]

function generateWebhookKey() {
  return 'whk_' + Math.random().toString(36).slice(2, 18)
}

export default function SchedulePage() {
  const qc = useQueryClient()
  const { currentMission } = useAppStore()
  const missionId = currentMission?.id

  const [showAddForm, setShowAddForm] = useState(false)
  const [formAgentId, setFormAgentId] = useState('')
  const [formName, setFormName] = useState('')
  const [formTriggerType, setFormTriggerType] = useState<Schedule['trigger_type']>('interval')
  const [formIntervalVal, setFormIntervalVal] = useState('daily')
  const [formCronVal, setFormCronVal] = useState('0 9 * * *')
  const [formWebhookKey] = useState(generateWebhookKey)
  const [formBotCompleteId, setFormBotCompleteId] = useState('')

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules', missionId],
    queryFn: () => schedulesApi.list({ mission_id: missionId }),
    enabled: !!missionId,
    refetchInterval: 15000,
  })

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', missionId],
    queryFn: () => agentsApi.list(missionId),
    enabled: !!missionId,
  })

  const getTriggerValue = () => {
    switch (formTriggerType) {
      case 'interval': return formIntervalVal
      case 'cron': return formCronVal
      case 'webhook': return formWebhookKey
      case 'bot_complete': return formBotCompleteId
    }
  }

  const createSchedule = useMutation({
    mutationFn: () => schedulesApi.create({
      agent_id: formAgentId,
      mission_id: missionId!,
      name: formName,
      trigger_type: formTriggerType,
      trigger_value: getTriggerValue(),
    }),
    onSuccess: () => {
      setShowAddForm(false)
      setFormName('')
      setFormAgentId('')
      qc.invalidateQueries({ queryKey: ['schedules'] })
    },
  })

  const toggleSchedule = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      schedulesApi.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const getAgentName = (agentId: string) =>
    agents.find(a => a.id === agentId)?.name ?? agentId

  const getTriggerValueLabel = (s: Schedule) => {
    switch (s.trigger_type) {
      case 'interval':
        return INTERVAL_OPTIONS.find(o => o.value === s.trigger_value)?.label ?? s.trigger_value
      case 'cron':
        return s.trigger_value
      case 'webhook':
        return s.trigger_value
      case 'bot_complete':
        return getAgentName(s.trigger_value)
    }
  }

  // bot_complete 연결 시각화
  const botCompleteConnections = schedules.filter(s => s.trigger_type === 'bot_complete')

  if (!missionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Calendar size={40} className="text-muted" />
        <h2 className="text-xl font-semibold text-text">미션을 먼저 선택해주세요</h2>
      </div>
    )
  }

  const canSubmit = formAgentId && formName.trim() &&
    (formTriggerType !== 'bot_complete' || !!formBotCompleteId)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">자동화 스케줄</h1>
          <p className="text-[13px] text-muted mt-0.5">봇 실행 조건 및 자동화 연결</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] transition-colors"
        >
          <Plus size={14} />
          스케줄 추가
        </button>
      </div>

      {/* 봇 연결 시각화 */}
      {botCompleteConnections.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-5">
          <h3 className="text-[12px] font-medium text-muted mb-3 uppercase tracking-wider">봇 자동 연결</h3>
          <div className="space-y-2">
            {botCompleteConnections.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-[13px]">
                <span className="text-text font-medium">{getAgentName(s.trigger_value)}</span>
                <span className="text-muted">완료</span>
                <ArrowRight size={14} className="text-primary" />
                <span className="text-text font-medium">{getAgentName(s.agent_id)}</span>
                <span className="text-muted">자동 실행</span>
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${s.is_active ? 'bg-green-900/30 text-green-400' : 'bg-[#2A2A2C] text-muted'}`}>
                  {s.is_active ? '활성' : '비활성'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스케줄 추가 폼 */}
      {showAddForm && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[14px] font-medium text-text">새 스케줄</span>
            <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-text">
              <X size={15} />
            </button>
          </div>

          <div className="space-y-4">
            {/* 스케줄 이름 */}
            <div>
              <label className="text-[11px] text-muted block mb-1">스케줄 이름</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="예: 매일 아침 리서치 실행"
                className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary"
              />
            </div>

            {/* 봇 선택 */}
            <div>
              <label className="text-[11px] text-muted block mb-1">실행할 봇</label>
              <select
                value={formAgentId}
                onChange={e => setFormAgentId(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text focus:outline-none focus:border-primary"
              >
                <option value="">봇 선택</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* 트리거 타입 */}
            <div>
              <label className="text-[11px] text-muted block mb-2">트리거 유형</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TRIGGER_TYPE_LABELS) as Schedule['trigger_type'][]).map(type => (
                  <button
                    key={type}
                    onClick={() => setFormTriggerType(type)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      formTriggerType === type
                        ? 'border-primary bg-[#1E1E20]'
                        : 'border-border hover:border-[#333] hover:bg-[#1A1A1C]'
                    }`}
                  >
                    <div className="text-[12px] font-medium text-text">{TRIGGER_TYPE_LABELS[type]}</div>
                    <div className="text-[11px] text-muted mt-0.5">{TRIGGER_TYPE_DESCS[type]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 트리거 값 입력 (타입별) */}
            <div>
              <label className="text-[11px] text-muted block mb-1">트리거 설정</label>
              {formTriggerType === 'interval' && (
                <div className="flex gap-2">
                  {INTERVAL_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setFormIntervalVal(o.value)}
                      className={`px-4 py-2 rounded border text-[12px] transition-colors ${
                        formIntervalVal === o.value
                          ? 'border-primary bg-primary/10 text-text'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {formTriggerType === 'cron' && (
                <div>
                  <input
                    type="text"
                    value={formCronVal}
                    onChange={e => setFormCronVal(e.target.value)}
                    placeholder="0 9 * * *"
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text font-mono focus:outline-none focus:border-primary"
                  />
                  <p className="text-[11px] text-muted mt-1">예: <span className="font-mono">0 9 * * *</span> = 매일 오전 9시</p>
                </div>
              )}
              {formTriggerType === 'webhook' && (
                <div>
                  <div className="flex items-center gap-2 bg-bg border border-border rounded px-3 py-2">
                    <span className="text-[12px] text-muted font-mono flex-1 truncate">{formWebhookKey}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(formWebhookKey)}
                      className="text-[11px] text-primary hover:underline shrink-0"
                    >
                      복사
                    </button>
                  </div>
                  <p className="text-[11px] text-muted mt-1">이 키를 웹훅 URL에 포함시켜 호출하세요</p>
                </div>
              )}
              {formTriggerType === 'bot_complete' && (
                <div>
                  <select
                    value={formBotCompleteId}
                    onChange={e => setFormBotCompleteId(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text focus:outline-none focus:border-primary"
                  >
                    <option value="">트리거할 봇 선택 (이 봇이 완료되면 실행)</option>
                    {agents
                      .filter(a => a.id !== formAgentId)
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                  </select>
                  {formAgentId && formBotCompleteId && (
                    <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
                      <span className="text-text">{getAgentName(formBotCompleteId)}</span>
                      <span>완료</span>
                      <ArrowRight size={12} className="text-primary" />
                      <span className="text-text">{getAgentName(formAgentId)}</span>
                      <span>자동 실행</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => createSchedule.mutate()}
                disabled={!canSubmit || createSchedule.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] disabled:opacity-50"
              >
                {createSchedule.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                저장
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-muted hover:text-text border border-border rounded text-[13px]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스케줄 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar size={36} className="text-muted mb-3" />
          <p className="text-muted text-[13px]">등록된 스케줄이 없습니다</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-primary text-[12px] hover:underline"
          >
            스케줄 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => (
            <div key={s.id} className="bg-surface border border-border rounded-lg p-4 hover:border-[#333] transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-text">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A2A2C] text-muted">
                      {TRIGGER_TYPE_LABELS[s.trigger_type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-muted flex-wrap">
                    <span>봇: <span className="text-text">{getAgentName(s.agent_id)}</span></span>
                    <span>·</span>
                    <span>
                      {s.trigger_type === 'bot_complete' ? (
                        <span className="flex items-center gap-1">
                          <span className="text-text">{getAgentName(s.trigger_value)}</span>
                          <span>완료 시</span>
                        </span>
                      ) : (
                        <span className="font-mono">{getTriggerValueLabel(s)}</span>
                      )}
                    </span>
                    {s.last_run_at && (
                      <>
                        <span>·</span>
                        <span>
                          마지막 실행 {formatDistanceToNow(new Date(s.last_run_at), { addSuffix: true, locale: ko })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* 활성화 토글 */}
                  <button
                    onClick={() => toggleSchedule.mutate({ id: s.id, is_active: !s.is_active })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${s.is_active ? 'bg-primary' : 'bg-[#333]'}`}
                    title={s.is_active ? '비활성화' : '활성화'}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${s.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <button
                    onClick={() => deleteSchedule.mutate(s.id)}
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
    </div>
  )
}
