/**
 * ClaudeCodeExecutor — Claude Code CLI subprocess wrapper
 * Runs `claude -p "task"` non-interactively, streams stdout/stderr as events.
 */
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { getConfig } from '../config';

export interface ExecutionResult {
  success: boolean;
  output: string;
  exitCode: number;
}

export class ClaudeCodeExecutor extends EventEmitter {
  private process: ChildProcess | null = null;

  /**
   * Check if claude CLI is available in PATH.
   * Tries 'claude' (and 'claude.exe' on Windows) via `claude --version`.
   */
  static async isAvailable(): Promise<boolean> {
    const candidates = process.platform === 'win32'
      ? ['claude', 'claude.exe']
      : ['claude'];

    for (const cmd of candidates) {
      const available = await new Promise<boolean>((resolve) => {
        const child = spawn(cmd, ['--version'], {
          stdio: 'ignore',
          shell: process.platform === 'win32',
        });
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
      });
      if (available) return true;
    }
    return false;
  }

  /**
   * Run claude CLI with a task prompt.
   * Uses `claude -p "task"` for non-interactive (print) mode.
   *
   * @param task The task/prompt to pass to claude
   * @param workingDir Optional working directory (defaults to cwd)
   * @param options Timeout (ms) and model override
   */
  async execute(
    task: string,
    workingDir?: string,
    options?: {
      timeout?: number;
      model?: string;
    },
  ): Promise<ExecutionResult> {
    const timeout = options?.timeout ?? 300_000; // 5 minutes default

    // Build args: claude -p "task" [--model model]
    const args: string[] = ['-p', task];
    if (options?.model) {
      args.push('--model', options.model);
    }

    // Inherit env, inject ANTHROPIC_API_KEY if configured
    const env: NodeJS.ProcessEnv = { ...process.env };
    try {
      const cfg = getConfig();
      if (cfg.ANTHROPIC_API_KEY && !env.ANTHROPIC_API_KEY) {
        env.ANTHROPIC_API_KEY = cfg.ANTHROPIC_API_KEY;
      }
    } catch {
      // Config not loaded yet — proceed with existing env
    }

    return new Promise<ExecutionResult>((resolve, reject) => {
      const chunks: string[] = [];

      this.process = spawn('claude', args, {
        cwd: workingDir ?? process.cwd(),
        env,
        shell: process.platform === 'win32',
      });

      // Timer for timeout
      const timer = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGTERM');
          const result: ExecutionResult = {
            success: false,
            output: chunks.join(''),
            exitCode: -1,
          };
          this.emit('done', result);
          resolve(result);
        }
      }, timeout);

      // stdout
      this.process.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        chunks.push(text);
        this.emit('output', text);
      });

      // stderr — also emit as output so the caller sees warnings/info
      this.process.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        chunks.push(text);
        this.emit('output', text);
      });

      this.process.on('error', (err) => {
        clearTimeout(timer);
        this.emit('error', err);
        reject(err);
      });

      this.process.on('close', (code) => {
        clearTimeout(timer);
        const exitCode = code ?? -1;
        const output = chunks.join('');
        const result: ExecutionResult = {
          success: exitCode === 0,
          output,
          exitCode,
        };
        this.emit('done', result);
        resolve(result);
      });
    });
  }

  /**
   * Kill the running process (SIGTERM).
   */
  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
