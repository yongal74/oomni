import { useEffect, useRef, useState } from 'react'
import { Square } from 'lucide-react'

interface Props {
  agentId: string
  runId?: string
  onDone?: (output: string) => void
}

type StreamStatus = 'connecting' | 'running' | 'done' | 'error'

export function BotStreamOutput({ agentId, onDone }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const fullOutputRef = useRef<string>('')

  useEffect(() => {
    const es = new EventSource(`http://localhost:3001/api/agents/${agentId}/stream`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg: { type: 'start' | 'output' | 'done' | 'error'; data: string } = JSON.parse(e.data)

        if (msg.type === 'start') {
          setStatus('running')
        } else if (msg.type === 'output') {
          setStatus('running')
          fullOutputRef.current += msg.data
          setLines(prev => [...prev, msg.data])
        } else if (msg.type === 'done') {
          setStatus('done')
          es.close()
          esRef.current = null
          onDone?.(fullOutputRef.current)
        } else if (msg.type === 'error') {
          setStatus('error')
          if (msg.data) setLines(prev => [...prev, `오류: ${msg.data}`])
          es.close()
          esRef.current = null
        }
      } catch {
        // ignore malformed messages
      }
    }

    es.onerror = () => {
      setStatus('error')
      es.close()
      esRef.current = null
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [agentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  const handleStop = () => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setStatus('done')
  }

  const statusIndicator = () => {
    if (status === 'connecting' || status === 'running') {
      return (
        <span className="flex items-center gap-1.5 text-yellow-400">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          실행 중...
        </span>
      )
    }
    if (status === 'done') {
      return <span className="text-green-400">&#10003; 완료</span>
    }
    return <span className="text-red-400">&#10007; 오류</span>
  }

  return (
    <div className="bg-bg border border-border rounded-lg overflow-hidden">
      {/* Terminal header bar — UI chrome uses warm-brown tokens */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <div className="text-[11px] font-mono">{statusIndicator()}</div>
        {(status === 'connecting' || status === 'running') && (
          <button
            onClick={handleStop}
            className="flex items-center gap-1 text-[11px] text-muted hover:text-red-400 transition-colors"
          >
            <Square size={11} />
            중지
          </button>
        )}
        {(status === 'done' || status === 'error') && (
          <span className="w-[48px]" /> /* spacer to balance layout */
        )}
      </div>

      {/* Output area — intentionally black terminal aesthetic */}
      <div
        ref={outputRef}
        className="bg-black text-green-400 font-mono text-sm px-4 py-3 h-64 overflow-y-auto whitespace-pre-wrap break-words"
      >
        {lines.length === 0 && status === 'connecting' && (
          <span className="text-muted text-[12px]">스트림 연결 중...</span>
        )}
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {(status === 'connecting' || status === 'running') && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  )
}
