const TESTIMONIALS = [
  {
    quote: 'OOMNI 덕분에 혼자서도 Series A 받을 수 있는 회사를 만들었어요. 직원 없이 월 매출 3천만 원 달성했습니다.',
    name: '김민준',
    role: 'FinTech 솔로 창업자',
    avatar: 'KM',
    color: '#60A5FA',
  },
  {
    quote: 'Content Bot이 제 목소리로 글을 써줘요. 뉴스레터 구독자가 3개월 만에 5배 늘었습니다.',
    name: '이서연',
    role: 'SaaS 마케터',
    avatar: 'LS',
    color: '#A78BFA',
  },
  {
    quote: 'Design Bot이 10분 만에 랜딩 페이지를 만들어줬어요. 에이전시 견적의 1/20 비용이었습니다.',
    name: '박지호',
    role: '프리랜서 개발자',
    avatar: 'PJ',
    color: '#34D399',
  },
]

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#D4763B">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

export function Testimonials() {
  return (
    <section className="py-24" style={{ background: '#1C1812' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
            style={{ background: 'rgba(212,118,59,0.12)', border: '1px solid rgba(212,118,59,0.28)', color: '#E8935C' }}
          >
            사용자 후기
          </span>
          <h2
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: '#F8F2E4' }}
          >
            실제 창업자들의 이야기
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl p-7 flex flex-col gap-5 border transition-all duration-300"
              style={{ background: '#2C271E', borderColor: '#3D3828' }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,118,59,0.4)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = '#3D3828'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              }}
            >
              <Stars />
              <p className="text-base leading-relaxed flex-1" style={{ color: '#D4C4A8' }}>
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: `${t.color}30`, border: `1.5px solid ${t.color}60`, color: t.color }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: '#F2EAD8' }}>{t.name}</div>
                  <div className="text-xs" style={{ color: '#8A7E6E' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
