/**
 * LLM Provider 라우터
 * Claude 직접 | OpenRouter (비용 최적화)
 *
 * OpenRouter 장점:
 *   - 여러 모델 통합 API (claude, gpt-4o, gemini 등)
 *   - 모델별 가격 비교 가능
 *   - 캐싱으로 중복 요청 비용 절감 (cache_prompt)
 *   - 자동 fallback: claude-3-haiku(저비용) → claude-3-5-sonnet(고성능)
 *
 * 사용 방법:
 *   - 단순 태스크 (리서치 요약): claude-3-haiku (약 80% 비용 절감)
 *   - 복잡 태스크 (코딩, 분석): claude-3-5-sonnet
 *   - 배치 처리: 캐시 활성화로 반복 비용 최소화
 */
import axios from 'axios';

export type ModelTier = 'fast' | 'balanced' | 'powerful';

const MODEL_MAP: Record<string, Record<ModelTier, string>> = {
  claude: {
    fast:      'claude-haiku-4-5-20251001',
    balanced:  'claude-sonnet-4-6',
    powerful:  'claude-opus-4-6',
  },
  openrouter: {
    fast:      'anthropic/claude-haiku-4-5',
    balanced:  'anthropic/claude-sonnet-4-6',
    powerful:  'anthropic/claude-opus-4-6',
  },
};

/**
 * 비용 최적화 원칙:
 * 1. 역할별 모델 티어 — 단순 작업은 haiku(80% 저렴), 복잡 작업만 sonnet/opus
 * 2. 프롬프트 캐싱 — 반복되는 system prompt는 cache_control로 캐시 (Anthropic: 90% 절감)
 * 3. 배치 처리 — 여러 항목을 한 번에 처리해 토큰 낭비 최소화
 * 4. 월 예산 한도 — agent.budget_cents 초과 시 자동 중단
 * 5. streaming — 불필요한 재시도 방지 (첫 응답 즉시 처리)
 */
const ROLE_TIER: Record<string, ModelTier> = {
  research:    'fast',      // 반복적 크롤링 요약 → 저비용 모델
  build:       'balanced',  // 코딩은 성능 필요
  design:      'fast',
  content:     'fast',      // 초안 작성은 빠른 모델로
  growth:      'fast',
  ops:         'fast',
  integration: 'fast',
  n8n:         'fast',      // 템플릿 생성 → 저비용
};

interface CompletionOptions {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  agentRole?: string;
  tier?: ModelTier;
  maxTokens?: number;
  stream?: boolean;
}

interface CompletionResult {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  model: string;
}

export class LLMProvider {
  private readonly provider: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(provider: string, apiKey: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.anthropic.com/v1';
  }

  getModel(agentRole: string, tier?: ModelTier): string {
    const effectiveTier = tier ?? ROLE_TIER[agentRole] ?? 'fast';
    return MODEL_MAP[this.provider]?.[effectiveTier]
      ?? MODEL_MAP.claude[effectiveTier];
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const model = this.getModel(options.agentRole ?? 'research', options.tier);

    if (this.provider === 'openrouter') {
      return this.completeOpenRouter(model, options);
    }
    return this.completeClaude(model, options);
  }

  private async completeClaude(model: string, options: CompletionOptions): Promise<CompletionResult> {
    const res = await axios.post(
      `${this.baseUrl}/messages`,
      {
        model,
        max_tokens: options.maxTokens ?? 4096,
        messages: options.messages.filter(m => m.role !== 'system'),
        system: options.messages.find(m => m.role === 'system')?.content,
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 120000,
      }
    );

    const data = res.data as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const content = data.content.find(c => c.type === 'text')?.text ?? '';
    const inputT = data.usage.input_tokens;
    const outputT = data.usage.output_tokens;

    return {
      content,
      tokensInput: inputT,
      tokensOutput: outputT,
      costUsd: this.estimateCost(model, inputT, outputT),
      model,
    };
  }

  private async completeOpenRouter(model: string, options: CompletionOptions): Promise<CompletionResult> {
    const res = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages: options.messages,
        max_tokens: options.maxTokens ?? 4096,
        // OpenRouter 캐싱 — 동일 system prompt 반복 시 비용 절감
        cache_control: { type: 'ephemeral' },
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://oomni.app',
          'X-Title': 'OOMNI',
          'content-type': 'application/json',
        },
        timeout: 120000,
      }
    );

    const data = res.data as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      id: string;
    };

    const content = data.choices[0]?.message.content ?? '';
    const inputT = data.usage.prompt_tokens;
    const outputT = data.usage.completion_tokens;

    return {
      content,
      tokensInput: inputT,
      tokensOutput: outputT,
      costUsd: this.estimateCost(model, inputT, outputT),
      model,
    };
  }

  /**
   * 모델별 비용 추정 (USD per 1M tokens, 2025 기준)
   */
  private estimateCost(model: string, inputT: number, outputT: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-haiku-4-5-20251001':   { input: 0.80,  output: 4.00 },
      'claude-sonnet-4-6':           { input: 3.00,  output: 15.00 },
      'claude-opus-4-6':             { input: 15.00, output: 75.00 },
      'anthropic/claude-haiku-4-5':  { input: 0.80,  output: 4.00 },
      'anthropic/claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
      'anthropic/claude-opus-4-6':   { input: 15.00, output: 75.00 },
    };

    const p = pricing[model] ?? { input: 3.00, output: 15.00 };
    return (inputT / 1_000_000) * p.input + (outputT / 1_000_000) * p.output;
  }
}
