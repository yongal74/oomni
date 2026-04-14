# OOMNI 개발 워크플로우 규칙

## 필수 개발 원칙 (매 세션, 매 작업 적용)

### 1. TaskCreate — 시작 전 전체 항목 등록 (MANDATORY)
- 작업 시작 전 **반드시** TaskCreate로 모든 항목을 등록한다
- 작업 시작 시 → TaskUpdate status: in_progress
- 작업 완료 시 → TaskUpdate status: completed
- 커밋 전 → TaskList로 완료 여부 대조 확인 후 커밋
- **절대 task 없이 코드 작성 금지**

### 2. TDD 방법론 (Test-Driven Development)
- 코드 작성 전 테스트 먼저 작성 (Red → Green → Refactor)
- 백엔드: `backend/tests/` 아래 unit/integration 테스트
- 프론트엔드: `frontend/src/__tests__/` 아래 테스트
- 모든 새 기능 → 테스트 파일 함께 커밋
- 테스트 실패 상태로 커밋 금지

### 3. 병렬 개발 (Parallel Agents)
- 독립적인 작업(frontend/backend/테스트)은 Agent tool로 병렬 실행
- isolation: "worktree" 옵션으로 충돌 방지
- 배경 실행: run_in_background: true 적극 활용

### 4. 커밋 규칙
- 커밋 전 체크리스트:
  - [ ] TaskList 조회 → 해당 task completed 확인
  - [ ] 테스트 통과 확인 (`npm test`)
  - [ ] 타입 오류 없음 확인 (`tsc --noEmit`)
- 커밋 후: 버전 변경 시 push + GitHub Release + 랜딩페이지 업데이트

### 5. 버전 관리
- 버그 수정: x.x.X (patch)
- 기능 추가: x.X.0 (minor)
- 상용화 전환: X.0.0 (major)
- 현재 버전: **v2.9.14**

## 프로젝트 컨텍스트
OOMNI는 솔로 창업자를 위한 AI 에이전트 자동화 플랫폼입니다.
각 봇은 특정 역할을 수행하고, 결과물은 다음 봇으로 전달됩니다.

## 아키텍처
- frontend: Vite + React + TypeScript (port 5173 dev / 5174 prod)
- backend: Express + TypeScript + SQLite better-sqlite3 (port 3001)
- electron: main.js → backend in-process 실행 (`require(backend/dist/index.js)`)
- WebSocket: `/ws` (피드 브로드캐스트) + `/api/agents/:id/terminal` (PTY 터미널)
- 빌드 출력: `dist-app/OOMNI Setup X.X.X.exe`

## 중요 주의사항

### 프로젝트 구분
- **소스**: `C:\Users\장우경\oomni` ← 여기만 수정
- **설치 앱**: `C:\진짜OOMNI` ← 바이너리, 수정 금지
- **별개 프로젝트**: `C:\Users\장우경\solo-factory-os` ← OOMNI와 무관, 혼동 금지

### WebSocket 구조 (v2.9.3~)
- `OomniWebSocketServer`: `noServer: true` + `/ws` 경로만 직접 `handleUpgrade` 처리
- `attachPtyWebSocket`: `/api/agents/:id/terminal` 경로 처리
- **절대로** `{ server, path }` 옵션으로 WebSocketServer 생성 금지 → 다른 경로 소켓 파괴

### Design Bot UI (v2.9.8~)
- **좌측 패널 제거** — 더 넓은 작업 공간
- **ResizableSplit**: 상단(디자인 미리보기) + 하단(터미널) 드래그로 크기 조절
  - `ResizableSplit` 컴포넌트 BotDetailPage 내부에 인라인 정의 (별도 파일 아님)
- **Pencil 강제 시작 버튼**: 미리보기 툴바에 위치, `designTerminalRef.current?.send('claude --dangerously-skip-permissions')` 주입
- **하단 채팅 입력 제거** — 터미널에서 직접 명령 입력
- **우측 빠른실행 → 터미널 주입**: `onSkillSelect=(s) => designTerminalRef.current?.send(s)`
- `pencilModeEnabled` state 제거됨 (v2.9.8에서 단일 터미널 모드로 통합)

### Build Bot UI (v2.9.8~)
- **ResizableSplit**: 상단(코드 에디터) + 하단(터미널) 드래그로 크기 조절
- **하단 채팅 입력 제거** — 터미널에서 직접 명령 입력
- **우측 빠른실행 → 터미널 주입**: `onSkillSelect=(s) => terminalRef.current?.send(s)`
- `terminalRef`: `useRef<XTerminalRef>(null)`, `designTerminalRef`: `useRef<XTerminalRef>(null)`

### XTerminal forwardRef (v2.9.8~)
- `XTerminalRef` interface: `send(text: string): void`, `focus(): void`
- `send()`: `ws.send(JSON.stringify({ type: 'input', data: text + '\r' }))` — Enter 포함 자동 주입
- `forwardRef`로 export, 부모에서 `ref.current?.send(text)` 호출 가능
- **주의**: Design/Build 봇의 "빠른실행" 버튼은 이제 모두 terminalRef.send()로 처리

### 우측 채팅 패널 — AntigravityRightPanel (v2.9.12~, Streamable HTTP)
- **위치**: `BotDetailPage.tsx` → `AntigravityRightPanel` 컴포넌트 (Research/Content/Growth/Ops/CEO 봇 공통)
- **아키텍처**: SSE(EventSource) → **Streamable HTTP(fetch + ReadableStream)** 완전 전환 (v2.9.12)
  - 엔드포인트: `POST /api/agents/:id/chat` (백엔드 `agents.ts` 추가)
  - Auth: `Authorization: Bearer {token}` 헤더 (기존 URL 쿼리 파라미터 방식 폐기)
  - `response.body.getReader()` + JSON 라인 파싱으로 청크 수신
- **forwardRef + useImperativeHandle**: `AntigravityRightPanelRef.runTask(prompt)` 외부 호출 가능
  - `UnifiedTerminalLayout`에서 `rightPanelRef` prop으로 전달
  - 스킬 버튼 클릭 시 `unifiedRightPanelRef.current?.runTask(prompt)` 호출
- **자체 상태 관리** (props 의존 제거):
  - `task`, `isChatRunning`, `chatHistory`, `pendingUserMsg`, `streamOutput`, `abortRef` 모두 내부 state
  - `chatHistory: ChatPair[]` — 완료된 대화 쌍 누적
- **UI 구조**: 상단 채팅 히스토리 + 하단 입력창
  - 사용자 메시지: 우측 정렬 박스
  - AI 응답: 좌측 pre 텍스트 전체 스트리밍 표시
- **중요**: `LiveStreamDrawer`는 Integration/Generic 봇에만 유지, 통합 봇에서는 완전 제거

### XTerminal isRunning 의존성 제거 (v2.9.12~)
- **버그**: `alwaysOn=true` 모드에서 채팅 Enter 시 `isRunning` 상태 변경 → WebSocket 재연결 → 터미널도 반응
- **수정**: `useEffect` 의존성 배열에서 `isRunning` 제거
  - Before: `}, [isRunning, alwaysOn, agentId, shellMode])`
  - After: `}, [alwaysOn, agentId, shellMode])`
- **절대 다시 추가하지 말 것**: `isRunning`을 WebSocket 연결 useEffect deps에 넣으면 채팅/터미널 동시 활성화 버그 재발

### N8N 봇 완전 제거 (v2.9.12~)
- **v2.9.11 미완**: `N8nPage.tsx` 파일만 삭제, DB에 n8n agent는 남아있어 sidebar에 계속 표시됨
- **v2.9.12 완전 수정**:
  - DB migration v7: `UPDATE SET role='ops'` → `DELETE FROM agents WHERE role='n8n'`
  - DB migration v8 추가: `DELETE FROM agents WHERE name LIKE '%n8n%'` (v7으로 이미 변환된 잔재 제거)
- **주의**: OpsPanel 내부 N8N 연동 기능(`OpsPanel.tsx`)은 유지 — 페이지만 제거

### 대시보드 비용 탭 (v2.9.12~)
- **버그**: `(costData?.data ?? []).map()` → 백엔드가 배열이 아닌 객체 `{by_agent:[...], total_cost_usd:...}` 반환
- **수정**: `const byAgent = (costData?.data as any)?.by_agent ?? []` 사용
- row 필드: `agent_name`, `run_count`, `cost_usd`, `input_tokens`, `output_tokens`

### Build/Design Bot 터미널 (v2.9.7~) — Antigravity IDE 스타일
- **alwaysOn** prop: 페이지 마운트 즉시 WebSocket 연결 (isRunning 무관)
- **shellMode** prop: `powershell.exe` (Windows) / `/bin/bash` (Linux/Mac) 직접 실행
- WebSocket URL: `/api/agents/:id/terminal?cols=&rows=&mode=shell`
- 사용자가 직접 `claude --dangerously-skip-permissions` 입력으로 Claude Code 실행
- **이전 방식(Claude Code 자동 spawn)은 exit code 1 유발** → shellMode로 완전 전환

### DB agents_v5 repair (v2.9.8 완전 수정)
- **근본 원인**: SCHEMA_SQL(`CREATE TABLE IF NOT EXISTS agents`)이 repair 전에 실행 → 빈 `agents` 생성 → repair가 데이터 있는 `agents_v5`를 단순 삭제
- **v2.9.8 수정**: repair 로직을 `db.exec(SCHEMA_SQL)` 호출 **전**으로 이동
  - Case A: `agents_v5` 있고 `agents` 없음 → `AGENTS_TABLE_SQL`로 테이블 생성 + 데이터 복사 + drop
  - Case B1: 둘 다 있고 `agents`가 비어있음 + `agents_v5`에 데이터 → 복사 후 drop
  - Case B2: `agents`에 데이터 있음 → `agents_v5` 잔재만 삭제
- `AGENTS_TABLE_SQL` 상수로 분리 (재사용 가능)

### CEO Bot 모델 (v2.9.8~)
- `CEO_MODEL = 'claude-opus-4-6'` → **`DEFAULT_MODEL = 'claude-sonnet-4-6'`** 으로 변경
- 이유: API 키에 따라 Opus 접근 불가 케이스 존재 → Sonnet으로 통일

### Research Bot SEO 채점 (v2.9.8~)
- **신호강도 0-100**: 콘텐츠(60%) + SEO(40%) 기준
  - 콘텐츠: 시장성(20) + 시의성(20) + 자동화가능성(15) + 콘텐츠확장성(15)
  - SEO: 검색의도(10) + 퍼스트무버(10) + CPC(10) + 경쟁도(5) + AIWX적합도(5)
- **계층별 소스**: 🔴실시간(Google Trends/X트렌딩/YouTube급상승/Reddit r/trending) / 🟡중기(Product Hunt/HN/TechCrunch) / 🟢니치(Quora/Google연관검색)
- **ITEM 블록 필드**: `seo_volume`, `seo_kd`, `seo_cpc`, `first_mover` 추가
- `first_mover: true` → `🔴퍼스트무버` 태그 자동 추가

### AIWX 블로그 포스트 기능 (v2.9.8~)
- **엔드포인트**: `POST /api/research/aiwx-post`
- **파라미터**: `{ item_id?, book_num?: 1-7, publish?: boolean }`
- **7권 책**: 철학이 필요한 시간/나는 누구인가/경계에서/자유롭다는 것/보이지 않는 것을 보는 법/우리는 무엇으로 사는가/인간이란 무엇인가
- **저장 경로**: `C:/oomni-data/research/aiwx-posts/aiwx-post_{date}_{slug}.md`
- **발행**: `python C:/GGAdsense/publish_post.py {filePath}` (60s timeout)
- **UI**: `AiwxPostPanel` 컴포넌트 (ResearchPanel 우측) — 책 선택 + 생성 + 발행 버튼

### CEO 봇 role CHECK constraint (v2.9.6 수정 완료)
- DB schema migration v6: agents 테이블에 `ceo` role CHECK constraint 추가
- **v2.9.5 버그**: migration v6가 `foreign_keys=ON` 상태에서 실패 반복
- **v2.9.6 수정**: `runMigrations()` 전후 `foreign_keys=OFF/ON` 래핑 → migration v6 정상 실행

### Reports API 버그 (v2.9.6 수정 완료)
- **버그**: `reports.ts`의 에이전트 목록 쿼리에서 `WHERE a.mission_id = ?` — 테이블 alias `a` 없이 사용 → `no such column: a.mission_id`
- **수정**: `WHERE mission_id = ?` 로 alias 제거

### Schedules FK 오류 (v2.9.6 수정 완료)
- **버그**: `POST /api/schedules`에서 존재하지 않는 `agent_id`로 INSERT 시 FOREIGN KEY 제약 오류
- **수정**: INSERT 전 `agent_id` 존재 여부 확인 로직 추가 (404 반환)

### Pencil MCP 경로 (v2.9.6 수정 완료)
- **버그**: Pencil MCP 서버 경로를 `~/.antigravity/extensions`에서 탐색 → 현재 설치 경로 불일치
- **수정**: `~/.gemini/antigravity/extensions`로 변경 (4개 파일: claudeCodeService, ptyService, runner, agents route)

### 봇간 산출물 전달 (v2.9.5~)
- XTerminal에 `onOutputCapture` prop 추가
- PTY 출력에서 ANSI 이스케이프 코드 제거 후 누적 텍스트를 상위 컴포넌트로 전달
- BotDetailPage에서 이전 봇 결과물을 다음 봇 초기 컨텍스트로 주입 가능

### CEO/봇 추가 이슈 방지
- Zustand `persist`로 `currentMission`이 localStorage에 저장됨
- 신규 설치 후 stale mission ID 문제 → `DashboardPage`에서 `missionsData` 로드 후 검증 로직 존재
- `POST /api/agents`에서 mission 존재 여부 사전 확인 로직 존재

## 데이터 저장 위치
- DB: `C:/oomni-data/oomni.db`
- 워크스페이스: `C:/oomni-data/workspaces/{agentId}/`
- 스킬: `C:/oomni-data/.claude/commands/`
- 리서치 결과: `C:/oomni-data/research/`
- 디자인 결과: `C:/oomni-data/design/`
- 리포트: `C:/oomni-data/reports/`

## 봇 파이프라인
Research → Content → Build → Design → Growth → Ops → CEO

## 봇 역할별 실행 방식
| 봇 | 실행 방식 | 하단 입력 | 우측 패널 | 비고 |
|----|-----------|-----------|-----------|------|
| Research | Streamable HTTP (fetch POST /chat) | ✅ 채팅 입력 | AntigravityRightPanel (자체 스트리밍) | 리서치 결과 스트리밍 |
| Content | Streamable HTTP (fetch POST /chat) | ✅ 채팅 입력 | AntigravityRightPanel (자체 스트리밍) | Research 결과 본문 포함 |
| Build | PTY (XTerminal, ResizableSplit) | ❌ 터미널 직접 입력 | BuildRightPanel | 코드에디터(위)+터미널(아래) |
| Design | PTY (XTerminal, ResizableSplit) | ❌ 터미널 직접 입력 | DesignRightPanel | 미리보기(위)+터미널(아래), 좌측패널 없음 |
| Growth | Streamable HTTP (fetch POST /chat) | ✅ 채팅 입력 | AntigravityRightPanel (자체 스트리밍) | 탭별 키워드 필터링 |
| Ops | Streamable HTTP (fetch POST /chat) | ✅ 채팅 입력 | AntigravityRightPanel (자체 스트리밍) | N8N 연동 기능은 OpsPanel 내부에 유지 |
| CEO | Streamable HTTP (fetch POST /chat) | ✅ 채팅 입력 | AntigravityRightPanel (자체 스트리밍) | 탭별 키워드 필터링 |

## 코드 작성 원칙
1. 모든 결과물은 반드시 파일로 저장
2. 파일명에는 날짜(YYYY-MM-DD) 포함
3. 한국어로 결과물 작성 (코드 제외)
4. 각 단계 완료 시 간략한 완료 메시지 출력
5. 에러 발생 시 원인과 대안 명시

### AntigravityRightPanel 채팅 인증 구조 (v2.9.14~) — 절대 변경 금지
- **POST /api/agents/:id/chat 는 인증 미들웨어 예외 처리됨** (`app.ts` isPublicPath에 포함)
- 이전 v2.9.13에서 라우터 핸들러 내부만 수정하고 전역 미들웨어(`app.ts`)를 빠뜨려 401 지속됨
- **전역 미들웨어 위치**: `backend/src/api/app.ts` line ~118, isPublicPath 정규식
- `/chat` 엔드포인트를 다시 인증 필요하게 만들려면 isPublicPath에서 제거 + 라우터에 인증 로직 추가해야 함

### onSkillSelect 배선 규칙 (v2.9.14~) — 반드시 준수
- **Unified 봇(Research/Content/Growth/Ops/CEO) rightChildren 내 onSkillSelect는 반드시 `handleSkillRun`**
- `setTask(s)` 배선은 AntigravityRightPanel 내부 state를 건드리지 않아 채팅 미실행
- `handleSkillRun` → `unifiedRightPanelRef.current?.runTask(prompt)` 로 내부 채팅 트리거
- v2.9.13 이전에 content/growth/ops/ceo는 잘못 설정되어 있었음

### Design Bot 왼쪽 패널 (v2.9.14~) — left: null 고정
- 사용자가 명시적으로 디자인 시스템 왼쪽 패널 제거 결정
- `case 'design': return { left: null, ... }` — 절대 DesignLeftPanel 다시 추가 금지
- v2.9.13에서 "누락 수정"이라고 잘못 판단하여 복원했다가 재제거

### CEO/Growth봇 탭별 필터링 (v2.9.11~)
- **CEO봇**: `TAB_KEYWORDS` 맵으로 일간/주간/OKR/투자자별 키워드 매칭 → 관련 feed 우선 표시, 없으면 최신 fallback
- **Growth봇**: `GROWTH_TAB_KEYWORDS` 맵으로 마케팅/웹로그/CS 탭 필터링, CDP 탭은 `CdpSegmentTab` 별도 컴포넌트 유지
- **공통 패턴**: `feed.filter(item => keywords.some(kw => item.content.toLowerCase().includes(kw.toLowerCase())))`

### Content Bot Research 연동 (v2.9.11~)
- **파일**: `BotDetailPage.tsx` line ~907, `ContentPanel.tsx`
- onItemSelect: `item.title`만 포함 → `item.content ?? item.summary` 전체 원문 포함 (`=== 리서치 원문 ===` 섹션)
- ContentLeftPanel: `slice(0,5)` → `slice(0,10)`, 각 아이템에 summary 한 줄 미리보기

## 릴리즈 체크리스트
1. `package.json` 버전 bump
2. `cd backend && npm run build` (tsc)
3. `cd frontend && npm run build` (vite)
4. `npm run rebuild-native` (better-sqlite3 ABI 재빌드)
5. `npx electron-builder` (NSIS 설치파일 생성)
6. `git add ... && git commit && git push`
7. `gh release create vX.X.X "dist-app/OOMNI Setup X.X.X.exe" ...`
8. `docs/index.html` 다운로드 링크 버전 업데이트 → commit → push
