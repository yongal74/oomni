# /blog-post — SEO 최적화 블로그 포스트 완전 작성

키워드와 주제를 입력받아 검색 상위 노출을 목표로 하는 심층 블로그 포스트를 작성한다. SEO 최적화, 구조화된 데이터, 한국어/영어 버전, Next.js MDX 파일까지 생성한다.

## 실행 단계

1. **키워드 리서치**
   - `$ARGUMENTS`에서 메인 키워드와 주제 추출
   - `C:/oomni-data/research/reports/` 최신 리서치 파일에서 관련 인사이트 수집
   - 롱테일 키워드 5-10개 도출
   - 경쟁 포스트 분석 (동일 키워드로 상위 노출 중인 글 구조 파악)

2. **포스트 구조 설계**
   AIDA 프레임워크 기반 구성:
   - **제목**: 숫자 + 키워드 + 혜택 (예: "2026년 AI SaaS 자동화 완벽 가이드: 5가지 핵심 전략")
   - **메타 설명**: 155자 이내, 키워드 포함, 클릭 유도 문구
   - **소개**: 문제 제기 → 해결 예고 → 독자 혜택 (150단어 이내)
   - **본문**: H2 섹션 5-8개, 각 섹션 H3 2-3개
   - **결론**: 핵심 요약 + CTA

3. **콘텐츠 작성**
   각 섹션별로:
   - 정확한 정보와 데이터 포함 (출처 명시)
   - 코드 예시 또는 실제 사례 포함
   - 독자 행동 유도 문구
   - 관련 내부 링크 제안 3개

4. **SEO 최적화**
   - H1 태그에 메인 키워드 포함
   - 첫 100단어 내 키워드 등장
   - 이미지 ALT 텍스트 (모든 이미지)
   - Internal linking 3개, External linking 2개
   - 읽기 난이도: 중급 (Flesch-Kincaid 기준)
   - 단락 최대 4문장 (모바일 가독성)

5. **MDX 파일 생성**
   파일 위치: `content/blog/[slug]/index.mdx`

   Front Matter 포함:
   ```yaml
   title: ""
   description: ""
   date: YYYY-MM-DD
   author: "이름"
   tags: []
   category: ""
   featured: false
   image: "/blog/[slug]/cover.jpg"
   ```

6. **소셜 공유 준비**
   - 트위터 스레드 버전 자동 생성 (`content/thread-twitter.md` 스킬과 연동)
   - LinkedIn 포스트 버전 (800자)
   - 카카오톡 공유 메시지

7. **영어 번역본 생성** (선택)
   `--bilingual` 옵션 시 영어 버전도 함께 생성

## 출력 형식

### MDX 파일 구조

```mdx
---
title: "2026년 AI SaaS 자동화 완벽 가이드: 5가지 핵심 전략"
description: "AI 자동화로 SaaS 업무 효율을 10배 높이는 방법. 실제 사례와 코드 예시로 쉽게 따라할 수 있습니다."
date: 2026-04-05
author: "장우경"
tags: ["AI", "SaaS", "자동화", "생산성"]
category: "가이드"
featured: true
image: "/blog/ai-saas-automation-guide/cover.jpg"
readingTime: 8
---

import { Callout } from '@/components/blog/Callout'
import { CodeBlock } from '@/components/blog/CodeBlock'

## 왜 AI 자동화가 지금 중요한가

[도입부 — 문제 제기 150단어]

<Callout type="info">
  💡 이 글에서 배울 수 있는 것: [핵심 학습 포인트 3가지]
</Callout>

## 1. [첫 번째 핵심 전략]

[본문 300-400단어]

### 실제 적용 방법

[구체적 방법 설명]

```typescript
// 실제 코드 예시
```

[나머지 섹션...]

## 마무리: 지금 바로 시작하는 법

[결론 100단어 + CTA]
```

### 소셜 공유 파일 (`blog-social_YYYY-MM-DD.md`)

```markdown
## 트위터/X 스레드 버전
[280자 × 8개 트윗]

## LinkedIn 포스트 버전
[800자 단일 포스트]

## 카카오톡 공유 버전
[200자 + 링크]
```

## 저장 위치

- `C:/Users/장우경/oomni/backend/content/blog/[slug]/index.mdx`
- `C:/oomni-data/content/blog/blog-draft_YYYY-MM-DD.md`
- `C:/oomni-data/content/blog/blog-social_YYYY-MM-DD.md`
- `C:/oomni-data/content/blog/blog-seo-brief_YYYY-MM-DD.json`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[메인 키워드] [주제 설명]`
- `--length short|medium|long` : 글 길이 (short: 800자, medium: 1500자, long: 3000자+)
- `--bilingual` : 한/영 동시 작성
- `--no-code` : 코드 예시 없이 작성
- `--tone technical|casual|storytelling` : 글 톤
- `--auto-social` : 완료 후 소셜 패키지 자동 생성
- 예시: `/blog-post "AI 자동화 SaaS" "혼자 운영하는 SaaS에서 AI로 업무 자동화하기" --length long --bilingual`
