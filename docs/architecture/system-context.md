# OOMNI v3 — System Context

> 최종 수정: 2026-04-16

---

## 시스템 경계

```
┌─────────────────────────────────────────────────────────────────┐
│  OOMNI Electron App (Windows 로컬)                               │
│                                                                   │
│  ┌──────────────┐    IPC     ┌──────────────────────────────┐   │
│  │  Renderer    │◄──────────►│  Main Process (electron/)    │   │
│  │  (React SPA) │            │  - 앱 윈도우 관리             │   │
│  │  port: 5174  │   HTTP     │  - 내부 API 키 관리           │   │
│  │  (dev only)  │◄──────────►│  - EADDRINUSE 처리            │   │
│  └──────────────┘            └──────────────────────────────┘   │
│         │                              │ require()               │
│         │ HTTP :3001                   ▼                          │
│         │                  ┌──────────────────────────────┐      │
│         └─────────────────►│  Backend (Express in-process)│      │
│                             │  - REST API                  │      │
│                             │  - WebSocket (/ws)           │      │
│                             │  - PTY (node-pty)            │      │
│                             │  - SQLite (better-sqlite3)   │      │
│                             └──────────────────────────────┘      │
│                                        │                          │
│                             C:/oomni-data/oomni.db                │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  Anthropic Claude API    Claude Code CLI      Obsidian (선택)
  (ai.anthropic.com)     (claude 바이너리)    (로컬 vault)
```

---

## 컴포넌트 책임

| 컴포넌트 | 책임 | 기술 |
|---|---|---|
| **Renderer** | UI 렌더링, 사용자 입력, API 호출 | React + Vite + Tailwind + Zustand + React Query |
| **Main Process** | 윈도우 관리, IPC 브리지, 내부 API 키 생성 | Electron |
| **Backend** | REST API, WebSocket, PTY, DB, 봇 실행 | Express + TypeScript |
| **SQLite** | 영속 데이터 저장 (로컬 단일 파일) | better-sqlite3 |
| **Claude Code CLI** | Build/Design Bot PTY 실행 | claude 바이너리 subprocess |
| **Anthropic SDK** | Research/Content/Growth/Ops/CEO Bot AI 호출 | @anthropic-ai/sdk |

---

## 외부 의존성

| 의존성 | 필수 여부 | 대체 가능 여부 |
|---|---|---|
| Anthropic Claude API | 필수 (API 키 필요) | 없음 |
| Claude Code CLI | Build/Design Bot 필수 | PTY 없이 SDK로 대체 가능 (기능 축소) |
| Obsidian 로컬 앱 | 선택적 | 없어도 동작 |
| npm / npx | Pencil MCP 실행 시 필요 | 없으면 Design Bot Pencil 비활성 |

---

## 보안 경계

- 백엔드는 `localhost:3001`만 리슨 — 외부 접근 불가
- 모든 API 호출: `Bearer {내부API키}` (Electron IPC로 키 주입)
- `/api/agents/:id/chat`, `/api/agents/:id/stream` 예외 — 내부 앱 전용이므로 auth bypass
- Anthropic API 키: `C:/oomni-data/settings.json` 암호화 저장

---

## 데이터 흐름 (봇 실행)

### Unified Bot (Research/Content/Growth/Ops/CEO)
```
사용자 입력 (우측 패널)
  → POST /api/agents/:id/chat (chunked HTTP streaming)
  → routeToExecutor() → Anthropic SDK streaming
  → 청크별 JSON line 전송
  → 프론트 lineBuffer 파싱
  → 우측 패널: 대화 표시
  → 중앙 패널: onChatDone → isRunning=false → 결과 표시
  → DB: heartbeat_runs, feed_items 저장
```

### PTY Bot (Build/Design)
```
사용자 입력 (우측 또는 터미널)
  → WebSocket /api/agents/:id/terminal
  → node-pty: claude --print 실행
  → PTY stdout → XTerminal 표시
  → 중앙 패널: onOutputCapture → 결과 누적 표시
```
