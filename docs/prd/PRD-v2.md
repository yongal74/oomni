# OOMNI — PRD v2.0

> "딸깍 하나로 AI 팀이 일한다"
> 작성일: 2026-04-16 | 상태: DRAFT — 검토 중

---

## 1. 제품 개요

### 배경 및 포지셔닝
| | Solo Factory OS | Paperclip | **OOMNI v3** |
|---|---|---|---|
| 대상 | 개발자 | 개발자 | **비개발자 1인 창업자** |
| 실행 | 수동 조작 | 자율 에이전트 | 자율 + 승인 인박스 |
| 세팅 | Firebase + 여러 API키 | CLI 설정 | **API키 1개로 끝** |
| DB | 클라우드 | 없음 | **로컬 SQLite (파일 1개)** |

### 핵심 가치
> "AI 직원을 고용하고, 일 시키고, 보고 받는다. 코딩 없이."

### 타깃 유저
- 1인 창업자 / 솔로 프리랜서
- Claude API 키는 있지만 자동화 세팅은 어려웠던 사람
- n8n, Zapier 세팅에 지쳐본 사람

---

## 2. 기능 범위

### 2-1. Phase 1 (v3.0.0) — 기본 기능 ✅

#### 핵심 흐름
```
온보딩(미션+API키) → 대시보드 → 봇 추가 → 봇 실행 → 결과 확인 → 승인
```

#### 기능 ID 목록

| ID | 기능 | 우선순위 |
|---|---|---|
| DASH-01 | 대시보드 (봇 현황 + 피드 + TODO/DONE) | P0 |
| DASH-02 | 미션 생성 / 선택 | P0 |
| DASH-03 | 봇 추가 모달 (템플릿 선택) | P0 |
| DASH-04 | 승인 인박스 (피드 카드 내 승인/거절) | P0 |
| DASH-05 | 비용 탭 (월별 집계) | P1 |
| DASH-06 | 자동화 스케줄 탭 | P1 |
| DASH-07 | 리포트 탭 | P1 |
| BOT-01 | Research Bot (웹 리서치, 경쟁사 분석, 트렌드 조사) | P0 |
| BOT-02 | Build Bot (코딩, 버그 수정, PR 생성 — PTY 터미널) | P0 |
| BOT-03 | Design Bot (UI/UX — Pencil MCP 연동) | P0 |
| BOT-04 | Content Bot (블로그, 뉴스레터, SNS 콘텐츠) | P0 |
| BOT-05 | Growth Bot (SEO, 광고 카피, 마케팅) | P1 |
| BOT-06 | Ops Bot (운영 모니터링, 재무, 리포트) | P1 |
| BOT-07 | CEO Bot (전체 봇 종합 보고서) | P1 |
| DB-01 | SQLite 단일 파일 DB (C:/oomni-data/oomni.db) | P0 |
| DB-02 | 기존 DB v2.x → v3.0 리셋 안내 + 백업 | P0 |
| INT-01 | Obsidian 아카이브 연동 (선택사항) | P2 |
| SET-01 | 설정 페이지 (Claude API 키, 기타) | P0 |
| ONB-01 | 온보딩 (미션명 + API키 2단계) | P0 |

#### 기능 범위 제외 (Phase 1에서 제거)
| 제거 항목 | 이유 |
|---|---|
| Video / Remotion | PRD 외, 미사용 |
| CDP 세그먼트 | PRD 외, 미완성 |
| 결제 / 구독 (payments, subscriptions) | 미완성, DB 복잡도만 증가 |
| Firebase | Solo Factory OS 잔재, 미사용 |
| DevTools 페이지 | 개발용, 배포 불필요 |
| n8n 봇 코드 (bots/n8n.ts, routes/n8n.ts) | DB에서 이미 제거됨, 파일 잔존 |
| Swagger UI | dev 전용, 번들 크기 증가 |
| Integration Bot | PRD 외, 기능 미완 |

---

### 2-2. Phase 2 (v3.1.0+) — 솔로프리너 딸깍화 🔜

> OOMNI IOE(통합 운영 환경) 완성 단계. v3.0.0 안정화 이후 시작. 개발 중 절대 건드리지 않음.
> 핵심 철학: "아이디어 → 배포" 전 과정을 AI가 자동화한다.

---

#### BOT-08 — ProjectSetup Bot ⭐ (솔로프리너 온보딩 핵심)

> "5가지 질문으로 프로젝트 완전 초기화"

**5가지 질문 플로우:**
```
Q1. 앱 이름이 무엇인가요?
Q2. 형태? (웹 SaaS / 모바일 / 데스크탑)
Q3. AI 기능이 필요한가요?
Q4. 결제가 필요한가요?
Q5. 국내용 / 글로벌?
```

**자동 실행 항목:**
| 작업 | 방법 | 자동화 수준 |
|---|---|---|
| 프로젝트 스캐폴딩 (Next.js 등) | `claude code CLI` → `npx create-next-app` 실행 | ✅ 완전 자동 |
| .env.local 템플릿 생성 | 스택 선택 기반 환경변수 자동 생성 | ✅ 완전 자동 |
| DB 스키마 생성 | PRD 입력 → Claude가 SQL 생성 → Supabase CLI 실행 | ✅ 완전 자동 |
| GitHub 레포 생성 + 초기 push | `gh repo create` + `git push` 자동 실행 | ✅ 완전 자동 |
| Vercel 배포 연결 | `vercel` CLI 자동 실행 | ✅ 완전 자동 |
| shadcn/ui 컴포넌트 설치 | `npx shadcn@latest add [컴포넌트]` 자동 실행 | ✅ 완전 자동 |
| CI/CD (GitHub Actions) | `.github/workflows/*.yml` 자동 생성 | ✅ 완전 자동 |
| Google OAuth Redirect URI | 단계별 안내 + 링크 제공 | ⚠️ 반자동 |
| DNS 설정 | DNS 레코드 값 자동 계산, 설정은 안내 | ⚠️ 반자동 |
| Stripe 계정 인증 | 타임라인 알림만 (외부 심사) | ❌ 안내만 |

---

#### BOT-09 — Env Bot

> "환경변수 통합 관리 — 어디서 받는지부터 등록까지"

- 각 서비스 API 키 발급 위치 단계별 안내
- 입력된 키 값을 `.env.local` + Vercel에 **동시 등록**
- 키 유출 여부 자동 스캔 (GitHub secret scanning 연동)
- `NEXT_PUBLIC_` 잘못 붙인 곳 탐지
- 실행 방식: PTY (Build Bot과 동일)

---

#### BOT-10 — SecurityAudit Bot

> "배포 전 보안 자동 점검"

- RLS(Row Level Security) 정책 생성/검증
- API 키 노출 코드 스캔 (하드코딩된 시크릿 탐지)
- OWASP Top 10 체크리스트 자동 점검
- 의존성 취약점 스캔 (`npm audit`)
- 인증/인가 로직 리뷰
- 실행 방식: PTY (Build Bot과 동일)

---

#### BOT-11 — Build Bot 세분화

| 봇 | 역할 |
|---|---|
| FrontendBot | UI 컴포넌트, Tailwind, shadcn/ui |
| BackendBot | API 라우트, DB 쿼리, 인증 |
| InfraBot | Docker, CI/CD, 환경 설정 |

---

#### OPS-02 — CS 자동화 (Ops Bot 확장)

- 이탈 감지 + 자동 이메일 (Resend/SendGrid 연동)
- MRR 계산 + 세무 일정 알림
- 고객 문의 분류 + 자동 응답 초안

---

#### 솔로프리너 전체 여정 커버리지 (Phase 2 완성 시)

| 업무 | v3.0.0 | v3.1.0+ (Phase 2) |
|---|---|---|
| 시장 리서치 | ✅ Research Bot | 트렌드 리포트 자동 생성 |
| PRD 작성 | ✅ Growth Bot | 린 캔버스 → PRD 자동 변환 |
| 개발 (코딩) | ✅ Build Bot | ProjectSetupBot + Bot 세분화 |
| 디자인 | ✅ Design Bot | 랜딩페이지 컴포넌트 자동 생성 |
| 마케팅 | ✅ Growth Bot | Product Hunt 글 자동 작성 |
| 운영/Ops | ✅ Ops Bot | MRR 계산, 세무 알림 |
| 환경 세팅 | ❌ | ✅ EnvBot + ProjectSetupBot |
| 보안 점검 | ❌ | ✅ SecurityAuditBot |
| 결제 연동 | ❌ | ❌ Phase 2 범위 밖 |
| CS 자동화 | ⚠️ 일부 | ✅ OPS-02 이탈 감지 + 자동 이메일 |

---

#### 기타 Phase 2 항목

| ID | 기능 | 설명 |
|---|---|---|
| INT-02 | n8n 연동 (선택적) | 복잡한 트리거/액션, 외부 서비스 멀티스텝 워크플로우 |
| DASH-09 | Solo Factory OS 템플릿 고도화 | 더 많은 봇 템플릿 조합 |

---

## 3. 데이터 모델 (v3 Clean Schema)

```sql
-- v3.0 확정 테이블 목록 (migration 없음, 초기 생성 시 단일 실행)
missions        — 프로젝트 (id, name, description, created_at)
agents          — 봇 (id, mission_id, name, role, schedule, system_prompt, budget_cents, is_active, reports_to)
heartbeat_runs  — 실행 기록 (id, agent_id, task, status, output, error, tokens_*, cost_usd, started_at, finished_at)
feed_items      — 피드 (id, agent_id, run_id, type, content, requires_approval, approved_at, rejected_at)
cost_events     — 비용 추적 (id, agent_id, run_id, tokens_*, cost_usd)
issues          — 티켓 (id, mission_id, agent_id, title, status, priority, parent_id)
schedules       — 자동화 (id, agent_id, mission_id, trigger_type, trigger_value, is_active)
research_items  — 리서치 결과 (id, mission_id, source_type, title, summary, content, filter_decision)
token_usage     — 토큰 상세 (id, agent_id, mission_id, run_id, input_tokens, output_tokens, cost_usd, model)
sessions        — 세션 토큰 (token, user_id, expires_at)
users           — 사용자 (id, email, role, license_key)
design_systems  — 디자인 시스템 (id, mission_id, preset, colors, fonts)
integrations    — 외부 연동 (id, mission_id, provider, credentials, is_active)

-- 제거 테이블
-- subscriptions  ← payments Phase 2로 이동
-- payment_logs   ← payments Phase 2로 이동
```

### DB 전략 (v3 핵심 규칙)
1. **테이블 RENAME 절대 금지** → FK 오염의 근본 원인
2. **migration은 ADD COLUMN만** → DROP/RENAME은 major 버전업 시 DB 리셋으로만 처리
3. **기존 v2.x DB 감지 시** → Electron dialog로 "v3.0 업그레이드 필요, 기존 DB 백업 후 리셋" 안내

---

## 4. 화면 구조

### 사이드바
```
OOMNI [미션명 ▼]
─────────────────
대시보드
리서치 스튜디오
─────────────────
[봇 목록]
  🔬 Research Bot
  🔨 Build Bot
  ...
─────────────────
설정
```

### 봇 상세 화면 (3열 레이아웃)
```
[왼쪽 패널]  [중앙 패널 - 결과]  [오른쪽 패널 - AI 채팅]
 봇별 컨트롤   스트리밍 출력        task 입력 + 대화
```

---

## 5. 성공 지표

- 온보딩 완료까지 **5분 이내**
- 첫 봇 실행 결과까지 **10분 이내**
- 신규 설치 시 DB 오류 **0건**
- 기존 v2.x 사용자 마이그레이션 실패 **0건** (리셋 안내로 처리)

---

## 6. 확정 결정 사항

| # | 이슈 | 결정 |
|---|---|---|
| OI-01 | Integration Bot | ✅ **제거** (Phase 1 범위 밖) |
| OI-02 | Build Bot 세분화 시점 | ✅ **v3.1 (Phase 2)** — BOT-11 |
| OI-03 | 온보딩 리서치봇 자동 생성 | ✅ **유지** |
| OI-04 | 기존 DB 리셋 방식 | ✅ **자동 백업 + Electron dialog 리셋** |
| OI-05 | CeoBotPage | ✅ **Dashboard에 통합** (별도 페이지 없음) |
| OI-06 | 인증 방식 | ✅ **PIN 전용** (Google OAuth 완전 제거) |
| OI-07 | 결제 연동 | ✅ **Phase 2 범위 밖** |
