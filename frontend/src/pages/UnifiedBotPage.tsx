import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, paymentsApi, type Agent, type HeartbeatRun } from '../lib/api'
import { useAppStore } from '../store/app.store'
import {
  Trash2, Settings, ArrowLeft, Send, Square, RotateCcw,
  Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Copy,
  Telescope, BookOpen, TrendingUp, Workflow, Crown, Bot, Palette,
} from 'lucide-react'
import { PipelineBar, ROLE_STAGES } from '../components/bot/PipelineBar'
import { ModelSwitcher, type ModelId, type ModeId } from '../components/bot/ModelSwitcher'
import { XTerminal, type XTerminalRef } from '../components/bot/XTerminal'
import { ResearchLeftPanel, ResearchCenterPanel, ResearchRightPanel } from '../components/bot/panels/ResearchPanel'
import { ContentLeftPanel, ContentCenterPanel, ContentRightPanel } from '../components/bot/panels/ContentPanel'
import { GrowthLeftPanel, GrowthCenterPanel, GrowthRightPanel } from '../components/bot/panels/GrowthPanel'
import { DesignLeftPanel, DesignCenterPanel, DesignRightPanel } from '../components/bot/panels/DesignPanel'
import { OpsLeftPanel, OpsCenterPanel, OpsRightPanel } from '../components/bot/panels/OpsPanel'
import { CeoLeftPanel, CeoCenterPanel, CeoRightPanel } from '../components/bot/panels/CeoPanel'
import { CommonLeftPanel, CommonCenterPanel } from '../components/bot/panels/GenericPanel'
import { cn } from '../lib/utils'
import type { ResearchItem } from '../lib/api'

const BOT_ICONS_MAP: Record<string, React.ElementType> = {
  research: Telescope, content: BookOpen,
  growth: TrendingUp, ops: Workflow, ceo: Crown, design: Palette,
}
function BotIcon({ role, size = 20 }: { role: string; size?: number }) {
  const Icon = BOT_ICONS_MAP[role] || Bot
  return <Icon size={size} />
}

const ROLE_LABEL: Record<string, string> = {
  research: 'Research', content: 'Content',
  growth: 'Growth', ops: 'Ops', ceo: 'CEO', design: 'Design',
}

const PLACEHOLDER: Record<string, string> = {
  research:    '"오늘 AI 트렌드 수집하고 신호강도 채점해줘"',
  content:     '"리서치 결과로 블로그 포스트 초안 작성해줘"',
  growth:      '"이번 주 사용자 증가 분석하고 캠페인 추천해줘"',
  ops:         '"Slack 메시지 → 이슈 자동 생성 워크플로우 만들어줘"',
  ceo:         '"이번 주 전체 봇 현황 브리핑 작성해줘"',
  design:      '"SaaS 랜딩 페이지 히어로 섹션 디자인해줘" 또는 PENCIL로 직접 디자인',
  default:     '봇에게 지시사항을 입력하세요...',
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

// 가로 분할 — 드래그로 좌/우 크기 조절
function ResizableHSplit({
  left, right, initialLeftPercent = 65, minLeftPx = 200, minRightPx = 220,
}: {
  left: React.ReactNode
  right: React.ReactNode
  initialLeftPercent?: number
  minLeftPx?: number
  minRightPx?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftPercent, setLeftPercent] = useState(initialLeftPercent)
  const dragging = useRef(false)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const container = containerRef.current
    if (!container) return
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !container) return
      const rect = container.getBoundingClientRect()
      const leftW = Math.max(minLeftPx, Math.min(rect.width - minRightPx, ev.clientX - rect.left))
      setLeftPercent((leftW / rect.width) * 100)
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
    <div ref={containerRef} className="flex flex-row h-full overflow-hidden">
      <div style={{ width: `${leftPercent}%` }} className="overflow-hidden min-w-0 h-full">
        {left}
      </div>
      <div
        onMouseDown={onMouseDown}
        className="w-1.5 bg-[#1a1a1a] hover:bg-primary/40 cursor-col-resize shrink-0 flex items-center justify-center select-none group h-full"
        title="드래그하여 크기 조절"
      >
        <div className="h-10 w-0.5 rounded-full bg-[#333] group-hover:bg-primary/60 transition-colors" />
      </div>
      <div style={{ width: `${100 - leftPercent}%` }} className="overflow-hidden min-w-0 h-full">
        {right}
      </div>
    </div>
  )
}


// ── 채팅 패널 — 자기완결형 (task 입력/스트리밍/히스토리 내부 관리) ───────────
interface ChatPair { userMsg: string; assistantMsg: string; ts: string; isError?: boolean }

export interface AntigravityRightPanelRef {
  runTask: (prompt: string) => void
}

const AntigravityRightPanel = forwardRef<AntigravityRightPanelRef, {
  agentId: string
  placeholder: string
  children?: React.ReactNode
  selectedModel: ModelId
  selectedMode: ModeId
  botRole: string
  onModelChange: (m: ModelId) => void
  onModeChange: (m: ModeId) => void
  onOutputCapture?: (text: string) => void
  onChatStart?: () => void
  onChatDone?: () => void
  onStageChange?: (stage: string) => void
}>(function AntigravityRightPanel(
  { agentId, placeholder, children, selectedModel, selectedMode, botRole, onModelChange, onModeChange, onOutputCapture, onChatStart, onChatDone, onStageChange },
  ref
) {
  const [task, setTask] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatPair[]>([])
  const [pendingUserMsg, setPendingUserMsg] = useState('')
  const [streamOutput, setStreamOutput] = useState('')
  const [isChatRunning, setIsChatRunning] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 새 메시지 또는 스트리밍 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, streamOutput])

  const handleRun = useCallback(async (userMsg?: string) => {
    const msgToSend = (userMsg ?? task).trim()
    if (!msgToSend || isChatRunning) return

    const token: string =
      sessionStorage.getItem('session_token') ??
      (await (window as unknown as { electronAPI?: { getInternalApiKey?: () => Promise<string> } }).electronAPI?.getInternalApiKey?.()) ??
      ''

    abortRef.current = new AbortController()
    setIsChatRunning(true)
    setPendingUserMsg(msgToSend)
    setStreamOutput('')
    setTask('')
    onChatStart?.()

    let accumulated = ''

    try {
      const response = await fetch(`http://localhost:3001/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ task: msgToSend, model: selectedModel }),
        signal: abortRef.current.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      // lineBuffer: HTTP 청크 경계에서 JSON 라인이 잘릴 경우를 대비해 불완전한 라인을 보관
      let lineBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        // 마지막 요소는 불완전한 라인일 수 있으므로 버퍼에 보관
        lineBuffer = lines.pop() ?? ''
        // 서버 에러 이벤트: throw를 루프 내 try-catch 밖에서 처리해야 묵살 방지
        let serverError: Error | null = null
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line) as { event: string; data: unknown }
            if (parsed.event === 'output') {
              const d = parsed.data as Record<string, unknown>
              const text = (d.chunk as string) || (d.text as string) || ''
              accumulated += text
              setStreamOutput(prev => prev + text)
              onOutputCapture?.(accumulated)
            } else if (parsed.event === 'stage') {
              const d = parsed.data as Record<string, unknown>
              if (typeof d.stage === 'string') onStageChange?.(d.stage)
            } else if (parsed.event === 'error') {
              const d = parsed.data as Record<string, unknown>
              // 루프 내 throw는 catch(parseErr)에 잡혀 묵살됨 — 반드시 루프 밖에서 throw
              serverError = new Error((d.message as string) || '실행 오류')
            }
          } catch {
            // JSON 파싱 실패만 무시 (불완전한 청크 경계)
          }
        }
        if (serverError) throw serverError
      }

      setChatHistory(prev => [...prev, {
        userMsg: msgToSend,
        assistantMsg: accumulated || '(결과 없음)',
        ts: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      }])
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        // 사용자 취소
        if (accumulated) {
          setChatHistory(prev => [...prev, {
            userMsg: msgToSend,
            assistantMsg: accumulated + '\n\n[취소됨]',
            ts: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          }])
        }
      } else {
        const errMsg = err instanceof Error ? err.message : String(err)
        setChatHistory(prev => [...prev, {
          userMsg: msgToSend,
          assistantMsg: `오류: ${errMsg}`,
          ts: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          isError: true,
        }])
      }
    } finally {
      setIsChatRunning(false)
      setPendingUserMsg('')
      setStreamOutput('')
      abortRef.current = null
      onChatDone?.()
    }
  }, [agentId, isChatRunning, selectedModel, task, onOutputCapture, onChatStart, onChatDone])

  useImperativeHandle(ref, () => ({
    runTask(prompt: string) {
      setTask(prompt)
      handleRun(prompt)
    },
  }), [handleRun])

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleReset = () => {
    handleCancel()
    setIsChatRunning(false)   // abort 전파 실패 대비 즉시 동기 복구
    setChatHistory([])
    setPendingUserMsg('')
    setStreamOutput('')
    setTask('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() }
  }

  const isEmpty = chatHistory.length === 0 && !pendingUserMsg

  return (
    <div className="h-full flex flex-col bg-surface/30 overflow-hidden">

      {/* ── 채팅 메시지 영역 ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 min-h-0">

        {/* 빈 상태 */}
        {isEmpty && (
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-muted/50 text-center leading-relaxed">
              지시사항을 입력하거나<br />우측 빠른 실행 버튼을 눌러보세요
            </p>
          </div>
        )}

        {/* 완료된 대화 쌍 */}
        {chatHistory.map((pair, i) => (
          <div key={i} className="space-y-1.5">
            {/* 사용자 메시지 — 전체 너비 박스 */}
            <div className="w-full bg-primary/8 border border-primary/20 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] text-primary/50 uppercase tracking-widest font-medium">나</span>
              </div>
              <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">{pair.userMsg}</p>
            </div>
            {/* AI 응답 — 전체 너비 박스 */}
            <div className="w-full bg-bg border border-border rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted/50 uppercase tracking-widest font-medium">AI</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted/30">{pair.ts}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(pair.assistantMsg)}
                    className="text-[9px] text-muted/40 hover:text-muted flex items-center gap-0.5 transition-colors"
                  >
                    <Copy size={9} /> 복사
                  </button>
                </div>
              </div>
              <pre className={cn(
                'text-[13px] leading-[1.75] whitespace-pre-wrap font-sans break-words',
                pair.isError ? 'text-red-400' : 'text-dim'
              )}>
                {pair.assistantMsg}
              </pre>
            </div>
          </div>
        ))}

        {/* 현재 실행 중인 대화 쌍 */}
        {pendingUserMsg && (
          <div className="space-y-1.5">
            {/* 사용자 메시지 */}
            <div className="w-full bg-primary/8 border border-primary/20 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] text-primary/50 uppercase tracking-widest font-medium">나</span>
              </div>
              <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">{pendingUserMsg}</p>
            </div>
            {/* AI 스트리밍 응답 */}
            <div className="w-full bg-bg border border-border rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] text-muted/50 uppercase tracking-widest font-medium">AI</span>
              </div>
              {streamOutput ? (
                <pre className="text-[13px] text-dim leading-[1.75] whitespace-pre-wrap font-sans break-words">
                  {streamOutput}
                  {isChatRunning && (
                    <span className="inline-block w-0.5 h-[1.1em] bg-primary ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </pre>
              ) : (
                <div className="flex items-center gap-1.5 py-1">
                  {[0, 1, 2].map(n => (
                    <span
                      key={n}
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${n * 0.12}s` }}
                    />
                  ))}
                  <span className="text-xs text-muted ml-1">실행 중...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── 스킬 빠른실행 버튼 (children) ───────────────────── */}
      {children && (
        <div className="shrink-0 border-t border-border overflow-y-auto max-h-40">
          {children}
        </div>
      )}

      {/* ── 입력창 — 하단 고정 ───────────────────────────────── */}
      <div className="shrink-0 px-3 py-3 border-t border-border bg-surface/50">
        <div className="flex flex-col gap-2">
          <textarea
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            disabled={isChatRunning}
            className={cn(
              'w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-muted/60',
              'focus:outline-none focus:border-primary/60 resize-none leading-relaxed',
              'transition-colors disabled:opacity-50 max-h-32 overflow-y-auto'
            )}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
          />
          <div className="flex items-center gap-1.5">
            <ModelSwitcher
              selectedModel={selectedModel}
              selectedMode={selectedMode}
              botRole={botRole}
              onModelChange={onModelChange}
              onModeChange={onModeChange}
            />
            <div className="flex-1" />
            <button
              onClick={handleReset}
              title="대화 초기화"
              className="p-1.5 rounded-lg text-xs transition-colors text-muted hover:text-text hover:bg-surface border border-border"
            >
              <RotateCcw size={12} />
            </button>
            {isChatRunning ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"
              >
                <Square size={11} />
                취소
              </button>
            ) : (
              <button
                onClick={() => handleRun()}
                disabled={!task.trim()}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                  'bg-primary text-white hover:bg-primary-hover',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                <Send size={11} />
                실행
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

// Unified Terminal Layout — Research/Content/Growth/Ops/CEO용
// 좌측(2/3): 상단 센터콘텐츠 + 하단 XTerminal
// 우측(1/3): AntigravityRightPanel (자기완결형, 내부에서 task/stream 관리)
function UnifiedTerminalLayout({
  agentId, placeholder, termRef, onTerminalExit,
  onChatOutputCapture,
  centerContent, rightChildren,
  selectedModel, selectedMode, botRole, onModelChange, onModeChange,
  rightPanelRef, onChatStart, onChatDone, onStageChange,
}: {
  agentId: string
  placeholder: string
  termRef: React.RefObject<XTerminalRef>
  onTerminalExit: () => void
  onChatOutputCapture: (text: string) => void
  centerContent: React.ReactNode
  rightChildren?: React.ReactNode
  selectedModel: ModelId
  selectedMode: ModeId
  botRole: string
  onModelChange: (m: ModelId) => void
  onModeChange: (m: ModeId) => void
  rightPanelRef?: React.RefObject<AntigravityRightPanelRef>
  onChatStart?: () => void
  onChatDone?: () => void
  onStageChange?: (stage: string) => void
}) {
  const leftArea = (
    <ResizableSplit
      initialTopPercent={50}
      minTopPx={100}
      minBottomPx={80}
      top={
        <div className="h-full overflow-hidden">
          {centerContent}
        </div>
      }
      bottom={
        <XTerminal
          ref={termRef}
          agentId={agentId}
          isRunning={false}
          alwaysOn
          shellMode
          onExit={onTerminalExit}
          className="h-full"
        />
      }
    />
  )

  return (
    <ResizableHSplit
      initialLeftPercent={66}
      minLeftPx={300}
      minRightPx={220}
      left={leftArea}
      right={
        <AntigravityRightPanel
          ref={rightPanelRef}
          agentId={agentId}
          placeholder={placeholder}
          selectedModel={selectedModel}
          selectedMode={selectedMode}
          botRole={botRole}
          onModelChange={onModelChange}
          onModeChange={onModeChange}
          onOutputCapture={onChatOutputCapture}
          onChatStart={onChatStart}
          onChatDone={onChatDone}
          onStageChange={onStageChange}
        >
          {rightChildren}
        </AntigravityRightPanel>
      }
    />
  )
}

export default function UnifiedBotPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { currentMission, agents: allAgents, pendingBotInput, setPendingBotInput } = useAppStore()
  const missionId = currentMission?.id

  const [activeTab, setActiveTab] = useState<'main' | 'history'>('main')
  const [historyLimit, setHistoryLimit] = useState(20)
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())
  const [activeResearchTrack, setActiveResearchTrack] = useState<'business' | 'informational'>('business')
  const [selectedDesignTemplate, setSelectedDesignTemplate] = useState('')

  // 모델 / 모드 선택 state
  const [selectedModel, setSelectedModel] = useState<ModelId>('claude-sonnet-4-6')
  const [selectedMode, setSelectedMode] = useState<ModeId>('default')

  const [isRunning, setIsRunning] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedResearchItem, setSelectedResearchItem] = useState<ResearchItem | null>(null)
  const [contentType, setContentType] = useState('blog')
  const [streamOutput, setStreamOutput] = useState('')
  const [lastOutput, setLastOutput] = useState('')  // 다음봇 전달용 최신 결과물
  const esRef = useRef<EventSource | null>(null)
  const unifiedTerminalRef = useRef<XTerminalRef>(null)
  const unifiedRightPanelRef = useRef<AntigravityRightPanelRef>(null)
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

  // 채팅(AntigravityRightPanel) 출력 캡처 — streamOutput + lastOutput 업데이트
  const handleChatOutputCapture = useCallback((text: string) => {
    setLastOutput(text)
    setStreamOutput(text)
  }, [])

  // ?autorun= URL 파라미터 처리 — 대시보드 프리셋 클릭 시 자동 실행
  useEffect(() => {
    const autorun = searchParams.get('autorun')
    if (!autorun || !agent || isRunning) return
    const decoded = decodeURIComponent(autorun)
    setSearchParams({}, { replace: true }) // URL에서 파라미터 제거
    // 상태 업데이트 후 실행 — requestAnimationFrame으로 다음 렌더 사이클에 실행
    requestAnimationFrame(() => {
      const stages = ROLE_STAGES[agent.role] ?? ROLE_STAGES.default
      setCurrentStage(stages[0].key)
      setStreamOutput('')
      setIsRunning(true)
      unifiedRightPanelRef.current?.runTask(decoded)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent])

  const handleSkillRun = (prompt: string) => {
    unifiedRightPanelRef.current?.runTask(prompt)
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
    setStreamOutput('')
    setLastOutput('')
    setCurrentStage(null)
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

  // 역할별 Left/Center 패널 (Unified 전용)
  const renderUnifiedPanels = () => {
    if (showSettings) {
      return {
        left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
        center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        isUnified: false,
      }
    }

    const role = agent.role as string

    // 역할별 좌측 사이드바
    const leftPanel: React.ReactNode | null = (() => {
      if (role === 'research') return <ResearchLeftPanel
        missionId={missionId ?? ''}
        activeTrack={activeResearchTrack}
        onTrackChange={setActiveResearchTrack}
        onRunWithTrack={(_track: string, prompt: string) => handleSkillRun(prompt)}
      />
      if (role === 'content') return <ContentLeftPanel
        missionId={missionId ?? ''}
        selectedType={contentType}
        onTypeChange={(type) => { setContentType(type); handleSkillRun(`${type} 형식으로 콘텐츠 초안을 작성해줘`) }}
        onItemSelect={(item) => handleSkillRun(`"${item.title}" 리서치 내용을 ${contentType} 형식으로 변환해서 콘텐츠 초안을 작성해줘\n\n=== 리서치 원문 ===\n${item.content ?? item.summary ?? ''}`)}
      />
      if (role === 'growth') return <GrowthLeftPanel />
      if (role === 'design') return <DesignLeftPanel
        selectedTemplate={selectedDesignTemplate}
        onTemplateChange={setSelectedDesignTemplate}
        onApplyTemplate={(prompt: string) => handleSkillRun(prompt)}
      />
      if (role === 'ops') return <OpsLeftPanel agentId={agent.id} onSkillSelect={(s) => unifiedTerminalRef.current?.send(s)} />
      if (role === 'ceo') return <CeoLeftPanel missionId={missionId ?? ''} />
      return null
    })()

    // 역할별 센터 콘텐츠 (상단 결과 영역)
    const centerContent: React.ReactNode = (() => {
      if (role === 'research') return <ResearchCenterPanel
        missionId={missionId ?? ''}
        onItemClick={setSelectedResearchItem}
        streamOutput={streamOutput}
        isRunning={isRunning}
        activeTrack={activeResearchTrack}
      />
      if (role === 'content') return <ContentCenterPanel agentId={agent.id} selectedType={contentType} streamOutput={streamOutput} isRunning={isRunning} />
      if (role === 'growth') return <GrowthCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />
      if (role === 'design') return <DesignCenterPanel
        agentId={agent.id}
        streamOutput={streamOutput}
        isRunning={isRunning}
      />
      if (role === 'ops') return <OpsCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />
      if (role === 'ceo') return <CeoCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />
      return null
    })()

    // 역할별 우측 패널 (AntigravityRightPanel 하단 children)
    const rightChildren: React.ReactNode = (() => {
      if (role === 'research') return <div className="p-3"><ResearchRightPanel
        item={selectedResearchItem}
        agentId={agent.id}
        missionId={missionId ?? ''}
        activeTrack={activeResearchTrack}
        onSkillSelect={(s: string) => handleSkillRun(s)}
        onFileUpload={(content, filename) => handleSkillRun(`__track:${activeResearchTrack}__ 다음 파일(${filename}) 내용을 분석하고 리서치 인사이트를 추출해줘:\n\n${content}`)}
      /></div>
      if (role === 'content') return <div className="p-3"><ContentRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={handleSkillRun} currentRole="content" content={lastOutput} /></div>
      if (role === 'growth') return <div className="p-3"><GrowthRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={handleSkillRun} currentRole="growth" content={lastOutput} /></div>
      if (role === 'design') return <div className="p-3"><DesignRightPanel
        agentId={agent.id}
        onSkillSelect={handleSkillRun}
        currentRole="design"
        content={lastOutput}
      /></div>
      if (role === 'ops') return <div className="p-3"><OpsRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={handleSkillRun} currentRole="ops" content={lastOutput} /></div>
      if (role === 'ceo') return <div className="p-3"><CeoRightPanel missionId={missionId ?? ''} agentId={agent.id} onSkillSelect={handleSkillRun} currentRole="ceo" content={lastOutput} /></div>
      return null
    })()

    const unifiedCenter = (
      <UnifiedTerminalLayout
        agentId={agent.id}
        placeholder={placeholder}
        termRef={unifiedTerminalRef}
        onTerminalExit={() => { setIsRunning(false); setCurrentStage('done') }}
        onChatOutputCapture={handleChatOutputCapture}
        centerContent={centerContent}
        rightChildren={rightChildren}
        selectedModel={selectedModel}
        selectedMode={selectedMode}
        botRole={agent.role}
        onModelChange={setSelectedModel}
        onModeChange={setSelectedMode}
        rightPanelRef={unifiedRightPanelRef}
        onChatStart={() => {
          const s = ROLE_STAGES[agent?.role ?? 'default'] ?? ROLE_STAGES.default
          setIsRunning(true)
          setStreamOutput('')
          setCurrentStage(s[0].key)
        }}
        onChatDone={() => {
          setIsRunning(false)
          setCurrentStage(agent?.role === 'research' ? 'sorting' : 'done')
          if (streamOutput) setLastOutput(streamOutput)
          qc.invalidateQueries({ queryKey: ['bot-feed', id] })
          qc.invalidateQueries({ queryKey: ['research', missionId] })
          qc.invalidateQueries({ queryKey: ['issues', missionId] })
        }}
        onStageChange={setCurrentStage}
      />
    )

    return { left: leftPanel, center: unifiedCenter, isUnified: true }
  }

  const { left, center } = renderUnifiedPanels()

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
            {/* LEFT — 좌측 사이드바 */}
            {left && (
              <div className="border-r border-border overflow-y-auto shrink-0 bg-surface/30 w-56">
                {left}
              </div>
            )}

            {/* CENTER — UnifiedTerminalLayout이 우측 패널 포함 */}
            <div className="flex-1 overflow-hidden">
              {center}
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
