# /setup-db — Prisma + PostgreSQL 데이터베이스 완전 설정

Prisma ORM과 PostgreSQL을 기반으로 프로덕션 수준의 데이터베이스 환경을 구성한다. 초기 스키마, 시드 데이터, 마이그레이션 전략, 연결 풀링, 타입 안전 쿼리 유틸리티까지 포함한다.

## 실행 단계

1. **현재 상태 확인**
   - `package.json`에서 Prisma 설치 여부 확인
   - `prisma/schema.prisma` 존재 여부 확인
   - `.env` / `.env.local`에서 `DATABASE_URL` 확인

2. **패키지 설치 안내**
   ```bash
   npm install prisma @prisma/client
   npm install -D prisma
   ```

3. **환경 변수 설정**
   `.env` 파일에 추가할 내용:
   ```env
   # 개발 환경
   DATABASE_URL="postgresql://postgres:password@localhost:5432/oomni_dev?schema=public"

   # 프로덕션 (Supabase 또는 Neon 기준)
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
   ```

4. **Prisma 스키마 생성**
   파일 위치: `prisma/schema.prisma`

   포함 모델 (SaaS 기본 모델 세트):
   - `User` — 사용자 (NextAuth 호환)
   - `Account` — OAuth 계정 연동
   - `Session` — NextAuth 세션
   - `VerificationToken` — 이메일 인증
   - `Profile` — 사용자 프로필 확장
   - `Organization` — 팀/조직 (멀티테넌시 선택)
   - `Subscription` — 구독 플랜
   - `Payment` — 결제 내역
   - `AuditLog` — 감사 로그

5. **Prisma 클라이언트 싱글턴 생성**
   파일 위치: `src/lib/prisma.ts`
   - 개발 환경 HMR 대응 전역 인스턴스
   - 쿼리 로깅 설정 (개발: 모두, 프로덕션: error만)
   - 연결 오류 처리

6. **DB 유틸리티 함수 생성**
   파일 위치: `src/lib/db/`
   - `users.ts` — 사용자 CRUD
   - `subscriptions.ts` — 구독 관리
   - `helpers.ts` — 공통 유틸 (페이지네이션, 정렬)

7. **마이그레이션 실행**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

8. **시드 데이터 생성**
   파일 위치: `prisma/seed.ts`
   - 관리자 계정 1개
   - 테스트 사용자 5명 (각 다른 플랜)
   - 샘플 결제 내역

9. **Prisma Studio 설정**
   `package.json`에 스크립트 추가:
   ```json
   "db:studio": "prisma studio",
   "db:migrate": "prisma migrate dev",
   "db:push": "prisma db push",
   "db:seed": "tsx prisma/seed.ts",
   "db:reset": "prisma migrate reset"
   ```

## 출력 형식

### 완성된 Prisma 스키마

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  role          UserRole  @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  profile       Profile?
  subscription  Subscription?
  payments      Payment[]
  auditLogs     AuditLog[]

  @@index([email])
}

model Profile {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio         String?
  company     String?
  website     String?
  timezone    String   @default("Asia/Seoul")
  locale      String   @default("ko")
  onboarded   Boolean  @default(false)
  updatedAt   DateTime @updatedAt
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String
  resource  String
  resourceId String?
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}

enum UserRole { USER ADMIN SUPER_ADMIN }
```

### Prisma 클라이언트 싱글턴

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## 저장 위치

- 사용자 프로젝트의 `prisma/schema.prisma`
- 사용자 프로젝트의 `prisma/seed.ts`
- 사용자 프로젝트의 `src/lib/prisma.ts`
- 사용자 프로젝트의 `src/lib/db/`
- `C:/oomni-data/docs/db-setup_YYYY-MM-DD.md`

> **주의**: 파일은 반드시 사용자 프로젝트 경로에 저장하세요. OOMNI 앱 소스(`C:/Users/장우경/oomni/`) 경로에는 절대 저장하지 마세요.

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--provider postgresql|mysql|sqlite` : DB 프로바이더 (기본값: postgresql)
- `--host supabase|neon|planetscale|local` : 호스팅 환경
- `--multi-tenant` : 멀티테넌시(Organization) 모델 포함
- `--no-seed` : 시드 파일 생략
- `--soft-delete` : 모든 모델에 soft delete(`deletedAt`) 추가
- 예시: `/setup-db --host supabase --multi-tenant --soft-delete`
