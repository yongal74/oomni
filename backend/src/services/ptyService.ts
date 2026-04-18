/**
 * ptyService.ts — node-pty 기반 진짜 터미널 서비스
 *
 * 역할별 PTY 실행 방식:
 * - design  → PowerShell wrapper → Pencil 자동 기동 → Claude Code CLI
 * - build/ops/기타 → PowerShell wrapper → Claude Code CLI
 * - shell 모드 → PowerShell(Windows)/bash(Linux) 직접 실행
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

/**
 * PTY 세션 생성 또는 기존 세션 반환
 * @param role  에이전트 역할 — 'design'이면 Pencil MCP 자동 연결
 * @param shellMode true → PowerShell/bash 셸 직접 실행
 */
function getOrCreateSession(agentId: string, cols = 120, rows = 35, shellMode = false, role = ''): PtySession {
  const existing = sessions.get(agentId);
  if (existing) return existing;

  const wsPath = path.join(WORKSPACE_ROOT, agentId);
  fs.mkdirSync(wsPath, { recursive: true });

  const apiKey = getApiKey();

  const env: Record<string, string> = {
    ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>,
    ANTHROPIC_API_KEY: apiKey,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
  };

  let spawnExec: string;
  let spawnArgs: string[];

  if (shellMode) {
    // ── 셸 모드: PowerShell(Windows) / bash(Linux/Mac) ──────────────────
    if (process.platform === 'win32') {
      spawnExec = 'powershell.exe';
      spawnArgs = ['-NoLogo'];
    } else {
      spawnExec = process.env.SHELL ?? '/bin/bash';
      spawnArgs = [];
    }
  } else {
    // ── Claude Code 모드 (design/build/ops/기타): PowerShell wrapper ─────
    // ConPTY 루트 프로세스로 Electron 바이너리를 직접 spawn 하면 TUI 초기화
    // 실패(exit code 1)가 발생. PowerShell을 PTY 루트로 사용한 뒤 claude 명령을
    // 자동 입력함으로써 문제를 우회한다.
    spawnExec = 'powershell.exe';
    spawnArgs = ['-NoLogo', '-NoExit'];
  }

  // node-pty(ConPTY)로 직접 spawn
  const ptyProcess = pty.spawn(spawnExec, spawnArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: wsPath,
    env,
  });

  // shellMode가 아닌 경우 PowerShell 준비 후 claude 명령 자동 입력
  if (!shellMode) {
    const cliPath = getCliPath().replace(/\\/g, '/');

    if (role === 'design') {
      // Design Bot: Pencil 앱 실행 여부 확인 후 기동, 그 다음 Claude Code 실행
      setTimeout(() => {
        ptyProcess.write(
          `$p = Get-Process "Pencil" -ErrorAction SilentlyContinue; ` +
          `if (-not $p) { Write-Host "Pencil 앱 시작 중..."; Start-Process "$env:LOCALAPPDATA\\Programs\\Pencil\\Pencil.exe"; Start-Sleep -Seconds 4 }; ` +
          `Write-Host "Claude Code 시작 중..."; ` +
          `node "${cliPath}" --dangerously-skip-permissions\r`
        );
      }, 500);
    } else {
      // Build Bot 및 기타 역할: Claude Code 바로 실행
      setTimeout(() => {
        ptyProcess.write(`node "${cliPath}" --dangerously-skip-permissions\r`);
      }, 500);
    }
  }

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
    if (!match) return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      const agentId = match[1];

      // 쿼리 파라미터에서 cols/rows/mode/role 파싱
      const qs = new URLSearchParams(url.split('?')[1] ?? '');
      const cols = parseInt(qs.get('cols') ?? '120', 10);
      const rows = parseInt(qs.get('rows') ?? '35', 10);
      const shellMode = qs.get('mode') === 'shell';
      const role = qs.get('role') ?? '';

      const session = getOrCreateSession(agentId, cols, rows, shellMode, role);
      session.clients.add(ws);

      // 접속 확인 메시지 (role 포함)
      ws.send(JSON.stringify({ type: 'connected', agentId, role }));

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
