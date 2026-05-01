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
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../logger';
import { LLMProvider } from '../../agents/llm-provider';

const execFileAsync = promisify(execFile);

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
  output_type: z.enum(['blog', 'linkedin', 'newsletter', 'report', 'ppt', 'prd', 'archive', 'action_plan']),
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

  // POST /api/research/sync-files — disk JSON → DB
  router.post('/sync-files', async (req: Request, res: Response) => {
    try {
      const { mission_id } = req.body as { mission_id?: string };
      if (!mission_id) {
        res.status(400).json({ error: 'mission_id는 필수입니다' });
        return;
      }

      const dataRoot = process.platform === 'win32' ? 'C:/oomni-data' : path.join(os.homedir(), 'oomni-data');
      const itemsDir = path.join(dataRoot, 'research', 'items');

      if (!fs.existsSync(itemsDir)) {
        res.json({ synced: 0 });
        return;
      }

      const files = fs.readdirSync(itemsDir).filter(f => f.endsWith('.json'));
      let synced = 0;

      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(itemsDir, file), 'utf-8');
          const data = JSON.parse(raw) as {
            title?: string;
            summary?: string;
            signal_score?: number;
            source_url?: string | null;
            tags?: string[];
          };

          if (!data.title) continue;

          // Skip duplicates
          const existing = await db.query(
            'SELECT id FROM research_items WHERE mission_id = $1 AND title = $2',
            [mission_id, data.title]
          );
          if ((existing.rows as unknown[]).length > 0) continue;

          await db.query(
            `INSERT INTO research_items (id, mission_id, source_type, source_url, title, summary, tags, signal_score, filter_decision)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              uuidv4(),
              mission_id,
              'keyword',
              data.source_url ?? null,
              data.title,
              data.summary ?? null,
              JSON.stringify(data.tags ?? []),
              data.signal_score ?? 0,
              'pending',
            ]
          );
          synced++;
        } catch {
          // skip malformed files
        }
      }

      res.json({ synced });
    } catch (err) {
      logger.error('[research] POST /sync-files 오류', err);
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
        blog: `당신은 테크 블로그 작가입니다. 다음 리서치 내용을 블로그 포스트로 변환하세요.

글쓰기 스타일 (반드시 준수):
- 800자 내외 (서론+본문+결론)
- 문장 종결: ~습니다 기본, 자연스러운 곳에 ~요/~죠 섞어 쓰기
- 간결하고 이해하기 쉬운 문장
- 몰입감 있는 구성

형식:
# [제목]

## 서론
[독자의 관심을 끄는 도입부]

## 본문
[소제목별 핵심 내용]

## 결론
[핵심 정리 + 시사점]`,

        linkedin: `당신은 LinkedIn 콘텐츠 전문가입니다. 다음 리서치 내용을 LinkedIn 포스트로 변환하세요.

글쓰기 스타일 (반드시 준수):
- 800자 내외 (최대 900자)
- 문장 종결: ~습니다 기본, 자연스러운 곳에 ~요/~죠 섞어 쓰기
- 간결하고 이해하기 쉬운 문장 (한 문장 50자 이내)
- 몰입감 있는 훅으로 시작 (첫 2줄이 핵심)
- 단락 구분 명확히, 이모지 2-3개 자연스럽게 활용
- 마지막에 질문이나 CTA로 마무리

형식:
[훅 - 핵심 인사이트 1-2줄]

[본문 - 3-4개 핵심 포인트, 각 포인트는 2-3줄]

[마무리 - 질문 또는 행동 유도]

#태그1 #태그2 #태그3`,

        newsletter: `당신은 뉴스레터 전문 에디터입니다. 다음 리서치 내용을 뉴스레터 섹션으로 변환하세요.

글쓰기 스타일 (반드시 준수):
- 800자 내외
- 문장 종결: ~습니다 기본, 자연스러운 곳에 ~요/~죠 섞어 쓰기
- 간결하고 이해하기 쉬운 설명
- 독자가 즉시 활용할 수 있는 인사이트 중심

형식:
## [섹션 제목]

**한 줄 요약**: [핵심 메시지]

[본문 2-3단락]

**왜 중요한가**: [시사점]
**어떻게 활용할까**: [실전 팁]`,

        report: `다음 리서치 내용을 전문적인 분석 리포트로 변환하세요. 마크다운 형식으로 작성하고, 요약, 현황 분석, 인사이트, 제언을 포함하세요.`,
        ppt: `다음 리서치 내용을 프레젠테이션 슬라이드 스크립트로 변환하세요. 각 슬라이드를 "## 슬라이드 N: 제목" 형식으로, 핵심 포인트는 불릿으로 작성하세요.`,
        prd: `다음 리서치 내용을 제품 요구사항 문서(PRD)로 변환하세요. 마크다운 형식으로 작성하고, 배경, 목표, 사용자 스토리, 기능 요구사항, 성공 지표를 포함하세요.`,
        archive: `다음 리서치 내용을 아카이브 노트로 요약하세요. 핵심 정보, 출처, 활용 방안을 간결하게 정리하세요.`,
        action_plan: `다음 리서치 내용을 실행 가능한 액션 플랜으로 변환하세요. 마크다운 형식으로 작성하고, 우선순위별 액션 아이템, 담당자/기한, 기대 효과를 포함하세요.

형식:
## 핵심 목표
[1-2문장으로 이번 액션 플랜의 목표]

## 우선순위 액션 아이템

### 🔴 즉시 실행 (이번 주)
- [ ] [구체적 액션] — 기대 효과: [결과]

### 🟡 단기 실행 (이번 달)
- [ ] [구체적 액션] — 기대 효과: [결과]

### 🟢 중기 실행 (다음 분기)
- [ ] [구체적 액션] — 기대 효과: [결과]

## 성공 지표 (KPI)
[측정 가능한 지표 2-3개]`,
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

  // PATCH /api/research/items/:id/outputs — convert 산출물 저장
  router.patch('/items/:id/outputs', async (req: Request, res: Response) => {
    try {
      const { outputs } = req.body as { outputs?: Record<string, string> };
      if (!outputs || typeof outputs !== 'object') {
        res.status(400).json({ error: 'outputs 객체가 필요합니다' });
        return;
      }
      await db.query(
        'UPDATE research_items SET outputs_json = $1 WHERE id = $2',
        [JSON.stringify(outputs), req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      logger.error('[research] PATCH /items/:id/outputs 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // GET /api/research/items/:id/outputs — convert 산출물 조회
  router.get('/items/:id/outputs', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        'SELECT outputs_json FROM research_items WHERE id = $1',
        [req.params.id]
      );
      if ((result.rows as unknown[]).length === 0) {
        res.json({ data: {} });
        return;
      }
      const row = (result.rows as { outputs_json?: string }[])[0];
      res.json({ data: row?.outputs_json ? JSON.parse(row.outputs_json) : {} });
    } catch (err) {
      logger.error('[research] GET /items/:id/outputs 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  // ── 소스 관리 API ─────────────────────────────────────────

  // GET /api/research/sources — 전체 소스 목록
  router.get('/sources', async (_req, res: Response) => {
    try {
      const result = await db.query(
        `SELECT * FROM research_sources ORDER BY category, name`
      )
      res.json({ data: result.rows })
    } catch (err) {
      logger.error('[research] GET /sources 오류', err)
      res.status(500).json({ error: '서버 내부 오류' })
    }
  })

  // PATCH /api/research/sources/:id — on/off 토글
  router.patch('/sources/:id', async (req, res: Response) => {
    try {
      const { is_active } = req.body as { is_active?: boolean }
      if (typeof is_active !== 'boolean') {
        res.status(400).json({ error: 'is_active(boolean) 필요' })
        return
      }
      const result = await db.query(
        `UPDATE research_sources SET is_active = $1 WHERE id = $2 RETURNING *`,
        [is_active ? 1 : 0, req.params.id]
      )
      if ((result.rows as unknown[]).length === 0) {
        res.status(404).json({ error: '소스를 찾을 수 없습니다' })
        return
      }
      res.json({ data: (result.rows as unknown[])[0] })
    } catch (err) {
      logger.error('[research] PATCH /sources/:id 오류', err)
      res.status(500).json({ error: '서버 내부 오류' })
    }
  })

  // POST /api/research/sources — 새 소스 추가
  router.post('/sources', async (req, res: Response) => {
    try {
      const SourceSchema = z.object({
        name:     z.string().min(1).max(100),
        url:      z.string().min(1).max(500),
        type:     z.enum(['rss', 'youtube', 'x', 'special']).default('rss'),
        category: z.string().max(50).default('custom'),
      })
      const parsed = SourceSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' })
        return
      }
      const { name, url, type, category } = parsed.data
      const id = uuidv4()
      const result = await db.query(
        `INSERT INTO research_sources (id, name, url, type, category, is_active, is_custom)
         VALUES ($1,$2,$3,$4,$5,1,1) RETURNING *`,
        [id, name, url, type, category]
      )
      res.status(201).json({ data: (result.rows as unknown[])[0] })
    } catch (err) {
      logger.error('[research] POST /sources 오류', err)
      res.status(500).json({ error: '서버 내부 오류' })
    }
  })

  // DELETE /api/research/sources/:id — 커스텀 소스 삭제
  router.delete('/sources/:id', async (req, res: Response) => {
    try {
      const src = await db.query(
        `SELECT is_custom FROM research_sources WHERE id = $1`, [req.params.id]
      )
      const row = (src.rows as Array<{ is_custom: number }>)[0]
      if (!row) { res.status(404).json({ error: '소스를 찾을 수 없습니다' }); return }
      if (!row.is_custom) { res.status(403).json({ error: '기본 소스는 삭제할 수 없습니다 (비활성화만 가능)' }); return }
      await db.query(`DELETE FROM research_sources WHERE id = $1`, [req.params.id])
      res.status(204).send()
    } catch (err) {
      logger.error('[research] DELETE /sources/:id 오류', err)
      res.status(500).json({ error: '서버 내부 오류' })
    }
  })

  // POST /api/research/ingest — n8n 등 외부에서 기사 배치 삽입
  // Body: { mission_id, items: [{ title, url, summary, source, published_at }] }
  router.post('/ingest', async (req: Request, res: Response) => {
    try {
      const IngestSchema = z.object({
        mission_id: z.string().min(1),
        items: z.array(z.object({
          title:        z.string().min(1).max(500),
          url:          z.string().url().optional(),
          summary:      z.string().max(1000).optional(),
          source:       z.string().max(100).optional(),
          published_at: z.string().optional(),
          signal_score: z.number().min(0).max(100).optional(),
        })).min(1).max(200),
      });

      const parsed = IngestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
        return;
      }

      const { mission_id, items } = parsed.data;
      let inserted = 0;

      for (const item of items) {
        // 중복 체크 (URL 또는 제목 기준)
        const existing = await db.query(
          `SELECT id FROM research_items WHERE mission_id = $1 AND (source_url = $2 OR title = $3) LIMIT 1`,
          [mission_id, item.url ?? '', item.title]
        );
        if ((existing.rows as unknown[]).length > 0) continue;

        await db.query(
          `INSERT INTO research_items (id, mission_id, source_type, source_url, title, summary, tags, signal_score, filter_decision)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            uuidv4(),
            mission_id,
            item.source ?? 'n8n',
            item.url ?? null,
            item.title,
            item.summary ?? null,
            JSON.stringify([item.source ?? 'n8n']),
            item.signal_score ?? 0,
            'pending',
          ]
        );
        inserted++;
      }

      res.json({ inserted, skipped: items.length - inserted });
    } catch (err) {
      logger.error('[research] POST /ingest 오류', err);
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

  // POST /api/research/aiwx-post — AIWX 블로그 포스트 생성 + 선택적 Blogger 발행
  router.post('/aiwx-post', async (req: Request, res: Response) => {
    try {
      const { item_id, book_num, publish = false } = req.body as {
        item_id?: string;
        book_num?: number;
        publish?: boolean;
      };

      // 리서치 아이템 조회 (item_id 있는 경우)
      let itemTitle = '';
      let itemSummary = '';
      let itemContent = '';

      if (item_id) {
        const itemResult = await db.query('SELECT * FROM research_items WHERE id = $1', [item_id]);
        if ((itemResult.rows as unknown[]).length > 0) {
          const row = (itemResult.rows as Record<string, unknown>[])[0];
          itemTitle   = String(row.title   ?? '');
          itemSummary = String(row.summary ?? '');
          itemContent = String(row.content ?? row.summary ?? '');
        }
      }

      const llm = getLLMProvider();
      if (!llm) {
        res.status(503).json({ error: 'AI API 키가 설정되지 않았습니다' });
        return;
      }

      // 책별 설정
      const BOOK_CONFIG: Record<number, { name: string; chars: string; audience: string; tone: string; labels: string[] }> = {
        1: { name: '데이터가 흐르는 조직',    chars: '1200~1800자', audience: 'IT 임원·CDO',         tone: '전략적',    labels: ['AI와 구조', '데이터플로우'] },
        2: { name: 'AI×WEB3 온체인 혁명',     chars: '1500~2500자', audience: '금융 임원·핀테크',     tone: '비즈니스',  labels: ['AI×금융', '온체인', 'WEB3전략'] },
        3: { name: '무의식의 혁명',            chars: '1000~1500자', audience: '30~50대 직장인',      tone: '공감·철학', labels: ['AI와 삶', '무의식', '마음챙김'] },
        4: { name: 'AI 시대의 솔로프리너',     chars: '1500~2500자', audience: '1인 창업자·프리랜서', tone: '실전',      labels: ['AI와 생존', '솔로프리너', '바이브코딩'] },
        5: { name: 'AI 프로메테우스',          chars: '1200~1800자', audience: '일반 독자·AI 관심층', tone: '스토리',    labels: ['AI와 삶', 'SF와AI', 'AI철학'] },
        6: { name: 'K-스테이블코인',           chars: '1500~2000자', audience: '금융인·정책 관심층',  tone: '분석',      labels: ['AI×금융', '스테이블코인'] },
        7: { name: 'AI 디지털 초혁신',         chars: '1200~1800자', audience: '기업 임원·전략기획',  tone: '전략',      labels: ['AI와 구조', '디지털혁신'] },
      };
      const book = BOOK_CONFIG[book_num ?? 5] ?? BOOK_CONFIG[5];

      const systemPrompt = `당신은 AIWX 블로그(https://aiwx2035.blogspot.com)의 전속 콘텐츠 에디터입니다.
블로그 컨셉: "AI 시대를 먼저 읽습니다" | 주언어: 한국어

[글쓰기 스타일 — 반드시 준수]
1. 합쇼체(~습니다) 기본, 3~4문장마다 ~요 또는 ~죠로 호흡 전환
2. 최진석 교수체: 간결함(한 문장 한 생각), 질문 유발, 스토리텔링, 깊이+쉬움
3. 금지 사항: 이모지(본문 내), "~인데요/~거든요" 과잉, "정말/매우/굉장히" 남용, 결론 없이 끝나기

[포스트 표준 구조 — 모든 글에 적용]
① 제목 (30자 이내, 검색 의도 + 공감 유발)
② 리드 문단 — 실제 뉴스/데이터/사건으로 시작 (2~3문장)
③ 소제목 4개:
   1. 배경/문제 + 실제 사례
   2. 핵심 인사이트 + 실제 사례
   3. 실전 적용 + 구체적 행동 3가지
   4. 요약 + 한 줄 메시지
④ CTA — 다음 글 예고 or 뉴스레터 구독 안내

[이 포스트 설정]
- 책: ${book.name}
- 글자수: ${book.chars}
- 독자: ${book.audience}
- 톤: ${book.tone}
- 라벨: ${book.labels.join(', ')}

[출력 형식]
===== POST 1 =====
제목: [제목]
라벨: [라벨1, 라벨2, 라벨3]

[본문 전문]

===== POST 2 =====
제목: [제목]
라벨: [라벨1, 라벨2, 라벨3]

[본문 전문]`;

      const userPrompt = `다음 리서치 내용을 바탕으로 AIWX 블로그 포스트 2개를 작성해주세요.

제목/주제: ${itemTitle || '최신 AI 트렌드'}
요약: ${itemSummary || ''}
내용: ${itemContent || itemSummary || '최신 AI/스타트업 트렌드 분석'}

${book.name} 독자층(${book.audience})에 맞는 2개의 독립적인 블로그 포스트를 작성하세요.`;

      const completion = await llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        agentRole: 'content',
        tier: 'balanced',
        maxTokens: 4096,
      });

      const generatedContent = completion.content;

      // 파일 저장 (C:/oomni-data/research/aiwx-posts/)
      const dataRoot = process.platform === 'win32' ? 'C:/oomni-data' : path.join(os.homedir(), 'oomni-data');
      const aiwxDir  = path.join(dataRoot, 'research', 'aiwx-posts');
      fs.mkdirSync(aiwxDir, { recursive: true });

      const slug     = (itemTitle || 'post').slice(0, 30).replace(/[^\w가-힣]/g, '-');
      const dateStr  = new Date().toISOString().slice(0, 10);
      const filename = `aiwx-post_${dateStr}_${slug}.md`;
      const filePath = path.join(aiwxDir, filename);
      fs.writeFileSync(filePath, generatedContent, 'utf-8');

      // Blogger 발행 (publish=true 인 경우만)
      let publishResult: { success: boolean; error?: string } = { success: false };
      if (publish) {
        const publishScript = 'C:/GGAdsense/publish_post.py';
        if (fs.existsSync(publishScript)) {
          try {
            await execFileAsync('python', [publishScript, filePath], { timeout: 60000 });
            publishResult = { success: true };
          } catch (publishErr) {
            const errMsg = publishErr instanceof Error ? publishErr.message : String(publishErr);
            publishResult = { success: false, error: errMsg };
            logger.warn('[research] Blogger 발행 오류:', errMsg);
          }
        } else {
          publishResult = { success: false, error: 'C:/GGAdsense/publish_post.py 파일을 찾을 수 없습니다' };
        }
      }

      res.json({
        data: {
          content: generatedContent,
          file_path: filePath,
          publish_result: publishResult,
        },
      });
    } catch (err) {
      logger.error('[research] POST /aiwx-post 오류', err);
      res.status(500).json({ error: '서버 내부 오류' });
    }
  });

  return router;
}
