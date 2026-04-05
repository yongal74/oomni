import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const SOLO_FACTORY_AGENTS = [
  {
    name: 'Research Bot',
    role: 'research',
    system_prompt: 'You are a research specialist. Gather information, analyze trends, and produce structured research reports.',
    budget_cents: 1000,
  },
  {
    name: 'Design Bot',
    role: 'design',
    system_prompt: 'You are a design specialist. Create UI/UX designs, wireframes, and visual assets using Claude Code and Pencil.dev.',
    budget_cents: 1000,
  },
  {
    name: 'Build Bot',
    role: 'build',
    system_prompt: 'You are a software engineer. Write clean, tested code using Claude Code CLI. Follow TDD practices.',
    budget_cents: 2000,
  },
  {
    name: 'Content Bot',
    role: 'content',
    system_prompt: 'You are a content creator. Write blog posts, social media content, product descriptions, and marketing copy.',
    budget_cents: 500,
  },
  {
    name: 'Ops Bot',
    role: 'ops',
    system_prompt: 'You are an operations specialist. Monitor systems, automate workflows, track KPIs, and ensure smooth operations.',
    budget_cents: 500,
  },
  {
    name: 'CEO Bot',
    role: 'ceo',
    system_prompt: 'You are the CEO AI. Synthesize reports from all bots, track progress, make strategic decisions, and provide weekly summaries.',
    budget_cents: 1000,
  },
] as const;

const TEMPLATES = [
  {
    id: 'solo-factory-os',
    name: 'Solo Factory OS',
    description: '6개 AI 봇(Research, Design, Build, Content, Ops, CEO)으로 혼자서 팀처럼 일하는 자동화 시스템',
    agents: SOLO_FACTORY_AGENTS,
  },
];

const ApplyTemplateSchema = z.object({
  mission_id: z.string().min(1),
});

export function templatesRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/templates
  router.get('/', (_req: Request, res: Response) => {
    res.json({ data: TEMPLATES });
  });

  // POST /api/templates/:id/apply
  router.post('/:id/apply', async (req: Request, res: Response) => {
    const template = TEMPLATES.find(t => t.id === req.params.id);
    if (!template) {
      res.status(404).json({ error: '템플릿을 찾을 수 없습니다' });
      return;
    }

    const parsed = ApplyTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '입력 오류' });
      return;
    }

    const { mission_id } = parsed.data;

    // Verify mission exists
    const missionResult = await db.query('SELECT id FROM missions WHERE id = $1', [mission_id]);
    if ((missionResult.rows as unknown[]).length === 0) {
      res.status(404).json({ error: '미션을 찾을 수 없습니다' });
      return;
    }

    let agentsCreated = 0;

    for (const agentDef of template.agents) {
      const id = uuidv4();
      const isCeo = agentDef.role === 'ceo';
      await db.query(
        `INSERT INTO agents (id, mission_id, name, role, schedule, system_prompt, budget_cents, reports_to, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id,
          mission_id,
          agentDef.name,
          agentDef.role,
          'manual',
          agentDef.system_prompt,
          agentDef.budget_cents,
          isCeo ? null : null, // reports_to — will be linked after creation
          true,
        ],
      );
      agentsCreated++;
    }

    res.status(201).json({ data: { agents_created: agentsCreated } });
  });

  return router;
}
