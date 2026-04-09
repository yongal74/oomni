const features = [
  {
    icon: '🔍',
    title: 'Research Bot',
    subtitle: '시장을 꿰뚫는 리서치 자동화',
    description:
      '경쟁사 분석, 트렌드 모니터링, 키워드 발굴을 자동으로 수행하고 구조화된 보고서를 생성합니다.',
    color: '#3B82F6',
  },
  {
    icon: '✍️',
    title: 'Content Bot',
    subtitle: '전문가 수준의 콘텐츠 자동 생성',
    description:
      '블로그, 뉴스레터, SNS 포스트, 유튜브 스크립트까지 리서치 데이터를 기반으로 즉시 생성합니다.',
    color: '#8B5CF6',
  },
  {
    icon: '🛠️',
    title: 'Build Bot',
    subtitle: '코드 없이 기능 구현',
    description:
      'Next.js 컴포넌트, API 엔드포인트, DB 스키마를 자동으로 생성하고 보안 감사까지 수행합니다.',
    color: '#10B981',
  },
  {
    icon: '🎨',
    title: 'Design Bot',
    subtitle: '프로급 디자인을 몇 초 만에',
    description:
      '랜딩 페이지, 대시보드, 소셜 카드, 이메일 템플릿을 브랜드 컬러로 자동 생성합니다.',
    color: '#D4763B',
  },
  {
    icon: '📈',
    title: 'Growth Bot',
    subtitle: '데이터 기반 성장 전략 자동화',
    description:
      'A/B 테스트 설계, 퍼널 분석, 사용자 세그멘테이션, 캠페인 기획을 AI가 자동으로 처리합니다.',
    color: '#EAB308',
  },
  {
    icon: '⚙️',
    title: 'Ops Bot',
    subtitle: '운영의 모든 것을 자동화',
    description:
      '월간 재무 보고, 세금 준비, SaaS 비용 감사, 장애 리포트를 자동으로 생성합니다.',
    color: '#06B6D4',
  },
  {
    icon: '🧠',
    title: 'CEO Bot',
    subtitle: '전략적 의사결정 지원',
    description:
      'OKR 체크, 투자자 업데이트 레터, 우선순위 매트릭스, 주간 CEO 브리핑을 자동으로 작성합니다.',
    color: '#EC4899',
  },
];

export function Features() {
  return (
    <section id="features" className="bg-[#0D0D0D] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="inline-block rounded-full bg-[#D4763B]/10 px-3 py-1 text-xs font-medium text-[#D4763B] border border-[#D4763B]/30 mb-4">
            7개의 전문 AI 봇
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            비즈니스의 모든 영역을 커버합니다
          </h2>
          <p className="mt-4 text-[#A3A3A3]">
            각 봇은 특정 역할에 특화되어 있으며, 파이프라인으로 연결되어 자동으로 협업합니다.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-xl border border-[#1F1F1F] bg-[#141414] p-6 hover:border-[#D4763B]/30 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#D4763B]/5"
            >
              <div
                className="mb-4 h-10 w-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: f.color + '15', border: `1px solid ${f.color}30` }}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-white text-sm">{f.title}</h3>
              <p
                className="mt-0.5 text-xs font-medium mb-3"
                style={{ color: f.color }}
              >
                {f.subtitle}
              </p>
              <p className="text-xs text-[#A3A3A3] leading-relaxed">{f.description}</p>
            </div>
          ))}

          {/* 파이프라인 카드 */}
          <div className="rounded-xl border border-dashed border-[#D4763B]/30 bg-[#D4763B]/5 p-6 flex flex-col items-center justify-center text-center">
            <div className="text-2xl mb-3">🔗</div>
            <p className="text-sm font-semibold text-[#D4763B]">파이프라인 자동 연결</p>
            <p className="mt-2 text-xs text-[#A3A3A3]">
              봇들이 순서대로 자동 실행되며 결과물을 서로 전달합니다
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
