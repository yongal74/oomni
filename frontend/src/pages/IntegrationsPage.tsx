import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Trash2, CheckCircle, X } from 'lucide-react'

interface ProviderField {
  key: string
  label: string
  type: string
  placeholder?: string
}

interface Provider {
  id: string
  name: string
  icon: string
  authType: 'apikey' | 'oauth2'
  category: string
  description: string
  fields: ProviderField[]
}

interface Integration {
  id: string
  provider: string
  label: string
  is_active: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  ai: 'AI',
  communication: '커뮤니케이션',
  analytics: '분석',
  payments: '결제',
  dev: '개발',
  productivity: '생산성',
}

const CATEGORY_ORDER = ['all', 'ai', 'communication', 'analytics', 'payments', 'dev', 'productivity']

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const missionId = useAppStore(s => s.currentMission?.id)!
  const [connecting, setConnecting] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

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

  const connectedIds = new Set(integrations.map((i: Integration) => i.provider))

  // Compute which categories exist among providers
  const availableCategories = ['all', ...Array.from(new Set(providers.map((p: Provider) => p.category)))]
  const displayCategories = CATEGORY_ORDER.filter(c => availableCategories.includes(c))

  const filteredProviders = activeCategory === 'all'
    ? providers
    : providers.filter((p: Provider) => p.category === activeCategory)

  const connectedIntegrations = integrations.filter((i: Integration) => i.is_active)

  const openModal = (providerId: string) => {
    setConnecting(providerId)
    setForm({})
    setError('')
  }

  const closeModal = () => {
    setConnecting(null)
    setForm({})
    setError('')
  }

  const connectingProvider = providers.find((p: Provider) => p.id === connecting)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-text mb-1">서비스 연동</h1>
      <p className="text-muted text-[13px] mb-6">연결한 서비스를 봇들이 자동으로 활용합니다</p>

      {success && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-800/30 rounded text-green-400 text-[13px]">
          {success}
        </div>
      )}

      {/* Connected integrations section */}
      {connectedIntegrations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[13px] font-medium text-text mb-3">연결된 서비스</h2>
          <div className="flex flex-wrap gap-2">
            {connectedIntegrations.map((integration: Integration) => {
              const provider = providers.find((p: Provider) => p.id === integration.provider)
              return (
                <div
                  key={integration.id}
                  className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2"
                >
                  <span className="text-base">{provider?.icon ?? '🔌'}</span>
                  <span className="text-[12px] text-text">{provider?.name ?? integration.provider}</span>
                  <CheckCircle size={12} className="text-green-400" />
                  <button
                    onClick={() => remove.mutate(integration.id)}
                    className="ml-1 text-muted hover:text-red-400 transition-colors"
                    title="연동 해제"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {displayCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-muted hover:text-text'
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Provider cards grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredProviders.map((p: Provider) => {
          const isConnected = connectedIds.has(p.id)
          const integration = integrations.find((i: Integration) => i.provider === p.id)

          return (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{p.icon}</span>
                  <div>
                    <div className="text-[13px] font-medium text-text">{p.name}</div>
                    <div className="text-[11px] text-muted mt-0.5">{p.description}</div>
                  </div>
                </div>
                {isConnected && (
                  <span className="text-[10px] font-medium text-green-400 bg-green-900/20 border border-green-800/30 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                    연결됨
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => openModal(p.id)}
                  className="flex-1 py-1.5 rounded text-[12px] bg-[#2C271E] border border-border text-muted hover:text-text transition-colors"
                >
                  {isConnected ? '설정' : '연결하기'}
                </button>
                {isConnected && integration && (
                  <button
                    onClick={() => remove.mutate(integration.id)}
                    className="p-1.5 text-muted hover:text-red-400 border border-border rounded transition-colors"
                    title="연동 해제"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Connection modal */}
      {connecting && connectingProvider && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{connectingProvider.icon}</span>
                <div>
                  <div className="text-[14px] font-semibold text-text">{connectingProvider.name} 연결</div>
                  <div className="text-[11px] text-muted">{connectingProvider.description}</div>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-muted hover:text-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {connectingProvider.fields.map((f: ProviderField) => (
                <div key={f.key}>
                  <label className="text-[11px] text-muted block mb-1">{f.label}</label>
                  <input
                    type={f.type === 'password' ? 'password' : 'text'}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder ?? ''}
                    className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-[12px] text-text placeholder-muted focus:outline-none focus:border-primary"
                  />
                </div>
              ))}

              {error && <p className="text-red-400 text-[11px]">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => save.mutate({ provider: connectingProvider.id, credentials: form })}
                  disabled={save.isPending}
                  className="flex-1 bg-primary text-white py-2 rounded text-[12px] hover:bg-[#C5664A] disabled:opacity-50 transition-colors"
                >
                  {save.isPending ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 border border-border rounded text-[12px] text-muted hover:text-text transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
