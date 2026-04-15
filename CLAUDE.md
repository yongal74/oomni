# OOMNI 개발 워크플로우 규칙

## 필수 개발 원칙 (매 세션, 매 작업 적용)

### 1. 작업 전 보고 → 승인 → 개발
- 코드 작성 전 반드시 근본 원인 분석 보고 + 대표님 오케이 후 개발
- 패치로 때우지 말 것 — 근본 원인 수정만 허용

### 2. 커밋 규칙
- `tsc --noEmit` 통과 확인 후 커밋
- 버전 변경 시: push → GitHub Release → 랜딩페이지 순서 필수

### 3. 버전 관리
- 버그 수정: x.x.X (patch) / 기능 추가: x.X.0 (minor) / 현재 버전: **v2.9.17**

---

## 프로젝트 컨텍스트
OOMNI — 솔로 창업자용 AI 에이전트 자동화 플랫폼. 봇 파이프라인: Research → Content → Build → Design → Growth → Ops → CEO

## 아키텍처
- frontend: Vite + React + TypeScript (port 5174 dev)
- backend: Express + TypeScript + SQLite better-sqlite3 (port 3001)
- electron: `electron/main.js` → `require(backend/dist/index.js)` 인-프로세스
- WebSocket: `/ws` (피드 브로드캐스트) + `/api/agents/:id/terminal` (PTY)

## 프로젝트 구분 — 혼동 금지
- **소스**: `C:\Users\장우경\oomni` ← 수정 대상
- **설치 앱**: `C:\진짜OOMNI` ← 바이너리, 절대 수정 금지
- **별개 프로젝트**: `C:\Users\장우경\solo-factory-os` ← OOMNI 무관

---

## 봇 역할별 실행 방식
| 봇 | 실행 방식 | 우측 패널 |
|----|-----------|-----------|
| Research/Content/Growth/Ops/CEO | Streamable HTTP POST /chat | AntigravityRightPanel |
| Build | PTY (XTerminal, alwaysOn+shellMode) | BuildRightPanel |
| Design | PTY (XTerminal, alwaysOn+shellMode) | DesignRightPanel |

---

## 중요 아키텍처 규칙 (위반 시 버그 재발)

### WebSocket (v2.9.3~)
- `OomniWebSocketServer`: 반드시 `noServer: true` + `/ws` 경로만 `handleUpgrade`
- **절대** `{ server, path }` 옵션으로 WebSocketServer 생성 금지 → 다른 경로 소켓 파괴

### AntigravityRightPanel 스트리밍 (v2.9.15~)
- **lineBuffer 패턴 필수**: HTTP 청크 경계에서 JSON 라인이 분리될 수 있음
  ```typescript
  let lineBuffer = ''
  // while loop 내:
  lineBuffer += decoder.decode(value, { stream: true })
  const lines = lineBuffer.split('\n')
  lineBuffer = lines.pop() ?? ''  // 불완전 라인 보관
  ```
- **'stage' 이벤트 처리 필수**: `parsed.event === 'stage'` → `onStageChange?.(d.stage)` 호출
- `chunk.split('\n')` 직접 파싱은 절대 금지 → 청크 경계 JSON 유실

### PipelineBar 단계 동기화 (v2.9.15~)
- `onChatStart`에서 `setCurrentStage('running')` 금지 → 역할별 `stages[0].key` 사용
- `onStageChange` prop 체인: AntigravityRightPanel → UnifiedTerminalLayout → BotDetailPage → setCurrentStage
- 백엔드 executor가 보내는 `send('stage', { stage: '...' })` 이벤트가 실시간 PipelineBar 업데이트

### Pencil MCP (v2.9.15~) — Antigravity 완전 독립
- `findPencilMcpExe()` 및 `--app antigravity` 플래그 삭제됨 — **절대 복원 금지**
- Design Bot MCP: `findNpxPath()` + `npx -y @pencilapp/mcp-server` (standalone)
- Pencil MCP 경로를 Antigravity extensions에서 탐색하는 코드 작성 금지

### AntigravityRightPanel 인증 (v2.9.14~) — 절대 변경 금지
- `POST /api/agents/:id/chat`는 `backend/src/api/app.ts` `isPublicPath`에 예외 처리됨
- 라우터 핸들러 내부가 아닌 **전역 미들웨어**에서 처리 — 수정 시 `app.ts`의 `isPublicPath` 함께 수정 필수

### onSkillSelect 배선 규칙 (v2.9.14~)
- Unified 봇(Research/Content/Growth/Ops/CEO) rightChildren의 onSkillSelect → **반드시 `handleSkillRun`**
- `setTask(s)` 직접 배선 금지 → AntigravityRightPanel 내부 state와 단절됨
- `handleSkillRun` → `unifiedRightPanelRef.current?.runTask(prompt)` 로만 채팅 트리거

### XTerminal isRunning 의존성 (v2.9.12~)
- WebSocket 연결 useEffect deps에 `isRunning` **절대 추가 금지**
- deps: `[alwaysOn, agentId, shellMode]`만 유지 — `isRunning` 추가 시 채팅/터미널 동시 활성화 재발

### Design Bot (v2.9.14~)
- `case 'design': return { left: null, ... }` — 절대 DesignLeftPanel 재추가 금지 (사용자 명시적 결정)

### DB agents_v5 repair (v2.9.8~)
- repair 로직은 반드시 `db.exec(SCHEMA_SQL)` 호출 **전**에 실행
- SCHEMA_SQL 먼저 실행 시 빈 agents 테이블 생성 → repair가 데이터 있는 agents_v5 삭제

### SQLite ALTER TABLE RENAME → FK 참조 자동 업데이트 주의 (v2.9.17~)
- SQLite 3.26.0+ 에서 `ALTER TABLE foo RENAME TO foo_bak` 실행 시 **다른 테이블의 DDL(sqlite_master.sql)에서 FK 참조가 자동으로 `foo_bak`으로 변경됨**
- 이후 `foo_bak` DROP 시 FK 참조가 dangling → `foreign_keys=ON`에서 INSERT/UPDATE 시 "no such table: main.foo_bak" 오류
- **해결책**: 테이블 재생성 마이그레이션 후 반드시 `PRAGMA writable_schema`로 sqlite_master 패치하는 후속 마이그레이션 추가
  ```sql
  PRAGMA writable_schema = ON;
  UPDATE sqlite_master SET sql = REPLACE(sql, 'old_name', 'agents')
    WHERE sql LIKE '%old_name%';
  PRAGMA writable_schema = OFF;
  ```
- **절대 금지**: migration에서 `ALTER TABLE agents RENAME TO agents_vN` 패턴 신규 추가 — 반드시 위 패치 동반

### 마이그레이션 chain-break 방지 (v2.9.17~)
- SCHEMA_SQL에 컬럼이 이미 포함된 경우, 해당 컬럼을 추가하는 migration은 반드시 **no-op(`SELECT 1;`)으로 변경**
- 신규 설치 시 SCHEMA_SQL이 먼저 컬럼 생성 → migration에서 `ALTER TABLE ADD COLUMN` 시 "duplicate column name" 오류 → `break;`로 이후 migration 전부 실행 불가
- 컬럼 누락 대비는 `columnPatches` (try/catch)로 처리

---

## 데이터 저장 위치
- DB: `C:/oomni-data/oomni.db`
- 워크스페이스: `C:/oomni-data/workspaces/{agentId}/`
- 리서치 결과: `C:/oomni-data/research/`
- 디자인 결과: `C:/oomni-data/design/`

---

## 릴리즈 체크리스트
1. `package.json` 버전 bump
2. `cd backend && npm run build` → `cd frontend && npm run build`
3. `npm run rebuild-native` → `npx electron-builder`
4. `git commit && git push`
5. `gh release create vX.X.X "dist-app/OOMNI Setup X.X.X.exe"`
6. `docs/index.html` 다운로드 링크 버전 업데이트 → commit → push
