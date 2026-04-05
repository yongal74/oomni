# /weekly-digest — 주간 업계 동향 다이제스트 자동 생성

매주 월요일 아침 자동 실행되도록 설계된 스킬. 지난 한 주 동안의 리서치 수집 파일, 점수 파일, 뉴스레터 리서치 파일을 모두 읽어 경영자가 5분 안에 전체 상황을 파악할 수 있는 주간 다이제스트를 생성한다. `ceo/weekly-brief.md`에 인풋으로 활용된다.

## 실행 단계

1. **지난 주 파일 수집**
   날짜 범위: 지난 월요일 ~ 일요일
   다음 경로에서 해당 기간 파일 전체 로드:
   - `C:/oomni-data/research/raw/collected_*.json`
   - `C:/oomni-data/research/scored/scored_*.json`
   - `C:/oomni-data/research/reports/report_*.json`
   - `C:/oomni-data/research/newsletter/newsletter-research_*.json`

2. **메트릭 집계**
   - 총 수집 아이템 수 (일별 추이 포함)
   - 평균 점수 및 점수 분포 (히스토그램 데이터)
   - 카테고리별 아이템 수
   - 이번 주 새로 등장한 경쟁사 또는 신규 트렌드 감지
   - 지난 주 대비 변화량 (증가/감소 %)

3. **핵심 인사이트 추출**
   - 이번 주 가장 중요한 인사이트 TOP 5 선정 (score 기준)
   - 이번 주 가장 많이 언급된 기업/제품/기술 TOP 10
   - 새롭게 포착된 시장 신호 (지난 주에 없던 새 키워드)
   - 놓치면 안 될 경고 신호 (리스크 항목 중 신규 등장)

4. **경쟁사 모니터링 요약**
   - 이번 주 경쟁사 주요 움직임 (신제품, 가격 변경, 파트너십)
   - 경쟁사별 언급 빈도 변화 트렌드

5. **다음 주 주목 포인트**
   - 예정된 이벤트, 컨퍼런스, 공개 예정 제품
   - 팔로우업이 필요한 미완성 스토리
   - 다음 주 리서치 집중 키워드 추천 3개

6. **다이제스트 문서 생성**
   - 마크다운 다이제스트 저장
   - JSON 요약 저장 (다른 스킬 입력용)
   - Telegram 메시지 버전 저장 (4096자 이내 텍스트)

7. **자동 발송 옵션**
   - Telegram Bot API 호출: `C:/oomni-data/config/telegram.json`에서 봇 토큰 + 채팅 ID 읽기
   - Slack Webhook 호출: `C:/oomni-data/config/slack.json`에서 웹훅 URL 읽기
   - 발송 성공/실패 로그 저장

## 출력 형식

### 주간 다이제스트 마크다운 (`weekly-digest_YYYY-WW.md`)

```markdown
# 주간 리서치 다이제스트 — YYYY년 MM월 DD일 주차

> 📊 이번 주 수집: **N개** | 고품질 인사이트: **N개** | 평균 점수: **X.X/10**

---

## 이번 주 핵심 요약 (30초 버전)
[3문장 이내로 이번 주 업계 흐름 요약]

---

## TOP 5 인사이트

1. **[인사이트 제목]** `점수: 9.5`
   [2줄 설명]
   📎 출처: [URL]

...

---

## 경쟁사 동향

| 경쟁사 | 이번 주 움직임 | 우리 영향도 |
|--------|--------------|-----------|
| ...    | ...          | High/Med/Low |

---

## 새로 포착된 트렌드
- 🆕 [신규 트렌드 1]: [설명]

---

## 경고 신호
- 🔴 [리스크 1]: [설명]

---

## 다음 주 주목 포인트
1. [이벤트/포인트 1]

---

## 다음 주 리서치 키워드 추천
`#키워드1` `#키워드2` `#키워드3`
```

### Telegram 메시지 (`weekly-digest-telegram_YYYY-WW.txt`)

```
📋 주간 리서치 다이제스트 | YYYY-MM-DD 주차

📊 이번 주: N개 수집 | 고품질 N개

🔑 핵심 인사이트:
1. [요약 1]
2. [요약 2]
3. [요약 3]

⚡ 이번 주 핫 트렌드: [트렌드]

🔴 주의: [리스크 1문장]

🔗 전체 보고서: C:/oomni-data/research/digest/weekly-digest_YYYY-WW.md
```

### JSON 요약 (`weekly-digest_YYYY-WW.json`)

```json
{
  "week": "YYYY-WW",
  "date_range": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "stats": {
    "total_collected": 0,
    "high_quality": 0,
    "avg_score": 0.0,
    "daily_breakdown": { "Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0 }
  },
  "top_insights": [],
  "top_keywords": [],
  "new_signals": [],
  "risk_signals": [],
  "competitor_updates": [],
  "next_week": {
    "events": [],
    "followups": [],
    "recommended_keywords": []
  }
}
```

## 저장 위치

- `C:/oomni-data/research/digest/weekly-digest_YYYY-WW.md`
- `C:/oomni-data/research/digest/weekly-digest_YYYY-WW.json`
- `C:/oomni-data/research/digest/weekly-digest-telegram_YYYY-WW.txt`
- `C:/oomni-data/logs/weekly-digest-send_YYYY-WW.log`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--week YYYY-WW` : 특정 주차 지정 (기본값: 지난 주)
- `--send telegram` : 완료 후 Telegram 자동 발송
- `--send slack` : 완료 후 Slack 자동 발송
- `--send all` : 모든 채널 발송
- `--no-send` : 파일만 생성, 발송 안 함 (기본값)
- 예시: `/weekly-digest --week 2026-14 --send all`
