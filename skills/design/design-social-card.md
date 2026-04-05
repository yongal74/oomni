# /design-social-card — SNS 공유용 OG 이미지 및 소셜 카드 자동 생성

제품 정보, 블로그 포스트, 주요 지표를 입력받아 Twitter/X, LinkedIn, KakaoTalk 공유에 최적화된 소셜 카드 이미지를 자동으로 생성한다. Vercel OG Image Generation 또는 Satori를 사용한다.

## 실행 단계

1. **소셜 카드 타입 결정**
   `$ARGUMENTS`에서 카드 타입 파악:
   - `blog` — 블로그 포스트 OG 이미지
   - `metric` — "사용자 N명 달성" 성과 카드
   - `product` — 제품 소개 카드
   - `quote` — 인용문 카드
   - `event` — 이벤트/런치 공지 카드

2. **OG Image API 라우트 생성**
   파일 위치: `src/app/api/og/route.tsx`

   Vercel `@vercel/og` 사용:
   - 쿼리 파라미터로 동적 이미지 생성
   - 캐싱 헤더 설정 (1시간)
   - 에러 시 기본 이미지 반환

3. **소셜 카드 템플릿 디자인**
   각 타입별 디자인:

   **Blog 카드** (1200×630px):
   - 브랜드 색상 배경 그라디언트
   - 카테고리 뱃지 (상단 좌측)
   - 게시물 제목 (최대 3줄)
   - 저자 아바타 + 이름 + 날짜 (하단)
   - 우측 장식 요소 (아이콘 또는 이미지)

   **Metric 카드** (1200×630px):
   - 어두운 배경 (임팩트 강조)
   - 큰 숫자 (중앙)
   - 달성 메시지
   - "Powered by OOMNI" 하단 태그

   **Quote 카드** (1080×1080px, Instagram용):
   - 인용 부호 그래픽
   - 인용문 텍스트
   - 화자 이름 + 직책
   - 브랜드 로고

4. **정적 소셜 카드 생성 스크립트**
   파일 위치: `scripts/generate-og-images.ts`
   - 자주 사용하는 카드 미리 생성하여 `public/og/`에 저장
   - Sharp 라이브러리로 PNG 최적화

5. **메타데이터 헬퍼 생성**
   파일 위치: `src/lib/metadata.ts`
   ```typescript
   export function generateOGMeta(title: string, description: string, type: string) {
     return {
       openGraph: { title, description, images: [`/api/og?title=${encodeURIComponent(title)}&type=${type}`] },
       twitter: { card: 'summary_large_image', title, description },
     };
   }
   ```

6. **각 페이지에 OG 메타데이터 적용**
   - 블로그 포스트 페이지
   - 랜딩 페이지
   - 가격 페이지

7. **카드 미리보기 페이지 생성**
   파일 위치: `src/app/og-preview/page.tsx`
   - 모든 OG 카드를 한 화면에서 미리볼 수 있는 개발용 페이지

## 출력 형식

### OG Image API 라우트

```typescript
// src/app/api/og/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? 'OOMNI';
  const description = searchParams.get('description') ?? 'AI 자동화 플랫폼';
  const type = searchParams.get('type') ?? 'default';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
          padding: '60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 로고 영역 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'auto' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>OOMNI</div>
        </div>

        {/* 제목 */}
        <div style={{
          fontSize: title.length > 40 ? 48 : 64,
          fontWeight: 800,
          color: 'white',
          lineHeight: 1.2,
          marginBottom: 24,
          maxWidth: 900,
        }}>
          {title}
        </div>

        {/* 설명 */}
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.8)', maxWidth: 800 }}>
          {description}
        </div>

        {/* 하단 바 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: 48,
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.2)',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>oomni.io</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    }
  );
}
```

### 성과 카드 (Metric Card) 예시 출력

이미지 사양:
- **크기**: 1200×630 (Twitter/LinkedIn), 1080×1080 (Instagram)
- **포맷**: PNG (정적), 동적 생성 (API)
- **URL 패턴**: `/api/og?type=metric&value=1000&label=사용자 달성&date=2026-04-05`

## 저장 위치

- `C:/Users/장우경/oomni/backend/src/app/api/og/route.tsx`
- `C:/Users/장우경/oomni/backend/src/lib/metadata.ts`
- `C:/Users/장우경/oomni/backend/public/og/` (사전 생성 이미지)
- `C:/oomni-data/design/social-cards/social-card_YYYY-MM-DD/` (생성된 카드 이미지)

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--type blog|metric|quote|event|product` : 카드 타입 (기본값: 전체)
- `--size 1200x630|1080x1080|1080x1920` : 이미지 크기
- `--theme dark|light|brand` : 색상 테마
- `--text "N명의 사용자가 선택했습니다"` : 카드에 표시할 텍스트
- `--export` : PNG 파일로 즉시 내보내기
- 예시: `/design-social-card --type metric --text "1,000명 돌파" --export`
