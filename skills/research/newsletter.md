# /research-newsletter — 뉴스레터 발송을 위한 업계 동향 리서치

지정된 토픽 또는 산업 키워드를 기반으로 최신 뉴스, 트렌드, 인사이트를 수집하고, 뉴스레터 에디터가 바로 사용할 수 있는 큐레이션 패키지를 생성한다. `content/newsletter.md` 스킬과 체이닝하여 최종 발송 콘텐츠까지 원스톱으로 생성 가능.

## 실행 단계

1. **토픽 설정 로드**
   - `C:/oomni-data/config/newsletter-topics.json` 읽기
   - 파일이 없으면 `$ARGUMENTS`에서 토픽 추출
   - 기본 토픽: `["AI SaaS", "한국 스타트업", "자동화 도구", "인디해커", "노코드"]`

2. **소스별 수집**
   다음 소스에서 지난 7일 내 콘텐츠 수집:
   - **뉴스**: Google News RSS (한국어 + 영어 각 10개)
   - **트위터/X**: 각 토픽 키워드 트윗 상위 5개 (좋아요 + RT 기준)
   - **Product Hunt**: 지난 7일 상위 런치 10개
   - **Hacker News**: 관련 스레드 상위 5개
   - **유튜브**: 조회수 급상승 영상 3개 (제목 + 요약)
   - **레딧**: r/SaaS, r/entrepreneur 핫 포스트 5개

3. **품질 필터링**
   - 중복 URL 제거
   - 제목에 클릭베이트 패턴 감지 및 제외 (예: "충격", "경악", "이것만 알면")
   - 7일 이상 된 콘텐츠 제외
   - 광고성 콘텐츠 제외 (도메인 블랙리스트 적용)

4. **카테고리 분류 및 요약**
   각 항목을 다음 카테고리로 분류:
   - `🔥 이번 주 핫이슈` (최대 3개)
   - `🛠️ 도구 & 제품` (최대 5개)
   - `📊 데이터 & 리서치` (최대 3개)
   - `💡 창업자 인사이트` (최대 4개)
   - `🌏 글로벌 동향` (최대 3개)

   각 항목에 대해:
   - 원문 링크
   - 한국어 1줄 요약 (80자 이내)
   - 왜 중요한지 (30자 이내)
   - 독자 관련성 점수 (1-10)

5. **에디터 노트 생성**
   - 이번 주 전체 트렌드를 관통하는 테마 1개 도출
   - 에디터 오프닝 문구 초안 3가지 생성 (각 2문장)
   - 뉴스레터 제목 후보 5개 생성

6. **파일 저장**
   - 큐레이션 JSON 저장
   - 에디터용 마크다운 저장
   - `content/newsletter.md` 스킬 자동 호출 여부 묻기

## 출력 형식

### 큐레이션 JSON (`newsletter-research_YYYY-MM-DD.json`)

```json
{
  "week": "YYYY-WW",
  "generated_at": "YYYY-MM-DDTHH:mm:ssZ",
  "theme": "이번 주를 관통하는 핵심 테마",
  "title_candidates": [
    "뉴스레터 제목 후보 1",
    "뉴스레터 제목 후보 2"
  ],
  "opening_drafts": [
    "에디터 오프닝 초안 1 (2문장)",
    "에디터 오프닝 초안 2 (2문장)"
  ],
  "sections": {
    "hot_issues": [
      {
        "title": "기사 제목",
        "url": "https://...",
        "summary_ko": "한국어 1줄 요약",
        "why_important": "왜 중요한지",
        "relevance_score": 9,
        "source": "TechCrunch",
        "published_at": "YYYY-MM-DD"
      }
    ],
    "tools_products": [],
    "data_research": [],
    "founder_insights": [],
    "global_trends": []
  },
  "stats": {
    "total_collected": 87,
    "after_filter": 23,
    "sources_used": ["Google News", "Product Hunt", "HN"]
  }
}
```

### 에디터용 마크다운 (`newsletter-draft_YYYY-MM-DD.md`)

```markdown
# 뉴스레터 큐레이션 — YYYY년 MM월 DD일 호

**이번 주 테마**: [테마]

**추천 제목**: [제목 후보 1]

---

## 에디터 오프닝 초안
> [초안 1]

---

## 🔥 이번 주 핫이슈

### [기사 제목]
[한국어 요약] — [왜 중요한지]
🔗 [원문 링크]

...
```

## 저장 위치

- `C:/oomni-data/research/newsletter/newsletter-research_YYYY-MM-DD.json`
- `C:/oomni-data/research/newsletter/newsletter-draft_YYYY-MM-DD.md`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--topics "AI,SaaS,한국스타트업"` : 커스텀 토픽 지정 (쉼표 구분)
- `--days 14` : 수집 기간 변경 (기본값: 7일)
- `--lang ko` : 출력 언어 (기본값: ko)
- `--auto-chain` : 완료 후 `content/newsletter.md` 자동 실행
- 예시: `/research-newsletter --topics "노코드,Bubble,Make" --auto-chain`
