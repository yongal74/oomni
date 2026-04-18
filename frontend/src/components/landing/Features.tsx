const BOTS = [
  {
    emoji: '🔬',
    name: 'Research Bot',
    headline: '시장 조사를 10분 만에',
    desc: '경쟁사 분석, 트렌드 파악, 키워드 리서치를 자동으로 수행하고 구조화된 보고서를 생성합니다.',
    color: '#60A5FA',
  },
  {
    emoji: '✍️',
    name: 'Content Bot',
    headline: '블로그·SNS 콘텐츠 자동 생성',
    desc: '내 목소리와 브랜드 톤으로 SEO 최적화 블로그, 뉴스레터, 소셜 포스트를 자동 발행합니다.',
    color: '#A78BFA',
  },
  {
    emoji: '🔧',
    name: 'Build Bot',
    headline: '코드 리뷰 & API 자동 구축',
    desc: 'Next.js API 라우트, DB 마이그레이션, 보안 감사까지 — 코드 작업을 대화 한 번으로 처리합니다.',
    color: '#34D399',
  },
  {
    emoji: '🎨',
    name: 'Design Bot',
    headline: 'UI/UX 랜딩 페이지 즉시 완성',
    desc: '전환율 최적화된 랜딩 페이지, 대시보드 UI, 소셜 카드를 Tailwind 코드로 바로 생성합니다.',
    color: '#F472B6',
    featured: true,
  },
  {
    emoji: '📈',
    name: 'Growth Bot',
    headline: '퍼널 분석 & A/B 테스트 자동화',
    desc: '전환율 병목을 찾아내고, A/B 테스트를 설계하며, 주간 성장 리포트를 자동으로 발송합니다.',
    color: '#FB923C',
  },
  {
    emoji: '⚙️',
    name: 'Ops Bot',
    headline: '재무·인사·비용 자동 정리',
    desc: '월간 손익 보고서, 세금 신고 준비, SaaS 비용 감사를 자동화하여 운영 부담을 없앱니다.',
    color: '#FBBF24',
  },
  {
    emoji: '👑',
    name: 'CEO Bot',
    headline: '주간 브리핑 & OKR 전략 제안',
    desc: '핵심 지표를 집계하고, 투자자 업데이트 레터를 작성하며, OKR 달성률을 추적합니다.',
    color: '#E8935C',
  },
]

export function Features() {
  return (
    <section id="bots" className="py-24" style={{ background: '#1C1812' }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
            style={{ background: 'rgba(212,118,59,0.12)', border: '1px solid rgba(212,118,59,0.28)', color: '#E8935C' }}
          >
            AI 에이전트 팀
          </span>
          <h2
            className="font-black tracking-tight mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)', letterSpacing: '-0.03em', color: '#F8F2E4' }}
          >
            봇이 이어달리기처럼<br />
            <span
              style={{
                background: 'linear-gradient(135deg, #E8935C, #D4763B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              처리합니다
            </span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#8A7E6E' }}>
            각 봇은 특정 역할에 특화되어 결과물을 다음 봇으로 자동 전달합니다.
          </p>
        </div>

        {/* Bot cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {BOTS.map((bot) => (
            <div
              key={bot.name}
              className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 cursor-default"
              style={{
                background: bot.featured ? 'linear-gradient(145deg, #2C271E, #352E22)' : '#2C271E',
                border: bot.featured ? `1.5px solid ${bot.color}` : '1px solid #3D3828',
                boxShadow: bot.featured ? `0 0 0 1px ${bot.color}30, 0 24px 64px ${bot.color}18` : 'none',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = `0 20px 48px rgba(0,0,0,0.4), 0 0 0 1px ${bot.color}30`
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = bot.featured
                  ? `0 0 0 1px ${bot.color}30, 0 24px 64px ${bot.color}18`
                  : 'none'
              }}
            >
              {bot.featured && (
                <span
                  className="self-start text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: `${bot.color}20`, color: bot.color, border: `1px solid ${bot.color}40` }}
                >
                  ✨ 요청 기능
                </span>
              )}
              <div className="text-3xl">{bot.emoji}</div>
              <div>
                <span className="text-[11px] font-semibold" style={{ color: bot.color }}>{bot.name}</span>
                <h3 className="text-base font-bold mt-0.5" style={{ color: '#F2EAD8', letterSpacing: '-0.01em' }}>
                  {bot.headline}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#8A7E6E' }}>{bot.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
