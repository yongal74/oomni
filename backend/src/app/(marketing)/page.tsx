import type { Metadata } from 'next';
import { Navigation } from '@/components/landing/Navigation';
import { Hero } from '@/components/landing/Hero';
import { SocialProof } from '@/components/landing/SocialProof';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Testimonials } from '@/components/landing/Testimonials';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'OOMNI — 솔로 창업자를 위한 AI 에이전트 자동화 플랫폼',
  description:
    '리서치, 콘텐츠, 개발, 디자인, 성장 전략을 자동으로 연결하는 AI 에이전트 파이프라인. 혼자서도 팀처럼 움직이세요.',
  keywords: [
    'AI 자동화',
    '솔로 창업자',
    'AI 에이전트',
    'SaaS 자동화',
    '콘텐츠 자동화',
    '리서치 자동화',
    '노코드 AI',
    'OOMNI',
  ],
  openGraph: {
    title: 'OOMNI — 혼자서도 팀처럼 움직이세요',
    description:
      '7개의 AI 에이전트가 파이프라인으로 연결되어 리서치부터 CEO 보고까지 자동화합니다. 솔로 창업자를 위한 AI 팀.',
    url: 'https://oomni.ai',
    siteName: 'OOMNI',
    images: [
      {
        url: 'https://oomni.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OOMNI - AI 에이전트 자동화 플랫폼',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OOMNI — 혼자서도 팀처럼 움직이세요',
    description: '7개의 AI 에이전트 파이프라인으로 솔로 창업자의 자동화를 실현합니다.',
    images: ['https://oomni.ai/og-image.png'],
  },
  alternates: {
    canonical: 'https://oomni.ai',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'OOMNI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: '솔로 창업자를 위한 AI 에이전트 자동화 플랫폼',
  url: 'https://oomni.ai',
  offers: [
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '0',
      priceCurrency: 'KRW',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '49000',
      priceCurrency: 'KRW',
      billingIncrement: 'P1M',
    },
    {
      '@type': 'Offer',
      name: 'Team',
      price: '149000',
      priceCurrency: 'KRW',
      billingIncrement: 'P1M',
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '1200',
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="bg-[#0A0A0A] min-h-screen">
        <Navigation />
        <Hero />
        <SocialProof />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
        <Footer />
      </main>
    </>
  );
}
