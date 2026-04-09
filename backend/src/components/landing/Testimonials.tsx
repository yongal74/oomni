const testimonials = [
  {
    quote: '혼자서 이런 퀄리티의 결과물을 낼 수 있다는 게 믿기지 않았습니다. OOMNI 덕분에 개발에만 집중할 수 있게 됐어요.',
    name: '박지훈',
    role: '인디 SaaS 창업자',
    avatar: 'JH',
    color: '#6366F1',
    metric: '개발 집중 시간 3배 증가',
  },
  {
    quote: '리서치에서 클라이언트 보고서까지 3시간이 걸리던 작업이 15분으로 줄었습니다. 이제 더 많은 클라이언트를 받을 수 있어요.',
    name: '김수현',
    role: '프리랜서 컨설턴트',
    avatar: 'SH',
    color: '#10B981',
    metric: '작업 시간 92% 단축',
  },
  {
    quote: '직원 없이도 5개 클라이언트를 동시에 관리할 수 있게 됐어요. 운영 비용이 60% 넘게 줄었습니다.',
    name: '이민재',
    role: '1인 에이전시 운영',
    avatar: 'MJ',
    color: '#D4763B',
    metric: '운영 비용 62% 절감',
  },
];

export function Testimonials() {
  return (
    <section className="bg-[#0F0F0F] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#D4763B] mb-4">
            고객 후기
          </span>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            이미 1,200명이 경험했습니다
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-[#1F1F1F] bg-[#141414] p-8 flex flex-col"
            >
              {/* 별점 */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-[#D4763B] text-sm">★</span>
                ))}
              </div>

              {/* 후기 */}
              <blockquote className="text-[#D4D4D4] text-sm leading-relaxed flex-1 mb-6">
                "{t.quote}"
              </blockquote>

              {/* 성과 배지 */}
              <div
                className="mb-6 inline-block self-start rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `${t.color}15`, color: t.color }}
              >
                {t.metric}
              </div>

              {/* 프로필 */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#1F1F1F]">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-[#525252]">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
