# /short-form-script — 바이럴 숏폼 영상 대본 생성 (Reels/Shorts/TikTok)

60초 이내 숏폼 영상의 바이럴 대본을 생성한다. Hook-Problem-Solution-Proof-CTA 구조로 3가지 훅 변형을 생성하고, Vrew 임포트용 TXT와 Remotion 렌더링용 JSON을 함께 출력한다.

## 실행 단계

1. **콘텐츠 기획**
   - `$ARGUMENTS`에서 주제, 핵심 메시지, 타겟 시청자 파싱
   - `C:/oomni-data/research/` 최신 데이터에서 관련 인사이트 수집
   - 동일 주제 바이럴 영상 참고 패턴 분석
   - 플랫폼 결정: YouTube Shorts / Instagram Reels / TikTok

2. **훅 변형 3가지 설계**
   각기 다른 심리적 트리거 사용:
   - **훅 A — 충격/호기심**: "대부분의 사람이 모르는 사실이 있어요"
   - **훅 B — 공감/고통**: "혼자 SaaS 운영하면서 이렇게 지쳐본 적 있죠?"
   - **훅 C — 결과 먼저**: "저 이거로 한 달에 ₩300만원 절약했어요"

3. **5단계 구조 대본 작성**
   각 훅 변형에 대해 완전한 대본 작성:

   **Hook (0-3초)**: 스크롤 멈추게 하는 첫 문장
   - 시각적으로도 강한 오프닝
   - 텍스트 오버레이 내용 포함
   - 말하는 속도: 빠름 (1.2배속 기준)

   **Problem (3-8초)**: 공감 유발 문제 제시
   - 시청자가 고개를 끄덕이는 공감 포인트
   - 구체적 수치나 경험 포함

   **Solution (8-25초)**: 핵심 해결책 제시
   - 3가지 이하로 핵심만
   - 화면 설명 (무엇을 보여줄지)

   **Proof (25-50초)**: 증거와 결과
   - 전후 비교
   - 구체적 숫자 (%)
   - 스크린샷 또는 결과물 화면

   **CTA (50-60초)**: 행동 유도
   - 저장/팔로우/링크 클릭
   - 강한 마무리 문장

4. **자막 타임코드 생성**
   각 문장마다 시작/종료 타임코드 (밀리초 단위)

5. **Vrew 임포트용 TXT 생성**
   - 각 줄이 하나의 자막 세그먼트
   - `[타임코드] 텍스트` 형식

6. **Remotion 프롭 JSON 생성**
   Remotion으로 영상 자동 편집할 때 사용하는 props:
   - 각 씬의 텍스트, 배경, 애니메이션 타입
   - 음악 타이밍 정보
   - 화면 전환 효과

7. **촬영 가이드 생성**
   - 각 씬 촬영 방법 (앵글, 배경, 소품)
   - 필요한 화면 녹화 목록
   - 권장 B-roll 목록

## 출력 형식

### 메인 대본 파일 (`short-form_YYYY-MM-DD_HHmm.md`)

```markdown
# 숏폼 대본 — [주제]

**플랫폼**: YouTube Shorts / Instagram Reels
**목표 길이**: 55초
**메인 키워드**: #AI자동화 #SaaS #인디해커

---

## 훅 A — "충격/호기심" 버전

### 대본

| 구간 | 시간 | 대사 | 화면 |
|------|------|------|------|
| Hook | 0-3s | "대부분의 SaaS 창업자가 이걸 몰라서 망합니다." | [자막: 큰 글씨 "아는 사람 vs 모르는 사람"] |
| Problem | 3-8s | "매일 반복하는 리서치, 콘텐츠, 고객 응대... 혼자 하면 하루가 부족하죠?" | [화면: 많은 탭이 열린 브라우저] |
| Solution | 8-25s | "저는 이 세 가지만 자동화했어요. 첫 번째, 리서치는 AI가 대신합니다. 두 번째, 콘텐츠는 하나 만들면 다섯 개가 됩니다. 세 번째, 고객 응대는 챗봇이 80% 처리합니다." | [화면: n8n 워크플로우 3개 순서대로] |
| Proof | 25-50s | "결과요? 하루 16시간에서 6시간으로 줄었어요. 수익은 그대로인데 시간이 생겼습니다." | [화면: 작업 시간 비교 그래프] |
| CTA | 50-55s | "어떻게 했는지 프로필에 링크 걸어뒀어요. 저장해두고 나중에 봐도 돼요." | [화면: 화면에 손가락으로 저장 아이콘 가리키기] |

---

## 훅 B — "공감/고통" 버전

[동일 구조]

---

## 훅 C — "결과 먼저" 버전

[동일 구조]

---

## 공통 촬영 가이드

### 필요한 촬영
- [ ] 메인 카메라 (정면, 상반신)
- [ ] 화면 녹화: n8n 워크플로우
- [ ] 화면 녹화: 대시보드 지표

### 권장 B-roll
- 노트북 타이핑 (클로즈업)
- 커피 들고 있는 손
- 앱 알림 화면
```

### Vrew 임포트 TXT (`short-form-vrew_YYYY-MM-DD_훅A.txt`)

```
00:00:00.000 대부분의 SaaS 창업자가 이걸 몰라서 망합니다.
00:00:03.000 매일 반복하는 리서치, 콘텐츠, 고객 응대...
00:00:05.500 혼자 하면 하루가 부족하죠?
00:00:08.000 저는 이 세 가지만 자동화했어요.
00:00:10.500 첫 번째, 리서치는 AI가 대신합니다.
00:00:13.000 두 번째, 콘텐츠는 하나 만들면 다섯 개가 됩니다.
00:00:16.500 세 번째, 고객 응대는 챗봇이 80% 처리합니다.
00:00:25.000 결과요? 하루 16시간에서 6시간으로 줄었어요.
00:00:30.000 수익은 그대로인데 시간이 생겼습니다.
00:00:50.000 어떻게 했는지 프로필에 링크 걸어뒀어요.
00:00:52.500 저장해두고 나중에 봐도 돼요.
```

### Remotion 프롭 JSON (`short-form-remotion_YYYY-MM-DD_훅A.json`)

```json
{
  "version": "1.0",
  "duration_frames": 1650,
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "hook_variant": "A",
  "scenes": [
    {
      "id": "hook",
      "start_frame": 0,
      "end_frame": 90,
      "type": "text_overlay",
      "text": "대부분의 SaaS 창업자가\n이걸 몰라서 망합니다.",
      "text_style": { "fontSize": 72, "fontWeight": "bold", "color": "#FFFFFF", "align": "center" },
      "background": { "type": "color", "value": "#1a1a2e" },
      "animation": { "in": "slide_up", "out": "fade" },
      "audio_beat_sync": true
    },
    {
      "id": "problem",
      "start_frame": 90,
      "end_frame": 240,
      "type": "screen_recording",
      "source": "B:/recordings/browser-tabs.mp4",
      "subtitle": "매일 반복하는 리서치, 콘텐츠, 고객 응대...",
      "subtitle_style": { "fontSize": 48, "background": "rgba(0,0,0,0.7)" }
    },
    {
      "id": "solution_1",
      "start_frame": 240,
      "end_frame": 390,
      "type": "screen_recording",
      "source": "B:/recordings/n8n-workflow-1.mp4",
      "subtitle": "첫 번째, 리서치는 AI가 대신합니다."
    },
    {
      "id": "proof",
      "start_frame": 750,
      "end_frame": 1500,
      "type": "animated_chart",
      "chart_data": { "before": 16, "after": 6, "unit": "시간" },
      "subtitle": "하루 16시간 → 6시간"
    },
    {
      "id": "cta",
      "start_frame": 1500,
      "end_frame": 1650,
      "type": "text_overlay",
      "text": "프로필 링크에서\n전체 가이드 확인하세요 👆",
      "animation": { "in": "bounce", "out": "fade" }
    }
  ],
  "music": {
    "track": "upbeat_electronic_01.mp3",
    "volume": 0.3,
    "fade_out_start_frame": 1560
  },
  "hashtags": ["#AI자동화", "#SaaS", "#인디해커", "#1인창업", "#자동화"],
  "caption": "대본 훅 A 버전 전체 캡션..."
}
```

## 저장 위치

- `C:/oomni-data/content/short-form/short-form_YYYY-MM-DD_HHmm.md`
- `C:/oomni-data/content/short-form/short-form-vrew_YYYY-MM-DD_훅A.txt`
- `C:/oomni-data/content/short-form/short-form-vrew_YYYY-MM-DD_훅B.txt`
- `C:/oomni-data/content/short-form/short-form-vrew_YYYY-MM-DD_훅C.txt`
- `C:/oomni-data/content/short-form/short-form-remotion_YYYY-MM-DD_훅A.json`
- `C:/oomni-data/content/short-form/short-form-remotion_YYYY-MM-DD_훅B.json`
- `C:/oomni-data/content/short-form/short-form-remotion_YYYY-MM-DD_훅C.json`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[주제] [핵심 메시지]`
- `--platform shorts|reels|tiktok|all` : 대상 플랫폼 (기본값: shorts,reels)
- `--length 30|45|60` : 목표 길이 초 (기본값: 60)
- `--hooks 1|2|3` : 훅 변형 개수 (기본값: 3)
- `--lang ko|en|bilingual` : 자막 언어
- `--remotion` : Remotion JSON 생성 (기본값: true)
- `--vrew` : Vrew TXT 생성 (기본값: true)
- 예시: `/short-form-script "AI 자동화로 절약한 시간" "하루 10시간 → 4시간" --platform shorts,reels --length 60`
