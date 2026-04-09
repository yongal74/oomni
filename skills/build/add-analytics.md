# /add-analytics — 프로덕트 분석 시스템 완전 구현

Mixpanel(또는 PostHog)과 Google Analytics 4를 동시에 설정하고, 커스텀 이벤트 추적 시스템을 구현한다. 사용자 행동 추적, 전환 퍼널, A/B 테스트 기반 코드까지 포함한다.

## 실행 단계

1. **분석 요구사항 파악**
   - `$ARGUMENTS`에서 원하는 분석 도구 확인
   - 기존 `src/` 코드에서 기존 추적 코드 탐지 (중복 방지)
   - 추적할 주요 이벤트 목록 정의

2. **패키지 설치 안내**
   ```bash
   # PostHog (오픈소스, 셀프호스팅 가능 — 추천)
   npm install posthog-js posthog-node

   # 또는 Mixpanel
   npm install mixpanel-browser

   # Google Analytics 4
   npm install @next/third-parties
   ```

3. **환경 변수 추가**
   ```env
   # PostHog
   NEXT_PUBLIC_POSTHOG_KEY=phc_...
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

   # Google Analytics 4
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

   # Mixpanel (PostHog 대신 사용 시)
   NEXT_PUBLIC_MIXPANEL_TOKEN=
   ```

4. **Analytics 프로바이더 생성**
   파일 위치: `src/lib/analytics/`

   - `posthog.ts` — PostHog 클라이언트 초기화
   - `ga.ts` — GA4 설정
   - `events.ts` — 전체 이벤트 타입 정의 (타입 안전성)
   - `index.ts` — 통합 analytics 인터페이스

5. **이벤트 타입 정의**
   파일 위치: `src/lib/analytics/events.ts`

   이벤트 카테고리:
   - **인증**: `user_signed_up`, `user_signed_in`, `user_signed_out`
   - **온보딩**: `onboarding_started`, `onboarding_step_completed`, `onboarding_completed`
   - **구독**: `subscription_started`, `subscription_upgraded`, `subscription_cancelled`
   - **결제**: `payment_initiated`, `payment_completed`, `payment_failed`
   - **기능 사용**: `feature_used`, `feature_discovered`
   - **에러**: `error_occurred`, `api_error`

6. **PostHog 클라이언트 프로바이더 생성**
   파일 위치: `src/components/providers/PostHogProvider.tsx`
   - 사용자 식별 (로그인 시 `identify` 호출)
   - 사용자 속성 설정 (`plan`, `role`, `createdAt`)
   - 페이지뷰 자동 추적

7. **서버사이드 이벤트 추적 생성**
   파일 위치: `src/lib/analytics/server.ts`
   - `posthog-node` 사용
   - API 라우트에서 호출 가능한 `trackServerEvent()`
   - 결제 완료, 구독 변경 등 중요 이벤트 서버 측 추적

8. **커스텀 훅 생성**
   파일 위치: `src/hooks/useAnalytics.ts`
   ```typescript
   const { track, identify, reset } = useAnalytics();
   ```

9. **레이아웃에 프로바이더 적용**
   `src/app/layout.tsx`에 PostHogProvider, GoogleAnalytics 추가

10. **분석 대시보드 설정 가이드 생성**
    - PostHog 퍼널 설정 방법
    - GA4 전환 이벤트 설정 방법
    - 주요 KPI 대시보드 구성 방법

## 출력 형식

### 이벤트 타입 정의

```typescript
// src/lib/analytics/events.ts
export type AnalyticsEvents = {
  // 인증 이벤트
  user_signed_up: {
    method: 'email' | 'google' | 'github';
    plan: string;
  };
  user_signed_in: {
    method: 'email' | 'google' | 'github';
  };
  // 구독 이벤트
  subscription_started: {
    plan: 'starter' | 'pro' | 'enterprise';
    price: number;
    currency: 'KRW' | 'USD';
    trial: boolean;
  };
  subscription_cancelled: {
    plan: string;
    reason?: string;
    days_used: number;
  };
  // 결제 이벤트
  payment_completed: {
    amount: number;
    currency: string;
    provider: 'toss' | 'stripe';
    order_id: string;
  };
  // 기능 이벤트
  feature_used: {
    feature_name: string;
    duration_ms?: number;
  };
};

export type EventName = keyof AnalyticsEvents;
export type EventProperties<T extends EventName> = AnalyticsEvents[T];
```

### 통합 Analytics 클라이언트

```typescript
// src/lib/analytics/index.ts
import posthog from 'posthog-js';
import { AnalyticsEvents, EventName, EventProperties } from './events';

export const analytics = {
  track<T extends EventName>(event: T, properties: EventProperties<T>) {
    if (typeof window === 'undefined') return;
    posthog.capture(event, properties);
    // GA4 동시 전송
    if ((window as any).gtag) {
      (window as any).gtag('event', event, properties);
    }
  },

  identify(userId: string, traits: Record<string, unknown>) {
    posthog.identify(userId, traits);
  },

  reset() {
    posthog.reset();
  },

  page(url: string) {
    posthog.capture('$pageview', { $current_url: url });
  },
};
```

## 저장 위치

- 사용자 프로젝트의 `src/lib/analytics/`
- 사용자 프로젝트의 `src/hooks/useAnalytics.ts`
- 사용자 프로젝트의 `src/components/providers/PostHogProvider.tsx`
- `C:/oomni-data/docs/analytics-setup_YYYY-MM-DD.md`

> **주의**: 파일은 반드시 사용자 프로젝트 경로에 저장하세요. OOMNI 앱 소스(`C:/Users/장우경/oomni/`) 경로에는 절대 저장하지 마세요.

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--provider posthog|mixpanel|ga4|all` : 분석 도구 선택 (기본값: posthog,ga4)
- `--self-hosted` : PostHog 셀프호스팅 설정
- `--no-pii` : 개인정보(이메일, 이름) 추적 제외 (GDPR/PIPA 대응)
- `--ab-test` : A/B 테스트 코드 포함
- 예시: `/add-analytics --provider posthog,ga4 --no-pii`
