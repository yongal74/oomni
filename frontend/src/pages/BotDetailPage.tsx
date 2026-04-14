import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, paymentsApi, type Agent, type HeartbeatRun } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Trash2, Settings, ArrowLeft, Send, Square, RotateCcw, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Copy, ExternalLink, X, Telescope, Code2, Palette, BookOpen, TrendingUp, Workflow, Plug, Crown, Bot } from 'lucide-react'
import { PipelineBar, ROLE_STAGES } from '../components/bot/PipelineBar'
import { LiveStreamDrawer } from '../components/bot/LiveStreamDrawer'
import { ModelSwitcher, getModelApiHeaders, type ModelId, type ModeId } from '../components/bot/ModelSwitcher'
import { XTerminal, type XTerminalRef } from '../components/bot/XTerminal'
import { ResearchLeftPanel, ResearchCenterPanel, ResearchRightPanel } from '../components/bot/panels/ResearchPanel'
import { BuildLeftPanel, BuildCenterPanel, BuildRightPanel } from '../components/bot/panels/BuildPanel'
import type { FileNode } from '../lib/api'
import { ContentLeftPanel, ContentCenterPanel, ContentRightPanel } from '../components/bot/panels/ContentPanel'
import { GrowthLeftPanel, GrowthCenterPanel, GrowthRightPanel } from '../components/bot/panels/GrowthPanel'
import { OpsLeftPanel, OpsCenterPanel, OpsRightPanel } from '../components/bot/panels/OpsPanel'
import { CeoLeftPanel, CeoCenterPanel, CeoRightPanel } from '../components/bot/panels/CeoPanel'
import { DesignCenterPanel, DesignRightPanel } from '../components/bot/panels/DesignPanel'
import { CommonLeftPanel, CommonCenterPanel, CommonRightPanel } from '../components/bot/panels/GenericPanel'
import { cn } from '../lib/utils'
import type { ResearchItem } from '../lib/api'

const BOT_ICONS_MAP: Record<string, React.ElementType> = {
  research: Telescope, build: Code2, design: Palette, content: BookOpen,
  growth: TrendingUp, ops: Workflow, integration: Plug, ceo: Crown,
}
function BotIcon({ role, size = 20 }: { role: string; size?: number }) {
  const Icon = BOT_ICONS_MAP[role] || Bot
  return <Icon size={size} />
}

const ROLE_LABEL: Record<string, string> = {
  research: 'Research', build: 'Build', design: 'Design', content: 'Content',
  growth: 'Growth', ops: 'Ops', integration: 'Integration', ceo: 'CEO',
}

const PLACEHOLDER: Record<string, string> = {
  research:    '"오늘 AI 트렌드 수집하고 신호강도 채점해줘"',
  content:     '"리서치 결과로 블로그 포스트 초안 작성해줘"',
  build:       '"Research Bot SSE 연결 버그 수정해줘"',
  growth:      '"이번 주 사용자 증가 분석하고 캠페인 추천해줘"',
  ops:         '"Slack 메시지 → 이슈 자동 생성 워크플로우 만들어줘"',
  ceo:         '"이번 주 전체 봇 현황 브리핑 작성해줘"',
  design:      '"다크 테마 랜딩 히어로 섹션 디자인해줘"',
  integration: '"GitHub 이슈 → Slack 알림 연결해줘"',
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

// Pencil 인앱 웹뷰 — URL 감지 후 iframe으로 인앱 표시
function PencilInAppView({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[#111] border-b border-[#222]">
        <span className="text-[11px] text-purple-400 font-medium">✦ Pencil — 인앱 미리보기</span>
        <span className="text-[10px] text-muted/60 font-mono flex-1 truncate">{url}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="p-1 text-muted hover:text-primary transition-colors"
          title="외부 브라우저에서 열기"
        >
          <ExternalLink size={11} />
        </a>
        <button
          onClick={onClose}
          className="p-1 text-muted hover:text-red-400 transition-colors"
          title="인앱 뷰 닫기"
        >
          <X size={11} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          src={url}
          className="w-full h-full border-0"
          title="Pencil Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  )
}

// ── 채팅 패널 — 사용자 입력 박스 + AI 응답 스트리밍 ──────────────────────────
interface ChatPair { userMsg: string; assistantMsg: string; ts: string }

function AntigravityRightPanel({
  task, setTask, isRunning, onRun, onCancel, onReset, placeholder,
  streamOutput, children,
  selectedModel, selectedMode, botRole, onModelChange, onModeChange,
}: {
  task: string
  setTask: (v: string) => void
  isRunning: boolean
  onRun: () => void
  onCancel: () => void
  onReset: () => void
  placeholder: string
  streamOutput: string
  children?: React.ReactNode
  selectedModel: ModelId
  selectedMode: ModeId
  botRole: string
  onModelChange: (m: ModelId) => void
  onModeChange: (m: ModeId) => void
}) {
  const [chatHistory, setChatHistory] = useState<ChatPair[]>([])
  const [pendingUserMsg, setPendingUserMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevIsRunningRef = useRef(false)
  const capturedTaskRef = useRef('')
  const streamOutputRef = useRef(streamOutput)

  // 항상 최신 streamOutput을 ref에 반영
  useEffect(() => { streamOutputRef.current = streamOutput }, [streamOutput])

  // 실행 시작/종료 감지 → 채팅 히스토리 관리
  useEffect(() => {
    const wasRunning = prevIsRunningRef.current
    prevIsRunningRef.current = isRunning

    if (isRunning && !wasRunning) {
      // 실행 시작: 사용자 메시지 캡처
      capturedTaskRef.current = task
      setPendingUserMsg(task)
    } else if (!isRunning && wasRunning) {
      // 실행 완료: 히스토리에 추가
      const userMsg = capturedTaskRef.current
      const assistantMsg = streamOutputRef.current
      if (userMsg) {
        setChatHistory(prev => [
          ...prev,
          {
            userMsg,
            assistantMsg: assistantMsg || '(결과 없음)',
            ts: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          },
        ])
      }
      capturedTaskRef.current = ''
      setPendingUserMsg('')
    }
  }, [isRunning]) // eslint-disable-line react-hooks/exhaustive-deps

  // 새 메시지 또는 스트리밍 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, streamOutput])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onRun() }
  }

  // 리셋: 히스토리도 함께 초기화
  const handleReset = () => {
    setChatHistory([])
    setPendingUserMsg('')
    capturedTaskRef.current = ''
    onReset()
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
          <div key={i} className="space-y-2">
            {/* 사용자 메시지 — 우측 박스 */}
            <div className="flex justify-end">
              <div className="max-w-[88%] bg-primary/12 border border-primary/25 rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[13px] text-text leading-relaxed whitespace-pre-wrap">
                {pair.userMsg}
              </div>
            </div>
            {/* AI 응답 — 전체 텍스트 */}
            <div className="pr-1 pl-0.5">
              <pre className="text-[13px] text-dim leading-[1.75] whitespace-pre-wrap font-sans break-words">
                {pair.assistantMsg}
              </pre>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-muted/40">{pair.ts}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(pair.assistantMsg)}
                  className="text-[10px] text-muted/40 hover:text-muted flex items-center gap-0.5 transition-colors"
                >
                  <Copy size={9} /> 복사
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* 현재 실행 중인 대화 쌍 */}
        {pendingUserMsg && (
          <div className="space-y-2">
            {/* 사용자 메시지 */}
            <div className="flex justify-end">
              <div className="max-w-[88%] bg-primary/12 border border-primary/25 rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[13px] text-text leading-relaxed whitespace-pre-wrap">
                {pendingUserMsg}
              </div>
            </div>
            {/* AI 스트리밍 응답 */}
            <div className="pr-1 pl-0.5">
              {streamOutput ? (
                <pre className="text-[13px] text-dim leading-[1.75] whitespace-pre-wrap font-sans break-words">
                  {streamOutput}
                  {isRunning && (
                    <span className="inline-block w-0.5 h-[1.1em] bg-primary ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </pre>
              ) : (
                <div className="flex items-center gap-1.5 py-1.5">
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
            disabled={isRunning}
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
            {isRunning ? (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"
              >
                <Square size={11} />
                취소
              </button>
            ) : (
              <button
                onClick={onRun}
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
}

// 유니파이드 터미널 레이아웃 — Research/Ops/Growth/CEO/Content용
// 좌측(2/3): 상단 센터콘텐츠 + 하단 XTerminal
// 우측(1/3): AntigravityRightPanel (+ 기존 우측 패널 스킬)
function UnifiedTerminalLayout({
  agentId, isRunning, task, setTask, onRun, onCancel, onReset,
  placeholder, streamOutput, termRef, onTerminalExit, onOutputCapture,
  centerContent, rightChildren, pencilUrl, onPencilClose,
  selectedModel, selectedMode, botRole, onModelChange, onModeChange,
}: {
  agentId: string
  isRunning: boolean
  task: string
  setTask: (v: string) => void
  onRun: () => void
  onCancel: () => void
  onReset: () => void
  placeholder: string
  streamOutput: string
  termRef: React.RefObject<XTerminalRef>
  onTerminalExit: () => void
  onOutputCapture: (text: string) => void
  centerContent: React.ReactNode
  rightChildren?: React.ReactNode
  pencilUrl?: string | null
  onPencilClose?: () => void
  selectedModel: ModelId
  selectedMode: ModeId
  botRole: string
  onModelChange: (m: ModelId) => void
  onModeChange: (m: ModeId) => void
}) {
  const leftArea = (
    <ResizableSplit
      initialTopPercent={50}
      minTopPx={100}
      minBottomPx={80}
      top={
        <div className="h-full flex flex-col overflow-hidden">
          {pencilUrl && (
            <div style={{ height: '45%', minHeight: 80, flexShrink: 0 }} className="overflow-hidden border-b border-border">
              <PencilInAppView url={pencilUrl} onClose={onPencilClose ?? (() => {})} />
            </div>
          )}
          <div className={pencilUrl ? 'flex-1 overflow-hidden' : 'h-full overflow-hidden'}>
            {centerContent}
          </div>
        </div>
      }
      bottom={
        <XTerminal
          ref={termRef}
          agentId={agentId}
          isRunning={isRunning}
          alwaysOn
          shellMode
          taskHint={task}
          onExit={onTerminalExit}
          onOutputCapture={onOutputCapture}
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
          task={task}
          setTask={setTask}
          isRunning={isRunning}
          onRun={onRun}
          onCancel={onCancel}
          onReset={onReset}
          placeholder={placeholder}
          streamOutput={streamOutput}
          selectedModel={selectedModel}
          selectedMode={selectedMode}
          botRole={botRole}
          onModelChange={onModelChange}
          onModeChange={onModeChange}
        >
          {rightChildren}
        </AntigravityRightPanel>
      }
    />
  )
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
  const [activeResearchTrack, setActiveResearchTrack] = useState<'business' | 'informational'>('business')

  // 모델 / 모드 선택 state
  const [selectedModel, setSelectedModel] = useState<ModelId>('claude-sonnet-4-6')
  const [selectedMode, setSelectedMode] = useState<ModeId>('default')

  // 이전 봇에서 전달된 pendingBotInput을 task 초기값으로 사용
  const [task, setTask] = useState(() => pendingBotInput ?? '')
  const [isRunning, setIsRunning] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedResearchItem, setSelectedResearchItem] = useState<ResearchItem | null>(null)
  const [contentType, setContentType] = useState('blog')
const [selectedBuildFile, setSelectedBuildFile] = useState<FileNode | null>(null)
  const [streamOutput, setStreamOutput] = useState('')
  const [lastOutput, setLastOutput] = useState('')  // 다음봇 전달용 최신 결과물
  const [designScreenshot, setDesignScreenshot] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const terminalRef = useRef<XTerminalRef>(null)       // Build Bot 터미널 주입
  const designTerminalRef = useRef<XTerminalRef>(null)  // Design Bot 터미널 주입
  const unifiedTerminalRef = useRef<XTerminalRef>(null) // Unified layout 터미널 ref
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [quota, setQuota] = useState<{ plan: string; runCount: number; limit: number; exceeded: boolean; remaining: number } | null>(null)
  const [pencilStatus, setPencilStatus] = useState<{ connected: boolean } | null>(null)
  // Pencil/localhost URL 감지 (터미널 출력에서 파싱 → 인앱 iframe 표시)
  const [pencilInAppUrl, setPencilInAppUrl] = useState<string | null>(null)

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

  // 터미널 출력에서 localhost URL 감지 → Pencil 인앱 뷰 자동 표시
  // Design봇 터미널과 Unified 터미널 모두 감지
  const handleUnifiedOutputCapture = useCallback((text: string) => {
    setLastOutput(text)
    // localhost:포트 URL 패턴 감지 (Pencil이 서빙하는 포트)
    const urlMatch = text.match(/https?:\/\/localhost:(\d{4,5})\b/)
    if (urlMatch) {
      const detectedUrl = urlMatch[0].trim()
      // 백엔드 API 포트 3001은 제외
      if (!detectedUrl.includes(':3001')) {
        setPencilInAppUrl(prev => prev ?? detectedUrl)
      }
    }
  }, [])

  const handleDesignOutputCapture = useCallback((text: string) => {
    setLastOutput(text)
    const urlMatch = text.match(/https?:\/\/localhost:(\d{4,5})\b/)
    if (urlMatch) {
      const detectedUrl = urlMatch[0].trim()
      if (!detectedUrl.includes(':3001')) {
        setPencilInAppUrl(prev => prev ?? detectedUrl)
      }
    }
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
    setPencilInAppUrl(null)
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

  // Unified Terminal Layout 적용 대상 역할
  const UNIFIED_ROLES = ['research', 'content', 'growth', 'ops', 'ceo']

  // 역할별 Left/Center/Right 패널
  const renderPanels = () => {
    if (showSettings) {
      return {
        left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
        center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CommonRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} />,
        isUnified: false,
      }
    }

    // ── Unified Terminal Layout (Research/Content/Growth/Ops/n8n/CEO) ──────────
    if (UNIFIED_ROLES.includes(agent.role)) {
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
          onTypeChange={(type) => { setContentType(type); setTask(`${type} 형식으로 콘텐츠 초안을 작성해줘`) }}
          onItemSelect={(item) => setTask(`"${item.title}" 리서치 내용을 ${contentType} 형식으로 변환해서 콘텐츠 초안을 작성해줘\n\n=== 리서치 원문 ===\n${item.content ?? item.summary ?? ''}`)}
        />
        if (role === 'growth') return <GrowthLeftPanel />
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
        if (role === 'ops') return <OpsCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />
        if (role === 'ceo') return <CeoCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />
        return null
      })()

      // 역할별 우측 패널 (AntigravityRightPanel 하단 children)
      const rightChildren: React.ReactNode = (() => {
        if (role === 'research') return <div className="p-3"><ResearchRightPanel
          item={selectedResearchItem}
          agentId={agent.id}
          activeTrack={activeResearchTrack}
          onSkillSelect={(s: string) => handleSkillRun(s)}
          onFileUpload={(content, filename) => setTask(`__track:${activeResearchTrack}__ 다음 파일(${filename}) 내용을 분석하고 리서치 인사이트를 추출해줘:\n\n${content}`)}
        /></div>
        if (role === 'content') return <div className="p-3"><ContentRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} currentRole="content" content={lastOutput} /></div>
        if (role === 'growth') return <div className="p-3"><GrowthRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} currentRole="growth" content={lastOutput} /></div>
        if (role === 'ops') return <div className="p-3"><OpsRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s: string) => setTask(s)} currentRole="ops" content={lastOutput} /></div>
        if (role === 'ceo') return <div className="p-3"><CeoRightPanel missionId={missionId ?? ''} agentId={agent.id} onSkillSelect={(s: string) => setTask(s)} currentRole="ceo" content={lastOutput} /></div>
        return null
      })()

      const unifiedCenter = (
        <UnifiedTerminalLayout
          agentId={agent.id}
          isRunning={isRunning}
          task={task}
          setTask={setTask}
          onRun={handleRun}
          onCancel={handleCancel}
          onReset={handleReset}
          placeholder={placeholder}
          streamOutput={streamOutput}
          termRef={unifiedTerminalRef}
          onTerminalExit={() => { setIsRunning(false); setCurrentStage('done') }}
          onOutputCapture={handleUnifiedOutputCapture}
          centerContent={centerContent}
          rightChildren={rightChildren}
          pencilUrl={pencilInAppUrl}
          onPencilClose={() => setPencilInAppUrl(null)}
          selectedModel={selectedModel}
          selectedMode={selectedMode}
          botRole={agent.role}
          onModelChange={setSelectedModel}
          onModeChange={setSelectedMode}
        />
      )

      return { left: leftPanel, center: unifiedCenter, right: null, isUnified: true }
    }

    // ── Build Bot — 기존 레이아웃 유지 ───────────────────────────────────────
    switch (agent.role) {
      case 'build': return {
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
            shellMode
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
        isUnified: false,
      }

      // ── Design Bot — 기존 레이아웃 + Pencil 인앱 URL 감지 추가 ─────────────
      case 'design': return {
        left: null,
        center: <ResizableSplit
          initialTopPercent={55}
          minTopPx={80}
          minBottomPx={80}
          top={
            <div className="h-full flex flex-col overflow-hidden">
              {/* Pencil 인앱 뷰 — URL 감지 시 상단 표시 */}
              {pencilInAppUrl && (
                <div style={{ height: '45%', minHeight: 80, flexShrink: 0 }} className="overflow-hidden border-b border-border">
                  <PencilInAppView url={pencilInAppUrl} onClose={() => setPencilInAppUrl(null)} />
                </div>
              )}
              {/* Pencil 툴바 */}
              <div className="shrink-0 border-b border-[#222] bg-[#111] px-3 py-1.5 flex items-center gap-2">
                <span className="text-[11px] text-muted">✦ Pencil 디자인 미리보기</span>
                <div className="flex-1" />
                {pencilStatus?.connected ? (
                  <button
                    onClick={() => designTerminalRef.current?.send('claude --dangerously-skip-permissions')}
                    className="text-[11px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
                  >
                    ✦ Pencil 강제 시작
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      fetch(`http://localhost:3001/api/agents/${agent.id}/pencil-status`)
                        .then(r => r.json()).then(setPencilStatus).catch(() => {})
                    }}
                    className="text-[11px] px-2 py-0.5 rounded bg-border text-muted hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    Pencil 연결 확인
                  </button>
                )}
              </div>
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
            shellMode
            taskHint={task}
            onExit={() => { setIsRunning(false); setCurrentStage('done') }}
            onOutputCapture={handleDesignOutputCapture}
            className="h-full"
          />}
        />,
        right: <DesignRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} onSkillSelect={(s) => designTerminalRef.current?.send(s)} currentRole="design" content={lastOutput} />,
        isUnified: false,
      }

      default: return {
        left: <CommonLeftPanel agent={agent} onUpdate={(d) => update.mutate(d as Partial<Agent>)} />,
        center: <CommonCenterPanel agentId={agent.id} streamOutput={streamOutput} isRunning={isRunning} />,
        right: <CommonRightPanel agentId={agent.id} nextBotName={nextBot?.name} onNextBot={handleNextBot} currentRole={agent.role} content={lastOutput} />,
        isUnified: false,
      }
    }
  }

  const { left, center, right, isUnified } = renderPanels()

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
              {agent.role === 'design' && pencilStatus !== null && (
                <button
                  onClick={() => {
                    if (!pencilStatus.connected) {
                      // alert 대신 연결 확인 재시도
                      fetch(`http://localhost:3001/api/agents/${id}/pencil-status`)
                        .then(r => r.json()).then(setPencilStatus).catch(() => {})
                    }
                  }}
                  className={cn(
                    'text-xs px-2 py-1 rounded-full font-medium transition-colors',
                    pencilStatus.connected
                      ? 'bg-purple-500/15 text-purple-400'
                      : 'bg-border text-muted hover:bg-yellow-500/10 hover:text-yellow-400'
                  )}
                  title={pencilStatus.connected ? 'Pencil MCP 연결 중' : 'Pencil.dev 앱을 실행하면 자동 연결됩니다'}
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
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — 좌측 사이드바 (Design Bot은 없음, Unified는 기존 left panel) */}
        {left && (
          <div className="border-r border-border overflow-y-auto shrink-0 bg-surface/30 w-56">
            {left}
          </div>
        )}

        {/* CENTER — Unified: UnifiedTerminalLayout이 우측 패널 포함 / 기존: center만 */}
        <div className="flex-1 overflow-hidden">
          {center}
        </div>

        {/* RIGHT — Unified 레이아웃은 right panel이 내부에 포함되어 있으므로 미표시 */}
        {!isUnified && right && (
          <div className="border-l border-border overflow-y-auto shrink-0 bg-surface/30 w-64">
            {right}
          </div>
        )}
      </div>

      {/* ── Unified 레이아웃용 숨겨진 SSE 스트리머 ── */}
      {isUnified && (
        <div className="hidden">
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
            modelId={selectedModel}
            apiKeys={getModelApiHeaders(selectedModel)}
          />
        </div>
      )}

      {/* ── 하단: 스트림 드로어 + 프롬프트 입력
           Unified 레이아웃(Research/Ops/Growth/CEO/Content/n8n)은
           AntigravityRightPanel 내부에 입력창이 있으므로 하단 바 불필요
           Build/Design은 터미널 사용 → 하단 바 불필요 ── */}
      {!isUnified && agent.role !== 'build' && agent.role !== 'design' && (
        <div className="shrink-0">
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
            modelId={selectedModel}
            apiKeys={getModelApiHeaders(selectedModel)}
          />

          <div className="flex flex-col gap-2 px-5 py-4 bg-surface border-t border-border">
            {/* 모델 스위처 — 입력창 위 좌측 */}
            <div className="flex items-center">
              <ModelSwitcher
                selectedModel={selectedModel}
                selectedMode={selectedMode}
                botRole={agent.role}
                onModelChange={setSelectedModel}
                onModeChange={setSelectedMode}
              />
            </div>
            <div className="flex items-end gap-3">
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
              onClick={handleReset}
              title="입력창과 결과를 모두 초기화합니다"
              className="flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm transition-colors shrink-0 text-muted hover:text-text hover:bg-surface border border-border"
            >
              <RotateCcw size={14} />
              Reset
            </button>

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
            </div>{/* flex items-end gap-3 닫기 */}
          </div>{/* flex flex-col gap-2 닫기 */}
        </div>
      )}
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
