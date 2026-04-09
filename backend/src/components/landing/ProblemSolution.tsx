const problems = [
  '리서치, 글쓰기, 개발, 디자인, 마케팅... 혼자 다 해야 한다',
  '비싼 팀을 꾸릴 예산이 없다',
  '반복 작업에 창의적인 시간을 빼앗긴다',
  '중요한 전략보다 잡무에 하루가 사라진다',
];

const solutions = [
  { icon: '🔍', text: 'Research Bot이 경쟁사와 트렌드를 분석합니다' },
  { icon: '✍️', text: 'Content Bot이 블로그, SNS, 뉴스레터를 작성합니다' },
  { icon: '⚡', text: 'Build Bot이 코드와 API를 자동으로 생성합니다' },
  { icon: '🎨', text: 'Design Bot이 UI와 소셜 카드를 디자인합니다' },
];

export function ProblemSolution() {
  return (
    <section className="bg-[#0A0A0A] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* Problem */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#EF4444] mb-4">
              현실
            </span>
            <h2 className="text-3xl font-bold text-white sm:text-4xl mb-8">
              솔로 창업자의 24시간은
              <br />
              <span className="text-[#A3A3A3]">턱없이 부족합니다</span>
            </h2>
            <ul className="space-y-4">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-[#EF4444]">✗</span>
                  <p className="text-[#A3A3A3]">{problem}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-[#D4763B]/5 blur-xl" />
            <div className="relative rounded-2xl border border-[#D4763B]/20 bg-[#0F0F0F] p-8">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#D4763B] mb-4">
                해결책
              </span>
              <h3 className="text-2xl font-bold text-white mb-2">
                OOMNI는 당신의 AI 팀입니다
              </h3>
              <p className="text-[#A3A3A3] text-sm mb-8">
                7개의 전문 AI 에이전트가 파이프라인으로 연결되어,
                한 봇의 결과물이 다음 봇의 입력이 됩니다.
              </p>
              <ul className="space-y-4">
                {solutions.map((solution) => (
                  <li key={solution.text} className="flex items-start gap-3">
                    <span className="flex-shrink-0 text-xl">{solution.icon}</span>
                    <p className="text-[#F5F5F5] text-sm leading-relaxed">{solution.text}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-[#1F1F1F]">
                <p className="text-xs text-[#525252]">
                  ✓ 방향만 설정하세요. 나머지는 OOMNI가 처리합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
