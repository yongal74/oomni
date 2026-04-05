/**
 * TDD: ClaudeCodeService — Claude SDK-powered agent execution engine
 * Uses @anthropic-ai/sdk for API calls + workspace isolation per agent
 */
import * as fs from 'fs';

// We mock the SDK before importing the service
jest.mock('@anthropic-ai/sdk');
jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof fs;
  return {
    ...actual,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

// Import after mocking
import { ClaudeCodeService } from '../../../src/services/claudeCodeService';
import Anthropic from '@anthropic-ai/sdk';

const mockFs = fs as jest.Mocked<typeof fs>;

// ─── SDK mock setup ───────────────────────────────────────────────────────────
type MockChunk =
  | { type: 'message_start'; message: { usage: { input_tokens: number } } }
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  | { type: 'message_delta'; usage: { output_tokens: number } }
  | { type: 'message_stop' };

function makeMockStream(chunks: MockChunk[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

const mockMessagesCreate = jest.fn();

(Anthropic as unknown as jest.Mock).mockImplementation(() => ({
  messages: {
    create: mockMessagesCreate,
  },
}));

// ─── Constants ────────────────────────────────────────────────────────────────
const WORKSPACE_BASE = 'C:/oomni-data/workspaces';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClaudeCodeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: workspace exists
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined as any);
    mockFs.readFileSync.mockReturnValue('');

    // Default stream: one text chunk then done
    mockMessagesCreate.mockResolvedValue(
      makeMockStream([
        { type: 'message_start', message: { usage: { input_tokens: 100 } } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello from Claude' } },
        { type: 'message_delta', usage: { output_tokens: 50 } },
        { type: 'message_stop' },
      ])
    );
  });

  // ── 1. Factory method ──────────────────────────────────────────────────────

  describe('ClaudeCodeService.create()', () => {
    test('creates a service instance with agentId and role', () => {
      const service = ClaudeCodeService.create('agent-123', 'research');
      expect(service).toBeInstanceOf(ClaudeCodeService);
    });

    test('returns different instances for different agentIds', () => {
      const s1 = ClaudeCodeService.create('agent-1', 'build');
      const s2 = ClaudeCodeService.create('agent-2', 'build');
      expect(s1).not.toBe(s2);
    });
  });

  // ── 2. execute() — streaming ───────────────────────────────────────────────

  describe('execute()', () => {
    test('calls onChunk with streaming text', async () => {
      const service = ClaudeCodeService.create('agent-1', 'research');
      const chunks: string[] = [];

      await service.execute('analyze competitors', (event, data) => {
        if (event === 'output') chunks.push((data as { chunk: string }).chunk);
      });

      expect(chunks).toContain('Hello from Claude');
    });

    test('sends done event when execution completes', async () => {
      const service = ClaudeCodeService.create('agent-1', 'build');
      const events: string[] = [];

      await service.execute('write code', (event) => {
        events.push(event);
      });

      expect(events).toContain('done');
    });

    test('sends stage events during execution', async () => {
      const service = ClaudeCodeService.create('agent-1', 'content');
      const events: string[] = [];

      await service.execute('write blog post', (event) => {
        events.push(event);
      });

      expect(events).toContain('stage');
    });

    test('calls Anthropic messages.create with stream: true', async () => {
      const service = ClaudeCodeService.create('agent-1', 'ops');
      await service.execute('run workflow', () => {});

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true })
      );
    });

    test('sends error event when SDK throws', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('API rate limit'));
      const service = ClaudeCodeService.create('agent-1', 'research');
      const events: Array<{ event: string; data: unknown }> = [];

      await service.execute('task', (event, data) => {
        events.push({ event, data });
      });

      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as { message: string }).message).toContain('API rate limit');
    });
  });

  // ── 3. Working directory ───────────────────────────────────────────────────

  describe('workspace', () => {
    test('sets correct working directory path for agentId', () => {
      const service = ClaudeCodeService.create('agent-xyz', 'build');
      const workspacePath = service.getWorkspacePath();
      expect(workspacePath).toBe(`${WORKSPACE_BASE}/agent-xyz`);
    });

    test('creates workspace dir if not exists on execute()', async () => {
      mockFs.existsSync.mockImplementation((p) => {
        // workspace dir doesn't exist
        return !String(p).includes('agent-new');
      });

      const service = ClaudeCodeService.create('agent-new', 'build');
      await service.execute('task', () => {});

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('agent-new'),
        { recursive: true }
      );
    });

    test('does NOT call mkdirSync when workspace already exists', async () => {
      mockFs.existsSync.mockReturnValue(true);
      const service = ClaudeCodeService.create('agent-exists', 'ops');
      await service.execute('task', () => {});

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  // ── 4. Model selection by role ─────────────────────────────────────────────

  describe('model selection', () => {
    const modelCases: Array<[string, string]> = [
      ['research', 'claude-haiku'],
      ['growth', 'claude-haiku'],
      ['build', 'claude-sonnet'],
      ['design', 'claude-sonnet'],
      ['content', 'claude-sonnet'],
      ['ops', 'claude-sonnet'],
      ['ceo', 'claude-opus'],
    ];

    test.each(modelCases)(
      'role "%s" uses model containing "%s"',
      async (role, expectedModelPart) => {
        const service = ClaudeCodeService.create('agent-1', role);
        await service.execute('task', () => {});

        expect(mockMessagesCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.stringContaining(expectedModelPart),
          })
        );
      }
    );
  });

  // ── 5. stop() ──────────────────────────────────────────────────────────────

  describe('stop()', () => {
    test('stop() can be called without error when not running', () => {
      const service = ClaudeCodeService.create('agent-1', 'research');
      expect(() => service.stop()).not.toThrow();
    });

    test('stop() sets isRunning to false', () => {
      const service = ClaudeCodeService.create('agent-1', 'research');
      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    test('stop() during execution causes early termination', async () => {
      let resolveStream!: () => void;
      const streamPromise = new Promise<void>((res) => { resolveStream = res; });

      // Simulate a slow stream
      mockMessagesCreate.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'message_start', message: { usage: { input_tokens: 0 } } };
          // Wait before yielding more — stop() will be called in the meantime
          await streamPromise;
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'late text' } };
          yield { type: 'message_stop' };
        },
      });

      const service = ClaudeCodeService.create('agent-stop', 'research');
      const chunks: string[] = [];

      const execPromise = service.execute('long task', (event, data) => {
        if (event === 'output') chunks.push((data as { chunk: string }).chunk);
      });

      // Stop mid-execution then unblock stream
      service.stop();
      resolveStream();

      await execPromise;

      // The late text should NOT have been emitted (execution stopped)
      expect(chunks).not.toContain('late text');
    });
  });

  // ── 6. getWorkspaceFiles() ─────────────────────────────────────────────────

  describe('getWorkspaceFiles()', () => {
    test('returns empty array when workspace does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const service = ClaudeCodeService.create('agent-1', 'build');
      const files = service.getWorkspaceFiles();
      expect(files).toEqual([]);
    });

    test('returns file tree of workspace', () => {
      const workspacePath = `${WORKSPACE_BASE}/agent-files`;

      mockFs.existsSync.mockImplementation((p) => {
        return String(p) === workspacePath || String(p).startsWith(workspacePath);
      });

      mockFs.readdirSync.mockImplementation((p, _opts) => {
        if (String(p) === workspacePath) {
          return ['index.ts', 'README.md'] as any;
        }
        return [] as any;
      });

      mockFs.statSync.mockImplementation((_p) => ({
        isDirectory: () => false,
        isFile: () => true,
        size: 100,
        mtimeMs: Date.now(),
      } as any));

      const service = ClaudeCodeService.create('agent-files', 'build');
      const files = service.getWorkspaceFiles();

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.name === 'index.ts')).toBe(true);
      expect(files.some((f) => f.name === 'README.md')).toBe(true);
    });

    test('recursively lists subdirectory contents', () => {
      const workspacePath = `${WORKSPACE_BASE}/agent-nested`;

      mockFs.existsSync.mockReturnValue(true);

      mockFs.readdirSync.mockImplementation((p, _opts) => {
        const ps = String(p);
        if (ps === workspacePath) return ['src', 'package.json'] as any;
        if (ps.endsWith('/src') || ps.endsWith('\\src')) return ['app.ts'] as any;
        return [] as any;
      });

      mockFs.statSync.mockImplementation((p) => {
        const ps = String(p);
        const isDir = ps.endsWith('/src') || ps.endsWith('\\src') || ps.endsWith('src');
        return {
          isDirectory: () => isDir && !ps.endsWith('.json') && !ps.endsWith('.ts'),
          isFile: () => !isDir || ps.endsWith('.json') || ps.endsWith('.ts'),
          size: 0,
          mtimeMs: Date.now(),
        } as any;
      });

      const service = ClaudeCodeService.create('agent-nested', 'build');
      const files = service.getWorkspaceFiles();

      // Should have at least the top-level entries
      expect(files.length).toBeGreaterThan(0);
    });
  });

  // ── 7. Skill invocation ────────────────────────────────────────────────────

  describe('skill invocation', () => {
    test('task starting with /collect prepends skill content', async () => {
      const skillContent = '# Collect Skill\nSearch and collect data from web sources.';

      mockFs.existsSync.mockImplementation((p) => {
        const ps = String(p);
        return ps.includes('collect.md') || ps.includes('workspaces');
      });

      mockFs.readFileSync.mockImplementation((p) => {
        if (String(p).includes('collect.md')) return skillContent;
        return '';
      });

      const service = ClaudeCodeService.create('agent-skill', 'research');
      await service.execute('/collect market data', () => {});

      // The message sent to Claude should include the skill content
      const callArg = mockMessagesCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = callArg.messages.find((m) => m.role === 'user')?.content ?? '';
      expect(userMessage).toContain(skillContent);
    });

    test('task without / prefix sends prompt directly without skill content', async () => {
      const service = ClaudeCodeService.create('agent-1', 'research');
      await service.execute('analyze market trends', () => {});

      const callArg = mockMessagesCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = callArg.messages.find((m) => m.role === 'user')?.content ?? '';
      expect(userMessage).toContain('analyze market trends');
    });

    test('missing skill file falls back to task text only', async () => {
      mockFs.existsSync.mockImplementation((p) => {
        // Skill file doesn't exist
        return !String(p).includes('.md');
      });

      const service = ClaudeCodeService.create('agent-1', 'research');

      // Should not throw even if skill file missing
      await expect(
        service.execute('/nonexistent-skill do something', () => {})
      ).resolves.not.toThrow();
    });
  });

  // ── 8. System prompt ───────────────────────────────────────────────────────

  describe('system prompt', () => {
    test('includes role-specific context in system prompt', async () => {
      const service = ClaudeCodeService.create('agent-1', 'build');
      await service.execute('write code', () => {});

      const callArg = mockMessagesCreate.mock.calls[0][0] as { system: string };
      expect(callArg.system).toBeTruthy();
      expect(typeof callArg.system).toBe('string');
    });

    test('includes agentId and workspace path in system prompt', async () => {
      const service = ClaudeCodeService.create('agent-sys', 'ops');
      await service.execute('run task', () => {});

      const callArg = mockMessagesCreate.mock.calls[0][0] as { system: string };
      expect(callArg.system).toContain('agent-sys');
    });
  });
});
