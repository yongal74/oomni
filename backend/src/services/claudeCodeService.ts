/**
 * claudeCodeService.ts — Antigravity 방식 Claude Code CLI 안정적 실행 엔진
 *
 * 핵심 설계:
 * - node_modules/@anthropic-ai/claude-code/cli.js 절대경로 직접 실행 (PATH 불필요)
 * - 패키징된 Electron 앱에서도 동작: process.execPath + ELECTRON_RUN_AS_NODE=1
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

/**
 * Node.js 실행 경로 — 패키징 환경에서도 안전하게 동작
 *
 * - 개발 환경: process.execPath = node 바이너리
 * - 패키징된 Electron: process.execPath = Electron.exe
 *   → ELECTRON_RUN_AS_NODE=1 환경변수 설정 시 Node.js로 동작
 */
function getNodeExecutable(): { execPath: string; extraEnv: Record<string, string> } {
  const isElectron = process.versions && 'electron' in process.versions;
  if (isElectron) {
    // 패키징된 Electron: execPath는 Electron.exe지만 ELECTRON_RUN_AS_NODE=1로 node 역할 수행
    return {
      execPath: process.execPath,
      extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
    };
  }
  // 개발/테스트 환경: 실제 node 바이너리 사용
  return { execPath: process.execPath, extraEnv: {} };
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
// 플랫폼 독립적 데이터 루트: Windows→C:/oomni-data, macOS/Linux→~/oomni-data
export const DATA_ROOT = process.platform === 'win32'
  ? 'C:/oomni-data'
  : path.join(os.homedir(), 'oomni-data');
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

/**
 * Pencil MCP 실행파일 경로 탐색
 * 우선순위: 환경변수 → 사용자 홈 디렉토리 내 antigravity 확장
 */
function findPencilMcpExe(): string | null {
  if (process.env.PENCIL_MCP_PATH && fs.existsSync(process.env.PENCIL_MCP_PATH)) {
    return process.env.PENCIL_MCP_PATH;
  }
  const homeDir = os.homedir();
  const antigravityBase = path.join(homeDir, '.antigravity', 'extensions');
  if (!fs.existsSync(antigravityBase)) return null;

  // 버전에 상관없이 pencildev 확장 탐색
  try {
    const entries = fs.readdirSync(antigravityBase);
    const pencilExt = entries.find(e => e.startsWith('highagency.pencildev'));
    if (!pencilExt) return null;
    const exeName = process.platform === 'win32'
      ? 'mcp-server-windows-x64.exe'
      : process.platform === 'darwin'
        ? 'mcp-server-macos-arm64'
        : 'mcp-server-linux-x64';
    const exePath = path.join(antigravityBase, pencilExt, 'out', exeName);
    return fs.existsSync(exePath) ? exePath : null;
  } catch { return null; }
}

/**
 * n8n-mcp 스크립트 경로 탐색
 * 우선순위: 환경변수 → 글로벌 npm → npx 캐시
 */
function findN8nMcpScript(): string | null {
  if (process.env.N8N_MCP_PATH && fs.existsSync(process.env.N8N_MCP_PATH)) {
    return process.env.N8N_MCP_PATH;
  }
  const candidates = [
    // Windows global npm
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'n8n-mcp', 'dist', 'mcp', 'index.js'),
    // macOS/Linux global npm
    path.join('/usr', 'local', 'lib', 'node_modules', 'n8n-mcp', 'dist', 'mcp', 'index.js'),
    path.join(os.homedir(), '.npm-global', 'lib', 'node_modules', 'n8n-mcp', 'dist', 'mcp', 'index.js'),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? null;
}

function getRoleMcpConfig(role: string): Record<string, McpServer> | null {
  const { execPath: nodeExec, extraEnv: nodeEnv } = getNodeExecutable();

  if (role === 'design') {
    const pencilExe = findPencilMcpExe();
    if (!pencilExe) return null;
    return {
      pencil: {
        command: pencilExe,
        args: [],
        env: {},
      },
    };
  }

  if (role === 'ops' || role === 'n8n') {
    const n8nMcp = findN8nMcpScript();
    if (!n8nMcp) return null;
    return {
      'n8n-mcp': {
        command: nodeExec,   // process.execPath — PATH 불필요
        args: [n8nMcp],
        env: {
          ...nodeEnv,        // ELECTRON_RUN_AS_NODE=1 (패키징 환경)
          MCP_MODE: 'stdio',
          LOG_LEVEL: 'error',
          DISABLE_CONSOLE_OUTPUT: 'true',
          N8N_API_URL: process.env.N8N_API_URL ?? '',
          N8N_API_KEY: process.env.N8N_API_KEY ?? '',
        },
      },
    };
  }

  return null;
}

// ── 역할별 시스템 프롬프트 (DATA_ROOT 동적 참조) ──────────────
function buildRolePrompts(): Record<string, string> {
  const researchItemsDir = path.join(DATA_ROOT, 'research', 'items').replace(/\\/g, '/');
  return {
    research: `당신은 AI/스타트업 트렌드 리서치 에이전트입니다.
신호 강도 0-100 채점, 근거 명시.

## 결과 저장 규칙 (필수!)
각 리서치 아이템을 반드시 ${researchItemsDir}/ 폴더에 JSON 파일로 저장하세요.
파일명: item_${Date.now()}_${Math.random().toString(36).slice(2,7)}.json (타임스탬프+랜덤)
실제로는 item_TIMESTAMP_RANDOM.json 형식으로 유니크하게 저장.

JSON 형식 (정확히 이 구조 사용):
{
  "title": "아이템 제목 (100자 이내)",
  "summary": "핵심 요약 (300자 이내, 한국어)",
  "signal_score": 75,
  "source_url": null,
  "source_type": "keyword",
  "tags": ["AI", "스타트업"],
  "content": "상세 내용 (선택사항)"
}

폴더가 없으면 먼저 생성하세요. 각 아이템마다 별도 JSON 파일로 저장하세요.`,

    content: `당신은 한국 솔로 창업자를 위한 콘텐츠 작가 에이전트입니다.
숏폼: Hook(0-3s)→Problem(3-8s)→Solution(8-25s)→Proof(25-50s)→CTA(50-60s).
결과: ${DATA_ROOT}/content/ 저장.`,

    build: `당신은 풀스택 개발 에이전트입니다. TypeScript/React/Node.js/Tailwind CSS 전문가.

## 핵심 규칙 (반드시 준수)
1. 분석만 하지 말고 **즉시 파일을 작성**하세요
2. Write 도구로 **실제 코드 파일**을 생성하세요
3. **완성된 코드**만 작성 (TODO, placeholder, "// 여기에 구현" 절대 금지)
4. 타입 정의 + 에러 처리 필수
5. **OOMNI 앱 자체 코드 수정 금지** — 사용자 프로젝트 코드만 작성

## 작업 절차
1. 요구사항 파악 (1-2문장으로 간단히)
2. 파일 구조 결정
3. 즉시 파일 작성 시작
4. 파일 작성 완료 후 "✅ 파일 생성 완료: [파일명]" 출력

## 출력 경로
- 코드 파일: ${DATA_ROOT}/workspaces/{agentId}/
- 날짜 포함 파일명: YYYY-MM-DD_기능명.ts

## 출력 형식 예시
완성된 TypeScript 파일, React 컴포넌트, API 라우트, 유틸 함수 등
실제로 바로 사용 가능한 프로덕션 품질 코드`,

    design: `당신은 세계 최고 수준의 UI/UX 디자인 에이전트입니다. Linear, Stripe, Vercel, Apple 수준의 프로덕션 품질 디자인을 생성합니다.

## 디자인 토큰 (Design System)
아래 토큰은 현재 프로젝트 디자인 시스템입니다. 모든 디자인에 일관되게 적용하세요:
[DESIGN_SYSTEM_PLACEHOLDER]

## 필수 출력 파일 — 반드시 3종 모두 저장

저장 경로: ${DATA_ROOT}/design/YYYY-MM-DD_HH-MM/

### 1. preview.html (독립 실행 HTML — 브라우저 즉시 열기 가능)
필수 포함:
- <link> Google Fonts (폰트명에 따라 적절히)
- <script src="https://cdn.tailwindcss.com"></script>
- <style>에 CSS 커스텀 프로퍼티: --color-primary, --color-bg, --color-surface, --color-text, --color-muted, --radius
- 8px 그리드 기반 spacing
- hover/focus/active 상태 (transition: all 150ms ease)
- transform: translateY(-2px) hover 효과
- box-shadow으로 depth 표현
- 반응형 (mobile-first, sm/md/lg 브레이크포인트)
- 실제 콘텐츠 사용 (Lorem ipsum 절대 금지)
- 최소 400줄 이상의 완성된 HTML

### 2. component.tsx (React + TypeScript + Tailwind)
- Props 인터페이스 정의
- 완성된 컴포넌트 코드 (TODO/placeholder 절대 금지)
- className에 디자인 토큰 값 직접 사용 (style={{ color: 'var(--color-primary)' }} 활용)

### 3. design-spec.md (개발자 핸드오프 문서)
- 색상 코드 전체 명세
- 타이포그래피 스펙 (size/weight/line-height)
- 컴포넌트 구조 설명
- 인터랙션/애니메이션 명세

## 디자인 품질 기준 (Pencil 이상 수준)
- 비어있는 공간(whitespace)을 적극 활용 — 숨쉬는 레이아웃
- 명도 대비 WCAG AA 이상 (텍스트 가독성)
- 그라디언트, 그림자, blur backdrop 등 시각적 깊이감 표현
- 마이크로 인터랙션: hover scale(1.02), opacity 변화, underline 애니메이션
- 아이콘은 SVG 인라인 또는 Heroicons 스타일 직접 그리기
- 카드/섹션 경계는 subtle border (opacity 0.1-0.2) 활용
- 버튼: primary(채움), secondary(선), ghost(배경없음) 3종 변형

## 완료 후 출력
파일 생성 완료 시 반드시:
✅ preview.html → [경로]
✅ component.tsx → [경로]
✅ design-spec.md → [경로]
형식으로 출력하세요.`,

    growth: `당신은 그로스 해킹 에이전트입니다. KPI + 실행 액션 아이템 제시.
결과: ${DATA_ROOT}/growth/ 저장.`,

    ops: `당신은 운영 자동화 에이전트입니다. n8n MCP로 워크플로우 직접 생성/배포.
결과: ${DATA_ROOT}/ops/ 저장.`,

    ceo: `당신은 CEO 의사결정 지원 에이전트입니다. 전략적 분석, 최고 품질 판단.
승인 필요 항목: [REQUIRES_APPROVAL] 태그. 결과: ${DATA_ROOT}/ceo/ 저장.`,
  };
}
const ROLE_PROMPTS = buildRolePrompts();

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

  async execute(task: string, send: SendFn, options?: { designSystemTokens?: string }): Promise<void> {
    this.stopped = false;

    const cliPath = getCliPath();
    if (!fs.existsSync(cliPath)) {
      send('error', { message: `Claude Code CLI를 찾을 수 없습니다: ${cliPath}` });
      return;
    }

    const wsPath     = ensureWorkspace(this.agentId);
    const model      = ROLE_MODELS[this.role] ?? 'claude-sonnet-4-6';
    const resolved   = resolveTask(this.role, task);
    const rawPrompt  = ROLE_PROMPTS[this.role] ?? '';
    // Design 봇: [DESIGN_SYSTEM_PLACEHOLDER]를 실제 디자인 시스템 토큰으로 교체
    const sysPrompt  = options?.designSystemTokens
      ? rawPrompt.replace('[DESIGN_SYSTEM_PLACEHOLDER]', options.designSystemTokens)
      : rawPrompt.replace('[DESIGN_SYSTEM_PLACEHOLDER]', '기본 다크 테마: #0F0F10 배경, #D4763B 액센트, Pretendard 폰트');
    const apiKey     = process.env.ANTHROPIC_API_KEY ?? '';
    const tmpDir     = os.tmpdir();

    // MCP 설정 파일 (역할에 따라)
    const mcpCfgPath = writeMcpConfig(this.role, tmpDir);

    const args = [
      cliPath,
      '--print', resolved,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--model', model,
    ];

    if (sysPrompt)   args.push('--append-system-prompt', sysPrompt);
    if (mcpCfgPath)  args.push('--mcp-config', mcpCfgPath);
    if (fs.existsSync(CLAUDE_DIR)) args.push('--add-dir', CLAUDE_DIR);

    send('start', { agentId: this.agentId, role: this.role, model, task });

    const { execPath: nodeExec, extraEnv: nodeEnv } = getNodeExecutable();

    const TIMEOUT_MS = 5 * 60 * 1000; // 5분 타임아웃

    return new Promise<void>((resolve) => {
      this.proc = spawn(nodeExec, args, {
        cwd: wsPath,
        env: {
          ...process.env,
          ...nodeEnv,              // ELECTRON_RUN_AS_NODE=1 (패키징 환경에서 Electron을 Node로 실행)
          ANTHROPIC_API_KEY: apiKey,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // 타임아웃: 5분 초과 시 강제 종료
      const timeoutId = setTimeout(() => {
        if (this.proc && !this.stopped) {
          send('output', { text: '\n⏱️ 실행 시간이 5분을 초과하여 종료되었습니다.' });
          this.stop();
          send('done', { success: false, exitCode: -1 });
          resolve();
        }
      }, TIMEOUT_MS);

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
        clearTimeout(timeoutId);
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
