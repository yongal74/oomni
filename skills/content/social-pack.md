# /social-pack — 하나의 콘텐츠로 모든 SNS 플랫폼용 게시물 생성

블로그 포스트, 제품 업데이트, 성과 발표 등 하나의 원본 콘텐츠를 입력받아 트위터/X, LinkedIn, 인스타그램, 카카오채널, 네이버 블로그에 최적화된 게시물을 한 번에 생성한다.

## 실행 단계

1. **원본 콘텐츠 로드**
   - `$ARGUMENTS`에서 원본 콘텐츠 또는 파일 경로 파싱
   - 또는 최신 블로그 포스트 자동 로드:
     `C:/oomni-data/content/blog/` 최신 파일
   - 콘텐츠 타입 자동 감지: 글/제품업데이트/성과/공지/교육

2. **플랫폼별 특성 파악**
   - **트위터/X**: 280자 제한, 해시태그 2개, 스레드 가능
   - **LinkedIn**: 1300자 이내, 전문적 톤, 해시태그 3-5개
   - **인스타그램**: 시각적 설명 중심, 해시태그 20-30개
   - **카카오 채널**: 카드 형식, 링크 버튼, 짧고 임팩트 있게
   - **네이버 블로그**: SEO 최적화, 키워드 반복, 이미지 설명

3. **트위터/X 게시물 생성**
   단일 트윗 버전 (280자):
   - 핵심 메시지 + 링크
   - 적절한 이모지 (최대 2-3개)
   - 해시태그 2개
   - CTA 포함

   스레드 버전 (최대 8개 트윗):
   - 트윗 1: Hook (강한 첫 문장)
   - 트윗 2-6: 핵심 포인트
   - 트윗 7: 요약
   - 트윗 8: CTA + 링크

4. **LinkedIn 포스트 생성**
   - 강한 첫 줄 (scroll-stopping opening)
   - 단락 간 공백 (가독성)
   - 개인적 인사이트 포함
   - 질문으로 마무리 (댓글 유도)
   - 해시태그 3-5개

5. **인스타그램 캡션 생성**
   - 첫 2줄이 "더 보기" 이전에 표시됨 → 강한 hook
   - 줄바꿈 활용 (가독성)
   - CTA (프로필 링크 또는 댓글 유도)
   - 해시태그 블록 20-30개 (세 그룹: 메인, 니치, 브랜드)

6. **카카오 채널 포스트 생성**
   - 짧고 임팩트 있는 메시지 (100자 이내)
   - 버튼 텍스트 + 링크 URL
   - 이모지로 시각적 강조

7. **이미지 요구사항 명세**
   각 플랫폼별 필요한 이미지 크기와 내용 명세 생성:
   - 트위터: 1200×675px (16:9)
   - 인스타그램 피드: 1080×1080px (1:1)
   - 인스타그램 스토리: 1080×1920px (9:16)
   - LinkedIn: 1200×627px

8. **발행 스케줄 생성**
   최적 게시 시간 (한국 기준):
   - 트위터: 오전 9시, 오후 12시, 오후 9시
   - LinkedIn: 화-목 오전 8-10시
   - 인스타그램: 오전 11시, 오후 7-9시

## 출력 형식

### 소셜 팩 JSON (`social-pack_YYYY-MM-DD.json`)

```json
{
  "generated_at": "YYYY-MM-DDTHH:mm:ssZ",
  "source_type": "blog_post",
  "source_url": "https://oomni.io/blog/[slug]",
  "platforms": {
    "twitter_single": {
      "text": "AI 자동화로 업무를 10배 빠르게? 실제로 해봤습니다.\n\n지난 30일 동안 OOMNI를 사용해서 달라진 점 5가지 👇\n\n🔗 전체 내용: oomni.io/blog/...\n\n#AI자동화 #SaaS",
      "char_count": 112,
      "hashtags": ["#AI자동화", "#SaaS"],
      "image_spec": { "size": "1200x675", "content": "블로그 포스트 OG 이미지" }
    },
    "twitter_thread": [
      { "index": 1, "text": "AI 자동화로 업무를 10배 빠르게 처리하는 방법을 찾고 있다면, 이 스레드를 꼭 읽어보세요 🧵" },
      { "index": 2, "text": "1/ 첫 번째 변화: 리서치 자동화\n..." }
    ],
    "linkedin": {
      "text": "지난 30일, 혼자 SaaS를 운영하면서 배운 것들...\n\n[LinkedIn 포스트 전문]",
      "char_count": 842,
      "hashtags": ["#AI", "#SaaS", "#스타트업", "#자동화", "#인디해커"]
    },
    "instagram": {
      "caption": "AI 자동화로 바뀐 내 하루 ☕\n\n[캡션 전문]",
      "hashtags_block": "#AI자동화 #SaaS #스타트업 ... (30개)",
      "image_specs": [
        { "type": "feed", "size": "1080x1080" },
        { "type": "story", "size": "1080x1920" }
      ]
    },
    "kakao": {
      "message": "AI로 업무 10배 빠르게! 혼자 운영하는 SaaS에서 실제로 검증된 방법",
      "button": { "text": "자세히 보기", "url": "https://oomni.io/blog/..." }
    }
  },
  "schedule": {
    "twitter": "YYYY-MM-DD 09:00",
    "linkedin": "YYYY-MM-DD 08:30",
    "instagram": "YYYY-MM-DD 11:00",
    "kakao": "YYYY-MM-DD 10:00"
  }
}
```

### 소셜 팩 마크다운 (`social-pack_YYYY-MM-DD.md`)

```markdown
# 소셜 팩 — YYYY-MM-DD

## 원본 콘텐츠
제목: [원본 제목]
링크: [URL]

---

## 트위터/X (단일 트윗)
[트윗 내용]

---

## 트위터/X 스레드 (8개)
**트윗 1**: [내용]
**트윗 2**: [내용]
...

---

## LinkedIn
[전문]

---

## 인스타그램 캡션
[캡션]

[해시태그 블록]

---

## 카카오 채널
[메시지]
버튼: [버튼 텍스트] → [URL]
```

## 저장 위치

- `C:/oomni-data/content/social/social-pack_YYYY-MM-DD.json`
- `C:/oomni-data/content/social/social-pack_YYYY-MM-DD.md`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[원본 콘텐츠 또는 파일 경로]`
- `--platforms twitter,linkedin,instagram,kakao` : 대상 플랫폼
- `--type blog|update|achievement|announcement` : 콘텐츠 타입
- `--tone casual|professional|bold` : 전체 톤
- `--thread` : 트위터 스레드 포함 (기본값: true)
- `--schedule` : 최적 발행 시간 자동 계산
- 예시: `/social-pack "C:/oomni-data/content/blog/blog-draft_2026-04-05.md" --platforms twitter,linkedin --tone casual`
