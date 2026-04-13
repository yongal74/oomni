# /trend-alert — 48시간 퍼스트 무버 자동 파이프라인

급상승 트렌드를 감지하고 즉시 AIWX 포스트 초안을 생성합니다.
n8n 트리거(매일 오전 6시) 또는 수동 실행 모두 지원합니다.

## 실행 순서 (자동 파이프라인)

```
① /collect --sources google-trends,x-trending,youtube-viral
      ↓
② /score --mode seo
      ↓
③ /trend-alert (70점 이상 → 즉시 AIWX 포스트 초안 생성)
      ↓
④ /aiwx-post (AIWX 필체로 포맷 → Blogger 발행 준비)
```

## 실행 단계

1. `C:/oomni-data/research/scored_{오늘날짜}.json` 파일을 읽습니다
   - 없으면 `/collect` → `/score --mode seo` 를 먼저 실행

2. **signal_score ≥ 70** 이고 **퍼스트 무버 가능성 점수 ≥ 6** 인 아이템 필터링

3. 각 알림 아이템에 대해:
   - 트렌드 키워드 추출
   - 검색 의도 분류 (informational/commercial)
   - 추천 AIWX 카테고리 매칭 (CLAUDE_BLOG.md 참조)
   - 예상 CPC 카테고리 표시
   - 포스트 제목 후보 3개 생성 (롱테일 키워드 포함)

4. 알림 결과를 `C:/oomni-data/research/trend-alert_{YYYY-MM-DD_HH}.json`에 저장:
```json
{
  "alerted_at": "ISO8601",
  "alerts": [
    {
      "title": "원본 트렌드 제목",
      "signal_score": 82,
      "first_mover_window": "6시간 이내",
      "aiwx_category": "AI 활용법",
      "cpc_tier": "HIGH",
      "post_title_candidates": [
        "롱테일 키워드 포함 제목 1",
        "롱테일 키워드 포함 제목 2",
        "롱테일 키워드 포함 제목 3"
      ],
      "recommended_action": "/aiwx-post 로 즉시 초안 생성"
    }
  ]
}
```

5. 알림 아이템이 있으면 즉시 각 아이템에 대해 `/aiwx-post` 초안 생성 요청

6. 결과 요약 출력:
   - 알림 발생 건수
   - 퍼스트 무버 가능 창 (n시간 이내)
   - 생성된 포스트 초안 파일 목록

## 추가 인자
$ARGUMENTS — 특정 카테고리 필터 (예: --category AI활용법)
--threshold 80 → 점수 기준 변경 (기본: 70)
--dry-run → 알림만 출력, 포스트 초안 생성 생략
