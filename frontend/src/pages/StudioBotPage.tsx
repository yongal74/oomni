/**
 * StudioBotPage.tsx — Design + Build 통합 스튜디오
 * 2-패널 (Left: 카테고리, Center: 결과) + 플로팅 채팅 (Cursor 스타일)
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Palette, Code2, Layers, Monitor, Image, Sparkles,
  FileCode2, Settings2, GitBranch, Shield, Database,
  Send, Paperclip, ChevronDown, Minimize2, Maximize2,
  Loader2, Copy, Download, RotateCcw, Bot, ExternalLink,
  Instagram, Youtube, Music2, Layout, PenTool,
  Play, Square, RefreshCw, AlertCircle,
} from 'lucide-react'
import { agentsApi, type Agent } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { cn } from '../lib/utils'
import { BACKEND_URL } from '../config'

// ── 모드 정의 ──────────────────────────────────────────────────────────────────
type StudioMode = 'ui-proto' | 'graphic' | 'build' | 'open-design'

const OPEN_DESIGN_PORT = 7456

const MODES: { key: StudioMode; label: string; icon: React.ElementType; role: string }[] = [
  { key: 'ui-proto',     label: 'UI 프로토타입', icon: Monitor,  role: 'design' },
  { key: 'graphic',      label: '그래픽 디자인', icon: Image,    role: 'design' },
  { key: 'build',        label: '빌드',          icon: Code2,    role: 'build'  },
  { key: 'open-design',  label: 'Open Design',   icon: PenTool,  role: 'design' },
]

// ── 디자인 카테고리 (UI 프로토타입 모드용) ─────────────────────────────────────
const DESIGN_CATS = [
  { icon: Monitor,   label: 'UI 프로토타입',  prompt: 'React + Tailwind UI 프로토타입을 만들어줘. ' },
  { icon: Image,     label: '랜딩 페이지',    prompt: '제품 랜딩 페이지를 디자인해줘. ' },
  { icon: Layers,    label: '대시보드',       prompt: '데이터 대시보드 UI를 만들어줘. ' },
  { icon: Palette,   label: '컴포넌트',       prompt: 'UI 컴포넌트 라이브러리를 만들어줘. ' },
  { icon: Sparkles,  label: '마케팅 배너',    prompt: 'SNS 마케팅용 배너 디자인을 만들어줘. ' },
  { icon: FileCode2, label: '이메일 템플릿',  prompt: 'HTML 이메일 템플릿을 만들어줘. ' },
]

// ── 그래픽 카테고리 (채널 매핑 포함) ─────────────────────────────────────────
const GRAPHIC_CATS = [
  { icon: Instagram, label: '인스타 카드뉴스',  prompt: '인스타그램 카드뉴스 ',   channel: 'instagram' },
  { icon: Youtube,   label: 'YouTube 썸네일',   prompt: 'YouTube 썸네일 이미지 ',  channel: 'youtube'   },
  { icon: Music2,    label: 'TikTok 커버',       prompt: 'TikTok 세로형 커버 ',     channel: 'tiktok'    },
  { icon: Layout,    label: '마케팅 배너',        prompt: '마케팅 배너 이미지 ',     channel: 'banner'    },
  { icon: Sparkles,  label: '피치덱 슬라이드',   prompt: '피치덱 슬라이드 커버 ',   channel: 'pitch'     },
  { icon: Image,     label: '브랜드 비주얼',      prompt: '브랜드 아이덴티티 이미지 ', channel: 'banner'  },
]

// ── 빌드 카테고리 ─────────────────────────────────────────────────────────────
const BUILD_CATS = [
  { icon: Code2,      label: '전체',          prompt: '' },
  { icon: Monitor,    label: '프론트엔드',     prompt: '프론트엔드 코드를 작성해줘. React + TypeScript + Tailwind. ' },
  { icon: Database,   label: '백엔드',         prompt: '백엔드 API를 구현해줘. Node.js + Express + TypeScript. ' },
  { icon: Settings2,  label: '초기 세팅',      prompt: '프로젝트 초기 세팅을 해줘. ' },
  { icon: GitBranch,  label: '아키텍처',       prompt: '시스템 아키텍처를 설계해줘. ERD, WBS, ADR 포함. ' },
  { icon: Shield,     label: '보안 감사',      prompt: 'OWASP Top 10 기준으로 보안 감사를 실행해줘. ' },
  { icon: Settings2,  label: '환경 세팅',      prompt: '환경변수와 설정 파일을 세팅해줘. ' },
  { icon: Layers,     label: '부트스트랩',     prompt: '프로젝트 부트스트랩 스크립트를 생성해줘. ' },
]

// ── HTML 추출 ──────────────────────────────────────────────────────────────────
function extractHtml(text: string): string {
  const m = text.match(/```html\s*([\s\S]*?)```/i) ?? text.match(/<(!DOCTYPE|html)[^>]*>([\s\S]*)<\/html>/i)
  if (m) return m[1] ?? m[0]
  if (text.includes('<html') || text.includes('<!DOCTYPE')) return text
  return ''
}

// ── 코드 파일 파서 ────────────────────────────────────────────────────────────
interface CodeFile { path: string; language: string; code: string }

function parseCodeFiles(text: string): CodeFile[] {
  const files: CodeFile[] = []
  // 패턴: ```lang\n// path/to/file.ext\n...code...```
  const re = /```(\w+)\s*\n\/\/\s*([^\n]+)\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const language = m[1].toLowerCase()
    const filePath = m[2].trim()
    const code = m[3].trimEnd()
    if (filePath && code) files.push({ path: filePath, language, code })
  }
  return files
}

// ── VS Code 테마 ──────────────────────────────────────────────────────────────
const VS_THEMES = [
  { id: 'dark',     label: 'Dark+',     bg: '#0d0d0f', text: '#d4d4d4', line: '#444' },
  { id: 'onedark',  label: 'One Dark',  bg: '#282c34', text: '#abb2bf', line: '#3e4451' },
  { id: 'dracula',  label: 'Dracula',   bg: '#282a36', text: '#f8f8f2', line: '#44475a' },
  { id: 'monokai',  label: 'Monokai',   bg: '#272822', text: '#f8f8f2', line: '#3e3d32' },
  { id: 'light',    label: 'Light',     bg: '#ffffff', text: '#24292e', line: '#e1e4e8' },
]

// ── VS Code 스타일 코드 뷰어 ─────────────────────────────────────────────────
function VsCodeViewer({ text, isRunning }: { text: string; isRunning: boolean }) {
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [themeId, setThemeId] = useState('dark')
  const files = parseCodeFiles(text)
  const theme = VS_THEMES.find(t => t.id === themeId) ?? VS_THEMES[0]

  useEffect(() => {
    if (files.length > 0 && !activeFile) setActiveFile(files[0].path)
  }, [files.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = files.find(f => f.path === activeFile) ?? files[0]
  const lines = current?.code.split('\n') ?? []

  if (!text && !isRunning) return null

  return (
    <div className="h-full flex flex-col font-mono text-[15px]" style={{ background: theme.bg }}>
      {/* 파일 탭 바 + 테마 선택 */}
      <div className="flex items-center border-b shrink-0 overflow-x-auto" style={{ borderColor: theme.line, background: theme.bg }}>
        {files.map(f => {
          const name = f.path.split('/').pop() ?? f.path
          return (
            <button
              key={f.path}
              onClick={() => setActiveFile(f.path)}
              title={f.path}
              style={{
                borderColor: theme.line,
                color: activeFile === f.path ? theme.text : '#666',
                background: activeFile === f.path ? theme.bg : 'transparent',
                borderTop: activeFile === f.path ? '2px solid #f97316' : '2px solid transparent',
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[14px] border-r whitespace-nowrap transition-colors shrink-0 hover:opacity-80"
            >
              <FileCode2 size={13} className="shrink-0 text-orange-400/70" />
              {name}
            </button>
          )
        })}
        <div className="ml-auto flex items-center px-2 gap-1 shrink-0">
          {VS_THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              title={t.label}
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded transition-colors',
                themeId === t.id ? 'opacity-100 font-bold' : 'opacity-40 hover:opacity-70'
              )}
              style={{ color: theme.text }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 파일 경로 + 액션 */}
      {current && (
        <div className="flex items-center gap-2 px-3 py-1 border-b text-[13px] shrink-0"
          style={{ borderColor: theme.line, color: '#666' }}>
          <span className="flex-1 truncate">{current.path}</span>
          <button onClick={() => navigator.clipboard.writeText(current.code)}
            className="flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Copy size={12} />복사
          </button>
          <button onClick={() => {
            const blob = new Blob([current.code], { type: 'text/plain' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = current.path.split('/').pop() ?? 'file.ts'
            a.click()
          }} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Download size={12} />저장
          </button>
        </div>
      )}

      {/* 코드 영역 */}
      <div className="flex-1 overflow-auto">
        {current ? (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={{ color: theme.text }} className="hover:bg-white/[0.02]">
                  <td className="select-none text-right pr-3 pl-3 w-10 shrink-0 align-top leading-5 opacity-40">{i + 1}</td>
                  <td className="pr-4 leading-5 whitespace-pre">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : isRunning ? (
          <div className="p-4" style={{ color: '#555' }}>
            <pre className="whitespace-pre-wrap text-[14px] leading-relaxed">{text}</pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── 채팅 버블 ─────────────────────────────────────────────────────────────────
interface Msg { role: 'user' | 'assistant'; content: string; id: string }

function ChatBubble({ msg }: { msg: Msg }) {
  return (
    <div className={cn('flex gap-2 mb-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'max-w-[85%] px-3 py-2 rounded-xl text-[15px] leading-relaxed whitespace-pre-wrap',
        msg.role === 'user'
          ? 'bg-primary/20 border border-primary/30 text-text'
          : 'bg-surface border border-border text-dim'
      )}>
        {msg.content}
      </div>
    </div>
  )
}

// ── Open Design 인앱 임베드 (Electron webview) ─────────────────────────────────
function OpenDesignWebview({ port, onStop }: { port: number; onStop: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wv = document.createElement('webview') as any
    wv.src = `http://localhost:${port}`
    wv.style.cssText = 'width:100%;height:100%;border:none;display:block;'
    el.appendChild(wv)
    return () => { try { el.removeChild(wv) } catch { /* ignore */ } }
  }, [port])

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={onStop}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2.5 py-1.5 text-[13px] bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
      >
        종료
      </button>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function StudioBotPage() {
  const { currentMission } = useAppStore()
  const [mode, setMode] = useState<StudioMode>('ui-proto')
  const [iframeHtml, setIframeHtml] = useState('')
  const [streamOutput, setStreamOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  // 그래픽 모드 전용 상태
  interface GraphicResult { url: string; prompt: string; userPrompt: string; channel: string }
  const [graphicResults, setGraphicResults] = useState<GraphicResult[]>([])
  const [graphicStatus, setGraphicStatus] = useState('')
  const [graphicChannel, setGraphicChannel] = useState('banner')

  // 화면 설정
  const [fontSize, setFontSize] = useState(13)
  const [bgColor, setBgColor] = useState('')

  // 플로팅 채팅 상태
  const [chatOpen, setChatOpen] = useState(true)
  const [chatExpanded, setChatExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [catPrompt, setCatPrompt] = useState('')

  // Open Design 데몬 상태
  type OdStatus = 'idle' | 'checking' | 'starting' | 'running' | 'error'
  const [odStatus, setOdStatus]     = useState<OdStatus>('idle')
  const [odError, setOdError]       = useState('')

  const checkOdStatus = useCallback(async () => {
    setOdStatus('checking')
    try {
      const r = await fetch(`${BACKEND_URL}/api/setup/open-design/status`)
      const d = await r.json() as { running: boolean }
      setOdStatus(d.running ? 'running' : 'idle')
    } catch {
      setOdStatus('idle')
    }
  }, [])

  const startOd = useCallback(async () => {
    setOdStatus('starting')
    setOdError('')
    try {
      const r = await fetch(`${BACKEND_URL}/api/setup/open-design/start`, { method: 'POST' })
      const d = await r.json() as { success: boolean; status?: string; error?: string }
      if (d.success || d.status === 'already_running') {
        setOdStatus('running')
      } else {
        setOdStatus('error')
        setOdError(d.error ?? '서버 시작 실패')
      }
    } catch {
      setOdStatus('error')
      setOdError('백엔드 연결 실패')
    }
  }, [])

  const stopOd = useCallback(async () => {
    await fetch(`${BACKEND_URL}/api/setup/open-design/stop`, { method: 'POST' })
    setOdStatus('idle')
  }, [])

  useEffect(() => {
    if (mode === 'open-design') checkOdStatus()
  }, [mode, checkOdStatus])

  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 현재 모드에 맞는 에이전트 찾기
  const currentRole = MODES.find(m => m.key === mode)?.role ?? 'design'
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', currentMission?.id],
    queryFn: () => currentMission ? agentsApi.list(currentMission.id) : Promise.resolve([]),
    enabled: !!currentMission,
  })
  const activeAgent = agents.find(a => a.role === currentRole)

  // v0 / Ideogram API 키 설정 여부
  const { data: studioStatus } = useQuery({
    queryKey: ['studio-status'],
    queryFn: () => fetch(`${BACKEND_URL}/api/studio/status`).then(r => r.json()) as Promise<{ v0_key_set: boolean; ideogram_key_set: boolean }>,
    staleTime: 60_000,
  })
  const v0KeySet       = !!studioStatus?.v0_key_set
  const ideogramKeySet = !!studioStatus?.ideogram_key_set

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isRunning) return

    // graphic 모드: /api/studio/graphic-generate (에이전트 불필요)
    // ui-proto 모드: /api/studio/v0-generate (에이전트 불필요)
    // build 모드: /api/studio/build-generate (에이전트 불필요 — Claude 직접)
    // (세 모드 모두 에이전트 불필요)

    setInput('')
    setIsRunning(true)
    const userMsg: Msg = { role: 'user', content, id: Date.now().toString() }
    setMsgs(prev => [...prev, userMsg])

    abortRef.current = new AbortController()

    // ── 그래픽 모드 분기 ──────────────────────────────────────
    if (mode === 'graphic') {
      setGraphicStatus('🚀 생성 시작...')
      try {
        const resp = await fetch(`${BACKEND_URL}/api/studio/graphic-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: content, channel: graphicChannel }),
          signal: abortRef.current.signal,
        })
        const reader = resp.body?.getReader()
        if (!reader) throw new Error('no stream')
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (raw === '[DONE]') break
            try {
              const ev = JSON.parse(raw) as { type: string; message?: string; imageUrl?: string; imagePrompt?: string; channel?: string }
              if (ev.type === 'status') setGraphicStatus(ev.message ?? '')
              else if (ev.type === 'result' && ev.imageUrl) {
                setGraphicResults(prev => [{ url: ev.imageUrl!, prompt: ev.imagePrompt ?? '', userPrompt: content, channel: ev.channel ?? graphicChannel }, ...prev])
                setGraphicStatus('')
                setMsgs(prev => [...prev, { role: 'assistant', content: `✓ 이미지 생성 완료\n프롬프트: ${ev.imagePrompt ?? ''}`, id: (Date.now() + 1).toString() }])
              } else if (ev.type === 'stub') {
                setGraphicStatus('')
                setMsgs(prev => [...prev, { role: 'assistant', content: ev.message ?? 'Ideogram 키 없음', id: (Date.now() + 1).toString() }])
              } else if (ev.type === 'error') {
                throw new Error(ev.message)
              }
            } catch { /* ignore */ }
          }
        }
      } catch (e: unknown) {
        if ((e as { name?: string }).name !== 'AbortError') {
          setGraphicStatus('')
          setMsgs(prev => [...prev, { role: 'assistant', content: '이미지 생성 실패', id: (Date.now() + 1).toString() }])
        }
      } finally {
        setIsRunning(false)
        abortRef.current = null
      }
      return
    }

    // ── UI 프로토타입 / 빌드 모드 ────────────────────────────
    const assistantId = (Date.now() + 1).toString()
    setMsgs(prev => [...prev, { role: 'assistant', content: '', id: assistantId }])
    let accumulated = ''
    setStreamOutput('')

    try {
      const endpoint = mode === 'ui-proto'
        ? `${BACKEND_URL}/api/studio/v0-generate`
        : `${BACKEND_URL}/api/studio/build-generate`

      const body = JSON.stringify({ prompt: content })

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('session_token') ?? ''}` },
        body,
        signal: abortRef.current.signal,
      })

      const reader = resp.body?.getReader()
      if (!reader) throw new Error('no stream')
      const decoder = new TextDecoder()
      let lineBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw) as { chunk?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
            const chunk = parsed.chunk ?? ''
            if (chunk) {
              accumulated += chunk
              setStreamOutput(accumulated)
              setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m))
              if (mode === 'ui-proto') {
                const html = extractHtml(accumulated)
                if (html) setIframeHtml(html)
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== 'AbortError') {
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated || '오류가 발생했습니다.' } : m))
      }
    } finally {
      setIsRunning(false)
      abortRef.current = null
    }
  }, [input, isRunning, activeAgent, mode, graphicChannel])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleCatClick = (prompt: string, channel?: string) => {
    setCatPrompt(prompt)
    setInput(prompt)
    if (channel) setGraphicChannel(channel)
    textareaRef.current?.focus()
  }

  const cats = mode === 'build' ? BUILD_CATS : mode === 'graphic' ? GRAPHIC_CATS : mode === 'open-design' ? [] : DESIGN_CATS

  return (
    <div className="flex h-full bg-bg overflow-hidden" style={bgColor ? { background: bgColor } : undefined}>
      {/* ── 왼쪽 패널 ──────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border bg-surface overflow-y-auto">
        {/* 모드 탭 */}
        <div className="p-3 border-b border-border">
          <p className="text-[13px] text-muted uppercase tracking-widest mb-2 px-1">모드</p>
          <div className="space-y-1">
            {MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[16px] transition-colors',
                    mode === m.key
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted hover:text-text hover:bg-border/40'
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 카테고리 버튼들 */}
        <div className="p-3 flex-1">
          {mode !== 'open-design' && (
          <p className="text-[13px] text-muted uppercase tracking-widest mb-2 px-1">
            {mode === 'build' ? '빌드 카테고리' : mode === 'graphic' ? '그래픽 카테고리' : 'UI 카테고리'}
          </p>
          )}
          {mode === 'open-design' && (
            <div className="space-y-2">
              <p className="text-[13px] text-muted uppercase tracking-widest mb-2 px-1">에디터 정보</p>
              <div className="px-2 py-2 text-[13px] text-muted/70 space-y-1.5 bg-surface/50 rounded-lg border border-border">
                <div>포트: <span className="text-primary font-mono">{OPEN_DESIGN_PORT}</span></div>
                <div>엔진: <span className="text-text">nexu-io/open-design</span></div>
                <div>AI: <span className="text-text">Claude Code 연동</span></div>
                <div>모드: <span className="text-text">로컬 퍼스트</span></div>
              </div>
              <a
                href={`http://localhost:${OPEN_DESIGN_PORT}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-[14px] text-muted hover:text-text hover:bg-border/40 transition-colors"
              >
                <ExternalLink size={13} />새 창으로 열기
              </a>
            </div>
          )}
          <div className="space-y-1">
            {(cats as Array<{ icon: React.ElementType; label: string; prompt: string; channel?: string }>).map(cat => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.label}
                  onClick={() => handleCatClick(cat.prompt, cat.channel)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[15px] transition-colors text-left',
                    catPrompt === cat.prompt && cat.prompt
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:text-text hover:bg-border/40'
                  )}
                >
                  <Icon size={15} className="shrink-0" />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 화면 설정 */}
        <div className="p-3 border-t border-border space-y-3">
          {/* 폰트 크기 */}
          <div>
            <p className="text-[13px] text-muted uppercase tracking-widest mb-1.5 px-1">폰트 크기</p>
            <div className="flex items-center gap-1">
              {([11, 13, 15, 17] as const).map(sz => (
                <button
                  key={sz}
                  onClick={() => setFontSize(sz)}
                  className={cn(
                    'flex-1 py-1 rounded text-[13px] border transition-colors',
                    fontSize === sz
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-surface border-border text-muted hover:text-text',
                  )}
                >
                  {sz === 11 ? 'S' : sz === 13 ? 'M' : sz === 15 ? 'L' : 'XL'}
                </button>
              ))}
            </div>
          </div>

          {/* 배경색 */}
          <div>
            <p className="text-[13px] text-muted uppercase tracking-widest mb-1.5 px-1">배경색</p>
            <div className="flex items-center gap-1.5">
              {[
                { id: '',        color: '#0d0d0f', label: 'Dark'    },
                { id: 'navy',    color: '#070d1a', label: 'Navy'    },
                { id: 'slate',   color: '#1e1e2e', label: 'Slate'   },
                { id: 'carbon',  color: '#1a1a1a', label: 'Carbon'  },
                { id: 'forest',  color: '#0a1a10', label: 'Forest'  },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setBgColor(opt.id === '' ? '' : opt.color)}
                  title={opt.label}
                  style={{ background: opt.color }}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-all',
                    (bgColor === opt.color || (opt.id === '' && bgColor === ''))
                      ? 'border-primary scale-110'
                      : 'border-border hover:border-muted',
                  )}
                />
              ))}
            </div>
          </div>

          {/* 엔진 상태 */}
          <div className="px-2 py-1.5 bg-green-900/10 border border-green-800/20 rounded-lg">
            <p className="text-[14px] text-green-400/80">
              {mode === 'ui-proto' ? (v0KeySet ? 'v0 API' : 'Claude HTML') :
               mode === 'graphic' ? (ideogramKeySet ? 'Ideogram AI' : 'Ideogram 키 필요') :
               'Claude Sonnet 4.6'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 중앙 컨텐츠 ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {mode === 'ui-proto' && <Monitor size={17} className="text-purple-400" />}
            {mode === 'graphic' && <Image size={17} className="text-pink-400" />}
            {mode === 'build' && <Code2 size={17} className="text-orange-400" />}
            <span className="text-[16px] font-semibold text-text">
              {MODES.find(m => m.key === mode)?.label}
            </span>
          </div>
          {mode === 'ui-proto' && (
            <span className={cn(
              'text-[13px] px-2 py-0.5 rounded-full border',
              v0KeySet
                ? 'text-purple-300 bg-purple-500/20 border-purple-500/40'
                : 'text-purple-400/60 bg-purple-500/10 border-purple-500/20'
            )}>
              {v0KeySet ? 'v0 API ✓' : 'Claude HTML (v0 키 없음)'}
            </span>
          )}
          {mode === 'graphic' && (
            <span className={cn(
              'text-[13px] px-2 py-0.5 rounded-full border',
              ideogramKeySet
                ? 'text-pink-300 bg-pink-500/20 border-pink-500/40'
                : 'text-pink-400/60 bg-pink-500/10 border-pink-500/20'
            )}>
              {ideogramKeySet ? 'Ideogram AI ✓' : 'Ideogram 키 없음 (Settings)'}
            </span>
          )}
          {mode === 'build' && (
            <span className="text-[13px] text-orange-300 bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 rounded-full">
              Claude Sonnet 4.6 ✓
            </span>
          )}
          {mode === 'open-design' && (
            <div className="flex items-center gap-2 ml-auto">
              <span className={cn(
                'text-[13px] px-2 py-0.5 rounded-full border',
                odStatus === 'running'
                  ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                  : odStatus === 'starting' || odStatus === 'checking'
                  ? 'text-yellow-300 bg-yellow-500/20 border-yellow-500/40'
                  : 'text-muted bg-surface border-border',
              )}>
                {odStatus === 'running' ? '● 실행 중 — localhost:' + OPEN_DESIGN_PORT
                  : odStatus === 'starting' ? '● 시작 중...'
                  : odStatus === 'checking' ? '● 확인 중...'
                  : '● 중지됨'}
              </span>
              {odStatus === 'running' ? (
                <button onClick={stopOd}
                  className="flex items-center gap-1 px-2 py-1 text-[13px] text-red-400 border border-red-800/40 rounded-lg hover:bg-red-900/20 transition-colors">
                  <Square size={9} fill="currentColor" />중지
                </button>
              ) : odStatus === 'idle' || odStatus === 'error' ? (
                <button onClick={startOd}
                  className="flex items-center gap-1 px-2.5 py-1 text-[13px] bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 rounded-lg hover:bg-emerald-600/30 transition-colors">
                  <Play size={9} fill="currentColor" />시작
                </button>
              ) : null}
              <button onClick={checkOdStatus}
                className="p-1 text-muted hover:text-text transition-colors">
                <RefreshCw size={13} className={odStatus === 'checking' ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
          {isRunning && (
            <div className="ml-auto flex items-center gap-1.5 text-[14px] text-primary">
              <Loader2 size={13} className="animate-spin" />
              생성 중...
            </div>
          )}
          {streamOutput && !isRunning && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => navigator.clipboard.writeText(streamOutput)}
                className="flex items-center gap-1 px-2 py-1 text-[14px] text-muted hover:text-text border border-border rounded-lg transition-colors">
                <Copy size={13} />복사
              </button>
              <button onClick={() => {
                const blob = new Blob([streamOutput], { type: 'text/plain' })
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                a.download = `studio-output-${Date.now()}.md`; a.click()
              }}
                className="flex items-center gap-1 px-2 py-1 text-[14px] text-muted hover:text-text border border-border rounded-lg transition-colors">
                <Download size={13} />저장
              </button>
            </div>
          )}
        </div>

        {/* 결과 영역 (플로팅 채팅 기준 relative) */}
        <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto" style={{ fontSize: `${fontSize}px` }}>
          {/* ── Open Design 모드 ── */}
          {mode === 'open-design' && odStatus === 'running' ? (
            <OpenDesignWebview port={OPEN_DESIGN_PORT} onStop={stopOd} />
          ) : mode === 'open-design' ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
                <PenTool size={28} className="text-muted" />
              </div>
              <div>
                <p className="text-[18px] font-semibold text-text mb-1">Open Design 에디터</p>
                <p className="text-[15px] text-muted">
                  로컬 디자인 에디터를 앱 안에서 바로 사용할 수 있습니다
                </p>
              </div>
              {odStatus === 'error' && (
                <div className="w-full max-w-sm space-y-2">
                  <div className="flex items-start gap-2 px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-xl text-[15px] text-red-400">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{odError || '서버 시작 실패 (45초 초과)'}</span>
                  </div>
                  <div className="px-4 py-3 bg-surface border border-border rounded-xl text-left text-[14px]">
                    <p className="text-muted font-semibold mb-1.5">수동 실행 방법 (터미널에서)</p>
                    <code className="block bg-[#111] rounded p-2 text-primary font-mono text-[13px] mb-1.5">
                      npx open-design-ade --port {OPEN_DESIGN_PORT}
                    </code>
                    <p className="text-muted/60">실행 후 새로고침(↺)을 클릭하세요</p>
                  </div>
                </div>
              )}
              {(odStatus === 'starting' || odStatus === 'checking') && (
                <div className="flex items-center gap-2 px-5 py-3 bg-surface border border-border rounded-xl text-[16px] text-muted">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  {odStatus === 'starting' ? 'Open Design 서버 시작 중... (최대 45초 소요)' : '상태 확인 중...'}
                </div>
              )}
              {(odStatus === 'idle' || odStatus === 'error') && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={startOd}
                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-light text-white rounded-xl text-[16px] font-semibold transition-colors shadow-lg"
                  >
                    <Play size={16} fill="currentColor" />
                    Open Design 시작
                  </button>
                  <p className="text-[13px] text-muted/60">
                    npx open-design-ade 를 포트 {OPEN_DESIGN_PORT}에서 실행합니다
                  </p>
                  <div className="mt-2 px-4 py-3 bg-surface border border-border rounded-xl text-left max-w-sm">
                    <p className="text-[14px] text-muted font-semibold mb-1.5">사전 요구사항</p>
                    <div className="space-y-1 text-[14px] text-muted/80">
                      <div className="flex items-center gap-1.5"><span className="text-primary">→</span> Node.js 18+ 설치됨</div>
                      <div className="flex items-center gap-1.5"><span className="text-primary">→</span> 인터넷 연결 (첫 실행 시 패키지 다운로드)</div>
                      <div className="flex items-center gap-1.5"><span className="text-primary">→</span> Claude API 키 설정됨 (Settings)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : mode === 'ui-proto' && iframeHtml ? (
            <iframe
              srcDoc={iframeHtml}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="UI Preview"
            />
          ) : mode === 'ui-proto' && streamOutput ? (
            <div className="h-full overflow-y-auto p-5">
              <pre className="text-[15px] text-dim font-mono leading-relaxed whitespace-pre-wrap">{streamOutput}</pre>
            </div>
          ) : mode === 'ui-proto' ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
              <Monitor size={40} className="text-border" />
              <p className="text-muted text-[16px]">UI 프로토타입 결과가 여기에 표시됩니다</p>
              <p className="text-muted/60 text-[14px]">왼쪽에서 카테고리를 선택하거나 아래 채팅에서 직접 입력하세요</p>
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {['SaaS 대시보드', '로그인 페이지', '프라이싱 카드', '히어로 섹션'].map(ex => (
                  <button key={ex} onClick={() => { setInput(`${ex} UI를 만들어줘. React + Tailwind, 다크 테마.`); setChatOpen(true) }}
                    className="px-3 py-1.5 bg-surface border border-border rounded-lg text-[14px] text-muted hover:text-text hover:border-primary/40 transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : mode === 'graphic' ? (
            <div className="h-full overflow-y-auto p-5">
              {/* 로딩 상태 */}
              {isRunning && graphicStatus && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-pink-500/5 border border-pink-500/20 rounded-xl text-[15px] text-pink-300">
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  {graphicStatus}
                </div>
              )}
              {/* 생성된 이미지 그리드 */}
              {graphicResults.length > 0 ? (
                <div className="space-y-4">
                  {graphicResults.map((img, i) => (
                    <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
                      <img src={img.url} alt={img.userPrompt} className="w-full object-cover max-h-80" />
                      <div className="p-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-text truncate font-medium">{img.userPrompt}</p>
                          <p className="text-[13px] text-muted mt-0.5 line-clamp-2">{img.prompt}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <a href={img.url} download={`oomni-graphic-${i}.jpg`}
                            className="flex items-center gap-1 px-2 py-1 text-[13px] text-muted hover:text-text border border-border rounded-lg transition-colors">
                            <Download size={12} />저장
                          </a>
                          <a href="https://www.canva.com/create" target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-[13px] text-pink-400 hover:text-pink-300 border border-pink-500/30 rounded-lg transition-colors">
                            <ExternalLink size={12} />Canva 편집
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isRunning ? (
                <div className="h-full overflow-y-auto p-5">
                  {/* Canva 메인 카드 */}
                  <div className="mb-5 p-5 bg-[#1a1a2e] border border-purple-500/30 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                        <ExternalLink size={18} className="text-purple-400" />
                      </div>
                      <div>
                        <p className="text-[17px] font-semibold text-text">Canva로 디자인하기</p>
                        <p className="text-[14px] text-muted">전문 템플릿으로 빠르게 제작</p>
                      </div>
                      <a
                        href="https://www.canva.com"
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[15px] font-medium transition-colors"
                      >
                        Canva 열기
                      </a>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '인스타 카드뉴스', url: 'https://www.canva.com/create/instagram-posts/' },
                        { label: 'YouTube 썸네일', url: 'https://www.canva.com/create/youtube-thumbnails/' },
                        { label: 'TikTok 커버', url: 'https://www.canva.com/create/tiktok-videos/' },
                        { label: '마케팅 배너', url: 'https://www.canva.com/create/banners/' },
                        { label: '피치덱 슬라이드', url: 'https://www.canva.com/create/presentations/' },
                        { label: '브랜드 로고', url: 'https://www.canva.com/create/logos/' },
                      ].map(item => (
                        <a
                          key={item.label}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[14px] text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40 transition-colors"
                        >
                          <ExternalLink size={12} className="shrink-0" />
                          {item.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* AI 이미지 생성 (보조) */}
                  <div className="p-4 bg-surface border border-border rounded-xl">
                    <p className="text-[14px] font-semibold text-muted mb-2">AI 이미지 생성 (Ideogram)</p>
                    <p className="text-[13px] text-muted/60 mb-3">
                      {ideogramKeySet ? '아래 채팅에서 원하는 이미지를 설명하세요' : 'Settings → Ideogram API 키 입력 후 사용 가능'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['인스타 제품 광고 배너', 'YouTube 썸네일 — 강의 커버', 'TikTok 세로 영상 커버', '마케팅 이벤트 배너'].map(ex => (
                        <button key={ex}
                          onClick={() => { setInput(ex); setChatOpen(true) }}
                          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-[14px] text-muted hover:text-text hover:border-pink-500/40 transition-colors">
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : mode === 'build' && (streamOutput || isRunning) ? (
            <VsCodeViewer text={streamOutput} isRunning={isRunning} />
          ) : mode === 'build' ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
              <Code2 size={40} className="text-border" />
              <p className="text-muted text-[16px]">빌드 결과가 여기에 표시됩니다</p>
              <p className="text-muted/60 text-[14px]">파일을 생성하면 VS Code 스타일 탭 뷰어로 표시됩니다</p>
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {['REST API 엔드포인트', 'React 컴포넌트', '데이터베이스 스키마', '인증 미들웨어'].map(ex => (
                  <button key={ex} onClick={() => { setInput(`${ex}를 TypeScript로 구현해줘.`); setChatOpen(true) }}
                    className="px-3 py-1.5 bg-surface border border-border rounded-lg text-[14px] text-muted hover:text-text hover:border-orange-500/40 transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>


        {/* ── 플로팅 채팅 패널 — open-design 모드에서 숨김 ───────────── */}
        {mode !== 'open-design' && chatOpen ? (
          <div className={cn(
            'absolute bottom-6 left-1/2 -translate-x-1/2 z-20',
            'border border-border bg-surface/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/40 flex flex-col transition-all duration-200',
            chatExpanded ? 'w-[660px] h-[340px]' : 'w-[600px] h-[180px]',
            'max-w-[calc(100%-32px)]',
          )}>
            {/* 채팅 헤더 */}
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border shrink-0 rounded-t-2xl">
              <Bot size={14} className="text-primary" />
              <span className="text-[14px] font-medium text-text flex-1">
                {mode === 'ui-proto' ? 'UI 프로토타입 생성' : mode === 'graphic' ? 'Canva / 그래픽 생성' : '코드 빌드 생성'}
              </span>
              {isRunning && <Loader2 size={13} className="animate-spin text-primary" />}
              <button onClick={() => { setMsgs([]); setStreamOutput(''); setIframeHtml(''); setGraphicResults([]); setGraphicStatus('') }}
                className="text-muted hover:text-text transition-colors p-1" title="초기화">
                <RotateCcw size={13} />
              </button>
              <button onClick={() => setChatExpanded(v => !v)}
                className="text-muted hover:text-text transition-colors p-1" title={chatExpanded ? '축소' : '확장'}>
                {chatExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button onClick={() => setChatOpen(false)}
                className="text-muted hover:text-text transition-colors p-1" title="닫기">
                <ChevronDown size={13} />
              </button>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
              {msgs.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="px-3 pb-2.5 pt-1.5 border-t border-border shrink-0">
              <div className="flex items-end gap-2 bg-bg border border-border rounded-xl px-3 py-2 focus-within:border-primary/50 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="원하는 것을 설명하세요... (Enter 전송, Shift+Enter 줄바꿈)"
                  disabled={isRunning}
                  rows={1}
                  className="flex-1 bg-transparent text-[15px] text-text placeholder:text-muted/50 outline-none resize-none leading-relaxed disabled:opacity-50"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="text-muted/50 hover:text-muted transition-colors p-0.5" title="파일 첨부">
                    <Paperclip size={14} />
                  </button>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-surface border border-border rounded text-[9px] text-muted">
                    <span>{currentRole === 'design' ? 'opus-4' : 'sonnet-4'}</span>
                    <ChevronDown size={8} />
                  </div>
                  {isRunning ? (
                    <button onClick={() => abortRef.current?.abort()}
                      className="px-2.5 py-1 bg-red-900/20 border border-red-800/30 text-red-400 rounded-lg text-[13px] hover:bg-red-900/40 transition-colors">
                      중단
                    </button>
                  ) : (
                    <button onClick={() => sendMessage()} disabled={!input.trim()}
                      className="flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40">
                      <Send size={12} />전송
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 채팅 최소화 버튼 — 하단 중앙 플로팅 */
          mode !== 'open-design' ? (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-surface/95 backdrop-blur-sm border border-border rounded-full shadow-lg text-[14px] text-muted hover:text-text hover:border-primary/40 transition-all"
            >
              <Bot size={14} className="text-primary" />AI 채팅 열기
              <Maximize2 size={13} />
            </button>
          ) : null
        )}
        </div>
      </div>
    </div>
  )
}
