import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getVault } from '../../crypto/vault';
import { IntegrationService, SUPPORTED_PROVIDERS } from '../../bots/integration';

const SaveCredentialSchema = z.object({
  mission_id: z.string().min(1),
  provider: z.enum(SUPPORTED_PROVIDERS as [string, ...string[]] as [typeof SUPPORTED_PROVIDERS[number], ...typeof SUPPORTED_PROVIDERS[number][]]),
  credentials: z.record(z.unknown()),
  label: z.string().max(100).optional(),
});

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export function integrationsRouter(db: DbClient): Router {
  const router = Router();

  const getService = () => new IntegrationService(db, getVault());

  // GET /api/integrations/providers — 지원 provider 목록
  router.get('/providers', (_req, res: Response) => {
    const service = getService();
    res.json({ data: service.getProviderMeta() });
  });

  // GET /api/integrations?mission_id=
  router.get('/', async (req: Request, res: Response) => {
    const { mission_id } = req.query;
    if (!mission_id || typeof mission_id !== 'string') {
      res.status(400).json({ error: 'mission_id가 필요합니다' });
      return;
    }
    const service = getService();
    const list = await service.listIntegrations(mission_id);
    res.json({ data: list });
  });

  // POST /api/integrations — 연동 저장
  router.post('/', async (req: Request, res: Response) => {
    const parsed = SaveCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }
    const { mission_id, provider, credentials, label } = parsed.data;
    const service = getService();
    await service.saveCredential(mission_id, provider, credentials, label);
    res.status(201).json({ message: `${provider} 연동 완료` });
  });

  // DELETE /api/integrations/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    const service = getService();
    await service.deleteCredential(req.params['id'] as string);
    res.status(204).send();
  });

  return router;
}
