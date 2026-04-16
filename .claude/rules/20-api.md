# 20 — API / 인증 / 스트리밍 규칙

## 인증 구조 (v3.0.0)

- **PIN 전용** (Google OAuth 제거 — auth.ts 715줄 대체)
- 내부 API: `Bearer {내부API키}` (Electron IPC로 주입)
- 퍼블릭 예외 경로 (`app.ts` isPublicPath):
  - `/health`
  - `/auth/**`
  - `/settings/**`
  - `/agents/:id/stream`
  - `/agents/:id/chat` ← 반드시 포함 (없으면 AI 채팅 401)

## Chat 스트리밍 패턴 (lineBuffer 필수)

```typescript
// ✅ 올바른 패턴 — HTTP 청크 경계 JSON 분리 대응
let lineBuffer = ''
// reader.read() 루프 내:
lineBuffer += decoder.decode(value, { stream: true })
const lines = lineBuffer.split('\n')
lineBuffer = lines.pop() ?? ''  // 불완전 라인 보관
for (const line of lines) {
  if (!line.trim()) continue
  const parsed = JSON.parse(line)
  // event 처리
}

// ❌ 금지 패턴
chunk.split('\n').forEach(...)  // 청크 경계에서 JSON 유실
```

## 스트리밍 이벤트 타입

| event | 처리 |
|---|---|
| `stage` | `onStageChange?.(d.stage)` → PipelineBar 업데이트 |
| `text` | 채팅 메시지 누적 |
| `done` | `onChatDone?.()` → isRunning=false, 결과 표시 |
| `error` | 에러 표시 |

## 삭제 대상 라우터 (코드 건드리지 말 것)

- `api/routes/n8n.ts` — 삭제 예정
- `api/routes/video.ts` — 삭제 예정
- `api/routes/payments.ts` — 삭제 예정
- `api/routes/cdp.ts` — 삭제 예정
- `api/routes/devtools.ts` — 삭제 예정
- `api/swagger.ts` — 삭제 예정
