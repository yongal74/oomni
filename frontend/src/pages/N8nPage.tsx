import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { n8nApi } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Zap, CheckCircle, XCircle, ChevronDown } from 'lucide-react'

interface Template { id: string; name: string; description: string }
interface Workflow { id: string; name: string; active: boolean }

export default function N8nPage() {
  useQueryClient()
  const missionId = useAppStore(s => s.currentMission?.id)!
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({})
  const [deployMsg, setDeployMsg] = useState('')
  const [testing, setTesting] = useState(false)

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['n8n-templates'],
    queryFn: n8nApi.templates,
  })

  const { data: workflows = [], refetch: refetchWf } = useQuery<Workflow[]>({
    queryKey: ['n8n-workflows', missionId],
    queryFn: () => n8nApi.workflows(missionId),
    enabled: isConnected === true,
    retry: false,
  })

  const testConn = async () => {
    setTesting(true)
    const result = await n8nApi.test(missionId).catch(() => ({ connected: false }))
    setIsConnected(result.connected)
    setTesting(false)
  }

  const deploy = useMutation({
    mutationFn: (tmpl: Template) => n8nApi.deploy({
      mission_id: missionId,
      template_id: tmpl.id,
      params: templateParams,
      activate: true,
    }),
    onSuccess: (data) => {
      setDeployMsg(data.message ?? '워크플로우가 활성화됐습니다!')
      setSelectedTemplate(null)
      setTemplateParams({})
      setTimeout(() => setDeployMsg(''), 4000)
      refetchWf()
    },
    onError: () => setDeployMsg('배포 실패. n8n 연결을 확인해주세요.'),
  })

  const TEMPLATE_PARAMS: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
    'slack-notify': [{ key: 'channel', label: 'Slack 채널', placeholder: '#general' }],
    'notion-save': [{ key: 'database', label: 'Notion DB ID', placeholder: 'xxxxxxxx-...' }],
    'gmail-notify': [
      { key: 'to', label: '받는 사람', placeholder: 'you@example.com' },
      { key: 'subject', label: '제목', placeholder: 'OOMNI 알림' },
    ],
    'google-sheets-append': [
      { key: 'spreadsheetId', label: 'Spreadsheet ID', placeholder: '1BxiMVs0...' },
      { key: 'sheet', label: 'Sheet 이름', placeholder: 'Sheet1' },
    ],
    'stripe-report': [],
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={18} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">n8n 자동화</h1>
      </div>
      <p className="text-muted text-[13px] mb-6">말하면 자동화됩니다. 딸깍 하나로 워크플로우 배포</p>

      {/* 연결 상태 */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected === null && <div className="w-3 h-3 rounded-full bg-muted" />}
            {isConnected === true && <CheckCircle size={16} className="text-green-400" />}
            {isConnected === false && <XCircle size={16} className="text-red-400" />}
            <div>
              <div className="text-[13px] font-medium text-text">n8n 연결</div>
              <div className="text-[11px] text-muted">
                {isConnected === null ? '연결 확인 필요' : isConnected ? '연결됨' : '연결 안됨 — 연동 설정 필요'}
              </div>
            </div>
          </div>
          <button
            onClick={testConn}
            disabled={testing}
            className="px-3 py-1.5 bg-[#1E1E20] border border-border rounded text-[12px] text-muted hover:text-text disabled:opacity-50"
          >
            {testing ? '확인 중...' : '연결 테스트'}
          </button>
        </div>
        {isConnected === false && (
          <p className="mt-3 text-[11px] text-muted">
            먼저 <a href="/dashboard/integrations" className="text-primary hover:underline">서비스 연동</a>에서 n8n URL과 API 키를 등록해주세요
          </p>
        )}
      </div>

      {deployMsg && (
        <div className={`mb-4 p-3 rounded text-[13px] ${deployMsg.includes('실패') ? 'bg-red-900/20 border border-red-800/30 text-red-400' : 'bg-green-900/20 border border-green-800/30 text-green-400'}`}>
          {deployMsg}
        </div>
      )}

      {/* 템플릿 목록 */}
      <h3 className="text-[13px] font-medium text-text mb-3">워크플로우 템플릿</h3>
      <div className="grid grid-cols-1 gap-3 mb-6">
        {templates.map((tmpl: Template) => {
          const isOpen = selectedTemplate?.id === tmpl.id
          const params = TEMPLATE_PARAMS[tmpl.id] ?? []
          return (
            <div key={tmpl.id} className="bg-surface border border-border rounded-xl">
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setSelectedTemplate(isOpen ? null : tmpl)}
              >
                <div>
                  <div className="text-[13px] font-medium text-text">{tmpl.name}</div>
                  <div className="text-[11px] text-muted mt-0.5">{tmpl.description}</div>
                </div>
                <ChevronDown size={14} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  {params.map(p => (
                    <div key={p.key}>
                      <label className="text-[11px] text-muted block mb-1">{p.label}</label>
                      <input
                        type="text"
                        value={templateParams[p.key] ?? ''}
                        onChange={e => setTemplateParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                        placeholder={p.placeholder}
                        className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-[12px] text-text placeholder-muted focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => deploy.mutate(tmpl)}
                    disabled={deploy.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-white rounded text-[13px] hover:bg-[#C5664A] disabled:opacity-50"
                  >
                    <Zap size={14} />
                    {deploy.isPending ? '배포 중...' : '딸깍 — 워크플로우 활성화'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 활성 워크플로우 */}
      {workflows.length > 0 && (
        <div>
          <h3 className="text-[13px] font-medium text-text mb-3">활성 워크플로우 ({workflows.length})</h3>
          <div className="space-y-2">
            {workflows.map((wf: Workflow) => (
              <div key={wf.id} className="bg-surface border border-border rounded-lg p-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${wf.active ? 'bg-green-500' : 'bg-[#444]'}`} />
                <span className="text-[13px] text-text flex-1">{wf.name}</span>
                <span className="text-[10px] text-muted">{wf.active ? '활성' : '비활성'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
