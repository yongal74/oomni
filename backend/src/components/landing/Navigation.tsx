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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1F1F1F] bg-[#0A0A0A]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">
              OOM<span className="text-[#D4763B]">NI</span>
            </span>
          </Link>

          {/* 데스크톱 메뉴 */}
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
            <Link href="/login" className="text-sm text-[#A3A3A3] hover:text-white transition-colors">
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-[#D4763B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C06830] transition-colors"
            >
              무료 시작 →
            </Link>
          </div>

          {/* 모바일 햄버거 */}
          <button
            className="md:hidden text-[#A3A3A3] hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="메뉴"
          >
            <div className="space-y-1.5">
              <span className={`block h-0.5 w-6 bg-current transition-transform ${isOpen ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-6 bg-current transition-opacity ${isOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-6 bg-current transition-transform ${isOpen ? '-translate-y-2 -rotate-45' : ''}`} />
            </div>
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isOpen && (
          <div className="md:hidden border-t border-[#1F1F1F] py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block text-sm text-[#A3A3A3] hover:text-white transition-colors py-1"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-[#1F1F1F] flex flex-col gap-2">
              <Link href="/login" className="text-sm text-[#A3A3A3] hover:text-white py-1">로그인</Link>
              <Link
                href="/signup"
                className="rounded-md bg-[#D4763B] px-4 py-2 text-sm font-semibold text-white text-center hover:bg-[#C06830] transition-colors"
              >
                무료 시작 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
