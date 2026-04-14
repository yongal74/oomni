import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Check, Key } from 'lucide-react'
import { cn } from '../../lib/utils'

// ── 모델 카탈로그 ──────────────────────────────────────────────────────────────
export type ModelId =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'
  | 'gpt-4o'
  | 'gpt-4.1'
  | 'sonar-pro'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'

export type ModeId = 'default' | 'research' | 'code'

interface ModelSpec {
  id: ModelId
  label: string
  shortLabel: string
  description: string
  provider: 'anthropic' | 'openai' | 'perplexity' | 'google'
}

interface ProviderGroup {
  key: 'anthropic' | 'openai' | 'perplexity' | 'google'
  label: string
  apiKeyName?: string   // localStorage key
  apiKeyHeader?: string // X-* header name
  models: ModelSpec[]
}

const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    models: [
      { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',    shortLabel: 'Opus 4.6',    description: '가장 강력, 느림',    provider: 'anthropic' },
      { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6',  shortLabel: 'Sonnet 4.6',  description: '균형, 기본값',       provider: 'anthropic' },
      { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',   shortLabel: 'Haiku 4.5',   description: '빠름, 저비용',       provider: 'anthropic' },
    ],
  },
  {
    key: 'openai',
    label: 'OpenAI',
    apiKeyName: 'oomni_openai_key',
    apiKeyHeader: 'X-OpenAI-Key',
    models: [
      { id: 'gpt-4o',  label: 'GPT-4o',  shortLabel: 'GPT-4o',  description: '멀티모달, 최신',  provider: 'openai' },
      { id: 'gpt-4.1', label: 'GPT-4.1', shortLabel: 'GPT-4.1', description: '빠르고 효율적',  provider: 'openai' },
    ],
  },
  {
    key: 'perplexity',
    label: 'Perplexity',
    apiKeyName: 'oomni_perplexity_key',
    apiKeyHeader: 'X-Perplexity-Key',
    models: [
      { id: 'sonar-pro', label: 'Sonar Pro', shortLabel: 'Sonar Pro', description: '실시간 웹 검색', provider: 'perplexity' },
    ],
  },
  {
    key: 'google',
    label: 'Google',
    apiKeyName: 'oomni_gemini_key',
    apiKeyHeader: 'X-Gemini-Key',
    models: [
      { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro',   shortLabel: 'Gemini Pro',   description: '강력한 멀티모달',  provider: 'google' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', shortLabel: 'Gemini Flash', description: '빠른 응답',        provider: 'google' },
    ],
  },
]

// 모든 모델 플랫 맵
const MODEL_MAP: Record<ModelId, ModelSpec> = Object.fromEntries(
  PROVIDER_GROUPS.flatMap(g => g.models.map(m => [m.id, m]))
) as Record<ModelId, ModelSpec>

// 모드 정의
interface ModeSpec {
  id: ModeId
  label: string
  description: string
  roles: string[]  // 이 모드를 노출할 봇 역할 (빈 배열 = 항상)
}

const MODES: ModeSpec[] = [
  { id: 'default',  label: '기본',        description: '일반 대화',         roles: [] },
  { id: 'research', label: '리서치 모드', description: '웹 검색 포함',      roles: ['research'] },
  { id: 'code',     label: '코드 모드',   description: '코드 최적화',        roles: ['build'] },
]

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  selectedModel: ModelId
  selectedMode: ModeId
  botRole: string
  onModelChange: (model: ModelId) => void
  onModeChange: (mode: ModeId) => void
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export function ModelSwitcher({ selectedModel, selectedMode, botRole, onModelChange, onModeChange }: Props) {
  const [open, setOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const savedFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // localStorage에서 저장된 API 키 읽기
  useEffect(() => {
    const loaded: Record<string, string> = {}
    for (const g of PROVIDER_GROUPS) {
      if (g.apiKeyName) {
        loaded[g.apiKeyName] = localStorage.getItem(g.apiKeyName) ?? ''
      }
    }
    setApiKeys(loaded)
  }, [open])

  // 외부 클릭 시 팝오버 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentModel = MODEL_MAP[selectedModel]
  const selectedProvider = PROVIDER_GROUPS.find(g => g.key === currentModel?.provider)

  // savedFeedbackTimer cleanup — 언마운트 후 setState 방지
  useEffect(() => {
    return () => {
      if (savedFeedbackTimerRef.current !== null) {
        clearTimeout(savedFeedbackTimerRef.current)
      }
    }
  }, [])

  const handleSaveKey = useCallback((keyName: string) => {
    const val = apiKeys[keyName] ?? ''
    localStorage.setItem(keyName, val)
    setSavedFeedback(keyName)
    if (savedFeedbackTimerRef.current !== null) clearTimeout(savedFeedbackTimerRef.current)
    savedFeedbackTimerRef.current = setTimeout(() => {
      setSavedFeedback(null)
      savedFeedbackTimerRef.current = null
    }, 2000)
  }, [apiKeys])

  // 현재 봇에서 보여줄 모드
  const availableModes = MODES.filter(m => m.roles.length === 0 || m.roles.includes(botRole))

  // 트리거 버튼의 표시 텍스트
  const triggerLabel = currentModel ? currentModel.shortLabel : selectedModel

  return (
    <div className="relative">
      {/* 트리거 버튼 */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
          'bg-surface border border-border text-muted hover:text-text hover:border-primary/40',
          open && 'border-primary/50 text-text bg-primary/5'
        )}
        title="모델 / 모드 전환"
      >
        <ProviderIcon provider={currentModel?.provider ?? 'anthropic'} size={13} />
        <span className="max-w-[90px] truncate">{triggerLabel}</span>
        <ChevronDown size={11} className={cn('transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {/* 팝오버 */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-0 mb-2 z-50"
          style={{
            width: 280,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#0d0d0f',
            border: '1px solid #2a2a30',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          }}
        >
          {/* 섹션 1 — 모델 선택 */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-semibold text-muted/60 uppercase tracking-wider mb-2">모델</p>
            {PROVIDER_GROUPS.map(group => (
              <div key={group.key} className="mb-3">
                {/* 프로바이더 헤더 */}
                <div className="flex items-center gap-1.5 mb-1">
                  <ProviderIcon provider={group.key} size={12} />
                  <span className="text-[10px] text-muted font-medium">{group.label}</span>
                </div>
                {/* 모델 목록 */}
                <div className="space-y-0.5 ml-1">
                  {group.models.map(model => {
                    const isSelected = selectedModel === model.id
                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          onModelChange(model.id)
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors',
                          isSelected
                            ? 'bg-primary/10 border border-primary/30 text-primary'
                            : 'text-muted hover:text-white hover:bg-white/5 border border-transparent'
                        )}
                      >
                        <span className={cn('w-3 h-3 rounded-full border flex items-center justify-center shrink-0',
                          isSelected ? 'border-primary' : 'border-white/20'
                        )}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </span>
                        <span className="flex-1 text-xs">{model.label}</span>
                        <span className="text-[10px] text-muted/60 shrink-0">{model.description}</span>
                      </button>
                    )
                  })}
                </div>

                {/* API 키 입력 (Anthropic 외 제공사 + 해당 프로바이더 모델 선택 시) */}
                {group.apiKeyName && selectedProvider?.key === group.key && (
                  <div className="mt-2 ml-1">
                    <div
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                      style={{ background: '#1a1a20', border: '1px solid #2a2a30' }}
                    >
                      <Key size={11} className="text-muted/60 shrink-0" />
                      <input
                        type="password"
                        placeholder={`${group.label} API Key`}
                        value={apiKeys[group.apiKeyName] ?? ''}
                        onChange={e => setApiKeys(prev => ({ ...prev, [group.apiKeyName!]: e.target.value }))}
                        className="flex-1 bg-transparent text-xs text-white placeholder-muted/40 outline-none min-w-0"
                        autoComplete="off"
                      />
                      <button
                        onClick={() => handleSaveKey(group.apiKeyName!)}
                        className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors shrink-0',
                          savedFeedback === group.apiKeyName
                            ? 'text-green-400'
                            : 'text-primary hover:text-white'
                        )}
                      >
                        {savedFeedback === group.apiKeyName ? (
                          <span className="flex items-center gap-0.5"><Check size={10} /> 저장됨</span>
                        ) : '저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 구분선 */}
          {availableModes.length > 1 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

              {/* 섹션 2 — 모드 선택 */}
              <div className="px-3 py-2.5">
                <p className="text-[10px] font-semibold text-muted/60 uppercase tracking-wider mb-2">모드</p>
                <div className="space-y-0.5">
                  {availableModes.map(mode => {
                    const isSelected = selectedMode === mode.id
                    return (
                      <button
                        key={mode.id}
                        onClick={() => {
                          onModeChange(mode.id)
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors',
                          isSelected
                            ? 'bg-primary/10 border border-primary/30 text-primary'
                            : 'text-muted hover:text-white hover:bg-white/5 border border-transparent'
                        )}
                      >
                        <span className={cn('w-3 h-3 rounded-full border flex items-center justify-center shrink-0',
                          isSelected ? 'border-primary' : 'border-white/20'
                        )}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </span>
                        <span className="flex-1 text-xs">{mode.label}</span>
                        <span className="text-[10px] text-muted/60 shrink-0">{mode.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── 프로바이더 아이콘 (SVG 인라인) ─────────────────────────────────────────────
function ProviderIcon({ provider, size = 14 }: { provider: string; size?: number }) {
  const s = size
  if (provider === 'anthropic') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M13.8 3H17.4L24 21H20.4L13.8 3Z" fill="#c084fc" />
        <path d="M6.6 3H10.2L16.8 21H13.2L6.6 3Z" fill="#c084fc" opacity="0.6" />
        <path d="M0 21L6.6 3H10.2L3.6 21H0Z" fill="#c084fc" opacity="0.4" />
      </svg>
    )
  }
  if (provider === 'openai') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="#10a37f" strokeWidth="2" />
        <path d="M8 12a4 4 0 0 1 8 0" stroke="#10a37f" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (provider === 'perplexity') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#20b2aa" opacity="0.85" />
        <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (provider === 'google') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    )
  }
  return <span style={{ width: s, height: s, display: 'inline-block', background: '#888', borderRadius: 2 }} />
}

// ── 헬퍼: 현재 선택된 모델에 맞는 API 키 + 헤더명 반환 ──────────────────────
export function getModelApiHeaders(modelId: ModelId): Record<string, string> {
  const spec = MODEL_MAP[modelId]
  if (!spec || spec.provider === 'anthropic') return {}
  const group = PROVIDER_GROUPS.find(g => g.key === spec.provider)
  if (!group?.apiKeyName || !group.apiKeyHeader) return {}
  const key = localStorage.getItem(group.apiKeyName) ?? ''
  if (!key) return {}
  return { [group.apiKeyHeader]: key }
}

export { MODEL_MAP, PROVIDER_GROUPS }
