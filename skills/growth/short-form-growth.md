# /short-form-growth — 실제 성장 지표로 바이럴 숏폼 영상 대본 생성

실제 사용자 수, 수익, 성장률 데이터를 입력받아 "0에서 N명까지" 성장 스토리 형식의 숏폼 대본을 생성한다. Remotion 데이터 시각화 props와 Vrew 자막 파일을 함께 출력한다.

## 실행 단계

1. **지표 데이터 수집**
   자동 수집 (설정된 경우):
   - `C:/oomni-data/growth/weekly-report_YYYY-WW.json` 최신 파일 읽기
   - 또는 `$ARGUMENTS`에서 직접 입력된 수치 사용

   수집할 핵심 지표:
   - 총 사용자 수 & 달성 기간
   - MRR & 성장률
   - 특별한 이정표 (첫 유료 고객, 100명 돌파, MRR ₩100만원 등)
   - 가장 인상적인 숫자 1-3개

2. **성장 내러티브 결정**
   패턴 선택:
   - **"0 → N" 패턴**: "0명에서 1,000명까지 90일"
   - **"내가 틀렸다" 패턴**: 예상과 달랐던 성장 이야기
   - **"이 숫자가 현실이다" 패턴**: 실제 데이터 공개
   - **"이렇게 되리라 몰랐다" 패턴**: 예상치 못한 성장

3. **숫자의 임팩트 극대화**
   숫자를 감동적으로 표현:
   - 일별/주별 세분화: "하루 평균 11명씩"
   - 대비: "2개월 전까지만 해도 0명이었어요"
   - 구체화: "₩2,480,000 = 매달 내 월세의 2.5배"
   - 타임라인: "Day 1 → Day 30 → Day 90"

4. **훅 3가지 생성**
   성장 수치 기반 강력한 훅:
   - **A. 결과 먼저**: "[N]명. [M]일. 혼자서."
   - **B. 충격 공개**: "이 숫자 공개하면 안 된다고 했는데."
   - **C. 여정 시작**: "Day 1: 사용자 0명. Day 90: [N]명."

5. **Remotion 데이터 시각화 씬 설계**
   각 숫자에 대한 애니메이션 씬:
   - 숫자 카운터 업 애니메이션 (0 → N)
   - 성장 곡선 라인 차트 그리기 애니메이션
   - 타임라인 진행 표시
   - 비교 바 차트 (전후)
   - 이정표 팝업 (100명, 1000명, MRR ₩100만원 등)

6. **완전한 대본 작성 (3가지 훅 버전 전부)**
   각 버전마다:
   - 초단위 타임코드
   - 실제 말할 대사
   - 화면에 보여줄 내용
   - 텍스트 오버레이
   - 감정 지시 (신나게/담담하게/충격적으로)

7. **Remotion 프롭 JSON 생성**
   실제 데이터가 주입된 Remotion 컴포지션 props:
   - 각 씬의 데이터 값
   - 애니메이션 파라미터
   - 색상 테마

8. **발행 캡션 및 해시태그 생성**
   플랫폼별 최적화:
   - YouTube Shorts 설명
   - Instagram 릴스 캡션 + 해시태그
   - Twitter 첨부 트윗

## 출력 형식

### 성장 숏폼 대본 (`growth-short-form_YYYY-MM-DD.md`)

```markdown
# 성장 숏폼 — [이정표]

**실제 데이터**: 1,000명 / 90일 / MRR ₩2,480,000
**플랫폼**: YouTube Shorts + Instagram Reels
**목표 길이**: 55초

---

## 훅 A — "결과 먼저" (추천)

| 구간 | 시간 | 대사 | 화면 |
|------|------|------|------|
| Hook | 0-3s | "1,000명. 90일. 혼자서." | [텍스트: 흰 배경에 검은 글씨 3줄 / 타이포그래피 애니] |
| Context | 3-8s | "저 1인 SaaS 운영해요. 지난 3달 동안 무슨 일이 있었는지 공개합니다." | [화면: 대시보드 사용자 카운터 1,000] |
| Journey | 8-30s | "Day 1. 사용자 0명. 매일 밤 대시보드 새로고침 했어요. Day 30. 47명. 첫 유료 결제 알림 받았을 때 소리 질렀어요. Day 60. 312명. 사람들이 제 제품을 쓴다는 게 실감나기 시작했어요. Day 90. 1,000명." | [화면: 날짜별 카운터 애니메이션 / Remotion 라인차트] |
| Proof | 30-48s | "수익은요? 지금 월 248만원이에요. 혼자 운영하는 SaaS에서요." | [화면: MRR 카운터 0 → 2,480,000] |
| CTA | 48-55s | "어떻게 했는지 전부 공개합니다. 저장하고 나중에 봐도 돼요." | [화면: 저장 아이콘 강조] |
```

### Remotion 프롭 JSON (`growth-remotion_YYYY-MM-DD_훅A.json`)

```json
{
  "version": "1.0",
  "fps": 30,
  "duration_frames": 1650,
  "width": 1080,
  "height": 1920,
  "hook_variant": "A",
  "data": {
    "milestone": "1,000명",
    "days": 90,
    "mrr": 2480000,
    "currency": "KRW",
    "timeline": [
      { "day": 1, "users": 0, "label": "시작" },
      { "day": 7, "users": 12 },
      { "day": 14, "users": 28 },
      { "day": 30, "users": 47, "label": "첫 유료 결제" },
      { "day": 60, "users": 312, "label": "Product Hunt" },
      { "day": 90, "users": 1000, "label": "1,000명 달성" }
    ]
  },
  "scenes": [
    {
      "id": "hook_typography",
      "start_frame": 0,
      "end_frame": 90,
      "type": "typography_reveal",
      "lines": [
        { "text": "1,000명.", "delay_frames": 0, "style": { "fontSize": 96, "fontWeight": "black" } },
        { "text": "90일.", "delay_frames": 10, "style": { "fontSize": 96, "fontWeight": "black" } },
        { "text": "혼자서.", "delay_frames": 20, "style": { "fontSize": 96, "fontWeight": "black", "color": "#2563eb" } }
      ],
      "background": "#ffffff"
    },
    {
      "id": "counter_users",
      "start_frame": 90,
      "end_frame": 240,
      "type": "number_counter",
      "from": 0,
      "to": 1000,
      "unit": "명",
      "label": "총 사용자",
      "easing": "ease_out",
      "background": "#1a1a2e",
      "text_color": "#ffffff"
    },
    {
      "id": "timeline_chart",
      "start_frame": 240,
      "end_frame": 900,
      "type": "line_chart_draw",
      "data_key": "timeline",
      "x_field": "day",
      "y_field": "users",
      "labels": true,
      "color": "#2563eb",
      "background": "#ffffff"
    },
    {
      "id": "mrr_counter",
      "start_frame": 900,
      "end_frame": 1440,
      "type": "number_counter",
      "from": 0,
      "to": 2480000,
      "prefix": "₩",
      "format": "korean",
      "label": "월 수익 (MRR)",
      "background": "#1a1a2e"
    },
    {
      "id": "cta",
      "start_frame": 1440,
      "end_frame": 1650,
      "type": "text_overlay",
      "text": "어떻게 했는지\n전부 공개합니다 👆",
      "animation": { "in": "bounce" },
      "background": "#2563eb",
      "text_color": "#ffffff"
    }
  ],
  "music": {
    "track": "inspirational_building.mp3",
    "volume": 0.25,
    "beat_sync": true,
    "fade_out_start_frame": 1560
  },
  "captions": {
    "youtube_shorts": "0명에서 1,000명까지 90일 동안의 기록을 공개합니다. 1인 SaaS 창업의 현실...\n\n#SaaS #인디해커 #1인창업 #AI자동화",
    "instagram_reels": "1,000명. 90일. 혼자서. 🚀\n\n[전체 캡션...]\n\n#SaaS #인디해커 #스타트업 #1인창업 #AI #자동화 #창업일기 #성장기록",
    "twitter": "0명 → 1,000명 / 90일 / 혼자\n\n무슨 일이 있었는지 전부 공개합니다."
  }
}
```

### Vrew 자막 TXT (`growth-vrew_YYYY-MM-DD_훅A.txt`)

```
00:00:00.000 1,000명. 90일. 혼자서.
00:00:03.000 저 1인 SaaS 운영해요.
00:00:05.000 지난 3달 동안 무슨 일이 있었는지 공개합니다.
00:00:08.000 Day 1. 사용자 0명.
00:00:11.000 매일 밤 대시보드 새로고침 했어요.
00:00:14.000 Day 30. 47명.
00:00:17.000 첫 유료 결제 알림 받았을 때 소리 질렀어요.
00:00:21.000 Day 60. 312명.
00:00:24.000 사람들이 제 제품을 쓴다는 게 실감나기 시작했어요.
00:00:28.000 Day 90. 1,000명.
00:00:30.000 수익은요?
00:00:32.000 지금 월 248만원이에요.
00:00:36.000 혼자 운영하는 SaaS에서요.
00:00:39.000 어떻게 했는지 전부 공개합니다.
00:00:48.000 저장하고 나중에 봐도 돼요.
```

## 저장 위치

- `C:/oomni-data/content/short-form/growth/growth-short-form_YYYY-MM-DD.md`
- `C:/oomni-data/content/short-form/growth/growth-remotion_YYYY-MM-DD_훅A.json`
- `C:/oomni-data/content/short-form/growth/growth-remotion_YYYY-MM-DD_훅B.json`
- `C:/oomni-data/content/short-form/growth/growth-remotion_YYYY-MM-DD_훅C.json`
- `C:/oomni-data/content/short-form/growth/growth-vrew_YYYY-MM-DD_훅A.txt`
- `C:/oomni-data/content/short-form/growth/growth-vrew_YYYY-MM-DD_훅B.txt`
- `C:/oomni-data/content/short-form/growth/growth-vrew_YYYY-MM-DD_훅C.txt`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[이정표] [기간]` (예: "1000명 90일", "MRR100만원 60일")
- `--users 1000` : 총 사용자 수
- `--days 90` : 달성 기간
- `--mrr 2480000` : 현재 MRR (원)
- `--timeline "1:0,30:47,60:312,90:1000"` : 타임라인 데이터 (day:users)
- `--auto-data` : weekly-report에서 자동으로 데이터 로드
- `--hooks 1|2|3` : 훅 변형 개수 (기본값: 3)
- 예시: `/short-form-growth --users 1000 --days 90 --mrr 2480000 --auto-data`
