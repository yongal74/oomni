# ADR-003: Design Bot 이중 실행 모드 (SSE vs PTY)

**날짜**: 2026-04
**상태**: 수정됨 (v2.9.3 채택 → v2.9.5 UX 변경)

---

## 배경

Design Bot은 두 가지 방식으로 디자인을 생성할 수 있다:

1. **SSE(LiveStreamDrawer) 방식**: 백엔드가 LLM을 호출해 HTML/CSS 코드를 스트리밍 생성
2. **PTY(XTerminal) 방식**: Claude Code CLI + Pencil MCP를 통해 Figma 연동 디자인 생성

## 문제

v2.9.2까지 두 방식이 충돌했다:
- 좌측 패널에 HTML 양식 입력 UI (SSE용) 존재
- 중앙에 XTerminal (PTY용) 존재
- LiveStreamDrawer가 Design Bot에서 제거되어 SSE 경로가 동작하지 않음
- XTerminal은 Pencil MCP 없이 실행 시 의미없는 터미널만 표시

## 결정

**Pencil MCP 연결 여부에 따라 자동으로 모드 분기**한다.

```
GET /api/agents/:id/pencil-status
    ↓
connected: true  → XTerminal (PTY 모드)
                   Claude Code + Pencil MCP 인터랙티브
connected: false → LiveStreamDrawer (SSE 모드)
                   HTML 생성 + Pencil 설치 안내 배너
```

### UI 구조
- **Pencil 연결됨**: 중앙 하단에 XTerminal, 좌측 패널은 템플릿 프리셋 (PTY 초기 입력용)
- **Pencil 미연결**: LiveStreamDrawer로 SSE 스트리밍, 하단에 황색 배너 + "Pencil 설치 안내 →" 버튼

### Pencil MCP 감지 방법

```typescript
// backend: ~/.antigravity/extensions/highagency.pencildev*/out/mcp-server-windows-x64.exe 존재 여부
GET /api/agents/:id/pencil-status → { connected: boolean }
```

## 근거

- 사용자가 Pencil을 설치했으면 더 강력한 PTY 모드 자동 활성화
- Pencil 없어도 기본 SSE HTML 생성 모드로 동작 보장
- 두 경로를 동시에 실행하지 않아 충돌 방지
- 헤더에 Pencil MCP 상태 뱃지로 현재 모드 명시

## 관련 파일
- `frontend/src/pages/BotDetailPage.tsx` — 모드 분기 로직
- `backend/src/api/routes/agents.ts` — `/pencil-status` 엔드포인트
- `backend/src/services/ptyService.ts` — Pencil MCP config 자동 주입

---

## v2.9.5 수정사항

### 문제 (자동 분기 방식의 한계)

자동 분기 방식(`pencil-status` API 조회)이 실제 사용에서 UX 혼란을 유발했다:
- Pencil이 설치되어 있어도 사용자가 SSE 모드로 빠르게 HTML 생성하고 싶은 경우가 있음
- 자동으로 XTerminal이 열리면 CLI 사용에 익숙하지 않은 사용자는 당황
- 모드 전환 방법을 몰라 이탈

### 변경된 결정

**기본값을 SSE(LiveStreamDrawer)로 고정하고, 수동으로 Pencil 모드 전환**

```
기본 상태: pencilModeEnabled = false → LiveStreamDrawer (SSE)
사용자가 "Pencil 모드로 전환" 클릭 → pencilModeEnabled = true → XTerminal (PTY)
```

- `pencilModeEnabled` state가 모드를 결정
- Pencil 설치 여부와 관계없이 항상 SSE로 시작
- Pencil 미설치 상태에서 Pencil 모드 전환 시도 시 설치 안내 표시

### 근거
- 사용자 의도 명시성: 사용자가 직접 선택해야 모드가 바뀜
- 신규 사용자 온보딩: 복잡한 CLI 환경 노출 최소화
- Pencil 설치 유도: 배너를 통해 자연스럽게 안내
