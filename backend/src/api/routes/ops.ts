/**
 * ops.ts — Ops Center AI 워크플로우 설계 API
 * v5.1.0
 *
 * POST /api/ops/chat   — 채팅 메시지 → n8n JSON 스트리밍
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { ApiError } from '../../middleware/apiError';

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const ChatSchema = z.object({
  messages: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1).max(20),
  system: z.string().optional(),
  mission_id: z.string().optional(),
});

export function opsRouter(_db: Db): Router {
  const router = Router();

  /**
   * POST /chat — SSE 스트리밍
   * Claude Sonnet으로 n8n 워크플로우 JSON 생성
   */
  router.post('/chat', async (req: Request, res: Response) => {
    const parse = ChatSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ApiError(503, 'Claude API 키가 설정되지 않았습니다', 'NO_API_KEY');
    }

    const { messages, system } = parse.data;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const defaultSystem = `당신은 n8n 자동화 전문가입니다. 솔로프리너의 업무 자동화를 돕습니다.
사용자 요청을 분석하고 실용적인 n8n 워크플로우를 설계해주세요.
반드시 다음 JSON 블록을 포함하세요:

\`\`\`json
{
  "name": "워크플로우명",
  "nodes": [
    {"id": "1", "name": "노드명", "type": "trigger|http|transform|condition|action|notify"}
  ],
  "connections": [
    {"from": "1", "to": "2"}
  ]
}
\`\`\`

그리고 각 노드의 n8n 설정 방법을 단계별로 한국어로 안내해주세요.`;

    try {
      const client = new Anthropic({ apiKey });

      const stream = await client.messages.stream({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        system:     system ?? defaultSystem,
        messages:   messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          send('delta', { text: chunk.delta.text });
        }
      }

      const finalMsg = await stream.finalMessage();
      const fullText = finalMsg.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

      send('done', { text: fullText });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      send('error', { message: msg });
    } finally {
      res.end();
    }
  });

  return router;
}
