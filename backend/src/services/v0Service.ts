/**
 * v0Service.ts — Vercel v0 Platform API 래퍼
 *
 * v0 API 키가 있으면 v0 API 호출, 없으면 Claude HTML 생성 폴백
 * 둘 다 SSE 청크를 AsyncGenerator로 스트리밍
 */
import Anthropic from '@anthropic-ai/sdk';
import { readSettings } from '../config';

const V0_API_BASE = 'https://api.v0.dev/v1';
const V0_MODEL    = 'v0-1.5-md';

const HTML_SYSTEM = `You are a UI code generator. Generate a COMPLETE, STANDALONE HTML file.

Rules:
- Single self-contained HTML file — no external files needed
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Dark theme (bg-gray-950, text-gray-100) by default unless asked otherwise
- Include realistic placeholder data/content
- Modern, clean design — rounded corners, subtle shadows, good spacing
- Vanilla JS only inside the HTML (no React/Vue compilation needed)
- Return ONLY the HTML block wrapped in \`\`\`html ... \`\`\` fences`;

export interface V0Chunk {
  content: string
  done: boolean
}

export async function* generateUIProto(prompt: string): AsyncGenerator<V0Chunk> {
  const settings = readSettings();
  const v0Key = settings.v0_api_key;

  if (v0Key) {
    yield* callV0Api(prompt, v0Key);
  } else {
    yield* callClaudeFallback(prompt);
  }
}

async function* callV0Api(prompt: string, apiKey: string): AsyncGenerator<V0Chunk> {
  const resp = await fetch(`${V0_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: V0_MODEL,
      messages: [
        { role: 'system', content: HTML_SYSTEM },
        { role: 'user',   content: `Generate UI HTML for: ${prompt}` },
      ],
      stream: true,
    }),
  });

  if (!resp.ok) {
    throw new Error(`v0 API 오류: ${resp.status}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error('v0 API 스트림 없음');

  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { yield { content: '', done: true }; return; }
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>
        };
        const chunk = parsed.choices?.[0]?.delta?.content ?? '';
        if (chunk) yield { content: chunk, done: false };
      } catch { /* ignore malformed */ }
    }
  }
  yield { content: '', done: true };
}

async function* callClaudeFallback(prompt: string): AsyncGenerator<V0Chunk> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    yield { content: '<!-- ANTHROPIC_API_KEY가 설정되지 않았습니다 -->', done: true };
    return;
  }

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: HTML_SYSTEM,
    messages: [{ role: 'user', content: `Generate UI HTML for: ${prompt}` }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield { content: event.delta.text, done: false };
    }
  }

  yield { content: '', done: true };
}
