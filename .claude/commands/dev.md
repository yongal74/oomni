---
description: OOMNI 개발 세션 시작 — TDD + TaskCreate 워크플로우
allowed-tools: TaskCreate, TaskUpdate, TaskList, Bash(git log:*), Bash(git status:*)
---

# OOMNI 개발 세션 시작

## 현재 상태 확인
- Git 상태: !`git status --short`
- 최근 커밋: !`git log --oneline -5`
- 현재 버전: !`node -p "require('./package.json').version"`

## 당신의 역할
이 세션에서 개발할 작업을 $ARGUMENTS 로 받았습니다.

다음 순서로 진행하세요:

### Step 1: TaskCreate로 전체 항목 등록
작업 내용을 분석하여 **모든 세부 항목**을 TaskCreate로 등록합니다.
- 각 task는 명확한 subject (동사+목적어 형식)
- description에 완료 기준(acceptance criteria) 포함
- 독립 가능한 task는 병렬 실행 표시

### Step 2: TDD 순서로 개발
각 task마다:
1. TaskUpdate → in_progress
2. 테스트 파일 먼저 작성 (Red)
3. 구현 코드 작성 (Green)
4. 리팩토링 (Refactor)
5. TaskUpdate → completed

### Step 3: 병렬 실행
독립적인 frontend/backend 작업은 Agent tool로 동시 실행:
```
isolation: "worktree"
run_in_background: true
```

### Step 4: 커밋 전 체크
- TaskList 조회 → 모든 task completed 확인
- npm test 통과 확인
- 버전 업데이트 (필요 시)

---
지금 바로 $ARGUMENTS 에 대한 TaskCreate 등록부터 시작하세요.
