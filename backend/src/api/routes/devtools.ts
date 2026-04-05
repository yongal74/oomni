/**
 * devtools.ts — 개발 도구 상태 및 설정 라우트
 * GET  /api/devtools/status          — 설치된 개발 도구 상태 반환
 * POST /api/devtools/save-preference — 선호 IDE 저장
 */
import { Router, type Request, type Response } from 'express';
import { execSync } from 'child_process';
import { z } from 'zod';
import { saveSettings, readSettings } from '../../config';

const SavePreferenceSchema = z.object({
  preferred_ide: z.enum(['claude_code', 'vscode', 'cursor', 'antigravity']),
});

function checkCommand(command: string): boolean {
  try {
    const checkCmd = process.platform === 'win32'
      ? `where ${command}`
      : `which ${command}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function devtoolsRouter(): Router {
  const router = Router();

  // GET /api/devtools/status — 개발 도구 설치 상태 확인
  router.get('/status', (_req: Request, res: Response) => {
    const status = {
      claude_code: checkCommand('claude'),
      vscode: checkCommand('code'),
      cursor: checkCommand('cursor'),
      antigravity: checkCommand('antigravity'),
    };
    res.json(status);
  });

  // POST /api/devtools/save-preference — 선호 IDE 저장
  router.post('/save-preference', (req: Request, res: Response) => {
    const parsed = SavePreferenceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '잘못된 IDE 선택' });
      return;
    }

    const { preferred_ide } = parsed.data;
    saveSettings({ preferred_ide });

    res.json({ success: true, preferred_ide });
  });

  // GET /api/devtools/preference — 현재 선호 IDE 반환
  router.get('/preference', (_req: Request, res: Response) => {
    const settings = readSettings();
    res.json({ preferred_ide: settings.preferred_ide ?? 'claude_code' });
  });

  return router;
}
