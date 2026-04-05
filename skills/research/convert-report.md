# /convert-report — 수집된 리서치 데이터를 구조화된 보고서로 변환

`collect.md`와 `score.md`로 수집·점수화된 원시 데이터를 읽어, 사람이 읽을 수 있는 심층 분석 보고서(마크다운 + JSON)로 변환한다. 투자자 보고, 팀 공유, 블로그 초안 작성에 바로 사용 가능한 수준으로 정제한다.

## 실행 단계

1. **입력 파일 확인**
   - `C:/oomni-data/research/raw/collected_YYYY-MM-DD.json` 읽기
   - `C:/oomni-data/research/scored/scored_YYYY-MM-DD.json` 읽기
   - 두 파일이 모두 존재하는지 검증. 없으면 오류 메시지와 함께 중단.

2. **데이터 파싱 및 그룹화**
   - `scored.json`에서 `score >= 7` 항목만 필터링 (고신뢰도 인사이트)
   - 카테고리별로 그룹화: `market_trend`, `competitor`, `user_pain`, `opportunity`, `risk`
   - 각 카테고리에서 상위 5개 항목 선택 (score 내림차순)

3. **핵심 인사이트 추출**
   - 전체 수집 항목 수, 필터 통과 항목 수, 평균 점수 계산
   - 가장 많이 등장한 키워드 TOP 10 집계 (title + summary 필드 기준)
   - 경쟁사 언급 빈도 집계 → 경쟁 강도 지표 산출

4. **보고서 섹션 구성**
   - **Executive Summary**: 3문장 이내 핵심 요약
   - **시장 트렌드**: 필터된 market_trend 항목을 시계열 또는 테마별로 정리
   - **경쟁사 분석**: competitor 항목을 표 형태로 정리 (이름, 강점, 약점, 기회)
   - **사용자 Pain Point**: user_pain 항목을 빈도순으로 나열, 각 pain에 솔루션 제안 1줄 추가
   - **기회 영역**: opportunity 항목에서 즉시 실행 가능한 것과 장기 과제 분류
   - **리스크 요인**: risk 항목을 심각도(High/Medium/Low)로 태깅
   - **추천 액션 아이템**: 우선순위 1~5위 구체적 행동 제안

5. **출력 파일 생성**
   - 마크다운 보고서 저장 (`report_YYYY-MM-DD.md`)
   - 구조화된 JSON 저장 (`report_YYYY-MM-DD.json`) — 다른 스킬에서 읽기 위해
   - 요약 슬라이드용 텍스트 저장 (`report_summary_YYYY-MM-DD.txt`) — 각 섹션 제목 + 1줄 요약만

6. **완료 알림**
   - 생성된 파일 경로 3개 콘솔 출력
   - 총 처리 항목 수, 보고서 섹션 수, 소요 시간 출력

## 출력 형식

### 마크다운 보고서 구조 (`report_YYYY-MM-DD.md`)

```markdown
# 리서치 보고서 — YYYY-MM-DD

## Executive Summary
[3문장 요약]

## 시장 트렌드
| 트렌드 | 근거 | 신뢰도 | 출처 |
|--------|------|--------|------|
| ...    | ...  | 8.5/10 | URL  |

## 경쟁사 분석
| 경쟁사 | 강점 | 약점 | 우리의 기회 |
|--------|------|------|------------|

## 사용자 Pain Point
1. **[Pain 1]** (언급 빈도: N회) → 솔루션 힌트: ...
2. **[Pain 2]** ...

## 기회 영역
### 즉시 실행 (0-30일)
- ...
### 중기 과제 (30-90일)
- ...

## 리스크 요인
- 🔴 High: ...
- 🟡 Medium: ...
- 🟢 Low: ...

## 추천 액션 아이템
1. [우선순위 1] — 담당: 홀로창업자, 기한: D+7
2. ...
```

### JSON 스키마 (`report_YYYY-MM-DD.json`)

```json
{
  "generated_at": "YYYY-MM-DDTHH:mm:ssZ",
  "source_files": {
    "collected": "C:/oomni-data/research/raw/collected_YYYY-MM-DD.json",
    "scored": "C:/oomni-data/research/scored/scored_YYYY-MM-DD.json"
  },
  "stats": {
    "total_collected": 120,
    "filtered_high_quality": 34,
    "average_score": 7.8,
    "top_keywords": ["AI", "자동화", "SaaS", "한국시장", "B2B"]
  },
  "sections": {
    "market_trends": [
      {
        "title": "트렌드 제목",
        "summary": "2-3줄 설명",
        "score": 9.1,
        "sources": ["https://..."],
        "tags": ["AI", "growth"]
      }
    ],
    "competitors": [],
    "user_pains": [],
    "opportunities": { "immediate": [], "longterm": [] },
    "risks": { "high": [], "medium": [], "low": [] },
    "action_items": []
  }
}
```

## 저장 위치

- `C:/oomni-data/research/reports/report_YYYY-MM-DD.md`
- `C:/oomni-data/research/reports/report_YYYY-MM-DD.json`
- `C:/oomni-data/research/reports/report_summary_YYYY-MM-DD.txt`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--date YYYY-MM-DD` : 특정 날짜의 수집 파일 사용 (기본값: 오늘)
- `--min-score 6` : 필터 점수 기준 변경 (기본값: 7)
- `--lang ko|en` : 보고서 언어 (기본값: ko)
- `--focus competitor` : 특정 섹션 집중 강화 (competitor, market, user)
- 예시: `/convert-report --date 2026-04-01 --focus competitor`
