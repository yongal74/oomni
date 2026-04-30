import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, designSystemsApi, designOutputsApi, type FeedItem, type DesignSystem, type DesignOutput } from '../../../lib/api'
import { useAppStore } from '../../../store/app.store'
import { Palette, Layout, Download, Copy, FileCode, Check, Clock } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ArchiveButton } from '../shared/ArchiveButton'
import { NextBotDropdown } from '../shared/NextBotDropdown'

// ── 디자인 시스템 프리셋 ────────────────────────────────────────
const PRESETS: Record<string, Omit<DesignSystem, 'mission_id'> & { label: string; desc: string }> = {
  oomni: {
    label: 'OOMNI',
    desc: '다크, 오렌지 액센트, 웜톤',
    preset: 'oomni',
    primary_color: '#D4763B',
    bg_color: '#0F0F10',
    surface_color: '#1A1A1C',
    text_color: '#E8E8E8',
    muted_color: '#888888',
    accent_color: '#D4763B',
    font_family: 'Pretendard',
    border_radius: '8px',
    style_voice: 'modern-dark',
  },
  linear: {
    label: 'Linear',
    desc: '다크, 퍼플, 미니멀',
    preset: 'linear',
    primary_color: '#5E6AD2',
    bg_color: '#0F0F11',
    surface_color: '#18181B',
    text_color: '#EDEDEF',
    muted_color: '#7E7E8A',
    accent_color: '#5E6AD2',
    font_family: 'Inter',
    border_radius: '6px',
    style_voice: 'minimal-dark',
  },
  stripe: {
    label: 'Stripe',
    desc: '딥 네이비, 인디고, 프로페셔널',
    preset: 'stripe',
    primary_color: '#635BFF',
    bg_color: '#0A2540',
    surface_color: '#0D2E4E',
    text_color: '#FFFFFF',
    muted_color: '#8898AA',
    accent_color: '#00D4FF',
    font_family: 'Inter',
    border_radius: '8px',
    style_voice: 'professional-dark',
  },
  apple: {
    label: 'Apple',
    desc: '라이트, 라운드, 클린',
    preset: 'apple',
    primary_color: '#007AFF',
    bg_color: '#FFFFFF',
    surface_color: '#F5F5F7',
    text_color: '#1D1D1F',
    muted_color: '#6E6E73',
    accent_color: '#007AFF',
    font_family: 'SF Pro Display',
    border_radius: '12px',
    style_voice: 'clean-light',
  },
  vercel: {
    label: 'Vercel',
    desc: '블랙, 모노크롬, 샤프',
    preset: 'vercel',
    primary_color: '#FFFFFF',
    bg_color: '#000000',
    surface_color: '#111111',
    text_color: '#EDEDED',
    muted_color: '#666666',
    accent_color: '#FFFFFF',
    font_family: 'Geist',
    border_radius: '4px',
    style_voice: 'monochrome-dark',
  },
  notion: {
    label: 'Notion',
    desc: '오프화이트, 차분한, 생산적',
    preset: 'notion',
    primary_color: '#2EAADC',
    bg_color: '#FFFFFF',
    surface_color: '#F7F6F3',
    text_color: '#37352F',
    muted_color: '#9B9A97',
    accent_color: '#2EAADC',
    font_family: 'Inter',
    border_radius: '4px',
    style_voice: 'productive-light',
  },
}

const TEMPLATES = [
  { key: 'landing', label: '랜딩 히어로', emoji: '🏠', prompt: '전환율 최적화된 SaaS 랜딩 페이지 히어로 섹션. 헤드라인, 서브카피, CTA 버튼 2개, 대시보드 목업 이미지 플레이스홀더 포함.' },
  { key: 'dashboard', label: '대시보드 UI', emoji: '📊', prompt: '메인 대시보드. 사이드바 네비게이션, 상단 KPI 카드 4개, 라인 차트 영역, 최근 활동 피드 포함.' },
  { key: 'pricing', label: '프라이싱', emoji: '💳', prompt: '구독 플랜 페이지. Free/Pro/Enterprise 3단 비교 카드, 연간/월간 토글, 기능 체크리스트 포함.' },
  { key: 'mobile', label: '모바일 앱', emoji: '📱', prompt: '모바일 앱 메인 화면. 375px 기준, 하단 탭바, 홈 피드, 플로팅 액션 버튼 포함.' },
  { key: 'auth', label: '로그인/회원가입', emoji: '🔐', prompt: '인증 페이지. 로고, 소셜 로그인 버튼, 이메일/비밀번호 폼, 에러 상태 포함.' },
  { key: 'onboarding', label: '온보딩 플로우', emoji: '✨', prompt: '3단계 온보딩. 진행 바, 각 단계별 폼/선택, 애니메이션 전환 효과 포함.' },
]

// ── LEFT: 템플릿 + 디자인 시스템 설정 ──────────────────────────
export function DesignLeftPanel({
  selectedTemplate,
  onTemplateChange,
  onApplyTemplate,
}: {
  selectedTemplate: string
  onTemplateChange: (t: string) => void
  onApplyTemplate: (prompt: string) => void
}) {
  const { currentMission } = useAppStore()
  const missionId = currentMission?.id
  const qc = useQueryClient()

  const { data: ds, isLoading } = useQuery({
    queryKey: ['design-system', missionId],
    queryFn: () => designSystemsApi.get(missionId!),
    enabled: !!missionId,
  })

  const [local, setLocal] = useState<Partial<DesignSystem>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (ds) setLocal(ds)
  }, [ds])

  const saveMutation = useMutation({
    mutationFn: () => designSystemsApi.update(missionId!, local),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['design-system', missionId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const applyPreset = (key: string) => {
    const preset = PRESETS[key]
    if (!preset) return
    const { label: _l, desc: _d, ...values } = preset
    setLocal(values)
  }

  const currentPreset = local.preset ?? 'oomni'

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* 템플릿 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">템플릿</p>
        <div className="space-y-1">
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              onClick={() => { onTemplateChange(t.key); onApplyTemplate(t.prompt) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-[13px]',
                selectedTemplate === t.key
                  ? 'bg-primary/10 border border-primary/40 text-text'
                  : 'hover:bg-surface text-muted hover:text-text'
              )}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 디자인 시스템 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">디자인 시스템</p>

        {isLoading ? (
          <div className="text-xs text-muted">불러오는 중...</div>
        ) : (
          <div className="space-y-3">
            {/* 프리셋 선택 */}
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all',
                    currentPreset === key
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  {/* 컬러 프리뷰 */}
                  <div
                    className="w-6 h-6 rounded-full border border-white/10"
                    style={{ backgroundColor: preset.primary_color }}
                  />
                  <span className="text-[10px] text-text leading-none">{preset.label}</span>
                </button>
              ))}
            </div>

            {/* 색상 커스터마이징 */}
            <div className="space-y-2">
              <ColorRow label="Primary" value={local.primary_color ?? '#D4763B'} onChange={v => setLocal(p => ({ ...p, primary_color: v, accent_color: v }))} />
              <ColorRow label="Background" value={local.bg_color ?? '#0F0F10'} onChange={v => setLocal(p => ({ ...p, bg_color: v }))} />
              <ColorRow label="Surface" value={local.surface_color ?? '#1A1A1C'} onChange={v => setLocal(p => ({ ...p, surface_color: v }))} />
              <ColorRow label="Text" value={local.text_color ?? '#E8E8E8'} onChange={v => setLocal(p => ({ ...p, text_color: v }))} />
            </div>

            {/* 폰트 선택 */}
            <div>
              <p className="text-[11px] text-muted mb-1">폰트</p>
              <select
                value={local.font_family ?? 'Pretendard'}
                onChange={e => setLocal(p => ({ ...p, font_family: e.target.value }))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-[12px] text-text focus:outline-none focus:border-primary"
              >
                {['Pretendard', 'Inter', 'Geist', 'Plus Jakarta Sans', 'DM Sans', 'Outfit'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* 보더 반경 */}
            <div>
              <p className="text-[11px] text-muted mb-1">모서리 반경</p>
              <div className="flex gap-1.5">
                {['0px', '4px', '8px', '12px', '16px', '24px'].map(r => (
                  <button
                    key={r}
                    onClick={() => setLocal(p => ({ ...p, border_radius: r }))}
                    className={cn(
                      'flex-1 py-1 text-[10px] border transition-colors',
                      local.border_radius === r
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-muted hover:border-primary/40'
                    )}
                    style={{ borderRadius: r }}
                  >
                    {r.replace('px', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-white rounded text-[12px] hover:bg-primary-hover transition-colors disabled:opacity-60"
            >
              {saved ? <><Check size={12} /> 저장됨</> : saveMutation.isPending ? '저장 중...' : '디자인 시스템 저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted w-16 shrink-0">{label}</label>
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-border bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-bg border border-border rounded px-2 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-primary"
        />
      </div>
    </div>
  )
}

// HTML 추출 — 완성된 블록 우선, 스트리밍 중이면 부분 HTML
function extractHtml(text: string, allowPartial = false): string | null {
  // 완성된 코드블록
  const complete = text.match(/```html([\s\S]*?)```/)
  if (complete) return complete[1].trim()
  // 스트리밍 중: 아직 닫히지 않은 블록에서 최소 200자 이상이면 렌더링
  if (allowPartial) {
    const partial = text.match(/```html([\s\S]{200,})$/)
    if (partial) {
      const html = partial[1].trim()
      // 최소한 렌더링 가능하도록 닫기
      if (!html.includes('</body>')) return html + '\n</body></html>'
      return html
    }
  }
  return null
}

// ── CENTER: 생성된 디자인 미리보기 (실시간 스트리밍 HTML 프리뷰) ─
type PreviewTab = 'html' | 'code'

export function DesignCenterPanel({
  agentId,
  streamOutput,
  isRunning,
  galleryHtml,
}: {
  agentId: string
  streamOutput?: string
  isRunning?: boolean
  screenshotUrl?: string | null
  galleryHtml?: string | null
}) {
  const { data: feed = [], refetch } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentsApi.runs(agentId),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    refetchInterval: isRunning ? false : 2000,
  })

  const latest = feed[0]
  const [previewTab, setPreviewTab] = useState<PreviewTab>('html')
  // 한 번 렌더된 HTML은 유지 — isRunning 전환 / feed 재로딩 중 flicker 방지
  const [lastHtml, setLastHtml] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 실행 완료 시 feed 즉시 갱신
  useEffect(() => {
    if (!isRunning && streamOutput) {
      setTimeout(() => refetch(), 500)
    }
  }, [isRunning]) // eslint-disable-line react-hooks/exhaustive-deps

  // 스트리밍 중: 실시간 HTML (부분 허용)
  const liveHtml = isRunning ? extractHtml(streamOutput ?? '', true) : null
  // 완료 후: feed에서 HTML
  const finalHtml = latest?.content ? extractHtml(latest.content, true) : null
  // 스트리밍 완료 직후 feed reload 전 fallback (streamOutput은 부모가 유지함)
  const streamFallback = !isRunning && streamOutput ? extractHtml(streamOutput, true) : null

  const currentHtml = liveHtml ?? finalHtml ?? streamFallback

  // 한 번이라도 HTML이 나오면 lastHtml에 보존
  useEffect(() => {
    if (currentHtml) setLastHtml(currentHtml)
  }, [currentHtml])

  // galleryHtml이 설정되면 iframe에 즉시 렌더
  useEffect(() => {
    if (!galleryHtml || !iframeRef.current) return
    setLastHtml(galleryHtml)
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open()
    doc.write(galleryHtml)
    doc.close()
    prevHtmlRef.current = galleryHtml
  }, [galleryHtml])

  const displayHtml = currentHtml ?? lastHtml ?? galleryHtml

  // 스트리밍 중 iframe을 srcDoc 대신 직접 write로 업데이트 (재마운트 없이 점진적 렌더링)
  const prevHtmlRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isRunning || !iframeRef.current || !liveHtml) return
    if (liveHtml === prevHtmlRef.current) return
    prevHtmlRef.current = liveHtml
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    // 완전히 새로 쓰기 (document.open/write/close) — 완성도가 낮은 HTML도 정상 렌더
    doc.open()
    doc.write(liveHtml)
    doc.close()
  }, [liveHtml, isRunning])

  // 스트리밍 종료 후 finalHtml로 확정 렌더링
  useEffect(() => {
    if (isRunning || !iframeRef.current) return
    const html = finalHtml ?? streamFallback
    if (!html || html === prevHtmlRef.current) return
    prevHtmlRef.current = html
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [isRunning, finalHtml, streamFallback])

  const isEmpty = !displayHtml && !isRunning && !streamOutput

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 탭 바 */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-surface shrink-0">
        {isRunning && (
          <div className="flex items-center gap-1.5 mr-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] text-muted">{liveHtml ? '실시간 프리뷰' : 'Claude Design 생성 중...'}</span>
          </div>
        )}
        <button
          onClick={() => setPreviewTab('html')}
          className={cn('px-3 py-1.5 rounded text-[12px] transition-colors', previewTab === 'html' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-text')}
        >
          HTML 미리보기
        </button>
        <button
          onClick={() => setPreviewTab('code')}
          className={cn('px-3 py-1.5 rounded text-[12px] transition-colors', previewTab === 'code' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-text')}
        >
          코드
        </button>
        <div className="ml-auto flex items-center gap-1">
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30 font-medium">
            ✦ Claude Design · Opus 4.7
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* HTML 미리보기 탭 */}
        {previewTab === 'html' && (
          <>
            {/* iframe은 항상 마운트 유지 — display 토글로 숨김/표시 */}
            <iframe
              ref={iframeRef}
              className={cn('w-full h-full border-0 absolute inset-0', isEmpty || previewTab !== 'html' ? 'invisible' : 'visible')}
              title="Design Preview"
              sandbox="allow-scripts allow-same-origin"
            />
            {/* 초기 빈 상태 안내 */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <Palette size={40} className="text-muted/20" />
                <div>
                  <p className="text-[14px] text-text font-medium mb-1">디자인 시스템을 설정하고 생성하세요</p>
                  <p className="text-[12px] text-muted">왼쪽에서 프리셋 선택 → 색상/폰트 커스터마이징 → 템플릿 클릭</p>
                  <p className="text-[12px] text-muted mt-1">또는 하단 입력창에 직접 입력</p>
                </div>
                <div className="grid grid-cols-3 gap-2 w-full max-w-sm mt-2">
                  {['다크 랜딩 페이지', 'SaaS 대시보드', '앱 로그인 화면'].map(s => (
                    <div key={s} className="bg-surface border border-border rounded-lg p-3 text-center">
                      <p className="text-[11px] text-muted">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* HTML 생성 중이지만 아직 200자 미만 */}
            {isRunning && !liveHtml && !lastHtml && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center bg-bg">
                <Palette size={32} className="text-muted/20" />
                <p className="text-[12px] text-muted">HTML 생성 중...</p>
              </div>
            )}
          </>
        )}

        {/* 코드 탭 */}
        {previewTab === 'code' && (
          <div className="h-full overflow-y-auto p-5">
            {latest?.created_at && !isRunning && (
              <p className="text-[11px] text-muted mb-2">
                {new Date(latest.created_at).toLocaleString('ko-KR')}
              </p>
            )}
            <pre className="text-[12px] text-muted leading-relaxed whitespace-pre-wrap font-mono">
              {latest?.content ?? streamOutput ?? ''}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ── RIGHT: 내보내기 + 갤러리 + 스킬 ───────────────────────────
export function DesignRightPanel({
  agentId,
  onSkillSelect,
  onLoadDesign,
  currentRole = 'design',
  content = '',
}: {
  agentId?: string
  nextBotName?: string
  onNextBot?: () => void
  onSkillSelect?: (prompt: string) => void
  onLoadDesign?: (html: string) => void
  currentRole?: string
  content?: string
}) {
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const { data: feed = [] } = useQuery({
    queryKey: ['bot-feed', agentId],
    queryFn: () => agentId ? agentsApi.runs(agentId) : Promise.resolve([]),
    select: (data: FeedItem[]) => data.filter(f => f.type === 'result'),
    enabled: !!agentId,
  })
  const { data: designOutputs = [] } = useQuery<DesignOutput[]>({
    queryKey: ['design-outputs', agentId],
    queryFn: () => agentId ? designOutputsApi.list(agentId) : Promise.resolve([]),
    enabled: !!agentId,
    staleTime: 10000,
  })
  const latest = feed[0]
  const latestContent = latest?.content ?? content

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2000) }

  const copyCode = (type: 'html' | 'tsx' | 'all') => {
    let code = ''
    if (type === 'html') {
      const m = latestContent.match(/```html([\s\S]*?)```/)
      code = m ? m[1].trim() : latestContent
    } else if (type === 'tsx') {
      const m = latestContent.match(/```tsx?([\s\S]*?)```/)
      code = m ? m[1].trim() : latestContent
    } else {
      code = latestContent
    }
    if (!code) { showToast('복사할 내용이 없습니다'); return }
    navigator.clipboard.writeText(code).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
      showToast('클립보드에 복사됐습니다')
    }).catch(() => showToast('복사 실패'))
  }

  const downloadHtml = () => {
    const m = latestContent.match(/```html([\s\S]*?)```/)
    const html = m ? m[1].trim() : latestContent
    if (!html) { showToast('다운로드할 HTML이 없습니다'); return }
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `design-${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const QUICK_PROMPTS = [
    { label: '랜딩 히어로', prompt: '전환율 최적화된 SaaS 랜딩 페이지 히어로 섹션을 디자인해줘. 임팩트 있는 헤드라인, 서브카피, CTA 버튼 2개(primary/ghost), 제품 스크린샷 목업 영역 포함.' },
    { label: '대시보드', prompt: '메인 대시보드 UI를 디자인해줘. 좌측 사이드바, 상단 헤더, KPI 카드 4개, 차트 영역, 최근 활동 피드 포함.' },
    { label: '프라이싱', prompt: '구독 플랜 비교 페이지 디자인. Free/Pro/Enterprise 카드, 연간/월간 토글, 각 플랜별 기능 리스트, 인기 플랜 하이라이트.' },
    { label: '로그인 UI', prompt: '로그인 페이지 디자인. 로고, Google/GitHub 소셜 로그인, 이메일+비밀번호 폼, 포커스/에러 상태 포함.' },
    { label: '모바일 홈', prompt: '모바일 앱 홈 화면 디자인 (375px 기준). 상단 헤더, 피드 카드 리스트, 하단 탭 네비게이션.' },
    { label: '알림 센터', prompt: '알림/인박스 UI 디자인. 필터 탭, 읽음/안읽음 상태, 알림 카드 리스트, 빈 상태 뷰.' },
    { label: '컴포넌트셋', prompt: '디자인 시스템 컴포넌트 페이지 디자인. 버튼 변형(primary/secondary/ghost/danger), 입력폼, 배지, 카드, 토스트 알림 모두 포함.' },
    { label: 'CSS 내보내기', prompt: '현재 디자인 시스템의 CSS 변수, Tailwind 설정, 기본 컴포넌트 스타일을 완성된 코드로 출력해줘.' },
  ]

  return (
    <div className="p-4 h-full flex flex-col gap-4 relative">
      {toastMsg && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text shadow-lg text-center">
          {toastMsg}
        </div>
      )}

      {/* 내보내기 */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest mb-2">내보내기</p>
        <div className="space-y-1.5">
          <button onClick={downloadHtml} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-muted hover:border-primary/40 hover:text-text transition-colors text-[12px]">
            <Download size={13} /> HTML 파일 다운로드
          </button>
          <button onClick={() => copyCode('html')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-muted hover:border-primary/40 hover:text-text transition-colors text-[12px]">
            {copied === 'html' ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            HTML 코드 복사
          </button>
          <button onClick={() => copyCode('tsx')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-muted hover:border-primary/40 hover:text-text transition-colors text-[12px]">
            {copied === 'tsx' ? <Check size={13} className="text-green-400" /> : <FileCode size={13} />}
            React TSX 복사
          </button>
          <button onClick={() => copyCode('all')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-muted hover:border-primary/40 hover:text-text transition-colors text-[12px]">
            {copied === 'all' ? <Check size={13} className="text-green-400" /> : <Layout size={13} />}
            전체 출력 복사
          </button>
        </div>
      </div>

      {/* 갤러리 — 저장된 디자인 */}
      {designOutputs.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">저장된 디자인 ({designOutputs.length})</p>
          <div className="space-y-1">
            {designOutputs.map(output => (
              <button
                key={output.id}
                onClick={async () => {
                  if (!agentId) return
                  const detail = await designOutputsApi.get(agentId, output.id)
                  if (detail.html_content) onLoadDesign?.(detail.html_content)
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border text-left hover:border-primary/40 hover:bg-surface transition-colors"
              >
                <Clock size={11} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-text truncate">{output.title || '(제목 없음)'}</p>
                  <p className="text-[10px] text-muted">{new Date(output.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 빠른 실행 */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-muted uppercase tracking-widest mb-2">빠른 실행</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map(skill => (
            <button
              key={skill.label}
              onClick={() => onSkillSelect?.(skill.prompt)}
              title={skill.prompt}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-[11px] text-muted hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      <ArchiveButton
        content={latestContent}
        title={latestContent?.slice(0, 50)}
        botRole="design"
        tags={['OOMNI', 'design']}
      />

      {agentId && <NextBotDropdown currentAgentId={agentId} currentRole={currentRole} content={content} />}
    </div>
  )
}
