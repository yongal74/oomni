import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* 배경 글로우 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#D4763B]/5 blur-[120px]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#D4763B]/3 blur-[100px]" />
      </div>

      {/* 그리드 패턴 */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#D4763B 1px, transparent 1px), linear-gradient(to right, #D4763B 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* 배지 */}
          <div className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D4763B]/30 bg-[#D4763B]/10 px-4 py-1.5 text-sm font-medium text-[#D4763B]">
              🤖 AI 에이전트 자동화 플랫폼
            </span>
          </div>

          {/* 헤드라인 */}
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl leading-tight">
            혼자서도{' '}
            <span className="text-[#D4763B]">팀처럼</span>{' '}
            움직이세요
          </h1>

          {/* 서브 헤드라인 */}
          <p className="mt-6 text-lg leading-8 text-[#A3A3A3] max-w-2xl mx-auto">
            OOMNI는 리서치, 콘텐츠, 개발, 디자인, 성장 전략을 자동으로 연결하는
            <br className="hidden sm:block" />
            AI 에이전트 파이프라인입니다. 방향만 설정하면 봇이 알아서 처리합니다.
          </p>

          {/* CTA 버튼 */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-[#D4763B] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#D4763B]/25 hover:bg-[#C06830] transition-all hover:shadow-[#D4763B]/40 hover:scale-105"
            >
              OOMNI 시작하기 →
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-semibold text-[#A3A3A3] hover:text-white transition-colors flex items-center gap-1"
            >
              작동 방식 보기 <span aria-hidden="true">↓</span>
            </Link>
          </div>

          {/* 신뢰 문구 */}
          <p className="mt-6 text-xs text-[#525252]">
            카드 정보 불필요 · 14일 무료 체험 · 언제든지 해지 가능
          </p>
        </div>

        {/* 히어로 비주얼 — 파이프라인 아이콘 */}
        <div className="mt-20 mx-auto max-w-4xl">
          <div className="rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-6 shadow-2xl shadow-black/50">
            {/* 터미널 상단 */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[#1F1F1F]">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
              <span className="ml-2 text-xs text-[#525252] font-mono">OOMNI Pipeline</span>
            </div>

            {/* 파이프라인 플로우 */}
            <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
              {[
                { name: 'Research', color: '#6366F1', icon: '🔍' },
                { name: 'Content', color: '#10B981', icon: '✍️' },
                { name: 'Build', color: '#3B82F6', icon: '⚡' },
                { name: 'Design', color: '#D4763B', icon: '🎨' },
                { name: 'Growth', color: '#F59E0B', icon: '📈' },
                { name: 'Ops', color: '#8B5CF6', icon: '⚙️' },
                { name: 'CEO', color: '#EF4444', icon: '👔' },
              ].map((bot, i, arr) => (
                <div key={bot.name} className="flex items-center gap-2">
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border px-3 py-2 sm:px-4 sm:py-3 min-w-[64px] sm:min-w-[80px] transition-all hover:scale-105 cursor-default"
                    style={{ borderColor: `${bot.color}30`, backgroundColor: `${bot.color}10` }}
                  >
                    <span className="text-lg sm:text-xl">{bot.icon}</span>
                    <span className="text-xs font-medium mt-1" style={{ color: bot.color }}>
                      {bot.name}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-[#D4763B] text-sm font-bold hidden sm:block">→</span>
                  )}
                </div>
              ))}
            </div>

            {/* 실행 로그 */}
            <div className="mt-4 pt-4 border-t border-[#1F1F1F] font-mono text-xs space-y-1">
              <p className="text-[#27C93F]">✓ Research Bot: 경쟁사 분석 완료 (23개 항목)</p>
              <p className="text-[#27C93F]">✓ Content Bot: 블로그 포스트 3개 생성 완료</p>
              <p className="text-[#D4763B]">⟳ Design Bot: 랜딩 페이지 생성 중...</p>
              <p className="text-[#525252]">○ Growth Bot: 대기 중</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
