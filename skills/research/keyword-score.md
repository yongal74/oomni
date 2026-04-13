# /keyword-score — 롱테일 키워드 Volume/KD/CPC 추정 채점

수집된 트렌드 아이템에서 롱테일 키워드를 추출하고 SEO 가치를 채점합니다.

## 실행 단계

1. 입력 소스 확인:
   - $ARGUMENTS: 키워드 직접 입력
   - 없으면 `C:/oomni-data/research/scored_{오늘날짜}.json` 의 keep 아이템 사용

2. 각 아이템/키워드에서 롱테일 키워드 후보 3-5개 추출:
   - 원본 키워드 + "방법", "이유", "사용법", "뜻", "장점" 조합
   - "how to", "what is", "why does" 영문 패턴
   - 관련 질문 형태 키워드

3. 각 키워드를 다음 기준으로 추정 채점 (0-100점):

   **검색량 추정 (30점)**
   - Google Trends 실시간 지수 기반
   - 급상승 중: 25-30점 / 안정적 인기: 15-24점 / 낮음: 0-14점

   **키워드 난이도 추정 KD (25점)**
   - 3단어 이상 롱테일: 20-25점 (경쟁 낮음)
   - 2단어: 10-19점
   - 1단어 범용: 0-9점

   **CPC 추정 (30점)**
   - AI/SaaS/금융/보험/법률: 25-30점
   - 건강/교육/여행: 15-24점
   - 일반 정보성: 0-14점

   **AIWX 카테고리 매칭 (15점)**
   - C:/GGAdsense/CLAUDE_BLOG.md 7개 카테고리 매칭
   - 2개↑: 12-15점 / 1개: 6-11점 / 없음: 0-5점

4. 결과를 `C:/oomni-data/research/keyword-score_{YYYY-MM-DD}.json`에 저장:
```json
{
  "scored_at": "ISO8601",
  "keywords": [
    {
      "keyword": "Claude API 사용법",
      "total_score": 88,
      "volume_estimate": "급상승 (Trends: 85)",
      "kd_estimate": "LOW (3단어 롱테일)",
      "cpc_estimate": "HIGH (AI/SaaS)",
      "aiwx_match": "AI 활용법",
      "recommended_title": "Claude API 사용법 완전 가이드: 초보자도 5분 만에 시작하는 법",
      "priority": "즉시 포스팅"
    }
  ]
}
```

5. 우선순위별 정렬 후 출력:
   - 즉시 포스팅 (80점↑): 빨간 🔴
   - 이번 주 내 (60-79점): 노란 🟡
   - 나중에 (60점 미만): 초록 🟢

## 추가 인자
$ARGUMENTS — 키워드 직접 입력 (쉼표 구분)
--lang ko → 한국어 검색 기준 / --lang en → 영어 기준
--category AI활용법 → 특정 카테고리 강조 채점
