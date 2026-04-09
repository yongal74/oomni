const steps = [
  {
    step: '01',
    title: '방향 설정',
    description: '원하는 목표를 자연어로 간단히 입력하세요. "경쟁사 분석 후 블로그 포스트 작성해줘" 처럼요.',
    detail: '자연어 명령 → 자동 파이프라인 구성',
  },
  {
    step: '02',
    title: 'AI 파이프라인 실행',
    description: '봇들이 순서대로 자동 실행됩니다. Research Bot의 결과가 Content Bot의 입력이 되고, 연쇄적으로 처리됩니다.',
    detail: '봇 → 봇 → 봇 자동 연결',
  },
  {
    step: '03',
    title: '결과물 수령',
    description: '파일, 코드, 보고서가 지정된 폴더에 자동 저장됩니다. 수정이 필요하면 즉시 재실행하세요.',
    detail: '파일 자동 저장 + 버전 관리',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#0A0A0A] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#D4763B] mb-4">
            작동 방식
          </span>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            3단계로 시작하세요
          </h2>
        </div>

        <div className="relative">
          {/* 연결선 */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 hidden lg:block w-full max-w-3xl">
            <div className="mx-24 h-0.5 bg-gradient-to-r from-[#1F1F1F] via-[#D4763B]/30 to-[#1F1F1F]" />
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            {steps.map((step) => (
              <div key={step.step} className="relative text-center">
                {/* 스텝 번호 */}
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#D4763B] bg-[#D4763B]/10 relative z-10">
                  <span className="text-sm font-bold text-[#D4763B]">{step.step}</span>
                </div>

                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-[#A3A3A3] text-sm leading-relaxed mb-4">{step.description}</p>

                <span className="inline-block rounded-full border border-[#1F1F1F] bg-[#141414] px-3 py-1 text-xs text-[#525252]">
                  {step.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 코드 예시 */}
        <div className="mt-16 mx-auto max-w-2xl rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
          <p className="text-xs text-[#525252] mb-3 font-mono">예시 명령어</p>
          <div className="space-y-2 font-mono text-sm">
            <p className="text-[#D4763B]">$ oomni run</p>
            <p className="text-[#A3A3A3]">&gt; <span className="text-white">"AI 자동화 SaaS 시장 분석 후 블로그 포스트 3개 작성"</span></p>
            <p className="text-[#27C93F] mt-3">✓ Research Bot 실행 중...</p>
            <p className="text-[#27C93F]">✓ Content Bot에 결과 전달 중...</p>
            <p className="text-[#27C93F]">✓ 블로그 포스트 3개 생성 완료</p>
            <p className="text-[#525252]">→ 저장: /oomni-data/content/2026-04-09/</p>
          </div>
        </div>
      </div>
    </section>
  );
}
