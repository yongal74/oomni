# OOMNI v3 — 코드 감사 (Keep / Rewrite / Delete)

> 기준: v2.9.21 코드베이스
> 작성: 2026-04-16 | 상태: DRAFT — 검토 필요

범례: ✅ KEEP (그대로 사용) | 🔧 REWRITE (재작성) | ❌ DELETE (삭제)

---

## 백엔드 (backend/src/)

### DB 레이어 — 핵심 기술 부채

| 파일 | 줄수 | 판단 | 이유 |
|---|---|---|---|
| `db/client.ts` | 432 | 🔧 **REWRITE** | migration v1~v9 누적, shadow bug 근본, postMigrationFkRepair 3중 안전망 → 단순화 필요. 목표 100줄 |
| `db/schema.ts` | 527 | 🔧 **REWRITE** | migration 히스토리 v1~v9 전부 제거. 현재 최종 스키마만 남긴 단일 SCHEMA_SQL로 교체. 목표 200줄 |
| `db/types.ts` | - | ✅ KEEP | 타입 정의만, 변경 없음 |

### API Routes

| 파일 | 줄수 | 판단 | 이유 |
|---|---|---|---|
| `api/app.ts` | 205 | ✅ KEEP | 구조 건전. 삭제 라우터 import만 제거 |
| `api/routes/agents.ts` | 773 | ✅ KEEP | 잘 동작. chat 엔드포인트 포함 |
| `api/routes/missions.ts` | 81 | ✅ KEEP | 단순 CRUD, 문제 없음 |
| `api/routes/feed.ts` | 98 | ✅ KEEP | 단순 CRUD |
| `api/routes/auth.ts` | 715 | ✅ KEEP | Google OAuth + 세션 관리 |
| `api/routes/settings.ts` | 152 | ✅ KEEP | API 키 저장/조회 |
| `api/routes/cost.ts` | 292 | ✅ KEEP | 비용 집계 |
| `api/routes/issues.ts` | 148 | ✅ KEEP | 티켓 CRUD |
| `api/routes/schedules.ts` | 156 | ✅ KEEP | 자동화 스케줄 |
| `api/routes/reports.ts` | 191 | ✅ KEEP | 일/주/월 리포트 |
| `api/routes/research.ts` | 696 | ✅ KEEP | 리서치 아이템 관리 |
| `api/routes/ceo.ts` | 185 | ✅ KEEP | CEO 브리핑 |
| `api/routes/templates.ts` | 117 | ✅ KEEP | Solo Factory OS 템플릿 |
| `api/routes/design-systems.ts` | 109 | ✅ KEEP | 디자인 시스템 토큰 |
| `api/routes/integrations.ts` | - | ✅ KEEP | 외부 서비스 연동 설정 |
| `api/routes/obsidian.ts` | 87 | ✅ KEEP | 사용자 요청으로 유지 |
| `api/routes/webhooks.ts` | - | ✅ KEEP | n8n 연동 webhook 수신 |
| `api/routes/backup.ts` | 117 | ✅ KEEP | DB 백업 (v3 리셋 시 활용) |
| `api/routes/n8n.ts` | 109 | ❌ **DELETE** | n8n 봇 제거됨, 라우터도 삭제 |
| `api/routes/video.ts` | 202 | ❌ **DELETE** | PRD 외 기능 |
| `api/routes/payments.ts` | 666 | ❌ **DELETE** | Phase 2, 현재 미완성 |
| `api/routes/cdp.ts` | 103 | ❌ **DELETE** | PRD 외 기능 |
| `api/routes/devtools.ts` | - | ❌ **DELETE** | 개발 전용, 배포 불필요 |
| `api/swagger.ts` | - | ❌ **DELETE** | dev 전용, 번들 크기 증가 |

### Services — 봇 실행 핵심

| 파일 | 줄수 | 판단 | 이유 |
|---|---|---|---|
| `services/claudeCodeService.ts` | 636 | ✅ KEEP | Build/Design PTY 실행 핵심 |
| `services/claudeCodeExecutor.ts` | 143 | ✅ KEEP | Claude Code 실행 래퍼 |
| `services/ptyService.ts` | 263 | ✅ KEEP | PTY 세션 관리 |
| `services/parallelExecutor.ts` | 121 | ✅ KEEP | 병렬 봇 실행 |
| `services/roleExecutors/base.ts` | 249 | ✅ KEEP | saveFeedItem 등 공통 |
| `services/roleExecutors/research.ts` | 260 | ✅ KEEP | Research Bot 실행 로직 |
| `services/roleExecutors/content.ts` | 245 | ✅ KEEP | Content Bot |
| `services/roleExecutors/growth.ts` | - | ✅ KEEP | Growth Bot |
| `services/roleExecutors/ops.ts` | - | ✅ KEEP | Ops Bot |
| `services/roleExecutors/ceo.ts` | - | ✅ KEEP | CEO Bot |
| `services/roleExecutors/build.ts` | 105 | ✅ KEEP | Build Bot |
| `services/roleExecutors/design.ts` | 116 | ✅ KEEP | Design Bot |
| `services/roleExecutors/index.ts` | - | ✅ KEEP | 라우팅 |
| `services/videoService.ts` | 391 | ❌ **DELETE** | PRD 외 기능 |

### 기타

| 파일 | 줄수 | 판단 | 이유 |
|---|---|---|---|
| `agents/heartbeat.ts` | - | ✅ KEEP | 하트비트 스케줄러 |
| `agents/runner.ts` | - | ✅ KEEP | 봇 실행 진입점 |
| `agents/llm-provider.ts` | - | ✅ KEEP | LLM 프로바이더 추상화 |
| `ws/server.ts` | - | ✅ KEEP | WebSocket 피드 서버 |
| `crypto/vault.ts` | - | ✅ KEEP | API 키 암호화 |
| `middleware/apiError.ts` | - | ✅ KEEP | 표준 에러 응답 |
| `middleware/requireAuth.ts` | - | ✅ KEEP | 인증 미들웨어 |
| `logger.ts` | - | ✅ KEEP | 로깅 |
| `config.ts` | - | ✅ KEEP | 환경 설정 |
| `index.ts` | - | ✅ KEEP | 서버 진입점 |
| `bots/n8n.ts` | - | ❌ **DELETE** | n8n 봇 |
| `bots/integration.ts` | - | ❌ **DELETE** | Integration Bot (Phase 2로 이동) |

---

## 프론트엔드 (frontend/src/)

### Pages

| 파일 | 줄수 | 판단 | 이유 |
|---|---|---|---|
| `pages/BotDetailPage.tsx` | **1436** | 🔧 **REWRITE** | 7번 이상 부분 리라이트로 뒤엉킴. AntigravityRightPanel 내부 상태가 외부와 단절. 분리 목표: `BotDetailLayout` + `UnifiedBotPage` + `PtyBotPage` |
| `pages/DashboardPage.tsx` | 893 | ✅ KEEP | 기능 대부분 정상. 세부 컴포넌트 분리 권장 |
| `pages/ResearchPage.tsx` | 508 | ✅ KEEP | 리서치 스튜디오, 잘 동작 |
| `pages/OnboardingPage.tsx` | 418 | ✅ KEEP | 온보딩 플로우 정상 |
| `pages/SettingsPage.tsx` | 884 | ✅ KEEP | 설정 페이지, 단순화 고려 |
| `pages/ApprovalPage.tsx` | 361 | ✅ KEEP | 승인 인박스 |
| `pages/IssuesPage.tsx` | 316 | ✅ KEEP | 티켓 관리 |
| `pages/SchedulePage.tsx` | 391 | ✅ KEEP | 자동화 스케줄 |
| `pages/CostPage.tsx` | 287 | ✅ KEEP | 비용 대시보드 |
| `pages/ReportPage.tsx` | 241 | ✅ KEEP | 리포트 |
| `pages/IntegrationsPage.tsx` | 309 | ✅ KEEP | 외부 서비스 연동 |
| `pages/MonitoringPage.tsx` | 211 | ✅ KEEP | 모니터링 (검토 후 결정) |
| `pages/PipelinePage.tsx` | 298 | ✅ KEEP | 파이프라인 시각화 |
| `pages/CeoBotPage.tsx` | 331 | ✅ KEEP | CEO 봇 전용 페이지 |
| `pages/PinPage.tsx` | 184 | ✅ KEEP | PIN 인증 |
| `pages/DevToolsPage.tsx` | 475 | ❌ **DELETE** | 개발 전용 |

### Components — Bot

| 파일 | 줄수 | 판단 | 이유 |
|---|---|---|---|
| `components/bot/XTerminal.tsx` | 304 | ✅ KEEP | PTY 터미널, 안정적 |
| `components/bot/PipelineBar.tsx` | 125 | ✅ KEEP | 단계 표시 |
| `components/bot/ModelSwitcher.tsx` | 371 | ✅ KEEP | 모델 선택 |
| `components/bot/panels/ResearchPanel.tsx` | 812 | ✅ KEEP | 리서치 좌측 패널 |
| `components/bot/panels/ContentPanel.tsx` | 916 | ✅ KEEP | 콘텐츠 패널 |
| `components/bot/panels/BuildPanel.tsx` | 539 | ✅ KEEP | 빌드 패널 |
| `components/bot/panels/DesignPanel.tsx` | 539 | ✅ KEEP | 디자인 패널 |
| `components/bot/panels/GrowthPanel.tsx` | 726 | ✅ KEEP | 그로스 패널 |
| `components/bot/panels/OpsPanel.tsx` | 576 | ✅ KEEP | Ops 패널 |
| `components/bot/panels/CeoPanel.tsx` | 307 | ✅ KEEP | CEO 패널 |
| `components/bot/panels/GenericPanel.tsx` | 234 | ✅ KEEP | 공통 패널 |
| `components/bot/LiveStreamDrawer.tsx` | 232 | ❌ **DELETE** | BotDetailPage 리라이트 시 통합 제거 |
| `components/bot/shared/` | - | ✅ KEEP | 공유 컴포넌트 |
| `components/video/` | - | ❌ **DELETE** | PRD 외 |

### 기타

| 파일 | 줄수 | 판단 | 이유 |
|---|---|---|---|
| `components/layout/AppLayout.tsx` | - | ✅ KEEP | 레이아웃 |
| `components/BotRunModal.tsx` | - | ✅ KEEP | 봇 실행 모달 |
| `components/BotRunHistory.tsx` | - | ✅ KEEP | 실행 이력 |
| `components/BotStreamOutput.tsx` | - | ✅ KEEP | 스트림 출력 |
| `lib/api.ts` | - | ✅ KEEP | cleanup: video/cdp/payments 제거 |
| `lib/firebase.ts` | - | ❌ **DELETE** | Solo Factory OS 잔재, 미사용 |
| `lib/ws.ts` | - | ✅ KEEP | WebSocket 클라이언트 |
| `lib/notifications.ts` | - | ✅ KEEP | 알림 |
| `store/app.store.ts` | - | ✅ KEEP | Zustand 전역 상태 |
| `router.tsx` | - | ✅ KEEP | cleanup: DevTools 라우트 제거 |
| `hooks/useAuth.ts` | - | ✅ KEEP | 인증 훅 |

---

## 요약

| 구분 | 파일 수 | 주요 작업 |
|---|---|---|
| ✅ KEEP | ~50개 | 그대로 유지 (일부 import 정리) |
| 🔧 REWRITE | **3개** | `db/client.ts`, `db/schema.ts`, `BotDetailPage.tsx` |
| ❌ DELETE | **14개** | video, cdp, payments, n8n, devtools, firebase, swagger, integration bot, LiveStreamDrawer |

> **핵심**: 전체 리라이트가 아님. **DB 레이어 2파일 + BotDetailPage 1파일** 재작성이 기술부채의 90% 해소.

---

## 상의 필요 항목

| # | 항목 | 선택지 |
|---|---|---|
| CA-01 | `MonitoringPage.tsx` (211줄) | A) 유지 B) 삭제 (Ops Bot과 중복?) |
| CA-02 | `PipelinePage.tsx` (298줄) | A) 유지 B) 대시보드로 통합 |
| CA-03 | `backup.ts` 라우터 | A) 유지 (v3 리셋 시 활용) B) 삭제 |
| CA-04 | `BotDetailPage.tsx` 분리 방식 | A) UnifiedBotPage + PtyBotPage 2개로 B) role별 8개 파일로 |
| CA-05 | `auth.ts` (715줄) Google OAuth | A) 유지 B) 로컬 PIN만으로 단순화 |
