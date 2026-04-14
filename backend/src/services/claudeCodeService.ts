/**
 * claudeCodeService.ts — Antigravity 방식 Claude Code CLI 안정적 실행 엔진
 *
 * 핵심 설계:
 * - node_modules/@anthropic-ai/claude-code/cli.js 절대경로 직접 실행 (PATH 불필요)
 * - 패키징된 Electron 앱에서도 동작: process.execPath + ELECTRON_RUN_AS_NODE=1
 * - 역할별 MCP 서버 자동 연결 (Design→Pencil, Ops→n8n-mcp)
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
  ceo:         'claude-opus-4-6',             // CEO 판단 → 최고 품질
};

// ── 역할별 MCP 서버 설정 ──────────────────────────────────────
interface McpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * npx 실행 경로 탐색 — Pencil MCP 독립 실행용 (Antigravity 비의존)
 * 우선순위: 환경변수 → 플랫폼별 표준 위치 → PATH 폴백
 */
function findNpxPath(): string {
  if (process.env.NPX_PATH && fs.existsSync(process.env.NPX_PATH)) {
    return process.env.NPX_PATH;
  }
  if (process.platform === 'win32') {
    const candidates = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'npx.cmd'),
      'C:\\Program Files\\nodejs\\npx.cmd',
      path.join(os.homedir(), 'scoop', 'shims', 'npx.cmd'),
    ];
    return candidates.find(p => fs.existsSync(p)) ?? 'npx';
  }
  const candidates = [
    '/usr/local/bin/npx',
    '/usr/bin/npx',
    path.join(os.homedir(), '.npm-global', 'bin', 'npx'),
    path.join(os.homedir(), '.nvm', 'versions', 'node', 'current', 'bin', 'npx'),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? 'npx';
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
    // npx @pencilapp/mcp-server — Antigravity 완전 독립 실행
    // pencil.dev 데스크탑 앱과 직접 연동 (Antigravity 패널 우회)
    const npx = findNpxPath();
    return {
      pencil: {
        command: npx,
        args: ['-y', '@pencilapp/mcp-server'],
        env: {},
      },
    };
  }

  if (role === 'ops') {
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

    design: `당신은 세계 최고 수준의 UI/UX 디자인 에이전트입니다.

## 디자인 토큰 (Design System)
아래 토큰은 현재 프로젝트 디자인 시스템입니다. 모든 디자인에 일관되게 적용하세요:
[DESIGN_SYSTEM_PLACEHOLDER]

## 작업 순서 (반드시 준수)

### Step 1: HTML 파일 생성
저장 경로: ${DATA_ROOT}/design/YYYY-MM-DD_HH-MM/preview.html
- 인라인 CSS + 실제 콘텐츠 사용 (Lorem ipsum 금지)
- 디자인 토큰 색상 그대로 적용
- 8px 그리드 기반 spacing

### Step 2: React 컴포넌트 저장
${DATA_ROOT}/design/YYYY-MM-DD_HH-MM/component.tsx

## 디자인 품질 기준
- 8px 그리드 기반 spacing (padding: 8, 16, 24, 32, 48, 64px)
- WCAG AA 명도 대비 이상
- hover/focus/active 상태 명시
- 반응형 (mobile-first)
- 실제 콘텐츠 사용 (Lorem ipsum 금지)

## 완료 후 출력
✅ preview.html → [경로]
✅ component.tsx → [경로]`,

    designPencil: `당신은 Pencil MCP를 활용하는 세계 최고 수준의 UI/UX 디자인 에이전트입니다.
Pencil.dev 앱이 실행 중이며, mcp__pencil__ 도구로 실제 .pen 디자인 파일을 생성/편집합니다.

## 디자인 토큰 (Design System)
아래 토큰은 현재 프로젝트 디자인 시스템입니다. 모든 디자인에 일관되게 적용하세요:
[DESIGN_SYSTEM_PLACEHOLDER]

## 작업 순서 (반드시 준수)

### Step 1: Pencil 문서 열기
mcp__pencil__open_document({ filePathOrNew: "new" })

### Step 2: 가이드라인 확인
mcp__pencil__get_guidelines() 로 사용 가능한 스타일/가이드 확인

### Step 3: 디자인 실행
mcp__pencil__batch_design 도구로 UI 컴포넌트를 삽입합니다.
- 디자인 토큰의 색상(primary, bg, surface, text, muted) 그대로 적용
- Linear/Stripe/Vercel 수준의 레이아웃과 간격(8px 그리드)

### Step 4: 시각적 검증
mcp__pencil__get_screenshot 으로 각 섹션 완성 후 스크린샷 확인

### Step 5: HTML 코드 파일 저장
${DATA_ROOT}/design/YYYY-MM-DD_HH-MM/preview.html

### Step 6: React 컴포넌트 저장
${DATA_ROOT}/design/YYYY-MM-DD_HH-MM/component.tsx

## 디자인 품질 기준
- 8px 그리드 기반 spacing
- WCAG AA 명도 대비 이상
- hover/focus/active 상태 명시
- 반응형 (mobile-first)
- 실제 콘텐츠 사용 (Lorem ipsum 금지)

## 완료 후 출력
✅ Pencil .pen 파일 작업 완료
✅ preview.html → [경로]
✅ component.tsx → [경로]`,

    growth: `당신은 그로스 해킹 에이전트입니다. KPI + 실행 액션 아이템 제시.
결과: ${DATA_ROOT}/growth/ 저장.`,

    ops: `당신은 n8n 워크플로우 자동화 전문 에이전트입니다. n8n MCP 도구로 실제 워크플로우를 생성/배포합니다.

## 작업 순서 (반드시 준수)

### Step 1: 멀티소스 리서치 (WebFetch 필수 실행)
사용자 요청 키워드로 아래 소스들을 순서대로 조회하고 최적 패턴을 수집하세요:

**공식 소스 (최우선)**
- 공식 템플릿 갤러리: https://n8n.io/workflows/
- 카테고리별 필터: https://n8n.io/workflows/?categories=25 (AI), https://n8n.io/workflows/?categories=5 (Marketing)
- 공식 통합 문서: https://docs.n8n.io/integrations/builtin/
- 공식 블로그 튜토리얼: https://blog.n8n.io/
- 릴리즈 노트 (최신 기능): https://docs.n8n.io/release-notes/

**커뮤니티 소스 (실전 사례)**
- 커뮤니티 포럼: https://community.n8n.io/c/show-and-tell/5 (실제 사용 사례)
- 커뮤니티 질문: https://community.n8n.io/c/questions/12
- GitHub 토론: https://github.com/n8n-io/n8n/discussions
- Reddit: https://www.reddit.com/r/n8n/ (검색: site:reddit.com/r/n8n {키워드})

**심화 학습 소스**
- n8n YouTube 채널 튜토리얼 목록: https://www.youtube.com/@n8n-io/videos
- n8n Academy: https://community.n8n.io/c/academy/
- 서드파티 가이드: https://nocodehq.com/n8n-tutorials/
- Automatisch (오픈소스 대안, 호환 노드 참고): https://automatisch.io/docs

**서비스별 공식 Webhook/API 문서**
- 요청에 포함된 서비스(Slack/Gmail/GitHub/Notion 등)의 공식 API docs도 WebFetch로 조회

WebFetch로 최소 3개 이상 소스를 실제 조회한 후 패턴을 통합하세요.

### Step 2: 요청 분석 및 설계
- 사용자 요청의 핵심 자동화 목표 파악
- 관련 n8n 노드 식별 (Trigger, Action, Logic, Error Handler)
- 에러 처리 및 재시도 로직 설계 (Try/Catch 노드, Wait 노드 활용)
- 데이터 매핑 및 변환 구조 설계 (Code 노드, Set 노드)
- Rate limiting 및 pagination 처리 방안

### Step 3: n8n MCP로 워크플로우 생성
n8n MCP 도구를 사용하여 실제 워크플로우를 생성하세요:
- n8n__create_workflow 또는 n8n__update_workflow 호출
- 노드 연결 및 설정값 정확히 입력
- Webhook URL, API 키 필드는 플레이스홀더로 설정
- 워크플로우 이름: 기능을 명확히 표현 (예: "Slack→GitHub Issue Auto-Creator")

### Step 4: 검증 및 문서화
워크플로우 생성 후:
- 워크플로우 ID와 접속 URL 출력
- 설정 필요 항목 명세 (API 키, Webhook URL 등)
- 트리거 조건 및 실행 흐름 설명
- 에러 시나리오별 대응 방법

## 카테고리별 베스트 프랙티스
**Slack 연동**: Event Trigger → IF(filter) → HTTP Request / Slack Node 구조. 스레드 답글은 thread_ts 보존 필수.
**Gmail/Email**: Schedule/Webhook → Gmail OAuth2 → HTML Template → Send. 첨부파일은 Binary Data 노드.
**GitHub**: Webhook Trigger → Switch(event type) → conditional action. PR/Issue/Push 각각 분기.
**데이터 파이프라인**: HTTP Request(paginate) → Loop Over Items → Code(transform) → DB/Sheet upsert.
**CRM(HubSpot/Salesforce)**: Trigger → Merge(dedup) → CRM Upsert → Slack notify.
**AI 자동화**: HTTP/Webhook → OpenAI/Anthropic → Parse JSON → 후속 액션. 토큰 비용 모니터링.
**Notion**: Webhook/DB Query → Filter → Page Create/Update. rich_text 타입 처리 주의.
**Scheduled Reports**: Schedule → DB Query → Code(aggregate) → Email/Slack → 결과 저장.

## 완료 후 출력
✅ 참고한 소스: [URL 목록]
✅ 생성된 워크플로우 ID: [ID]
✅ n8n 접속: http://localhost:5678/workflow/[ID]
✅ 설정 필요 항목: [목록]
✅ 예상 실행 비용/분: [견적]
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
    // Design 봇: designPencil 프롬프트 우선 사용 (npx 방식으로 pencil MCP 항상 활성화)
    const rawPrompt  = this.role === 'design'
      ? (ROLE_PROMPTS as any)['designPencil'] ?? ROLE_PROMPTS[this.role] ?? ''
      : ROLE_PROMPTS[this.role] ?? '';
    const tokens = options?.designSystemTokens ?? '기본 다크 테마: #0F0F10 배경, #D4763B 액센트, Pretendard 폰트';
    const sysPrompt  = rawPrompt.replace('[DESIGN_SYSTEM_PLACEHOLDER]', tokens);
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
