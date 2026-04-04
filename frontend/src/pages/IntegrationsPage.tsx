import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'

interface Provider { id: string; name: string; icon: string; authType: 'apikey' | 'oauth2' }
interface Integration { id: string; provider: string; label: string; is_active: boolean }

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const missionId = useAppStore(s => s.currentMission?.id)!
  const [connecting, setConnecting] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: integrationsApi.providers,
  })

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ['integrations', missionId],
    queryFn: () => integrationsApi.list(missionId),
    enabled: !!missionId,
  })

  const save = useMutation({
    mutationFn: (data: { provider: string; credentials: Record<string, string> }) =>
      integrationsApi.save({ mission_id: missionId, ...data, label: data.provider }),
    onSuccess: () => {
      setConnecting(null)
      setForm({})
      setError('')
      setSuccess('연동 완료!')
      setTimeout(() => setSuccess(''), 3000)
      qc.invalidateQueries({ queryKey: ['integrations'] })
    },
    onError: () => setError('연동에 실패했습니다. 입력값을 확인해주세요.'),
  })

  const remove = useMutation({
    mutationFn: integrationsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  })

  const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
    slack: [{ key: 'token', label: 'Bot Token', placeholder: 'xoxb-...' }],
    notion: [{ key: 'token', label: 'Integration Token', placeholder: 'secret_...' }],
    gmail: [{ key: 'token', label: 'OAuth Token', placeholder: 'ya29...' }],
    stripe: [{ key: 'apiKey', label: 'Secret Key', placeholder: 'sk_live_...' }],
    github: [{ key: 'token', label: 'Personal Access Token', placeholder: 'ghp_...' }],
    google_sheets: [{ key: 'token', label: 'OAuth Token', placeholder: 'ya29...' }],
    n8n: [
      { key: 'baseUrl', label: 'n8n URL', placeholder: 'http://localhost:5678' },
      { key: 'apiKey', label: 'API Key', placeholder: 'n8n_api_...' },
    ],
    hubspot: [{ key: 'apiKey', label: 'API Key', placeholder: 'pat-...' }],
    linear: [{ key: 'apiKey', label: 'API Key', placeholder: 'lin_api_...' }],
    figma: [{ key: 'token', label: 'Personal Access Token', placeholder: 'figd_...' }],
  }

  const connectedIds = new Set(integrations.map((i: Integration) => i.provider))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-text mb-2">서비스 연동</h1>
      <p className="text-muted text-[13px] mb-6">연결한 서비스를 봇들이 자동으로 활용합니다</p>

      {success && <div className="mb-4 p-3 bg-green-900/20 border border-green-800/30 rounded text-green-400 text-[13px]">{success}</div>}

      <div className="grid grid-cols-2 gap-3">
        {providers.map((p: Provider) => {
          const isConnected = connectedIds.has(p.id)
          const integration = integrations.find((i: Integration) => i.provider === p.id)
          const isOpen = connecting === p.id
          const fields = CREDENTIAL_FIELDS[p.id] ?? []

          return (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-[13px] font-medium text-text">{p.name}</span>
                </div>
                {isConnected
                  ? <CheckCircle size={14} className="text-green-400" />
                  : <XCircle size={14} className="text-muted" />
                }
              </div>
              <div className="text-[11px] text-muted mb-3">
                {isConnected ? '연결됨' : `${p.authType === 'oauth2' ? 'OAuth2' : 'API Key'} 인증`}
              </div>

              {isOpen && (
                <div className="mb-3 space-y-2">
                  {fields.map(f => (
                    <div key={f.key}>
                      <label className="text-[11px] text-muted block mb-1">{f.label}</label>
                      <input
                        type="password"
                        value={form[f.key] ?? ''}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-[12px] text-text placeholder-muted focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                  {error && <p className="text-red-400 text-[11px]">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => save.mutate({ provider: p.id, credentials: form })}
                      disabled={save.isPending}
                      className="flex-1 bg-primary text-white py-1.5 rounded text-[12px] hover:bg-[#C5664A] disabled:opacity-50"
                    >
                      {save.isPending ? '저장 중...' : '저장'}
                    </button>
                    <button onClick={() => { setConnecting(null); setError('') }} className="px-3 py-1.5 border border-border rounded text-[12px] text-muted hover:text-text">
                      취소
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {!isOpen && (
                  <button
                    onClick={() => { setConnecting(p.id); setError('') }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[12px] bg-[#1E1E20] border border-border text-muted hover:text-text"
                  >
                    <Plus size={12} />
                    {isConnected ? '재연결' : '연결'}
                  </button>
                )}
                {isConnected && integration && !isOpen && (
                  <button
                    onClick={() => remove.mutate(integration.id)}
                    className="p-1.5 text-muted hover:text-red-400 border border-border rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
