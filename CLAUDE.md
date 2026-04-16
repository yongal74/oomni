# OOMNI v3 — Claude Code 규칙

> 이 파일은 200줄 이내로 유지. 세부 규칙은 `.claude/rules/` 참조.

---

## 절대 규칙 (4개 — 위반 즉시 중단)

1. **코드 작성 전 근본 원인 분석 보고 → 대표님 승인 → 개발** (패치 금지)
2. **DB ALTER TABLE RENAME 금지** → FK 오염의 근본 원인 (`.claude/rules/10-db.md` 참조)
3. **WebSocket `{ server, path }` 옵션 금지** → `noServer: true` + `/ws` 경로 handleUpgrade만 허용
4. **v3.0.0 미포함 기능 절대 추가 금지** → Phase 2는 코드 한 줄도 건드리지 않음

---

## 프로젝트 컨텍스트

**OOMNI** — 비개발자 1인 창업자용 AI 에이전트 자동화 플랫폼 (Electron, Windows 로컬)

| 항목 | 값 |
|---|---|
| 소스 | `C:\Users\장우경\oomni` ← 수정 대상 |
| 설치 앱 | `C:\진짜OOMNI` ← 바이너리, 절대 수정 금지 |
| 별개 프로젝트 | `C:\Users\장우경\solo-factory-os` ← OOMNI 무관 |
| 현재 버전 | v3.0.0 (개발 중) |
| DB | `C:/oomni-data/oomni.db` (SQLite) |

---

## 아키텍처 요약

```
Renderer (React/Vite :5174)
  ↕ IPC
Main Process (Electron)
  → require(backend/dist/index.js) 인-프로세스
    → Express REST :3001
    → WebSocket /ws (피드)
    → WebSocket /api/agents/:id/terminal (PTY)
    → SQLite better-sqlite3
```

---

## 봇 그룹 (v3.0.0)

| 그룹 | 봇 | 실행 방식 | 페이지 |
|---|---|---|---|
| Chat | Research, Content, Growth | HTTP POST /chat (chunked streaming) | UnifiedBotPage |
| PTY | Build, Design, Ops | node-pty + claude CLI | PtyBotPage |
| Dashboard | CEO Bot 통합 | DashboardPage 내 CEO 패널 | DashboardPage |

---

## 세부 규칙 포인터

| 규칙 파일 | 내용 |
|---|---|
| `.claude/rules/00-global.md` | 전역 금지사항, 작업 프로세스 |
| `.claude/rules/10-db.md` | SQLite/마이그레이션 규칙 |
| `.claude/rules/20-api.md` | 인증/라우팅/스트리밍 규칙 |
| `.claude/rules/30-frontend.md` | 컴포넌트/상태관리 규칙 |
| `.claude/rules/40-bot.md` | 봇 실행/PTY/WebSocket 규칙 |
| `.claude/rules/50-release.md` | 릴리즈 체크리스트 |
| `.claude/rules/60-doc-sync.md` | 문서 동기화 규칙 |

---

## 문서 포인터

| 문서 | 경로 |
|---|---|
| PRD v2 | `docs/prd/PRD-v2.md` |
| 시스템 컨텍스트 | `docs/architecture/system-context.md` |
| 모듈 맵 | `docs/architecture/module-map.md` |
| 코드 감사 | `docs/architecture/code-audit.md` |
| WBS v3.0.0 | `docs/wbs/WBS-v3.0.0.md` |
| Feature ID 레지스트리 | `docs/standards/feature-ids.md` |
