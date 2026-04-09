'use client';

import Link from 'next/link';
import { useState } from 'react';

const navLinks = [
  { label: '기능', href: '#features' },
  { label: '작동 방식', href: '#how-it-works' },
  { label: '가격', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-[#1F1F1F] bg-[#0A0A0A]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              OOM<span className="text-[#D4763B]">NI</span>
            </span>
          </Link>

          {/* 데스크탑 메뉴 */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[#A3A3A3] hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-[#A3A3A3] hover:text-white transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-[#D4763B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c06830] transition-colors"
            >
              무료로 시작하기
            </Link>
          </div>

          {/* 모바일 햄버거 */}
          <button
            className="md:hidden text-[#A3A3A3] hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="메뉴 열기"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* 모바일 드로어 */}
        {menuOpen && (
          <div className="md:hidden border-t border-[#1F1F1F] py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm text-[#A3A3A3] hover:text-white transition-colors py-1"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/signup"
              className="block rounded-md bg-[#D4763B] px-4 py-2 text-sm font-semibold text-white text-center hover:bg-[#c06830] transition-colors mt-4"
            >
              무료로 시작하기
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
