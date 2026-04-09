const features = [
  {
    icon: '🔍',
    title: 'Research Bot',
    subtitle: '시장을 꿰뚫는 리서치 자동화',
    description: '경쟁사 분석, 트렌드 모니터링, 키워드 발굴을 자동으로 수행하고 구조화된 보고서를 생성합니다.',
    color: '#6366F1',
  },
  {
    icon: '✍️',
    title: 'Content Bot',
    subtitle: '전문가 수준의 콘텐츠 자동 생성',
    description: '블로그, 뉴스레터, SNS 포스트, 유튜브 스크립트까지 — 리서치 데이터 기반으로 콘텐츠를 자동 생성합니다.',
    color: '#10B981',
  },
  {
    icon: '⚡',
    title: 'Build Bot',
    subtitle: '코드 없이 기능 구현',
    description: 'Next.js 컴포넌트, API 엔드포인트, DB 스키마를 자동으로 생성하고 보안 감사까지 수행합니다.',
    color: '#3B82F6',
  },
  {
    icon: '🎨',
    title: 'Design Bot',
    subtitle: '프로급 디자인을 몇 초 만에',
    description: '랜딩 페이지, 대시보드, 소셜 카드, 이메일 템플릿을 다크 테마 + 브랜드 컬러로 자동 생성합니다.',
    color: '#D4763B',
  },
  {
    icon: '📈',
    title: 'Growth Bot',
    subtitle: '데이터 기반 성장 전략 자동화',
    description: 'A/B 테스트 설계, 퍼널 분석, 사용자 세그멘테이션, 캠페인 기획을 AI가 자동으로 처리합니다.',
    color: '#F59E0B',
  },
  {
    icon: '⚙️',
    title: 'Ops Bot',
    subtitle: '운영의 모든 것을 자동화',
    description: '월간 재무 보고, 세금 준비, SaaS 비용 감사, 장애 리포트를 자동으로 생성합니다.',
    color: '#8B5CF6',
  },
  {
    icon: '👔',
    title: 'CEO Bot',
    subtitle: '전략적 의사결정 지원',
    description: 'OKR 체크, 투자자 업데이트 레터, 우선순위 매트릭스, 주간 CEO 브리핑을 자동으로 작성합니다.',
    color: '#EF4444',
  },
];

export function Features() {
  return (
    <section id="features" className="bg-[#0F0F0F] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#D4763B] mb-4">
            기능
          </span>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            7개의 AI 봇이 당신의 팀이 됩니다
          </h2>
          <p className="mt-4 text-[#A3A3A3]">
            각 봇은 특정 역할을 전문으로 수행하고, 결과물을 다음 봇으로 자동 전달합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-[#1F1F1F] bg-[#141414] p-6 hover:border-[#2A2A2A] transition-all hover:-translate-y-1"
            >
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: `${feature.color}15` }}
              >
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-1">{feature.title}</h3>
              <p className="text-xs font-medium mb-2" style={{ color: feature.color }}>
                {feature.subtitle}
              </p>
              <p className="text-sm text-[#717171] leading-relaxed">{feature.description}</p>

              {/* 호버 글로우 */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ boxShadow: `inset 0 0 30px ${feature.color}08` }}
              />
            </div>
          ))}

          {/* 커스텀 봇 카드 */}
          <div className="rounded-xl border border-dashed border-[#2A2A2A] bg-[#0A0A0A] p-6 flex flex-col items-center justify-center text-center">
            <span className="text-3xl mb-3">➕</span>
            <p className="text-sm font-medium text-[#525252]">커스텀 봇</p>
            <p className="text-xs text-[#3A3A3A] mt-1">Team 플랜에서 나만의 봇을 만드세요</p>
          </div>
        </div>
      </div>
    </section>
  );
}
