# 2026-05-08 세션 로그 — v5.7.0 + v5.8.0 + 상용화 플랜

## 오늘 한 일 요약

| 버전 | 내용 |
|---|---|
| v5.7.0 | 온보딩 색상 통일 + 사이드바 재구조화 + Ops Bot 카드 파싱 fix |
| v5.8.0 | 보안 강화 4건 |
| 문서 | 상용화플랜.md 신규 작성 |

---

## v5.7.0 — UI/UX 수정 3건

### 1. 온보딩 색상 통일 (OnboardingPage.tsx)
- 기존: indigo 계열(파란) — 서비스 본화면과 색상 불일치
- 수정: 모든 indigo → `primary(#D4763B)` + 서비스 다크 배경(`#0d0d0f`, `#111113`)

### 2. 사이드바 순서 재구조화 (AppLayout.tsx)
- 기존 문제: DB 봇 아이콘(research/content)이 대시보드보다 위에 렌더
- 수정: 대시보드→미션보드 최상단 고정, 그 다음 봇 패널/동적봇, 그 다음 Growth Bot·Studio Bot·Ops Bot
- 이름 변경: Growth Studio → Growth Bot, Ops Center → Ops Bot

### 3. Ops Bot 프로세스 카드 파싱 fix (OpsCenter.tsx)
- 기존 버그: SSE `done` 이벤트에 text 없으면 카드 파싱 스킵 → 왼쪽/중앙 패널 빈 상태 유지
- 수정: done 조건 완화(`&& parsed.text` 제거) + while 루프 후 fallback 파싱 추가

---

## v5.8.0 — 보안 강화 4건

### 1. 내부 API 키 랜덤화 (electron/main.js)
- 프로덕션 시작마다 `crypto.randomUUID()` 자동 생성
- `'oomni-internal-dev-key-change-me!'` 기본값 의존 제거

### 2. OpsCenter.tsx dev-key fallback 제거
- `?? 'dev-key'` → 키 없으면 명시적 에러 throw

### 3. Backend 127.0.0.1 바인딩 (backend/src/index.ts)
- `server.listen(port)` → `server.listen(port, '127.0.0.1')`
- 외부 네트워크 접근 완전 차단

### 4. Electron sandbox: true (electron/main.js)
- `sandbox: false` → `sandbox: true`
- preload가 contextBridge/ipcRenderer만 사용 → sandbox 호환 확인 후 적용

---

## 상용화 플랜 (docs/상용화플랜.md)

### 확정된 방향
- 원클릭 세팅: **방향 C** — 앱 내 자동세팅(일반 사용자) + GitHub 스크립트(책 독자/파워유저)
- 국/영문: **v6.0** 때 i18n 적용
- 결제/라이선스/계정: **v6.0+**

### 버전 로드맵
```
v5.7.0  ← 완료 (오늘)
v5.8.0  ← 완료 (오늘, 보안)
v5.9.0  → 온보딩 UX 강화 (자동세팅 기본 선택, 튜토리얼 오버레이)
v6.0.0  → 국/영문 + 결제 + 라이선스 + 자동업데이트 + 계정
```

---

## 내일 바로 시작할 일 (v5.9.0 준비)

### 우선순위 1 — 테스트 결과 확인
- [ ] v5.8.0 `sandbox: true` 변경 후 앱 정상 로딩 확인 (Warren이 오늘 테스트 중)
- [ ] Ops Bot 카드 파싱: AI 응답 후 왼쪽 카드 + 중앙 패널 실제 채워지는지 확인

### 우선순위 2 — v5.9.0 온보딩 UX 강화
```
목표: "다운로드 → 설치 → 실행 → 30초 안에 첫 봇 실행"

① OnboardingPage Step 3: "OOMNI 팀 자동 구성" 기본 선택 상태로 변경
   (현재는 선택 안 된 채로 시작 → 많은 사용자가 다음을 못 찾음)

② 온보딩 완료 후 첫 실행 튜토리얼 오버레이
   - 대시보드에서 "처음 시작하기" 오버레이 (봇 클릭 → 첫 요청 유도)
   - 한 번 보면 다시 안 나오게 (localStorage flag)

③ 첫 봇 실행 성공 시 축하 토스트 ("첫 번째 AI 팀원 가동!")
```

### 우선순위 3 — Growth Bot 프롬프트 라이브러리
```
목표: 책의 "프롬프트 템플릿 20개"를 앱에서 바로 불러다 쓸 수 있게

① GrowthStudio.tsx에 "프롬프트 라이브러리" 탭 추가
② 20개 템플릿을 카테고리별로 정리 (콘텐츠/마케팅/운영/리드)
③ 클릭 → 채팅 입력창에 자동 주입
```

---

## 현재 상태 스냅샷

```
버전: v5.8.0 (배포 완료)
GitHub: https://github.com/yongal74/oomni/releases/tag/v5.8.0
랜딩페이지: 다운로드 링크 v5.8.0

주요 파일 위치:
- 메인 경로: C:\workspace\oomni\oomni\
- 프론트엔드: frontend/src/pages/ + components/layout/AppLayout.tsx
- 백엔드: backend/src/index.ts + api/routes/
- Electron: electron/main.js + preload.js
- 문서: docs/ (history, dev-log, 상용화플랜.md)

알려진 미확인 사항:
- sandbox: true 변경 후 실제 앱 동작 확인 필요 (Warren 테스트 중)
- Ops Bot 카드 파싱 실제 동작 확인 필요
```
