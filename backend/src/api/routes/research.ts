/**
 * Research Studio API Routes
 * GET  /api/research?mission_id=   → list research items
 * POST /api/research               → create new research item (manual add)
 * POST /api/research/collect       → collect from source using Claude
 * POST /api/research/:id/filter    → set filter decision
 * POST /api/research/:id/convert   → convert to blog/report/ppt/prd/archive using Claude
 * DELETE /api/research/:id         → delete
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';
import { LLMProvider } from '../../agents/llm-provider';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const CreateResearchSchema = z.object({
  mission_id: z.string().min(1),
  source_type: z.enum(['rss', 'url', 'keyword', 'manual']).default('manual'),
  source_url: z.string().optional(),
  title: z.string().min(1).max(500),
  summary: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).default([]),
  signal_score: z.number().int().min(0).max(100).default(0),
  filter_decision: z.enum(['pending', 'keep', 'drop', 'watch']).default('pending'),
  next_action: z.string().optional(),
});

const CollectSchema = z.object({
  mission_id: z.string().min(1),
  source_type: z.enum(['rss', 'url', 'keyword', 'manual']),
  source_url: z.string().optional(),
  keyword: z.string().optional(),
  content: z.string().optional(),
});

const FilterSchema = z.object({
  decision: z.enum(['keep', 'drop', 'watch']),
});

const ConvertSchema = z.object({
  output_type: z.enum(['blog', 'report', 'ppt', 'prd', 'archive']),
});

function getLLMProvider(): LLMProvider | null {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (openrouterKey) return new LLMProvider('openrouter', openrouterKey);
  if (anthropicKey) return new LLMProvider('claude', anthropicKey);
  return null;
}

export function researchRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/research?mission_id=
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { mission_id } = req.query;
      if (!mission_id) {
        res.status(400).json({ error: 'mission_id는 필수입니다' });
        return;
      }

      const result = await db.query(
        'SELECT * FROM research_items WHERE mission_id = $1 ORDER BY created_at DESC',
        [mission_id]
      );

      const items = (result.rows as Record<string, unknown>[]).map(row => ({
        ...row,
        tags: (() => {
          try { return JSON.parse(row.tags as string ?? '[]'); } catch { return []; }
        })(),
      }));

      res.json({ data: items });
    } catch (err) {
      logger.error('[research] GET / 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // POST /api/research (manual create)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const parsed = CreateResearchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const data = parsed.data;
      const id = uuidv4();
      const tagsJson = JSON.stringify(data.tags);

      const result = await db.query(
        `INSERT INTO research_items
          (id, mission_id, source_type, source_url, title, summary, content, tags, signal_score, filter_decision, next_action)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          id,
          data.mission_id,
          data.source_type,
          data.source_url ?? null,
          data.title,
          data.summary ?? null,
          data.content ?? null,
          tagsJson,
          data.signal_score,
          data.filter_decision,
          data.next_action ?? null,
        ]
      );

      const row = (result.rows as Record<string, unknown>[])[0];
      if (row) {
        row.tags = (() => { try { return JSON.parse(row.tags as string); } catch { return []; } })();
      }

      res.status(201).json({ data: row });
    } catch (err) {
      logger.error('[research] POST / 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // POST /api/research/collect
  router.post('/collect', async (req: Request, res: Response) => {
    try {
      const parsed = CollectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const { mission_id, source_type, source_url, keyword, content } = parsed.data;

      const llm = getLLMProvider();
      if (!llm) {
        res.status(503).json({ error: 'AI API 키가 설정되지 않았습니다' });
        return;
      }

      // Build context for Claude
      const sourceContext = content
        ? `콘텐츠:\n${content}`
        : source_url
          ? `URL: ${source_url}`
          : keyword
            ? `키워드: ${keyword}`
            : '소스 없음';

      const systemPrompt = `당신은 시장 리서치 분석 전문가입니다. 주어진 콘텐츠를 분석하여 JSON 형식으로 응답하세요.`;

      const userPrompt = `다음 소스를 분석해주세요:
${sourceContext}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "콘텐츠 제목 (최대 100자)",
  "summary": "핵심 요약 (최대 300자)",
  "tags": ["태그1", "태그2", "태그3"],
  "signal_score": 0-100,
  "score_breakdown": {
    "시장성": 0-20,
    "시의성": 0-20,
    "개인적합성": 0-15,
    "자동화가능성": 0-15,
    "콘텐츠확장성": 0-15,
    "제품화가능성": 0-15
  },
  "score_rationale": "점수 근거 한 줄 설명"
}

점수 기준:
- 시장성(20%): 실제 시장 수요와 비즈니스 가능성
- 시의성(20%): 현재 트렌드와의 연관성
- 개인적합성(15%): 사용자에게 맞는 정도
- 자동화가능성(15%): AI/자동화로 활용 가능성
- 콘텐츠확장성(15%): 추가 콘텐츠 생성 가능성
- 제품화가능성(15%): 제품/서비스화 가능성`;

      let aiResult: { title: string; summary: string; tags: string[]; signal_score: number };
      try {
        const completion = await llm.complete({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          agentRole: 'research',
          tier: 'fast',
          maxTokens: 1024,
        });

        const jsonText = completion.content.trim();
        const parsed = JSON.parse(jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
        aiResult = {
          title: parsed.title ?? (keyword ?? source_url ?? '수집된 항목'),
          summary: parsed.summary ?? '',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          signal_score: Math.max(0, Math.min(100, parseInt(parsed.signal_score) || 0)),
        };
      } catch (parseErr) {
        logger.error('[research] AI 응답 파싱 오류', parseErr);
        // Fallback: save without AI analysis
        aiResult = {
          title: keyword ?? source_url ?? '수집된 항목',
          summary: content?.slice(0, 300) ?? '',
          tags: [],
          signal_score: 0,
        };
      }

      const id = uuidv4();
      const tagsJson = JSON.stringify(aiResult.tags);

      const result = await db.query(
        `INSERT INTO research_items
          (id, mission_id, source_type, source_url, title, summary, content, tags, signal_score, filter_decision)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          id,
          mission_id,
          source_type,
          source_url ?? null,
          aiResult.title,
          aiResult.summary,
          content ?? null,
          tagsJson,
          aiResult.signal_score,
          'pending',
        ]
      );

      const row = (result.rows as Record<string, unknown>[])[0];
      if (row) {
        row.tags = (() => { try { return JSON.parse(row.tags as string); } catch { return []; } })();
      }

      res.status(201).json({ data: row });
    } catch (err) {
      logger.error('[research] POST /collect 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // POST /api/research/:id/filter
  router.post('/:id/filter', async (req: Request, res: Response) => {
    try {
      const parsed = FilterSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const { decision } = parsed.data;
      const result = await db.query(
        'UPDATE research_items SET filter_decision = $1 WHERE id = $2 RETURNING *',
        [decision, req.params.id]
      );

      if ((result.rows as unknown[]).length === 0) {
        res.status(404).json({ error: '리서치 항목을 찾을 수 없습니다' });
        return;
      }

      const row = (result.rows as Record<string, unknown>[])[0];
      if (row) {
        row.tags = (() => { try { return JSON.parse(row.tags as string); } catch { return []; } })();
      }

      res.json({ data: row });
    } catch (err) {
      logger.error('[research] POST /:id/filter 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // POST /api/research/:id/convert
  router.post('/:id/convert', async (req: Request, res: Response) => {
    try {
      const parsed = ConvertSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const { output_type } = parsed.data;

      // Get research item
      const itemResult = await db.query(
        'SELECT * FROM research_items WHERE id = $1',
        [req.params.id]
      );

      if ((itemResult.rows as unknown[]).length === 0) {
        res.status(404).json({ error: '리서치 항목을 찾을 수 없습니다' });
        return;
      }

      const item = (itemResult.rows as Record<string, unknown>[])[0];

      const llm = getLLMProvider();
      if (!llm) {
        res.status(503).json({ error: 'AI API 키가 설정되지 않았습니다' });
        return;
      }

      const FORMAT_PROMPTS: Record<string, string> = {
        blog: `다음 리서치 내용을 블로그 포스트로 변환하세요. 마크다운 형식으로 작성하고, 제목, 서론, 본문(소제목 포함), 결론을 포함하세요.`,
        report: `다음 리서치 내용을 전문적인 분석 리포트로 변환하세요. 마크다운 형식으로 작성하고, 요약, 현황 분석, 인사이트, 제언을 포함하세요.`,
        ppt: `다음 리서치 내용을 프레젠테이션 슬라이드 스크립트로 변환하세요. 각 슬라이드를 "## 슬라이드 N: 제목" 형식으로, 핵심 포인트는 불릿으로 작성하세요.`,
        prd: `다음 리서치 내용을 제품 요구사항 문서(PRD)로 변환하세요. 마크다운 형식으로 작성하고, 배경, 목표, 사용자 스토리, 기능 요구사항, 성공 지표를 포함하세요.`,
        archive: `다음 리서치 내용을 아카이브 노트로 요약하세요. 핵심 정보, 출처, 활용 방안을 간결하게 정리하세요.`,
      };

      const userPrompt = `${FORMAT_PROMPTS[output_type]}

제목: ${item.title}
요약: ${item.summary ?? '없음'}
콘텐츠: ${item.content ?? item.summary ?? '내용 없음'}`;

      const completion = await llm.complete({
        messages: [
          { role: 'system', content: '당신은 전문적인 콘텐츠 작성 전문가입니다. 요청된 형식에 맞게 고품질 콘텐츠를 생성하세요.' },
          { role: 'user', content: userPrompt },
        ],
        agentRole: 'content',
        tier: 'balanced',
        maxTokens: 4096,
      });

      const generatedContent = completion.content;

      // Save converted output and next_action
      await db.query(
        'UPDATE research_items SET converted_output = $1, next_action = $2 WHERE id = $3',
        [generatedContent, output_type, req.params.id]
      );

      res.json({ data: { content: generatedContent } });
    } catch (err) {
      logger.error('[research] POST /:id/convert 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // DELETE /api/research/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await db.query('DELETE FROM research_items WHERE id = $1', [req.params.id]);
      res.status(204).send();
    } catch (err) {
      logger.error('[research] DELETE /:id 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  return router;
}
