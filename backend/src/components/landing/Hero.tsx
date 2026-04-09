import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] pt-32 pb-24 sm:pt-40 sm:pb-32">
      {/* 배경 그라디언트 효과 */}
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212,118,59,0.3), transparent)',
        }}
      />
      {/* 그리드 패턴 */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#D4763B 1px, transparent 1px), linear-gradient(90deg, #D4763B 1px, transparent 1px)',
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

          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl leading-tight">
            혼자서도{' '}
            <span className="text-[#D4763B]">팀처럼</span>{' '}
            움직이세요
          </h1>

          <p className="mt-6 text-lg leading-8 text-[#A3A3A3] max-w-2xl mx-auto">
            OOMNI는 리서치, 콘텐츠, 개발, 디자인, 성장 전략을 자동으로 연결하는
            AI 에이전트 파이프라인입니다. 방향만 설정하면 봇이 나머지를 처리합니다.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-md bg-[#D4763B] px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#D4763B]/20 hover:bg-[#c06830] transition-all hover:shadow-[#D4763B]/30 hover:-translate-y-0.5"
            >
              OOMNI 시작하기 →
            </Link>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto rounded-md border border-[#1F1F1F] bg-[#141414] px-8 py-3.5 text-sm font-semibold text-white hover:border-[#D4763B]/50 hover:bg-[#1a1a1a] transition-all"
            >
              작동 방식 보기
            </Link>
          </div>

          <p className="mt-4 text-xs text-[#525252]">
            14일 무료 체험 · 카드 정보 불필요 · 언제든 해지 가능
          </p>
        </div>

        {/* 대시보드 미리보기 */}
        <div className="mt-16 sm:mt-24 relative">
          <div className="rounded-2xl border border-[#1F1F1F] bg-[#141414] p-1 shadow-2xl shadow-black/50">
            <div className="rounded-xl overflow-hidden">
              {/* 가상 대시보드 UI */}
              <div className="bg-[#0F0F0F] p-4 border-b border-[#1F1F1F] flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                  <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <div className="h-3 w-3 rounded-full bg-[#28C840]" />
                </div>
                <div className="flex-1 mx-4 h-5 rounded bg-[#1F1F1F] max-w-xs text-xs text-[#525252] flex items-center px-3">
                  app.oomni.ai/pipeline
                </div>
              </div>
              <div className="p-6 grid grid-cols-7 gap-2">
                {[
                  { name: 'Research', color: '#3B82F6', icon: '🔍' },
                  { name: 'Content', color: '#8B5CF6', icon: '✍️' },
                  { name: 'Build', color: '#10B981', icon: '🛠️' },
                  { name: 'Design', color: '#D4763B', icon: '🎨' },
                  { name: 'Growth', color: '#EAB308', icon: '📈' },
                  { name: 'Ops', color: '#06B6D4', icon: '⚙️' },
                  { name: 'CEO', color: '#EC4899', icon: '🧠' },
                ].map((bot, i) => (
                  <div
                    key={bot.name}
                    className="flex flex-col items-center gap-2 rounded-lg border border-[#1F1F1F] bg-[#141414] p-3 text-center"
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-sm"
                      style={{ backgroundColor: bot.color + '20', border: `1px solid ${bot.color}40` }}
                    >
                      {bot.icon}
                    </div>
                    <span className="text-xs text-[#A3A3A3] font-medium">{bot.name}</span>
                    <div
                      className="h-1 w-full rounded-full"
                      style={{ backgroundColor: bot.color + '40' }}
                    >
                      <div
                        className="h-1 rounded-full animate-pulse"
                        style={{
                          backgroundColor: bot.color,
                          width: `${[85, 62, 40, 90, 55, 75, 30][i]}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* 글로우 효과 */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-1/2 h-16 bg-[#D4763B]/10 blur-3xl rounded-full" />
        </div>
      </div>
    </section>
  );
}
