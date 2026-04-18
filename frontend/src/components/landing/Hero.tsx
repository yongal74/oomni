import { useEffect, useRef } from 'react'

// ─── Mock 데이터: 앱 스크린샷 대체 UI ───────────────────────────────────────
const MOCK_BOTS = [
  { label: 'Research', color: '#60A5FA', status: 'done',    value: '완료' },
  { label: 'Content',  color: '#A78BFA', status: 'running', value: '실행 중' },
  { label: 'Build',    color: '#34D399', status: 'done',    value: '완료' },
  { label: 'Design',   color: '#F472B6', status: 'idle',    value: '대기' },
  { label: 'Growth',   color: '#FB923C', status: 'idle',    value: '대기' },
  { label: 'Ops',      color: '#FBBF24', status: 'idle',    value: '대기' },
  { label: 'CEO',      color: '#E8935C', status: 'idle',    value: '대기' },
]

const MOCK_LOG = [
  { time: '09:14', bot: 'Research', msg: '시장 조사 보고서 생성 완료 ✓' },
  { time: '09:22', bot: 'Content',  msg: '블로그 초안 작성 중... (3/7)' },
  { time: '09:31', bot: 'Build',    msg: 'API 엔드포인트 3개 배포 완료 ✓' },
]

// ─── StatusDot ────────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  if (status === 'done')
    return <span className="inline-block w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
  if (status === 'running')
    return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#3D3828' }} />
}

// ─── AppMockup ────────────────────────────────────────────────────────────────
function AppMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{
        borderColor: '#3D3828',
        background: '#1C1812',
        boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(212,118,59,0.18)',
      }}
    >
      {/* Window chrome bar */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ background: '#242018', borderColor: '#3D3828' }}
      >
        <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
        <span className="w-3 h-3 rounded-full bg-[#28CA41]" />
        <span className="ml-3 text-xs font-medium" style={{ color: '#8A7E6E' }}>
          OOMNI — AI 팀 대시보드
        </span>
        <span
          className="ml-auto flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold"
          style={{ background: 'rgba(212,118,59,0.15)', color: '#E8935C', border: '1px solid rgba(212,118,59,0.3)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block shadow-[0_0_5px_#4ade80]" />
          3개 봇 실행 중
        </span>
      </div>

      {/* Dashboard body */}
      <div className="p-4 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '활성 봇', value: '3', color: '#4ade80' },
            { label: '오늘 완료', value: '14', color: '#60A5FA' },
            { label: '승인 대기', value: '2', color: '#FBBF24' },
            { label: '이번 달 비용', value: '$3.8', color: '#E8935C' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 border"
              style={{ background: '#242018', borderColor: '#3D3828' }}
            >
              <div className="text-[10px] mb-1" style={{ color: '#8A7E6E' }}>{s.label}</div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Bot pipeline */}
        <div className="rounded-xl border p-3" style={{ background: '#242018', borderColor: '#3D3828' }}>
          <div className="text-[10px] font-semibold mb-2.5" style={{ color: '#8A7E6E' }}>AI 에이전트 파이프라인</div>
          <div className="flex gap-2">
            {MOCK_BOTS.map((b) => (
              <div
                key={b.label}
                className="flex-1 rounded-lg p-2 flex flex-col items-center gap-1.5 border"
                style={{
                  background: b.status !== 'idle' ? `${b.color}12` : 'transparent',
                  borderColor: b.status !== 'idle' ? `${b.color}40` : '#3D3828',
                }}
              >
                <StatusDot status={b.status} />
                <span className="text-[9px] font-semibold" style={{ color: b.status !== 'idle' ? b.color : '#8A7E6E' }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity log */}
        <div className="rounded-xl border p-3 space-y-2" style={{ background: '#242018', borderColor: '#3D3828' }}>
          <div className="text-[10px] font-semibold mb-1" style={{ color: '#8A7E6E' }}>실시간 로그</div>
          {MOCK_LOG.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] shrink-0" style={{ color: '#8A7E6E' }}>{l.time}</span>
              <span
                className="text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(212,118,59,0.15)', color: '#E8935C' }}
              >
                {l.bot}
              </span>
              <span className="text-[10px]" style={{ color: '#BDB09E' }}>{l.msg}</span>
            </div>
          ))}
          {/* Cursor blink */}
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: '#8A7E6E' }}>09:38</span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}
            >
              Content
            </span>
            <span className="text-[10px]" style={{ color: '#BDB09E' }}>
              뉴스레터 초안 완성
              <span className="inline-block w-1 h-3 ml-0.5 bg-[#D4763B] animate-pulse align-middle" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
export function Hero() {
  const leftRef = useRef<HTMLDivElement>(null)

  // Intersection Observer로 appear 애니메이션
  useEffect(() => {
    const els = document.querySelectorAll('[data-appear]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            ;(e.target as HTMLElement).style.opacity = '1'
            ;(e.target as HTMLElement).style.transform = 'translateY(0)'
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="relative min-h-screen flex items-center pt-16 overflow-hidden"
      style={{
        background: '#1C1812',
        backgroundImage: 'radial-gradient(circle, rgba(212,118,59,0.10) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      {/* ── Ambient blobs ── */}
      <div
        className="pointer-events-none absolute -top-20 -left-40 w-[650px] h-[650px] rounded-full"
        style={{ background: 'rgba(212,118,59,0.07)', filter: 'blur(100px)' }}
      />
      <div
        className="pointer-events-none absolute bottom-0 -right-20 w-[480px] h-[480px] rounded-full"
        style={{ background: 'rgba(139,92,246,0.06)', filter: 'blur(100px)' }}
      />

      <div className="relative w-full max-w-6xl mx-auto px-6 py-28">
        <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-center">

          {/* ── Copy column ── */}
          <div
            ref={leftRef}
            data-appear
            style={{
              opacity: 0,
              transform: 'translateY(28px)',
              transition: 'opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            {/* Launch badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm font-semibold"
              style={{
                background: 'rgba(212,118,59,0.10)',
                border: '1px solid rgba(212,118,59,0.30)',
                color: '#E8935C',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
              v1.6 출시 · Windows / macOS · 무료 오픈소스
            </div>

            {/* Headline — 고통 해결 중심 (채택 카피) */}
            <h1
              className="font-black leading-none tracking-tight mb-6"
              style={{
                fontSize: 'clamp(3rem, 6.5vw, 5.5rem)',
                letterSpacing: '-0.04em',
                color: '#F8F2E4',
              }}
            >
              더 이상<br />
              혼자 다 할<br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #E8935C 0%, #D4763B 60%, #C05A22 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                수 없어요.
              </span>
            </h1>

            {/* Sub-copy */}
            <p
              className="text-lg leading-relaxed mb-3 max-w-lg font-medium"
              style={{ color: '#BDB09E' }}
            >
              이제 AI가 팀이 됩니다. 9개의 AI 에이전트가 리서치부터 코드, 콘텐츠, 운영까지 24시간 이어달리기로 처리합니다.
            </p>
            <p className="text-sm mb-12" style={{ color: '#8A7E6E' }}>
              월정액 없음 · 서버비 없음 · 100% 내 PC에서 실행
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              {/* Primary CTA */}
              <a
                href="#download"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all duration-250"
                style={{
                  background: 'linear-gradient(135deg, #E0844A, #D4763B, #C46828)',
                  boxShadow: '0 4px 24px rgba(212,118,59,0.40), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 10px 36px rgba(212,118,59,0.55), inset 0 1px 0 rgba(255,255,255,0.2)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(212,118,59,0.40), inset 0 1px 0 rgba(255,255,255,0.15)'
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                지금 무료로 시작하기
              </a>

              {/* Ghost CTA */}
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-semibold transition-all duration-200"
                style={{
                  border: '1.5px solid #3D3828',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#BDB09E',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#D4763B'
                  ;(e.currentTarget as HTMLElement).style.color = '#F2EAD8'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(212,118,59,0.08)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#3D3828'
                  ;(e.currentTarget as HTMLElement).style.color = '#BDB09E'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                데모 보기
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-5 text-xs" style={{ color: '#8A7E6E' }}>
              {[
                { icon: (
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ), label: '오픈소스 · MIT' },
                { icon: (
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                ), label: '로컬 전용 실행' },
                { icon: (
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ), label: 'Claude Code 기반' },
                { icon: (
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ), label: '1,200+ 솔로 창업자' },
              ].map((b) => (
                <span key={b.label} className="flex items-center gap-1.5">
                  {b.icon}
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Mockup column ── */}
          <div
            data-appear
            style={{
              opacity: 0,
              transform: 'translateY(28px)',
              transition: 'opacity 0.7s 0.18s cubic-bezier(0.22,1,0.36,1), transform 0.7s 0.18s cubic-bezier(0.22,1,0.36,1)',
              animation: 'floatY 7s ease-in-out infinite',
            }}
          >
            <style>{`
              @keyframes floatY {
                0%, 100% { transform: translateY(0px); }
                50%       { transform: translateY(-14px); }
              }
            `}</style>
            <AppMockup />
          </div>

        </div>
      </div>
    </section>
  )
}
