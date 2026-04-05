/**
 * ParallelExecutor — runs multiple ClaudeCodeExecutor jobs concurrently
 * with a configurable concurrency limit (semaphore/queue pattern).
 */
import { ClaudeCodeExecutor } from './claudeCodeExecutor';

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

    // Check claude CLI availability once upfront
    const claudeAvailable = await ClaudeCodeExecutor.isAvailable();

    // Semaphore: a pool of active-slot promises
    const queue = [...jobs];
    const active: Promise<void>[] = [];

    const runJob = async (job: ParallelJob): Promise<void> => {
      const start = Date.now();
      let result: ParallelResult;

      if (!claudeAvailable) {
        // Mock result when claude CLI is not available
        await new Promise<void>((resolve) => setTimeout(resolve, 100)); // simulate async
        result = {
          agentId: job.agentId,
          agentName: job.agentName,
          success: true,
          output: `(mock) task 수신: ${job.task}`,
          duration_ms: Date.now() - start,
        };
      } else {
        try {
          const executor = new ClaudeCodeExecutor();
          const execResult = await executor.execute(job.task, job.workingDir, {
            timeout: 300_000, // 5 minutes per job
          });

          result = {
            agentId: job.agentId,
            agentName: job.agentName,
            success: execResult.success,
            output: execResult.output || '(출력 없음)',
            duration_ms: Date.now() - start,
            error: execResult.success ? undefined : `exit code ${execResult.exitCode}`,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          result = {
            agentId: job.agentId,
            agentName: job.agentName,
            success: false,
            output: '',
            duration_ms: Date.now() - start,
            error: errMsg,
          };
        }
      }

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
