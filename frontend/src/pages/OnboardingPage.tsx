import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { missionsApi, settingsApi, type Mission } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

const PRESETS = [
  { label: '🚀 스타트업 운영', name: '스타트업 운영', desc: 'SaaS 제품 개발 및 마케팅' },
  { label: '📱 앱 개발', name: '앱 개발', desc: '모바일/웹 앱 개발 및 배포' },
  { label: '✍️ 콘텐츠 크리에이터', name: '콘텐츠 크리에이터', desc: 'SNS 콘텐츠 기획 및 제작' },
  { label: '🛒 쇼핑몰 운영', name: '쇼핑몰 운영', desc: '온라인 쇼핑몰 운영 및 마케팅' },
]

const TOTAL_STEPS = 4

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { setCurrentMission } = useAppStore()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  // Step 2
  const [missionName, setMissionName] = useState('')
  const [missionDesc, setMissionDesc] = useState('')
  const [createdMission, setCreatedMission] = useState<Mission | null>(null)

  // Step 3
  const [selectedTemplate, setSelectedTemplate] = useState<'solo-factory-os' | 'manual' | null>(null)
  const [templateApplied, setTemplateApplied] = useState(false)

  // Summary flags
  const [apiKeySet, setApiKeySet] = useState(false)

  // ── Step 1: API 키 설정 ─────────────────────────────────────────
  const handleStep1 = async () => {
    setError('')
    if (!apiKey.trim()) {
      setError('API 키를 입력해주세요')
      return
    }
    setLoading(true)
    try {
      await settingsApi.setApiKey(apiKey)
      setApiKeySet(true)
      setStep(2)
    } catch {
      setError('API 키 저장에 실패했습니다. 키를 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipApiKey = () => {
    setError('')
    setStep(2)
  }

  // ── Step 2: 미션 만들기 ─────────────────────────────────────────
  const handleStep2 = async () => {
    setError('')
    if (!missionName.trim()) {
      setError('미션 이름을 입력해주세요')
      return
    }
    setLoading(true)
    try {
      const mission = await missionsApi.create({ name: missionName, description: missionDesc })
      localStorage.setItem('oomni_mission_id', mission.id)
      setCurrentMission(mission)
      setCreatedMission(mission)
      setStep(3)
    } catch {
      setError('미션 생성에 실패했습니다. 서버 연결을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: 봇 구성 ──────────────────────────────────────────────
  const handleStep3 = async () => {
    setError('')
    if (!selectedTemplate) {
      setError('템플릿을 선택해주세요')
      return
    }
    setLoading(true)
    try {
      if (selectedTemplate === 'solo-factory-os' && createdMission) {
        await import('../lib/api').then(({ api }) =>
          api.post(`/api/templates/solo-factory-os/apply`, { mission_id: createdMission.id })
        )
        setTemplateApplied(true)
      }
      setStep(4)
    } catch {
      // 템플릿 적용 실패해도 완료 단계로 진행
      setStep(4)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = (t: 'solo-factory-os' | 'manual') => {
    setSelectedTemplate(t)
    setError('')
  }

  // ── Step 4: 완료 ────────────────────────────────────────────────
  const handleFinish = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-primary mb-1">OOMNI</div>
          <div className="text-muted text-sm">딸깍 하나로 AI 팀이 일한다</div>
        </div>

        {/* 진행 표시 */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(n => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium transition-colors ${
                  step > n
                    ? 'bg-primary text-white'
                    : step === n
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-muted'
                }`}
              >
                {step > n ? <CheckCircle size={14} /> : n}
              </div>
              {n < TOTAL_STEPS && (
                <div className={`w-10 h-px ${step > n ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          {/* ── Step 1: API 키 설정 ── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">시작하기</h2>
              <p className="text-muted text-sm mb-5">
                Claude API 키를 입력하면 바로 시작할 수 있습니다.
              </p>
              <p className="text-muted text-sm mb-4">Claude API 키로 시작하기</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-muted block mb-1.5">Anthropic API 키</label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleStep1()}
                      placeholder="sk-ant-..."
                      autoFocus
                      className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted mt-1.5">
                    <a
                      href="https://console.anthropic.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      console.anthropic.com
                    </a>
                    에서 발급받을 수 있습니다
                  </p>
                </div>
                {error && <p className="text-red-400 text-[12px]">{error}</p>}
                <button
                  onClick={handleStep1}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  확인 &amp; 다음
                </button>
                <button
                  onClick={handleSkipApiKey}
                  className="w-full text-center text-[13px] text-muted hover:text-text transition-colors"
                >
                  나중에 설정하기
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: 미션 만들기 ── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">첫 번째 미션 만들기</h2>
              <p className="text-muted text-sm mb-5">미션은 AI 팀이 달성할 목표입니다</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-muted block mb-1.5">미션 이름</label>
                  <input
                    type="text"
                    value={missionName}
                    onChange={e => setMissionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep2()}
                    placeholder="나의 스타트업"
                    autoFocus
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-muted block mb-1.5">설명 (선택)</label>
                  <textarea
                    value={missionDesc}
                    onChange={e => setMissionDesc(e.target.value)}
                    placeholder="SaaS 제품 개발 및 마케팅"
                    rows={2}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary resize-none"
                  />
                </div>
                {/* 프리셋 버튼 */}
                <div>
                  <label className="text-[12px] text-muted block mb-2">예시 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => { setMissionName(p.name); setMissionDesc(p.desc) }}
                        className="text-left px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-surface text-[12px] text-text transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p className="text-red-400 text-[12px]">{error}</p>}
                <button
                  onClick={handleStep2}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  미션 만들기
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: AI 팀 구성 ── */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">AI 팀을 구성하세요</h2>
              <p className="text-muted text-sm mb-5">시작 방법을 선택하세요</p>
              <div className="space-y-3 mb-5">
                {/* OOMNI 팀 구성 */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('solo-factory-os')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                    selectedTemplate === 'solo-factory-os'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 bg-surface/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-semibold text-text">OOMNI 팀 구성</span>
                        <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-medium">
                          추천
                        </span>
                      </div>
                      <p className="text-[12px] text-muted">
                        Research, Design, Build, Content, Ops, CEO 6개 봇으로 시작
                      </p>
                    </div>
                    {selectedTemplate === 'solo-factory-os' && (
                      <CheckCircle size={18} className="text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>

                {/* 직접 구성 */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('manual')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                    selectedTemplate === 'manual'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 bg-surface/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-semibold text-text mb-1">직접 구성</div>
                      <p className="text-[12px] text-muted">나중에 직접 봇을 추가합니다</p>
                    </div>
                    {selectedTemplate === 'manual' && (
                      <CheckCircle size={18} className="text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              </div>
              {error && <p className="text-red-400 text-[12px] mb-3">{error}</p>}
              <button
                onClick={handleStep3}
                disabled={loading || !selectedTemplate}
                className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                시작하기
              </button>
            </div>
          )}

          {/* ── Step 4: 완료 ── */}
          {step === 4 && (
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-lg font-semibold text-text mb-1">준비 완료!</h2>
              <p className="text-muted text-sm mb-6">설정이 완료되었습니다. OOMNI를 시작하세요.</p>
              <div className="bg-surface rounded-lg p-4 text-left space-y-2 mb-6">
                <div className="flex items-center gap-2 text-[13px]">
                  <CheckCircle size={14} className={apiKeySet ? 'text-primary' : 'text-muted'} />
                  <span className={apiKeySet ? 'text-text' : 'text-muted'}>
                    {apiKeySet ? 'API 키 연결 완료' : 'API 키 미설정 (나중에 설정 가능)'}
                  </span>
                </div>
                {createdMission && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle size={14} className="text-primary" />
                    <span className="text-text">미션: {createdMission.name}</span>
                  </div>
                )}
                {selectedTemplate === 'solo-factory-os' && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle size={14} className="text-primary" />
                    <span className="text-text">OOMNI 팀 구성{templateApplied ? ' 완료' : ''}</span>
                  </div>
                )}
                {selectedTemplate === 'manual' && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle size={14} className="text-muted" />
                    <span className="text-muted">봇 구성 (대시보드에서 직접 추가)</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleFinish}
                className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded text-[14px] font-medium transition-colors"
              >
                OOMNI 시작하기
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-muted mt-4">
          API 키는 이 기기에서만 사용되며 외부로 전송되지 않습니다
        </p>
      </div>
    </div>
  )
}

