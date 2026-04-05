# /design-landing — SaaS 랜딩 페이지 완전 설계 및 구현

제품 정보를 입력받아 전환율 최적화(CRO)된 랜딩 페이지를 설계하고, Next.js + Tailwind 컴포넌트 코드를 생성한다. Hero, Feature, Pricing, Testimonial, FAQ, CTA 섹션을 모두 포함한다.

## 실행 단계

1. **제품 정보 수집**
   `C:/oomni-data/config/product.json` 읽기. 없으면 `$ARGUMENTS`에서 파싱:
   - 제품명, 태그라인, 핵심 가치 제안 3가지
   - 타겟 고객 (페르소나)
   - 주요 기능 5-7가지
   - 가격 플랜
   - 기존 고객 후기 (있으면)

2. **카피라이팅 생성**
   각 섹션별 카피 3가지 변형 생성:
   - **Hero 헤드라인**: 혜택 중심, 고통 해결 중심, 숫자 중심
   - **서브 헤드라인**: 2줄 이내, 핵심 가치 제안
   - **CTA 버튼 텍스트**: 5가지 옵션
   - **Feature 섹션 제목들**
   - **Social Proof 문구**

3. **페이지 구조 설계**
   섹션 순서 (전환율 최적화 기준):
   ```
   1. Navigation (로고, 메뉴, CTA 버튼)
   2. Hero (헤드라인 + 서브 + CTA + 히어로 이미지/스크린샷)
   3. Social Proof Bar (로고 또는 숫자)
   4. Problem → Solution (고통 인식 → 해결책 제시)
   5. Feature 섹션 (아이콘 + 제목 + 설명)
   6. How It Works (3-4 단계)
   7. Testimonials (고객 후기 3개)
   8. Pricing (2-3 플랜)
   9. FAQ (6-8개 질문)
   10. Final CTA (강력한 행동 유도)
   11. Footer
   ```

4. **컴포넌트별 코드 생성**
   다음 파일 생성:
   - `src/app/(marketing)/page.tsx` — 랜딩 페이지 루트
   - `src/components/landing/Hero.tsx`
   - `src/components/landing/Features.tsx`
   - `src/components/landing/HowItWorks.tsx`
   - `src/components/landing/Testimonials.tsx`
   - `src/components/landing/Pricing.tsx`
   - `src/components/landing/FAQ.tsx`
   - `src/components/landing/FinalCTA.tsx`
   - `src/components/landing/Navigation.tsx`
   - `src/components/landing/Footer.tsx`

5. **SEO 메타데이터 생성**
   `src/app/(marketing)/page.tsx`의 `metadata` 객체:
   - `title`, `description`, `keywords`
   - Open Graph (`og:title`, `og:description`, `og:image`)
   - Twitter Card
   - Structured Data (JSON-LD) — SaaS 서비스 스키마

6. **성능 최적화 적용**
   - 모든 이미지 `next/image` 사용
   - 폰트 최적화 (`next/font`)
   - 중요 CSS 인라인화
   - Lazy loading (fold 아래 섹션)

7. **A/B 테스트 준비**
   Hero 섹션에 PostHog Feature Flag 기반 A/B 테스트 코드 추가 (`--ab-test` 옵션 시)

## 출력 형식

### Hero 컴포넌트 예시

```tsx
// src/components/landing/Hero.tsx
import Image from 'next/image';
import Link from 'next/link';

interface HeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
  heroImageSrc: string;
}

export function Hero({ headline, subheadline, ctaText, ctaHref, heroImageSrc }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-16 sm:pt-32 sm:pb-24">
      {/* 배경 그라디언트 */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.blue.100),white)]" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {/* 배지 */}
          <div className="mb-8 flex justify-center">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600 ring-1 ring-blue-600/20">
              🚀 지금 무료로 시작하세요
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            {headline}
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">{subheadline}</p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href={ctaHref}
              className="rounded-md bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
            >
              {ctaText}
            </Link>
            <Link href="#demo" className="text-sm font-semibold leading-6 text-gray-900">
              데모 보기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* 히어로 이미지 */}
        <div className="mt-16 flow-root sm:mt-24">
          <div className="-m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
            <Image
              src={heroImageSrc}
              alt="제품 스크린샷"
              width={2432}
              height={1442}
              className="rounded-md shadow-2xl ring-1 ring-gray-900/10"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

### 생성될 파일 목록

```
src/
  app/(marketing)/
    page.tsx              # 랜딩 페이지 + 메타데이터
    layout.tsx            # 마케팅 레이아웃
  components/landing/
    Navigation.tsx
    Hero.tsx
    SocialProof.tsx
    ProblemSolution.tsx
    Features.tsx
    HowItWorks.tsx
    Testimonials.tsx
    Pricing.tsx
    FAQ.tsx
    FinalCTA.tsx
    Footer.tsx
```

## 저장 위치

- `C:/Users/장우경/oomni/backend/src/components/landing/`
- `C:/Users/장우경/oomni/backend/src/app/(marketing)/`
- `C:/oomni-data/design/landing/landing-copy_YYYY-MM-DD.md` (카피 초안)
- `C:/oomni-data/design/landing/landing-structure_YYYY-MM-DD.json` (구조 JSON)

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--tone professional|friendly|bold` : 카피 톤앤매너
- `--color blue|purple|green|dark` : 메인 컬러 테마
- `--ab-test` : A/B 테스트 변형 포함
- `--korean-only` : 한국어 전용 (영어 번역 생략)
- `--one-pager` : 단일 페이지 압축 버전
- 예시: `/design-landing --tone bold --color purple --ab-test`
