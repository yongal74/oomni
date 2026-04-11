/**
 * ptyService.ts — node-pty 기반 진짜 터미널 서비스
 *
 * Build Bot이 Claude Code CLI를 진짜 인터랙티브 터미널처럼 실행:
 * - node-pty: OS 레벨 가상 터미널 (PTY) — 색상, 스피너, Tab 완성 모두 동작
 * - WebSocket: 양방향 실시간 통신 (클라이언트 키 입력 → PTY → 결과 스트리밍)
 * - 세션 격리: agentId별 독립 PTY 세션 관리
 */

import * as pty from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

// ── Claude Code CLI 경로 (claudeCodeService와 동일 로직) ──
function getCliPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resourcesPath: string | undefined = (process as any).resourcesPath;
  const candidates = [
    resourcesPath
      ? path.join(resourcesPath, 'backend', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      : null,
    path.join(__dirname, '..', '..', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
    path.join(__dirname, '..', '..', '..', 'backend', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
  ].filter(Boolean) as string[];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[candidates.length - 1];
}

function getNodeExecutable(): string {
  const isElectron = process.versions && 'electron' in process.versions;
  return isElectron ? process.execPath : process.execPath;
}

const DATA_ROOT = process.platform === 'win32'
  ? 'C:/oomni-data'
  : path.join(os.homedir(), 'oomni-data');
const WORKSPACE_ROOT = path.join(DATA_ROOT, 'workspaces');

// ── PTY 세션 ──────────────────────────────────────────────
interface PtySession {
  pty: pty.IPty;
  clients: Set<WebSocket>;
  agentId: string;
  cols: number;
  rows: number;
}

const sessions = new Map<string, PtySession>();

function getApiKey(): string {
  return process.env.ANTHROPIC_API_KEY ?? '';
}

function getMcpConfig(agentId: string): string | null {
  // Pencil MCP 경로 (Design bot용이지만 Build bot도 사용 가능)
  const antigravityBase = path.join(os.homedir(), '.antigravity', 'extensions');
  if (!fs.existsSync(antigravityBase)) return null;

  try {
    const entries = fs.readdirSync(antigravityBase);
    const pencilExt = entries.find(e => e.startsWith('highagency.pencildev'));
    if (!pencilExt) return null;
    const exePath = path.join(antigravityBase, pencilExt, 'out', 'mcp-server-windows-x64.exe');
    if (!fs.existsSync(exePath)) return null;

    const cfgPath = path.join(os.tmpdir(), `pty-mcp-${agentId}.json`);
    const config = {
      mcpServers: {
        pencil: { command: exePath, args: ['--app', 'antigravity'], env: {} },
      },
    };
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2));
    return cfgPath;
  } catch {
    return null;
  }
}

/** PTY 세션 생성 또는 기존 세션 반환 */
function getOrCreateSession(agentId: string, cols = 120, rows = 35): PtySession {
  const existing = sessions.get(agentId);
  if (existing) return existing;

  const wsPath = path.join(WORKSPACE_ROOT, agentId);
  fs.mkdirSync(wsPath, { recursive: true });

  const cliPath = getCliPath();
  const nodeExec = getNodeExecutable();
  const apiKey = getApiKey();

  const isElectron = process.versions && 'electron' in process.versions;

  // Claude Code CLI args — 인터랙티브 모드 (--print 없음)
  const args = [cliPath, '--dangerously-skip-permissions'];

  const mcpCfg = getMcpConfig(agentId);
  if (mcpCfg) args.push('--mcp-config', mcpCfg);

  const env: Record<string, string> = {
    ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>,
    ANTHROPIC_API_KEY: apiKey,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
  };

  if (isElectron) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  // Windows: cmd.exe 셸로 node 실행
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
  const shellArgs = process.platform === 'win32'
    ? ['/c', `"${nodeExec}" ${args.map(a => `"${a}"`).join(' ')}`]
    : ['-c', `"${nodeExec}" ${args.map(a => `'${a}'`).join(' ')}`];

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: wsPath,
    env,
  });

  const session: PtySession = {
    pty: ptyProcess,
    clients: new Set(),
    agentId,
    cols,
    rows,
  };

  // PTY 출력 → 모든 WebSocket 클라이언트에 브로드캐스트
  ptyProcess.onData((data: string) => {
    const msg = JSON.stringify({ type: 'output', data });
    for (const ws of session.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    const msg = JSON.stringify({ type: 'exit', exitCode });
    for (const ws of session.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
    sessions.delete(agentId);
  });

  sessions.set(agentId, session);
  return session;
}

/** WebSocket 메시지 처리 */
function handleWsMessage(session: PtySession, raw: string) {
  try {
    const msg = JSON.parse(raw) as { type: string; data?: string; cols?: number; rows?: number };

    switch (msg.type) {
      case 'input':
        if (msg.data) session.pty.write(msg.data);
        break;
      case 'resize':
        if (msg.cols && msg.rows) {
          session.cols = msg.cols;
          session.rows = msg.rows;
          session.pty.resize(msg.cols, msg.rows);
        }
        break;
      case 'kill':
        session.pty.kill();
        sessions.delete(session.agentId);
        break;
    }
  } catch { /* ignore parse errors */ }
}

/** WebSocket 서버를 Express HTTP 서버에 연결 */
export function attachPtyWebSocket(server: import('http').Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = req.url ?? '';
    // /api/agents/:id/terminal 패턴 매칭
    const match = url.match(/^\/api\/agents\/([^/?]+)\/terminal/);
    if (!match) return; // 다른 WebSocket 업그레이드는 무시

    wss.handleUpgrade(req, socket, head, (ws) => {
      const agentId = match[1];

      // 쿼리 파라미터에서 cols/rows 파싱
      const qs = new URLSearchParams(url.split('?')[1] ?? '');
      const cols = parseInt(qs.get('cols') ?? '120', 10);
      const rows = parseInt(qs.get('rows') ?? '35', 10);

      const session = getOrCreateSession(agentId, cols, rows);
      session.clients.add(ws);

      // 접속 확인 메시지
      ws.send(JSON.stringify({ type: 'connected', agentId }));

      ws.on('message', (data) => {
        handleWsMessage(session, data.toString());
      });

      ws.on('close', () => {
        session.clients.delete(ws);
      });

      ws.on('error', () => {
        session.clients.delete(ws);
      });
    });
  });
}

/** 특정 agentId의 PTY 세션 강제 종료 */
export function killPtySession(agentId: string): void {
  const session = sessions.get(agentId);
  if (session) {
    session.pty.kill();
    sessions.delete(agentId);
  }
}

/** 현재 활성 세션 목록 */
export function getActiveSessions(): string[] {
  return Array.from(sessions.keys());
}
