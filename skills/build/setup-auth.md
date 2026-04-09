# /setup-auth — NextAuth v5 기반 인증 시스템 완전 구현

이메일/비밀번호, Google OAuth, GitHub OAuth, 매직 링크(이메일 OTP)를 지원하는 완전한 인증 시스템을 구현한다. Prisma 어댑터, 세션 관리, 보호된 라우트 미들웨어, 로그인/회원가입 UI까지 포함한다.

## 실행 단계

1. **현재 상태 파악**
   - `package.json`에서 NextAuth 설치 여부 확인
   - `prisma/schema.prisma`에서 User, Account, Session 모델 존재 여부 확인
   - `.env.local`에서 기존 OAuth 키 확인

2. **패키지 설치**
   ```bash
   npm install next-auth@beta @auth/prisma-adapter
   npm install bcryptjs
   npm install -D @types/bcryptjs
   ```

3. **환경 변수 설정**
   `.env.local`에 추가:
   ```env
   AUTH_SECRET="$(openssl rand -base64 32)"

   # Google OAuth (console.cloud.google.com)
   AUTH_GOOGLE_ID=
   AUTH_GOOGLE_SECRET=

   # GitHub OAuth (github.com/settings/developers)
   AUTH_GITHUB_ID=
   AUTH_GITHUB_SECRET=

   # 이메일 (Resend 또는 SMTP)
   AUTH_RESEND_KEY=re_...
   EMAIL_FROM="noreply@yourdomain.com"
   ```

4. **Prisma 스키마 업데이트**
   NextAuth v5 호환 모델 추가/수정:
   - `Account` 모델 (OAuth 계정 연동)
   - `Session` 모델
   - `VerificationToken` 모델
   - `User` 모델에 `password` 필드 추가 (이메일/비밀번호용)

5. **NextAuth 설정 파일 생성**
   파일 위치: `src/auth.ts` (루트 레벨)

   포함 내용:
   - PrismaAdapter 설정
   - Credentials Provider (이메일/비밀번호)
   - Google Provider
   - GitHub Provider
   - Resend Provider (매직 링크)
   - 콜백: `signIn`, `session`, `jwt`
   - 이벤트: `createUser` (웰컴 이메일 발송)

6. **라우트 핸들러 생성**
   파일 위치: `src/app/api/auth/[...nextauth]/route.ts`

7. **미들웨어 생성**
   파일 위치: `middleware.ts` (루트)

   보호 패턴:
   - `/dashboard/*` — 로그인 필요
   - `/api/*` — 일부 공개, 일부 인증 필요
   - `/admin/*` — 관리자 전용
   - `/auth/*` — 로그인 상태면 대시보드로 리다이렉트

8. **인증 UI 컴포넌트 생성**
   - `src/app/auth/signin/page.tsx` — 로그인 페이지
   - `src/app/auth/signup/page.tsx` — 회원가입 페이지
   - `src/app/auth/verify/page.tsx` — 이메일 인증 안내
   - `src/app/auth/error/page.tsx` — 에러 페이지
   - `src/components/auth/SignInForm.tsx` — 로그인 폼
   - `src/components/auth/SignUpForm.tsx` — 회원가입 폼
   - `src/components/auth/OAuthButtons.tsx` — Google/GitHub 버튼
   - `src/components/auth/UserMenu.tsx` — 사용자 메뉴 (드롭다운)

9. **서버 사이드 헬퍼 생성**
   파일 위치: `src/lib/auth.ts`
   - `auth()` — 현재 세션 조회
   - `requireAuth()` — 미인증 시 throw
   - `requireAdmin()` — 관리자 권한 확인

10. **회원가입 API 생성**
    파일 위치: `src/app/api/auth/register/route.ts`
    - 이메일 중복 확인
    - bcrypt 비밀번호 해싱 (cost: 12)
    - 사용자 생성
    - 웰컴 이메일 발송 트리거

## 출력 형식

### NextAuth 설정 파일

```typescript
// src/auth.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Resend from 'next-auth/providers/resend';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30일
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from: process.env.EMAIL_FROM!,
    }),
    Credentials({
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, image: true, password: true, role: true },
        });

        if (!user?.password) return null;
        const isValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = (user as any).role; }
      return token;
    },
    async session({ session, token }) {
      if (token) { session.user.id = token.id as string; (session.user as any).role = token.role; }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // 웰컴 이메일 발송 (Resend)
      console.log('[Auth] New user created:', user.email);
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },
});
```

### 미들웨어 설정

```typescript
// middleware.ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  const isLoggedIn = !!session?.user;
  const isAuthPage = nextUrl.pathname.startsWith('/auth');
  const isDashboard = nextUrl.pathname.startsWith('/dashboard');
  const isAdmin = nextUrl.pathname.startsWith('/admin');

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }
  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/signin', nextUrl));
  }
  if (isAdmin && session?.user && (session.user as any).role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
```

## 저장 위치

- 사용자 프로젝트의 `src/auth.ts`
- 사용자 프로젝트의 `middleware.ts`
- 사용자 프로젝트의 `src/app/api/auth/`
- 사용자 프로젝트의 `src/app/auth/`
- 사용자 프로젝트의 `src/components/auth/`
- 사용자 프로젝트의 `src/lib/auth.ts`
- `C:/oomni-data/docs/auth-setup_YYYY-MM-DD.md`

> **주의**: 파일은 반드시 사용자 프로젝트 경로에 저장하세요. OOMNI 앱 소스(`C:/Users/장우경/oomni/`) 경로에는 절대 저장하지 마세요.

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--providers google,github,credentials,magic` : 활성화할 프로바이더
- `--no-ui` : UI 컴포넌트 생략 (API만)
- `--rbac` : Role-Based Access Control 강화 구현
- `--2fa` : 2단계 인증(TOTP) 추가
- `--organization` : 조직/팀 기반 접근 제어
- 예시: `/setup-auth --providers google,credentials --rbac`
