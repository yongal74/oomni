# ADR-007: XTerminal onOutputCapture — 봇간 산출물 전달

**날짜**: 2026-04
**상태**: 채택됨 (v2.9.5)

---

## 배경

OOMNI 봇 파이프라인에서 각 봇의 결과물이 다음 봇의 입력이 되어야 한다. SSE 방식의 봇(LiveStreamDrawer)은 서버에서 결과를 파일로 저장하므로 다음 봇에서 읽기 쉽다. 그러나 PTY 방식(XTerminal)의 Build Bot, Design Bot은 결과물이 터미널 출력으로만 존재하고, 파일 저장이 Claude Code CLI 내부에서 이루어지므로 프론트엔드에서 캡처가 어렵다.

## 문제

- Build Bot 실행 결과(생성된 코드, 경로 등)를 다음 봇(Design Bot)이 알 수 없음
- 사용자가 수동으로 결과를 복사해서 다음 봇에 붙여넣어야 하는 번거로움

## 결정

`XTerminal`에 `onOutputCapture` prop을 추가하여 PTY 출력을 실시간으로 상위 컴포넌트에 전달한다.

```typescript
interface XTerminalProps {
  // ...
  onOutputCapture?: (text: string) => void;
  // PTY 출력 누적 텍스트 (ANSI 이스케이프 제거됨)
}
```

### 구현 방식

1. PTY WebSocket에서 수신하는 모든 출력을 내부 버퍼에 누적
2. ANSI 이스케이프 코드 제거 (`stripAnsi`)
3. 주기적으로(또는 세션 종료 시) `onOutputCapture(accumulatedText)` 호출
4. `BotDetailPage`에서 캡처된 텍스트를 상태로 저장 → 다음 봇 실행 시 context로 주입

### 데이터 흐름

```
XTerminal(PTY 출력) → onOutputCapture → BotDetailPage.capturedOutput
                                              ↓
                                   다음 봇 실행 시 initialContext로 전달
                                   (LiveStreamDrawer의 시스템 프롬프트 또는
                                    다음 XTerminal의 힌트 텍스트)
```

## 근거

- 프론트엔드 레벨에서 PTY 출력을 가로채는 것이 백엔드 변경 없이 구현 가능한 최소 변경
- Claude Code CLI가 파일 저장 경로를 터미널에 출력하므로, 출력 캡처만으로 후속 봇에 충분한 정보 전달 가능
- ANSI 제거 후 텍스트는 LLM 프롬프트로도 사용 가능

## 주의사항

- PTY 출력은 양이 클 수 있으므로 누적 텍스트 상한선 설정 필요 (현재: 최대 50,000자)
- 민감한 정보(API 키 등)가 터미널에 출력될 수 있으므로 다음 봇 전달 시 사용자 확인 권장

## 관련 파일
- `frontend/src/components/bot/XTerminal.tsx` — onOutputCapture prop 구현
- `frontend/src/pages/BotDetailPage.tsx` — capturedOutput state, 다음 봇 전달 로직
