/**
 * claudeCodeService.ts — Antigravity 방식 Claude Code CLI 안정적 실행 엔진
 *
 * 핵심 설계:
 * - node_modules/@anthropic-ai/claude-code/cli.js 절대경로 직접 실행 (PATH 불필요)
 * - 역할별 MCP 서버 자동 연결 (Design→Pencil, Ops→n8n)
 * - stream-json 포맷 실시간 SSE 스트리밍
 * - 역할별 모델 라우팅 (Haiku/Sonnet/Opus) — 토큰 비용 최적화
 * - Skills .md 자동 로딩 (/ 커맨드)
 * - 격리된 워크스페이스 + 파일 트리 API
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── 경로 헬퍼 ────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

/** CLI 절대경로 — PATH 불필요, node_modules에서 직접 */
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

function getSkillsSrc(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resourcesPath: string | undefined = (process as any).resourcesPath;
  if (!isDev && resourcesPath) {
    const p = path.join(resourcesPath, 'skills');
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, '..', '..', '..', 'skills');
}

// ── 데이터 경로 ──────────────────────────────────────────────
export const DATA_ROOT      = 'C:/oomni-data';
export const WORKSPACE_ROOT = path.join(DATA_ROOT, 'workspaces');
export const CLAUDE_DIR     = path.join(DATA_ROOT, '.claude');
export const SKILLS_DEST    = path.join(CLAUDE_DIR, 'commands');

// ── 모델 라우팅 ─────────────────────────────────────────────
const ROLE_MODELS: Record<string, string> = {
  research:    'claude-haiku-4-5-20251001',   // 대량 채점 → 저렴
  growth:      'claude-haiku-4-5-20251001',
  content:     'claude-sonnet-4-6',
  build:       'claude-sonnet-4-6',
  design:      'claude-sonnet-4-6',
  ops:         'claude-sonnet-4-6',
  integration: 'claude-sonnet-4-6',
  n8n:         'claude-sonnet-4-6',
  ceo:         'claude-opus-4-6',             // CEO 판단 → 최고 품질
};

// ── 역할별 MCP 서버 설정 (antigravity 방식) ──────────────────
interface McpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

function getRoleMcpConfig(role: string): Record<string, McpServer> | null {
  // Pencil MCP (Design Bot)
  const pencilExe = 'c:\\Users\\장우경\\.antigravity\\extensions\\highagency.pencildev-0.6.39-universal\\out\\mcp-server-windows-x64.exe';

  // n8n MCP (Ops Bot)
  const n8nMcp = 'C:\\Users\\장우경\\AppData\\Roaming\\npm\\node_modules\\n8n-mcp\\dist\\mcp\\index.js';

  if (role === 'design' && fs.existsSync(pencilExe)) {
    return {
      pencil: {
        command: pencilExe,
        args: ['--app', 'oomni'],
        env: {},
      },
    };
  }

  if ((role === 'ops' || role === 'n8n') && fs.existsSync(n8nMcp)) {
    return {
      'n8n-mcp': {
        command: 'node',
        args: [n8nMcp],
        env: {
          MCP_MODE: 'stdio',
          LOG_LEVEL: 'error',
          DISABLE_CONSOLE_OUTPUT: 'true',
          N8N_API_URL: process.env.N8N_API_URL ?? 'https://yongal74.app.n8n.cloud/api/v1',
          N8N_API_KEY: process.env.N8N_API_KEY ?? '',
        },
      },
    };
  }

  return null;
}

// ── 역할별 시스템 프롬프트 ─────────────────────────────────────
const ROLE_PROMPTS: Record<string, string> = {
  research: `당신은 AI/스타트업 트렌드 리서치 에이전트입니다.
신호 강도 0-100 채점, 근거 명시. 결과: C:/oomni-data/research/ 저장.`,

  content: `당신은 한국 솔로 창업자를 위한 콘텐츠 작가 에이전트입니다.
숏폼: Hook(0-3s)→Problem(3-8s)→Solution(8-25s)→Proof(25-50s)→CTA(50-60s).
결과: C:/oomni-data/content/ 저장.`,

  build: `당신은 풀스택 개발 에이전트입니다. TypeScript/React/Node.js/Tailwind.
파일은 현재 작업 디렉토리에 저장. 타입 정의 + 에러 처리 필수.`,

  design: `당신은 UI/UX 디자인 에이전트입니다. 다크 테마, 오렌지 액센트 #D4763B.
Pencil MCP로 실제 디자인 생성. 결과: C:/oomni-data/design/ 저장.`,

  growth: `당신은 그로스 해킹 에이전트입니다. KPI + 실행 액션 아이템 제시.
결과: C:/oomni-data/growth/ 저장.`,

  ops: `당신은 운영 자동화 에이전트입니다. n8n MCP로 워크플로우 직접 생성/배포.
결과: C:/oomni-data/ops/ 저장.`,

  ceo: `당신은 CEO 의사결정 지원 에이전트입니다. 전략적 분석, 최고 품질 판단.
승인 필요 항목: [REQUIRES_APPROVAL] 태그. 결과: C:/oomni-data/ceo/ 저장.`,
};

// ── 타입 ─────────────────────────────────────────────────────
export type SendFn = (event: string, data: unknown) => void;

export interface WorkspaceFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  language?: string;
  children?: WorkspaceFile[];
}

// ── Skills 초기화 (앱 시작 시 호출) ──────────────────────────
export function initSkills(): void {
  const src = getSkillsSrc();
  if (!fs.existsSync(src)) { console.log('[Skills] 소스 없음:', src); return; }

  fs.mkdirSync(CLAUDE_DIR, { recursive: true });

  const claudeMd = path.join(src, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) fs.copyFileSync(claudeMd, path.join(CLAUDE_DIR, 'CLAUDE.md'));

  for (const role of ['research','build','design','content','growth','ops','ceo']) {
    const srcDir = path.join(src, role);
    const dstDir = path.join(SKILLS_DEST, role);
    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(dstDir, { recursive: true });
    let count = 0;
    for (const f of fs.readdirSync(srcDir)) {
      if (f.endsWith('.md')) { fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f)); count++; }
    }
    console.log(`[Skills] ${role}: ${count}개`);
  }
}

// ── 워크스페이스 ──────────────────────────────────────────────
export function ensureWorkspace(agentId: string): string {
  const p = path.join(WORKSPACE_ROOT, agentId);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

// ── Skills 해석 ───────────────────────────────────────────────
function resolveTask(role: string, task: string): string {
  if (!task.startsWith('/')) return task;
  const [cmd, ...rest] = task.slice(1).split(' ');
  const args = rest.join(' ');
  const file = path.join(SKILLS_DEST, role, `${cmd}.md`);
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8').replace(/\$ARGUMENTS/g, args);
    return `다음 스킬 지침을 정확히 따르세요:\n\n${content}\n\n추가 인자: ${args || '없음'}`;
  }
  return task;
}

// ── 파일 언어 감지 ────────────────────────────────────────────
const EXT_MAP: Record<string, string> = {
  '.ts':'typescript','.tsx':'typescript','.js':'javascript','.jsx':'javascript',
  '.py':'python','.json':'json','.md':'markdown','.css':'css',
  '.html':'html','.sql':'sql','.sh':'bash','.yml':'yaml','.yaml':'yaml',
};

// ── 파일 트리 ─────────────────────────────────────────────────
export function getWorkspaceFiles(agentId: string): WorkspaceFile[] {
  const wsPath = ensureWorkspace(agentId);

  function build(dir: string, depth = 0): WorkspaceFile[] {
    if (depth > 5) return [];
    const results: WorkspaceFile[] = [];
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fp = path.join(dir, entry.name);
        const stat = fs.statSync(fp);
        if (entry.isDirectory()) {
          results.push({ name: entry.name, path: fp, isDirectory: true, size: 0, modifiedAt: stat.mtimeMs, children: build(fp, depth+1) });
        } else {
          results.push({ name: entry.name, path: fp, isDirectory: false, size: stat.size, modifiedAt: stat.mtimeMs, language: EXT_MAP[path.extname(entry.name).toLowerCase()] });
        }
      }
    } catch { /* ignore */ }
    return results;
  }

  return build(wsPath);
}

export function readWorkspaceFile(filePath: string): string {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

// ── MCP 설정 파일 생성 ────────────────────────────────────────
function writeMcpConfig(role: string, tmpDir: string): string | null {
  const mcpServers = getRoleMcpConfig(role);
  if (!mcpServers) return null;
  const cfgPath = path.join(tmpDir, `mcp-${role}.json`);
  fs.writeFileSync(cfgPath, JSON.stringify({ mcpServers }, null, 2));
  return cfgPath;
}

// ── 메인 실행 클래스 ──────────────────────────────────────────
export class ClaudeCodeService {
  private proc: ChildProcess | null = null;
  private stopped = false;
  private readonly agentId: string;
  private readonly role: string;

  constructor(agentId: string, role: string) {
    this.agentId = agentId;
    this.role = role;
  }

  static create(agentId: string, role: string): ClaudeCodeService {
    return new ClaudeCodeService(agentId, role);
  }

  isRunning(): boolean { return this.proc !== null; }

  stop(): void {
    this.stopped = true;
    this.proc?.kill('SIGTERM');
    this.proc = null;
  }

  async execute(task: string, send: SendFn): Promise<void> {
    this.stopped = false;

    const cliPath = getCliPath();
    if (!fs.existsSync(cliPath)) {
      send('error', { message: `Claude Code CLI를 찾을 수 없습니다: ${cliPath}` });
      return;
    }

    const wsPath     = ensureWorkspace(this.agentId);
    const model      = ROLE_MODELS[this.role] ?? 'claude-sonnet-4-6';
    const resolved   = resolveTask(this.role, task);
    const sysPrompt  = ROLE_PROMPTS[this.role] ?? '';
    const apiKey     = process.env.ANTHROPIC_API_KEY ?? '';
    const tmpDir     = os.tmpdir();

    // MCP 설정 파일 (역할에 따라)
    const mcpCfgPath = writeMcpConfig(this.role, tmpDir);

    const args = [
      cliPath,
      '--print',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--dangerously-skip-permissions',
      '--no-session-persistence',
      '--model', model,
    ];

    if (sysPrompt)   args.push('--append-system-prompt', sysPrompt);
    if (mcpCfgPath)  args.push('--mcp-config', mcpCfgPath);
    if (fs.existsSync(CLAUDE_DIR)) args.push('--add-dir', CLAUDE_DIR);

    args.push(resolved);

    send('start', { agentId: this.agentId, role: this.role, model, task });

    return new Promise<void>((resolve) => {
      this.proc = spawn('node', args, {
        cwd: wsPath,
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let buf = '';

      this.proc.stdout?.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf-8');
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try { this.handleEvent(JSON.parse(line), send); }
          catch { if (line.trim()) send('output', { text: line }); }
        }
      });

      this.proc.stderr?.on('data', (chunk: Buffer) => {
        const t = chunk.toString('utf-8').trim();
        if (t && !/ExperimentalWarning|DeprecationWarning/.test(t)) {
          send('output', { text: `⚠️ ${t}`, type: 'stderr' });
        }
      });

      this.proc.on('error', (err) => {
        send('error', { message: `프로세스 오류: ${err.message}` });
        resolve();
      });

      this.proc.on('close', (code) => {
        if (buf.trim()) {
          try { this.handleEvent(JSON.parse(buf), send); }
          catch { send('output', { text: buf }); }
        }
        if (!this.stopped) send('done', { success: code === 0, exitCode: code ?? -1 });
        this.proc = null;
        resolve();
      });
    });
  }

  private handleEvent(ev: Record<string, unknown>, send: SendFn): void {
    switch (ev.type as string) {
      case 'assistant': {
        const blocks = ((ev.message as { content?: unknown[] })?.content ?? []) as Array<{ type: string; text?: string; name?: string; input?: unknown }>;
        for (const b of blocks) {
          if (b.type === 'text' && b.text) send('output', { text: b.text });
          else if (b.type === 'tool_use') send('tool_use', { tool: b.name, input: b.input });
        }
        break;
      }
      case 'tool_result':
        send('tool_result', { content: ev.content });
        break;
      case 'result':
        if (ev.result) send('output', { text: String(ev.result), isFinal: true });
        break;
      case 'system': {
        const msg = String(ev.subtype ?? ev.message ?? '');
        const m = msg.match(/\[STAGE:(\w+)\]/);
        if (m) send('stage', { stage: m[1] });
        break;
      }
    }
  }

  // 하위 호환
  getWorkspaceFiles(): WorkspaceFile[] { return getWorkspaceFiles(this.agentId); }
  getWorkspacePath(): string { return path.join(WORKSPACE_ROOT, this.agentId); }
}
