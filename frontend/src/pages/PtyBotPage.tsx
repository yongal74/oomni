import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, paymentsApi, type Agent, type HeartbeatRun } from '../lib/api'
import { useAppStore } from '../store/app.store'
import {
  Trash2, Settings, ArrowLeft, RotateCcw,
  Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Copy,
  Code2, Palette, Workflow, Bot,
} from 'lucide-react'
import { PipelineBar, ROLE_STAGES } from '../components/bot/PipelineBar'
import { XTerminal, type XTerminalRef } from '../components/bot/XTerminal'
import { BuildLeftPanel, BuildCenterPanel, BuildRightPanel } from '../components/bot/panels/BuildPanel'
import type { FileNode } from '../lib/api'
import { OpsLeftPanel, OpsRightPanel } from '../components/bot/panels/OpsPanel'
import { DesignCenterPanel, DesignRightPanel } from '../components/bot/panels/DesignPanel'
import { CommonLeftPanel, CommonCenterPanel, CommonRightPanel } from '../components/bot/panels/GenericPanel'
import { cn } from '../lib/utils'

const BOT_ICONS_MAP: Record<string, React.ElementType> = {
  build: Code2, design: Palette, ops: Workflow,
  project_setup: Bot, env: Bot, security_audit: Bot,
  frontend: Code2, backend: Workflow, infra: Bot,
}
function BotIcon({ role, size = 20 }: { role: string; size?: number }) {
  const Icon = BOT_ICONS_MAP[role] || Bot
  return <Icon size={size} />
}

const ROLE_LABEL: Record<string, string> = {
  build: 'Build', design: 'Design', ops: 'Ops',
  project_setup: 'ProjectSetup', env: 'Env', security_audit: 'SecurityAudit',
  frontend: 'Frontend', backend: 'Backend', infra: 'Infra',
}


// 세로 분할 — 드래그로 위/아래 크기 조절
function ResizableSplit({
  top, bottom, initialTopPercent = 50, minTopPx = 80, minBottomPx = 60,
}: {
  top: React.ReactNode
  bottom: React.ReactNode
  initialTopPercent?: number
  minTopPx?: number
  minBottomPx?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [topPercent, setTopPercent] = useState(initialTopPercent)
  const dragging = useRef(false)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const container = containerRef.current
    if (!container) return
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !container) return
      const rect = container.getBoundingClientRect()
      const topH = Math.max(minTopPx, Math.min(rect.height - minBottomPx, ev.clientY - rect.top))
      setTopPercent((topH / rect.height) * 100)
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      <div style={{ height: `${topPercent}%` }} className="overflow-hidden min-h-0">
        {top}
      </div>
      <div
        onMouseDown={onMouseDown}
        className="h-1.5 bg-[#1a1a1a] hover:bg-primary/40 cursor-row-resize shrink-0 flex items-center justify-center select-none group"
        title="드래그하여 크기 조절"
      >
        <div className="w-10 h-0.5 rounded-full bg-[#333] group-hover:bg-primary/60 transition-colors" />
      </div>
      <div style={{ height: `${100 - topPercent}%` }} className="overflow-hidden min-h-0">
        {bottom}
      </div>
    </div>
  )
}


export default function PtyBotPage() {
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
  const [selectedBuildFile, setSelectedBuildFile] = useState<FileNode | null>(null)
  const [streamOutput, setStreamOutput] = useState('')
  const [lastOutput, setLastOutput] = useState('')  // 다음봇 전달용 최신 결과물
  const [designScreenshot, setDesignScreenshot] = useState<string | null>(null)
  const terminalRef = useRef<XTerminalRef>(null)       // Build Bot 터미널 주입
  const designTerminalRef = useRef<XTerminalRef>(null)  // Design Bot 터미널 주입
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [quota, setQuota] = useState<{ plan: string; runCount: number; limit: number; exceeded: boolean; remaining: number } | null>(null)

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

  // Design봇 터미널 출력 캡처
  const handleDesignOutputCapture = useCallback((text: string) => {
    setLastOutput(text)
    setStreamOutput(text)   // PTY 출력 → DesignCenterPanel 실시간 HTML 프리뷰 전달
  }, [])

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

  // 결과/대화 초기화
  const handleReset = () => {
    setTask('')
    setStreamOutput('')
    setLastOutput('')
    setCurrentStage(null)
    setDesignScreenshot(null)
    qc.invalidateQueries({ queryKey: ['bot-feed', id] })
  }

  const handleNextBot = () => {
    if (!nextBot) return
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

  // 역할별 패널 (PTY 봇 전용)
  const renderPanels = () => {
    if (showSettings) {
      return {
        left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
        center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CommonRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} />,
      }
    }

    // ── Build Bot ───────────────────────────────────────────────────────────
    if (agent.role === 'build') {
      return {
        left: <BuildLeftPanel
          agentId={agent.id}
          selectedFilePath={selectedBuildFile?.path ?? null}
          onFileSelect={setSelectedBuildFile}
        />,
        center: <ResizableSplit
          initialTopPercent={45}
          minTopPx={100}
          minBottomPx={80}
          top={<BuildCenterPanel
            agentId={agent.id}
            selectedFile={selectedBuildFile}
            isRunning={isRunning}
            streamContent={streamOutput}
          />}
          bottom={<XTerminal
            ref={terminalRef}
            agentId={agent.id}
            isRunning={isRunning}
            alwaysOn
            taskHint={task}
            onExit={() => { setIsRunning(false); setCurrentStage('done') }}
            onOutputCapture={(text) => setLastOutput(text)}
            className="h-full"
          />}
        />,
        right: <BuildRightPanel
          agentId={agent.id}
          nextBotName={nextBot?.name}
          onNextBot={handleNextBot}
          onSkillSelect={(skill: string) => terminalRef.current?.send(skill)}
          currentRole="build"
          content={lastOutput}
        />,
      }
    }

    // ── Design Bot ──────────────────────────────────────────────────────────
    if (agent.role === 'design') {
      return {
        left: null,
        center: <ResizableSplit
          initialTopPercent={55}
          minTopPx={80}
          minBottomPx={80}
          top={
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <DesignCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} screenshotUrl={designScreenshot} />
              </div>
            </div>
          }
          bottom={<XTerminal
            ref={designTerminalRef}
            agentId={agent.id}
            isRunning={isRunning}
            alwaysOn
            role={agent.role}
            taskHint={task}
            onExit={() => { setIsRunning(false); setCurrentStage('done') }}
            onOutputCapture={handleDesignOutputCapture}
            className="h-full"
          />}
        />,
        right: <DesignRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s) => designTerminalRef.current?.send(s)} currentRole="design" content={lastOutput} />,
      }
    }

    // ── Ops Bot (PTY terminal variant) ──────────────────────────────────────
    if (agent.role === 'ops') {
      return {
        left: <OpsLeftPanel agentId={agent.id} onSkillSelect={(s) => terminalRef.current?.send(s)} />,
        center: <XTerminal
          ref={terminalRef}
          agentId={agent.id}
          isRunning={isRunning}
          alwaysOn
          taskHint={task}
          onExit={() => { setIsRunning(false); setCurrentStage('done') }}
          onOutputCapture={(text) => setLastOutput(text)}
          className="h-full"
        />,
        right: <OpsRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s) => terminalRef.current?.send(s)} currentRole="ops" content={lastOutput} />,
      }
    }

    // fallback
    return {
      left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
      center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
      right: <CommonRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} currentRole={agent.role} content={lastOutput} />,
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
          <span className="text-muted"><BotIcon role={agent.role} size={22} /></span>
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
            <div className="text-sm text-muted mt-0.5">{ROLE_LABEL[agent.role] ?? agent.role} Bot</div>
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
            onClick={handleReset}
            title="결과 초기화"
            className="p-2 text-muted hover:text-text transition-colors rounded-lg"
          >
            <RotateCcw size={15} />
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
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT — 좌측 사이드바 (Design Bot은 없음) */}
            {left && (
              <div className="border-r border-border overflow-y-auto shrink-0 bg-surface/30 w-56">
                {left}
              </div>
            )}

            {/* CENTER */}
            <div className="flex-1 overflow-hidden">
              {center}
            </div>

            {/* RIGHT */}
            {right && (
              <div className="border-l border-border overflow-y-auto shrink-0 bg-surface/30 w-64">
                {right}
              </div>
            )}
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
