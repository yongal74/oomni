# /collect — 트렌드 소스 수집

오늘의 AI/스타트업 트렌드를 설정된 소스에서 수집하고 정리합니다.

## 실행 단계

1. `C:/oomni-data/research/sources.json` 파일을 읽어 수집 소스 목록을 확인합니다
   - 파일이 없으면 아래 **기본 소스**를 사용합니다

2. 각 소스에서 오늘 날짜 기준 최신 아이템을 수집합니다:
   - 제목 (title)
   - 요약 (summary, 2-3문장)
   - 소스 URL
   - 발행일
   - 조회수/추천수 등 인기 지표 (있을 경우)

## 기본 수집 소스 (우선순위순)

### 🔴 최우선 — 실시간 트렌드 (퍼스트 무버용)
- **Google Trends**: 실시간 급상승 검색어 상위 50개 (trends.google.com/trending?geo=KR + geo=US)
  - 수집: 키워드, 검색량 급증률(%), 관련 쿼리
- **X(Twitter) 트렌딩**: 한국/글로벌 트렌딩 해시태그 + "왜/어떻게" 패턴 필터
  - 수집: 해시태그, 트윗 수, 대표 트윗 2개 요약
- **YouTube 급상승**: 전체 카테고리 급상승 (youtube.com/feed/trending) + AI/테크 필터
  - 수집: 영상 제목, 채널명, 조회수 증가율, 썸네일 키워드

### 🟡 핵심 — 제품/개발자 커뮤니티
- **Product Hunt**: 오늘 상위 10개 제품 + 48시간 내 급상승 예측
  - 수집: 제품명, 설명, 추천수, 태그
- **Hacker News**: Show HN + 오늘 Top 20
  - 수집: 제목, 점수, 댓글수, URL
- **Reddit r/artificial**: 오늘 Hot 10개
- **Reddit r/startups**: 오늘 Hot 5개
- **Reddit r/trending**: 급상승 토픽

### 🟢 선택 — 롱테일/질문 패턴
- **YouTube AI 채널**: AI 전문 채널 최신 영상 10개
- **Reddit r/explainlikeimfive**: "How does X work" 패턴 Top 5

3. 수집된 아이템을 `C:/oomni-data/research/collected_{YYYY-MM-DD}.json`에 저장합니다:
```json
{
  "collected_at": "ISO8601",
  "source": "소스명",
  "source_tier": "realtime|core|optional",
  "items": [
    {
      "title": "제목",
      "summary": "요약",
      "url": "URL",
      "published_at": "날짜",
      "popularity_signal": "조회수/추천수/트윗수 등",
      "trend_velocity": "급상승률 % (있을 경우)"
    }
  ]
}
```

4. 수집 완료 후 총 아이템 수, 소스별 개수, 급상승 1위 키워드를 출력합니다

## 추가 인자
$ARGUMENTS — 특정 키워드가 있으면 해당 키워드 중심으로 수집
--sources google-trends,x-trending,youtube-viral 로 소스를 명시적 지정 가능
