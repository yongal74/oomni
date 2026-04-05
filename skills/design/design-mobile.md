# /design-mobile — 모바일 반응형 UI 최적화 및 PWA 설정

기존 웹 페이지 또는 새 UI를 모바일 최적화하고, Progressive Web App(PWA) 설정을 추가한다. 터치 인터랙션, 모바일 네비게이션, 성능 최적화까지 포함한다.

## 실행 단계

1. **현재 모바일 상태 분석**
   - `src/` 디렉터리에서 Tailwind 반응형 클래스 사용 현황 파악
   - `sm:`, `md:`, `lg:` 프리픽스 누락된 컴포넌트 탐지
   - 모바일에서 터치 타겟 크기 미달 요소 탐지 (44px 이하)
   - `viewport` 메타태그 설정 확인

2. **PWA 설정 추가**
   파일 생성:
   - `public/manifest.json` — 앱 매니페스트
   - `public/sw.js` — 서비스 워커 (오프라인 대응)
   - `public/icons/` — 앱 아이콘 세트 (72, 96, 128, 144, 152, 192, 384, 512px)

   `next.config.ts`에 PWA 설정:
   ```typescript
   const withPWA = require('next-pwa')({ dest: 'public', register: true });
   ```

3. **모바일 네비게이션 생성**
   파일 위치: `src/components/mobile/BottomNav.tsx`
   - 하단 탭 바 (5개 이하 메뉴)
   - Safe Area Inset 대응 (`env(safe-area-inset-bottom)`)
   - 현재 탭 활성 표시
   - 햅틱 피드백 트리거 (`navigator.vibrate()`)

4. **모바일 헤더 생성**
   파일 위치: `src/components/mobile/MobileHeader.tsx`
   - 뒤로가기 버튼
   - 페이지 제목
   - 오른쪽 액션 버튼
   - iOS 스타일 / Android 스타일 분기

5. **스와이프 제스처 훅 생성**
   파일 위치: `src/hooks/useSwipe.ts`
   - 좌/우/상/하 스와이프 감지
   - 최소 스와이프 거리 설정
   - 뒤로가기 스와이프 (iOS 스타일)

6. **Pull-to-Refresh 컴포넌트**
   파일 위치: `src/components/mobile/PullToRefresh.tsx`
   - 당기기 거리에 따른 인디케이터 애니메이션
   - 새로고침 완료 피드백

7. **모바일 모달/시트 컴포넌트**
   파일 위치: `src/components/mobile/BottomSheet.tsx`
   - 하단에서 올라오는 시트
   - 드래그로 닫기
   - 배경 오버레이

8. **터치 최적화 글로벌 CSS**
   `src/app/globals.css`에 추가:
   ```css
   /* 터치 하이라이트 제거 */
   * { -webkit-tap-highlight-color: transparent; }
   /* 텍스트 선택 방지 (버튼 등) */
   button, a { user-select: none; }
   /* 부드러운 스크롤 */
   html { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
   ```

9. **반응형 타이포그래피 설정**
   `tailwind.config.ts`에 fluid typography 추가

10. **Lighthouse 성능 체크리스트**
    - LCP < 2.5s
    - CLS < 0.1
    - FID < 100ms
    - TTI < 5s
    각 항목 개선 방법 제시

## 출력 형식

### PWA 매니페스트

```json
// public/manifest.json
{
  "name": "OOMNI",
  "short_name": "OOMNI",
  "description": "AI 자동화 플랫폼",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screenshots/mobile-1.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" }
  ]
}
```

### 하단 네비게이션

```tsx
// src/components/mobile/BottomNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart2, Settings, Bell, User } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home, label: '홈' },
  { href: '/analytics', icon: BarChart2, label: '분석' },
  { href: '/notifications', icon: Bell, label: '알림' },
  { href: '/settings', icon: Settings, label: '설정' },
  { href: '/profile', icon: User, label: '프로필' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16 items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-[44px] flex-col items-center justify-center gap-1 p-2 ${
                isActive ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

## 저장 위치

- `C:/Users/장우경/oomni/backend/src/components/mobile/`
- `C:/Users/장우경/oomni/backend/src/hooks/useSwipe.ts`
- `C:/Users/장우경/oomni/backend/public/manifest.json`
- `C:/oomni-data/design/mobile/mobile-audit_YYYY-MM-DD.md`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--target ios|android|both` : 대상 플랫폼 스타일 (기본값: both)
- `--pwa` : PWA 설정 포함 (기본값: true)
- `--audit-only` : 현재 모바일 상태 감사만 수행
- `--components bottomnav,sheet,pulltorefresh` : 생성할 컴포넌트 선택
- 예시: `/design-mobile --target ios --pwa`
