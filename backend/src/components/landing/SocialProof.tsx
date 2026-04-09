const stats = [
  { value: '1,200+', label: '솔로 창업자가 사용 중' },
  { value: '38h', label: '주간 평균 절약 시간' },
  { value: '5x', label: '콘텐츠 생산량 증가' },
  { value: '62%', label: '운영 비용 절감' },
];

export function SocialProof() {
  return (
    <section className="border-y border-[#1F1F1F] bg-[#0D0D0D] py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-sm text-[#525252] mb-10 uppercase tracking-widest">
          이미 검증된 성과
        </p>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-[#D4763B] sm:text-4xl">{stat.value}</div>
              <div className="mt-1 text-sm text-[#A3A3A3]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
