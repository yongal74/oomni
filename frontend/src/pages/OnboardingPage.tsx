/**
 * OnboardingPage.tsx — OOMNI v5.1.0 온보딩
 *
 * 레이아웃: 좌측 브랜드 패널 | 우측 4-step 폼
 * Step 1: Claude API 키 입력
 * Step 2: 미션 이름 설정
 * Step 3: AI 팀 템플릿 선택
 * Step 4: 완료
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { missionsApi, settingsApi, type Mission } from '../lib/api'
import { useAppStore } from '../store/app.store'
import {
  Eye, EyeOff, Loader2, CheckCircle, ChevronRight,
  Zap, Search, Palette, Code2, TrendingUp, Crown, Workflow,
} from 'lucide-react'
import { cn } from '../lib/utils'

// ─── 브랜드 패널 기능 목록 ─────────────────────────────────────────────────────

const FEATURES = [
  { icon: Search,    label: 'Research Bot',  desc: '시장·경쟁사·트렌드 자동 조사' },
  { icon: Code2,     label: 'Build Bot',     desc: '코드 작성 및 배포 자동화' },
  { icon: Palette,   label: 'Design Bot',    desc: 'UI/UX 디자인 자동 생성' },
  { icon: TrendingUp,label: 'Growth Bot',    desc: '콘텐츠·마케팅 파이프라인' },
  { icon: Workflow,  label: 'Ops Bot',       desc: 'n8n 자동화 워크플로우 설계' },
  { icon: Crown,     label: 'CEO Bot',       desc: '전략 브리핑 및 의사결정 지원' },
]

const PRESETS = [
  { label: '스타트업 운영',     name: '스타트업 운영',     desc: 'SaaS 제품 개발 및 마케팅' },
  { label: '앱 개발',           name: '앱 개발',           desc: '모바일/웹 앱 개발 및 배포' },
  { label: '콘텐츠 크리에이터', name: '콘텐츠 크리에이터', desc: 'SNS 콘텐츠 기획 및 제작' },
  { label: '쇼핑몰 운영',       name: '쇼핑몰 운영',       desc: '온라인 쇼핑몰 운영 및 마케팅' },
]

const TOTAL_STEPS = 4

export default function OnboardingPage() {
  const navigate  = useNavigate()
  const { setCurrentMission } = useAppStore()
  const [step,    setStep]    = useState(1)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1
  const [apiKey,   setApiKey]   = useState('')
  const [showKey,  setShowKey]  = useState(false)
  const [apiKeySet, setApiKeySet] = useState(false)

  // Step 2
  const [missionName, setMissionName] = useState('')
  const [missionDesc, setMissionDesc] = useState('')
  const [createdMission, setCreatedMission] = useState<Mission | null>(null)

  // Step 3
  const [selectedTemplate, setSelectedTemplate] = useState<'solo-factory-os' | 'manual' | null>(null)
  const [templateApplied,  setTemplateApplied]  = useState(false)

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleStep1 = async () => {
    setError('')
    if (!apiKey.trim()) { setError('API 키를 입력해주세요'); return }
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

  const handleStep2 = async () => {
    setError('')
    if (!missionName.trim()) { setError('미션 이름을 입력해주세요'); return }
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

  const handleStep3 = async () => {
    setError('')
    if (!selectedTemplate) { setError('템플릿을 선택해주세요'); return }
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
      setStep(4) // 실패해도 완료로 진행
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = () => navigate('/dashboard')

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#060b18] flex">

      {/* ── 좌측: 브랜드 패널 ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between p-10 bg-gradient-to-br from-[#0a0f1e] via-[#0d1525] to-[#060b18] border-r border-[#1c2440]">

        {/* 로고 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">OOMNI</span>
          </div>
          <p className="text-[#4a5580] text-sm">솔로프리너를 위한 AI 에이전트 팀</p>
        </div>

        {/* 기능 목록 */}
        <div className="space-y-4 my-8">
          <p className="text-[11px] text-[#4a5580] uppercase tracking-widest mb-4">AI 팀 구성</p>
          {FEATURES.map(f => {
            const Icon = f.icon
            return (
              <div key={f.label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[#c8d0e8]">{f.label}</div>
                  <div className="text-[11px] text-[#4a5580]">{f.desc}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 하단 */}
        <div className="text-[11px] text-[#303a55] space-y-1">
          <p>API 키는 이 기기에만 저장됩니다</p>
          <p>외부로 전송되지 않습니다</p>
        </div>
      </div>

      {/* ── 우측: 폼 ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">

        {/* 모바일 로고 */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white">OOMNI</span>
        </div>

        <div className="w-full max-w-[400px]">

          {/* 스텝 인디케이터 */}
          <div className="flex items-center gap-1.5 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(n => (
              <div key={n} className="flex items-center gap-1.5">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all',
                  step > n
                    ? 'bg-indigo-600 text-white'
                    : step === n
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-500/30'
                    : 'bg-[#1a2035] border border-[#2a3050] text-[#4a5580]',
                )}>
                  {step > n ? <CheckCircle size={12} /> : n}
                </div>
                {n < TOTAL_STEPS && (
                  <div className={cn(
                    'h-px w-8 transition-colors',
                    step > n ? 'bg-indigo-600' : 'bg-[#1a2035]',
                  )} />
                )}
              </div>
            ))}
            <span className="ml-2 text-[11px] text-[#4a5580]">
              {step === 1 ? 'API 키' : step === 2 ? '미션' : step === 3 ? '팀 구성' : '완료'}
            </span>
          </div>

          {/* ── Step 1: API 키 ── */}
          {step === 1 && (
            <StepCard title="Claude API 키 설정" desc="봇을 실행하려면 Anthropic API 키가 필요합니다">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-[#4a5580] uppercase tracking-wide block mb-1.5">
                    Anthropic API 키
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleStep1()}
                      placeholder="sk-ant-api03-..."
                      autoFocus
                      className="w-full bg-[#0d1525] border border-[#1c2440] rounded-lg px-3 py-2.5 text-sm text-[#c8d0e8] placeholder-[#303a55] focus:outline-none focus:border-indigo-500/60 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5580] hover:text-[#c8d0e8] transition-colors"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#303a55] mt-1.5">
                    <a
                      href="https://console.anthropic.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      console.anthropic.com
                    </a>
                    {' '}에서 발급
                  </p>
                </div>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <PrimaryButton onClick={handleStep1} loading={loading}>
                  다음 단계로 <ChevronRight size={14} />
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => { setStep(2); setError('') }}
                  className="w-full text-center text-[11px] text-[#303a55] hover:text-[#4a5580] transition-colors"
                >
                  나중에 설정하기
                </button>
              </div>
            </StepCard>
          )}

          {/* ── Step 2: 미션 ── */}
          {step === 2 && (
            <StepCard title="첫 미션 만들기" desc="AI 팀이 달성할 목표를 설정하세요">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-[#4a5580] uppercase tracking-wide block mb-1.5">
                    미션 이름
                  </label>
                  <input
                    type="text"
                    value={missionName}
                    onChange={e => setMissionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep2()}
                    placeholder="나의 스타트업"
                    autoFocus
                    className="w-full bg-[#0d1525] border border-[#1c2440] rounded-lg px-3 py-2.5 text-sm text-[#c8d0e8] placeholder-[#303a55] focus:outline-none focus:border-indigo-500/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#4a5580] uppercase tracking-wide block mb-1.5">
                    설명 (선택)
                  </label>
                  <textarea
                    value={missionDesc}
                    onChange={e => setMissionDesc(e.target.value)}
                    placeholder="SaaS 제품 개발 및 마케팅"
                    rows={2}
                    className="w-full bg-[#0d1525] border border-[#1c2440] rounded-lg px-3 py-2.5 text-sm text-[#c8d0e8] placeholder-[#303a55] focus:outline-none focus:border-indigo-500/60 transition-colors resize-none"
                  />
                </div>
                {/* 프리셋 */}
                <div>
                  <p className="text-[11px] text-[#4a5580] mb-2">빠른 선택</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => { setMissionName(p.name); setMissionDesc(p.desc) }}
                        className={cn(
                          'text-left px-3 py-2 rounded-lg border text-[11px] transition-all',
                          missionName === p.name
                            ? 'border-indigo-500/60 bg-indigo-600/10 text-indigo-300'
                            : 'border-[#1c2440] text-[#4a5580] hover:border-[#2a3050] hover:text-[#c8d0e8]',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <PrimaryButton onClick={handleStep2} loading={loading}>
                  미션 만들기 <ChevronRight size={14} />
                </PrimaryButton>
              </div>
            </StepCard>
          )}

          {/* ── Step 3: 팀 구성 ── */}
          {step === 3 && (
            <StepCard title="AI 팀 구성" desc="어떻게 시작할지 선택하세요">
              <div className="space-y-3 mb-4">
                <TemplateOption
                  selected={selectedTemplate === 'solo-factory-os'}
                  onClick={() => setSelectedTemplate('solo-factory-os')}
                  badge="추천"
                  title="OOMNI 팀 자동 구성"
                  desc="Research · Build · Design · Content · Ops · CEO — 6개 봇이 바로 세팅됩니다"
                />
                <TemplateOption
                  selected={selectedTemplate === 'manual'}
                  onClick={() => setSelectedTemplate('manual')}
                  title="직접 구성"
                  desc="대시보드에서 봇을 하나씩 추가합니다"
                />
              </div>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <PrimaryButton onClick={handleStep3} loading={loading} disabled={!selectedTemplate}>
                시작하기 <ChevronRight size={14} />
              </PrimaryButton>
            </StepCard>
          )}

          {/* ── Step 4: 완료 ── */}
          {step === 4 && (
            <StepCard title="" desc="">
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">준비 완료!</h2>
                <p className="text-[#4a5580] text-sm mb-6">OOMNI가 실행될 준비가 됐습니다</p>

                {/* 요약 */}
                <div className="bg-[#0d1525] border border-[#1c2440] rounded-xl p-4 text-left space-y-2.5 mb-6">
                  <SummaryRow done={apiKeySet}     label={apiKeySet ? 'Claude API 연결 완료' : 'API 키 미설정 (설정 > API 키에서 추가)'} />
                  {createdMission && (
                    <SummaryRow done label={`미션: ${createdMission.name}`} />
                  )}
                  {selectedTemplate === 'solo-factory-os' && (
                    <SummaryRow done label={`OOMNI 팀 6개 봇 구성${templateApplied ? ' 완료' : ''}`} />
                  )}
                  {selectedTemplate === 'manual' && (
                    <SummaryRow done={false} label="봇 구성 — 대시보드에서 직접 추가" />
                  )}
                </div>

                <button
                  onClick={handleFinish}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  OOMNI 시작하기 <ChevronRight size={14} />
                </button>
              </div>
            </StepCard>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── sub-components ────────────────────────────────────────────────────────────

function StepCard({ title, desc, children }: {
  title: string; desc: string; children: React.ReactNode
}) {
  return (
    <div>
      {title && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
          <p className="text-[#4a5580] text-sm">{desc}</p>
        </div>
      )}
      <div className="bg-[#0d1525] border border-[#1c2440] rounded-2xl p-6">
        {children}
      </div>
    </div>
  )
}

function PrimaryButton({ onClick, loading, disabled, children }: {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

function TemplateOption({ selected, onClick, badge, title, desc }: {
  selected: boolean; onClick: () => void
  badge?: string; title: string; desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border-2 transition-all',
        selected
          ? 'border-indigo-500/70 bg-indigo-600/10'
          : 'border-[#1c2440] hover:border-[#2a3050] bg-[#0a0f1e]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{title}</span>
            {badge && (
              <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#4a5580]">{desc}</p>
        </div>
        <div className={cn(
          'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors',
          selected ? 'border-indigo-500 bg-indigo-500' : 'border-[#2a3050]',
        )}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>
    </button>
  )
}

function SummaryRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <CheckCircle size={13} className={done ? 'text-indigo-400' : 'text-[#303a55]'} />
      <span className={done ? 'text-[#c8d0e8]' : 'text-[#303a55]'}>{label}</span>
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
      <span>⚠</span>
      <span>{children}</span>
    </div>
  )
}
