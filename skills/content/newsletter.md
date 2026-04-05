# /newsletter — 뉴스레터 완전 작성 및 발송 준비

`research/newsletter.md`로 수집된 큐레이션 데이터를 기반으로 구독자가 실제로 읽는 뉴스레터 본문을 작성하고, Resend 또는 Mailchimp로 발송 가능한 상태로 준비한다.

## 실행 단계

1. **리서치 데이터 로드**
   - `C:/oomni-data/research/newsletter/newsletter-research_YYYY-MM-DD.json` 읽기
   - 없으면 `research/newsletter.md` 스킬 먼저 실행 안내
   - `C:/oomni-data/config/newsletter-config.json` 읽기:
     - 뉴스레터 이름, 에디터 이름, 구독자 수, 발송 요일
     - 브랜드 색상, 로고 URL
     - 발송 플랫폼 (resend/mailchimp/beehiiv)

2. **뉴스레터 구조 설계**
   섹션 구성:
   ```
   1. 제목 + 미리보기 텍스트
   2. 에디터 레터 (150단어, 개인적 인트로)
   3. 이번 주 핵심 소식 (3개, 각 100단어)
   4. 도구 추천 (1-2개, 간략히)
   5. 숫자로 보는 한 주 (인상적인 통계 3개)
   6. 읽을 거리 (링크 5개 + 한 줄 설명)
   7. 이번 주 인사이트 (에디터 관찰)
   8. 마무리 인사 + CTA
   ```

3. **에디터 레터 작성**
   - 개인적이고 대화체로 작성
   - 이번 주 가장 인상 깊었던 것 1가지
   - 독자와의 공감대 형성
   - 이번 호 미리보기 1문장

4. **콘텐츠 섹션 작성**
   리서치 JSON의 각 섹션을 가독성 높은 뉴스레터 글로 변환:
   - 원문 링크 포함 (CTA 버튼 스타일)
   - 핵심만 추려서 2-3문단
   - 독자가 행동할 수 있는 "당신이 할 수 있는 것" 1줄 추가

5. **React Email 템플릿으로 변환**
   `design/email.md`로 생성된 뉴스레터 이메일 템플릿 사용하여 HTML 이메일 생성

6. **제목 A/B 테스트 준비**
   제목 후보 5개 생성:
   - 숫자형: "이번 주 SaaS에서 꼭 알아야 할 5가지"
   - 질문형: "AI가 당신의 업무를 대체할 준비가 됐나요?"
   - 비밀형: "대부분의 인디해커가 모르는 성장 전략"
   - 직접형: "지금 당장 써야 할 AI 도구 3개"
   - 개인화형: "이번 주 제가 발견한 것"

7. **발송 파일 저장**
   - 마크다운 버전 (편집용)
   - HTML 버전 (이메일 클라이언트용)
   - 텍스트 버전 (Plain text 폴백)

8. **발송 스케줄 설정** (`--send` 옵션 시)
   - Resend API로 예약 발송 설정
   - 발송 확인 이메일 자신에게 먼저 전송

## 출력 형식

### 뉴스레터 마크다운 (`newsletter_YYYY-MM-DD.md`)

```markdown
---
issue: 42
date: YYYY-MM-DD
subject: "[OOMNI 위클리] 이번 주 SaaS 핵심 트렌드 5가지"
preview_text: "AI 자동화의 새 물결, 한국 스타트업 생태계 변화, 그리고 제가 직접 써본 도구들"
---

# OOMNI 위클리 #42 — YYYY년 MM월 DD일

안녕하세요, [구독자 이름]님! 👋

[에디터 레터 150단어]

---

## 📰 이번 주 핵심 소식

### 1. [소식 제목]
[2-3문단 설명]
**당신이 할 수 있는 것**: [행동 제안]
🔗 [자세히 읽기](URL)

### 2. [소식 제목 2]
...

---

## 🛠️ 이번 주 도구 추천

**[도구 이름]** — [한 줄 설명]
> "[실제 사용 후기 1문장]"
🔗 [무료로 시작하기](URL)

---

## 📊 숫자로 보는 한 주

- 🔢 **[숫자]**: [설명]
- 🔢 **[숫자]**: [설명]
- 🔢 **[숫자]**: [설명]

---

## 📚 읽을 거리

1. [제목](URL) — [한 줄 설명]
2. ...

---

## 💭 이번 주 인사이트

[에디터의 개인적 관찰 200단어]

---

좋은 한 주 보내세요! 🚀
[에디터 이름]

[수신 거부 링크] | [구독 관리]
```

### 발송 설정 JSON

```json
{
  "issue": 42,
  "date": "YYYY-MM-DD",
  "subjects": {
    "a": "[OOMNI 위클리] 이번 주 SaaS 핵심 트렌드 5가지",
    "b": "[OOMNI 위클리] AI가 바꾸는 혼자 운영하는 SaaS"
  },
  "preview_text": "AI 자동화의 새 물결...",
  "from": "editor@oomni.io",
  "list_id": "newsletter-subscribers",
  "scheduled_at": "YYYY-MM-DD 09:00:00+09:00",
  "files": {
    "markdown": "C:/oomni-data/content/newsletter/newsletter_YYYY-MM-DD.md",
    "html": "C:/oomni-data/content/newsletter/newsletter_YYYY-MM-DD.html",
    "text": "C:/oomni-data/content/newsletter/newsletter_YYYY-MM-DD.txt"
  }
}
```

## 저장 위치

- `C:/oomni-data/content/newsletter/newsletter_YYYY-MM-DD.md`
- `C:/oomni-data/content/newsletter/newsletter_YYYY-MM-DD.html`
- `C:/oomni-data/content/newsletter/newsletter_YYYY-MM-DD.txt`
- `C:/oomni-data/content/newsletter/newsletter-config_YYYY-MM-DD.json`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--issue 42` : 호 번호 지정 (기본값: 자동 증가)
- `--tone personal|professional` : 에디터 톤 (기본값: personal)
- `--length short|standard|long` : 뉴스레터 길이
- `--send` : 완료 후 Resend로 즉시 발송
- `--schedule "2026-04-07 09:00"` : 예약 발송
- `--preview` : HTML 미리보기 브라우저에서 열기
- 예시: `/newsletter --issue 43 --schedule "2026-04-07 09:00" --tone personal`
