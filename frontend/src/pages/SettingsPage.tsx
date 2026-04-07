import { useState, useRef } from 'react'
import { Download, Upload, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { backupApi } from '../lib/api'

export default function SettingsPage() {
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<unknown>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setMsg(null)
    setExportLoading(true)
    try {
      await backupApi.export()
      setMsg({ type: 'success', text: '데이터가 성공적으로 내보내졌습니다.' })
    } catch {
      setMsg({ type: 'error', text: '데이터 내보내기에 실패했습니다.' })
    } finally {
      setExportLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as unknown
        setPendingFile(data)
        setShowConfirm(true)
      } catch {
        setMsg({ type: 'error', text: 'JSON 파일을 읽을 수 없습니다.' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!pendingFile) return
    setShowConfirm(false)
    setImportLoading(true)
    setMsg(null)
    try {
      const result = await backupApi.import(pendingFile)
      setMsg({ type: 'success', text: result.message })
    } catch {
      setMsg({ type: 'error', text: '데이터 복원에 실패했습니다.' })
    } finally {
      setImportLoading(false)
      setPendingFile(null)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-text mb-6">설정</h1>

      {/* 데이터 관리 섹션 */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-4">
        <h2 className="text-base font-semibold text-text mb-1">데이터 백업 및 복원</h2>
        <p className="text-muted text-sm mb-5">
          OOMNI 데이터를 JSON 파일로 내보내거나, 파일에서 복원합니다.
        </p>

        <div className="space-y-3">
          {/* 내보내기 */}
          <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
            <div>
              <div className="text-[14px] font-medium text-text mb-0.5">데이터 내보내기</div>
              <div className="text-[12px] text-muted">
                미션, 봇, 이슈, 리서치 등 모든 데이터를 JSON으로 저장
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0"
            >
              {exportLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              내보내기
            </button>
          </div>

          {/* 가져오기 */}
          <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
            <div>
              <div className="text-[14px] font-medium text-text mb-0.5">데이터 가져오기</div>
              <div className="text-[12px] text-muted">
                백업 JSON 파일에서 데이터를 복원합니다
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-border border border-border text-text rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0"
            >
              {importLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              가져오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* 결과 메시지 */}
        {msg && (
          <div
            className={
              'flex items-center gap-2 mt-4 p-3 rounded-lg text-[13px] ' +
              (msg.type === 'success'
                ? 'bg-green-900/20 border border-green-800/30 text-green-400'
                : 'bg-red-900/20 border border-red-800/30 text-red-400')
            }
          >
            {msg.type === 'success' ? (
              <CheckCircle size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {msg.text}
          </div>
        )}
      </div>

      {/* 가져오기 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
              <h3 className="text-base font-semibold text-text">데이터 복원 확인</h3>
            </div>
            <p className="text-muted text-sm mb-5">
              기존 데이터가{' '}
              <span className="text-amber-400 font-medium">완전히 덮어씌워집니다</span>.
              {' '}이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setPendingFile(null) }}
                className="flex-1 py-2 border border-border rounded-lg text-[13px] text-muted hover:text-text transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleImportConfirm}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[13px] font-medium transition-colors"
              >
                덮어쓰기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
