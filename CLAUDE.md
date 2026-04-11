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
- 현재 버전: **v2.9.3**

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

### Design Bot 실행 모드
- Pencil MCP 연결됨 → XTerminal (PTY, Claude Code + Pencil MCP)
- Pencil MCP 미연결 → LiveStreamDrawer (SSE, HTML 생성)
- 모드 판별: `GET /api/agents/:id/pencil-status`

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
| 봇 | 실행 방식 | 비고 |
|----|-----------|------|
| Research | SSE (LiveStreamDrawer) | 웹 리서치 결과 스트리밍 |
| Content | SSE (LiveStreamDrawer) | 콘텐츠 생성 스트리밍 |
| Build | PTY (XTerminal) | Claude Code CLI 인터랙티브 |
| Design | PTY or SSE | Pencil MCP 연결 여부에 따라 자동 분기 |
| Growth/Ops/CEO | SSE (LiveStreamDrawer) | 결과 스트리밍 |

## 코드 작성 원칙
1. 모든 결과물은 반드시 파일로 저장
2. 파일명에는 날짜(YYYY-MM-DD) 포함
3. 한국어로 결과물 작성 (코드 제외)
4. 각 단계 완료 시 간략한 완료 메시지 출력
5. 에러 발생 시 원인과 대안 명시

## 릴리즈 체크리스트
1. `package.json` 버전 bump
2. `cd backend && npm run build` (tsc)
3. `cd frontend && npm run build` (vite)
4. `npm run rebuild-native` (better-sqlite3 ABI 재빌드)
5. `npx electron-builder` (NSIS 설치파일 생성)
6. `git add ... && git commit && git push`
7. `gh release create vX.X.X "dist-app/OOMNI Setup X.X.X.exe" ...`
8. `docs/index.html` 다운로드 링크 버전 업데이트 → commit → push
