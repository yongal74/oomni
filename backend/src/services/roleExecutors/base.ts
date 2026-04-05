import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'

export type SendFn = (event: string, data: unknown) => void
export type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }

export function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6'
export const CEO_MODEL = 'claude-opus-4-6'

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
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000 // claude-sonnet-4-6 pricing approx
  const id = uuidv4()
  await db.query(
    `INSERT INTO token_usage (id, agent_id, mission_id, input_tokens, output_tokens, cost_usd, model) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, agentId, missionId, inputTokens, outputTokens, costUsd, model]
  )
}

// Stream Claude API response to SSE, returns full text
export async function streamClaude(ctx: ExecutorContext, systemPrompt: string, userMessage: string, model = DEFAULT_MODEL): Promise<string> {
  const client = getAnthropicClient()
  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0

  const stream = await client.messages.create({
    model,
    max_tokens: 4096,
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

  await saveTokenUsage(ctx.db, ctx.agent.id, ctx.agent.mission_id, inputTokens, outputTokens, model)
  return fullText
}
