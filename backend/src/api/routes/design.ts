/**
 * design.ts — Design API 라우터
 * v5.0.1
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../middleware/apiError';
import { executeDesign } from '../../services/designService';

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const GenerateSchema = z.object({
  mission_id: z.string().uuid(),
  prompt:     z.string().min(1).max(5000),
  model:      z.string().optional(),
});

export function designRouter(db: Db) {
  const router = Router();

  // POST /api/design/generate — claude-opus-4-7 디자인 생성
  router.post('/generate', async (req: Request, res: Response) => {
    const parse = GenerateSchema.safeParse(req.body);
    if (!parse.success) throw new ApiError(400, parse.error.issues[0].message, 'VALIDATION_ERROR');

    const { mission_id, prompt } = parse.data;

    // 임시 task 객체 구성 (task_id 없는 직접 호출)
    const fakeTask = {
      id: `direct_${Date.now()}`,
      mission_id,
      title: prompt.slice(0, 100),
      description: prompt,
    };

    const result = await executeDesign(db, fakeTask);
    res.json({
      data: {
        html_path: result.filePaths[0] ?? null,
        file_paths: result.filePaths,
        message: '디자인 생성 완료 (claude-opus-4-7)',
      },
    });
  });

  return router;
}
