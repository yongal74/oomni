# /score — AI 신호 강도 채점

수집된 리서치 아이템에 AI 신호 강도 점수를 부여합니다.

## 실행 단계

1. `C:/oomni-data/research/collected_{오늘날짜}.json` 파일을 읽습니다
   - 없으면 가장 최근 collected_*.json 파일을 사용합니다

2. 각 아이템을 다음 기준으로 0-100점 채점합니다:
   - **시장 임팩트** (30점): 시장 규모, 영향력 범위
   - **기술 혁신도** (25점): 새로운 기술/방법론 여부
   - **실행 가능성** (25점): 솔로 창업자가 즉시 활용 가능한가
   - **트렌드 부합도** (20점): 현재 AI/SaaS 트렌드와의 관련성

3. 점수 기준 분류:
   - 70점 이상: `keep` (보관)
   - 40-69점: `watch` (관찰)
   - 39점 이하: `drop` (제거)

4. 채점 결과를 `C:/oomni-data/research/scored_{YYYY-MM-DD}.json`에 저장:
```json
{
  "scored_at": "ISO8601",
  "items": [
    {
      "title": "제목",
      "signal_score": 85,
      "filter_decision": "keep",
      "score_breakdown": {
        "market_impact": 25,
        "innovation": 20,
        "actionability": 22,
        "trend_fit": 18
      },
      "reason": "채점 이유 한 줄"
    }
  ]
}
```

5. 채점 요약 출력: keep/watch/drop 개수, 평균 점수

## 추가 인자
$ARGUMENTS — 특정 카테고리나 키워드 기준 강조 채점
