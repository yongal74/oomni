# /new-n8n-workflow — n8n 자동화 워크플로우 설계 및 JSON 생성

자동화할 작업을 입력받아 n8n 워크플로우 JSON을 생성한다. 트리거 설정, 노드 연결, 에러 핸들링, 실행 스케줄까지 포함한 즉시 임포트 가능한 워크플로우 파일을 만든다.

## 실행 단계

1. **자동화 요구사항 파악**
   - `$ARGUMENTS`에서 자동화 목표, 입력 소스, 출력 대상 파싱
   - 기존 워크플로우 확인: `C:/oomni-data/ops/n8n-workflows/` 디렉터리
   - 중복 자동화 방지

2. **워크플로우 아키텍처 설계**
   설계 요소:
   - **트리거 노드**: Schedule / Webhook / Manual / 이벤트
   - **데이터 수집 노드**: HTTP Request, DB 쿼리, RSS, API
   - **처리 노드**: Function(Code), Set, IF 조건, Switch, Merge
   - **AI 처리 노드**: Claude API / OpenAI / Perplexity 호출
   - **출력 노드**: Webhook, Telegram, Slack, Email, DB 저장, 파일 저장
   - **에러 핸들링**: Error Trigger → Telegram 알림

3. **노드별 설정 세부화**
   각 노드에 대해:
   - 노드 타입 및 버전
   - 인증 정보 참조 키 (credentials ID)
   - 파라미터 설정 (표현식 포함)
   - 출력 필드 매핑
   - 실패 시 동작

4. **n8n 워크플로우 JSON 생성**
   n8n에서 직접 임포트 가능한 완전한 JSON 구조 생성.
   노드 ID는 UUID 형식으로 생성. 노드 위치는 x/y 좌표 자동 계산.

5. **에러 핸들링 워크플로우 추가**
   별도 Error Trigger 노드 포함:
   - 에러 발생 시 Telegram으로 오류 메시지 발송
   - 에러 내용 파일로 저장

6. **실행 로그 설정**
   Code 노드로 실행 결과를 `C:/oomni-data/logs/n8n/` 에 저장하는 로직 포함

7. **워크플로우 문서 생성**
   - 플로우차트 텍스트 다이어그램 (ASCII)
   - 각 노드 설명 및 설정 방법
   - 필요한 Credentials 목록
   - 문제 해결 가이드

8. **임포트 가이드 제공**
   ```
   1. n8n 열기 (http://localhost:5678)
   2. 좌측 메뉴 → Workflows → Import from File
   3. 생성된 JSON 파일 선택
   4. Credentials 연결 확인
   5. Active 토글 ON
   ```

## 출력 형식

### 워크플로우 설계 문서 (`n8n-[이름]_YYYY-MM-DD.md`)

```markdown
# n8n 워크플로우: [이름]

**목적**: 매일 아침 AI SaaS 인사이트 수집 후 Telegram 발송
**트리거**: 매일 오전 7시 KST (Schedule)
**예상 실행 시간**: ~90초
**필요 Credentials**: Perplexity API, Telegram Bot

---

## 플로우차트

```
[Schedule: 07:00 KST]
        │
        ▼
[HTTP: Perplexity 검색]
        │
        ▼
[Code: 응답 파싱]
        │
        ▼
[IF: 인사이트 있음?]
   YES ─┤├─ NO
        │         │
        ▼         ▼
[Telegram: 결과] [Telegram: "없음"]
        │
        ▼
[Code: 파일로 저장]
```

---

## 필요한 Credentials

| ID | 타입 | 설정 방법 |
|----|------|---------|
| `perplexity_api` | HTTP Bearer Auth | Perplexity 대시보드 → API Keys |
| `telegram_bot` | Telegram Bot | @BotFather → /newbot |

---

## 노드 설명

### Schedule Trigger
매일 오전 7시 정각 실행. 한국 시간(Asia/Seoul) 기준.

### HTTP Request — Perplexity
Perplexity sonar 모델로 실시간 웹 검색. 오늘 날짜 포함한 프롬프트 전송.

### Code — 파싱
응답 JSON에서 콘텐츠 추출, 줄바꿈 기준 분리, 빈 줄 제거.

### Telegram
OOMNI Bot을 통해 지정된 채팅방으로 마크다운 포맷 메시지 발송.
```

### n8n 워크플로우 JSON (`n8n-[이름]_YYYY-MM-DD.json`)

```json
{
  "name": "Daily Research — AI SaaS Insights",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 7 * * *" }]
        }
      },
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Daily 7AM KST",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.perplexity.ai/chat/completions",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpBearerAuth",
        "sendBody": true,
        "contentType": "json",
        "body": "={\n  \"model\": \"llama-3.1-sonar-large-128k-online\",\n  \"messages\": [{\"role\": \"user\", \"content\": \"{{ $now.format('YYYY년 MM월 DD일') }} 오늘의 AI SaaS 주목할 동향 5개를 한국어로 요약해주세요. 각 항목은 번호와 함께 작성하세요.\"}]\n}"
      },
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "Perplexity Search",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [460, 300],
      "credentials": { "httpBearerAuth": { "id": "perplexity_api", "name": "Perplexity API" } }
    },
    {
      "parameters": {
        "jsCode": "const response = $input.first().json;\nconst content = response.choices?.[0]?.message?.content ?? '';\nconst insights = content.split('\\n').filter(l => l.trim().length > 10);\nconst today = new Date().toISOString().split('T')[0];\nreturn [{ json: { insights, count: insights.length, date: today, raw: content } }];"
      },
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "name": "Parse Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, 300]
    },
    {
      "parameters": {
        "conditions": {
          "options": { "caseSensitive": true },
          "conditions": [{ "id": "cond1", "leftValue": "={{ $json.count }}", "rightValue": 0, "operator": { "type": "number", "operation": "larger" } }]
        }
      },
      "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
      "name": "Has Insights?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [900, 300]
    },
    {
      "parameters": {
        "chatId": "={{ $env.TELEGRAM_CHAT_ID }}",
        "text": "=📊 *오늘의 AI SaaS 인사이트* — {{ $json.date }}\\n\\n{{ $json.insights.join('\\n\\n') }}\\n\\n🤖 OOMNI Research Bot",
        "additionalFields": { "parse_mode": "Markdown" }
      },
      "id": "e5f6a7b8-c9d0-1234-efab-345678901234",
      "name": "Send Insights",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.1,
      "position": [1120, 200],
      "credentials": { "telegramApi": { "id": "telegram_bot", "name": "OOMNI Bot" } }
    },
    {
      "parameters": {
        "chatId": "={{ $env.TELEGRAM_CHAT_ID }}",
        "text": "ℹ️ {{ $json.date }} — 오늘은 주목할 AI SaaS 인사이트가 없습니다.",
        "additionalFields": {}
      },
      "id": "f6a7b8c9-d0e1-2345-fabc-456789012345",
      "name": "Send Empty Notice",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.1,
      "position": [1120, 400],
      "credentials": { "telegramApi": { "id": "telegram_bot", "name": "OOMNI Bot" } }
    }
  ],
  "connections": {
    "Daily 7AM KST": { "main": [[{ "node": "Perplexity Search", "type": "main", "index": 0 }]] },
    "Perplexity Search": { "main": [[{ "node": "Parse Response", "type": "main", "index": 0 }]] },
    "Parse Response": { "main": [[{ "node": "Has Insights?", "type": "main", "index": 0 }]] },
    "Has Insights?": {
      "main": [
        [{ "node": "Send Insights", "type": "main", "index": 0 }],
        [{ "node": "Send Empty Notice", "type": "main", "index": 0 }]
      ]
    }
  },
  "active": false,
  "settings": { "executionOrder": "v1", "timezone": "Asia/Seoul", "saveExecutionProgress": true }
}
```

## 저장 위치

- `C:/oomni-data/ops/n8n-workflows/n8n-[이름]_YYYY-MM-DD.json`
- `C:/oomni-data/ops/n8n-workflows/n8n-[이름]_YYYY-MM-DD.md`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[워크플로우 이름] [목적 설명]`
- `--trigger schedule|webhook|manual` : 트리거 타입 (기본값: schedule)
- `--schedule "0 7 * * *"` : cron 표현식
- `--input http|rss|db|webhook` : 데이터 소스 타입
- `--output telegram|slack|email|db|file` : 출력 대상 (복수 가능)
- `--ai claude|gpt4|perplexity` : 사용할 AI API
- `--error-notify` : 에러 발생 시 Telegram 알림 노드 포함
- 예시: `/new-n8n-workflow "daily-research" "매일 아침 AI SaaS 인사이트 수집" --trigger schedule --schedule "0 7 * * *" --ai perplexity --output telegram --error-notify`
