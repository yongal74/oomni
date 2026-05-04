# PRD v5.2.0 — AI Lead Generation Bot (Phase 1)
> OOMNI Growth Division | 2026.05

---

## 1. 목표

TokTak 리버스 엔지니어링 + CDP 동적 연결로 실제 Lead를 만드는 AI 시스템.
단순 콘텐츠 자동화를 넘어, 세그먼트 시그널 → 콘텐츠 생성 → SNS 자동 발사까지 완결.

---

## 2. 핵심 플로우

```
URL 입력
  → [F-01] URL 인제스션 (상품 정보 추출, 15초)
  → [F-02] CDP 세그먼트 매핑 (기존 ID Graph SQLite)
  → [F-03] 세그먼트별 콘텐츠 3종 자동 생성
       텍스트  → Claude Sonnet 4.6
       이미지  → Google Imagen 4 (Gemini API)
       영상    → Google Veo 3.1 Lite (Gemini API)
  → [F-04] SNS 자동 업로드 (인스타/유튜브/틱톡/X/링크드인)
  → [F-05] 리드 스코어링 v1 (반응 데이터 수집 + 점수 계산)
  → [F-06] CDP 동적 루프 (시그널 감지 → 리타겟팅 콘텐츠 자동 트리거)
```

---

## 3. 기능 명세

### [F-01] URL 인제스션 엔진
- `POST /api/growth/ingest`
- URL → 상품명, 가격, 이미지, 설명, 카테고리, 키워드 추출
- 크롤링 실패 시 → 상품명 + 이미지 업로드 fallback
- 지원: 스마트스토어, 쿠팡, 카페24, 아임웹, 일반 웹페이지
- 응답시간: 15초 이내

### [F-02] CDP 세그먼트 매핑
- 현재 미션의 CDP 프로필과 자동 연결
- 세그먼트 선택: 신규방문자 / 재구매가능 / 이탈위험 / VIP
- ID Graph (SQLite 기반 v5.1.0) 활용
- `GET /api/identity/graph/:profileId` 연동

### [F-03] 세그먼트별 콘텐츠 3종 생성
- `POST /api/growth/generate`

| 타입 | 모델 | 세그먼트 분기 |
|---|---|---|
| 텍스트 (전채널) | Claude Sonnet 4.6 | 톤/CTA 자동 변환 |
| 이미지/카드뉴스 | Google Imagen 4 | 세그먼트별 비주얼 스타일 |
| 쇼츠 영상 | Google Veo 3.1 Lite | 신규=인트로, 재구매=프로모, 이탈=리마인더 |

API 키: `GEMINI_API_KEY` (settings에서 입력)
비용 예상: 이미지 $0.067/장, 영상 $0.15/초

### [F-04] SNS 자동 업로드
- `POST /api/growth/publish`
- 연동 채널:

| 채널 | API | 인증 방식 |
|---|---|---|
| Instagram | Instagram Graph API | OAuth 2.0 (Facebook App) |
| YouTube | YouTube Data API v3 | Google OAuth 2.0 |
| TikTok | TikTok Content Posting API | OAuth 2.0 |
| X (Twitter) | Twitter API v2 | OAuth 2.0 |
| 네이버 블로그 | 네이버 오픈API | OAuth 2.0 |

- Settings → SNS 연동 페이지에서 계정 연결
- 발사 시간: 즉시 / 예약 (날짜+시간 지정)

### [F-05] 리드 스코어링 v1
- `growth_leads` 테이블 신규

| 시그널 | 점수 |
|---|---|
| 콘텐츠 3회+ 클릭 (7일) | +25 |
| 멀티링크 방문 후 이탈 | +15 |
| 동일 카테고리 반복 탐색 | +20 |
| 이메일 오픈 + 클릭 | +30 |
| SNS 저장/공유 | +15 |

- 70점+ → Hot Lead 태깅
- 40~69점 → Nurture 시퀀스 발동
- 대시보드에서 실시간 리드 목록 표시

### [F-06] CDP 동적 루프
- CDP 세그먼트 변화 감지 → Growth Bot 자동 트리거
- `POST /api/growth/trigger` (내부 호출)
- 트리거 조건:
  - 특정 세그먼트 인원 20%+ 증가
  - 리드 점수 70+ 달성
  - 이탈 위험 세그먼트 임계값 초과
- 자동 리타겟팅 콘텐츠 생성 + 스케줄 발사

---

## 4. DB 스키마 변경

```sql
-- growth_content 테이블 확장
ALTER TABLE growth_content ADD COLUMN image_url TEXT;
ALTER TABLE growth_content ADD COLUMN video_url TEXT;
ALTER TABLE growth_content ADD COLUMN segment TEXT;
ALTER TABLE growth_content ADD COLUMN published_at TEXT;
ALTER TABLE growth_content ADD COLUMN publish_channels TEXT; -- JSON array

-- growth_leads 신규 테이블
CREATE TABLE IF NOT EXISTS growth_leads (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  profile_id TEXT,
  score INTEGER DEFAULT 0,
  tier TEXT CHECK(tier IN ('hot','nurture','cold')) DEFAULT 'cold',
  signals TEXT, -- JSON
  last_signal_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- sns_connections 신규 테이블
CREATE TABLE IF NOT EXISTS sns_connections (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- instagram/youtube/tiktok/x/naver
  access_token TEXT,
  refresh_token TEXT,
  account_name TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 5. 신규 파일 목록

```
backend/src/
  services/
    roleExecutors/growth.ts          ← Growth Bot executor (신규)
    growthIngestionService.ts        ← URL 크롤링 + 정보 추출
    geminiService.ts                 ← Imagen 4 + Veo 3.1 API
    snsPublisherService.ts           ← SNS 자동 업로드
    leadScoringService.ts            ← 리드 스코어 계산
    cdpTriggerService.ts             ← CDP 동적 루프 트리거
  api/routes/
    growth.ts                        ← 기존 확장 (ingest, publish, trigger 추가)

frontend/src/
  pages/
    GrowthStudio.tsx                 ← 전면 개편
  components/growth/
    UrlIngestionPanel.tsx            ← URL 입력 + 상품 정보 미리보기
    ContentPackagePanel.tsx          ← 3종 콘텐츠 패키지 출력
    SnsPublishPanel.tsx              ← 채널 선택 + 발사 버튼
    LeadScoringDashboard.tsx         ← 리드 점수 + 목록
    CdpTriggerPanel.tsx              ← 동적 루프 설정
  pages/
    SnsSettingsPage.tsx              ← SNS OAuth 연결 관리
```

---

## 6. 환경변수 추가

```env
GEMINI_API_KEY=                    # Google Gemini API (Imagen + Veo)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
```

---

## 7. 개발 태스크 (순서)

| 순서 | 태스크 | 예상 |
|---|---|---|
| T01 | DB 스키마 마이그레이션 | 1h |
| T02 | roleExecutors/growth.ts | 1h |
| T03 | growthIngestionService.ts (URL 크롤링) | 3h |
| T04 | geminiService.ts (Imagen + Veo stub) | 2h |
| T05 | snsPublisherService.ts (OAuth + 업로드) | 6h |
| T06 | leadScoringService.ts | 2h |
| T07 | cdpTriggerService.ts | 2h |
| T08 | growth.ts 라우터 확장 | 2h |
| T09 | GrowthStudio.tsx 전면 개편 | 4h |
| T10 | SnsSettingsPage.tsx (OAuth 연결 UI) | 3h |
| T11 | LeadScoringDashboard.tsx | 2h |
| T12 | tsc --noEmit + 통합 테스트 | 2h |
| T13 | 빌드 + v5.2.0 릴리즈 | 1h |
