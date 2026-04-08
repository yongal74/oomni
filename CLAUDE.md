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
- 현재 버전: **v2.2.0**

## 프로젝트 컨텍스트
OOMNI는 솔로 창업자를 위한 AI 에이전트 자동화 플랫폼입니다.
각 봇은 특정 역할을 수행하고, 결과물은 다음 봇으로 전달됩니다.

## 아키텍처
- frontend: Vite + React + TypeScript (port 5173 dev)
- backend: Express + TypeScript + SQLite better-sqlite3 (port 3001)
- electron: main.js → backend in-process 실행
- 빌드 출력: dist-app/OOMNI Setup X.X.X.exe

## 데이터 저장 위치
- 워크스페이스: `C:/oomni-data/workspaces/`
- 리서치 결과: `C:/oomni-data/research/`
- 생성된 코드: `C:/oomni-data/workspaces/{agentId}/`
- 디자인 결과: `C:/oomni-data/design/`
- 리포트: `C:/oomni-data/reports/`

## 봇 파이프라인
Research → Content → Build → Design → Growth → Ops → CEO

## 코드 작성 원칙
1. 모든 결과물은 반드시 파일로 저장
2. 파일명에는 날짜(YYYY-MM-DD) 포함
3. 한국어로 결과물 작성 (코드 제외)
4. 각 단계 완료 시 간략한 완료 메시지 출력
5. 에러 발생 시 원인과 대안 명시
