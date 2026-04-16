# 30 — 프론트엔드 규칙

## BotDetailPage 분리 (v3.0.0 핵심)

현재 1436줄 God Component → 2개로 분리:

| 파일 | 봇 | 설명 |
|---|---|---|
| `UnifiedBotPage.tsx` | Research, Content, Growth | HTTP 스트리밍 채팅 |
| `PtyBotPage.tsx` | Build, Design, Ops | node-pty 터미널 |

## UnifiedBotPage 필수 요소

- `AntigravityRightPanel` (우측 채팅)
- `lineBuffer` 패턴 (`.claude/rules/20-api.md` 참조)
- `onStageChange` → `PipelineBar` 실시간 업데이트
- `onChatDone` → 중앙 패널 결과 표시 + `isRunning=false`

## PtyBotPage 필수 요소

- `XTerminal` (PTY 터미널)
- WebSocket `/api/agents/:id/terminal`
- `onOutputCapture` → 중앙 패널 누적 표시
- deps: `[alwaysOn, agentId, shellMode]` — `isRunning` 추가 금지

## 삭제 대상 컴포넌트

- `components/bot/LiveStreamDrawer.tsx` — 삭제
- `components/video/` 디렉토리 — 삭제
- `pages/DevToolsPage.tsx` — 삭제
- `lib/firebase.ts` — 삭제

## onSkillSelect 배선 규칙

```
✅ onSkillSelect → handleSkillRun → unifiedRightPanelRef.current?.runTask(prompt)
❌ onSkillSelect → setTask(s)  // AntigravityRightPanel 내부 상태와 단절
```

## Design Bot

- `case 'design': return { left: null, ... }` — DesignLeftPanel 재추가 금지 (확정)
