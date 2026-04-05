# /new-component — 프로덕션 수준의 React/TypeScript 컴포넌트 생성

컴포넌트 이름과 용도를 입력받아 Props 인터페이스, Tailwind 스타일링, ARIA 접근성, Jest 테스트, Storybook 스토리를 포함한 완성된 컴포넌트 패키지를 생성한다. 코드 스캐폴딩이 아닌 실제 작동하는 코드를 생성한다.

## 실행 단계

1. **프로젝트 구조 파악**
   - `C:/Users/장우경/oomni/backend/package.json` 읽어 프레임워크 버전 확인
   - `C:/Users/장우경/oomni/frontend/src/components/` 디렉터리 구조 파악
   - 기존 컴포넌트 1개 읽어 코딩 스타일, import 패턴 확인
   - `tailwind.config.ts` 읽어 커스텀 색상/폰트/spacing 확인

2. **컴포넌트 설계**
   - `$ARGUMENTS`에서 컴포넌트 이름과 용도 파싱
   - Props 인터페이스 설계: 필수/선택 props, 기본값, 타입
   - 상태 관리 필요 여부 판단 (로컬 state vs Zustand/Context)
   - 이벤트 핸들러 목록 정의

3. **메인 컴포넌트 파일 생성**
   파일 위치: `src/components/[카테고리]/[ComponentName]/[ComponentName].tsx`

   포함 내용:
   - `'use client'` 지시어 (필요 시)
   - 모든 import 문 (React, hooks, types, utils)
   - JSDoc 주석 (컴포넌트 설명, props 설명)
   - Props 인터페이스 (`I[ComponentName]Props`)
   - 기본 props 값 (`defaultProps` 또는 기본값 파라미터)
   - 컴포넌트 함수 (화살표 함수)
   - ARIA 속성 완전 구현 (`role`, `aria-label`, `aria-describedby` 등)
   - Tailwind 클래스 (반응형 포함: sm/md/lg)
   - `forwardRef` 적용 (DOM 요소 접근 가능하도록)
   - `displayName` 설정
   - `export default` + named export 둘 다

4. **인덱스 파일 생성**
   파일 위치: `src/components/[카테고리]/[ComponentName]/index.ts`
   ```typescript
   export { default } from './[ComponentName]';
   export type { I[ComponentName]Props } from './[ComponentName]';
   ```

5. **타입 정의 파일 생성** (복잡한 타입이 있는 경우)
   파일 위치: `src/components/[카테고리]/[ComponentName]/[ComponentName].types.ts`

6. **테스트 파일 생성**
   파일 위치: `src/components/[카테고리]/[ComponentName]/[ComponentName].test.tsx`

   테스트 케이스:
   - 렌더링 테스트 (기본 props, 모든 변형)
   - Props 전달 테스트
   - 이벤트 핸들러 테스트 (`userEvent` 사용)
   - 접근성 테스트 (`@testing-library/jest-dom`)
   - 스냅샷 테스트
   - 엣지 케이스 (빈 값, null, 긴 텍스트)

7. **Storybook 스토리 생성**
   파일 위치: `src/components/[카테고리]/[ComponentName]/[ComponentName].stories.tsx`

   스토리 종류:
   - `Default`: 기본 상태
   - `AllVariants`: 모든 variant 한 화면에
   - `Interactive`: 상태 변화 시뮬레이션
   - `Accessibility`: 접근성 체크용 (a11y addon)
   - `DarkMode`: 다크 모드 버전

8. **배럴 익스포트 업데이트**
   `src/components/index.ts`에 새 컴포넌트 추가

9. **완료 보고**
   생성된 파일 목록, 컴포넌트 사용 예시 코드 출력

## 출력 형식

### 컴포넌트 파일 예시 (Button 컴포넌트 기준)

```typescript
// src/components/ui/Button/Button.tsx
'use client';

import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Button 컴포넌트 Props */
export interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 버튼 시각적 변형 */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** 버튼 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 버튼 전체 너비 여부 */
  fullWidth?: boolean;
  /** 왼쪽 아이콘 */
  leftIcon?: React.ReactNode;
  /** 오른쪽 아이콘 */
  rightIcon?: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, IButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
        ) : leftIcon ? (
          <span aria-hidden="true">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
```

### 생성 파일 목록

```
src/components/[카테고리]/[ComponentName]/
  ├── [ComponentName].tsx          # 메인 컴포넌트
  ├── [ComponentName].types.ts     # 복잡한 타입 (선택)
  ├── [ComponentName].test.tsx     # Jest 테스트
  ├── [ComponentName].stories.tsx  # Storybook 스토리
  └── index.ts                     # 배럴 익스포트
```

## 저장 위치

- `C:/Users/장우경/oomni/frontend/src/components/[카테고리]/[ComponentName]/`
- `C:/oomni-data/build/components/component-log_YYYY-MM-DD.json` (생성 이력)

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[ComponentName] [카테고리] [설명]`
- `--variant` : 생성할 variant 목록 (기본값: primary,secondary,ghost)
- `--no-test` : 테스트 파일 생략
- `--no-story` : Storybook 파일 생략
- `--state` : 로컬 상태 관리 포함
- `--async` : 비동기 데이터 로딩 패턴 포함
- 예시: `/new-component ProductCard ui "상품 카드 컴포넌트" --variant default,compact,featured --async`
