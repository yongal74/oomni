/**
 * XTerminal.tsx — xterm.js + WebSocket 기반 진짜 터미널 컴포넌트
 *
 * 역할별 실행 방식 (role prop → 백엔드 ptyService로 전달):
 * - design  → Claude Code CLI + Pencil MCP 자동 연결
 * - build/ops/기타 → Claude Code CLI 인터랙티브 모드
 * - shellMode={true} → PowerShell/bash 직접 실행
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { Square, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { cn } from '../../lib/utils'
import 'xterm/css/xterm.css'

export interface XTerminalRef {
  /** 터미널에 텍스트 주입 (Enter 포함) */
  send(text: string): void
  /** 터미널 포커스 */
  focus(): void
}

interface Props {
  agentId: string
  isRunning: boolean
  /** true: 마운트 즉시 연결 (isRunning 무관) — Antigravity IDE 스타일 항상-켜진 터미널 */
  alwaysOn?: boolean
  /** 에이전트 역할 — 백엔드가 역할에 맞는 실행 방식 선택 (design → Pencil MCP 자동 연결) */
  role?: string
  /** true: PowerShell/bash 셸 모드 — 일반 사용자 셸 직접 실행 */
  shellMode?: boolean
  /** @deprecated 자동전송 제거됨 — Claude Code 초기화 전 입력이 exit code 1 유발 */
  initialInput?: string
  /** 연결 후 터미널에 힌트로 표시할 태스크 텍스트 (자동 전송하지 않음) */
  taskHint?: string
  onExit?: (code: number) => void
  /** PTY 출력 누적 텍스트를 부모에 전달 (산출물 전달용) */
  onOutputCapture?: (text: string) => void
  className?: string
}

const WS_URL = 'ws://localhost:3001'

// 모듈 레벨 Terminal 캐시 — 컴포넌트 언마운트 후에도 scrollback 버퍼 유지
const _termCache = new Map<string, Terminal>()
const _fitCache = new Map<string, FitAddon>()

export const XTerminal = forwardRef<XTerminalRef, Props>(function XTerminal(
  { agentId, isRunning, alwaysOn, role, shellMode, taskHint, onExit, onOutputCapture, className }: Props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const outputBufRef = useRef<string>('')
  const [connected, setConnected] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [resetting, setResetting] = useState(false)

  useImperativeHandle(ref, () => ({
    send(text: string) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text + '\r' }))
      }
    },
    focus() {
      termRef.current?.focus()
    },
  }))

  // 터미널 초기화 — agentId 기준으로 인스턴스 캐시 (언마운트 후 재방문 시 scrollback 유지)
  useEffect(() => {
    if (!containerRef.current) return

    let term = _termCache.get(agentId)
    let fitAddon = _fitCache.get(agentId)
    const isReused = !!term

    if (!term) {
      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Menlo, monospace',
        theme: {
          background: '#0d0d0d',
          foreground: '#e8e8e8',
          cursor: '#D4763B',
          cursorAccent: '#0d0d0d',
          black: '#000000', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
          blue: '#6272a4', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
          brightBlack: '#44475a', brightRed: '#ff6e6e', brightGreen: '#69ff94',
          brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
          brightCyan: '#a4ffff', brightWhite: '#ffffff', selectionBackground: '#D4763B40',
        },
        allowTransparency: false,
        scrollback: 5000,
        convertEol: true,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      _termCache.set(agentId, term)
      _fitCache.set(agentId, fitAddon)
    }

    term.open(containerRef.current)
    fitAddon?.fit()
    termRef.current = term
    fitAddonRef.current = fitAddon ?? null

    if (!isReused) {
      if (alwaysOn) {
        term.writeln('\x1b[1;32mOOMNI Terminal\x1b[0m — 워크스페이스 셸')
        term.writeln('\x1b[90m연결 중...\x1b[0m\r\n')
      } else {
        term.writeln('\x1b[1;32mOOMNI Build Terminal\x1b[0m — Claude Code 인터랙티브 모드')
        term.writeln('\x1b[90m봇을 실행하면 연결됩니다...\x1b[0m\r\n')
      }
    }

    const observer = new ResizeObserver(() => {
      try { fitAddon?.fit() } catch { /* ignore */ }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      // 캐시된 Terminal은 dispose하지 않음 — scrollback 유지 목적
      termRef.current = null
    }
  }, [agentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // isRunning 또는 alwaysOn 변경 시 WebSocket 연결/해제
  useEffect(() => {
    if (!alwaysOn && !isRunning) return

    const term = termRef.current
    const fitAddon = fitAddonRef.current
    if (!term || !fitAddon) return

    wsRef.current?.close()

    const cols = term.cols
    const rows = term.rows

    // role 또는 shellMode를 쿼리 파라미터로 전달
    // shellMode: 백엔드가 PowerShell/bash로 실행
    const modeParam = shellMode ? '&mode=shell' : ''
    const roleParam = role && !shellMode ? `&role=${role}` : ''
    const url = `${WS_URL}/api/agents/${agentId}/terminal?cols=${cols}&rows=${rows}${modeParam}${roleParam}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (role === 'design') {
        term.writeln('\r\n\x1b[1;33m▶ Design Bot — Claude Code 연결 중...\x1b[0m')
      } else {
        term.writeln('\r\n\x1b[1;33m▶ Claude Code 연결 중...\x1b[0m')
      }
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; data?: string; exitCode?: number }
        if (msg.type === 'replay' && msg.data) {
          // 재연결 시 백엔드 버퍼 리플레이 (새 Terminal 인스턴스인 경우만 의미있음)
          term.write(msg.data)
        } else if (msg.type === 'reconnected') {
          term.writeln('\r\n\x1b[90m[세션 재연결됨 — 이전 작업 계속]\x1b[0m\r\n')
          setConnected(true)
        } else if (msg.type === 'output' && msg.data) {
          term.write(msg.data)
          const plain = msg.data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
          outputBufRef.current += plain
          onOutputCapture?.(outputBufRef.current)
        } else if (msg.type === 'connected') {
          outputBufRef.current = ''
          if (shellMode) {
            term.writeln('\x1b[1;32m✓ 터미널 연결됨\x1b[0m — 워크스페이스 셸\r\n')
            term.writeln('\x1b[90m💡 claude 명령어로 Claude Code를 실행하세요\x1b[0m\r\n')
          } else if (role === 'design') {
            term.writeln('\x1b[1;32m✓ Design Bot 연결됨\x1b[0m — Claude Code 인터랙티브 모드\r\n')
            if (taskHint?.trim()) {
              term.writeln(`\x1b[90m📋 태스크 힌트: ${taskHint.trim()}\x1b[0m`)
              term.writeln('\x1b[90m(위 내용을 참고해 아래에 직접 입력하세요)\x1b[0m\r\n')
            }
          } else {
            term.writeln('\x1b[1;32m✓ Claude Code 연결됨\x1b[0m\r\n')
            if (taskHint?.trim()) {
              term.writeln(`\x1b[90m💡 태스크 힌트: ${taskHint.trim()}\x1b[0m`)
              term.writeln('\x1b[90m(위 내용을 참고해 아래에 직접 입력하세요)\x1b[0m\r\n')
            }
          }
        } else if (msg.type === 'exit') {
          const code = msg.exitCode ?? 0
          term.writeln(`\r\n\x1b[90m[프로세스 종료: 코드 ${code}]\x1b[0m`)
          setConnected(false)
          onExit?.(code)
        }
      } catch { /* ignore */ }
    }

    ws.onclose = () => { setConnected(false) }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m✗ WebSocket 연결 오류\x1b[0m — 백엔드 서버를 확인하세요')
      setConnected(false)
    }

    const disposeInput = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const disposeResize = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    return () => {
      disposeInput.dispose()
      disposeResize.dispose()
      ws.close()
      wsRef.current = null
      setConnected(false)
    }
  }, [alwaysOn, agentId, shellMode, role]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKill = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'kill' }))
    }
    wsRef.current?.close()
  }

  const handleResetSession = async () => {
    setResetting(true)
    try {
      await fetch(`http://localhost:3001/api/agents/${agentId}/terminal`, { method: 'DELETE' })
      wsRef.current?.close()
      wsRef.current = null
      setConnected(false)
      termRef.current?.clear()
      termRef.current?.writeln('\x1b[33m⟳ 세션 초기화됨 — 실행 버튼을 눌러 새로 시작하세요\x1b[0m\r\n')
    } finally {
      setResetting(false)
    }
  }

  // 툴바 레이블: role/shellMode에 따라 표시
  const termLabel = connected
    ? shellMode ? 'Terminal — 워크스페이스 셸'
    : role === 'design' ? 'Claude Code — Design Bot'
    : 'Claude Code — 인터랙티브'
    : '터미널'

  return (
    <div className={cn(
      'flex flex-col border-t border-border bg-[#0d0d0d] transition-all duration-200',
      expanded ? 'fixed inset-0 z-50' : '',
      className,
    )}>
      {/* 터미널 툴바 */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#111] border-b border-[#222] shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full transition-colors',
            connected ? 'bg-green-500 animate-pulse' : 'bg-[#444]',
          )} />
          <span className="text-xs font-mono text-[#888]">{termLabel}</span>
          {connected && (
            <span className="text-[10px] text-[#555] font-mono">ws://localhost:3001</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {connected && (
            <button
              onClick={handleKill}
              title="프로세스 종료 (Ctrl+C)"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[#888] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Square size={10} />
              종료
            </button>
          )}
          <button
            onClick={handleResetSession}
            disabled={resetting}
            title="봇 세션 초기화 — PTY 세션을 완전히 리셋합니다"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[#888] hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-40"
          >
            <RotateCcw size={10} className={resetting ? 'animate-spin' : ''} />
            세션초기화
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            title={expanded ? '원래 크기' : '전체화면'}
            className="p-1 rounded text-[#555] hover:text-[#888] transition-colors"
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* xterm.js 렌더링 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden p-1"
        style={{ minHeight: 0 }}
        onClick={() => termRef.current?.focus()}
      />
    </div>
  )
})
