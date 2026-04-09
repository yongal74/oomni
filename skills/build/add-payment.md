# /add-payment — Toss Payments + Stripe 결제 시스템 완전 구현

한국 서비스를 위한 Toss Payments(국내 카드/계좌이체)와 글로벌 대상 Stripe 결제를 동시에 구현한다. 결제 UI 컴포넌트, API 라우트, 웹훅 핸들러, Prisma DB 스키마, 환경 변수 설정까지 완전한 결제 파이프라인을 생성한다.

## 실행 단계

1. **현재 프로젝트 구조 분석**
   - `package.json` 읽어 설치된 패키지 확인
   - `prisma/schema.prisma` 읽어 기존 DB 스키마 확인
   - `.env.local` 존재 여부 확인 (환경 변수 추가용)
   - `src/types/` 디렉터리에서 기존 타입 파악

2. **패키지 설치 안내**
   다음 명령어를 사용자에게 안내:
   ```bash
   npm install @tosspayments/tosspayments-sdk stripe @stripe/stripe-js @stripe/react-stripe-js
   ```

3. **환경 변수 추가**
   `.env.local`에 추가할 변수 목록 생성:
   ```env
   # Toss Payments
   TOSS_CLIENT_KEY=test_ck_...
   TOSS_SECRET_KEY=test_sk_...

   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Prisma 스키마 추가**
   `prisma/schema.prisma`에 다음 모델 추가:

   ```prisma
   model Payment {
     id              String        @id @default(cuid())
     userId          String
     user            User          @relation(fields: [userId], references: [id])
     orderId         String        @unique
     orderName       String
     amount          Int
     currency        String        @default("KRW")
     status          PaymentStatus @default(PENDING)
     provider        PaymentProvider
     providerPaymentKey String?    @unique
     providerOrderId String?
     failReason      String?
     metadata        Json?
     createdAt       DateTime      @default(now())
     updatedAt       DateTime      @updatedAt
     confirmedAt     DateTime?

     @@index([userId])
     @@index([status])
   }

   model Subscription {
     id                 String             @id @default(cuid())
     userId             String             @unique
     user               User               @relation(fields: [userId], references: [id])
     plan               SubscriptionPlan
     status             SubscriptionStatus @default(ACTIVE)
     stripeCustomerId   String?
     stripeSubscriptionId String?
     currentPeriodStart DateTime
     currentPeriodEnd   DateTime
     cancelAtPeriodEnd  Boolean            @default(false)
     createdAt          DateTime           @default(now())
     updatedAt          DateTime           @updatedAt
   }

   enum PaymentStatus { PENDING DONE FAILED CANCELED PARTIAL_CANCELED ABORTED EXPIRED }
   enum PaymentProvider { TOSS STRIPE }
   enum SubscriptionPlan { FREE STARTER PRO ENTERPRISE }
   enum SubscriptionStatus { ACTIVE PAST_DUE CANCELED TRIALING }
   ```

5. **공통 결제 서비스 레이어 생성**
   파일 위치: `src/lib/payment/index.ts`

   ```typescript
   export { TossPaymentService } from './toss';
   export { StripePaymentService } from './stripe';
   export { PaymentService } from './service';
   ```

6. **Toss Payments 서비스 생성**
   파일 위치: `src/lib/payment/toss.ts`

   포함 기능:
   - 결제 승인 (`confirmPayment`)
   - 결제 취소 (`cancelPayment`)
   - 결제 조회 (`getPayment`)
   - 빌링키 발급 (`issueBillingKey`) — 정기결제용
   - 빌링키로 자동결제 (`chargeBillingKey`)

7. **Stripe 서비스 생성**
   파일 위치: `src/lib/payment/stripe.ts`

   포함 기능:
   - Checkout Session 생성
   - 구독 생성/수정/취소
   - Customer Portal 세션 생성
   - 인보이스 조회

8. **결제 UI 컴포넌트 생성**
   파일 위치: `src/components/payment/`

   컴포넌트 목록:
   - `PaymentWidget.tsx` — Toss Payments 위젯 임베드
   - `StripeCheckoutButton.tsx` — Stripe 체크아웃 버튼
   - `PricingCard.tsx` — 플랜별 가격 카드
   - `PaymentHistory.tsx` — 결제 내역 테이블
   - `SubscriptionBadge.tsx` — 현재 구독 상태 뱃지

9. **API 라우트 생성**
   - `src/app/api/payment/toss/confirm/route.ts` — Toss 결제 승인
   - `src/app/api/payment/toss/webhook/route.ts` — Toss 웹훅
   - `src/app/api/payment/stripe/checkout/route.ts` — Stripe Checkout 세션
   - `src/app/api/payment/stripe/webhook/route.ts` — Stripe 웹훅
   - `src/app/api/payment/history/route.ts` — 결제 내역 조회

10. **Toss 결제 성공/실패 페이지 생성**
    - `src/app/payment/success/page.tsx`
    - `src/app/payment/fail/page.tsx`

11. **웹훅 시크릿 설정 가이드 출력**
    - Toss: 토스페이먼츠 대시보드 → 웹훅 URL 등록 방법
    - Stripe: `stripe listen --forward-to localhost:3000/api/payment/stripe/webhook`

## 출력 형식

### Toss 결제 승인 API 예시

```typescript
// src/app/api/payment/toss/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TossPaymentService } from '@/lib/payment/toss';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { paymentKey, orderId, amount } = await req.json();

  // DB에서 주문 검증
  const pendingPayment = await prisma.payment.findUnique({ where: { orderId } });
  if (!pendingPayment) return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
  if (pendingPayment.amount !== amount) return NextResponse.json({ error: '금액 불일치' }, { status: 400 });
  if (pendingPayment.userId !== session.user.id) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  try {
    const tossResponse = await TossPaymentService.confirm({ paymentKey, orderId, amount });

    await prisma.payment.update({
      where: { orderId },
      data: {
        status: 'DONE',
        providerPaymentKey: paymentKey,
        confirmedAt: new Date(),
        metadata: tossResponse as any,
      },
    });

    return NextResponse.json({ success: true, payment: tossResponse });
  } catch (error: any) {
    await prisma.payment.update({ where: { orderId }, data: { status: 'FAILED', failReason: error.message } });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

### PaymentWidget 컴포넌트 예시

```tsx
// src/components/payment/PaymentWidget.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { loadTossPayments, TossPaymentsInstance } from '@tosspayments/tosspayments-sdk';

interface PaymentWidgetProps {
  orderId: string;
  orderName: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  onSuccess?: () => void;
}

export function PaymentWidget({ orderId, orderName, amount, customerName, customerEmail }: PaymentWidgetProps) {
  const paymentWidgetRef = useRef<TossPaymentsInstance | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
    loadTossPayments(clientKey).then((tossPayments) => {
      const widget = tossPayments.widgets({ customerKey: customerEmail });
      paymentWidgetRef.current = widget as any;
      widget.setAmount({ currency: 'KRW', value: amount });
      Promise.all([
        widget.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
        widget.renderAgreement({ selector: '#payment-agreement', variantKey: 'AGREEMENT' }),
      ]).then(() => setIsReady(true));
    });
  }, [amount, customerEmail]);

  const handlePayment = async () => {
    await (paymentWidgetRef.current as any)?.requestPayment({
      orderId,
      orderName,
      successUrl: `${window.location.origin}/payment/success`,
      failUrl: `${window.location.origin}/payment/fail`,
      customerName,
      customerEmail,
    });
  };

  return (
    <div>
      <div id="payment-method" />
      <div id="payment-agreement" />
      <button
        onClick={handlePayment}
        disabled={!isReady}
        className="w-full mt-4 h-12 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
      >
        {amount.toLocaleString('ko-KR')}원 결제하기
      </button>
    </div>
  );
}
```

## 저장 위치

- 사용자 프로젝트의 `src/lib/payment/`
- 사용자 프로젝트의 `src/components/payment/`
- 사용자 프로젝트의 `src/app/api/payment/`
- 사용자 프로젝트의 `src/app/payment/`
- 사용자 프로젝트의 `prisma/schema.prisma` (수정)
- `C:/oomni-data/docs/payment-setup_YYYY-MM-DD.md` (설정 가이드)

> **주의**: 파일은 반드시 사용자 프로젝트 경로에 저장하세요. OOMNI 앱 소스(`C:/Users/장우경/oomni/`) 경로에는 절대 저장하지 마세요.

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--provider toss|stripe|both` : 구현할 결제 수단 (기본값: both)
- `--subscription` : 구독 결제 포함
- `--billing-key` : Toss 정기결제(빌링키) 포함
- `--test-mode` : 테스트 환경 키로 구성
- `--currency KRW|USD|both` : 지원 통화
- 예시: `/add-payment --provider both --subscription --billing-key`
