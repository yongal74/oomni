/**
 * XTerminal.tsx — xterm.js + WebSocket 기반 진짜 터미널 컴포넌트
 *
 * Build Bot이 Claude Code CLI를 진짜 인터랙티브 터미널처럼 실행:
 * - xterm.js: 색상, 스피너, Tab 완성, Ctrl+C 모두 동작
 * - WebSocket: 키보드 입력 → 백엔드 PTY → 결과 스트리밍
 */
import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { Square, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { cn } from '../../lib/utils'
import 'xterm/css/xterm.css'

interface Props {
  agentId: string
  isRunning: boolean
  /** true: 마운트 즉시 연결 (isRunning 무관) — Antigravity IDE 스타일 항상-켜진 터미널 */
  alwaysOn?: boolean
  /** true: PowerShell/bash 셸 모드 / false(기본): Claude Code CLI 모드 */
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

export function XTerminal({ agentId, isRunning, alwaysOn, shellMode, taskHint, onExit, onOutputCapture, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const outputBufRef = useRef<string>('')  // PTY 출력 누적 (ANSI 제거 후)
  const [connected, setConnected] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [resetting, setResetting] = useState(false)

  // 터미널 초기화
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Menlo, monospace',
      theme: {
        background: '#0d0d0d',
        foreground: '#e8e8e8',
        cursor: '#D4763B',
        cursorAccent: '#0d0d0d',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#44475a',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
        selectionBackground: '#D4763B40',
      },
      allowTransparency: false,
      scrollback: 5000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    if (alwaysOn) {
      term.writeln('\x1b[1;32mOOMNI Terminal\x1b[0m — 워크스페이스 셸')
      term.writeln('\x1b[90m연결 중...\x1b[0m\r\n')
    } else {
      term.writeln('\x1b[1;32mOOMNI Build Terminal\x1b[0m — Claude Code 인터랙티브 모드')
      term.writeln('\x1b[90m봇을 실행하면 연결됩니다...\x1b[0m\r\n')
    }

    // 리사이즈 감지
    const observer = new ResizeObserver(() => {
      try { fitAddon.fit() } catch { /* ignore */ }
    })
    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // isRunning 또는 alwaysOn 변경 시 WebSocket 연결/해제
  useEffect(() => {
    // alwaysOn: 마운트 즉시 연결 / 일반: isRunning=true 시 연결
    if (!alwaysOn && !isRunning) {
      // 실행 중지 시 연결 유지 (터미널 내용 보존)
      return
    }

    const term = termRef.current
    const fitAddon = fitAddonRef.current
    if (!term || !fitAddon) return

    // 이전 연결 정리
    wsRef.current?.close()

    const cols = term.cols
    const rows = term.rows
    const modeParam = shellMode ? '&mode=shell' : ''
    const url = `${WS_URL}/api/agents/${agentId}/terminal?cols=${cols}&rows=${rows}${modeParam}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      term.writeln('\r\n\x1b[1;33m▶ Claude Code 연결 중...\x1b[0m')
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; data?: string; exitCode?: number }
        if (msg.type === 'output' && msg.data) {
          term.write(msg.data)
          // ANSI 이스케이프 제거 후 텍스트 누적 (산출물 전달용)
          const plain = msg.data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
          outputBufRef.current += plain
          onOutputCapture?.(outputBufRef.current)
        } else if (msg.type === 'connected') {
          outputBufRef.current = ''
          if (shellMode) {
            term.writeln('\x1b[1;32m✓ 터미널 연결됨\x1b[0m — 워크스페이스 셸\r\n')
            term.writeln('\x1b[90m💡 claude --dangerously-skip-permissions 로 Claude Code 실행\x1b[0m\r\n')
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

    ws.onclose = () => {
      setConnected(false)
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m✗ WebSocket 연결 오류\x1b[0m — 백엔드 서버를 확인하세요')
      setConnected(false)
    }

    // 키보드 입력 → WebSocket 송신
    const disposeInput = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // 터미널 리사이즈 → PTY 리사이즈
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
  }, [isRunning, alwaysOn, agentId, shellMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKill = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'kill' }))
    }
    wsRef.current?.close()
  }

  // 세션 초기화: PTY 세션 강제 종료 후 터미널 클리어
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
          <span className="text-xs font-mono text-[#888]">
            {connected ? (shellMode ? 'Terminal — 워크스페이스 셸' : 'Claude Code — 인터랙티브') : '터미널'}
          </span>
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
}
