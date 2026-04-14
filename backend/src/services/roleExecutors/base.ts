import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'

export type SendFn = (event: string, data: unknown) => void
export type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }

export function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
}

export const HAIKU_MODEL  = 'claude-haiku-4-5-20251001'
export const DEFAULT_MODEL = 'claude-sonnet-4-6'
export const CEO_MODEL = 'claude-opus-4-6'

// Per-model cost (USD per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  [HAIKU_MODEL]:   { input: 0.80,  output: 4.00  },
  [DEFAULT_MODEL]: { input: 3.00,  output: 15.00 },
  [CEO_MODEL]:     { input: 15.00, output: 75.00 },
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4.1':           { input: 2.00,  output: 8.00  },
  'sonar-pro':         { input: 3.00,  output: 15.00 },
  'gemini-1.5-pro':    { input: 3.50,  output: 10.50 },
  'gemini-1.5-flash':  { input: 0.075, output: 0.30  },
}

export interface ExecutorContext {
  agent: { id: string; mission_id: string; name: string; role: string; system_prompt: string; budget_cents: number }
  task: string
  db: DbClient
  send: SendFn
  /** 선택된 모델 ID (프론트 ModelSwitcher에서 전달) */
  overrideModel?: string
  /** 외부 프로바이더 API 키 */
  externalKeys?: {
    openai?: string
    perplexity?: string
    gemini?: string
  }
}

// Save feed item to DB
export async function saveFeedItem(db: DbClient, agentId: string, type: 'info'|'result'|'error'|'approval', content: string, requiresApproval = false): Promise<string> {
  const id = uuidv4()
  await db.query(
    `INSERT INTO feed_items (id, agent_id, type, content, requires_approval) VALUES ($1,$2,$3,$4,$5)`,
    [id, agentId, type, content, requiresApproval ? 1 : 0]
  )
  return id
}

// Save token usage to DB
export async function saveTokenUsage(db: DbClient, agentId: string, missionId: string, inputTokens: number, outputTokens: number, model: string): Promise<void> {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL]
  const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  const id = uuidv4()
  await db.query(
    `INSERT INTO token_usage (id, agent_id, mission_id, input_tokens, output_tokens, cost_usd, model) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, agentId, missionId, inputTokens, outputTokens, costUsd, model]
  )
}

// ── 프로바이더 분류 ────────────────────────────────────────────────────────────
function classifyModel(model: string): 'anthropic' | 'openai' | 'perplexity' | 'google' {
  if (model.startsWith('claude-'))    return 'anthropic'
  if (model.startsWith('gpt-'))       return 'openai'
  if (model === 'sonar-pro')          return 'perplexity'
  if (model.startsWith('gemini-'))    return 'google'
  return 'anthropic'
}

// ── OpenAI / Perplexity 스트리밍 (openai SDK 호환 API) ─────────────────────────
async function streamOpenAICompatible(
  ctx: ExecutorContext,
  systemPrompt: string,
  userMessage: string,
  model: string,
  apiKey: string,
  baseURL: string,
): Promise<string> {
  // openai 패키지가 없으면 axios로 직접 호출
  let fullText = ''
  const axios = await import('axios')
  const response = await axios.default.post(
    `${baseURL}/chat/completions`,
    {
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 120000,
    }
  )

  await new Promise<void>((resolve, reject) => {
    let buffer = ''
    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.replace(/^data: /, '').trim()
        if (!trimmed || trimmed === '[DONE]') continue
        try {
          const json = JSON.parse(trimmed)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            ctx.send('output', { chunk: delta })
          }
        } catch { /* JSON 파싱 실패 무시 */ }
      }
    })
    response.data.on('end', resolve)
    response.data.on('error', reject)
  })

  await saveTokenUsage(ctx.db, ctx.agent.id, ctx.agent.mission_id, 0, 0, model).catch(() => {})
  return fullText
}

// ── Google Gemini 스트리밍 ─────────────────────────────────────────────────────
async function streamGemini(
  ctx: ExecutorContext,
  systemPrompt: string,
  userMessage: string,
  model: string,
  apiKey: string,
): Promise<string> {
  let fullText = ''
  const axios = await import('axios')
  const geminiModel = model.replace('gemini-', 'gemini-').replace('-pro', '-pro').replace('-flash', '-flash')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${apiKey}&alt=sse`

  const response = await axios.default.post(
    url,
    {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 120000,
    }
  )

  await new Promise<void>((resolve, reject) => {
    let buffer = ''
    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.replace(/^data: /, '').trim()
        if (!trimmed) continue
        try {
          const json = JSON.parse(trimmed)
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            fullText += text
            ctx.send('output', { chunk: text })
          }
        } catch { /* 파싱 실패 무시 */ }
      }
    })
    response.data.on('end', resolve)
    response.data.on('error', reject)
  })

  await saveTokenUsage(ctx.db, ctx.agent.id, ctx.agent.mission_id, 0, 0, model).catch(() => {})
  return fullText
}

// ── Anthropic 스트리밍 (기존 방식) ────────────────────────────────────────────
async function streamAnthropic(ctx: ExecutorContext, systemPrompt: string, userMessage: string, model: string, maxTokens: number): Promise<string> {
  const client = getAnthropicClient()
  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0

  const stream = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullText += chunk.delta.text
      ctx.send('output', { chunk: chunk.delta.text })
    }
    if (chunk.type === 'message_start') {
      inputTokens = chunk.message.usage?.input_tokens ?? 0
    }
    if (chunk.type === 'message_delta') {
      outputTokens = chunk.usage?.output_tokens ?? 0
    }
  }

  await saveTokenUsage(ctx.db, ctx.agent.id, ctx.agent.mission_id, inputTokens, outputTokens, model).catch(() => {})
  return fullText
}

// ── 통합 스트림 함수 — 모델에 따라 자동으로 프로바이더 선택 ──────────────────
export async function streamClaude(
  ctx: ExecutorContext,
  systemPrompt: string,
  userMessage: string,
  model = DEFAULT_MODEL,
  maxTokens = 8192
): Promise<string> {
  // ctx.overrideModel이 있으면 우선 사용
  const effectiveModel = ctx.overrideModel ?? model
  const provider = classifyModel(effectiveModel)

  if (provider === 'openai') {
    const apiKey = ctx.externalKeys?.openai ?? ''
    if (!apiKey) throw new Error('OpenAI API 키가 없습니다. 모델 스위처에서 API 키를 입력하고 저장해주세요.')
    return streamOpenAICompatible(ctx, systemPrompt, userMessage, effectiveModel, apiKey, 'https://api.openai.com/v1')
  }

  if (provider === 'perplexity') {
    const apiKey = ctx.externalKeys?.perplexity ?? ''
    if (!apiKey) throw new Error('Perplexity API 키가 없습니다. 모델 스위처에서 API 키를 입력하고 저장해주세요.')
    return streamOpenAICompatible(ctx, systemPrompt, userMessage, effectiveModel, apiKey, 'https://api.perplexity.ai')
  }

  if (provider === 'google') {
    const apiKey = ctx.externalKeys?.gemini ?? ''
    if (!apiKey) throw new Error('Gemini API 키가 없습니다. 모델 스위처에서 API 키를 입력하고 저장해주세요.')
    return streamGemini(ctx, systemPrompt, userMessage, effectiveModel, apiKey)
  }

  // 기본: Anthropic
  return streamAnthropic(ctx, systemPrompt, userMessage, effectiveModel, maxTokens)
}
