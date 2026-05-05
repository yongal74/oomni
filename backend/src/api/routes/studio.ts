/**
 * studio.ts — Studio Bot API 라우트
 * POST /api/studio/v0-generate       — UI 프로토타입 HTML 생성 (SSE)
 * POST /api/studio/graphic-generate  — 그래픽 이미지 생성 (Ideogram, SSE)
 * POST /api/studio/build-generate    — 코드 빌드 생성 (Claude, SSE)
 * GET  /api/studio/status            — v0 / Ideogram 키 설정 여부
 */
import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { generateUIProto } from '../../services/v0Service';
import { generateImage } from '../../services/geminiService';
import { readSettings } from '../../config';

const BUILD_SYSTEM = `You are a senior full-stack developer. Generate complete, production-ready code.

File format rules (MANDATORY):
- Wrap every file in a code fence with the path as a comment on the FIRST LINE inside the fence
  \`\`\`typescript
  // src/components/Button.tsx
  ... code ...
  \`\`\`
- Use this exact format: language fence → first line is // path/to/file.ext → then code
- Supported languages: typescript, tsx, javascript, python, css, json, yaml, bash, sql, markdown
- Always use TypeScript unless another language is clearly more appropriate
- Generate complete, runnable code — no placeholder TODOs or ellipsis unless truly optional
- Start with a 2-sentence plan, then output all files in order`;

// 그래픽 카테고리별 종횡비 힌트
const GRAPHIC_ASPECT: Record<string, string> = {
  instagram:  'ASPECT_1_1',
  youtube:    'ASPECT_16_9',
  tiktok:     'ASPECT_9_16',
  banner:     'ASPECT_16_9',
  card:       'ASPECT_4_3',
  pitch:      'ASPECT_16_9',
}

function sseJson(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function studioRouter(): Router {
  const router = Router();

  // GET /api/studio/status
  router.get('/status', (_req: Request, res: Response) => {
    const s = readSettings();
    res.json({
      v0_key_set:       !!(s.v0_api_key),
      ideogram_key_set: !!(s.ideogram_api_key),
    });
  });

  // POST /api/studio/v0-generate  — SSE
  router.post('/v0-generate', async (req: Request, res: Response) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) { res.status(400).json({ error: '프롬프트를 입력하세요' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const chunk of generateUIProto(prompt.trim())) {
        if (chunk.done) { res.write('data: [DONE]\n\n'); break; }
        if (chunk.content) sseJson(res, { chunk: chunk.content });
      }
    } catch (err) {
      sseJson(res, { error: err instanceof Error ? err.message : '생성 오류' });
    } finally {
      res.end();
    }
  });

  // POST /api/studio/graphic-generate  — SSE
  router.post('/graphic-generate', async (req: Request, res: Response) => {
    const { prompt, channel = 'banner' } = req.body as { prompt?: string; channel?: string };
    if (!prompt?.trim()) { res.status(400).json({ error: '프롬프트를 입력하세요' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // 1. Claude로 Ideogram 최적 프롬프트 생성
      sseJson(res, { type: 'status', message: '✍️ 디자인 브리프 작성 중...' });

      const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다');

      const client = new Anthropic({ apiKey });
      const aspect = GRAPHIC_ASPECT[channel] ?? 'ASPECT_16_9';

      const briefMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Convert this design request into a concise, vivid Ideogram image generation prompt (English, max 200 chars). Focus on visual style, composition, colors, mood. No placeholder text in the image.
Request: "${prompt.trim()}"
Channel/format: ${channel} (${aspect})
Output: just the prompt, nothing else.`,
        }],
      });

      const imagePrompt = (briefMsg.content[0] as { type: string; text?: string }).text?.trim()
        ?? prompt.trim();

      sseJson(res, { type: 'status', message: '🎨 이미지 생성 중... (10~30초)' });
      sseJson(res, { type: 'prompt', imagePrompt });

      // 2. Ideogram API 호출
      const imageUrl = await generateImage(imagePrompt, channel);

      if (imageUrl.startsWith('__STUB')) {
        sseJson(res, {
          type: 'stub',
          message: 'Ideogram API 키가 없어 생성 불가 — Settings에서 키를 입력하세요',
          imagePrompt,
        });
      } else {
        sseJson(res, { type: 'result', imageUrl, imagePrompt, channel });
      }
    } catch (err) {
      sseJson(res, { type: 'error', message: err instanceof Error ? err.message : '이미지 생성 오류' });
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  // POST /api/studio/build-generate  — SSE (Claude 코드 생성)
  router.post('/build-generate', async (req: Request, res: Response) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) { res.status(400).json({ error: '프롬프트를 입력하세요' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    if (!apiKey) {
      sseJson(res, { chunk: '<!-- ANTHROPIC_API_KEY 없음 -->' });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    try {
      const client = new Anthropic({ apiKey });
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: BUILD_SYSTEM,
        messages: [{ role: 'user', content: prompt.trim() }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          sseJson(res, { chunk: event.delta.text });
        }
      }
    } catch (err) {
      sseJson(res, { error: err instanceof Error ? err.message : '빌드 생성 오류' });
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  return router;
}
