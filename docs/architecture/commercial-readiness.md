# OOMNI v3.0.0 — 상업적 판매 준비도 분석

> 기준: v2.9.21 코드베이스 전수 조사
> 작성: 2026-04-16 | 상태: DRAFT

범례: 🟢 양호 | 🟡 보완 필요 | 🔴 심각 (출시 전 필수 수정)

---

## 안정성 기준 — IDE 수준

> "OOMNI는 VS Code / Cursor 수준의 안정성을 가져야 한다"

| 기준 | 요구사항 |
|---|---|
| **절대 crash 없음** | React Error Boundary 전체 앱 + 봇 패널별 적용 |
| **봇 실행 중 UI 응답** | 스트리밍 중에도 사이드바/메뉴 즉시 반응 |
| **상태 지속성** | 재시작 후 마지막 미션/봇 상태 복원 |
| **에러 격리** | 한 봇 오류가 다른 봇/대시보드에 영향 없음 |
| **빠른 시작** | Electron 앱 로드 < 3초 (cold start) |
| **메모리 누수 없음** | PTY 세션 종료 시 완전 정리, 스트림 cleanup |

---

## 요약 점수

| 영역 | 점수 | 비고 |
|---|---|---|
| 보안 | 🟡 65/100 | Firebase OAuth 제거 후 단순화 필요 |
| 안정성 | 🟡 60/100 | DB 재작성 + Error Boundary 추가 후 목표 90+ |
| 테스트 커버리지 | 🟡 55/100 | 백엔드 테스트 있음, 프론트엔드 미흡 |
| 성능 | 🟡 70/100 | Remotion 제거 후 번들 크기 대폭 감소 |
| 기술부채 | 🔴 40/100 | DB 마이그레이션 누적, 삭제 대상 14개 잔존 |
| UX/온보딩 | 🟡 65/100 | God Component 분리 + 아이콘 메뉴 교체 필요 |
| 유지보수성 | 🟡 60/100 | 문서화 진행 중, 규칙 체계 신규 구축 |

---

## 1. 유지 (KEEP) — 잘 된 것들

### ✅ 보안 기반

| 항목 | 현황 | 비고 |
|---|---|---|
| API 키 암호화 | AES-256-GCM + scrypt KDF | `crypto/vault.ts` — 상용 수준 |
| CORS 정책 | file:// + localhost 전용 | 외부 접근 원천 차단 |
| Helmet CSP | 적용됨 | Firebase 도메인 화이트리스트 |
| Rate Limiting | 120req/min 전역, 20req/min 봇 실행 | `express-rate-limit` |
| 내부 API 키 | IPC로만 주입, .env 노출 없음 | Electron preload 패턴 |

### ✅ 아키텍처 강점

| 항목 | 현황 |
|---|---|
| 완전 로컬 동작 | SQLite 단일 파일, 클라우드 의존 없음 |
| Auto-Updater | electron-updater + GitHub Release 연동 완료 |
| 라이선스 체크 | `/api/auth/license/status` 엔드포인트 존재 |
| Winston 로깅 | 구조화 로깅 적용 |
| Zod 검증 | API 입력 검증 라이브러리 존재 |
| WAL 모드 | SQLite 동시성 성능 최적화 |
| 테스트 프레임워크 | Jest + supertest (백엔드), Vitest (프론트) 설정됨 |

### ✅ 기존 테스트 자산 (16개 파일)

```
backend/tests/
  api/agents.test.ts       (135줄) ← 유지
  api/issues.test.ts       (118줄) ← 유지
  api/reports.test.ts      (104줄) ← 유지
  api/research.test.ts     (270줄) ← 유지
  api/schedules.test.ts    (102줄) ← 유지
  api/webhooks.test.ts     (109줄) ← 유지
  agents/chain-trigger.test.ts (112줄) ← 유지
  agents/heartbeat.test.ts (121줄) ← 유지
  agents/runner.test.ts    (93줄) ← 유지
  crypto/vault.test.ts     (62줄) ← 유지
  db/schema.test.ts        (53줄) ← 수정 필요 (v3 스키마 반영)
  services/base.test.ts    (44줄) ← 유지
  services/claudeCodeService.test.ts (439줄) ← 유지

  ← 삭제 대상:
  bots/integration-bot.test.ts (92줄)
  bots/n8n-bot.test.ts     (113줄)
  services/videoService.test.ts (256줄)
```

---

## 2. 제거 (DELETE) — 기술부채 & 위험 요소

### 🔴 보안 위험: Firebase OAuth 팝업 설정

```javascript
// electron/main.js — 심각한 보안 설정
authWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: false,  // ❌ Node.js API 노출
    webSecurity: false,       // ❌ Same-Origin Policy 비활성화
  }
})
```

**위험도**: 높음. 팝업이 악성 redirect로 조작될 경우 Node.js 접근 가능.
**해결**: PIN 인증으로 전환하면 이 코드 블록 완전 제거.

### 🔴 Firebase 의존성 전체 (v3.0.0 제거 대상)

| 패키지 | 위치 | 줄수 | 영향 |
|---|---|---|---|
| `firebase-admin` 13.7.0 | backend | — | `middleware/requireAuth.ts` 244줄 전체 |
| `passport` 0.7.0 | backend | — | OAuth flow |
| `passport-google-oauth20` | backend | — | Google 로그인 |
| `firebase` 12.11.0 | frontend | — | `lib/firebase.ts` |
| `api/routes/auth.ts` | backend | 715줄 | Google OAuth + 세션 전체 |

**v3.0.0 영향**: 위 5개 제거 후 번들 크기 ~40% 감소 예상, 보안 위험 제거.

### 🔴 Remotion 의존성 (video 기능 제거 대상)

| 패키지 | 위치 | 크기 |
|---|---|---|
| `remotion` 4.0.445 | backend | 매우 큰 패키지 |
| `@remotion/bundler` | backend | 매우 큰 패키지 |
| `@remotion/renderer` | backend | 매우 큰 패키지 |
| `remotion` 4.0.448 | frontend | — |
| `@remotion/player` | frontend | — |

**v3.0.0 영향**: 제거 시 설치 파일 크기 대폭 감소. `video.ts`, `videoService.ts` 삭제 시 함께 제거 필수.

### 🟡 기타 제거 대상 패키지

```json
// backend/package.json에서 제거 필요
"swagger-jsdoc": "6.2.8",        // swagger 삭제와 함께
"swagger-ui-express": "5.0.1",   // swagger 삭제와 함께
"passport": "0.7.0",             // Firebase 제거와 함께
"passport-google-oauth20": "...",// Firebase 제거와 함께
"firebase-admin": "...",         // Firebase 제거와 함께
"remotion": "...",               // video 기능 제거와 함께
"@remotion/bundler": "...",
"@remotion/renderer": "..."

// frontend/package.json에서 제거 필요
"firebase": "12.11.0",           // Firebase 제거와 함께
"remotion": "...",
"@remotion/player": "..."
```

### 🟡 .env.example 잔재 정리 필요

```bash
# 제거 필요 (v3.0.0에서 미사용)
DB_PORT=5433           # PostgreSQL 잔재 — SQLite 사용 중
DB_NAME=oomni          # PostgreSQL 잔재
GOOGLE_SERVICE_ACCOUNT_PATH=...  # Firebase 제거와 함께
FIREBASE_PROJECT_ID=...          # Firebase 제거와 함께
```

---

## 3. 추가 (ADD) — 상업적 판매 필수 항목

### ✅ 사이드바 아이콘 메뉴 — 이미 구현됨 (v2.9.1x~)

`AppLayout.tsx`에 Antigravity 스타일 아이콘 사이드바 완전 구현 확인:
- `lucide-react` 아이콘 (Telescope, Code2, Palette, BookOpen, TrendingUp, Workflow, Crown...)
- 봇 역할별 색상 (`text-sky-400`, `text-orange-400`, `text-purple-400`...)
- 툴팁 포함 아이콘 버튼 (`IconBtn` 컴포넌트)

→ **v3.0.0에서 추가 작업 불필요**. DevTools/CeoBot 항목 제거만 하면 됨.



### 🔴 프론트엔드 Error Boundary 없음 (IDE 수준 안정성 필수)

현재 **React Error Boundary가 없음** → 컴포넌트 렌더링 오류 시 전체 화면 흰 화면 crash.

```tsx
// 추가 필요: frontend/src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  // 전체 앱 + 각 봇 패널에 적용
}
```

**우선순위**: 높음. 고객 이탈 직결.

### 🔴 Growth / Ops Executor 미완성 (47줄)

```
services/roleExecutors/growth.ts  — 47줄 (스텁 수준)
services/roleExecutors/ops.ts     — 47줄 (스텁 수준)
services/roleExecutors/ceo.ts     — 74줄 (최소 구현)
```

PRD에서 핵심 봇으로 명시되었으나 구현이 매우 얕음. 상업적 판매 전 기능 충실화 필요.

### 🟡 DB 스키마 v3.0.0 수정 필요

```sql
-- agents 테이블 role CHECK (현재)
CHECK(role IN ('research','build','design','content','growth','ops','integration','ceo'))
-- v3.0.0에서 integration 제거 필요
CHECK(role IN ('research','build','design','content','growth','ops','ceo'))

-- 제거 필요 (현재 schema.ts에 포함됨)
subscriptions 테이블 → Phase 2, SCHEMA_SQL에서 제거
payment_logs 테이블 → Phase 2, SCHEMA_SQL에서 제거
```

### 🟡 테스트 추가 필요 항목

| 테스트 | 현황 | 우선순위 |
|---|---|---|
| DB 재작성 후 schema.test.ts 업데이트 | 수정 필요 | 높음 |
| UnifiedBotPage 렌더링 테스트 | 없음 | 중간 |
| PtyBotPage 렌더링 테스트 | 없음 | 중간 |
| PIN 인증 테스트 | 없음 (OAuth 테스트만) | 높음 |
| lineBuffer 스트리밍 파싱 단위 테스트 | 없음 | 높음 |
| v2.x DB 감지 + 리셋 다이얼로그 테스트 | 없음 | 높음 |

### 🟡 성능 최적화 필요 항목

| 항목 | 현황 | 개선 방안 |
|---|---|---|
| BotDetailPage 1436줄 | 전체 리렌더링 잦음 | Phase 4 분리로 해결 |
| DashboardPage 893줄 | 큰 컴포넌트 | React.memo + useMemo 적용 |
| SettingsPage 884줄 | 큰 컴포넌트 | 탭별 Lazy loading |
| SQLite 쿼리 | index 있으나 N+1 가능성 | 주요 리스트 쿼리 점검 |
| Electron 번들 크기 | Remotion 포함 시 매우 큼 | Remotion 제거 후 측정 |

---

## 4. 상업적 판매 핵심 이슈 체크리스트

### 🔴 출시 전 필수 (Blocking)

| # | 이슈 | 관련 Phase |
|---|---|---|
| C-01 | Firebase `contextIsolation:false` 보안 취약점 제거 | Phase 2 |
| C-02 | DB 레이어 재작성 (신규 설치 오류 0건) | Phase 1 |
| C-03 | Growth/Ops Executor 기능 충실화 | Phase 6 |
| C-04 | React Error Boundary 추가 | Phase 4 |
| C-05 | Remotion 패키지 완전 제거 (설치파일 크기) | Phase 0 |
| C-06 | v2.x → v3.0 DB 리셋 다이얼로그 | Phase 1 |

### 🟡 출시 후 단기 개선 (Non-blocking)

| # | 이슈 | 영향 |
|---|---|---|
| C-07 | lineBuffer 스트리밍 단위 테스트 추가 | 회귀 방지 |
| C-08 | PIN 인증 테스트 추가 | 회귀 방지 |
| C-09 | .env.example PostgreSQL 잔재 제거 | 혼란 방지 |
| C-10 | DashboardPage React.memo 최적화 | UX 개선 |
| C-11 | db/schema.test.ts v3 스키마 반영 | 테스트 신뢰도 |
| C-12 | 삭제 대상 테스트 파일 3개 제거 | 테스트 혼란 방지 |

### 🟢 이미 잘 된 것 (유지)

| # | 항목 |
|---|---|
| C-13 | AES-256-GCM API 키 암호화 (vault.ts) |
| C-14 | Auto-Updater GitHub Release 연동 |
| C-15 | Rate Limiting 적용 |
| C-16 | CORS localhost 전용 |
| C-17 | Winston 구조화 로깅 |
| C-18 | Zod 입력 검증 |
| C-19 | 라이선스 체크 엔드포인트 |
| C-20 | 백엔드 통합 테스트 13개 존재 |

---

## 5. 번들 크기 예측

| 상태 | 예상 설치파일 크기 |
|---|---|
| 현재 (v2.9.21, Remotion 포함) | ~400MB+ |
| Remotion 제거 후 | ~150MB 예상 |
| Firebase 패키지 제거 후 | ~120MB 예상 |
| v3.0.0 목표 | **< 150MB** |

> Electron 앱 특성상 Node.js 런타임 포함으로 최소 100MB 이상. Remotion 제거가 가장 큰 효과.

---

## 6. 권장 작업 순서 (상업적 판매 최우선)

```
1. Phase 0  : 14개 삭제 (Remotion 의존성 포함) → 번들 크기 즉시 감소
2. Phase 1  : DB 재작성 → 신규 설치 안정성 확보 (C-02, C-06)
3. Phase 2  : PIN 인증 → Firebase 보안 위험 제거 (C-01)
4. Phase 4  : BotDetailPage 분리 + Error Boundary 추가 (C-04)
5. Phase 5  : 우측 패널 AI 수정 → 핵심 기능 동작 검증
6. Phase 6  : Growth/Ops Executor 충실화 (C-03)
7. Phase 8  : 패키지 + 릴리즈
```
