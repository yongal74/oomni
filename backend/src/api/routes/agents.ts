import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ParallelExecutor, type ParallelResult } from '../../services/parallelExecutor';
import { saveFeedItem } from '../../services/roleExecutors/base';
import { ClaudeCodeService } from '../../services/claudeCodeService';
import { routeToExecutor } from '../../services/roleExecutors';
import { killPtySession } from '../../services/ptyService';

// ── Workspace file tree types ────────────────────────────────────────────────
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: string;
  language?: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  tsx: 'tsx', ts: 'ts', jsx: 'jsx', js: 'js',
  py: 'py', json: 'json', md: 'md', css: 'css',
  scss: 'scss', html: 'html', sql: 'sql', sh: 'sh',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', env: 'env',
  txt: 'txt', rs: 'rs', go: 'go', java: 'java',
};

function detectLanguage(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_MAP[ext];
}

function buildFileTree(dirPath: string, relativeTo: string): FileNode[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Skip hidden files and common noise folders
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', '__pycache__', '.git', 'dist', 'build', '.next'].includes(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(relativeTo, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          children: buildFileTree(fullPath, relativeTo),
        });
      } else if (entry.isFile()) {
        let size: number | undefined;
        let modified: string | undefined;
        try {
          const stat = fs.statSync(fullPath);
          size = stat.size;
          modified = stat.mtime.toISOString();
        } catch {
          // ignore
        }
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          size,
          modified,
          language: detectLanguage(entry.name),
        });
      }
    }

    // Directories first, then files, both alphabetical
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

// SSE 스트림 전용 세션 토큰 검증 헬퍼
// EventSource는 Authorization 헤더 설정 불가 → URL 쿼리 파라미터 token 검증
async function verifyStreamToken(
  db: DbClient,
  token: string
): Promise<{ user_id: string } | null> {
  if (!token) return null;
  // 내부 API 키는 즉시 통과 (Electron 앱 기본 인증)
  const internalKey = process.env.OOMNI_INTERNAL_API_KEY ?? 'oomni-internal-dev-key-change-me!';
  if (token === internalKey) return { user_id: 'internal' };
  try {
    const result = await db.query(
      `SELECT user_id FROM sessions
       WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [token]
    );
    if (result.rows.length === 0) return null;
    await db.query(`UPDATE sessions SET last_used_at = datetime('now') WHERE token = ?`, [token]);
    return result.rows[0] as { user_id: string };
  } catch {
    return null;
  }
}

const VALID_ROLES = ['research','build','design','content','growth','ops','integration','ceo'] as const;
const VALID_SCHEDULES = ['manual','hourly','daily','weekly'] as const;

const CreateAgentSchema = z.object({
  mission_id: z.string().min(1),
  name: z.string().min(1).max(100),
  role: z.enum(VALID_ROLES),
  schedule: z.enum(VALID_SCHEDULES).default('manual'),
  system_prompt: z.string().max(10000).default(''),
  budget_cents: z.number().int().min(0).max(100000).default(500),
  reports_to: z.string().nullable().optional(),
});

export function agentsRouter(db: DbClient): Router {
  const router = Router();

  /**
   * @openapi
   * /api/agents:
   *   get:
   *     summary: 에이전트 목록 조회
   *     tags: [Agents]
   *     parameters:
   *       - in: query
   *         name: mission_id
   *         schema:
   *           type: string
   *         description: 미션 ID로 필터링
   *     responses:
   *       200:
   *         description: 에이전트 목록
   */
  // GET /api/agents
  router.get('/', async (req: Request, res: Response) => {
    const { mission_id } = req.query;
    let sql = 'SELECT * FROM agents ORDER BY created_at DESC';
    const params: unknown[] = [];

    if (mission_id) {
      sql = 'SELECT * FROM agents WHERE mission_id = $1 ORDER BY created_at DESC';
      params.push(mission_id);
    }

    const result = await db.query(sql, params);
    res.json({ data: result.rows });
  });

  /**
   * @openapi
   * /api/agents:
   *   post:
   *     summary: 새 에이전트 생성
   *     tags: [Agents]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [mission_id, name, role]
   *             properties:
   *               mission_id: { type: string }
   *               name: { type: string }
   *               role: { type: string, enum: [research, build, design, content, growth, ops, integration, ceo] }
   *               schedule: { type: string, enum: [manual, hourly, daily, weekly] }
   *     responses:
   *       201:
   *         description: 생성된 에이전트
   */
  // POST /api/agents
  router.post('/', async (req: Request, res: Response) => {
    const parsed = CreateAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
      return;
    }

    const { mission_id, name, role, schedule, system_prompt, budget_cents, reports_to } = parsed.data;

    // 미션 존재 여부 사전 확인 (stale mission_id 방지)
    const missionCheck = await db.query('SELECT id FROM missions WHERE id = $1', [mission_id]);
    if ((missionCheck.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '미션을 찾을 수 없습니다. 앱을 새로고침하고 다시 시도하세요.' });
      return;
    }

    const id = uuidv4();

    try {
      const result = await db.query(
        `INSERT INTO agents (id, mission_id, name, role, schedule, system_prompt, budget_cents, reports_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [id, mission_id, name, role, schedule, system_prompt, budget_cents, reports_to ?? null],
      );
      res.status(201).json({ data: (result.rows as unknown[])[0] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `봇 생성 실패: ${msg}` });
    }
  });

  // GET /api/agents/:id
  router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    if ((result.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }
    res.json({ data: (result.rows as unknown[])[0] });
  });

  // PATCH /api/agents/:id
  router.patch('/:id', async (req: Request, res: Response) => {
    const allowed = ['name', 'schedule', 'system_prompt', 'budget_cents', 'is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: '변경할 필드가 없습니다' });
      return;
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if ((result.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }
    res.json({ data: (result.rows as unknown[])[0] });
  });

  // GET /api/agents/:id/workspace-files — 워크스페이스 파일 트리
  router.get('/:id/workspace-files', (req: Request, res: Response) => {
    const agentId = String(req.params.id);
    const workspaceRoot = path.join('C:/oomni-data/workspaces', agentId);

    if (!fs.existsSync(workspaceRoot)) {
      // Return empty tree — workspace not yet created
      res.json({ data: [], workspace: workspaceRoot, exists: false });
      return;
    }

    const tree = buildFileTree(workspaceRoot, workspaceRoot);
    res.json({ data: tree, workspace: workspaceRoot, exists: true });
  });

  // GET /api/agents/:id/workspace-files/content?path=src/foo.tsx — 파일 내용 읽기
  router.get('/:id/workspace-files/content', (req: Request, res: Response) => {
    const agentId = String(req.params.id);
    const filePath = typeof req.query.path === 'string' ? req.query.path : '';

    if (!filePath) {
      res.status(400).json({ error: 'path 쿼리 파라미터가 필요합니다' });
      return;
    }

    const workspaceRoot = path.join('C:/oomni-data/workspaces', agentId);
    // Prevent path traversal
    const resolved = path.resolve(workspaceRoot, filePath);
    if (!resolved.startsWith(path.resolve(workspaceRoot))) {
      res.status(403).json({ error: '허용되지 않는 경로입니다' });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: '파일을 찾을 수 없습니다' });
      return;
    }

    try {
      const content = fs.readFileSync(resolved, 'utf-8');
      res.json({ data: content, path: filePath });
    } catch {
      res.status(500).json({ error: '파일을 읽을 수 없습니다' });
    }
  });

  // POST /api/agents/:id/trigger — 봇 즉시 실행 (ClaudeCodeService 백그라운드)
  router.post('/:id/trigger', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    const rows = result.rows as Array<{ id: string; is_active: boolean; budget_cents: number }>;

    if (rows.length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }

    const agent = rows[0];
    if (!agent.is_active) {
      res.status(409).json({ error: '비활성 봇은 실행할 수 없습니다' });
      return;
    }

    const task: string = typeof req.body?.task === 'string' ? req.body.task : '정기 실행';
    const agentFull = rows[0] as {
      id: string; name: string; role: string; mission_id: string;
      is_active: boolean; system_prompt: string; budget_cents: number;
    };

    // Design/Build Bot은 Claude Code CLI (ClaudeCodeService) 사용
    // 나머지 봇은 Anthropic SDK 직접 호출 (routeToExecutor)
    if (agentFull.role === 'design' || agentFull.role === 'build') {
      const ccService = ClaudeCodeService.create(agentFull.id, agentFull.role);
      ccService.execute(task, async (event, data) => {
        if (event === 'done') {
          await saveFeedItem(db, agentFull.id, 'result', `태스크 완료: ${task}`).catch(() => {});
        } else if (event === 'error') {
          const msg = (data as { message: string }).message ?? 'Unknown error';
          await saveFeedItem(db, agentFull.id, 'error', `실행 오류: ${msg}`).catch(() => {});
        }
      }).catch(async (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        await saveFeedItem(db, agentFull.id, 'error', `실행 오류: ${errMsg}`).catch(() => {});
      });
    } else {
      // Anthropic SDK 직접 호출 — 백그라운드 실행, feed_items에 결과 저장
      const noopSend = (_event: string, _data: unknown): void => { /* 백그라운드: SSE 불필요 */ };
      routeToExecutor({ agent: agentFull, task, db, send: noopSend }).catch(async (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        await saveFeedItem(db, agentFull.id, 'error', `실행 오류: ${errMsg}`).catch(() => {});
      });
    }

    res.status(202).json({
      success: true,
      message: '봇 실행 시작됨 (실시간 확인: GET /api/agents/:id/stream)',
      method: (agentFull.role === 'design' || agentFull.role === 'build') ? 'claude_code_service' : 'anthropic_sdk',
      agentId: agentFull.id,
      task,
    });
  });

  // GET /api/agents/:id/stream — SSE: ClaudeCodeService 실시간 출력 스트리밍
  // Usage: GET /api/agents/:id/stream?task=<encoded_task>&token=<session_token>
  // EventSource는 헤더 설정 불가 → 쿼리 파라미터 token으로 세션 검증
  router.get('/:id/stream', async (req: Request, res: Response) => {
    // 쿼리 파라미터 토큰 검증
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    if (!queryToken) {
      res.status(401).json({ error: '인증이 필요합니다', code: 'AUTH_REQUIRED' });
      return;
    }
    const sessionRow = await verifyStreamToken(db, queryToken);
    if (!sessionRow) {
      res.status(401).json({ error: '세션이 만료되었거나 유효하지 않습니다', code: 'SESSION_INVALID' });
      return;
    }

    const agentResult = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    const agentRows = agentResult.rows as Array<{ id: string; is_active: boolean }>;

    if (agentRows.length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }

    const agent = agentRows[0];
    if (!agent.is_active) {
      res.status(409).json({ error: '비활성 봇은 실행할 수 없습니다' });
      return;
    }

    const task: string | undefined =
      typeof req.query.task === 'string' && req.query.task.length > 0
        ? req.query.task
        : undefined;

    // 모델 / 외부 API 키 쿼리 파라미터 파싱
    const overrideModel = typeof req.query.model === 'string' && req.query.model.length > 0
      ? req.query.model
      : undefined;
    const externalKeys = {
      openai:     typeof req.query.openai_key === 'string'     ? req.query.openai_key     : undefined,
      perplexity: typeof req.query.perplexity_key === 'string' ? req.query.perplexity_key : undefined,
      gemini:     typeof req.query.gemini_key === 'string'     ? req.query.gemini_key     : undefined,
    };

    // SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // output 텍스트 축적 (실행 기록에 저장용)
    let accumulatedOutput = '';
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // output/tool_use 이벤트 텍스트 축적
      if (event === 'output' && data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (typeof d.text === 'string') accumulatedOutput += d.text;
        if (typeof d.chunk === 'string') accumulatedOutput += d.chunk;
      }
    };

    const taskStr = task ?? '정기 실행';
    const agentFull = agentRows[0] as {
      id: string; name: string; role: string; mission_id: string;
      is_active: boolean; system_prompt: string; budget_cents: number;
    };

    send('start', { agentId: agentFull.id, task: taskStr });

    // 실행 기록 생성 (heartbeat_runs)
    const runId = uuidv4();
    await db.query(
      `INSERT INTO heartbeat_runs (id, agent_id, task, status, started_at) VALUES ($1,$2,$3,'running',strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      [runId, agentFull.id, taskStr]
    ).catch(() => {}); // 실패해도 실행은 계속

    try {
      // Design Bot: 디자인 시스템 토큰 조회 후 task에 주입
      let enrichedTask = taskStr;
      if (agentFull.role === 'design') {
        try {
          const dsResult = await db.query(
            'SELECT * FROM design_systems WHERE mission_id = $1',
            [agentFull.mission_id]
          );
          if (dsResult.rows.length > 0) {
            const ds = dsResult.rows[0] as Record<string, string>;
            enrichedTask = `${taskStr}

[디자인 시스템 토큰]
- Primary Color: ${ds.primary_color}
- Background: ${ds.bg_color}
- Surface: ${ds.surface_color}
- Text: ${ds.text_color}
- Font: ${ds.font_family}
- Border Radius: ${ds.border_radius}`;
          }
        } catch { /* 디자인 시스템 없으면 기본값 사용 */ }
      }

      // 모든 봇: routeToExecutor (feed_items 저장, UI 표시)
      await routeToExecutor({ agent: agentFull, task: enrichedTask, db, send, overrideModel, externalKeys });
      send('done', { success: true });
      // 실행 성공 기록 (output 포함)
      const outputToSave = accumulatedOutput.trim().slice(0, 50000); // 최대 50KB
      await db.query(
        `UPDATE heartbeat_runs SET status='completed', output=$1, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$2`,
        [outputToSave || null, runId]
      ).catch(() => {});
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await saveFeedItem(db, agentFull.id, 'error', `실행 오류: ${errMsg}`).catch(() => {});
      send('error', { message: errMsg });
      // 실행 실패 기록 (output 포함)
      const outputToSave = accumulatedOutput.trim().slice(0, 50000);
      await db.query(
        `UPDATE heartbeat_runs SET status='failed', output=$1, error=$2, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$3`,
        [outputToSave || null, errMsg, runId]
      ).catch(() => {});
    }

    res.end();
  });

  // POST /api/agents/:id/chat — chunked HTTP 스트리밍 (Electron 로컬 앱 — auth 불필요)
  router.post('/:id/chat', async (req: Request, res: Response) => {
    const agentResult = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    const agentRows = agentResult.rows as Array<{ id: string; is_active: boolean }>;

    if (agentRows.length === 0) {
      res.status(404).json({ error: '봇을 찾을 수 없습니다' });
      return;
    }

    const agent = agentRows[0];
    if (!agent.is_active) {
      res.status(409).json({ error: '비활성 봇은 실행할 수 없습니다' });
      return;
    }

    const task: string = typeof req.body?.task === 'string' && req.body.task.length > 0
      ? req.body.task
      : '정기 실행';
    const overrideModel = typeof req.body?.model === 'string' && req.body.model.length > 0
      ? req.body.model
      : undefined;

    // chunked HTTP 스트리밍 헤더 설정
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // JSON 라인 전송 헬퍼
    let accumulatedOutput = '';
    const send = (event: string, data: unknown): void => {
      res.write(JSON.stringify({ event, data }) + '\n');
      if (event === 'output' && data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (typeof d.text === 'string') accumulatedOutput += d.text;
        if (typeof d.chunk === 'string') accumulatedOutput += d.chunk;
      }
    };

    const agentFull = agentRows[0] as {
      id: string; name: string; role: string; mission_id: string;
      is_active: boolean; system_prompt: string; budget_cents: number;
    };

    send('start', { agentId: agentFull.id, task });

    // 실행 기록 생성 (heartbeat_runs)
    const runId = uuidv4();
    await db.query(
      `INSERT INTO heartbeat_runs (id, agent_id, task, status, started_at) VALUES ($1,$2,$3,'running',strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      [runId, agentFull.id, task]
    ).catch(() => {});

    try {
      if (agentFull.role === 'design') {
        // Design Bot: ClaudeCodeService → Claude Code CLI + Pencil MCP (stdio)
        // routeToExecutor(designExecutor)는 Anthropic SDK 직접 호출이라 Pencil MCP가 실행되지 않음
        let designSystemTokens: string | undefined;
        try {
          const dsResult = await db.query(
            'SELECT * FROM design_systems WHERE mission_id = $1',
            [agentFull.mission_id]
          );
          if (dsResult.rows.length > 0) {
            const ds = dsResult.rows[0] as Record<string, string>;
            designSystemTokens = [
              `Primary: ${ds.primary_color}`,
              `Background: ${ds.bg_color}`,
              `Surface: ${ds.surface_color}`,
              `Text: ${ds.text_color}`,
              `Font: ${ds.font_family}`,
              `Radius: ${ds.border_radius}`,
            ].join(', ');
          }
        } catch { /* 디자인 시스템 없으면 기본값 사용 */ }

        const ccService = ClaudeCodeService.create(agentFull.id, agentFull.role);
        // ClaudeCodeService가 'start'/'done'/'output' 등을 직접 send()로 전송
        await ccService.execute(task, send, { designSystemTokens });
        // done은 ClaudeCodeService 내부에서 이미 전송됨 — 중복 전송 금지
      } else {
        await routeToExecutor({ agent: agentFull, task, db, send, overrideModel });
        res.write(JSON.stringify({ event: 'done', data: { success: true } }) + '\n');
      }
      const outputToSave = accumulatedOutput.trim().slice(0, 50000);
      await db.query(
        `UPDATE heartbeat_runs SET status='completed', output=$1, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$2`,
        [outputToSave || null, runId]
      ).catch(() => {});
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.write(JSON.stringify({ event: 'error', data: { message: errMsg } }) + '\n');
      const outputToSave = accumulatedOutput.trim().slice(0, 50000);
      await db.query(
        `UPDATE heartbeat_runs SET status='failed', output=$1, error=$2, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$3`,
        [outputToSave || null, errMsg, runId]
      ).catch(() => {});
    }

    res.end();
  });

  // GET /api/agents/:id/heartbeat-runs — heartbeat_runs 테이블 실행 기록 조회
  router.get('/:id/heartbeat-runs', async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const limit = parseInt(req.query.limit as string) || 20
      const result = await db.query(
        `SELECT id, agent_id, task, status, output, error, tokens_input, tokens_output, cost_usd, started_at, finished_at
         FROM heartbeat_runs
         WHERE agent_id = $1
         ORDER BY started_at DESC
         LIMIT $2`,
        [id, limit]
      )
      res.json({ data: result.rows })
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch runs' })
    }
  });

  // GET /api/agents/:id/runs — 최근 피드 아이템 조회
  router.get('/:id/runs', async (req: Request, res: Response) => {
    const result = await db.query(
      'SELECT * FROM feed_items WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.id],
    );
    res.json({ data: result.rows });
  });

  // GET /api/agents/:id/runs/stats — 실행 통계
  router.get('/:id/runs/stats', async (req: Request, res: Response) => {
    const rows = (await db.query(
      'SELECT * FROM feed_items WHERE agent_id = $1 ORDER BY created_at DESC',
      [req.params.id],
    )).rows as Array<{ type: string; created_at: string }>;

    const total_runs = rows.length;
    const success_count = rows.filter(r => r.type === 'result').length;
    const error_count = rows.filter(r => r.type === 'error').length;
    const last_run_at = rows.length > 0 ? rows[0].created_at : null;

    res.json({ data: { total_runs, success_count, error_count, last_run_at } });
  });

  // DELETE /api/agents/:id/terminal — PTY 세션 강제 종료 (세션 초기화)
  router.delete('/:id/terminal', (req: Request, res: Response) => {
    killPtySession(String(req.params.id));
    res.json({ ok: true });
  });

  // GET /api/agents/:id/pencil-status — Pencil MCP 연동 상태 확인 (로컬 바이너리, Antigravity 완전 무관)
  router.get('/:id/pencil-status', (_req: Request, res: Response) => {
    try {
      // getRoleMcpConfig('design')와 동일한 탐색 로직 — 로컬 설치 바이너리 우선
      const winBinary = path.join(
        os.homedir(),
        'AppData', 'Local', 'Programs', 'Pencil',
        'resources', 'app.asar.unpacked', 'out', 'mcp-server-windows-x64.exe',
      );
      const macBinary = path.join(
        '/Applications', 'Pencil.app', 'Contents', 'Resources',
        'app.asar.unpacked', 'out', 'mcp-server',
      );

      let binaryPath: string | null = null;
      if (process.platform === 'win32' && fs.existsSync(winBinary)) {
        binaryPath = winBinary;
      } else if (process.platform === 'darwin' && fs.existsSync(macBinary)) {
        binaryPath = macBinary;
      }

      res.json({
        connected: !!binaryPath,
        method: 'local_binary',
        binaryPath: binaryPath ?? 'not_found',
      });
    } catch {
      res.json({ connected: false, reason: 'error' });
    }
  });

  // DELETE /api/agents/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    await db.query('DELETE FROM agents WHERE id = $1', [req.params.id]);
    res.status(204).send();
  });

  // POST /api/agents/batch-trigger — 여러 봇 동시 실행
  router.post('/batch-trigger', async (req: Request, res: Response) => {
    const { agent_ids, task, mission_id } = req.body as {
      agent_ids?: unknown;
      task?: unknown;
      mission_id?: unknown;
    };

    if (!Array.isArray(agent_ids) || agent_ids.length === 0) {
      res.status(400).json({ error: 'agent_ids 배열이 필요합니다' });
      return;
    }

    const ids = agent_ids as string[];
    const taskStr: string = typeof task === 'string' && task.length > 0 ? task : '정기 작업 실행';

    // Fetch agents from DB
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const agentResult = await db.query(
      `SELECT id, name, is_active FROM agents WHERE id IN (${placeholders})`,
      ids,
    );
    const agentRows = agentResult.rows as Array<{ id: string; name: string; is_active: boolean }>;

    const foundIds = new Set(agentRows.map((a) => a.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      res.status(404).json({ error: `봇을 찾을 수 없습니다: ${missingIds.join(', ')}` });
      return;
    }

    const activeAgents = agentRows.filter((a) => a.is_active);
    if (activeAgents.length === 0) {
      res.status(409).json({ error: '실행 가능한 활성 봇이 없습니다' });
      return;
    }

    const jobs = activeAgents.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      task: taskStr,
    }));

    const onProgress = async (result: ParallelResult): Promise<void> => {
      const feedType = result.success ? 'result' : 'error';
      const feedContent = result.success
        ? result.output
        : `병렬 실행 실패 (${result.error ?? 'unknown'}): ${result.output}`;

      const feedId = uuidv4();
      await db.query(
        `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [feedId, result.agentId, mission_id ?? null, feedType, feedContent, null, null, false],
      );
    };

    const allResults = await ParallelExecutor.run(jobs, 3, (result) => {
      onProgress(result).catch(() => {/* best-effort feed save */});
    });

    const successCount = allResults.filter((r) => r.success).length;
    const failedCount = allResults.length - successCount;

    res.status(200).json({
      data: {
        results: allResults,
        total: allResults.length,
        success: successCount,
        failed: failedCount,
      },
    });
  });

  // POST /api/missions/:id/run-all — 미션의 모든 활성 봇 병렬 실행
  router.post('/missions/:id/run-all', async (req: Request, res: Response) => {
    const missionId = req.params.id;

    const agentResult = await db.query(
      'SELECT id, name FROM agents WHERE mission_id = $1 AND is_active = true',
      [missionId],
    );
    const agentRows = agentResult.rows as Array<{ id: string; name: string }>;

    if (agentRows.length === 0) {
      res.status(404).json({ error: '해당 미션에 활성 봇이 없습니다' });
      return;
    }

    const defaultTask = '정기 작업 실행';
    const jobs = agentRows.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      task: defaultTask,
    }));

    const onProgress = async (result: ParallelResult): Promise<void> => {
      const feedType = result.success ? 'result' : 'error';
      const feedContent = result.success
        ? result.output
        : `병렬 실행 실패 (${result.error ?? 'unknown'}): ${result.output}`;

      const feedId = uuidv4();
      await db.query(
        `INSERT INTO feed_items (id, agent_id, run_id, type, content, action_label, action_data, requires_approval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [feedId, result.agentId, missionId, feedType, feedContent, null, null, false],
      );
    };

    const allResults = await ParallelExecutor.run(jobs, 3, (result) => {
      onProgress(result).catch(() => {/* best-effort feed save */});
    });

    const successCount = allResults.filter((r) => r.success).length;
    const failedCount = allResults.length - successCount;

    res.status(200).json({
      data: {
        results: allResults,
        total: allResults.length,
        success: successCount,
        failed: failedCount,
      },
    });
  });

  return router;
}
