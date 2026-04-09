import Link from 'next/link';

const footerLinks = {
  제품: [
    { label: '기능', href: '#features' },
    { label: '가격', href: '#pricing' },
    { label: '로드맵', href: '/roadmap' },
    { label: '업데이트', href: '/changelog' },
  ],
  회사: [
    { label: '소개', href: '/about' },
    { label: '블로그', href: '/blog' },
    { label: '채용', href: '/careers' },
    { label: '문의', href: '/contact' },
  ],
  지원: [
    { label: '문서', href: '/docs' },
    { label: 'API 레퍼런스', href: '/docs/api' },
    { label: '커뮤니티', href: '/community' },
    { label: '상태', href: '/status' },
  ],
  법적고지: [
    { label: '개인정보처리방침', href: '/privacy' },
    { label: '이용약관', href: '/terms' },
    { label: '쿠키 정책', href: '/cookies' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-[#1F1F1F] bg-[#0A0A0A]">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-5">
          {/* 브랜드 */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="text-xl font-bold text-white">
              OOM<span className="text-[#D4763B]">NI</span>
            </Link>
            <p className="mt-3 text-xs text-[#525252] leading-relaxed">
              솔로 창업자를 위한<br />AI 에이전트 자동화 플랫폼
            </p>
          </div>

          {/* 링크 그룹 */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[#525252] mb-4">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#717171] hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-[#1F1F1F] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[#525252]">
            © 2026 OOMNI. All rights reserved.
          </p>
          <p className="text-xs text-[#3A3A3A]">
            Made with 🤖 AI in Korea
          </p>
        </div>
      </div>
    </footer>
  );
}
