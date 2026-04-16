# 40 — 봇 실행 규칙

## 봇 그룹별 실행 방식

### Chat 봇 (Research / Content / Growth)
```
POST /api/agents/:id/chat
→ routeToExecutor() → Anthropic SDK streaming
→ 청크별 JSON line (lineBuffer 파싱)
→ 우측: 대화 표시 / 중앙: onChatDone 후 결과
→ DB: heartbeat_runs, feed_items 저장
```

### PTY 봇 (Build / Design / Ops)
```
WebSocket /api/agents/:id/terminal
→ node-pty: claude --print 실행
→ PTY stdout → XTerminal 표시
→ onOutputCapture → 중앙 패널 누적
```

### Dashboard (CEO Bot 통합)
```
DashboardPage 내 CEO 패널 (별도 페이지 없음)
→ POST /api/agents/:id/chat (CEO executor)
→ 봇 전체 실행 결과 종합 브리핑
```

## WebSocket 규칙

```typescript
// ✅ 올바른 패턴
const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') wss.handleUpgrade(...)
  if (/^\/api\/agents\/.+\/terminal/.test(req.url)) ptyWss.handleUpgrade(...)
})

// ❌ 금지
new WebSocketServer({ server, path: '/ws' })  // 다른 경로 소켓 파괴
```

## Pencil MCP (Design Bot)

```typescript
// ✅ 올바른 패턴
findNpxPath() + 'npx -y @pencilapp/mcp-server'

// ❌ 금지
findPencilMcpExe()  // Antigravity 탐색 — 삭제됨, 복원 금지
'--app antigravity' 플래그  // 삭제됨, 복원 금지
```

## Ops Bot (v3.0.0)

- PTY 그룹 (Build/Design과 동일 방식)
- Claude Code가 n8n JSON 프로세스 생성 → 파일로 저장
- 자동/수동 n8n import는 Phase 2

## 봇별 executor 파일 위치

```
services/roleExecutors/
  base.ts       — 공통 (saveFeedItem 등)
  research.ts   — Research Bot
  content.ts    — Content Bot
  growth.ts     — Growth Bot
  ops.ts        — Ops Bot
  ceo.ts        — CEO Bot (Dashboard용)
  build.ts      — Build Bot (PTY)
  design.ts     — Design Bot (PTY)
  index.ts      — 라우팅
```
