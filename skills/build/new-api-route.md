# /new-api-route — Next.js App Router API 엔드포인트 완전 생성

API 라우트 경로와 기능 설명을 입력받아 Next.js App Router 방식의 완전한 API 엔드포인트를 생성한다. 입력 유효성 검사(Zod), 인증 미들웨어, 에러 핸들링, 타입 안전성, API 문서까지 포함한다.

## 실행 단계

1. **프로젝트 컨텍스트 파악**
   - `C:/Users/장우경/oomni/backend/src/app/api/` 구조 파악
   - 기존 라우트 핸들러 1-2개 읽어 패턴 확인
   - `src/lib/auth.ts` 읽어 인증 미들웨어 패턴 확인
   - `src/lib/db.ts` 또는 `src/lib/prisma.ts` 읽어 DB 접근 패턴 확인
   - `src/types/api.ts` 읽어 공통 응답 타입 확인

2. **라우트 설계**
   - `$ARGUMENTS`에서 경로(`/api/[경로]`)와 HTTP 메서드, 기능 파싱
   - 요청 파라미터 설계 (path params, query params, request body)
   - 응답 스키마 설계
   - 인증 필요 여부 결정
   - Rate limiting 적용 여부 결정

3. **Zod 스키마 생성**
   파일 위치: `src/app/api/[경로]/schema.ts`

   포함 내용:
   - Request body 스키마
   - Query params 스키마
   - Response 스키마
   - 타입 추출 (`z.infer<typeof Schema>`)

4. **라우트 핸들러 생성**
   파일 위치: `src/app/api/[경로]/route.ts`

   포함 내용:
   - `GET`, `POST`, `PUT`, `PATCH`, `DELETE` 핸들러 (필요한 것만)
   - JWT 인증 검증 (`getServerSession` 또는 커스텀 미들웨어)
   - Zod 입력 유효성 검사
   - DB 쿼리 (Prisma)
   - 비즈니스 로직
   - 표준 에러 응답 (`400`, `401`, `403`, `404`, `500`)
   - 성공 응답 타입 (`200`, `201`)
   - `NextResponse.json()` 사용
   - 요청 로깅

5. **미들웨어 래퍼 적용**
   공통 미들웨어 체인:
   ```
   withAuth → withRateLimit → withValidation → handler
   ```

6. **타입 파일 업데이트**
   `src/types/api.ts`에 새 엔드포인트 타입 추가

7. **테스트 파일 생성**
   파일 위치: `src/app/api/[경로]/route.test.ts`

   테스트 케이스:
   - 성공 케이스 (각 HTTP 메서드)
   - 인증 없는 요청 → 401
   - 잘못된 입력 → 400
   - 존재하지 않는 리소스 → 404
   - DB 오류 시뮬레이션 → 500

8. **API 문서 업데이트**
   `C:/oomni-data/docs/api-routes.md`에 새 라우트 추가

## 출력 형식

### Zod 스키마 예시

```typescript
// src/app/api/posts/schema.ts
import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(100, '제목은 100자 이하여야 합니다'),
  content: z.string().min(10, '내용은 최소 10자 이상이어야 합니다'),
  tags: z.array(z.string()).max(5, '태그는 최대 5개까지 가능합니다').optional(),
  published: z.boolean().default(false),
});

export const PostQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  tag: z.string().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type PostQuery = z.infer<typeof PostQuerySchema>;
```

### 라우트 핸들러 예시

```typescript
// src/app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreatePostSchema, PostQuerySchema } from './schema';
import { ApiResponse, ApiError } from '@/types/api';

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const query = PostQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!query.success) {
      return NextResponse.json(
        { success: false, error: query.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, tag } = query.data;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: tag ? { tags: { has: tag } } : undefined,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, createdAt: true, tags: true },
      }),
      prisma.post.count({ where: tag ? { tags: { has: tag } } : undefined }),
    ]);

    return NextResponse.json({
      success: true,
      data: posts,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[GET /api/posts]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = CreatePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const post = await prisma.post.create({
      data: { ...parsed.data, authorId: session.user.id },
    });

    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/posts]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
```

### 공통 응답 타입

```typescript
// src/types/api.ts에 추가
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string | Record<string, string[]>;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## 저장 위치

- `C:/Users/장우경/oomni/backend/src/app/api/[경로]/route.ts`
- `C:/Users/장우경/oomni/backend/src/app/api/[경로]/schema.ts`
- `C:/Users/장우경/oomni/backend/src/app/api/[경로]/route.test.ts`
- `C:/oomni-data/docs/api-routes.md` (문서 업데이트)

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[경로] [메서드들] [기능 설명]`
- `--auth required|optional|none` : 인증 수준 (기본값: required)
- `--rate-limit 100/min` : Rate limit 설정
- `--no-test` : 테스트 파일 생략
- `--paginated` : 페이지네이션 포함
- `--webhook` : 웹훅 수신 라우트로 생성
- 예시: `/new-api-route users/[id]/posts GET,POST "사용자의 게시물 관리" --auth required --paginated`
