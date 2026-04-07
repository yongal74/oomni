/**
 * ParallelExecutor — runs multiple Anthropic SDK jobs concurrently
 * with a configurable concurrency limit (semaphore/queue pattern).
 *
 * Phase 3-B1: ClaudeCodeExecutor(CLI) 제거, Anthropic SDK 직접 호출로 전환.
 * Design Bot은 이 경로를 통해 실행되지 않으므로 CLI 분기 불필요.
 */
import { getAnthropicClient } from './roleExecutors/base';

export interface ParallelJob {
  agentId: string;
  agentName: string;
  task: string;
  workingDir?: string;
}

export interface ParallelResult {
  agentId: string;
  agentName: string;
  success: boolean;
  output: string;
  duration_ms: number;
  error?: string;
}

/**
 * Run a single job using Anthropic SDK messages.create (non-streaming).
 */
async function runWithSdk(job: ParallelJob): Promise<ParallelResult> {
  const start = Date.now();
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: job.task }],
    });

    const output = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return {
      agentId: job.agentId,
      agentName: job.agentName,
      success: true,
      output: output || '(출력 없음)',
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      agentId: job.agentId,
      agentName: job.agentName,
      success: false,
      output: '',
      duration_ms: Date.now() - start,
      error: errMsg,
    };
  }
}

export class ParallelExecutor {
  /**
   * Run multiple jobs concurrently with a concurrency limit.
   * @param jobs Array of jobs to run
   * @param concurrency Max parallel executions (default: 3)
   * @param onProgress Callback fired after each job completes
   */
  static async run(
    jobs: ParallelJob[],
    concurrency: number = 3,
    onProgress?: (result: ParallelResult, completed: number, total: number) => void,
  ): Promise<ParallelResult[]> {
    const total = jobs.length;
    const results: ParallelResult[] = [];
    let completed = 0;

    // Semaphore: a pool of active-slot promises
    const queue = [...jobs];
    const active: Promise<void>[] = [];

    const runJob = async (job: ParallelJob): Promise<void> => {
      const result = await runWithSdk(job);

      results.push(result);
      completed += 1;

      if (onProgress) {
        onProgress(result, completed, total);
      }
    };

    // Process queue with concurrency limit
    await new Promise<void>((resolve) => {
      const next = (): void => {
        while (active.length < concurrency && queue.length > 0) {
          const job = queue.shift()!;
          const promise = runJob(job).then(() => {
            active.splice(active.indexOf(promise), 1);
            if (queue.length > 0) {
              next();
            } else if (active.length === 0) {
              resolve();
            }
          });
          active.push(promise);
        }

        if (queue.length === 0 && active.length === 0) {
          resolve();
        }
      };

      next();
    });

    return results;
  }
}
