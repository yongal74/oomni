# OOMNI — PRD v3.0

> "세팅 고통을 없애는 AI 팀"
> 작성일: 2026-04-18 | 상태: DRAFT
> 기반: PRD v2.0 + 솔로프리너 고통 지도 (Klexi/OOMNI 실전 경험)

---

## 1. 배경 — 왜 v3.0인가

PRD v2.0은 **AI 에이전트 오케스트레이터**를 만드는 것이었다.
PRD v3.0은 거기서 한 단계 더 나아간다.

> "솔로프리너가 아이디어에서 배포까지 막히는 모든 지점을 AI가 대신 해결한다."

v2에서 정의한 BOT-08~11의 구체적 실행 계획이 이 문서다.

---

## 2. 초보자 고통 지도 — 막히는 곳

실제 Klexi/OOMNI 개발과 솔로프리너 경험에서 추출한 고통 지도.
⚡ = 초보자가 가장 자주 포기하는 지점.

| 세팅 항목 | 난이도 | 소요 시간 |
|---|---|---|
| Node.js + Git + VS Code 설치 | ⭐ | 30분 |
| GitHub 계정 + 레포 생성 | ⭐ | 15분 |
| Vercel 가입 + GitHub 연동 | ⭐ | 20분 |
| Anthropic API 키 발급 | ⭐ | 15분 |
| Supabase 계정 + 프로젝트 생성 | ⭐⭐ | 30분 |
| 환경변수 (.env.local) 관리 | ⭐⭐ | 20분 |
| Resend 도메인 인증 (DNS) | ⭐⭐ | 30분 + DNS 반영 24h |
| Vercel 커스텀 도메인 연결 | ⭐⭐ | 30분 |
| Google OAuth 설정 | ⭐⭐⭐ | 1~2시간 ⚡ |
| Supabase RLS 정책 작성 | ⭐⭐⭐ | 1~3시간 ⚡ |
| Firebase Auth 소셜 로그인 설정 | ⭐⭐⭐ | 1~2시간 ⚡ |
| GitHub Actions CI/CD 설정 | ⭐⭐⭐ | 1~2시간 |
| RevenueCat 구독 설정 | ⭐⭐⭐ | 1~2시간 ⚡ |
| Google Play 개발자 계정 | ⭐⭐⭐ | 1~2일 ⚡ |
| Stripe 계정 인증 (신분증) | ⭐⭐⭐⭐ | 1~3일 ⚡ |
| 토스페이먼츠 사업자 심사 | ⭐⭐⭐⭐ | 2~5일 ⚡ |
| Apple Developer 계정 | ⭐⭐⭐⭐ | 며칠 ⚡ |
| Electron 빌드 서명 (코드 서명) | ⭐⭐⭐⭐ | 미정 ⚡ |

### 2-1. TOP 5 고통 포인트 상세

#### ⚡ #1 — Google OAuth `redirect_uri_mismatch`
- **증상**: 구글 로그인 버튼 클릭 시 `redirect_uri_mismatch` 에러
- **원인**: Google Cloud Console 등록 URI와 실제 요청 URI가 한 글자라도 다른 경우. 슬래시 하나, http/https 차이만으로도 발생
- **처음부터 등록해야 할 URI 3개**:
  1. `http://localhost:3000` (로컬 개발)
  2. `https://[프로젝트ID].supabase.co/auth/v1/callback` (Supabase Auth)
  3. `https://내도메인.com/auth/callback` (프로덕션)

#### ⚡ #2 — Supabase RLS "데이터가 안 나온다"
- **증상**: 데이터 넣었는데 조회 시 빈 배열 반환. RLS 켰지만 정책 미설정 → 기본값 "모두 거부"
- **해결**: 테이블당 SELECT/INSERT/UPDATE/DELETE 4개 정책 필수 생성
  ```sql
  ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "select_own" ON todos FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "insert_own" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "update_own" ON todos FOR UPDATE USING (auth.uid() = user_id);
  CREATE POLICY "delete_own" ON todos FOR DELETE USING (auth.uid() = user_id);
  ```

#### ⚡ #3 — 환경변수 `undefined`
- **3대 실수**:
  1. `NEXT_PUBLIC_` 기준 혼동 (서버 전용 키에 붙이거나, 브라우저 키에 안 붙임)
  2. `.env.local` 수정 후 `npm run dev` 재실행 안 함
  3. Vercel에 환경변수 미등록 (`.env.local`은 배포에 자동 반영 안 됨)
- **기준**:
  - `NEXT_PUBLIC_` 붙여야 함: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - 절대 붙이면 안 됨: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`

#### ⚡ #4 — Stripe 심사 지연
- 한국은 사업자 등록증 필수. 심사 1~3일(영업일). 주말 끼면 최대 10일 지연
- **타임라인**: 사업자 등록(0~2일) + Stripe 심사(1~3일) + 토스(2~5일) = 최대 10일
- **결론**: 개발 Day 1에 동시 신청해야 런칭 지연 없음

#### ⚡ #5 — "배포했는데 로컬이랑 다르게 동작"
- **원인 1**: Vercel 환경변수 미설정
- **원인 2**: Node.js 버전 불일치
- **배포 후 체크리스트**:
  - [ ] Vercel 환경변수에 `.env.local` 내용 전부 입력
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` Production 환경 설정 확인
  - [ ] Node.js 버전 로컬 ↔ Vercel 일치 확인
  - [ ] Supabase URL Configuration에 Vercel 도메인 추가
  - [ ] Google OAuth에 Vercel 배포 URL 리디렉션 URI 추가

---

## 3. OOMNI 딸깍화 전략 — 고통 자동화 레벨

| 고통 항목 | 자동화 수준 | 방법 |
|---|---|---|
| 프로젝트 스캐폴딩 (Next.js) | ✅ 완전 자동 | `claude code CLI` → `npx create-next-app` 실행 |
| `.env.local` 템플릿 생성 | ✅ 완전 자동 | 스택 선택 기반 환경변수 템플릿 자동 생성 |
| Supabase 테이블 + RLS 정책 | ✅ 완전 자동 | PRD 입력 → SQL 생성 → Supabase CLI 실행 |
| GitHub 레포 생성 + 초기 push | ✅ 완전 자동 | `gh repo create` + `git push` 자동 실행 |
| Vercel 배포 연결 | ✅ 완전 자동 | `vercel` CLI 자동 실행 |
| shadcn/ui 컴포넌트 설치 | ✅ 완전 자동 | `npx shadcn@latest add [컴포넌트]` 자동 실행 |
| CI/CD (GitHub Actions) | ✅ 완전 자동 | `.github/workflows/*.yml` 자동 생성 |
| Vercel 환경변수 설정 | ✅ 완전 자동 | `vercel env add` 자동 실행 |
| API 키 유출 스캔 | ✅ 완전 자동 | 코드 정적 분석 + GitHub secret scanning |
| `NEXT_PUBLIC_` 잘못 붙인 곳 탐지 | ✅ 완전 자동 | 코드 정적 분석 |
| OWASP Top 10 체크 | ✅ 완전 자동 | npm audit + 정적 분석 |
| RLS 정책 생성/검증 | ✅ 완전 자동 | PRD 기반 SQL 자동 생성 |
| Google OAuth Redirect URI | ⚠️ 반자동 | Google Cloud Console API 제한 → 단계별 안내 + 링크 |
| DNS 설정 | ⚠️ 반자동 | DNS 레코드 값 자동 계산, 설정은 도메인 업체 UI |
| Stripe 계정 인증 | ❌ 불가 | 외부 심사 → 타임라인 알림만 |
| Apple Developer 계정 | ❌ 불가 | 외부 심사 → 안내만 |

---

## 4. 신규 봇 스펙

### BOT-08 — ProjectSetup Bot ⭐ (핵심)

**목적**: "5가지 질문으로 프로젝트 완전 초기화"

**입력 플로우**:
```
Q1. 앱 이름이 무엇인가요?
Q2. 형태? (웹 SaaS / 모바일 앱 / 데스크탑)
Q3. AI 기능이 필요한가요? (Y/N)
Q4. 결제가 필요한가요? (Y/N)
Q5. 국내용 / 글로벌?
```

**자동 실행 작업**:

| 작업 | 실행 방법 | 자동화 수준 |
|---|---|---|
| Next.js 프로젝트 스캐폴딩 | `npx create-next-app@latest` | ✅ 완전 자동 |
| `.env.local` 템플릿 생성 | Q1~5 답변 기반 필요 환경변수 목록 자동 생성 | ✅ 완전 자동 |
| Supabase DB 스키마 생성 | PRD → Claude SQL 생성 → `supabase db push` | ✅ 완전 자동 |
| RLS 정책 생성 | 테이블별 4개 정책 자동 생성 + 적용 | ✅ 완전 자동 |
| GitHub 레포 생성 + 초기 push | `gh repo create` + `git init` + `git push` | ✅ 완전 자동 |
| Vercel 배포 연결 | `vercel` CLI 자동 실행 | ✅ 완전 자동 |
| Vercel 환경변수 등록 | `vercel env add` 일괄 실행 | ✅ 완전 자동 |
| shadcn/ui 설치 | `npx shadcn@latest init` + 기본 컴포넌트 | ✅ 완전 자동 |
| GitHub Actions CI/CD | `.github/workflows/deploy.yml` 자동 생성 | ✅ 완전 자동 |
| Google OAuth Redirect URI | 등록해야 할 URI 목록 생성 + Console 링크 | ⚠️ 반자동 |
| DNS 설정 | 레코드 값 자동 계산 + 도메인 업체 안내 | ⚠️ 반자동 |
| Stripe/토스 심사 타임라인 | 시작일 입력 → 예상 완료일 계산 + 알림 | ⚠️ 반자동 |

**실행 방식**: PTY (Build Bot과 동일, Claude Code CLI subprocess)
**모델**: `claude-sonnet-4-6`
**워크스페이스**: `C:/oomni-data/workspaces/{agentId}/`

---

### BOT-09 — Env Bot

**목적**: "환경변수 통합 관리 — 어디서 받는지부터 등록까지"

**기능**:
1. **API 키 발급 안내**: 서비스별(Supabase/Stripe/Anthropic/Resend 등) 발급 위치 단계별 안내 + 링크
2. **동시 등록**: 입력된 키를 `.env.local` + Vercel 환경변수에 한 번에 등록
3. **유출 스캔**: 코드베이스에서 하드코딩된 시크릿 탐지 (GitHub secret scanning 연동)
4. **`NEXT_PUBLIC_` 오용 탐지**: 서버 전용 키에 붙인 경우, 브라우저 키에 안 붙인 경우 감지

**체크리스트 자동 생성**:
- 스택(Next.js + Supabase + Stripe + Resend 등) 기반 필요한 환경변수 전체 목록 자동 도출
- 미설정 항목 강조 표시
- 로컬/Vercel 불일치 항목 경고

**실행 방식**: PTY (Build Bot과 동일)
**모델**: `claude-sonnet-4-6`

---

### BOT-10 — SecurityAudit Bot

**목적**: "배포 전 보안 자동 점검"

**점검 항목**:

| 점검 | 방법 | 자동화 |
|---|---|---|
| RLS 정책 존재 여부 | Supabase CLI로 테이블별 정책 조회 | ✅ |
| RLS 정책 논리 검증 | `auth.uid() = user_id` 패턴 확인 | ✅ |
| 하드코딩된 시크릿 탐지 | 코드 정적 분석 (API 키 패턴 매칭) | ✅ |
| `NEXT_PUBLIC_` 잘못 붙인 곳 | import/usage 분석 | ✅ |
| OWASP Top 10 체크리스트 | 자동 점검 (SQL Injection, XSS 등) | ✅ |
| 의존성 취약점 | `npm audit` 실행 + 결과 파싱 | ✅ |
| 인증/인가 로직 리뷰 | 미인증 엔드포인트 탐지 | ✅ |

**결과 출력**: 위험도별(HIGH/MEDIUM/LOW) 분류 + 수정 방법 제안
**실행 방식**: PTY (Build Bot과 동일)
**모델**: `claude-sonnet-4-6`

---

### BOT-11 — Build Bot 세분화 (3분할)

현재 Build Bot의 역할을 전문화한다. 기존 Build Bot은 유지하되, 필요 시 전문 봇으로 분기.

| 봇 | 담당 영역 | 주요 도구 |
|---|---|---|
| **FrontendBot** | UI 컴포넌트, Tailwind, shadcn/ui, 반응형 | React, shadcn, Tailwind |
| **BackendBot** | API 라우트, DB 쿼리, 인증, 서버 로직 | Next.js API Routes, Supabase, Prisma |
| **InfraBot** | Docker, CI/CD, 환경 설정, 배포 파이프라인 | GitHub Actions, Vercel CLI, Docker |

**실행 방식**: PTY (기존 Build Bot과 동일)
**모델**: `claude-sonnet-4-6`

---

## 5. 전체 여정 커버리지

| 업무 단계 | v3.0.x (현재) | v3.1.0+ (Phase 2) |
|---|---|---|
| 시장 리서치 | ✅ Research Bot | 트렌드 리포트 자동 생성 |
| PRD 작성 | ✅ Growth Bot | 린 캔버스 → PRD 자동 변환 |
| **프로젝트 초기화** | ❌ | ✅ ProjectSetup Bot |
| **환경 세팅** | ❌ | ✅ Env Bot |
| 개발 (코딩) | ✅ Build Bot | ✅ Bot 세분화 (BOT-11) |
| 디자인 | ✅ Design Bot (Pencil MCP) | 랜딩페이지 컴포넌트 자동 생성 |
| **보안 점검** | ❌ | ✅ SecurityAudit Bot |
| 마케팅 | ✅ Growth Bot | Product Hunt 글 자동 작성 |
| 운영/Ops | ✅ Ops Bot | MRR 계산, 세무 알림 (OPS-02) |
| CS 자동화 | ⚠️ 일부 | ✅ 이탈 감지 + 자동 이메일 |
| 결제 연동 | ❌ | ❌ Phase 3 이후 |

---

## 6. Feature ID 추가 등록

> `docs/standards/feature-ids.md` 동기화 필요

| ID | 기능 | Phase |
|---|---|---|
| BOT-08 | ProjectSetup Bot | 2 |
| BOT-09 | Env Bot | 2 |
| BOT-10 | SecurityAudit Bot | 2 |
| BOT-11 | Build Bot 세분화 (Frontend/Backend/Infra) | 2 |
| OPS-02 | CS 자동화 (이탈감지 + 자동이메일 + MRR) | 2 |

---

## 7. 개발 우선순위 (Phase 2 착수 기준)

v3.0.x 안정화 완료 후 아래 순서로 착수.

```
1순위: BOT-08 ProjectSetup Bot  — 가장 큰 고통 해결, 차별점 최대
2순위: BOT-09 Env Bot           — ProjectSetup Bot과 연계 필수
3순위: BOT-10 SecurityAudit Bot — 배포 전 체크 자동화, 독립 실행 가능
4순위: BOT-11 Build Bot 세분화  — 기존 Build Bot 확장, 마지막
```

**현재 버전**: v3.0.5
**Phase 2 착수 기준**: v3.0.x 안정화 + 기존 7개 봇 E2E 검증 완료

---

## 8. 기술 스택 (Phase 2 신규 의존성)

| 패키지 | 용도 | 설치 위치 |
|---|---|---|
| `@supabase/supabase-js` | Supabase CLI 연동 | backend |
| `gh` CLI | GitHub 레포 생성 | 시스템 (pre-installed 가정) |
| `vercel` CLI | Vercel 배포 자동화 | 시스템 (pre-installed 가정) |

> **원칙**: 신규 npm 패키지는 최소화. Claude Code CLI subprocess로 시스템 CLI 직접 실행.

---

## 9. 확정 결정 사항

| # | 이슈 | 결정 |
|---|---|---|
| OI-08 | ProjectSetup Bot 실행 방식 | ✅ PTY (Claude Code CLI subprocess) — Build Bot과 동일 |
| OI-09 | Env Bot 저장 위치 | ✅ `.env.local` 직접 쓰기 + Vercel CLI 연동 |
| OI-10 | SecurityAudit Bot 결과 형식 | ✅ HIGH/MEDIUM/LOW 위험도 분류 + 수정 방법 포함 |
| OI-11 | Build Bot 세분화 방식 | ✅ 기존 Build Bot 유지 + 전문 봇 선택 추가 (대체 아님) |
| OI-12 | 결제 자동화 (Stripe/토스) | ✅ Phase 2 범위 밖 — 타임라인 알림만 |

---

*PRD v3.0 — 2026-04-18 작성*
*참고 문서: PRD-v2.md, WBS-v3.0.0.md, docs/standards/feature-ids.md*
