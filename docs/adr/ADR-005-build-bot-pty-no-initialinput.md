# ADR-005: Build Bot PTY — initialInput 자동전송 제거

**날짜**: 2026-04
**상태**: 채택됨 (v2.9.5)

---

## 배경

Build Bot은 PTY(XTerminal)로 Claude Code CLI를 실행한다. v2.9.4까지는 WebSocket `connected` 메시지 수신 후 800ms 지연 뒤 `initialInput` prop에 지정된 명령어를 PTY에 자동 전송하는 방식이었다.

## 문제

`initialInput` 자동전송이 **exit code 1**의 근본 원인이었다.

```
PTY 생성 → Claude Code CLI 시작 중... → (800ms 후) initialInput 전송
                                              ↓
                                   Claude Code가 아직 초기화 중
                                   예상치 못한 입력 → 비정상 종료
                                   exit code 1 반환
```

- Claude Code CLI의 초기화 시간이 환경에 따라 800ms를 초과하는 경우 존재
- 자동 전송된 입력이 CLI stdin에 제대로 처리되지 않고 종료 트리거

## 결정

`initialInput` prop 및 자동전송 로직을 **완전 제거**한다.

대신 `taskHint` prop을 도입:
```typescript
// XTerminal에 힌트 텍스트만 표시 (실제 입력은 없음)
<XTerminal taskHint="claude --dangerously-skip-permissions 로 시작하세요" />
```

- 터미널 상단에 회색 힌트 텍스트로 안내
- 실제 명령어 입력은 사용자가 직접 수행

## 근거

- CLI 초기화 타이밍을 클라이언트에서 정확히 알 방법이 없음
- 자동 입력 자체가 인터랙티브 CLI 철학에 반함 (사용자가 직접 제어)
- 힌트 텍스트로 충분히 안내 가능

## 관련 파일
- `frontend/src/components/bot/XTerminal.tsx` — initialInput 제거, taskHint 추가
- `frontend/src/pages/BotDetailPage.tsx` — taskHint prop 전달
