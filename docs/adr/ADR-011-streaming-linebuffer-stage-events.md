# ADR-011: Streamable HTTP — lineBuffer 패턴 + Stage 이벤트 파이프라인

**Date**: 2026-04-14
**Status**: Accepted
**Version**: v2.9.15

## Context

`POST /api/agents/:id/chat` 엔드포인트는 `Transfer-Encoding: chunked` HTTP 스트리밍으로 JSON 라인 이벤트를 전송한다:

```
{"event":"start","data":{...}}\n
{"event":"stage","data":{"stage":"collecting"}}\n
{"event":"output","data":{"chunk":"text delta"}}\n
{"event":"done","data":{}}\n
```

프론트엔드(`AntigravityRightPanel.handleRun`)는 `response.body.getReader()`로 수신 후 파싱했다.

### 버그 1 — "결과 없음" (lineBuffer 미적용)

기존 코드:
```typescript
const chunk = decoder.decode(value, { stream: true })
const lines = chunk.split('\n')
for (const line of lines) {
  JSON.parse(line)  // 불완전한 라인이면 파싱 실패 → catch → 묵시적 무시
}
```

Node.js가 여러 이벤트를 하나의 TCP 패킷으로 묶어 전송할 때, `reader.read()` 한 번에 여러 JSON 라인이 올 수 있다. 이때 패킷 경계에서 JSON 라인이 중간에 잘리면:
- `JSON.parse(incomplete)` 실패 → catch에서 묵시적으로 무시
- 해당 `output` 이벤트의 텍스트 유실
- 모든 토큰이 이런 식으로 누락되면 `accumulated === ''` → "(결과 없음)"

Anthropic API는 토큰 하나씩 `send('output', { chunk: delta })` 이벤트를 100~500개 전송하므로 분리 빈도가 높다.

### 버그 2 — PipelineBar 단계 비동기화

백엔드 executor들은 `send('stage', { stage: 'collecting', label: '...' })`을 전송하지만 프론트엔드 스트리밍 루프가 `'output'`과 `'error'`만 처리하고 `'stage'` 이벤트를 완전히 무시했다.

추가로 `onChatStart`에서 `setCurrentStage('running')`을 설정했으나 `'running'`은 research/ops/ceo/content/growth 스테이지 목록에 없는 키라서 PipelineBar의 `findIndex`가 -1을 반환 → 모든 단계가 회색으로 표시됐다.

## Decision

### lineBuffer 패턴 적용 (필수)

```typescript
let lineBuffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  lineBuffer += decoder.decode(value, { stream: true })
  const lines = lineBuffer.split('\n')
  lineBuffer = lines.pop() ?? ''  // 불완전한 마지막 라인은 다음 청크와 합침
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      // 이벤트 처리
    } catch { /* 진짜 파싱 오류만 무시 */ }
  }
}
```

### 'stage' 이벤트 처리 추가

```typescript
if (parsed.event === 'output') {
  // 기존 텍스트 누적
} else if (parsed.event === 'stage') {
  const d = parsed.data as Record<string, unknown>
  if (typeof d.stage === 'string') onStageChange?.(d.stage)
} else if (parsed.event === 'error') {
  // 에러 처리
}
```

### onStageChange prop 체인 구성

```
AntigravityRightPanel
  → (onStageChange prop)
UnifiedTerminalLayout
  → (onStageChange prop)
BotDetailPage (onStageChange={setCurrentStage})
  → PipelineBar (currentStage 업데이트)
```

### onChatStart stage 수정

```typescript
// Before
onChatStart={() => { setCurrentStage('running') }}  // 'running'은 unified 봇 스테이지에 없음

// After
onChatStart={() => {
  const stages = ROLE_STAGES[agent?.role ?? 'default'] ?? ROLE_STAGES.default
  setCurrentStage(stages[0].key)  // 역할별 첫 단계 키 사용
}}
```

## Consequences

**Positive**:
- JSON 청크 경계 분리 문제 완전 해결 → "(결과 없음)" 버그 제거
- 실제 백엔드 실행 단계(collecting → fetching → scoring → done)가 PipelineBar에 실시간 반영
- 향후 새 이벤트 타입 추가 시 동일 패턴 확장 가능

**Negative**:
- lineBuffer 상태 변수 추가로 코드 약간 복잡화
- 백엔드 executor가 `send('stage', ...)` 이벤트를 정확한 stage key로 전송해야 PipelineBar와 동기화됨

## 규칙 — 절대 위반 금지

1. `chunk.split('\n')` 직접 파싱 패턴 금지 → lineBuffer 필수
2. 스트리밍 루프에서 'stage' 이벤트 무시 금지
3. `onChatStart`에서 `setCurrentStage('running')` 금지 → `stages[0].key` 사용

## Related

- `frontend/src/pages/BotDetailPage.tsx` — AntigravityRightPanel.handleRun, UnifiedTerminalLayout
- `frontend/src/components/bot/PipelineBar.tsx` — ROLE_STAGES, PipelineBar 컴포넌트
- `backend/src/services/roleExecutors/*.ts` — send('stage', ...) 이벤트 전송
- ADR-010: chat endpoint 인증 예외 처리
