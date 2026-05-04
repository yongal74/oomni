/**
 * DesignStudio.tsx — Design Studio (claude-opus-4-7 SDK)
 * v5.0.1
 */
import { useState } from 'react'
import { Palette, Sparkles, ExternalLink } from 'lucide-react'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'

export default function DesignStudio() {
  const { currentMission } = useAppStore()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ html_path?: string; message?: string } | null>(null)
  const [error, setError] = useState('')

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

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f]">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-[#1c1c20]">
        <Palette size={16} className="text-purple-400" />
        <span className="text-[14px] font-semibold text-[#e4e4e7]">Design Studio</span>
        <span className="ml-2 text-[10px] text-purple-400/60 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
          claude-opus-4-7
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <label className="block text-[11px] text-[#52525b] uppercase tracking-widest mb-2">
            디자인 프롬프트
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
          {loading ? 'claude-opus-4-7 생성 중...' : '디자인 생성'}
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
