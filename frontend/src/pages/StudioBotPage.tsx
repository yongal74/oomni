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
  Instagram, Youtube, Music2, Layout,
} from 'lucide-react'
import { agentsApi, type Agent } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { cn } from '../lib/utils'
import { BACKEND_URL } from '../config'

// ── 모드 정의 ──────────────────────────────────────────────────────────────────
type StudioMode = 'ui-proto' | 'graphic' | 'build'

const MODES: { key: StudioMode; label: string; icon: React.ElementType; role: string }[] = [
  { key: 'ui-proto',  label: 'UI 프로토타입', icon: Monitor,  role: 'design' },
  { key: 'graphic',   label: '그래픽 디자인', icon: Image,    role: 'design' },
  { key: 'build',     label: '빌드',          icon: Code2,    role: 'build'  },
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

// ── VS Code 스타일 코드 뷰어 ─────────────────────────────────────────────────
function VsCodeViewer({ text, isRunning }: { text: string; isRunning: boolean }) {
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const files = parseCodeFiles(text)

  useEffect(() => {
    if (files.length > 0 && !activeFile) setActiveFile(files[0].path)
  }, [files.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = files.find(f => f.path === activeFile) ?? files[0]
  const lines = current?.code.split('\n') ?? []

  if (!text && !isRunning) return null

  return (
    <div className="h-full flex flex-col bg-[#0d0d0f] font-mono text-[12px]">
      {/* 파일 탭 바 */}
      {files.length > 0 && (
        <div className="flex items-center gap-0 border-b border-[#222] shrink-0 overflow-x-auto bg-[#111]">
          {files.map(f => {
            const name = f.path.split('/').pop() ?? f.path
            return (
              <button
                key={f.path}
                onClick={() => setActiveFile(f.path)}
                title={f.path}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[11px] border-r border-[#222] whitespace-nowrap transition-colors shrink-0',
                  activeFile === f.path
                    ? 'bg-[#1e1e22] text-[#e4e4e7] border-t border-t-orange-500'
                    : 'text-[#666] hover:text-[#aaa] hover:bg-[#161618]'
                )}
              >
                <FileCode2 size={11} className="shrink-0 text-orange-400/70" />
                {name}
              </button>
            )
          })}
        </div>
      )}

      {/* 파일 경로 + 액션 */}
      {current && (
        <div className="flex items-center gap-2 px-3 py-1 bg-[#111] border-b border-[#222] text-[10px] text-[#555] shrink-0">
          <span className="flex-1 truncate">{current.path}</span>
          <button
            onClick={() => navigator.clipboard.writeText(current.code)}
            className="flex items-center gap-1 text-[#555] hover:text-[#aaa] transition-colors"
          >
            <Copy size={10} />복사
          </button>
          <button
            onClick={() => {
              const blob = new Blob([current.code], { type: 'text/plain' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = current.path.split('/').pop() ?? 'file.ts'
              a.click()
            }}
            className="flex items-center gap-1 text-[#555] hover:text-[#aaa] transition-colors"
          >
            <Download size={10} />저장
          </button>
        </div>
      )}

      {/* 코드 영역 */}
      <div className="flex-1 overflow-auto">
        {current ? (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="select-none text-right pr-3 pl-3 text-[#444] w-10 shrink-0 align-top leading-5">{i + 1}</td>
                  <td className="pr-4 leading-5 text-[#d4d4d4] whitespace-pre">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : isRunning ? (
          <div className="p-4 text-[#555]">
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">{text}</pre>
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
        'max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed whitespace-pre-wrap',
        msg.role === 'user'
          ? 'bg-primary/20 border border-primary/30 text-text'
          : 'bg-surface border border-border text-dim'
      )}>
        {msg.content}
      </div>
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

  // 플로팅 채팅 상태
  const [chatOpen, setChatOpen] = useState(true)
  const [chatExpanded, setChatExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [catPrompt, setCatPrompt] = useState('')

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

  const cats = mode === 'build' ? BUILD_CATS : mode === 'graphic' ? GRAPHIC_CATS : DESIGN_CATS

  return (
    <div className="relative flex h-full bg-bg overflow-hidden">
      {/* ── 왼쪽 패널 ──────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border bg-surface overflow-y-auto">
        {/* 모드 탭 */}
        <div className="p-3 border-b border-border">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-2 px-1">모드</p>
          <div className="space-y-1">
            {MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] transition-colors',
                    mode === m.key
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted hover:text-text hover:bg-border/40'
                  )}
                >
                  <Icon size={14} className="shrink-0" />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 카테고리 버튼들 */}
        <div className="p-3 flex-1">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-2 px-1">
            {mode === 'build' ? '빌드 카테고리' : mode === 'graphic' ? '그래픽 카테고리' : 'UI 카테고리'}
          </p>
          <div className="space-y-1">
            {(cats as Array<{ icon: React.ElementType; label: string; prompt: string; channel?: string }>).map(cat => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.label}
                  onClick={() => handleCatClick(cat.prompt, cat.channel)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12px] transition-colors text-left',
                    catPrompt === cat.prompt && cat.prompt
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:text-text hover:bg-border/40'
                  )}
                >
                  <Icon size={13} className="shrink-0" />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 엔진 상태 */}
        <div className="p-3 border-t border-border">
          <div className="px-2 py-1.5 bg-green-900/10 border border-green-800/20 rounded-lg">
            <p className="text-[11px] text-green-400/80">
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
            {mode === 'ui-proto' && <Monitor size={15} className="text-purple-400" />}
            {mode === 'graphic' && <Image size={15} className="text-pink-400" />}
            {mode === 'build' && <Code2 size={15} className="text-orange-400" />}
            <span className="text-[13px] font-semibold text-text">
              {MODES.find(m => m.key === mode)?.label}
            </span>
          </div>
          {mode === 'ui-proto' && (
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border',
              v0KeySet
                ? 'text-purple-300 bg-purple-500/20 border-purple-500/40'
                : 'text-purple-400/60 bg-purple-500/10 border-purple-500/20'
            )}>
              {v0KeySet ? 'v0 API ✓' : 'Claude HTML (v0 키 없음)'}
            </span>
          )}
          {mode === 'graphic' && (
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border',
              ideogramKeySet
                ? 'text-pink-300 bg-pink-500/20 border-pink-500/40'
                : 'text-pink-400/60 bg-pink-500/10 border-pink-500/20'
            )}>
              {ideogramKeySet ? 'Ideogram AI ✓' : 'Ideogram 키 없음 (Settings)'}
            </span>
          )}
          {mode === 'build' && (
            <span className="text-[10px] text-orange-300 bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 rounded-full">
              Claude Sonnet 4.6 ✓
            </span>
          )}
          {isRunning && (
            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-primary">
              <Loader2 size={11} className="animate-spin" />
              생성 중...
            </div>
          )}
          {streamOutput && !isRunning && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => navigator.clipboard.writeText(streamOutput)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted hover:text-text border border-border rounded-lg transition-colors">
                <Copy size={11} />복사
              </button>
              <button onClick={() => {
                const blob = new Blob([streamOutput], { type: 'text/plain' })
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                a.download = `studio-output-${Date.now()}.md`; a.click()
              }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted hover:text-text border border-border rounded-lg transition-colors">
                <Download size={11} />저장
              </button>
            </div>
          )}
        </div>

        {/* 결과 영역 */}
        <div className="flex-1 overflow-hidden">
          {mode === 'ui-proto' && iframeHtml ? (
            <iframe
              srcDoc={iframeHtml}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="UI Preview"
            />
          ) : mode === 'ui-proto' && streamOutput ? (
            <div className="h-full overflow-y-auto p-5">
              <pre className="text-[12px] text-dim font-mono leading-relaxed whitespace-pre-wrap">{streamOutput}</pre>
            </div>
          ) : mode === 'ui-proto' ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
              <Monitor size={40} className="text-border" />
              <p className="text-muted text-[13px]">UI 프로토타입 결과가 여기에 표시됩니다</p>
              <p className="text-muted/60 text-[11px]">왼쪽에서 카테고리를 선택하거나 아래 채팅에서 직접 입력하세요</p>
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {['SaaS 대시보드', '로그인 페이지', '프라이싱 카드', '히어로 섹션'].map(ex => (
                  <button key={ex} onClick={() => { setInput(`${ex} UI를 만들어줘. React + Tailwind, 다크 테마.`); setChatOpen(true) }}
                    className="px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-muted hover:text-text hover:border-primary/40 transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : mode === 'graphic' ? (
            <div className="h-full overflow-y-auto p-5">
              {/* 로딩 상태 */}
              {isRunning && graphicStatus && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-pink-500/5 border border-pink-500/20 rounded-xl text-[12px] text-pink-300">
                  <Loader2 size={12} className="animate-spin shrink-0" />
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
                          <p className="text-[11px] text-text truncate font-medium">{img.userPrompt}</p>
                          <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{img.prompt}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <a href={img.url} download={`oomni-graphic-${i}.jpg`}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted hover:text-text border border-border rounded-lg transition-colors">
                            <Download size={10} />저장
                          </a>
                          <a href="https://www.canva.com/create" target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-pink-400 hover:text-pink-300 border border-pink-500/30 rounded-lg transition-colors">
                            <ExternalLink size={10} />Canva 편집
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isRunning ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <Image size={36} className="text-border" />
                  <p className="text-muted text-[13px]">그래픽 이미지 생성 결과가 여기에 표시됩니다</p>
                  <p className="text-muted/60 text-[11px]">
                    {ideogramKeySet ? '왼쪽 카테고리를 선택하거나 채팅에서 직접 설명하세요' : 'Settings → Ideogram API 키를 입력하면 이미지를 생성할 수 있습니다'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 justify-center">
                    {['인스타 제품 광고 배너', 'YouTube 썸네일 — 강의 커버', 'TikTok 세로 영상 커버', '마케팅 이벤트 배너'].map(ex => (
                      <button key={ex}
                        onClick={() => { setInput(ex); setChatOpen(true) }}
                        className="px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-muted hover:text-text hover:border-pink-500/40 transition-colors">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : mode === 'build' && (streamOutput || isRunning) ? (
            <VsCodeViewer text={streamOutput} isRunning={isRunning} />
          ) : mode === 'build' ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
              <Code2 size={40} className="text-border" />
              <p className="text-muted text-[13px]">빌드 결과가 여기에 표시됩니다</p>
              <p className="text-muted/60 text-[11px]">파일을 생성하면 VS Code 스타일 탭 뷰어로 표시됩니다</p>
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {['REST API 엔드포인트', 'React 컴포넌트', '데이터베이스 스키마', '인증 미들웨어'].map(ex => (
                  <button key={ex} onClick={() => { setInput(`${ex}를 TypeScript로 구현해줘.`); setChatOpen(true) }}
                    className="px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-muted hover:text-text hover:border-orange-500/40 transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── 플로팅 채팅 (Cursor 스타일) ─────────────────────────────── */}
      {chatOpen && (
        <div className={cn(
          'absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col transition-all z-30',
          chatExpanded ? 'w-[700px] h-[500px]' : 'w-[600px] h-[280px]'
        )}>
          {/* 채팅 헤더 */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
            <Bot size={13} className="text-primary" />
            <span className="text-[12px] font-medium text-text flex-1">
              {mode === 'ui-proto' ? 'UI 프로토타입 생성' : mode === 'graphic' ? '그래픽 이미지 생성' : '코드 빌드 생성'}
            </span>
            {isRunning && <Loader2 size={12} className="animate-spin text-primary" />}
            <button onClick={() => { setMsgs([]); setStreamOutput(''); setIframeHtml(''); setGraphicResults([]); setGraphicStatus('') }}
              className="text-muted hover:text-text transition-colors p-1"><RotateCcw size={12} /></button>
            <button onClick={() => setChatExpanded(v => !v)}
              className="text-muted hover:text-text transition-colors p-1">
              {chatExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
            <button onClick={() => setChatOpen(false)}
              className="text-muted hover:text-text transition-colors p-1">
              <ChevronDown size={12} />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {msgs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-[11px] text-muted/60 text-center">
                  {'무엇을 만들고 싶으신가요?'}
                </p>
              </div>
            ) : (
              msgs.map(msg => <ChatBubble key={msg.id} msg={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="p-3 border-t border-border shrink-0">
            <div className="flex flex-col gap-2 bg-bg border border-border rounded-xl px-3 py-2.5 focus-within:border-primary/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="원하는 것을 설명하세요... (Enter 전송, Shift+Enter 줄바꿈)"
                disabled={isRunning}
                rows={2}
                className="w-full bg-transparent text-[13px] text-text placeholder:text-muted/50 outline-none resize-none leading-relaxed disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <button className="text-muted/50 hover:text-muted transition-colors p-1 rounded" title="파일 첨부">
                  <Paperclip size={13} />
                </button>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-surface border border-border rounded-lg text-[10px] text-muted cursor-pointer hover:border-primary/40 hover:text-primary transition-colors">
                  <span>{currentRole === 'design' ? 'claude-opus-4-7' : 'claude-sonnet-4-6'}</span>
                  <ChevronDown size={9} />
                </div>
                <div className="flex-1" />
                {isRunning ? (
                  <button onClick={() => abortRef.current?.abort()}
                    className="px-3 py-1.5 bg-red-900/20 border border-red-800/30 text-red-400 rounded-lg text-[11px] hover:bg-red-900/40 transition-colors">
                    중단
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
                  >
                    <Send size={11} />전송
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 채팅 토글 버튼 (닫혔을 때) */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg text-[13px] font-medium transition-colors z-30"
        >
          <Bot size={14} />AI 채팅
        </button>
      )}
    </div>
  )
}
