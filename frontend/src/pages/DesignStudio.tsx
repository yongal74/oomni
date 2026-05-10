/**
 * DesignStudio.tsx — Design Studio (claude-opus-4-7 SDK)
 * v5.12.0
 */
import { useState, useEffect } from 'react'
import { Palette, Sparkles, ExternalLink, Play, Square, Loader2, AlertCircle } from 'lucide-react'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'

type OdStatus = 'checking' | 'online' | 'offline' | 'starting' | 'stopping'

export default function DesignStudio() {
  const { currentMission } = useAppStore()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ html_path?: string; message?: string } | null>(null)
  const [error, setError] = useState('')

  // Open Design 에디터 상태
  const [odStatus, setOdStatus] = useState<OdStatus>('checking')
  const [odError, setOdError] = useState('')

  const checkOdStatus = async () => {
    try {
      const res = await api.get('/api/setup/open-design/status')
      const data = res.data as { running?: boolean }
      setOdStatus(data.running ? 'online' : 'offline')
    } catch {
      setOdStatus('offline')
    }
  }

  useEffect(() => {
    checkOdStatus()
    const timer = setInterval(checkOdStatus, 8000)
    return () => clearInterval(timer)
  }, [])

  const handleStartOd = async () => {
    setOdStatus('starting')
    setOdError('')
    try {
      await api.post('/api/setup/open-design/start')
      await new Promise(r => setTimeout(r, 2000))
      await checkOdStatus()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setOdError(err?.response?.data?.error ?? 'Open Design 시작 실패')
      setOdStatus('offline')
    }
  }

  const handleStopOd = async () => {
    setOdStatus('stopping')
    try {
      await api.post('/api/setup/open-design/stop')
      await checkOdStatus()
    } catch {
      await checkOdStatus()
    }
  }

  const openOdEditor = () => {
    const el = window as { electronAPI?: { openExternal?: (u: string) => void } }
    const url = 'http://localhost:7456'
    if (el.electronAPI?.openExternal) {
      el.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  async function generate() {
    if (!prompt.trim() || !currentMission) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.post('/api/design/generate', {
        mission_id: currentMission.id,
        prompt: prompt.trim(),
      })
      setResult(res.data.data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err?.response?.data?.error ?? '생성 실패')
    } finally {
      setLoading(false)
    }
  }

  const odStatusColor = {
    checking: 'bg-yellow-400 animate-pulse',
    online: 'bg-green-500',
    offline: 'bg-[#444]',
    starting: 'bg-yellow-400 animate-pulse',
    stopping: 'bg-yellow-400 animate-pulse',
  }[odStatus]

  const odStatusLabel = {
    checking: '확인 중...',
    online: '실행 중',
    offline: '미실행',
    starting: '시작 중...',
    stopping: '종료 중...',
  }[odStatus]

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c20] shrink-0 flex-wrap gap-y-2">
        <Palette size={16} className="text-purple-400" />
        <span className="text-[14px] font-semibold text-[#e4e4e7]">Design Studio</span>
        <span className="text-[10px] text-purple-400/60 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
          claude-opus-4-7
        </span>

        {/* Open Design 에디터 상태 + 버튼 */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${odStatusColor}`} />
            <span className="text-[11px] text-[#71717a]">Open Design {odStatusLabel}</span>
          </div>

          {odStatus === 'online' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={openOdEditor}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
              >
                <ExternalLink size={10} /> 에디터 열기
              </button>
              <button
                onClick={handleStopOd}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border border-[#27272a] text-[#71717a] hover:text-red-400 hover:border-red-500/30 transition-colors"
              >
                <Square size={10} /> 종료
              </button>
            </div>
          ) : odStatus === 'offline' ? (
            <button
              onClick={handleStartOd}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors"
            >
              <Play size={10} /> Open Design 시작
            </button>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-[#52525b]">
              <Loader2 size={10} className="animate-spin" />
              {odStatus === 'starting' ? '시작 중...' : '종료 중...'}
            </div>
          )}
        </div>
      </div>

      {/* Open Design 에러 메시지 */}
      {odError && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
          <AlertCircle size={12} />
          {odError}
          <span className="ml-1 opacity-60">— pnpm이 설치되어 있는지 확인하세요</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 w-full max-w-3xl mx-auto">

        {/* Open Design 안내 배너 (오프라인 시) */}
        {odStatus === 'offline' && (
          <div className="mb-6 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <p className="text-[12px] text-purple-300 font-medium mb-1">Open Design 에디터 (.pen 파일 편집)</p>
            <p className="text-[11px] text-[#71717a] leading-relaxed">
              Design Bot의 Pencil MCP 연동 에디터입니다. 위 "Open Design 시작" 버튼으로 로컬 데몬을 실행한 후 에디터를 열어보세요.
              <br />시작이 안 될 경우: <code className="text-purple-400 bg-purple-500/10 px-1 rounded">npm install -g pnpm</code> 후 재시도
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-[11px] text-[#52525b] uppercase tracking-widest mb-2">
            AI 디자인 생성 (claude-opus-4-7)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="만들고 싶은 디자인을 설명하세요... (예: SaaS 대시보드 랜딩 페이지, 다크 테마, 모던 스타일)"
            rows={5}
            className="w-full bg-[#111113] border border-[#27272a] rounded-xl px-4 py-3 text-[13px] text-[#e4e4e7] placeholder-[#444] outline-none focus:border-purple-500/40 resize-none"
          />
        </div>

        <button
          onClick={generate}
          disabled={loading || !prompt.trim() || !currentMission}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-40 transition-colors text-[12px] font-medium"
        >
          <Sparkles size={13} />
          {loading ? 'claude-opus-4-7 생성 중...' : 'AI 디자인 생성'}
        </button>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 bg-[#111113] border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={12} className="text-green-400" />
              <span className="text-[12px] text-green-400 font-medium">디자인 생성 완료</span>
            </div>
            {result.message && (
              <p className="text-[11px] text-[#a1a1aa] mb-3">{result.message}</p>
            )}
            {result.html_path && (
              <button
                onClick={() => window.open(`file://${result.html_path}`, '_blank')}
                className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink size={11} />
                결과물 열기
              </button>
            )}
          </div>
        )}

        {!currentMission && (
          <div className="mt-6 text-[11px] text-[#444] text-center">
            미션을 먼저 선택하세요
          </div>
        )}
      </div>
    </div>
  )
}
