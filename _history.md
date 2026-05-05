# OOMNI 작업 히스토리

> **규칙**: 세션 시작 시 이 파일 읽기 → 작업 → 세션 종료 시 업데이트 (완료/미완료/다음 할 일)

---

## 현재 상태 스냅샷

| 항목 | 내용 |
|------|------|
| **최신 버전** | v5.1.0 |
| **다음 버전** | v5.2.0 (UI 리디자인 완료, 릴리즈 미완) |
| **tsc --noEmit** | ✅ 0 errors (백엔드 + 프론트엔드) |
| **GitHub Release** | ✅ v5.1.0 정상 |
| **랜딩페이지** | ✅ v5.1.0 다운로드 정상 |
| **IDE** | VS Code + Claude Code 익스텐션 |
| **마지막 작업일** | 2026-05-05 |

### 즉시 처리 잔여 작업
```
[ ] gh release delete v5.2.0 --repo yongal74/oomni  ← 빈 릴리즈 삭제
[ ] Phase 3: Design Bot + Build Bot 리디자인 + Onboarding UI (미착수, 논의 필요)
```

---

## 제품 개요

**OOMNI** — 솔로 창업자를 위한 AI 에이전트 자동화 플랫폼
"코딩 없이 AI 팀을 고용하고, 일 시키고, 보고 받는다"

```
Research → Build → Design → Content → Growth → Ops → CEO
```

- **타깃**: 1인 창업자 / 솔로 프리랜서
- **플랫폼**: Windows 10/11 x64 데스크톱 앱 (Electron)
- **GitHub**: https://github.com/yongal74/oomni

---

## 기술 스택

```
[Electron 33]
    ├── Frontend  React 18 + Vite + TailwindCSS + Zustand + React Query  :5174
    └── Backend   Node.js + Express + TypeScript (in-process)             :3001
                      ├── SQLite (better-sqlite3)  C:/oomni-data/oomni.db
                      ├── WebSocket /ws (피드 브로드캐스트)
                      ├── WebSocket /api/agents/:id/terminal (PTY)
                      └── Claude API + Claude Code CLI
```

### 봇별 실행 경로

| 봇 | 실행 방식 | 모델 |
|----|---------|------|
| Design | Anthropic SDK (routeToExecutor) | claude-opus-4-7 (강제) |
| Build / ProjectSetup / Ops계열 | Claude Code CLI (ClaudeCodeService) | claude-sonnet-4-6 |
| Research / Content / Growth / CEO | Anthropic SDK (routeToExecutor) | 역할별 기본값 |

### 변경 불가 핵심 결정

| 규칙 | 이유 |
|------|------|
| `ALTER TABLE RENAME` 금지 | FK 오염 근본 원인 (v2.9.x 교훈) |
| WebSocket `noServer: true` + handleUpgrade only | `{server, path}` 옵션 충돌 이력 |
| lineBuffer 패턴 필수 (HTTP 스트리밍) | HTTP 청크 경계 JSON 분리 방지 |
| PIN 전용 인증 (Firebase 금지) | contextIsolation:false 보안 취약점 |
| PTY: `powershell.exe -NoLogo -NoExit` wrapper | ConPTY exit code 1 문제 해결 |
| Design Bot: `ctx.overrideModel = 'claude-opus-4-7'` | 모델 스위처 설정 우회, Opus 4.7 강제 |

---

## 버전 히스토리

---

### ◆ PRD v1.0 (2026-04-04) — 제품 개념 확정

- 6개 봇 라인업 확정: Research / Build / Design / Content / Growth / Ops
- 아키텍처: Electron + Express in-process + SQLite + Claude Code CLI
- 온보딩 목표: 5분 이내, 첫 봇 결과 10분 이내

---

### ◆ v2.9.21 이전 — 레거시 (포기 결정)

**3개 핵심 버그로 v3.0.0 완전 재개발 결정**:
1. 대시보드 미표시 — DB migration v1~v9 누적 + `postMigrationFkRepair` 파라미터 섀도잉
2. 봇 추가 불가 — FK 오염
3. AI 채팅 미동작 — onChatDone invalidateQueries 누락

---

### ◆ v3.0.0 (2026-04-16) — 완전 재개발

**Phase 1 — 기술부채 제거** ✅
- 16개 파일 삭제 (n8n/video/payments/cdp/devtools/swagger/firebase 등)
- Remotion / Firebase / Swagger 패키지 제거 → 400MB+ → ~167MB
- DB 재작성: migration 체인 제거 → `SCHEMA_SQL` 단일 실행
- v2.x DB 감지 시 자동 백업 + IPC 리셋 다이얼로그
- 인증: Firebase JWT (715줄) → PIN 전용 세션 토큰 (410줄)

**Phase 2 — 핵심 UI 재구성** ✅
- `BotDetailPage` (1436줄 God Component) 분리
  - `UnifiedBotPage.tsx` — HTTP 스트리밍 봇 (Research/Content/Growth/CEO)
  - `PtyBotPage.tsx` — PTY 터미널 봇 (Build/Design/Ops)
- `ErrorBoundary.tsx` 추가 (전체 앱 + 봇 패널별)
- CEO Bot → DashboardPage 통합

**Phase 3 — 봇 구현** ✅
- Growth Executor 47줄 → 143줄 (SEO/광고/채널/전략 트랙)
- Ops Executor 47줄 → 168줄 (n8n/finance/monitor 트랙)
- lineBuffer 패턴 적용

**테스트 결과**:
```
Backend  Jest:    143/143 pass (13 suites)
Frontend Vitest:  73/73 pass  (9 suites)
tsc --noEmit:     0 errors (백엔드 + 프론트엔드)
```

---

### ◆ v3.2.0 (2026-04-18) — PTY 터미널 안정화

**핵심**: Claude Code CLI TUI가 Electron ConPTY에서 exit code 1으로 즉시 종료 버그 수정.

- `powershell.exe -NoLogo -NoExit` → 500ms 후 `node cliPath --dangerously-skip-permissions` 자동 입력
- 모든 역할에 동일 방식 적용 (ConPTY wrapper 제거하면 안 됨)

**UI 추가**:
- Design Bot 3탭: [Pencil 미리보기][HTML 미리보기][코드] (v3.3.0에서 Pencil 탭 제거됨)
- Build Bot 4탭: [전체][프론트엔드][백엔드][초기세팅] + 기술스택 위자드
- Ops Bot 5탭: [운영][인프라][연동][환경변수][보안]

---

### ◆ v3.3.0~v3.3.2 (2026-04-18~19) — Design Bot Pencil → HTML 전환

**배경**: Pencil MCP 자동 기동/연결 성공하나 OOMNI 중앙 패널에 디자인 캔버스 표시 불가.
`claude-opus-4-7`로 HTML 완성본 직접 생성 + `<iframe srcdoc>` 실시간 렌더링으로 전환.

| 단계 | 내용 |
|------|------|
| v3.3.0 | designExecutor 모델 → claude-opus-4-7, Pencil 탭 제거 |
| v3.3.1 | Design 라우팅 근본 원인 수정 (`claudeCodeRoles`에서 `'design'` 제거), Ops 인프라 스킬 16개 |
| v3.3.2 | Pencil 기술부채 완전 제거 (claudeCodeService, XTerminal 잔재 제거) |

**현재 Design Bot 흐름**:
```
POST /api/agents/:id/chat
  → design_systems DB에서 토큰 조회 (primary_color, font 등)
  → routeToExecutor → designExecutor
  → ctx.overrideModel = 'claude-opus-4-7' 강제
  → streamClaude → HTTP 청크 스트리밍
  → DesignCenterPanel: extractHtml() → <iframe srcdoc> 실시간 렌더링
```

**Pencil 관련 코드 현황 (모두 제거 완료)**:
- `ptyService.ts` ✅ / `agents.ts` ✅ / `DesignPanel.tsx` ✅ / `XTerminal.tsx` ✅ / `claudeCodeService.ts` ✅

**릴리즈**: OOMNI Setup 3.3.0.exe → https://github.com/yongal74/oomni/releases/tag/v3.3.0

---

### ◆ PRD v3.0 (2026-04-18) — Phase 2 신규 봇 계획

초보자 고통 지도 분석 기반 4개 신규 봇 계획:

| 봇 | 목적 | 상태 |
|----|------|------|
| BOT-08 ProjectSetup Bot | 5가지 질문으로 프로젝트 완전 초기화 | ⚠️ 부분 구현 (UI 숨김) |
| BOT-09 Env Bot | 환경변수 통합 관리 + 유출 스캔 | ⚠️ 부분 구현 (UI 숨김) |
| BOT-10 SecurityAudit Bot | 배포 전 보안 자동 점검 (RLS/OWASP) | ⚠️ 부분 구현 (UI 숨김) |
| BOT-11 Build Bot 세분화 | Frontend / Backend / Infra 전문화 | ⚠️ 부분 구현 (UI 숨김) |

> `projectSetup / frontend / backend / infra / env / security_audit` 역할은 DB에 존재하나 봇 추가 UI에서는 숨김 처리됨.

---

### ◆ v4.0.1 / v4.2.0 (히스토리 문서 미작성 구간)

git log 기준 확인된 변경:
- `v4.0.1`: Design Bot gallery, CDP integration, TaskBoard, 기술부채 제거
- `v4.2.0`: Build Bot 4-Track Harness (Architecture/Bootstrap/Review/Security) + Security Gate auto-scan + Content/Growth/Ops Track + Settings Version/Feedback

---

### ◆ v5.1.0 (2026-05-04~05) — CDP ID-Graph + Ops Center T1~T7

**신규 기능**:
- **CDP ID-Graph Canvas**: `@xyflow/react` force-directed 그래프로 고객 데이터 시각화
- **Ops Center T1~T7**: 7개 자동화 카드 UI
- **Onboarding Split Screen**: 재설계된 초기 화면
- **POST /api/ops/chat**: SSE 실시간 응답 엔드포인트

**tsc 에러 대량 수정 (v5.2.0 tsc 준비)**:

| 구분 | 수정 전 | 수정 후 | 주요 패턴 |
|------|--------|--------|---------|
| 백엔드 | 8개 에러 | 0개 | 경로 오류, 미사용 변수, 타입 캐스트 |
| 프론트엔드 | 39개 에러 | 0개 | React import, LucideIcon 타입, currentMission?.id, React Query v5 onSuccess |

**재발 방지 규칙**:
- Lucide 아이콘: `React.ComponentType<...>` 대신 `import { type LucideIcon }` 사용
- AppStore: `currentMissionId` 없음 → 항상 `currentMission?.id`
- React Query v5: `useQuery`에 `onSuccess` 없음 → `useEffect`로 data sync
- SQLite boolean: `is_active` 등은 0/1 정수 → `=== true` 비교 금지
- roleExecutors 경로: `src/services/roleExecutors/` 하위에서 `src/` 루트는 `../../` prefix

**릴리즈**:
```bash
gh release create v5.1.0 "dist-app\OOMNI Setup 5.1.0.exe" --title "v5.1.0" --repo yongal74/oomni
# → https://github.com/yongal74/oomni/releases/download/v5.1.0/OOMNI.Setup.5.1.0.exe
```

**랜딩페이지 404 수정 (2026-05-05)**:
- `docs/index.html`, `landing/index.html` 다운로드 링크 v5.1.0으로 통일
- 교훈: GitHub CLI 업로드 시 공백 → 점 자동 변환 (`OOMNI Setup 5.1.0.exe` → `OOMNI.Setup.5.1.0.exe`)

---

## 다음 버전 계획

---

### ◆ v5.2.0 작업 (2026-05-05) — UI 전면 리디자인

**완료된 작업 (tsc 0 errors 확인)**:

| 코드 | 내용 | 파일 |
|------|------|------|
| P1-1 | ResearchHub 내비게이션/라우팅 제거 (DB/API는 유지) | `AppLayout.tsx`, `router.tsx` |
| P1-2 | Content Bot 2-패널 리디자인: 8개 SNS 채널 선택기 + Export 패널 + 터미널 제거 | `ContentPanel.tsx`, `UnifiedBotPage.tsx` |
| P2-3 | OpsCenter 전면 재작성: T1~T7 필터칩 + 업무별 도메인 + 3-패널 (프로세스/체크리스트/AI채팅+n8n) | `OpsCenter.tsx` |
| P2-4 | GrowthStudio: n8n 워크플로우 템플릿 다운로드 4종 + API 키 연결 구조 가이드 추가 | `GrowthStudio.tsx` |
| P4 | 보안: subscriptions 테이블 스키마 누락 수정 (유료 유저 free 플랜 폴백 버그), V2_DETECTION_TABLES 수정, auth.ts 에러 로깅 개선 | `schema.ts`, `auth.ts` |

**P1-2 Content Bot 상세**:
- `SNS_CHANNELS` 8개: X(280자) / 스레드(500자) / LinkedIn(3000자) / 인스타(2200자) / 유튜브스크립트(5000자) / 네이버블로그(10000자) / 블로그포스트(5000자) / 뉴스레터(3000자)
- `ContentChannelPanel`: 채널별 글쓰기 스타일 편집 + 프롬프트 자동 생성
- `ContentExportPanel`: 결과 복사/다운로드 버튼 (오른쪽 패널 상단)
- `noTerminal` 모드: Content Bot에서 XTerminal 완전 제거

**P2-3 OpsCenter 상세**:
- `AUTO_TYPES` T1~T7: 영업자동화/콘텐츠자동화/리드관리/고객케어/재무자동화/팀협업/리포팅
- `BIZ_DOMAINS` 6개: 재무/세무/인사/IT/법률/운영
- 3-패널: Left(240px 프로세스카드) / Center(번호형 체크리스트 카드) / Right(300px AI채팅+n8n JSON)

**P4 보안 수정 상세**:
```sql
-- subscriptions 테이블 (이전에 누락되어 있었음)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK(plan IN ('free','personal','pro','team')),
  status TEXT NOT NULL CHECK(status IN ('active','canceled','past_due','trialing')) DEFAULT 'active',
  ...
);
```

**미완료 (Phase 3)**:
- Design Bot 리디자인 (Replit 스타일 Claude Design)
- Build Bot 리디자인 (Claude Code 스타일)
- Onboarding UI 개선
- → 별도 논의 필요

---

### ◆ v5.2.0 계획 — AI Lead Generation Bot (Phase 1)

> 상세 스펙: `docs/prd/PRD-v5.2.0-LeadGen.md`

**핵심 플로우**:
```
URL 입력
  → [F-01] URL 인제스션 (상품명/가격/이미지/키워드 추출, 15초 이내)
  → [F-02] CDP 세그먼트 매핑 (신규방문자 / 재구매가능 / 이탈위험 / VIP)
  → [F-03] 세그먼트별 콘텐츠 3종 자동 생성
           텍스트  → Claude Sonnet 4.6
           이미지  → Google Imagen 4 (Gemini API)
           영상    → Google Veo 3.1 Lite (Gemini API)
  → [F-04] SNS 자동 업로드 (인스타 / 유튜브 / 틱톡 / X / 네이버)
  → [F-05] 리드 스코어링 v1 (Hot 70+ / Nurture 40~69 / Cold)
  → [F-06] CDP 동적 루프 (세그먼트 변화 감지 → 리타겟팅 자동 트리거)
```

**개발 태스크**:

| # | 태스크 | 예상 | 상태 |
|---|--------|------|------|
| T01 | DB 스키마 마이그레이션 (growth_leads, sns_connections, growth_content 확장) | 1h | 🔲 |
| T02 | roleExecutors/growth.ts 완성 | 1h | 🔲 |
| T03 | growthIngestionService.ts (URL 크롤링, 뼈대 있음) | 3h | 🔲 |
| T04 | geminiService.ts (Imagen 4 + Veo 3.1, 신규) | 2h | 🔲 |
| T05 | snsPublisherService.ts (OAuth + 업로드, 뼈대 있음) | 6h | 🔲 |
| T06 | leadScoringService.ts (뼈대 있음) | 2h | 🔲 |
| T07 | cdpTriggerService.ts (뼈대 있음) | 2h | 🔲 |
| T08 | growth.ts 라우터 확장 (ingest/publish/trigger 추가) | 2h | 🔲 |
| T09 | GrowthStudio.tsx 전면 개편 | 4h | 🔲 |
| T10 | SnsSettingsPage.tsx (SNS OAuth 연결 관리) | 3h | 🔲 |
| T11 | LeadScoringDashboard.tsx | 2h | 🔲 |
| T12 | tsc --noEmit + 통합 테스트 | 2h | 🔲 |
| T13 | 빌드 + v5.2.0 릴리즈 | 1h | 🔲 |

**신규 환경변수 필요**:
```
GEMINI_API_KEY
INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET
YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET
TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET
```

---

### ◆ v6.0.0 계획 — AI Lead Generation Platform (Phase 2+3)

> 상세 스펙: `docs/prd/PRD-v6.0.0-LeadGen-Platform.md`

**v5.2.0 대비 추가 범위**:

| 영역 | v5.2.0 | v6.0.0 |
|------|--------|--------|
| ID Graph DB | SQLite | **Neo4j 전환** |
| 세그멘테이션 | 기본 4단계 | 예측 모델 (구매확률/이탈점수/LTV) |
| 크롬 익스텐션 | ❌ | **MVP** (상품 페이지 원클릭, LinkedIn 리드 점수) |
| CRM 연동 | ❌ | HubSpot API + 자체 OOMNI CRM |
| 외부 플랫폼 | ❌ | 카페24 / 아임웹 플러그인 |
| n8n | 웹훅만 | 풀 워크플로우 자동화 |
| 멀티링크 허브 | ❌ | 개인별 링크 허브 + 제휴 링크 |

**비즈니스 모델**:

| 플랜 | 가격 | 포함 |
|------|------|------|
| Free | 무료 | 월 10 크레딧 체험 |
| Basic | 29,000원/월 | 200 크레딧 + 3채널 + 리드 스코어링 |
| Standard | 79,000원/월 | 1,000 크레딧 + 전채널 + CDP + CRM |
| Enterprise | 협의 | 무제한 + 커스텀 + AX Clinic 번들 |

---

## 릴리즈 명령 참고

```bash
# 1. 빌드
npm run package
# → dist-app\OOMNI Setup X.X.X.exe (약 120~170MB)

# 2. 커밋 & 푸시
git add docs/index.html landing/index.html
git commit -m "fix: vX.X.X 다운로드 링크 업데이트"
git push

# 3. GitHub Release
# 주의: 공백 → 점 자동 변환 ("OOMNI Setup X.X.X.exe" → "OOMNI.Setup.X.X.X.exe")
gh release create vX.X.X "dist-app\OOMNI Setup X.X.X.exe" --title "vX.X.X" --repo yongal74/oomni

# 4. 빈 릴리즈 삭제
gh release delete vX.X.X --repo yongal74/oomni
```
