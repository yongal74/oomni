'use client';

import { useState } from 'react';

const faqs = [
  {
    q: '코딩을 몰라도 쓸 수 있나요?',
    a: '네, OOMNI는 코딩 없이 사용할 수 있습니다. 자연어로 명령하면 봇이 알아서 처리합니다. 기술적인 지식이 전혀 없어도 됩니다.',
  },
  {
    q: '기존 도구와 연동이 되나요?',
    a: 'Notion, Slack, GitHub, Google Drive, Trello 등 주요 도구와 연동을 지원합니다. API를 통한 커스텀 연동도 가능합니다.',
  },
  {
    q: '데이터는 안전한가요?',
    a: '모든 데이터는 AES-256으로 암호화되어 저장되며, 제3자에게 절대 공유되지 않습니다. 데이터는 사용자가 언제든지 삭제할 수 있습니다.',
  },
  {
    q: '무료 플랜은 어디까지 쓸 수 있나요?',
    a: '월 50회 에이전트 실행, Research/Content/CEO 3개 봇 사용이 무료입니다. 카드 정보 없이 시작할 수 있으며, 언제든지 업그레이드할 수 있습니다.',
  },
  {
    q: 'AI가 틀린 정보를 생성하면 어떻게 하나요?',
    a: '모든 결과물은 파일로 저장되며, 수정 및 재생성이 자유롭습니다. 파라미터를 조정하거나 추가 지시를 통해 원하는 방향으로 개선할 수 있습니다.',
  },
  {
    q: '팀으로 사용할 수 있나요?',
    a: 'Team 플랜에서 팀 협업 기능과 세분화된 권한 관리를 지원합니다. 팀원별 접근 권한을 설정하고 결과물을 공유할 수 있습니다.',
  },
  {
    q: '언제든지 해지할 수 있나요?',
    a: '언제든지 해지 가능하며, 남은 결제 기간은 계속 사용할 수 있습니다. 해지 수수료나 위약금은 없습니다.',
  },
  {
    q: '한국어만 지원하나요?',
    a: '현재 한국어와 영어를 완벽히 지원합니다. 일본어, 중국어 등 추가 언어도 순차적으로 지원 예정입니다.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-[#0F0F0F] py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#D4763B] mb-4">
            FAQ
          </span>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            자주 묻는 질문
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div
              key={faq.q}
              className={`rounded-xl border transition-colors ${
                openIndex === index ? 'border-[#D4763B]/30 bg-[#141414]' : 'border-[#1F1F1F] bg-[#0F0F0F] hover:border-[#2A2A2A]'
              }`}
            >
              <button
                className="flex w-full items-center justify-between px-6 py-5 text-left"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                <span
                  className={`flex-shrink-0 text-[#D4763B] transition-transform ${openIndex === index ? 'rotate-45' : ''}`}
                >
                  +
                </span>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-sm text-[#A3A3A3] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
