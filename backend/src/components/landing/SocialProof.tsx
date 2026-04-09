const stats = [
  { value: '1,200+', label: '솔로 창업자' },
  { value: '38h', label: '주간 평균 절약' },
  { value: '5x', label: '콘텐츠 생산량' },
  { value: '62%', label: '운영 비용 절감' },
];

export function SocialProof() {
  return (
    <section className="border-y border-[#1F1F1F] bg-[#0F0F0F]">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <p className="text-center text-sm text-[#525252] mb-8">
          이미 1,200명의 솔로 창업자가 OOMNI로 자동화 중
        </p>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-[#D4763B] sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-[#A3A3A3]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
