const STATS = [
  { value: '1,200+', label: '솔로 창업자 사용 중' },
  { value: '주 32h',  label: '평균 업무 절감 시간' },
  { value: '4.9★',   label: '사용자 만족도' },
  { value: '9개',    label: 'AI 에이전트 파이프라인' },
]

const LOGOS = [
  'Research Bot', 'Content Bot', 'Build Bot', 'Design Bot',
  'Growth Bot', 'Ops Bot', 'CEO Bot',
]

export function SocialProof() {
  return (
    <section
      className="py-16 border-y"
      style={{ background: '#242018', borderColor: '#3D3828' }}
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div
                className="text-4xl font-black mb-1"
                style={{
                  background: 'linear-gradient(135deg, #E8935C, #D4763B)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.03em',
                }}
              >
                {s.value}
              </div>
              <div className="text-sm" style={{ color: '#8A7E6E' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scrolling bot ticker */}
        <div className="relative overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}>
          <div className="flex gap-4 w-max" style={{ animation: 'ticker 18s linear infinite' }}>
            {[...LOGOS, ...LOGOS].map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
                style={{
                  background: '#2C271E',
                  border: '1px solid #3D3828',
                  color: '#BDB09E',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: '#D4763B', boxShadow: '0 0 6px rgba(212,118,59,0.6)' }}
                />
                {name}
              </span>
            ))}
          </div>
          <style>{`@keyframes ticker { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }`}</style>
        </div>
      </div>
    </section>
  )
}
