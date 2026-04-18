import { useState, useEffect } from 'react'

const NAV_LINKS = [
  { label: '기능',     href: '#features'  },
  { label: 'AI 팀원', href: '#bots'      },
  { label: '가격',     href: '#pricing'   },
  { label: '다운로드', href: '#download'  },
]

export function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(28,24,18,0.90)' : 'rgba(28,24,18,0.70)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${scrolled ? 'rgba(61,56,40,0.9)' : 'rgba(61,56,40,0.5)'}`,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg"
            style={{ background: 'linear-gradient(135deg, #E8935C, #C46828)' }}
          >
            O
          </div>
          <span className="text-base font-bold" style={{ color: '#FAF5EE', letterSpacing: '-0.02em' }}>
            OOMNI
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-semibold transition-colors"
              style={{ color: '#BDB09E' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F2EAD8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#BDB09E')}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Primary CTA */}
        <a
          href="#download"
          className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #E0844A, #D4763B, #C46828)',
            boxShadow: '0 4px 16px rgba(212,118,59,0.35)',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(212,118,59,0.50)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(212,118,59,0.35)'
          }}
        >
          무료 다운로드
        </a>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg transition-colors"
          style={{ color: '#BDB09E' }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="메뉴 열기"
        >
          {mobileOpen ? (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden px-6 pb-6 pt-2 flex flex-col gap-4"
          style={{ borderTop: '1px solid #3D3828' }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-base font-semibold"
              style={{ color: '#BDB09E' }}
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#download"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #E0844A, #D4763B, #C46828)' }}
            onClick={() => setMobileOpen(false)}
          >
            무료 다운로드
          </a>
        </div>
      )}
    </nav>
  )
}
