# PRD v6.0.0 — AI Lead Generation Platform (Phase 2+3)
> OOMNI Growth Division | 2026 Q3~Q4

---

## 1. 목표

v5.2.0에서 검증된 콘텐츠 자동화 루프를 플랫폼으로 확장.
Neo4j ID Graph + 크롬 익스텐션 + CRM 완전 자동화 + 외부 플랫폼 플러그인화.

---

## 2. v5.2.0 대비 추가 범위

| 영역 | v5.2.0 | v6.0.0 |
|---|---|---|
| ID Graph DB | SQLite | **Neo4j 전환** |
| 세그멘테이션 | 기본 3단계 | 예측 모델 (구매확률/이탈점수/LTV) |
| 크롬 익스텐션 | ❌ | **MVP 출시** |
| CRM 연동 | ❌ | HubSpot + 자체 OOMNI CRM |
| 외부 플랫폼 | ❌ | 카페24/아임웹 플러그인 |
| n8n 오케스트레이션 | 웹훅만 | 풀 워크플로우 자동화 |
| 멀티링크 허브 | ❌ | 개인별 링크 허브 페이지 |

---

## 3. 기능 명세

### [F-07] Neo4j ID Graph 전환
- SQLite identity 테이블 → Neo4j 그래프 DB
- 크로스채널 동일인 식별 고도화
- 노드: Profile, Email, Phone, DeviceId, AnonymousId, ClickId
- 관계: DETERMINISTIC / PROBABILISTIC / BEHAVIORAL
- 병렬 쿼리로 실시간 세그멘테이션 지원

### [F-08] 예측 세그멘테이션 엔진
- 구매 확률 스코어 (0~100)
- 이탈 위험 스코어 (0~100)
- LTV 예측값
- 72%+ 구매 확률 세그먼트 → 프리미엄 콘텐츠 자동 발사

### [F-09] 크롬 익스텐션
```
extension/
  manifest.json       Chrome MV3
  popup.html          URL 캡처 버튼 + 리드 점수 표시
  content.js          페이지 신호 감지 (LinkedIn, 상품페이지)
  background.js       localhost:3001 통신
```
- 상품 페이지 → 원클릭 URL 캡처 → OOMNI Growth Bot 연동
- LinkedIn 프로필 → 리드 점수 즉시 표시
- OOMNI 데스크탑 앱 실행 중이어야 작동

### [F-10] CRM 자동 연동
- HubSpot API 연동
- 리드 점수 70+ → Hot Lead 자동 생성
- 리드 점수 40~69 → Nurture Sequence 자동 등록
- 자체 OOMNI CRM 테이블 (외부 CRM 없는 경우)

### [F-11] 카페24 / 아임웹 플러그인
- 카페24 앱스토어 등록
- 아임웹 앱 마켓 등록
- "AI 마케팅 자동화" 버튼 → OOMNI Growth Bot 연동
- B2B2C: 플랫폼 고객 → OOMNI 유저 전환

### [F-12] 멀티링크 허브
- 사용자별 개인 링크 허브 페이지 자동 생성
- 생성된 콘텐츠 내 제휴 링크 자동 삽입
- 클릭 트래킹 + 전환 수익 대시보드

### [F-13] n8n 풀 오케스트레이션
- CDP 시그널 → n8n 워크플로우 자동 실행
- 채널별 타이밍 최적화 스케줄러
- A/B 테스트 자동화
- 성과 피드백 → 세그먼트 재갱신 루프

---

## 4. 기술 스택 추가

```
Neo4j Community Edition (로컬 설치)
Redis (실시간 세그먼트 캐싱)
Python FastAPI (예측 스코어링 마이크로서비스)
Chrome Extension MV3
HubSpot API v3
```

---

## 5. 비즈니스 모델

| 플랜 | 가격 | 포함 |
|---|---|---|
| Free | 무료 | 월 10 크레딧 체험 |
| Basic | 29,000원/월 | 200 크레딧 + 3채널 + 리드 스코어링 |
| Standard | 79,000원/월 | 1,000 크레딧 + 전채널 + CDP + CRM |
| Enterprise | 협의 | 무제한 + 커스텀 + AX Clinic 번들 |
| 크레딧 추가 | 10,000원/100크레딧 | 1크레딧 = 콘텐츠 3종 1세트 |
