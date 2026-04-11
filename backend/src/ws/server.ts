/**
 * WebSocket 서버 — 실시간 피드 브로드캐스트
 * 봇이 결과 보고 → DB 저장 → WS로 모든 클라이언트에 push
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { logger } from '../logger';

interface WsMessage {
  type: 'feed' | 'agent_status' | 'cost' | 'ping' | 'pong';
  data: unknown;
}

export class OomniWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: Server) {
    // noServer 모드: 직접 upgrade 이벤트를 처리하여 /ws 경로만 담당
    // { server, path } 옵션은 path 불일치 시 소켓을 파괴(400 abort)하므로
    // PTY WebSocket(/api/agents/:id/terminal) 연결을 막는 버그가 발생함
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = req.url ?? '';
      const pathname = url.split('?')[0];
      if (pathname !== '/ws') return; // PTY 등 다른 WebSocket은 각자 핸들러가 처리

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });

    this.setup();
  }

  private setup(): void {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      logger.debug(`[WS] 클라이언트 연결 (총 ${this.clients.size}개)`);

      ws.send(JSON.stringify({ type: 'ping', data: { time: Date.now() } }));

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as WsMessage;
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', data: {} }));
        } catch { /* ignore */ }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.debug(`[WS] 클라이언트 연결 해제 (남은 ${this.clients.size}개)`);
      });

      ws.on('error', (err) => {
        logger.warn('[WS] 클라이언트 오류', err);
        this.clients.delete(ws);
      });
    });
  }

  broadcast(message: WsMessage): void {
    const payload = JSON.stringify(message);
    let sent = 0;
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    }
    if (sent > 0) logger.debug(`[WS] 브로드캐스트 → ${sent}개 클라이언트`);
  }

  broadcastFeed(feedItem: unknown): void {
    this.broadcast({ type: 'feed', data: feedItem });
  }

  broadcastAgentStatus(agentId: string, status: string): void {
    this.broadcast({ type: 'agent_status', data: { agentId, status, time: Date.now() } });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
