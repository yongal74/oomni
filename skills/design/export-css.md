# /export-css — 디자인 토큰 및 CSS 변수 추출 및 내보내기

Figma 디자인 시스템, 현재 Tailwind 설정, 또는 컴포넌트 스캔을 기반으로 완전한 CSS 변수 시스템과 디자인 토큰 파일을 생성한다. 다크 모드, 브랜드 가이드라인 문서까지 포함한다.

## 실행 단계

1. **현재 디자인 토큰 파악**
   - `tailwind.config.ts` 읽어 커스텀 색상, 폰트, spacing, radius 파악
   - `src/app/globals.css` 읽어 기존 CSS 변수 확인
   - 주요 컴포넌트 5개 스캔하여 가장 많이 사용된 Tailwind 클래스 집계

2. **색상 시스템 설계**
   의미론적 색상 토큰:
   - **배경**: `--bg-primary`, `--bg-secondary`, `--bg-muted`
   - **텍스트**: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`
   - **브랜드**: `--brand-50` ~ `--brand-900`
   - **상태**: `--success-*`, `--warning-*`, `--error-*`, `--info-*`
   - **테두리**: `--border-default`, `--border-strong`
   - **그림자**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`

3. **타이포그래피 토큰 생성**
   - 폰트 패밀리 변수
   - 폰트 크기 스케일 (xs ~ 6xl)
   - 줄 높이 (tight, normal, relaxed)
   - 폰트 웨이트 (regular, medium, semibold, bold)

4. **Spacing 및 Layout 토큰**
   - 4px 기반 spacing 스케일
   - 컨테이너 최대 너비
   - 그리드 컬럼 수
   - 사이드바/헤더 고정 크기

5. **CSS 변수 파일 생성**
   파일 위치: `src/styles/tokens.css`

   `:root` (라이트 모드) + `[data-theme="dark"]` (다크 모드) 포함

6. **Tailwind 설정 업데이트**
   `tailwind.config.ts`의 `theme.extend`에 CSS 변수 참조 연결:
   ```typescript
   colors: {
     background: 'hsl(var(--bg-primary))',
     foreground: 'hsl(var(--text-primary))',
     brand: {
       500: 'hsl(var(--brand-500))',
     }
   }
   ```

7. **디자인 토큰 JSON 생성**
   Style Dictionary 호환 형식으로 JSON 내보내기

8. **브랜드 가이드라인 문서 생성**
   마크다운 형식으로:
   - 색상 팔레트 (Hex 코드 포함)
   - 타이포그래피 스케일
   - 컴포넌트 사용 예시
   - DO / DON'T 가이드라인

## 출력 형식

### CSS 변수 파일

```css
/* src/styles/tokens.css */

:root {
  /* === 색상 === */
  /* 브랜드 */
  --brand-50: 239 246 255;    /* #EFF6FF */
  --brand-100: 219 234 254;   /* #DBEAFE */
  --brand-500: 59 130 246;    /* #3B82F6 */
  --brand-600: 37 99 235;     /* #2563EB */
  --brand-900: 30 58 138;     /* #1E3A8A */

  /* 배경 */
  --bg-primary: 255 255 255;
  --bg-secondary: 249 250 251;
  --bg-muted: 243 244 246;

  /* 텍스트 */
  --text-primary: 17 24 39;
  --text-secondary: 75 85 99;
  --text-muted: 156 163 175;
  --text-inverse: 255 255 255;

  /* 테두리 */
  --border-default: 229 231 235;
  --border-strong: 156 163 175;

  /* 상태 */
  --success: 34 197 94;
  --warning: 234 179 8;
  --error: 239 68 68;
  --info: 59 130 246;

  /* === 타이포그래피 === */
  --font-sans: 'Pretendard', 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* === Spacing === */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;

  /* === 레이아웃 === */
  --sidebar-width: 256px;
  --sidebar-collapsed-width: 64px;
  --header-height: 64px;
  --container-max: 1280px;
}

[data-theme="dark"] {
  --bg-primary: 17 24 39;
  --bg-secondary: 31 41 55;
  --bg-muted: 55 65 81;
  --text-primary: 249 250 251;
  --text-secondary: 209 213 219;
  --text-muted: 107 114 128;
  --border-default: 55 65 81;
  --border-strong: 75 85 99;
}
```

### 디자인 토큰 JSON

```json
// C:/oomni-data/design/tokens/design-tokens_YYYY-MM-DD.json
{
  "color": {
    "brand": {
      "500": { "value": "#3B82F6", "type": "color" },
      "600": { "value": "#2563EB", "type": "color" }
    },
    "semantic": {
      "background": { "primary": { "value": "{color.neutral.0}", "type": "color" } }
    }
  },
  "typography": {
    "fontFamily": {
      "sans": { "value": "Pretendard, Inter, sans-serif", "type": "fontFamily" }
    }
  }
}
```

## 저장 위치

- `C:/Users/장우경/oomni/backend/src/styles/tokens.css`
- `C:/Users/장우경/oomni/backend/tailwind.config.ts` (업데이트)
- `C:/oomni-data/design/tokens/design-tokens_YYYY-MM-DD.json`
- `C:/oomni-data/design/tokens/brand-guide_YYYY-MM-DD.md`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--brand-color "#2563eb"` : 메인 브랜드 색상 (기준으로 전체 팔레트 자동 생성)
- `--format css|json|tailwind|all` : 출력 형식
- `--dark` : 다크 모드 토큰 포함
- `--font pretendard|inter|system` : 기본 폰트 설정
- `--guide` : 브랜드 가이드라인 문서 생성
- 예시: `/export-css --brand-color "#7c3aed" --dark --guide`
