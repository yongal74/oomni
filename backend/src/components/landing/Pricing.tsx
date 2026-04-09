import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    price: '무료',
    period: '',
    description: '처음 시작하는 솔로 창업자',
    highlight: false,
    ctaText: '무료로 시작',
    ctaHref: '/signup',
    features: [
      { text: '월 50 에이전트 실행', included: true },
      { text: '3개 봇 (Research, Content, CEO)', included: true },
      { text: '기본 템플릿', included: true },
      { text: '커뮤니티 지원', included: true },
      { text: '파이프라인 자동 실행', included: false },
      { text: 'API 액세스', included: false },
    ],
  },
  {
    name: 'Pro',
    price: '₩49,000',
    period: '/월',
    description: '자동화가 필요한 창업자',
    highlight: true,
    badge: '가장 인기',
    ctaText: 'Pro 시작하기',
    ctaHref: '/signup?plan=pro',
    features: [
      { text: '월 500 에이전트 실행', included: true },
      { text: '전체 7개 봇', included: true },
      { text: '고급 템플릿', included: true },
      { text: '우선 지원', included: true },
      { text: '파이프라인 자동 실행', included: true },
      { text: 'API 액세스', included: false },
    ],
  },
  {
    name: 'Team',
    price: '₩149,000',
    period: '/월',
    description: '팀 단위 자동화',
    highlight: false,
    ctaText: 'Team 시작하기',
    ctaHref: '/signup?plan=team',
    features: [
      { text: '무제한 에이전트 실행', included: true },
      { text: '전체 7개 봇 + 커스텀 봇', included: true },
      { text: '전용 지원', included: true },
      { text: '팀 협업 기능', included: true },
      { text: '파이프라인 자동 실행', included: true },
      { text: 'API 액세스', included: true },
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-[#0A0A0A] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#D4763B] mb-4">
            가격
          </span>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            합리적인 가격으로 시작하세요
          </h2>
          <p className="mt-4 text-[#A3A3A3]">
            카드 정보 없이 무료로 시작 · 언제든지 업그레이드 · 해지 수수료 없음
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 ${
                plan.highlight
                  ? 'border-2 border-[#D4763B] bg-[#141414] shadow-xl shadow-[#D4763B]/10'
                  : 'border border-[#1F1F1F] bg-[#0F0F0F]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#D4763B] px-4 py-1 text-xs font-semibold text-white">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-[#525252] mt-1">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                {plan.period && <span className="text-[#A3A3A3] ml-1">{plan.period}</span>}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-3">
                    <span className={`flex-shrink-0 text-sm mt-0.5 ${feature.included ? 'text-[#D4763B]' : 'text-[#3A3A3A]'}`}>
                      {feature.included ? '✓' : '✗'}
                    </span>
                    <span className={`text-sm ${feature.included ? 'text-[#D4D4D4]' : 'text-[#525252]'}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`block w-full rounded-md px-4 py-3 text-sm font-semibold text-center transition-all ${
                  plan.highlight
                    ? 'bg-[#D4763B] text-white hover:bg-[#C06830] shadow-lg shadow-[#D4763B]/25'
                    : 'border border-[#2A2A2A] bg-[#141414] text-white hover:border-[#3A3A3A] hover:bg-[#1A1A1A]'
                }`}
              >
                {plan.ctaText}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
