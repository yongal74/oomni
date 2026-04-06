import { useState } from 'react'
import { Archive, Check, AlertCircle, FolderOpen, X } from 'lucide-react'
import { obsidianApi, obsidianSettingsApi } from '../../../lib/api'

interface Props {
  content: string
  title?: string
  botRole: string
  tags?: string[]
}

export function ArchiveButton({ content, title, botRole, tags }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error' | 'setup'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [vaultInput, setVaultInput] = useState('')
  const [savingPath, setSavingPath] = useState(false)

  const doArchive = async () => {
    await obsidianApi.archive({
      title: title ?? `${botRole} 결과 ${new Date().toLocaleDateString('ko-KR')}`,
      content,
      bot_role: botRole,
      tags,
    })
  }

  const handleArchive = async () => {
    if (!content || status === 'saving') return
    setStatus('saving')
    try {
      const res = await obsidianApi.status()
      if (!res.configured) {
        setVaultInput(res.vault_path || '')
        setStatus('setup')
        return
      }
      await doArchive()
      setStatus('done')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '저장 실패')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const handleSavePath = async () => {
    if (!vaultInput.trim()) return
    setSavingPath(true)
    try {
      await obsidianSettingsApi.save(vaultInput.trim())
      await doArchive()
      setStatus('done')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '경로 저장 실패')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    } finally {
      setSavingPath(false)
    }
  }

  if (status === 'setup') {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={13} className="text-primary" />
            <span className="text-xs text-primary font-medium">Obsidian Vault 경로 설정</span>
          </div>
          <button onClick={() => setStatus('idle')} className="text-muted hover:text-text">
            <X size={12} />
          </button>
        </div>
        <p className="text-[11px] text-muted">Vault 폴더의 절대 경로를 입력하세요</p>
        <input
          type="text"
          value={vaultInput}
          onChange={e => setVaultInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSavePath() }}
          placeholder="C:\Users\username\Documents\ObsidianVault"
          className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-xs text-text placeholder-muted focus:outline-none focus:border-primary"
          autoFocus
        />
        <button
          onClick={handleSavePath}
          disabled={!vaultInput.trim() || savingPath}
          className="w-full py-1.5 rounded bg-primary text-white text-xs hover:bg-[#C5664A] disabled:opacity-50 transition-colors"
        >
          {savingPath ? '저장 중...' : '저장 후 아카이브'}
        </button>
      </div>
    )
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
