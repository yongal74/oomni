# OOMNI v3.0.0 — WBS (Work Breakdown Structure)

> 작성: 2026-04-16 | 기준 버전: v2.9.21 → v3.0.0
> Feature ID → `docs/standards/feature-ids.md` 참조

---

## Phase 1 — 기술부채 제거

> **목표**: 불필요 코드 14개 삭제 + DB 레이어 완전 재작성 + Firebase/OAuth 제거
> 이 Phase가 끝나야 나머지 모든 Phase가 안정적으로 진행 가능.
> 완료 기준: `tsc --noEmit` 오류 0건, 신규 설치 DB 오류 0건

### 1-A. 파일 삭제 (DEL)

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 1-A-1 | 백엔드 라우터 6개 삭제 + `app.ts` import 정리 | DEL-01~06 | `routes/n8n.ts`, `video.ts`, `payments.ts`, `cdp.ts`, `devtools.ts`, `swagger.ts` | 🔲 |
| 1-A-2 | videoService + 관련 import 제거 | DEL-07 | `services/videoService.ts` | 🔲 |
| 1-A-3 | n8n bot + integration bot 삭제 | DEL-08~09 | `bots/n8n.ts`, `bots/integration.ts` | 🔲 |
| 1-A-4 | 프론트 삭제 3종 + router 정리 | DEL-10~12 | `BotDetailPage.tsx`(임시유지), `CeoBotPage.tsx`, `DevToolsPage.tsx` | 🔲 |
| 1-A-5 | LiveStreamDrawer + firebase + video 컴포넌트 삭제 | DEL-13~14 | `LiveStreamDrawer.tsx`, `lib/firebase.ts`, `components/video/` | 🔲 |
| 1-A-6 | `lib/api.ts` video/cdp/payments 함수 제거 | — | `lib/api.ts` | 🔲 |
| 1-A-7 | 삭제 대상 테스트 파일 3개 제거 | — | `bots/n8n-bot.test.ts`, `bots/integration-bot.test.ts`, `services/videoService.test.ts` | 🔲 |
| 1-A-8 | 패키지 제거: Remotion, Firebase, Swagger, Passport | — | `backend/package.json`, `frontend/package.json` | 🔲 |

### 1-B. DB 레이어 재작성

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 1-B-1 | `schema.ts` 재작성 — migration v1~v9 전부 제거, SCHEMA_SQL만 (527→200줄) | DB-01 | `db/schema.ts` | 🔲 |
| 1-B-2 | `client.ts` 재작성 — migration 체인 제거, 단순 초기화 (432→100줄) | DB-01 | `db/client.ts` | 🔲 |
| 1-B-3 | v2.x DB 감지 로직 + 자동 백업 (`oomni-backup-{timestamp}.db`) | DB-02 | `db/client.ts` | 🔲 |
| 1-B-4 | Electron dialog 연동 (IPC: `db-reset-required`) | DB-02 | `electron/main.js`, `db/client.ts` | 🔲 |
| 1-B-5 | SCHEMA_SQL에서 `subscriptions`, `payment_logs` 테이블 제거 | DB-01 | `db/schema.ts` | 🔲 |
| 1-B-6 | agents role CHECK에서 `integration` 제거 | DB-01 | `db/schema.ts` | 🔲 |

### 1-C. 인증 단순화 (Firebase → PIN)

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 1-C-1 | `auth.ts` 재작성 — PIN 전용, Google OAuth 완전 제거 (715→150줄) | SET-02 | `api/routes/auth.ts` | 🔲 |
| 1-C-2 | `requireAuth.ts` 재작성 — Firebase JWT 제거, 세션 토큰만 (244→60줄) | SET-02 | `middleware/requireAuth.ts` | 🔲 |
| 1-C-3 | `electron/main.js` — Firebase OAuth 팝업 블록 제거 (`contextIsolation:false` 제거) | SET-02 | `electron/main.js` | 🔲 |
| 1-C-4 | `PinPage.tsx` 연동 확인 + `OnboardingPage` PIN 설정 흐름 확인 | SET-02, ONB-01 | `PinPage.tsx`, `OnboardingPage.tsx` | 🔲 |

### 1-D. 검증

| # | 작업 | 상태 |
|---|---|---|
| 1-D-1 | `tsc --noEmit` (backend + frontend) 오류 0건 | 🔲 |
| 1-D-2 | 신규 설치 DB 오류 0건 확인 | 🔲 |
| 1-D-3 | v2.x DB → 리셋 다이얼로그 동작 확인 | 🔲 |
| 1-D-4 | PIN 로그인 동작 확인 | 🔲 |

---

## Phase 2 — 핵심 UI 재구성

> **목표**: BotDetailPage God Component 해체 + Dashboard CEO 통합 + Error Boundary
> Phase 1 완료 후 진행.

### 2-A. BotDetailPage 분리

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-A-1 | `UnifiedBotPage.tsx` 신규 작성 (Research / Content / Growth) | BOT-01,04,05 | `pages/UnifiedBotPage.tsx` | 🔲 |
| 2-A-2 | lineBuffer 패턴 + `onChatDone` 중앙 패널 연동 | BOT-01,04,05 | `pages/UnifiedBotPage.tsx` | 🔲 |
| 2-A-3 | `PtyBotPage.tsx` 신규 작성 (Build / Design / Ops) | BOT-02,03,06 | `pages/PtyBotPage.tsx` | 🔲 |
| 2-A-4 | XTerminal `onOutputCapture` → 중앙 패널 누적 표시 | BOT-02,03,06 | `pages/PtyBotPage.tsx` | 🔲 |
| 2-A-5 | `router.tsx` 라우트 교체 + `BotDetailPage.tsx` 삭제 | DEL-10 | `router.tsx`, `BotDetailPage.tsx` | 🔲 |

### 2-B. Dashboard + CEO Bot 통합

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-B-1 | `DashboardPage` CEO 브리핑 섹션 추가 + `CeoPanel` 마운트 | DASH-08 | `DashboardPage.tsx` | 🔲 |
| 2-B-2 | CEO executor `/api/agents/:id/chat` 연동 확인 | BOT-07 | `roleExecutors/ceo.ts` | 🔲 |
| 2-B-3 | `AppLayout.tsx` 사이드바 — CEO Bot / DevTools 항목 제거 | DASH-08 | `AppLayout.tsx` | 🔲 |

### 2-C. 안정성 (IDE 수준)

| # | 작업 | 대상 파일 | 상태 |
|---|---|---|---|
| 2-C-1 | `ErrorBoundary.tsx` 컴포넌트 신규 작성 | `components/ErrorBoundary.tsx` | 🔲 |
| 2-C-2 | 전체 앱 + 봇 패널별 Error Boundary 적용 | `App.tsx`, 각 봇 패널 | 🔲 |

---

## Phase 3 — 기능 수정 & 봇 구현

> **목표**: 우측 패널 AI 동작 + 중앙 결과 표시 + 봇별 기능 충실화
> Phase 2 완료 후 진행.

### 3-A. 우측 패널 AI + 중앙 패널 결과 수정

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 3-A-1 | `app.ts` `isPublicPath` — POST `/chat` 예외 확인 | BOT-01 | `api/app.ts` | 🔲 |
| 3-A-2 | lineBuffer 스트리밍 파싱 단위 테스트 추가 | BOT-01 | `tests/` | 🔲 |
| 3-A-3 | `onChatDone` → `isRunning=false` + 중앙 패널 결과 표시 검증 | BOT-01 | `UnifiedBotPage.tsx` | 🔲 |
| 3-A-4 | PipelineBar `stage` 이벤트 실시간 업데이트 검증 | BOT-01 | `PipelineBar.tsx` | 🔲 |

### 3-B. 봇별 기능 구현

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 3-B-1 | Research Bot 필터 (keep/maybe/skip) + Obsidian 연동 | BOT-01, INT-01 | `roleExecutors/research.ts`, `ResearchPage.tsx` | 🔲 |
| 3-B-2 | Growth Bot 마케팅 자동화 프롬프트 충실화 (현재 47줄) | BOT-05 | `roleExecutors/growth.ts` | 🔲 |
| 3-B-3 | Ops Bot n8n JSON 생성 프롬프트 충실화 (현재 47줄) | BOT-06, OPS-01 | `roleExecutors/ops.ts` | 🔲 |
| 3-B-4 | CEO Bot 종합 브리핑 프롬프트 충실화 (현재 74줄) | BOT-07 | `roleExecutors/ceo.ts` | 🔲 |
| 3-B-5 | Build Bot 프롬프트 최적화 | BOT-02 | `roleExecutors/build.ts` | 🔲 |
| 3-B-6 | Design Bot Pencil MCP 연동 검증 | BOT-03 | `roleExecutors/design.ts` | 🔲 |

### 3-C. UX 검증

| # | 작업 | Feature ID | 상태 |
|---|---|---|---|
| 3-C-1 | 온보딩 5분 이내 완료 검증 | ONB-01 | 🔲 |
| 3-C-2 | 봇 추가 → 첫 실행 결과 10분 이내 검증 | DASH-03 | 🔲 |
| 3-C-3 | 승인 인박스 동작 확인 | DASH-04 | 🔲 |
| 3-C-4 | 전 봇 타입 e2e 실행 테스트 | — | 🔲 |

---

## Phase 4 — 패키지 & 릴리즈

> **목표**: v3.0.0 배포. 설치파일 150MB 이내, cold start 3초 이내.

| # | 작업 | 상태 |
|---|---|---|
| 4-1 | `tsc --noEmit` (backend + frontend) 최종 확인 | 🔲 |
| 4-2 | `cd backend && npm run build` + `cd frontend && npm run build` | 🔲 |
| 4-3 | `npm run rebuild-native` + `npx electron-builder` | 🔲 |
| 4-4 | 설치파일 크기 확인 (목표 150MB 이내) | 🔲 |
| 4-5 | 신규 설치 전체 플로우 검증 (DB 오류 0건) | 🔲 |
| 4-6 | v2.x → v3.0 업그레이드 시나리오 검증 | 🔲 |
| 4-7 | `git commit && git push` | 🔲 |
| 4-8 | `gh release create v3.0.0 "OOMNI Setup 3.0.0.exe"` | 🔲 |
| 4-9 | `docs/index.html` 다운로드 링크 버전 업데이트 → push | 🔲 |

---

## 전체 요약

| Phase | 내용 | 서브 | 태스크 수 | 예상 세션 |
|---|---|---|---|---|
| **1** | **기술부채 제거** | 파일삭제 + DB재작성 + 인증단순화 + 검증 | **22** | **3~4** |
| **2** | **핵심 UI 재구성** | BotDetail분리 + Dashboard CEO + Error Boundary | **13** | **3** |
| **3** | **기능 수정 & 봇 구현** | 우측패널AI + 봇별기능 + UX검증 | **14** | **3** |
| **4** | **패키지 & 릴리즈** | 빌드 + 테스트 + 배포 | **9** | **1** |
| **합계** | | | **58** | **~10~11** |

---

## Critical Path

```
Phase 1 (기술부채) → Phase 2 (UI 재구성) → Phase 3 (기능) → Phase 4 (릴리즈)
                                          ↑
                              순서 절대 바꾸지 않음
                              Phase 1 없이 Phase 2 시작 금지
```

## 병렬 가능 항목

```
Phase 1 내부:
  1-A (파일삭제) → 완료 후 → 1-B (DB재작성) + 1-C (인증) 병렬 가능

Phase 2 내부:
  2-A (BotDetail분리) + 2-B (Dashboard) + 2-C (ErrorBoundary) 병렬 가능

Phase 3 내부:
  3-A (우측패널) + 3-B (봇별기능) 병렬 가능
```
