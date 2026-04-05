# /collect — 트렌드 소스 수집

오늘의 AI/스타트업 트렌드를 설정된 소스에서 수집하고 정리합니다.

## 실행 단계

1. `C:/oomni-data/research/sources.json` 파일을 읽어 수집 소스 목록을 확인합니다
   - 파일이 없으면 기본 소스(TechCrunch, Product Hunt, Hacker News, Reddit r/artificial, Reddit r/startups, YouTube AI)를 사용합니다

2. 각 소스에서 오늘 날짜 기준 최신 아이템 10개씩 수집합니다:
   - 제목 (title)
   - 요약 (summary, 2-3문장)
   - 소스 URL
   - 발행일

3. 수집된 아이템을 `C:/oomni-data/research/collected_{YYYY-MM-DD}.json`에 저장합니다:
```json
{
  "collected_at": "ISO8601",
  "source": "소스명",
  "items": [
    {
      "title": "제목",
      "summary": "요약",
      "url": "URL",
      "published_at": "날짜"
    }
  ]
}
```

4. 수집 완료 후 총 아이템 수와 소스별 개수를 출력합니다

## 추가 인자
$ARGUMENTS — 특정 키워드가 있으면 해당 키워드 중심으로 수집
