import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { missionsApi, agentsApi, settingsApi, type Mission } from '../lib/api'
import { useAppStore } from '../store/app.store'
import { ArrowRight, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

const BOT_STARTERS = [
  {
    role: 'research' as const,
    name: 'Research Bot',
    emoji: '🔬',
    desc: '웹 리서치, 경쟁사 분석, 트렌드 조사',
    prompt: '너는 리서치 전문 AI 봇이다. 주어진 주제를 철저히 조사하고 구조화된 보고서로 정리해라.',
  },
  {
    role: 'build' as const,
    name: 'Build Bot',
    emoji: '🔨',
    desc: '코딩, 버그 수정, PR 생성, 테스트',
    prompt: '너는 풀스택 개발 AI 봇이다. TDD 방식으로 코드를 작성하고 PR을 생성해라.',
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { setCurrentMission } = useAppStore()
  const [step, setStep] = useState(1)
  const [missionName, setMissionName] = useState('')
  const [missionDesc, setMissionDesc] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdMission, setCreatedMission] = useState<Mission | null>(null)
  const [creatingBot, setCreatingBot] = useState<string | null>(null)

  const handleStep1 = () => {
    if (!missionName.trim()) { setError('미션 이름을 입력해주세요'); return }
    setError('')
    setStep(2)
  }

  const handleStep2 = async () => {
    if (!apiKey.trim() || !apiKey.startsWith('sk-')) {
      setError('올바른 Anthropic API 키를 입력해주세요 (sk-ant-...)')
      return
    }
    setLoading(true)
    try {
      await settingsApi.setApiKey(apiKey)
      const mission = await missionsApi.create({ name: missionName, description: missionDesc })
      localStorage.setItem('oomni_mission_id', mission.id)
      setCurrentMission(mission)
      setCreatedMission(mission)
      setStep(3)
    } catch {
      setError('서버 연결 오류. OOMNI 백엔드가 실행 중인지 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectBot = async (role: typeof BOT_STARTERS[number]['role']) => {
    if (!createdMission) return
    const tmpl = BOT_STARTERS.find(b => b.role === role)!
    setCreatingBot(role)
    try {
      await agentsApi.create({
        mission_id: createdMission.id,
        name: tmpl.name,
        role: tmpl.role,
        schedule: 'manual',
        system_prompt: tmpl.prompt,
        budget_cents: 1000,
      })
    } catch {
      // 봇 생성 실패해도 대시보드로 이동
    } finally {
      setCreatingBot(null)
      navigate('/dashboard')
    }
  }

  const handleSkip = () => navigate('/dashboard')

  const totalSteps = 3

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
          {[1, 2, 3].map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium ${
                step >= n ? 'bg-primary text-white' : 'bg-surface border border-border text-muted'
              }`}>
                {step > n ? <CheckCircle size={14} /> : n}
              </div>
              {n < totalSteps && <div className={`w-12 h-px ${step > n ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          {/* Step 1: 미션 이름 */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">어떤 일을 하고 계신가요?</h2>
              <p className="text-muted text-sm mb-5">AI 팀이 이 미션을 중심으로 일하게 됩니다</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-muted block mb-1.5">미션 이름</label>
                  <input
                    type="text"
                    value={missionName}
                    onChange={e => setMissionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep1()}
                    placeholder="예: AI 영어학습 앱 런칭"
                    autoFocus
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-muted block mb-1.5">한 줄 설명 (선택)</label>
                  <textarea
                    value={missionDesc}
                    onChange={e => setMissionDesc(e.target.value)}
                    placeholder="예: 직장인을 위한 5분 영어 학습 SaaS를 만들고 있어요"
                    rows={2}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary resize-none"
                  />
                </div>
                {error && <p className="text-red-400 text-[12px]">{error}</p>}
                <button
                  onClick={handleStep1}
                  className="w-full bg-primary text-white py-2.5 rounded text-[14px] font-medium hover:bg-[#C5664A] flex items-center justify-center gap-2"
                >
                  다음 <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: API 키 */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">API 키 연결</h2>
              <p className="text-muted text-sm mb-5">Claude AI가 봇들을 실행합니다. API 키는 이 기기에만 저장됩니다.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-muted block mb-1.5">Anthropic API 키</label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleStep2()}
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
                    <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      console.anthropic.com
                    </a>에서 발급받을 수 있습니다
                  </p>
                </div>
                {error && <p className="text-red-400 text-[12px]">{error}</p>}
                <button
                  onClick={handleStep2}
                  disabled={loading}
                  className="w-full bg-primary text-white py-2.5 rounded text-[14px] font-medium hover:bg-[#C5664A] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? '설정 중...' : 'OOMNI 시작하기 🚀'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 첫 봇 추천 */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">어떤 봇으로 시작할까요?</h2>
              <p className="text-muted text-sm mb-5">첫 번째 AI 봇을 선택하세요. 나중에 더 추가할 수 있습니다.</p>
              <div className="space-y-3 mb-4">
                {BOT_STARTERS.map(bot => (
                  <button
                    key={bot.role}
                    onClick={() => handleSelectBot(bot.role)}
                    disabled={!!creatingBot}
                    className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-[#1E1E20] transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{bot.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-text">{bot.name}</div>
                        <div className="text-[12px] text-muted mt-0.5">{bot.desc}</div>
                      </div>
                      {creatingBot === bot.role ? (
                        <Loader2 size={16} className="text-primary animate-spin" />
                      ) : (
                        <ArrowRight size={16} className="text-muted" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={handleSkip}
                disabled={!!creatingBot}
                className="w-full py-2.5 rounded text-[13px] text-muted hover:text-text border border-border hover:border-[#444] transition-colors disabled:opacity-50"
              >
                건너뛰기
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
