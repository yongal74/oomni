import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, type Agent } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Trash2, Settings, ArrowLeft, Send } from 'lucide-react'
import { PipelineBar, ROLE_STAGES } from '../components/bot/PipelineBar'
import { LiveStreamDrawer } from '../components/bot/LiveStreamDrawer'
import {
  ResearchLeftPanel,
  ResearchCenterPanel,
  ResearchRightPanel,
} from '../components/bot/panels/ResearchPanel'
import {
  CommonLeftPanel,
  CommonCenterPanel,
  CommonRightPanel,
} from '../components/bot/panels/GenericPanel'
import { cn } from '../lib/utils'
import type { ResearchItem } from '../lib/api'

const BOT_EMOJI: Record<string, string> = {
  research: '🔬', build: '🔨', design: '🎨', content: '✍️',
  growth: '📈', ops: '⚙️', integration: '🔗', n8n: '⚡', ceo: '👔',
}

const ROLE_LABEL: Record<string, string> = {
  research: 'Research', build: 'Build', design: 'Design', content: 'Content',
  growth: 'Growth', ops: 'Ops', integration: 'Integration', n8n: 'n8n', ceo: 'CEO',
}

const PLACEHOLDER: Record<string, string> = {
  research: '예: "오늘 AI 트렌드 수집하고 신호강도 채점해줘"',
  content:  '예: "리서치 결과로 블로그 포스트 초안 작성해줘"',
  build:    '예: "Research Bot SSE 스트리밍 연결 버그 수정해줘"',
  growth:   '예: "이번 주 사용자 증가 분석하고 캠페인 추천해줘"',
  ops:      '예: "Slack 메시지 → 이슈 자동 생성 n8n 워크플로우 만들어줘"',
  ceo:      '예: "이번 주 전체 봇 현황 브리핑 작성해줘"',
  design:   '예: "대시보드 랜딩 히어로 섹션 디자인 생성해줘"',
  default:  '봇에게 지시사항을 입력하세요...',
}

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { currentMission, agents: allAgents } = useAppStore()
  const missionId = currentMission?.id

  const [task, setTask] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedResearchItem, setSelectedResearchItem] = useState<ResearchItem | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.list().then(list => list.find((a: Agent) => a.id === id)!),
    enabled: !!id,
  })

  // 다음 봇 (같은 미션의 다른 봇)
  const nextBot = allAgents.find(a => a.mission_id === missionId && a.id !== id)

  const update = useMutation({
    mutationFn: (data: Partial<Agent>) => agentsApi.update(id!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', id] }),
  })

  const remove = useMutation({
    mutationFn: () => agentsApi.delete(id!),
    onSuccess: () => navigate('/dashboard'),
  })

  const handleRun = () => {
    if (!task.trim() || isRunning) return
    setIsRunning(true)
    setCurrentStage(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRun()
    }
  }

  const handleDone = () => {
    setIsRunning(false)
    setCurrentStage('done')
    qc.invalidateQueries({ queryKey: ['bot-feed', id] })
    qc.invalidateQueries({ queryKey: ['research', missionId] })
    setTask('')
  }

  const handleNextBot = () => {
    if (nextBot) navigate(`/dashboard/bots/${nextBot.id}`)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!agent) return <div className="p-6 text-muted text-[13px]">봇을 찾을 수 없습니다</div>

  const stages = ROLE_STAGES[agent.role] ?? ROLE_STAGES.default
  const placeholder = PLACEHOLDER[agent.role] ?? PLACEHOLDER.default

  return (
    <div className="flex flex-col h-full">

      {/* ── 헤더 ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-muted hover:text-text transition-colors"
          >
            <ArrowLeft size={15} />
          </button>
          <span className="text-xl">{BOT_EMOJI[agent.role] ?? '🤖'}</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold text-text">{agent.name}</h1>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                agent.is_active ? 'bg-green-500/15 text-green-400' : 'bg-border text-muted'
              )}>
                {agent.is_active ? '활성' : '비활성'}
              </span>
            </div>
            <div className="text-[11px] text-muted">{ROLE_LABEL[agent.role]} Bot</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(s => !s)}
            className={cn(
              'p-1.5 rounded transition-colors',
              showSettings ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
            )}
          >
            <Settings size={14} />
          </button>
          <button
            onClick={() => {
              if (confirm('이 봇을 삭제할까요?')) remove.mutate()
            }}
            className="p-1.5 text-muted hover:text-red-400 transition-colors rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── 파이프라인 바 ─────────────────────────────────── */}
      <PipelineBar stages={stages} currentStage={currentStage} />

      {/* ── 메인 3패널 ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT */}
        <div className="w-52 border-r border-border overflow-y-auto shrink-0">
          {showSettings ? (
            <CommonLeftPanel
              agent={agent}
              onUpdate={(data) => update.mutate(data as Partial<Agent>)}
            />
          ) : agent.role === 'research' ? (
            <ResearchLeftPanel missionId={missionId ?? ''} />
          ) : (
            <CommonLeftPanel
              agent={agent}
              onUpdate={(data) => update.mutate(data as Partial<Agent>)}
            />
          )}
        </div>

        {/* CENTER */}
        <div className="flex-1 overflow-hidden">
          {agent.role === 'research' ? (
            <ResearchCenterPanel
              missionId={missionId ?? ''}
              onItemClick={setSelectedResearchItem}
            />
          ) : (
            <CommonCenterPanel agentId={agent.id} />
          )}
        </div>

        {/* RIGHT */}
        <div className="w-64 border-l border-border overflow-y-auto shrink-0">
          {agent.role === 'research' ? (
            <ResearchRightPanel
              item={selectedResearchItem}
              nextBotName={nextBot?.name}
              onNextBot={handleNextBot}
            />
          ) : (
            <CommonRightPanel
              agentId={agent.id}
              nextBotName={nextBot?.name}
              onNextBot={handleNextBot}
            />
          )}
        </div>
      </div>

      {/* ── 하단 고정: 스트림 + 프롬프트 입력창 ─────────── */}
      <div className="shrink-0">
        <LiveStreamDrawer
          agentId={agent.id}
          task={task}
          isRunning={isRunning}
          onStageChange={setCurrentStage}
          onDone={handleDone}
          onError={() => setIsRunning(false)}
          esRef={esRef}
        />

        {/* 프롬프트 입력창 */}
        <div className="flex items-end gap-3 px-4 py-3 bg-surface border-t border-border">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isRunning}
              className={cn(
                'w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-[13px] text-text placeholder-muted/60',
                'focus:outline-none focus:border-primary/60 resize-none leading-relaxed',
                'transition-colors disabled:opacity-50',
                'max-h-32 overflow-y-auto'
              )}
              style={{ height: 'auto' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 128) + 'px'
              }}
            />
          </div>
          <button
            onClick={handleRun}
            disabled={!task.trim() || isRunning}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors shrink-0',
              'bg-primary text-white hover:bg-primary-hover',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <Send size={13} />
            실행
          </button>
        </div>
      </div>
    </div>
  )
}
