import Link from 'next/link';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] py-24 sm:py-32">
      {/* 배경 글로우 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-[#D4763B]/8 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-3xl px-6 text-center">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#D4763B] mb-6">
          지금 시작하세요
        </span>
        <h2 className="text-4xl font-bold text-white sm:text-5xl leading-tight mb-6">
          지금 바로{' '}
          <span className="text-[#D4763B]">AI 팀</span>을 만드세요
        </h2>
        <p className="text-lg text-[#A3A3A3] mb-10">
          14일 무료 체험 · 카드 정보 불필요 · 언제든지 해지 가능
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-[#D4763B] px-10 py-4 text-base font-semibold text-white shadow-xl shadow-[#D4763B]/30 hover:bg-[#C06830] transition-all hover:shadow-[#D4763B]/50 hover:scale-105"
          >
            OOMNI 무료 시작하기 →
          </Link>
          <Link
            href="#demo"
            className="text-sm text-[#A3A3A3] hover:text-white transition-colors"
          >
            먼저 데모 보기
          </Link>
        </div>

        {/* 신뢰 지표 */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-[#525252]">
          <span>✓ 1,200+ 솔로 창업자 사용 중</span>
          <span>✓ 주 38시간 평균 절약</span>
          <span>✓ 카드 불필요</span>
          <span>✓ 해지 수수료 없음</span>
        </div>
      </div>
    </section>
  );
}
