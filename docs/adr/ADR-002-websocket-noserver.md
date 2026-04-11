# ADR-002: OomniWebSocketServer noServer 모드 전환

**날짜**: 2026-04
**상태**: 채택됨 (v2.9.3)

---

## 배경

OOMNI 백엔드는 두 종류의 WebSocket 서버를 운영한다:

1. **OomniWebSocketServer** (`/ws`): 피드 브로드캐스트, 에이전트 상태 실시간 전송
2. **PTY WebSocket** (`/api/agents/:id/terminal`): Build/Design Bot 인터랙티브 터미널

## 문제

v2.9.2까지 `OomniWebSocketServer`를 다음과 같이 생성했다:

```typescript
this.wss = new WebSocketServer({ server, path: '/ws' });
```

`ws` 라이브러리가 `{ server, path }` 옵션으로 생성되면 `server.upgrade` 이벤트를 직접 구독하고, **path가 일치하지 않는 모든 WebSocket 업그레이드 요청을 `abortHandshake`(소켓 파괴, 400 Bad Request)**로 처리한다.

그 결과 PTY WebSocket(`/api/agents/:id/terminal`) 연결 요청이 OomniWebSocketServer에 의해 소켓이 파괴되어, `attachPtyWebSocket`의 upgrade 핸들러가 실행될 기회를 얻지 못했다. → **Build Bot "WebSocket 연결 오류"**

## 결정

`OomniWebSocketServer`를 **noServer 모드**로 전환하고, 직접 `server.upgrade` 이벤트를 처리한다.

```typescript
this.wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url?.split('?')[0] ?? '';
  if (pathname !== '/ws') return; // 다른 경로는 각자 핸들러가 처리

  this.wss.handleUpgrade(req, socket, head, (ws) => {
    this.wss.emit('connection', ws, req);
  });
});
```

## 근거

- `return`으로 통과시키면 소켓이 파괴되지 않고 다음 upgrade 핸들러(`attachPtyWebSocket`)가 처리할 수 있다
- 두 WebSocket 서버가 독립적으로 각자 경로만 처리
- `ws` 라이브러리의 `{ server, path }` 옵션은 단일 WebSocket 서버만 쓸 때 안전, 복수 서버 시 **사용 금지**

## 교훈

`ws` 라이브러리에서 `{ server, path }` 옵션은 path 불일치 시 소켓을 완전히 파괴한다. 동일 HTTP 서버에 복수의 WebSocket 서버를 붙일 때는 반드시 `noServer: true` + 수동 upgrade 핸들링 패턴을 사용해야 한다.
