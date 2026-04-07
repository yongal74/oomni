/**
 * obsidian.ts — Obsidian 아카이브 라우트
 * POST /api/obsidian/archive — 결과물을 Obsidian Vault에 Markdown으로 저장
 * GET  /api/obsidian/status  — Vault 경로 설정 여부 확인
 */
import { Router, type Request, type Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { readSettings } from '../../config';

export function obsidianRouter(): Router {
  const router = Router();

  // GET /api/obsidian/status
  router.get('/status', (_req: Request, res: Response) => {
    const settings = readSettings() as Record<string, unknown>;
    const vaultPath = (settings.obsidian_vault_path as string) ?? '';
    const configured = !!vaultPath && fs.existsSync(vaultPath);
    res.json({ configured, vault_path: vaultPath });
  });

  // POST /api/obsidian/archive
  router.post('/archive', async (req: Request, res: Response) => {
    try {
      const { title, content, bot_role, tags } = req.body as {
        title?: string;
        content?: string;
        bot_role?: string;
        tags?: string[];
      };

      if (!content) {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const settings = readSettings() as Record<string, unknown>;
      const vaultPath = (settings.obsidian_vault_path as string) ?? '';

      if (!vaultPath) {
        res.status(400).json({ error: 'Obsidian vault 경로가 설정되지 않았습니다. 설정에서 경로를 입력해주세요.' });
        return;
      }

      if (!fs.existsSync(vaultPath)) {
        res.status(400).json({ error: `Obsidian vault 경로가 존재하지 않습니다: ${vaultPath}` });
        return;
      }

      // OOMNI 전용 폴더 생성
      const oomniDir = path.join(vaultPath, 'OOMNI');
      const botDir = path.join(oomniDir, bot_role ?? 'general');
      fs.mkdirSync(botDir, { recursive: true });

      // 파일명: YYYY-MM-DD_title.md
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeTitle = (title ?? 'archive')
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 60);
      const fileName = `${dateStr}_${safeTitle}.md`;
      const filePath = path.join(botDir, fileName);

      // Markdown 내용 구성
      const tagLine = tags && tags.length > 0
        ? `tags: [${tags.map(t => `"${t}"`).join(', ')}]\n`
        : '';
      const markdown = `---
title: "${title ?? 'OOMNI Archive'}"
date: ${new Date().toISOString()}
bot: ${bot_role ?? 'unknown'}
${tagLine}source: OOMNI
---

${content}
`;

      fs.writeFileSync(filePath, markdown, 'utf-8');

      res.json({ success: true, file_path: filePath, file_name: fileName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `아카이브 실패: ${msg}` });
    }
  });

  return router;
}
