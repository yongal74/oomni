# /aiwx-post — AIWX 스타일 블로그 포스트 생성

AI Wisdom eXchange(AIWX) 블로그 전용 포스트를 생성합니다.
CLAUDE_BLOG.md 필체 기준 + Blogger HTML 출력 + publish_post.py 연동.

## 전제 조건

- `C:/GGAdsense/CLAUDE_BLOG.md` 파일을 반드시 먼저 읽어 필체 기준을 파악합니다
  - 7개 책 카테고리, 라벨 체계, 합쇼체+요/죠 리듬, 최진석 교수 스타일
  - 포스트 길이 기준 (책별 1,000~2,500자)

## 실행 단계

1. **CLAUDE_BLOG.md 로드**
   - `C:/GGAdsense/CLAUDE_BLOG.md` 읽기
   - 7개 카테고리 확인: 각 책의 라벨, 톤앤매너, 길이 기준 파악

2. **입력 분석**
   - $ARGUMENTS: 트렌드 키워드 또는 주제 직접 입력
   - 없으면 `C:/oomni-data/research/trend-alert_{최신}.json` 의 첫 번째 알림 사용

3. **카테고리 매칭**
   - 입력 주제를 CLAUDE_BLOG.md 7개 카테고리에 매칭
   - 가장 적합한 카테고리 선택 → 해당 카테고리의 라벨/스타일/길이 기준 적용

4. **포스트 구조 (AIWX 필수 프레임워크)**
   ```
   [리드] 오늘의 뉴스/트렌드 훅 (2-3문장, 합쇼체)
   [섹션1] 핵심 내용 설명 — "왜 이게 중요한가요?"
   [섹션2] 실제 사례 또는 데이터
   [섹션3] 독자에게 주는 인사이트 (최진석 교수 스타일 질문 포함)
   [섹션4] 실행 가능한 다음 단계
   [CTA] 뉴스레터 구독 / 관련 포스트 링크
   ```

5. **Blogger HTML 포맷으로 출력**
   ```html
   <!-- AIWX Post: {제목} -->
   <!-- Category: {카테고리} | Labels: {라벨1},{라벨2} -->
   <!-- Length: {글자수}자 | CPC-tier: {HIGH/MID/LOW} -->

   <h2>제목 (H2, 롱테일 키워드 포함)</h2>
   <p>리드 문단...</p>
   <h3>소제목1</h3>
   <p>본문...</p>
   ...
   <p><b>→ 오늘의 질문:</b> [독자 참여 유도 질문]</p>
   ```

6. 포스트를 `C:/oomni-data/research/aiwx-post_{YYYY-MM-DD}_{slug}.html`에 저장

7. `C:/GGAdsense/publish_post.py` 가 존재하면 Blogger 발행 준비 상태 안내:
   ```
   python C:/GGAdsense/publish_post.py --file {파일경로} --category {카테고리}
   ```

8. 결과 요약 출력:
   - 포스트 제목
   - 선택된 카테고리 및 라벨
   - 글자수
   - 발행 명령어

## 문체 핵심 원칙 (CLAUDE_BLOG.md 기준 적용)
- 합쇼체 유지: "~합니다", "~입니다", "~죠", "~요" 리듬
- 최진석 교수 스타일: 질문으로 독자 사고 유도
- 데이터 기반: 숫자/비율 반드시 포함
- 클릭베이트 금지: 정확하고 신뢰감 있는 제목

## 추가 인자
$ARGUMENTS — 주제 키워드 직접 지정 (예: "Claude 4.5 출시")
--category AI활용법 → 카테고리 강제 지정
--length 1500 → 목표 글자수
--no-publish → HTML만 생성, publish_post.py 안내 생략
