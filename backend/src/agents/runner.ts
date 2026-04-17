/**
 * AgentRunner — Claude Code CLI subprocess 실행
 * Paperclip 검증 방식:
 *   spawn("claude", ["--print", "-", "--output-format", "stream-json"])
 *   재개: claude --resume <sessionId>
 */
import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Agent, AgentRole } from '../db/types';
import { logger } from '../logger';

// ── 재시도 유틸 ───────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  const delays = [2000, 5000];
  let lastError: Error = new Error('unknown');
  for (let i = 0; i <= maxRetries; i++) {
    try { return await fn(); }
    catch (err) {
      lastError = err as Error;
      if (i < maxRetries) {
        logger.warn(`[withRetry] 시도 ${i + 1}/${maxRetries + 1} 실패, ${delays[i]}ms 후 재시도: ${lastError.message}`);
        await sleep(delays[i]);
      }
    }
  }
  throw lastError;
}

interface RunResult {
  runId: string;
  sessionId: string;
  output: string;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
  status: 'completed' | 'failed';
  error?: string;
}

interface CostInfo {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

const ROLE_INSTRUCTIONS: Record<AgentRole, string> = {
  research: '조사 결과는 반드시 구조화된 형식(제목, 요약, 출처)으로 정리하고, OOMNI API를 통해 feed_item으로 보고하라.',
  build: '코드 변경 전 반드시 테스트를 작성하고, 완료 후 OOMNI API로 결과를 보고하라.',
  design: '고품질 UI/UX 디자인을 HTML + React 컴포넌트로 생성하고 C:/oomni-data/design/ 에 저장한 후 OOMNI API로 파일 경로를 보고하라.',
  content: '콘텐츠는 SEO 최적화를 고려하고, 완성 후 사람의 승인을 요청하라.',
  growth: '실행 전 가설을 명시하고, 결과 데이터와 함께 OOMNI API로 보고하라.',
  ops: '운영 지표(비용, 에러율, 수익)를 수집하고 이상 감지 시 즉시 알림을 보내라.',
  integration: '연동 테스트 후 결과를 OOMNI API로 보고하고, 실패 시 재시도하지 말고 보고하라.',
  ceo: '너는 CEO 역할의 AI 봇이다. 모든 봇의 활동 결과를 종합하여 일일/주간 보고서를 생성하고, 핵심 지표를 분석하며, 전략적 방향을 제안해라. OOMNI API에서 최근 피드와 비용 데이터를 가져와 종합 보고서를 작성하고 사람의 승인을 요청해라.',
  // Phase 2 (BOT-08~11)
  project_setup: '너는 프로젝트 초기화 자동화 봇이다. 5가지 질문(앱 이름, 형태, AI 필요 여부, 결제 필요 여부, 국내/글로벌)을 받아 Next.js 스캐폴딩부터 GitHub/Vercel 배포까지 완전 자동화하라. 완료 후 OOMNI API로 결과와 반자동 필요 항목을 보고하라.',
  env: '너는 환경변수 통합 관리 봇이다. 코드베이스에서 NEXT_PUBLIC_ 오용과 하드코딩 시크릿을 탐지하고, .env.local과 Vercel 환경변수를 동기화하라. 위험도(CRITICAL/HIGH/MEDIUM)별로 분류하여 OOMNI API로 보고하라.',
  security_audit: '너는 보안 감사 자동화 봇이다. npm audit, 코드 정적 분석, Supabase RLS 검증, 미인증 엔드포인트 탐지를 순서대로 실행하라. 결과를 위험도(CRITICAL/HIGH/MEDIUM/LOW)별로 분류하고 수정 방법과 함께 OOMNI API로 보고하라.',
  frontend: '너는 React/TypeScript UI 전문 개발 봇이다. Tailwind CSS + shadcn/ui 기반으로 즉시 사용 가능한 완성된 컴포넌트를 생성하라. mobile-first 반응형, 접근성(ARIA), TypeScript strict 모드를 준수하고 완료 후 OOMNI API로 결과를 보고하라.',
  backend: '너는 Next.js API + Supabase 전문 백엔드 개발 봇이다. RLS 정책(SELECT/INSERT/UPDATE/DELETE 4개) 필수 생성, Zod 입력 검증, HTTP 표준 에러 처리를 준수하고 완료 후 OOMNI API로 결과를 보고하라.',
  infra: '너는 DevOps/Infra 전문 봇이다. GitHub Actions, Vercel 배포, Docker 멀티스테이지 빌드를 자동화하라. 시크릿은 반드시 GitHub Secrets/Vercel Env만 사용하고 /api/health 헬스체크를 포함하라. 완료 후 OOMNI API로 결과를 보고하라.',
};


export class AgentRunner extends EventEmitter {
  private readonly oomniApiUrl: string;
  private readonly oomniApiKey: string;
  private activeProcesses = new Map<string, ChildProcess>();

  constructor(
    eventEmitter: EventEmitter,
    options: { oomniApiUrl?: string; oomniApiKey?: string } = {}
  ) {
    super();
    // EventEmitter 이벤트 전달
    eventEmitter.emit = eventEmitter.emit.bind(eventEmitter);
    this.oomniApiUrl = options.oomniApiUrl ?? 'http://localhost:3001';
    this.oomniApiKey = options.oomniApiKey ?? '';
  }

  buildPrompt(agent: Agent, task: string, context: Record<string, unknown>): string {
    const roleInstruction = ROLE_INSTRUCTIONS[agent.role] ?? '';
    const missionName = (context.missionName as string) ?? '미션 미지정';

    return `# 시스템 설정
${agent.system_prompt}

## 봇 역할 지침
${roleInstruction}

## 현재 미션
미션명: ${missionName}

## OOMNI API 연동
- API 엔드포인트: $OOMNI_API_URL
- 봇 ID: $OOMNI_AGENT_ID
- 인증: Authorization: Bearer $OOMNI_API_KEY
- 결과 보고: POST $OOMNI_API_URL/api/feed (type, content, requires_approval)
- 비용 기록: POST $OOMNI_API_URL/api/cost

## 현재 작업
${task}

## 주의사항
- 절대로 사람의 승인 없이 외부에 배포하거나 돈을 쓰는 행동을 하지 마라
- 불확실한 경우 requires_approval=true로 승인 요청을 보내라
- 작업 완료 후 반드시 OOMNI API로 결과를 보고하라
`;
  }

  buildEnv(agent: Agent, oomniApiUrl: string, oomniApiKey: string): NodeJS.ProcessEnv {
    // 봇은 OOMNI API를 통해서만 외부와 통신
    // 부모 프로세스의 환경변수 중 민감한 것은 전달하지 않음
    return {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      APPDATA: process.env.APPDATA,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      // OOMNI 봇 신원
      OOMNI_API_URL: oomniApiUrl,
      OOMNI_AGENT_ID: agent.id,
      OOMNI_API_KEY: oomniApiKey,
      // Claude CLI에 필요한 최소 설정 (API 키는 전달하되 봇 prompt에 노출 안 함)
      // 봇은 OOMNI_API_KEY를 통해 OOMNI 서버와만 통신, 직접 Claude 호출 불가
    } as NodeJS.ProcessEnv;
  }

  parseStreamOutput(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk);
      if (parsed.type === 'assistant') {
        const content = parsed.message?.content;
        if (Array.isArray(content)) {
          return content
            .filter((c: { type: string }) => c.type === 'text')
            .map((c: { text: string }) => c.text)
            .join('');
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  extractCost(chunk: string): CostInfo | null {
    try {
      const parsed = JSON.parse(chunk);
      if (parsed.type === 'result' && parsed.usage) {
        return {
          input_tokens: parsed.usage.input_tokens ?? 0,
          output_tokens: parsed.usage.output_tokens ?? 0,
          cost_usd: parsed.cost_usd ?? 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  async run(agent: Agent, task?: string, sessionId?: string): Promise<RunResult> {
    const runId = uuidv4();
    const prompt = this.buildPrompt(agent, task ?? '정기 하트비트 — 현재 작업 목록 확인 및 처리', {});
    const env = this.buildEnv(agent, this.oomniApiUrl, this.oomniApiKey);

    const args = [
      '--print', '-',
      '--output-format', 'stream-json',
      ...(sessionId ? ['--resume', sessionId] : []),
    ];

    return new Promise<RunResult>((resolve) => {
      let outputBuffer = '';
      let costInfo: CostInfo | null = null;
      let newSessionId = sessionId ?? uuidv4();

      const proc = spawn('claude', args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(runId, proc);

      // stdin으로 프롬프트 전달
      if (proc.stdin) {
        proc.stdin.write(prompt);
        proc.stdin.end();
      }

      proc.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const text = this.parseStreamOutput(line);
          if (text) outputBuffer += text;

          const cost = this.extractCost(line);
          if (cost) costInfo = cost;

          // 실시간 스트리밍 이벤트
          this.emit('stream', { runId, agentId: agent.id, chunk: text ?? '' });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        logger.warn(`[AgentRunner] stderr agent=${agent.id}: ${data.toString().slice(0, 200)}`);
      });

      proc.on('close', (code) => {
        this.activeProcesses.delete(runId);

        if (code === 0) {
          resolve({
            runId,
            sessionId: newSessionId,
            output: outputBuffer,
            costUsd: costInfo?.cost_usd ?? 0,
            tokensInput: costInfo?.input_tokens ?? 0,
            tokensOutput: costInfo?.output_tokens ?? 0,
            status: 'completed',
          });
        } else {
          resolve({
            runId,
            sessionId: newSessionId,
            output: outputBuffer,
            costUsd: 0,
            tokensInput: 0,
            tokensOutput: 0,
            status: 'failed',
            error: `프로세스가 코드 ${code}로 종료됨`,
          });
        }
      });

      proc.on('error', (err) => {
        this.activeProcesses.delete(runId);
        logger.error(`[AgentRunner] spawn 오류 agent=${agent.id}`, err);
        resolve({
          runId,
          sessionId: newSessionId,
          output: '',
          costUsd: 0,
          tokensInput: 0,
          tokensOutput: 0,
          status: 'failed',
          error: err.message,
        });
      });
    });
  }

  killAll(): void {
    for (const [, proc] of this.activeProcesses) {
      proc.kill('SIGTERM');
    }
    this.activeProcesses.clear();
  }
}
