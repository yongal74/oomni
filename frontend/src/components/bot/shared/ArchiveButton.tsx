import { useState } from 'react'
import { Archive, Check, AlertCircle } from 'lucide-react'
import { obsidianApi } from '../../../lib/api'

interface Props {
  content: string
  title?: string
  botRole: string
  tags?: string[]
}

export function ArchiveButton({ content, title, botRole, tags }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleArchive = async () => {
    if (!content || status === 'saving') return
    setStatus('saving')
    try {
      const res = await obsidianApi.status()
      if (!res.configured) {
        setErrorMsg('Obsidian vault 경로를 설정에서 입력해주세요')
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
        return
      }
      await obsidianApi.archive({
        title: title ?? `${botRole} 결과 ${new Date().toLocaleDateString('ko-KR')}`,
        content,
        bot_role: botRole,
        tags,
      })
      setStatus('done')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '저장 실패')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div>
      <button
        onClick={handleArchive}
        disabled={!content || status === 'saving'}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border text-dim hover:border-primary/40 hover:text-text transition-colors disabled:opacity-40"
      >
        {status === 'done' ? <Check size={14} className="text-green-400" /> :
         status === 'error' ? <AlertCircle size={14} className="text-red-400" /> :
         <Archive size={14} />}
        <span className="text-sm">
          {status === 'saving' ? '저장 중...' :
           status === 'done' ? 'Obsidian 저장 완료!' :
           status === 'error' ? errorMsg :
           'Obsidian에 아카이브'}
        </span>
      </button>
    </div>
  )
}
