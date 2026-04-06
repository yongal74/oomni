import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Square, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface StreamLine {
  type: 'output' | 'info' | 'error' | 'stage'
  text: string
  ts: string
}

interface Props {
  agentId: string
  task: string
  isRunning: boolean
  onStart?: () => void
  onStageChange?: (stage: string) => void
  onDone?: () => void
  onError?: (msg: string) => void
  onOutputChunk?: (chunk: string) => void
  esRef: React.MutableRefObject<EventSource | null>
}

export function LiveStreamDrawer({
  agentId, task, isRunning, onStageChange, onDone, onError, onOutputChunk, esRef
}: Props) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<StreamLine[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const bottomRef = useRef<HTMLDivElement>(null)

  // 실행 시작 시 자동 오픈
  useEffect(() => {
    if (isRunning) setOpen(true)
  }, [isRunning])

  // SSE 연결 (isRunning + task 변경 시)
  useEffect(() => {
    if (!isRunning) return
    setLines([])
    setStatus('running')
    const errorHandled = { current: false }

    const url = `http://localhost:3001/api/agents/${agentId}/stream?task=${encodeURIComponent(task)}`
    const es = new EventSource(url)
    esRef.current = es

    const addLine = (type: StreamLine['type'], text: string) => {
      setLines(prev => [...prev, { type, text, ts: new Date().toLocaleTimeString('ko-KR', { hour12: false }) }])
    }

    es.addEventListener('start', () => {
      addLine('info', '▶ 실행 시작')
    })
    es.addEventListener('output', (e) => {
      const data = JSON.parse(e.data)
      const chunk = data.chunk || ''
      addLine('output', chunk)
      onOutputChunk?.(chunk)
    })
    es.addEventListener('stage', (e) => {
      const data = JSON.parse(e.data)
      addLine('info', `→ ${data.label}`)
      onStageChange?.(data.stage)
    })
    es.addEventListener('done', () => {
      setStatus('done')
      addLine('info', '✅ 완료')
      es.close()
      esRef.current = null
      onDone?.()
    })
    es.addEventListener('error', (e) => {
      // 커스텀 서버 error 이벤트 (data 있음) vs 연결 오류 (data 없음) 구분
      const rawData = (e as MessageEvent).data
      if (!rawData) return // 연결 오류는 onerror에서 처리
      errorHandled.current = true
      try {
        const msg = JSON.parse(rawData)
        setStatus('error')
        addLine('error', msg.message || '실행 오류')
        es.close()
        esRef.current = null
        onError?.(msg.message || '실행 오류')
      } catch {
        setStatus('error')
        addLine('error', rawData)
        es.close()
        esRef.current = null
        onError?.(rawData)
      }
    })
    es.onerror = () => {
      if (errorHandled.current) return // 이미 커스텀 에러로 처리됨
      setStatus('error')
      addLine('error', '서버 연결 실패 — API 키를 확인하거나 앱을 재시작하세요')
      es.close()
      esRef.current = null
      onError?.('연결 오류')
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [isRunning, agentId, task]) // eslint-disable-line react-hooks/exhaustive-deps

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const handleStop = () => {
    esRef.current?.close()
    esRef.current = null
    setStatus('done')
  }

  const height = open ? 'h-56' : 'h-0'

  return (
    <div className="border-t border-border">
      {/* 스트림 패널 (슬라이드) */}
      <div className={cn('overflow-hidden transition-all duration-200', height)}>
        <div className="h-full bg-[#0d0d0d] overflow-y-auto px-4 py-2 font-mono text-sm">
          {lines.length === 0 && (
            <span className="text-muted">대기 중...</span>
          )}
          {lines.map((line, i) => (
            <div key={i} className={cn(
              'mb-0.5 whitespace-pre-wrap break-words leading-relaxed',
              line.type === 'error' ? 'text-red-400' :
              line.type === 'info' ? 'text-primary/80' :
              'text-green-400/90'
            )}>
              <span className="text-muted/50 mr-2 select-none">{line.ts}</span>
              {line.text}
            </div>
          ))}
          {status === 'running' && (
            <span className="inline-block w-1.5 h-3.5 bg-green-400 animate-pulse ml-0.5 align-middle" />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 토글 바 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-1.5 bg-surface hover:bg-border/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {status === 'running' ? (
            <Loader2 size={12} className="text-primary animate-spin" />
          ) : status === 'done' ? (
            <span className="w-2 h-2 rounded-full bg-green-500" />
          ) : status === 'error' ? (
            <span className="w-2 h-2 rounded-full bg-red-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-muted/40" />
          )}
          <span className="text-xs text-muted">
            {status === 'running' ? '실행 중...' :
             status === 'done' ? '완료' :
             status === 'error' ? '오류' : '실행 로그'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleStop() }}
              className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors"
            >
              <Square size={10} /> 중지
            </button>
          )}
          {open ? <ChevronDown size={13} className="text-muted" /> : <ChevronUp size={13} className="text-muted" />}
        </div>
      </button>
    </div>
  )
}
