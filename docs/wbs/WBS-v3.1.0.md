# OOMNI v3.1.0 — WBS (Work Breakdown Structure)

> 작성: 2026-04-18 | 기준 버전: v3.0.5 → v3.1.0 (Phase 2)
> 우선순위: BOT-08 → BOT-09 → BOT-10 → BOT-11 순
> 참고: ARCH-v3.1.md, PRD-v3.md, feature-ids.md

---

## Phase 2-A — 기반 인프라 확장

> **목표**: 신규 역할 타입을 코어 레이어에 추가
> **완료 기준**: tsc --noEmit 오류 0건, DB 마이그레이션 성공

### 2-A-1. 타입 & DB 확장

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-A-1-1 | `AgentRole`에 6개 신규 타입 추가 | BOT-08~11 | `db/types.ts` | ✅ |
| 2-A-1-2 | DB schema role CHECK 제약 확장 + `setup_wizard_sessions` 테이블 추가 | BOT-08 | `db/schema.ts` | ✅ |
| 2-A-1-3 | `claudeCodeService.ts` ROLE_MODELS 6개 추가 (모두 Sonnet-4.6) | BOT-08~11 | `services/claudeCodeService.ts` | ✅ |
| 2-A-1-4 | `claudeCodeService.ts` buildRolePrompts() 신규 역할 시스템 프롬프트 추가 | BOT-08~11 | `services/claudeCodeService.ts` | ✅ |
| 2-A-1-5 | `runner.ts` ROLE_INSTRUCTIONS 6개 추가 | BOT-08~11 | `agents/runner.ts` | ✅ |

---

## Phase 2-B — BOT-08 ProjectSetup Bot

> **목표**: 5가지 질문으로 프로젝트 완전 초기화 자동화
> **완료 기준**: 5개 질문 입력 → Claude가 Next.js 스캐폴딩 + env + GitHub + Vercel 자동 실행

### 2-B-1. Backend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-B-1-1 | `roleExecutors/projectSetup.ts` 생성 (setup 프롬프트 빌더 + 실행) | BOT-08 | 신규 | ✅ |
| 2-B-1-2 | `roleExecutors/index.ts` projectSetup 등록 | BOT-08 | `roleExecutors/index.ts` | ✅ |
| 2-B-1-3 | `routes/agents.ts` POST `/setup-wizard` 엔드포인트 추가 | BOT-08 | `api/routes/agents.ts` | ✅ |
| 2-B-1-4 | `routes/agents.ts` GET `/setup-wizard/status` 엔드포인트 추가 | BOT-08 | `api/routes/agents.ts` | 🔲 |

### 2-B-2. Frontend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-B-2-1 | `SetupWizardPage.tsx` 생성 (5-question 순차 UI) | BOT-08 | 신규 | 🔲 |
| 2-B-2-2 | `SetupWizardStep.tsx` 컴포넌트 (단계별 질문 카드) | BOT-08 | 신규 | 🔲 |
| 2-B-2-3 | `SetupStackPreview.tsx` 컴포넌트 (스택 실시간 미리보기) | BOT-08 | 신규 | 🔲 |
| 2-B-2-4 | `router.tsx` `/setup-wizard/:agentId` 라우트 추가 | BOT-08 | `router.tsx` | 🔲 |
| 2-B-2-5 | `UnifiedBotPage.tsx` ProjectSetup Bot 템플릿 추가 + 클릭 시 SetupWizard로 이동 | BOT-08 | `UnifiedBotPage.tsx` | ✅ |

---

## Phase 2-C — BOT-09 Env Bot

> **목표**: 환경변수 유출 스캔 + 로컬↔Vercel 동기화 자동화
> **완료 기준**: 코드베이스 스캔 → NEXT_PUBLIC_ 오용 탐지 → 체크리스트 생성

### 2-C-1. Backend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-C-1-1 | `roleExecutors/env.ts` 생성 (스캔 + 동기화 프롬프트) | BOT-09 | 신규 | ✅ |
| 2-C-1-2 | `roleExecutors/index.ts` env 등록 | BOT-09 | `roleExecutors/index.ts` | ✅ |
| 2-C-1-3 | `routes/agents.ts` POST `/env-scan` 엔드포인트 추가 | BOT-09 | `api/routes/agents.ts` | 🔲 |

### 2-C-2. Frontend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-C-2-1 | `EnvChecklist.tsx` 컴포넌트 (미설정/오설정 항목 강조) | BOT-09 | 신규 | 🔲 |
| 2-C-2-2 | `PtyBotPage.tsx` env 역할 힌트 + 아이콘 추가 | BOT-09 | `PtyBotPage.tsx` | ✅ |
| 2-C-2-3 | `UnifiedBotPage.tsx` Env Bot 템플릿 추가 | BOT-09 | `UnifiedBotPage.tsx` | ✅ |

---

## Phase 2-D — BOT-10 SecurityAudit Bot

> **목표**: 배포 전 자동 보안 점검 (OWASP + RLS + 시크릿 스캔)
> **완료 기준**: npm audit + 코드 분석 → CRITICAL/HIGH/MEDIUM/LOW 분류 결과 출력

### 2-D-1. Backend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-D-1-1 | `roleExecutors/securityAudit.ts` 생성 (감사 파이프라인 프롬프트) | BOT-10 | 신규 | ✅ |
| 2-D-1-2 | `roleExecutors/index.ts` securityAudit 등록 | BOT-10 | `roleExecutors/index.ts` | ✅ |
| 2-D-1-3 | `routes/agents.ts` POST `/security-audit` 엔드포인트 추가 | BOT-10 | `api/routes/agents.ts` | 🔲 |

### 2-D-2. Frontend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-D-2-1 | `SecurityAuditResult.tsx` 컴포넌트 (위험도별 결과 카드) | BOT-10 | 신규 | 🔲 |
| 2-D-2-2 | `PtyBotPage.tsx` security_audit 역할 아이콘/힌트 추가 | BOT-10 | `PtyBotPage.tsx` | ✅ |
| 2-D-2-3 | `UnifiedBotPage.tsx` SecurityAudit Bot 템플릿 추가 | BOT-10 | `UnifiedBotPage.tsx` | ✅ |

---

## Phase 2-E — BOT-11 Build Bot 세분화

> **목표**: Frontend / Backend / Infra 전문 봇 분리
> **완료 기준**: 각 봇이 전문 영역 코드만 생성, 기존 Build Bot은 유지

### 2-E-1. Backend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-E-1-1 | `roleExecutors/frontend.ts` 생성 (React/Tailwind/shadcn 전문 프롬프트) | BOT-11 | 신규 | ✅ |
| 2-E-1-2 | `roleExecutors/backend.ts` 생성 (API/Supabase/RLS 전문 프롬프트) | BOT-11 | 신규 | ✅ |
| 2-E-1-3 | `roleExecutors/infra.ts` 생성 (CI/CD/Vercel/Docker 전문 프롬프트) | BOT-11 | 신규 | ✅ |
| 2-E-1-4 | `roleExecutors/index.ts` frontend/backend/infra 등록 | BOT-11 | `roleExecutors/index.ts` | ✅ |

### 2-E-2. Frontend

| # | 작업 | Feature ID | 대상 파일 | 상태 |
|---|---|---|---|---|
| 2-E-2-1 | `PtyBotPage.tsx` frontend/backend/infra 역할 아이콘/색상/힌트 추가 | BOT-11 | `PtyBotPage.tsx` | ✅ |
| 2-E-2-2 | `UnifiedBotPage.tsx` Frontend/Backend/Infra Bot 템플릿 추가 (3개) | BOT-11 | `UnifiedBotPage.tsx` | ✅ |

---

## Phase 2-F — 통합 검증 & 릴리즈

| # | 작업 | 상태 |
|---|---|---|
| 2-F-1 | `tsc --noEmit` (backend + frontend) 오류 0건 | ✅ |
| 2-F-2 | DB 마이그레이션 정상 동작 확인 (신규 역할로 봇 생성) | 🔲 |
| 2-F-3 | ProjectSetup Bot E2E 테스트 (5개 질문 → PTY 실행) | 🔲 |
| 2-F-4 | Env Bot 스캔 테스트 (테스트 프로젝트 경로) | 🔲 |
| 2-F-5 | SecurityAudit Bot 실행 테스트 | 🔲 |
| 2-F-6 | Frontend/Backend/Infra Bot 생성 및 실행 테스트 | 🔲 |
| 2-F-7 | 버전 v3.1.0 bump (package.json 3곳) | ✅ |
| 2-F-8 | git commit + push | ✅ |
| 2-F-9 | electron-builder 빌드 + GitHub Release v3.1.0 | ✅ |

---

## 개발 순서 요약

```
2-A (기반) → 2-B (ProjectSetup) → 2-C (Env) → 2-D (SecurityAudit) → 2-E (Build 세분화) → 2-F (검증/릴리즈)
```

총 작업 수: **38개**
예상 파일 변경: Backend 11개, Frontend 7개 (신규 8 + 수정 10)

---

*WBS v3.1.0 — 2026-04-18*
*참고: ARCH-v3.1.md, PRD-v3.md*
