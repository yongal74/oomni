import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, type Agent } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Trash2, Settings, ArrowLeft, Send } from 'lucide-react'
import { PipelineBar, ROLE_STAGES } from '../components/bot/PipelineBar'
import { LiveStreamDrawer } from '../components/bot/LiveStreamDrawer'
import { ResearchLeftPanel, ResearchCenterPanel, ResearchRightPanel } from '../components/bot/panels/ResearchPanel'
import { BuildLeftPanel, BuildCenterPanel, BuildRightPanel } from '../components/bot/panels/BuildPanel'
import type { FileNode } from '../lib/api'
import { ContentLeftPanel, ContentCenterPanel, ContentRightPanel } from '../components/bot/panels/ContentPanel'
import { GrowthLeftPanel, GrowthCenterPanel, GrowthRightPanel } from '../components/bot/panels/GrowthPanel'
import { OpsLeftPanel, OpsCenterPanel, OpsRightPanel } from '../components/bot/panels/OpsPanel'
import { CeoLeftPanel, CeoCenterPanel, CeoRightPanel } from '../components/bot/panels/CeoPanel'
import { DesignLeftPanel, DesignCenterPanel, DesignRightPanel } from '../components/bot/panels/DesignPanel'
import { CommonLeftPanel, CommonCenterPanel, CommonRightPanel } from '../components/bot/panels/GenericPanel'
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
  research:    '"오늘 AI 트렌드 수집하고 신호강도 채점해줘"',
  content:     '"리서치 결과로 블로그 포스트 초안 작성해줘"',
  build:       '"Research Bot SSE 연결 버그 수정해줘"',
  growth:      '"이번 주 사용자 증가 분석하고 캠페인 추천해줘"',
  ops:         '"Slack 메시지 → 이슈 자동 생성 n8n 워크플로우 만들어줘"',
  ceo:         '"이번 주 전체 봇 현황 브리핑 작성해줘"',
  design:      '"다크 테마 랜딩 히어로 섹션 디자인해줘"',
  integration: '"GitHub 이슈 → Slack 알림 연결해줘"',
  n8n:         '"데이터 파이프라인 워크플로우 만들어줘"',
  default:     '봇에게 지시사항을 입력하세요...',
}

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { currentMission, agents: allAgents } = useAppStore()
  const missionId = currentMission?.id

  const [task, setTask] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedResearchItem, setSelectedResearchItem] = useState<ResearchItem | null>(null)
  const [contentType, setContentType] = useState('blog')
  const [designTemplate, setDesignTemplate] = useState('landing')
  const [selectedBuildFile, setSelectedBuildFile] = useState<FileNode | null>(null)
  const [streamOutput, setStreamOutput] = useState('')
  const esRef = useRef<EventSource | null>(null)

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.list().then(list => list.find((a: Agent) => a.id === id)!),
    enabled: !!id,
  })

  const nextBot = allAgents.find(a => a.mission_id === missionId && a.id !== id)

  const update = useMutation({
    mutationFn: (data: Partial<Agent>) => agentsApi.update(id!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', id] }),
  })

  const remove = useMutation({
    mutationFn: () => agentsApi.delete(id!),
    onSuccess: () => navigate('/dashboard'),
  })

  // ?autorun= URL 파라미터 처리 — 대시보드 프리셋 클릭 시 자동 실행
  useEffect(() => {
    const autorun = searchParams.get('autorun')
    if (!autorun || !agent || isRunning) return
    const decoded = decodeURIComponent(autorun)
    setSearchParams({}, { replace: true }) // URL에서 파라미터 제거
    setTask(decoded)
    // 상태 업데이트 후 실행 — requestAnimationFrame으로 다음 렌더 사이클에 실행
    requestAnimationFrame(() => {
      const stages = ROLE_STAGES[agent.role] ?? ROLE_STAGES.default
      setCurrentStage(stages[0].key)
      setStreamOutput('')
      setIsRunning(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent])

  const handleRun = () => {
    if (!task.trim() || isRunning) return
    const stages = ROLE_STAGES[agent?.role ?? 'default'] ?? ROLE_STAGES.default
    setCurrentStage(stages[0].key) // 첫 단계 즉시 활성화
    setStreamOutput('') // reset stream for new run
    setIsRunning(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRun()
    }
  }

  const handleDone = () => {
    setIsRunning(false)
    qc.invalidateQueries({ queryKey: ['bot-feed', id] })
    qc.invalidateQueries({ queryKey: ['issues', missionId] })
    setTask('')

    if (agent?.role === 'research') {
      setCurrentStage('sorting')
    } else {
      setCurrentStage('done')
    }
    qc.invalidateQueries({ queryKey: ['research', missionId] })
  }

  const handleNextBot = () => {
    if (nextBot) navigate(`/dashboard/bots/${nextBot.id}`)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!agent) return <div className="p-8 text-base text-muted">봇을 찾을 수 없습니다</div>

  const stages = ROLE_STAGES[agent.role] ?? ROLE_STAGES.default
  const placeholder = PLACEHOLDER[agent.role] ?? PLACEHOLDER.default

  // 역할별 Left/Center/Right 패널
  const renderPanels = () => {
    if (showSettings) {
      return {
        left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
        center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CommonRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} />,
      }
    }
    switch (agent.role) {
      case 'research': return {
        left: <ResearchLeftPanel missionId={missionId ?? ''} />,
        center: <ResearchCenterPanel missionId={missionId ?? ''} onItemClick={setSelectedResearchItem} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <ResearchRightPanel item={selectedResearchItem} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} />,
      }
      case 'build': return {
        left: <BuildLeftPanel
          agentId={agent.id}
          selectedFilePath={selectedBuildFile?.path ?? null}
          onFileSelect={setSelectedBuildFile}
        />,
        center: <BuildCenterPanel
          agentId={agent.id}
          selectedFile={selectedBuildFile}
          isRunning={isRunning}
          streamContent={streamOutput}
        />,
        right: <BuildRightPanel
          agentId={agent.id}
          nextBotName={nextBot?.name}
          onNextBot={handleNextBot}
          onSkillSelect={(skill: string) => setTask(skill)}
        />,
      }
      case 'content': return {
        left: <ContentLeftPanel missionId={missionId ?? ''} selectedType={contentType} onTypeChange={setContentType} />,
        center: <ContentCenterPanel agentId={agent.id} selectedType={contentType} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <ContentRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} />,
      }
      case 'growth': return {
        left: <GrowthLeftPanel />,
        center: <GrowthCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <GrowthRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} />,
      }
      case 'ops': return {
        left: <OpsLeftPanel agentId={agent.id} />,
        center: <OpsCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <OpsRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} />,
      }
      case 'ceo': return {
        left: <CeoLeftPanel missionId={missionId ?? ''} />,
        center: <CeoCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CeoRightPanel missionId={missionId ?? ''} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} />,
      }
      case 'design': return {
        left: <DesignLeftPanel selectedTemplate={designTemplate} onTemplateChange={setDesignTemplate} />,
        center: <DesignCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <DesignRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} />,
      }
      default: return {
        left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
        center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CommonRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} />,
      }
    }
  }

  const { left, center, right } = renderPanels()

  return (
    <div className="flex flex-col h-full">

      {/* ── 헤더 ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-muted hover:text-text transition-colors">
            <ArrowLeft size={17} />
          </button>
          <span className="text-2xl">{BOT_EMOJI[agent.role] ?? '🤖'}</span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-text">{agent.name}</h1>
              <span className={cn(
                'text-xs px-2 py-1 rounded-full font-medium',
                agent.is_active ? 'bg-green-500/15 text-green-400' : 'bg-border text-muted'
              )}>
                {agent.is_active ? '● 활성' : '○ 비활성'}
              </span>
            </div>
            <div className="text-sm text-muted mt-0.5">{ROLE_LABEL[agent.role]} Bot</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(s => !s)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              showSettings ? 'text-primary bg-primary/10' : 'text-muted hover:text-text hover:bg-surface'
            )}
          >
            <Settings size={15} />
            설정
          </button>
          <button
            onClick={() => { if (confirm('이 봇을 삭제할까요?')) remove.mutate() }}
            className="p-2 text-muted hover:text-red-400 transition-colors rounded-lg"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ── 파이프라인 바 ─────────────────────────────────── */}
      <PipelineBar stages={stages} currentStage={currentStage} />

      {/* ── 메인 3패널 ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT */}
        <div className="w-56 border-r border-border overflow-y-auto shrink-0 bg-surface/30">
          {left}
        </div>

        {/* CENTER */}
        <div className="flex-1 overflow-hidden">
          {center}
        </div>

        {/* RIGHT */}
        <div className="w-64 border-l border-border overflow-y-auto shrink-0 bg-surface/30">
          {right}
        </div>
      </div>

      {/* ── 하단: 스트림 드로어 + 프롬프트 입력 ──────────── */}
      <div className="shrink-0">
        <LiveStreamDrawer
          agentId={agent.id}
          task={task}
          isRunning={isRunning}
          onStageChange={setCurrentStage}
          onDone={handleDone}
          onError={() => { setIsRunning(false); setCurrentStage(null) }}
          onOutputChunk={(chunk) => setStreamOutput(prev => prev + chunk)}
          esRef={esRef}
        />

        <div className="flex items-end gap-3 px-5 py-4 bg-surface border-t border-border">
          <div className="flex-1">
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isRunning}
              className={cn(
                'w-full bg-bg border border-border rounded-xl px-4 py-3 text-base text-text placeholder-muted/60',
                'focus:outline-none focus:border-primary/60 resize-none leading-relaxed',
                'transition-colors disabled:opacity-50 max-h-36 overflow-y-auto'
              )}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 144) + 'px'
              }}
            />
          </div>
          <button
            onClick={handleRun}
            disabled={!task.trim() || isRunning}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors shrink-0',
              'bg-primary text-white hover:bg-primary-hover',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <Send size={14} />
            실행
          </button>
        </div>
      </div>
    </div>
  )
}
