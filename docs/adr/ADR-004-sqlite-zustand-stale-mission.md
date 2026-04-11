# ADR-004: Zustand Persist stale mission ID 문제 및 해결

**날짜**: 2026-04
**상태**: 채택됨 (v2.9.3)

---

## 배경

OOMNI 프론트엔드는 Zustand + persist 미들웨어로 `currentMission`을 localStorage에 저장한다. 이는 앱 재시작 시 마지막 미션을 자동 복원하기 위함이다.

## 문제

신규 설치(또는 DB 초기화) 후 다음 시나리오에서 버그 발생:

1. 이전 설치에서 `currentMission: { id: "abc-123", name: "My Mission" }` localStorage에 저장
2. 새로 설치 → DB 초기화 → mission "abc-123" 없음
3. 앱 시작 → Zustand가 localStorage에서 `currentMission` 복원 → `missionId = "abc-123"`
4. `missionsData` 로드 → 빈 배열 (새 DB) → `useEffect` 조건 `!currentMission` = false → 아무것도 안 함
5. 사용자가 봇 추가 시도 → `POST /api/agents` with `mission_id: "abc-123"` → SQLite FK 제약 위반 → 500
6. 모든 봇 추가 실패

## 해결

`missionsData` 로드 완료 후 `currentMission`의 유효성을 검증한다:

```typescript
useEffect(() => {
  if (missionsData === undefined) return // 아직 로딩 중
  if (missionsData.length === 0) {
    if (currentMission) setCurrentMission(null) // stale 초기화
    return
  }
  if (!currentMission) {
    setCurrentMission(missionsData[0])
  } else {
    const stillExists = missionsData.find(m => m.id === currentMission.id)
    if (!stillExists) setCurrentMission(missionsData[0]) // stale → 첫 미션으로 교체
  }
}, [currentMission, missionsData, setCurrentMission])
```

추가로 백엔드 `POST /api/agents`에서도 사전 검증:

```typescript
const missionCheck = await db.query('SELECT id FROM missions WHERE id = $1', [mission_id]);
if (missionCheck.rows.length === 0) {
  res.status(404).json({ error: '미션을 찾을 수 없습니다. 앱을 새로고침하고 다시 시도하세요.' });
  return;
}
```

## 교훈

Zustand persist를 사용할 때 외래 키 역할을 하는 ID를 저장하면, 해당 엔티티가 삭제/재생성될 수 있는 모든 경우에 유효성 검증이 필요하다. 특히:
- 신규 설치
- DB 초기화
- 마이그레이션 후 ID 변경

**원칙**: persist된 ID는 서버 데이터 로드 후 반드시 존재 여부 검증, 없으면 자동 교정.

## 관련 파일
- `frontend/src/pages/DashboardPage.tsx` — stale 검증 useEffect
- `frontend/src/store/app.store.ts` — Zustand persist 설정
- `backend/src/api/routes/agents.ts` — POST mission 사전 검증
