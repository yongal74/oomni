# /score — AI 신호 강도 채점 (SEO 통합)

수집된 리서치 아이템에 콘텐츠 신호 강도 + SEO 점수를 통합 부여합니다.

## 실행 단계

1. `C:/oomni-data/research/collected_{오늘날짜}.json` 파일을 읽습니다
   - 없으면 가장 최근 collected_*.json 파일을 사용합니다

2. `--mode seo` 인자가 있으면 SEO 기준 우선, 없으면 통합 채점 모드

3. 각 아이템을 다음 기준으로 0-100점 채점합니다:

### 콘텐츠 신호 (60점)
- **시장 임팩트** (20점): 시장 규모, 영향력 범위
- **기술 혁신도** (15점): 새로운 기술/방법론 여부
- **실행 가능성** (15점): 솔로 창업자가 즉시 활용 가능한가
- **트렌드 부합도** (10점): 현재 AI/SaaS 트렌드와의 관련성

### SEO 기준 (40점) ← 신규 추가
- **검색 의도 명확성** (10점): informational(10) > commercial(7) > navigational(3)
  - "how to", "what is", "why does" 패턴 → 높은 점수
- **퍼스트 무버 가능성** (10점): 트렌드 급상승 후 경과 시간
  - 0~6시간: 10점 / 6~24시간: 7점 / 24~48시간: 4점 / 48시간↑: 1점
- **CPC 카테고리 추정** (10점): 광고 단가 높은 카테고리
  - AI/금융/보험/SaaS/법률: 10점 / 건강/교육: 7점 / 일반: 3점
- **경쟁도 추정** (5점): 검색 결과 경쟁 강도
  - 키워드 3단어↑ + 신규 토픽: 5점 / 2단어: 3점 / 1단어 범용: 1점
- **AIWX 콘텐츠 적합도** (5점): C:/GGAdsense/CLAUDE_BLOG.md 참조 7개 카테고리 매칭
  - 2개↑ 매칭: 5점 / 1개 매칭: 3점 / 미매칭: 0점

4. 점수 기준 분류:
   - 70점 이상: `keep` (보관 + /trend-alert 대상)
   - 40-69점: `watch` (관찰)
   - 39점 이하: `drop` (제거)

5. 채점 결과를 `C:/oomni-data/research/scored_{YYYY-MM-DD}.json`에 저장:
```json
{
  "scored_at": "ISO8601",
  "mode": "integrated|seo",
  "items": [
    {
      "title": "제목",
      "signal_score": 85,
      "filter_decision": "keep",
      "score_breakdown": {
        "market_impact": 18,
        "innovation": 14,
        "actionability": 13,
        "trend_fit": 9,
        "search_intent": 9,
        "first_mover": 8,
        "cpc_category": 8,
        "competition": 4,
        "aiwx_fit": 5
      },
      "seo_keywords": ["추천 롱테일 키워드 2-3개"],
      "aiwx_category": "매칭된 AIWX 카테고리",
      "reason": "채점 이유 한 줄"
    }
  ]
}
```

6. 채점 요약 출력: keep/watch/drop 개수, 평균 점수, SEO 상위 3개 아이템

## 추가 인자
$ARGUMENTS — 특정 카테고리나 키워드 기준 강조 채점
--mode seo → SEO 기준 채점 우선 (퍼스트 무버 파이프라인용)
