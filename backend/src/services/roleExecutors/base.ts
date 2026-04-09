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
}

export interface ExecutorContext {
  agent: { id: string; mission_id: string; name: string; role: string; system_prompt: string; budget_cents: number }
  task: string
  db: DbClient
  send: SendFn
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

// Stream Claude API response to SSE, returns full text
export async function streamClaude(ctx: ExecutorContext, systemPrompt: string, userMessage: string, model = DEFAULT_MODEL, maxTokens = 8192): Promise<string> {
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

  await saveTokenUsage(ctx.db, ctx.agent.id, ctx.agent.mission_id, inputTokens, outputTokens, model).catch(() => {/* 토큰 사용량 저장 실패는 비치명적 */})
  return fullText
}
