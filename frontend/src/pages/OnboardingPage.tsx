/**
 * OnboardingPage.tsx — OOMNI v5.7.0 온보딩
 *
 * 레이아웃: 좌측 브랜드 패널 | 우측 4-step 폼
 * Step 1: Claude API 키 입력
 * Step 2: 미션 이름 설정
 * Step 3: AI 팀 템플릿 선택
 * Step 4: 완료
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { missionsApi, settingsApi, type Mission, api } from '../lib/api'
import { useAppStore } from '../store/app.store'
import {
  Eye, EyeOff, Loader2, CheckCircle, ChevronRight,
  Zap, Search, Palette, Code2, TrendingUp, Crown, Workflow,
  Terminal, Github, Database, Globe, Copy, FolderOpen,
  ExternalLink, AlertCircle,
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

const TOTAL_STEPS = 5

// ── DevSetup 타입 ─────────────────────────────────────────────────────────────

interface ToolStatus {
  platform: string
  node: string | null
  npm: string | null
  nvm: string | null
  git: string | null
  python: string | null
  pyenv: string | null
  pnpm: string | null
  claude: string | null
  code: string | null
  brew: string | null
  wsl: boolean
  install_commands: Record<string, string>
  vscode_extensions: { id: string; name: string; cmd: string }[]
}

export default function OnboardingPage() {
  const navigate  = useNavigate()
  const { setCurrentMission } = useAppStore()
  const [step,    setStep]    = useState(0)   // 0=DevSetup, 1-4=기존 온보딩
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
  const [selectedTemplate, setSelectedTemplate] = useState<'solo-factory-os' | 'manual' | null>('solo-factory-os')
  const [templateApplied,  setTemplateApplied]  = useState(false)

  // Step 0 — DevSetup
  const [toolStatus,    setToolStatus]    = useState<ToolStatus | null>(null)
  const [toolsLoading,  setToolsLoading]  = useState(false)
  const [projectPath,   setProjectPath]   = useState('')
  const [projectName,   setProjectName]   = useState('')
  const [supabaseUrl,   setSupabaseUrl]   = useState('')
  const [supabaseAnon,  setSupabaseAnon]  = useState('')
  const [genLoading,    setGenLoading]    = useState(false)
  const [genResult,     setGenResult]     = useState<string | null>(null)
  const [copiedCmd,     setCopiedCmd]     = useState<string | null>(null)

  // ── Step 0: DevSetup ──────────────────────────────────────────────────────

  const checkTools = useCallback(async () => {
    setToolsLoading(true)
    try {
      const res = await api.get('/api/setup/check-tools')
      setToolStatus(res.data as ToolStatus)
    } catch {
      // 백엔드 아직 연결 안 된 경우 무시
    } finally {
      setToolsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step === 0) checkTools()
  }, [step, checkTools])

  const copyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const handleGenerateFiles = async () => {
    if (!projectPath.trim()) { setError('프로젝트 경로를 입력해주세요'); return }
    setError('')
    setGenLoading(true)
    try {
      const res = await api.post('/api/setup/generate-files', {
        project_path: projectPath,
        project_name: projectName,
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseAnon,
      })
      setGenResult((res.data as { message: string }).message)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error ?? '파일 생성 실패')
    } finally {
      setGenLoading(false)
    }
  }

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

  const handleFinish = () => {
    localStorage.setItem('oomni_show_tutorial', 'true')
    navigate('/dashboard')
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex">

      {/* ── 좌측: 브랜드 패널 ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between p-10 bg-gradient-to-br from-[#111113] via-[#0d0d0f] to-[#0d0d0f] border-r border-[#1c1c20]">

        {/* 로고 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">OOMNI</span>
          </div>
          <p className="text-[#52525b] text-sm">솔로프리너를 위한 AI 에이전트 팀</p>
        </div>

        {/* 기능 목록 */}
        <div className="space-y-4 my-8">
          <p className="text-[11px] text-[#52525b] uppercase tracking-widest mb-4">AI 팀 구성</p>
          {FEATURES.map(f => {
            const Icon = f.icon
            return (
              <div key={f.label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-primary" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[#e4e4e7]">{f.label}</div>
                  <div className="text-[11px] text-[#52525b]">{f.desc}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 하단 */}
        <div className="text-[11px] text-[#3f3f46] space-y-1">
          <p>API 키는 이 기기에만 저장됩니다</p>
          <p>외부로 전송되지 않습니다</p>
        </div>
      </div>

      {/* ── 우측: 폼 ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">

        {/* 모바일 로고 */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white">OOMNI</span>
        </div>

        <div className="w-full max-w-[400px]">

          {/* 스텝 인디케이터 */}
          <div className="flex items-center gap-1.5 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i).map(n => (
              <div key={n} className="flex items-center gap-1.5">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all',
                  step > n
                    ? 'bg-primary text-white'
                    : step === n
                    ? 'bg-primary text-white ring-2 ring-primary/30'
                    : 'bg-[#1c1c20] border border-[#27272a] text-[#52525b]',
                )}>
                  {step > n ? <CheckCircle size={12} /> : n + 1}
                </div>
                {n < TOTAL_STEPS - 1 && (
                  <div className={cn(
                    'h-px w-8 transition-colors',
                    step > n ? 'bg-primary' : 'bg-[#1c1c20]',
                  )} />
                )}
              </div>
            ))}
            <span className="ml-2 text-[11px] text-[#52525b]">
              {step === 0 ? '환경 세팅' : step === 1 ? 'API 키' : step === 2 ? '미션' : step === 3 ? '팀 구성' : '완료'}
            </span>
          </div>

          {/* ── Step 0: 개발환경 세팅 ── */}
          {step === 0 && (
            <DevSetupStep
              toolStatus={toolStatus}
              toolsLoading={toolsLoading}
              onRefresh={checkTools}
              projectPath={projectPath}
              setProjectPath={setProjectPath}
              projectName={projectName}
              setProjectName={setProjectName}
              supabaseUrl={supabaseUrl}
              setSupabaseUrl={setSupabaseUrl}
              supabaseAnon={supabaseAnon}
              setSupabaseAnon={setSupabaseAnon}
              genLoading={genLoading}
              genResult={genResult}
              onGenerate={handleGenerateFiles}
              copiedCmd={copiedCmd}
              onCopy={copyCmd}
              error={error}
              onNext={() => { setError(''); setStep(1) }}
            />
          )}

          {/* ── Step 1: API 키 ── */}
          {step === 1 && (
            <StepCard title="Claude API 키 설정" desc="봇을 실행하려면 Anthropic API 키가 필요합니다">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-[#52525b] uppercase tracking-wide block mb-1.5">
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
                      className="w-full bg-[#111113] border border-[#1c1c20] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-primary/60 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#e4e4e7] transition-colors"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#3f3f46] mt-1.5">
                    <a
                      href="https://console.anthropic.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
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
                  className="w-full text-center text-[11px] text-[#3f3f46] hover:text-[#52525b] transition-colors"
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
                  <label className="text-[11px] text-[#52525b] uppercase tracking-wide block mb-1.5">
                    미션 이름
                  </label>
                  <input
                    type="text"
                    value={missionName}
                    onChange={e => setMissionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep2()}
                    placeholder="나의 스타트업"
                    autoFocus
                    className="w-full bg-[#111113] border border-[#1c1c20] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#52525b] uppercase tracking-wide block mb-1.5">
                    설명 (선택)
                  </label>
                  <textarea
                    value={missionDesc}
                    onChange={e => setMissionDesc(e.target.value)}
                    placeholder="SaaS 제품 개발 및 마케팅"
                    rows={2}
                    className="w-full bg-[#111113] border border-[#1c1c20] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-primary/60 transition-colors resize-none"
                  />
                </div>
                {/* 프리셋 */}
                <div>
                  <p className="text-[11px] text-[#52525b] mb-2">빠른 선택</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => { setMissionName(p.name); setMissionDesc(p.desc) }}
                        className={cn(
                          'text-left px-3 py-2 rounded-lg border text-[11px] transition-all',
                          missionName === p.name
                            ? 'border-primary/60 bg-primary/10 text-primary'
                            : 'border-[#1c1c20] text-[#52525b] hover:border-[#27272a] hover:text-[#e4e4e7]',
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
                <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">준비 완료!</h2>
                <p className="text-[#52525b] text-sm mb-6">OOMNI가 실행될 준비가 됐습니다</p>

                {/* 요약 */}
                <div className="bg-[#111113] border border-[#1c1c20] rounded-xl p-4 text-left space-y-2.5 mb-6">
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
                  className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
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

// ─── DevSetup Step ────────────────────────────────────────────────────────────

const ACCOUNT_LINKS = [
  { label: 'Claude.ai Pro', desc: 'AI 코딩 파트너 (월 $20)', icon: Zap, url: 'https://claude.ai', color: 'text-primary' },
  { label: 'Google', desc: 'Firebase · GCP · Gmail (무료)', icon: Globe, url: 'https://accounts.google.com', color: 'text-sky-400' },
  { label: 'GitHub', desc: '코드 저장소 · 버전 관리 (무료)', icon: Github, url: 'https://github.com', color: 'text-[#e4e4e7]' },
  { label: 'Supabase', desc: 'DB + 인증 + 스토리지 (무료)', icon: Database, url: 'https://supabase.com', color: 'text-emerald-400' },
  { label: 'Vercel', desc: '프론트엔드 배포 (무료)', icon: Globe, url: 'https://vercel.com', color: 'text-[#e4e4e7]' },
] as const

function ToolBadge({ version, label }: { version: string | null | undefined; label: string }) {
  if (version === undefined) return null
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border',
      version
        ? 'bg-green-500/10 border-green-500/20 text-green-400'
        : 'bg-[#1c1c20] border-[#27272a] text-[#52525b]',
    )}>
      {version ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
      <span className="font-medium">{label}</span>
      {version && <span className="opacity-60">{version.slice(0, 12)}</span>}
    </div>
  )
}

function CopyBtn({ cmd, label, copied, onCopy }: { cmd: string; label?: string; copied: string | null; onCopy: (c: string) => void }) {
  const isCopied = copied === cmd
  return (
    <button
      onClick={() => onCopy(cmd)}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all font-mono',
        isCopied
          ? 'bg-green-500/10 border-green-500/20 text-green-400'
          : 'bg-[#0d0d0f] border-[#1c1c20] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#27272a]',
      )}
    >
      {isCopied ? <CheckCircle size={10} /> : <Copy size={10} />}
      <span className="max-w-[240px] truncate">{label ?? cmd}</span>
    </button>
  )
}

interface DevSetupStepProps {
  toolStatus: ToolStatus | null
  toolsLoading: boolean
  onRefresh: () => void
  projectPath: string
  setProjectPath: (v: string) => void
  projectName: string
  setProjectName: (v: string) => void
  supabaseUrl: string
  setSupabaseUrl: (v: string) => void
  supabaseAnon: string
  setSupabaseAnon: (v: string) => void
  genLoading: boolean
  genResult: string | null
  onGenerate: () => void
  copiedCmd: string | null
  onCopy: (cmd: string) => void
  error: string
  onNext: () => void
}

function DevSetupStep({
  toolStatus, toolsLoading, onRefresh,
  projectPath, setProjectPath, projectName, setProjectName,
  supabaseUrl, setSupabaseUrl, supabaseAnon, setSupabaseAnon,
  genLoading, genResult, onGenerate,
  copiedCmd, onCopy, error, onNext,
}: DevSetupStepProps) {
  const platform = toolStatus?.platform ?? 'win32'
  const isWin = platform === 'win32'
  const isMac = platform === 'darwin'
  const ic = toolStatus?.install_commands

  const openUrl = (url: string) => {
    (window as { electronAPI?: { openExternal?: (u: string) => void } }).electronAPI?.openExternal?.(url)
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white mb-1">개발환경 세팅</h2>
        <p className="text-[#52525b] text-sm">Claude Code를 바로 쓰기 위한 1회성 세팅입니다. 이미 완료됐다면 건너뛰세요.</p>
      </div>

      <div className="space-y-4">

        {/* ── 섹션 A: 필수 계정 ── */}
        <div className="bg-[#111113] border border-[#1c1c20] rounded-2xl p-5">
          <p className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wide mb-3">STEP 1 — 필수 계정 만들기</p>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_LINKS.map(a => {
              const Icon = a.icon
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => openUrl(a.url)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-[#1c1c20] hover:border-[#27272a] bg-[#0d0d0f] text-left transition-all group"
                >
                  <Icon size={13} className={a.color} />
                  <div>
                    <div className="text-[12px] font-medium text-[#e4e4e7] group-hover:text-white transition-colors">{a.label}</div>
                    <div className="text-[10px] text-[#52525b]">{a.desc}</div>
                  </div>
                  <ExternalLink size={10} className="ml-auto text-[#3f3f46] group-hover:text-[#52525b]" />
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 섹션 B: 개발 도구 ── */}
        <div className="bg-[#111113] border border-[#1c1c20] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wide">STEP 2-4 — 개발 도구 설치 확인 (nvm · Node · Python · Git · Claude Code)</p>
            <button
              type="button"
              onClick={onRefresh}
              disabled={toolsLoading}
              className="flex items-center gap-1 text-[10px] text-[#52525b] hover:text-primary transition-colors"
            >
              {toolsLoading ? <Loader2 size={10} className="animate-spin" /> : <Terminal size={10} />}
              재확인
            </button>
          </div>

          {toolStatus ? (
            <div className="space-y-3">
              {/* 설치 상태 */}
              <div className="flex flex-wrap gap-1.5">
                <ToolBadge version={toolStatus.nvm}    label="nvm" />
                <ToolBadge version={toolStatus.node}   label="Node.js" />
                <ToolBadge version={toolStatus.python} label="Python" />
                <ToolBadge version={toolStatus.pyenv}  label="pyenv" />
                <ToolBadge version={toolStatus.pnpm}   label="pnpm" />
                {isMac && <ToolBadge version={toolStatus.brew} label="Homebrew" />}
                <ToolBadge version={toolStatus.git}    label="Git" />
                <ToolBadge version={toolStatus.claude} label="Claude Code" />
                <ToolBadge version={toolStatus.code}   label="VS Code" />
                {isWin && (
                  <div className={cn(
                    'flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border',
                    toolStatus.wsl
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : 'bg-[#1c1c20] border-[#27272a] text-[#52525b]',
                  )}>
                    {toolStatus.wsl ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                    <span className="font-medium">WSL2</span>
                  </div>
                )}
              </div>

              {/* 미설치 → 설치 명령어 */}
              {(!toolStatus.nvm || !toolStatus.node || !toolStatus.python || !toolStatus.pyenv ||
                !toolStatus.pnpm || (isMac && !toolStatus.brew) || !toolStatus.git || !toolStatus.claude || !toolStatus.code ||
                (isWin && !toolStatus.wsl)) && ic && (
                <div className="space-y-1.5 pt-2 border-t border-[#1c1c20]">
                  <p className="text-[10px] text-[#52525b] mb-2">미설치 항목 — 복사해서 터미널에 붙여넣으세요</p>
                  {isWin && !toolStatus.wsl && (
                    <CopyBtn cmd={ic.wsl_windows} label="WSL2 설치 (PowerShell 관리자)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {isMac && !toolStatus.brew && (
                    <CopyBtn cmd={ic.brew_mac} label="Homebrew 설치 (Mac)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {isMac && !toolStatus.nvm && (
                    <CopyBtn cmd={ic.nvm_mac} label="nvm 설치 (Mac)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {isWin && !toolStatus.nvm && (
                    <CopyBtn cmd={ic.nvm_windows} label="nvm-windows 다운로드 페이지" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {(!isWin && !isMac) && !toolStatus.nvm && (
                    <CopyBtn cmd={ic.nvm_linux} label="nvm 설치 (Linux)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {!toolStatus.node && (
                    <CopyBtn cmd={ic.node_all} label="Node.js LTS 설치 (nvm)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {isMac && !toolStatus.pyenv && (
                    <CopyBtn cmd={ic.pyenv_mac} label="pyenv 설치 (Mac)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {(!isWin && !isMac) && !toolStatus.pyenv && (
                    <CopyBtn cmd={ic.pyenv_linux} label="pyenv 설치 (Linux)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {!toolStatus.python && (
                    <CopyBtn cmd={isWin ? ic.python_windows : isMac ? ic.python_mac : ic.python_linux} label="Python 설치" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {!toolStatus.pnpm && (
                    <CopyBtn cmd={ic.pnpm_all} label="pnpm 설치 (Open Design 에디터용)" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {!toolStatus.git && (
                    <CopyBtn cmd={isWin ? ic.git_windows : isMac ? ic.git_mac : ic.git_linux} label="Git 설치" copied={copiedCmd} onCopy={onCopy} />
                  )}
                  {!toolStatus.claude && (
                    <CopyBtn cmd={ic.claude_all} label="Claude Code 설치" copied={copiedCmd} onCopy={onCopy} />
                  )}
                </div>
              )}

              {/* VS Code 확장 */}
              {toolStatus.code && (
                <div className="pt-2 border-t border-[#1c1c20]">
                  <p className="text-[10px] text-[#52525b] mb-2">VS Code 확장 — 터미널에서 실행 (선택사항)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {toolStatus.vscode_extensions.map(ext => (
                      <CopyBtn key={ext.id} cmd={ext.cmd} label={ext.name} copied={copiedCmd} onCopy={onCopy} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : toolsLoading ? (
            <div className="flex items-center gap-2 text-[#52525b] text-[12px]">
              <Loader2 size={12} className="animate-spin" /> 설치 상태 확인 중...
            </div>
          ) : (
            <div className="text-[#52525b] text-[12px]">백엔드 연결 후 재확인 버튼을 눌러보세요.</div>
          )}
        </div>

        {/* ── 섹션 C: 프로젝트 파일 생성 ── */}
        <div className="bg-[#111113] border border-[#1c1c20] rounded-2xl p-5">
          <p className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wide mb-3">STEP 5 — 프로젝트 파일 자동 생성 (선택)</p>
          <p className="text-[11px] text-[#52525b] mb-3">프로젝트 폴더를 지정하면 CLAUDE.md + .gitignore + .env.local을 자동 생성합니다.</p>
          <div className="space-y-2">
            <input
              type="text"
              value={projectPath}
              onChange={e => setProjectPath(e.target.value)}
              placeholder={isWin ? 'C:\\Users\\me\\my-project' : '~/my-project'}
              className="w-full bg-[#0d0d0f] border border-[#1c1c20] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-primary/50 transition-colors"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="프로젝트 이름 (선택)"
                className="bg-[#0d0d0f] border border-[#1c1c20] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-primary/50 transition-colors"
              />
              <input
                type="text"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                placeholder="Supabase URL (선택)"
                className="bg-[#0d0d0f] border border-[#1c1c20] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <input
              type="text"
              value={supabaseAnon}
              onChange={e => setSupabaseAnon(e.target.value)}
              placeholder="Supabase Anon Key (선택)"
              className="w-full bg-[#0d0d0f] border border-[#1c1c20] rounded-lg px-3 py-2 text-[12px] text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-primary/50 transition-colors"
            />
            {genResult ? (
              <div className="flex items-center gap-2 text-[11px] text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                <CheckCircle size={11} /> {genResult}
              </div>
            ) : (
              <button
                type="button"
                onClick={onGenerate}
                disabled={genLoading || !projectPath.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-lg text-[12px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {genLoading ? <Loader2 size={11} className="animate-spin" /> : <FolderOpen size={11} />}
                파일 자동 생성 (CLAUDE.md + .gitignore + .env.local)
              </button>
            )}
          </div>
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            className="flex-1 text-center text-[11px] text-[#3f3f46] hover:text-[#52525b] transition-colors py-2"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
          >
            다음 단계로 <ChevronRight size={13} />
          </button>
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
          <p className="text-[#52525b] text-sm">{desc}</p>
        </div>
      )}
      <div className="bg-[#111113] border border-[#1c1c20] rounded-2xl p-6">
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
      className="w-full bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
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
          ? 'border-primary/70 bg-primary/10'
          : 'border-[#1c1c20] hover:border-[#27272a] bg-[#111113]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{title}</span>
            {badge && (
              <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#52525b]">{desc}</p>
        </div>
        <div className={cn(
          'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors',
          selected ? 'border-primary bg-primary' : 'border-[#27272a]',
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
      <CheckCircle size={13} className={done ? 'text-primary' : 'text-[#3f3f46]'} />
      <span className={done ? 'text-[#e4e4e7]' : 'text-[#3f3f46]'}>{label}</span>
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
