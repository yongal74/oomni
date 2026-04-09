const problems = [
  '리서치, 글쓰기, 개발, 디자인, 마케팅... 혼자 다 해야 한다',
  '비싼 팀을 꾸릴 예산이 없다',
  '반복 작업에 창의적인 시간을 빼앗긴다',
  '중요한 전략보다 잡무에 하루가 사라진다',
];

const solutions = [
  { icon: '🔗', text: '7개 전문 AI 봇이 파이프라인으로 자동 연결' },
  { icon: '⚡', text: '봇의 결과물이 다음 봇의 입력으로 자동 전달' },
  { icon: '✅', text: '당신은 방향만 설정하고 결과만 확인하면 됩니다' },
];

export function ProblemSolution() {
  return (
    <section className="bg-[#0A0A0A] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 items-center">
          {/* Problem */}
          <div>
            <span className="inline-block rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 border border-red-500/20 mb-6">
              문제
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              솔로 창업자의 24시간은
              <br />
              <span className="text-[#A3A3A3]">턱없이 부족합니다</span>
            </h2>
            <ul className="mt-8 space-y-4">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-xs text-red-400">
                    ✕
                  </span>
                  <span className="text-[#A3A3A3]">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-[#D4763B]/5 blur-xl" />
            <div className="relative rounded-2xl border border-[#D4763B]/20 bg-[#141414] p-8">
              <span className="inline-block rounded-full bg-[#D4763B]/10 px-3 py-1 text-xs font-medium text-[#D4763B] border border-[#D4763B]/30 mb-6">
                해결책
              </span>
              <h3 className="text-2xl font-bold text-white mb-2">
                OOMNI는 당신의 AI 팀입니다
              </h3>
              <p className="text-[#A3A3A3] mb-8">
                7개의 전문 AI 에이전트가 파이프라인으로 연결되어, 한 봇의 결과물이
                다음 봇의 입력이 됩니다.
              </p>
              <ul className="space-y-4">
                {solutions.map((s) => (
                  <li key={s.text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-lg bg-[#D4763B]/10 border border-[#D4763B]/30 flex items-center justify-center text-base">
                      {s.icon}
                    </span>
                    <span className="text-white pt-1">{s.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
