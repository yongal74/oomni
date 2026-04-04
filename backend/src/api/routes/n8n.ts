import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { N8nBotService } from '../../bots/n8n';
import { IntegrationService } from '../../bots/integration';
import { getVault } from '../../crypto/vault';

const DeployTemplateSchema = z.object({
  mission_id: z.string().min(1),
  template_id: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  activate: z.boolean().default(true),
});

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

async function getN8nService(db: DbClient, missionId: string): Promise<N8nBotService | null> {
  const intService = new IntegrationService(db, getVault());
  const creds = await intService.getCredential<{ apiKey: string; baseUrl: string }>(missionId, 'n8n');
  if (!creds) return null;
  return new N8nBotService({ apiKey: creds.apiKey, baseUrl: creds.baseUrl });
}

export function n8nRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/n8n/templates — 사용 가능한 워크플로우 템플릿
  router.get('/templates', (_req, res: Response) => {
    const service = new N8nBotService({ apiKey: '', baseUrl: '' });
    res.json({ data: service.getAvailableTemplates() });
  });

  // GET /api/n8n/workflows?mission_id=
  router.get('/workflows', async (req: Request, res: Response) => {
    const { mission_id } = req.query;
    if (!mission_id || typeof mission_id !== 'string') {
      res.status(400).json({ error: 'mission_id가 필요합니다' });
      return;
    }
    const service = await getN8nService(db, mission_id);
    if (!service) {
      res.status(404).json({ error: 'n8n 연동이 없습니다. 먼저 연동을 설정해주세요.' });
      return;
    }
    const workflows = await service.listWorkflows();
    res.json({ data: workflows });
  });

  // POST /api/n8n/deploy — 템플릿으로 워크플로우 배포 (딸깍!)
  router.post('/deploy', async (req: Request, res: Response) => {
    const parsed = DeployTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }

    const { mission_id, template_id, params, activate } = parsed.data;
    const service = await getN8nService(db, mission_id);
    if (!service) {
      res.status(404).json({ error: 'n8n 연동이 없습니다' });
      return;
    }

    const workflow = service.buildWorkflowFromTemplate(template_id, params);
    const created = await service.createWorkflow(workflow);

    if (activate && created.id) {
      await service.activateWorkflow(created.id);
    }

    res.status(201).json({
      data: created,
      message: `"${workflow.name}" 워크플로우가 ${activate ? '활성화' : '생성'}되었습니다`,
    });
  });

  // POST /api/n8n/test — 연결 테스트
  router.post('/test', async (req: Request, res: Response) => {
    const { mission_id } = req.body;
    if (!mission_id) {
      res.status(400).json({ error: 'mission_id가 필요합니다' });
      return;
    }
    const service = await getN8nService(db, mission_id);
    if (!service) {
      res.status(404).json({ error: 'n8n 연동이 없습니다' });
      return;
    }
    const ok = await service.testConnection();
    res.json({ connected: ok });
  });

  // DELETE /api/n8n/workflows/:id
  router.delete('/workflows/:id', async (req: Request, res: Response) => {
    const { mission_id } = req.query;
    if (!mission_id || typeof mission_id !== 'string') {
      res.status(400).json({ error: 'mission_id가 필요합니다' });
      return;
    }
    const service = await getN8nService(db, mission_id);
    if (!service) {
      res.status(404).json({ error: 'n8n 연동이 없습니다' });
      return;
    }
    await service.deleteWorkflow(req.params['id'] as string);
    res.status(204).send();
  });

  return router;
}
