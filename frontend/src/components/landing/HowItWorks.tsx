const STEPS = [
  {
    num: '01',
    title: '앱 설치 & API 키 입력',
    desc: '무료로 다운로드하고 Claude API 키만 입력하면 준비 완료. 설정은 5분이면 충분합니다.',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  {
    num: '02',
    title: '목표를 입력하세요',
    desc: '"이번 주 블로그 3개 써줘" 처럼 자연어로 지시하면 적합한 봇이 자동으로 선택됩니다.',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    num: '03',
    title: 'AI 봇이 이어달리기',
    desc: 'Research → Content → Build → Design 순서로 결과물을 자동으로 넘겨받아 처리합니다.',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="13 17 18 12 13 7"/>
        <polyline points="6 17 11 12 6 7"/>
      </svg>
    ),
  },
  {
    num: '04',
    title: '승인 후 자동 배포',
    desc: '중요한 결정만 당신이 승인하면 나머지는 봇이 자동으로 완료합니다. 개입을 최소화합니다.',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
]

export function HowItWorks() {
  return (
    <section id="features" className="py-24" style={{ background: '#242018' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
            style={{ background: 'rgba(212,118,59,0.12)', border: '1px solid rgba(212,118,59,0.28)', color: '#E8935C' }}
          >
            사용 방법
          </span>
          <h2
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: '#F8F2E4' }}
          >
            4단계로 끝납니다
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className="hidden lg:block absolute top-10 left-full w-full h-px z-0"
                  style={{ background: 'linear-gradient(to right, #3D3828, transparent)' }}
                />
              )}
              <div
                className="relative rounded-2xl p-6 border h-full"
                style={{ background: '#2C271E', borderColor: '#3D3828' }}
              >
                {/* Step number badge */}
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-5 text-sm font-black"
                  style={{ background: 'rgba(212,118,59,0.15)', color: '#D4763B', border: '1px solid rgba(212,118,59,0.3)' }}
                >
                  {s.num}
                </div>
                <div className="mb-3" style={{ color: '#D4763B' }}>{s.icon}</div>
                <h3 className="text-base font-bold mb-2" style={{ color: '#F2EAD8', letterSpacing: '-0.01em' }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#8A7E6E' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
