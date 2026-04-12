import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, paymentsApi, type Agent, type HeartbeatRun } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Trash2, Settings, ArrowLeft, Send, Square, RotateCcw, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { PipelineBar, ROLE_STAGES } from '../components/bot/PipelineBar'
import { LiveStreamDrawer } from '../components/bot/LiveStreamDrawer'
import { XTerminal } from '../components/bot/XTerminal'
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
  const { currentMission, agents: allAgents, pendingBotInput, setPendingBotInput } = useAppStore()
  const missionId = currentMission?.id

  const [activeTab, setActiveTab] = useState<'main' | 'history'>('main')
  const [historyLimit, setHistoryLimit] = useState(20)
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())

  // 이전 봇에서 전달된 pendingBotInput을 task 초기값으로 사용
  const [task, setTask] = useState(() => pendingBotInput ?? '')
  const [isRunning, setIsRunning] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedResearchItem, setSelectedResearchItem] = useState<ResearchItem | null>(null)
  const [contentType, setContentType] = useState('blog')
  const [designTemplate, setDesignTemplate] = useState('landing')
  const [selectedBuildFile, setSelectedBuildFile] = useState<FileNode | null>(null)
  const [streamOutput, setStreamOutput] = useState('')
  const [lastOutput, setLastOutput] = useState('')  // 다음봇 전달용 최신 결과물
  const [designScreenshot, setDesignScreenshot] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [quota, setQuota] = useState<{ plan: string; runCount: number; limit: number; exceeded: boolean; remaining: number } | null>(null)
  const [pencilStatus, setPencilStatus] = useState<{ connected: boolean } | null>(null)
  // Design Bot: 사용자가 명시적으로 Pencil 모드를 선택했는지 여부
  // 기본은 SSE(HTML 생성) 모드 → "Pencil 연결" 버튼 클릭 시 XTerminal 모드로 전환
  const [pencilModeEnabled, setPencilModeEnabled] = useState(false)

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.list().then(list => list.find((a: Agent) => a.id === id)!),
    enabled: !!id,
  })

  const { data: historyRuns, isLoading: historyLoading } = useQuery<HeartbeatRun[]>({
    queryKey: ['heartbeat-runs', id, historyLimit],
    queryFn: () => agentsApi.heartbeatRuns(id!, historyLimit),
    enabled: !!id && activeTab === 'history',
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

  // 무료 플랜 사용량 조회
  useEffect(() => {
    paymentsApi.quota().then(setQuota).catch(() => {})
  }, [])

  // pendingBotInput 소비 — 마운트 직후 한 번만 클리어 (다음 봇이 다시 읽지 않도록)
  useEffect(() => {
    if (pendingBotInput) {
      setPendingBotInput(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Design Bot: Pencil MCP 연동 상태 조회
  useEffect(() => {
    if (agent?.role === 'design') {
      fetch(`http://localhost:3001/api/agents/${id}/pencil-status`)
        .then(r => r.json())
        .then(setPencilStatus)
        .catch(() => {})
    }
  }, [agent?.role, id])

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

  const handleRun = async () => {
    if (!task.trim() || isRunning) return
    // 무료 플랜 한도 확인 — 테스트 중 비활성화
    // if (quota?.plan === 'free') {
    //   const fresh = await paymentsApi.quota().catch(() => quota)
    //   setQuota(fresh)
    //   if (fresh?.exceeded) { setShowUpgradeModal(true); return }
    // }
    const stages = ROLE_STAGES[agent?.role ?? 'default'] ?? ROLE_STAGES.default
    setCurrentStage(stages[0].key) // 첫 단계 즉시 활성화
    setStreamOutput('') // reset stream for new run
    setIsRunning(true)
  }

  // 빠른 실행 버튼: prompt를 task에 설정하고 즉시 실행
  const handleSkillRun = async (prompt: string) => {
    if (isRunning) return
    // 무료 플랜 한도 확인 — 테스트 중 비활성화
    // if (quota?.plan === 'free') {
    //   const fresh = await paymentsApi.quota().catch(() => quota)
    //   setQuota(fresh)
    //   if (fresh?.exceeded) { setTask(prompt); setShowUpgradeModal(true); return }
    // }
    setTask(prompt)
    const stages = ROLE_STAGES[agent?.role ?? 'default'] ?? ROLE_STAGES.default
    setCurrentStage(stages[0].key)
    setStreamOutput('')
    setIsRunning(true)
  }

  // 실행 취소
  const handleCancel = () => {
    esRef.current?.close()
    esRef.current = null
    setIsRunning(false)
    setCurrentStage(null)
  }

  // 결과/대화 초기화
  const handleReset = () => {
    if (isRunning) handleCancel()
    setTask('')
    setStreamOutput('')
    setLastOutput('')
    setCurrentStage(null)
    qc.invalidateQueries({ queryKey: ['bot-feed', id] })
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
    if (streamOutput) setLastOutput(streamOutput)
    setTask('')

    if (agent?.role === 'research') {
      setCurrentStage('sorting')
    } else {
      setCurrentStage('done')
    }
    qc.invalidateQueries({ queryKey: ['research', missionId] })
  }

  const handleNextBot = () => {
    if (!nextBot) return
    // 현재 봇의 최신 결과물을 다음 봇 입력으로 전달
    if (lastOutput) setPendingBotInput(lastOutput)
    navigate(`/dashboard/bots/${nextBot.id}`)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!agent) return <div className="p-8 text-base text-muted">봇을 찾을 수 없습니다</div>

  const stages = ROLE_STAGES[agent.role] ?? ROLE_STAGES.default
  const placeholder = PLACEHOLDER[agent.role] ?? PLACEHOLDER.default

  // 실행 기록 탭 렌더러
  const renderHistory = () => {
    const statusBadge = (status: HeartbeatRun['status']) => {
      const map: Record<HeartbeatRun['status'], { label: string; className: string }> = {
        completed: { label: '완료', className: 'bg-green-500/15 text-green-400' },
        failed:    { label: '실패', className: 'bg-red-500/15 text-red-400' },
        running:   { label: '실행 중', className: 'bg-blue-500/15 text-blue-400' },
        pending:   { label: '대기', className: 'bg-border text-muted' },
        skipped:   { label: '건너뜀', className: 'bg-border text-muted' },
      }
      const s = map[status] ?? { label: status, className: 'bg-border text-muted' }
      return (
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', s.className)}>
          {s.label}
        </span>
      )
    }

    const statusIcon = (status: HeartbeatRun['status']) => {
      if (status === 'completed') return <CheckCircle2 size={14} className="text-green-400 shrink-0" />
      if (status === 'failed') return <XCircle size={14} className="text-red-400 shrink-0" />
      if (status === 'running') return <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />
      return <Clock size={14} className="text-muted shrink-0" />
    }

    const duration = (run: HeartbeatRun) => {
      if (!run.finished_at) return null
      const secs = ((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)
      return `${secs}s`
    }

    const toggleExpand = (runId: string) => {
      setExpandedRuns(prev => {
        const next = new Set(prev)
        if (next.has(runId)) next.delete(runId)
        else next.add(runId)
        return next
      })
    }

    if (historyLoading) {
      return (
        <div className="flex items-center justify-center h-48 gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      )
    }

    if (!historyRuns || historyRuns.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted">
          <Clock size={32} className="opacity-30" />
          <p className="text-sm">아직 실행 기록이 없습니다. 봇을 실행해보세요.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3 p-6">
        {historyRuns.map(run => {
          const isExpanded = expandedRuns.has(run.id)
          const totalTokens = (run.tokens_input ?? 0) + (run.tokens_output ?? 0)
          const dur = duration(run)
          return (
            <div key={run.id} className="border border-border rounded-xl bg-surface/50 overflow-hidden">
              {/* 헤더 행 */}
              <div className="flex items-center gap-3 px-4 py-3">
                {statusIcon(run.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {statusBadge(run.status)}
                    <span className="text-xs text-muted">
                      {new Date(run.started_at).toLocaleString('ko-KR')}
                    </span>
                    {dur && <span className="text-xs text-muted">· {dur}</span>}
                  </div>
                  {run.task && (
                    <p className="text-xs text-dim truncate" title={run.task}>
                      {run.task.length > 55 ? run.task.slice(0, 55) + '...' : run.task}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted shrink-0">
                  {totalTokens > 0 && <span>{totalTokens.toLocaleString()} tokens</span>}
                  <span className="font-medium text-text">${(run.cost_usd ?? 0).toFixed(4)}</span>
                  <button
                    onClick={() => toggleExpand(run.id)}
                    className="text-muted hover:text-text transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>
              {/* 펼쳐진 상세 */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  {run.task && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-widest mb-1">입력 지시사항</p>
                      <div className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-dim whitespace-pre-wrap">
                        {run.task}
                      </div>
                    </div>
                  )}
                  {run.error && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-widest mb-1">오류</p>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 font-mono whitespace-pre-wrap break-words">
                        {run.error}
                      </div>
                    </div>
                  )}
                  {run.output && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-muted uppercase tracking-widest">실행 결과</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(run.output ?? '')}
                          className="flex items-center gap-1 text-[10px] text-muted hover:text-primary transition-colors"
                          title="결과 복사"
                        >
                          <Copy size={10} /> 복사
                        </button>
                      </div>
                      <div className="bg-bg border border-border rounded-lg px-3 py-3 text-xs text-dim whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                        {run.output}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {/* 더 보기 버튼 */}
        {historyRuns.length >= historyLimit && (
          <button
            onClick={() => setHistoryLimit(50)}
            className="mt-2 w-full py-2 rounded-xl border border-border text-sm text-muted hover:text-text hover:bg-surface transition-colors"
          >
            더 보기 (50개까지 조회)
          </button>
        )}
      </div>
    )
  }

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
        right: <ResearchRightPanel
          item={selectedResearchItem}
          agentId={agent.id}
          onSkillSelect={(s: string) => setTask(s)}
          onFileUpload={(content, filename) => setTask(`다음 파일(${filename}) 내용을 분석하고 리서치 인사이트를 추출해줘:\n\n${content}`)}
        />,
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
          currentRole="build"
          content={lastOutput}
        />,
      }
      case 'content': return {
        left: <ContentLeftPanel
          missionId={missionId ?? ''}
          selectedType={contentType}
          onTypeChange={(type) => {
            setContentType(type)
            setTask(`${type} 형식으로 콘텐츠 초안을 작성해줘`)
          }}
          onItemSelect={(item) => {
            setTask(`"${item.title}" 리서치 내용을 ${contentType} 형식으로 변환해서 콘텐츠 초안을 작성해줘`)
          }}
        />,
        center: <ContentCenterPanel agentId={agent.id} selectedType={contentType} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <ContentRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} currentRole="content" content={lastOutput} />,
      }
      case 'growth': return {
        left: <GrowthLeftPanel />,
        center: <GrowthCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <GrowthRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} currentRole="growth" content={lastOutput} />,
      }
      case 'ops': return {
        left: <OpsLeftPanel agentId={agent.id} onSkillSelect={handleSkillRun} />,
        center: <OpsCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <OpsRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} currentRole="ops" content={lastOutput} />,
      }
      case 'n8n': return {
        left: <OpsLeftPanel agentId={agent.id} onSkillSelect={handleSkillRun} />,
        center: <OpsCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <OpsRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} currentRole="n8n" content={lastOutput} />,
      }
      case 'ceo': return {
        left: <CeoLeftPanel missionId={missionId ?? ''} />,
        center: <CeoCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CeoRightPanel missionId={missionId ?? ''} agentId={agent.id} onSkillSelect={(s: string) => setTask(s)} currentRole="ceo" content={lastOutput} />,
      }
      case 'design': return {
        left: <DesignLeftPanel selectedTemplate={designTemplate} onTemplateChange={setDesignTemplate} onApplyTemplate={(prompt) => setTask(prompt)} />,
        center: <DesignCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} screenshotUrl={designScreenshot} />,
        right: <DesignRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={handleSkillRun} currentRole="design" content={lastOutput} />,
      }
      default: return {
        left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
        center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CommonRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} currentRole={agent.role} content={lastOutput} />,
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
              {agent.role === 'design' && pencilStatus !== null && (
                <button
                  onClick={() => {
                    // Pencil 연결됨: 상태만 표시 / 미연결: antigravity 실행 안내
                    if (!pencilStatus.connected) {
                      alert('Pencil MCP를 사용하려면 Antigravity 앱을 먼저 실행하세요.\n\nAntigravity가 실행 중이라면 아래 "연결 확인" 버튼을 눌러주세요.')
                    }
                  }}
                  className={cn(
                    'text-xs px-2 py-1 rounded-full font-medium transition-colors',
                    pencilStatus.connected
                      ? 'bg-purple-500/15 text-purple-400'
                      : 'bg-border text-muted hover:bg-yellow-500/10 hover:text-yellow-400'
                  )}
                  title={pencilStatus.connected ? 'Pencil MCP 연결 중' : 'Antigravity 앱을 실행하면 자동 연결됩니다'}
                >
                  {pencilStatus.connected ? '✦ Pencil MCP 연결됨' : '✦ Pencil MCP 미연결 — 클릭'}
                </button>
              )}
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

      {/* ── 탭 바 ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 border-b border-border bg-surface shrink-0">
        <button
          onClick={() => setActiveTab('main')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'main'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'
          )}
        >
          실행
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'
          )}
        >
          <Clock size={13} />
          실행 기록
        </button>
      </div>

      {activeTab === 'history' ? (
        /* ── 실행 기록 탭 ────────────────────────────────── */
        <div className="flex-1 overflow-y-auto">
          {renderHistory()}
        </div>
      ) : (
        <>
      {/* ── 메인 3패널 ────────────────────────────────────── */}
      <div className={cn(
        'flex overflow-hidden',
        agent.role === 'build' ? 'flex-1' : 'flex-1',
      )}>
        {/* LEFT */}
        <div className={cn(
          'border-r border-border overflow-y-auto shrink-0 bg-surface/30',
          agent.role === 'design' ? 'w-44' : 'w-56',
        )}>
          {left}
        </div>

        {/* CENTER — Build/Design 봇은 XTerminal 포함한 세로 분할 */}
        {agent.role === 'build' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">{center}</div>
            {/* Build Bot: 항상 XTerminal (Claude Code CLI 인터랙티브)
                - isRunning=true 시 새 세션 시작, 이후 사용자가 직접 타이핑
                - initialInput 자동전송 제거: Claude Code 초기화 전 입력 → exit code 1 유발
                - taskHint: 태스크를 힌트로만 표시, 자동전송 없음
                - onOutputCapture: PTY 출력 → lastOutput 업데이트 → 다음 봇 전달 */}
            <XTerminal
              agentId={agent.id}
              isRunning={isRunning}
              taskHint={task}
              onExit={() => { setIsRunning(false); setCurrentStage('done') }}
              onOutputCapture={(text) => setLastOutput(text)}
              className="h-80 shrink-0"
            />
          </div>
        ) : agent.role === 'design' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">{center}</div>
            {/* Design Bot:
                - 기본: SSE 모드 (HTML 생성, Pencil 없이 바로 실행 가능)
                - pencilModeEnabled && pencilStatus?.connected: XTerminal + Pencil MCP 모드
                사용자가 명시적으로 "Pencil 연결" 버튼 클릭 후 전환 */}
            {pencilModeEnabled && pencilStatus?.connected ? (
              <XTerminal
                agentId={agent.id}
                isRunning={isRunning}
                taskHint={task}
                onExit={() => { setIsRunning(false); setCurrentStage('done') }}
                onOutputCapture={(text) => setLastOutput(text)}
                className="h-64 shrink-0"
              />
            ) : (
              /* 기본 SSE 모드 + Pencil 연결 안내 바 */
              <div className="shrink-0 border-t border-border bg-[#111] px-4 py-3 flex items-center gap-3">
                {pencilModeEnabled ? (
                  <span className="text-[12px] text-red-400">✦ Antigravity 앱이 실행되지 않았거나 Pencil MCP 설치 필요</span>
                ) : (
                  <span className="text-[12px] text-muted">✦ HTML 생성 모드 — Pencil MCP로 전환하면 .pen 파일 직접 생성</span>
                )}
                {pencilStatus?.connected ? (
                  <button
                    onClick={() => setPencilModeEnabled(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
                  >
                    ✦ Pencil 연결 확인
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      fetch(`http://localhost:3001/api/agents/${agent.id}/pencil-status`)
                        .then(r => r.json()).then((s) => {
                          setPencilStatus(s)
                          if (s.connected) setPencilModeEnabled(true)
                          else alert('Antigravity 앱을 먼저 실행하세요.\n실행 후 이 버튼을 다시 눌러주세요.')
                        }).catch(() => {})
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-border text-muted hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    Pencil 연결 확인
                  </button>
                )}
                {pencilModeEnabled && (
                  <button
                    onClick={() => setPencilModeEnabled(false)}
                    className="text-[11px] text-muted hover:text-text"
                  >
                    HTML 모드로 돌아가기
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {center}
          </div>
        )}

        {/* RIGHT */}
        <div className={cn(
          'border-l border-border overflow-y-auto shrink-0 bg-surface/30',
          agent.role === 'design' ? 'w-52' : 'w-64',
        )}>
          {right}
        </div>
      </div>

      {/* ── 하단: 스트림 드로어 (Build 봇 제외) + 프롬프트 입력 ── */}
      <div className="shrink-0">
        {/* Build Bot은 XTerminal만 사용, Design Bot은 Pencil 연결 여부에 따라 분기 */}
        {agent.role !== 'build' && !(agent.role === 'design' && pencilModeEnabled && pencilStatus?.connected) && (
          <LiveStreamDrawer
            agentId={agent.id}
            task={task}
            isRunning={isRunning}
            onStageChange={setCurrentStage}
            onDone={handleDone}
            onError={() => { setIsRunning(false); setCurrentStage(null) }}
            onOutputChunk={(chunk) => setStreamOutput(prev => prev + chunk)}
            onScreenshot={(url) => setDesignScreenshot(url)}
            esRef={esRef}
          />
        )}

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

          {/* 무료 플랜 사용량 배지 — 테스트 중 비활성화 */}
          {/* {quota?.plan === 'free' && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              title="무료 플랜 사용량"
            >
              {quota.runCount}/{quota.limit} 실행
            </button>
          )} */}

          {/* Reset 버튼 — 항상 표시 */}
          <button
            onClick={handleReset}
            title="입력창과 결과를 모두 초기화합니다"
            className="flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm transition-colors shrink-0 text-muted hover:text-text hover:bg-surface border border-border"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          {/* 실행 중: 취소 버튼 / 대기 중: 실행 버튼 */}
          {isRunning ? (
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors shrink-0 bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"
            >
              <Square size={14} />
              취소
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!task.trim()}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors shrink-0',
                'bg-primary text-white hover:bg-primary-hover',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <Send size={14} />
              실행
            </button>
          )}
        </div>
      </div>
        </>
      )}

      {/* 무료 플랜 한도 초과 업그레이드 모달 */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🚀</div>
              <h2 className="text-xl font-bold text-text mb-2">무료 플랜 한도 초과</h2>
              <p className="text-sm text-muted leading-relaxed">
                이번 달 무료 실행 횟수 <span className="text-text font-medium">{quota?.limit}회</span>를 모두 사용했습니다.
                계속 사용하려면 플랜을 업그레이드하세요.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setShowUpgradeModal(false); navigate('/settings') }}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
              >
                업그레이드 — 월 ₩9,900부터
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-2.5 rounded-xl text-sm text-muted hover:text-text transition-colors"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
