# /design-email — 트랜잭션 이메일 및 마케팅 이메일 템플릿 생성

React Email + Resend를 사용하여 웰컴, 결제 확인, 비밀번호 재설정, 주간 뉴스레터 등 모든 이메일 템플릿을 생성한다. 모든 이메일 클라이언트 호환성, 다크 모드, 한국어 최적화를 포함한다.

## 실행 단계

1. **패키지 설치 확인**
   ```bash
   npm install @react-email/components react-email resend
   ```

2. **이메일 디렉터리 설정**
   파일 위치: `src/emails/`

3. **공통 이메일 레이아웃 생성**
   파일 위치: `src/emails/components/EmailLayout.tsx`
   - 브랜드 헤더 (로고 + 색상)
   - 본문 컨테이너 (최대 너비 600px)
   - 푸터 (회사명, 주소, 수신 거부 링크)
   - 소셜 미디어 아이콘

4. **트랜잭션 이메일 생성**
   각 이메일 파일:

   **`WelcomeEmail.tsx`** — 회원가입 환영:
   - 이름 개인화
   - 핵심 기능 3가지 소개
   - 시작하기 CTA 버튼
   - 온보딩 체크리스트

   **`PaymentConfirmEmail.tsx`** — 결제 확인:
   - 주문 번호, 금액, 날짜
   - 결제 수단
   - 영수증 다운로드 링크
   - 대시보드 바로가기

   **`PasswordResetEmail.tsx`** — 비밀번호 재설정:
   - 재설정 버튼 (10분 만료)
   - 보안 경고 문구
   - 미요청 시 무시 안내

   **`SubscriptionCancelEmail.tsx`** — 구독 취소 확인:
   - 취소 날짜, 서비스 종료 일자
   - 재활성화 CTA
   - 피드백 요청 (단계별 선택)

   **`TrialEndingEmail.tsx`** — 무료 체험 종료 알림:
   - D-3, D-1 타이밍 발송
   - 지금까지 사용 현황
   - 업그레이드 혜택 강조
   - 할인 쿠폰 코드 (선택)

   **`WeeklyDigestEmail.tsx`** — 주간 사용 리포트:
   - 이번 주 핵심 지표
   - 달성한 목표
   - 추천 기능

5. **이메일 발송 서비스 생성**
   파일 위치: `src/lib/email.ts`
   - Resend 클라이언트 초기화
   - 각 이메일별 `send*` 함수
   - 발송 실패 시 재시도 로직 (최대 3회)
   - 발송 로그 기록

6. **이메일 미리보기 환경**
   ```bash
   # 개발 중 이메일 미리보기
   npx email dev --dir src/emails
   # http://localhost:3001 에서 확인
   ```

7. **이메일 테스트 파일 생성**
   파일 위치: `src/emails/__tests__/emails.test.tsx`

## 출력 형식

### 웰컴 이메일 템플릿

```tsx
// src/emails/WelcomeEmail.tsx
import {
  Body, Button, Container, Head, Heading, Html, Img,
  Link, Preview, Section, Text, Hr, Tailwind
} from '@react-email/components';

interface WelcomeEmailProps {
  userName: string;
  userEmail: string;
  dashboardUrl: string;
}

export default function WelcomeEmail({ userName, userEmail, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>{userName}님, OOMNI에 오신 것을 환영합니다! 🎉</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto max-w-[600px] bg-white">
            {/* 헤더 */}
            <Section className="bg-blue-600 px-8 py-6 text-center">
              <Img src="https://yourdomain.com/logo-white.png" alt="OOMNI" width="120" height="40" className="mx-auto" />
            </Section>

            {/* 본문 */}
            <Section className="px-8 py-8">
              <Heading className="text-2xl font-bold text-gray-900 mb-4">
                {userName}님, 환영합니다! 🎉
              </Heading>
              <Text className="text-gray-600 text-base leading-relaxed">
                OOMNI에 가입해주셔서 감사합니다. AI 자동화로 업무를 10배 빠르게 처리해보세요.
              </Text>

              <Hr className="my-6 border-gray-200" />

              {/* 시작 체크리스트 */}
              <Heading as="h2" className="text-lg font-semibold text-gray-900 mb-4">
                시작하기 3단계
              </Heading>
              {[
                { step: '1', text: '프로필 완성하기', done: false },
                { step: '2', text: '첫 번째 자동화 만들기', done: false },
                { step: '3', text: '팀원 초대하기', done: false },
              ].map(({ step, text }) => (
                <Text key={step} className="text-gray-600 text-sm mb-2">
                  ☐ {step}. {text}
                </Text>
              ))}

              <Hr className="my-6 border-gray-200" />

              <Button
                href={dashboardUrl}
                className="block w-full rounded-md bg-blue-600 px-6 py-3 text-center text-base font-semibold text-white"
              >
                대시보드 시작하기 →
              </Button>
            </Section>

            {/* 푸터 */}
            <Section className="bg-gray-50 px-8 py-6 text-center">
              <Text className="text-xs text-gray-400">
                이 이메일은 {userEmail}로 발송되었습니다.
                <Link href="{{{unsubscribeUrl}}}" className="text-gray-400 underline ml-1">수신 거부</Link>
              </Text>
              <Text className="text-xs text-gray-400 mt-1">
                서울특별시 강남구 | OOMNI Inc.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

### 이메일 발송 서비스

```typescript
// src/lib/email.ts
import { Resend } from 'resend';
import WelcomeEmail from '@/emails/WelcomeEmail';

const resend = new Resend(process.env.AUTH_RESEND_KEY!);
const FROM = process.env.EMAIL_FROM ?? 'noreply@yourdomain.com';

export async function sendWelcomeEmail(to: string, userName: string) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `${userName}님, OOMNI에 오신 것을 환영합니다! 🎉`,
    react: WelcomeEmail({ userName, userEmail: to, dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` }),
  });
}
```

## 저장 위치

- `C:/Users/장우경/oomni/backend/src/emails/`
- `C:/Users/장우경/oomni/backend/src/lib/email.ts`
- `C:/oomni-data/design/emails/email-templates_YYYY-MM-DD.md` (템플릿 목록)

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--templates welcome,payment,reset,cancel,trial,weekly` : 생성할 이메일 선택 (기본값: 전체)
- `--brand-color #2563eb` : 브랜드 색상
- `--logo-url https://...` : 로고 URL
- `--preview` : 생성 후 미리보기 서버 자동 실행
- 예시: `/design-email --templates welcome,payment --brand-color "#7c3aed"`
