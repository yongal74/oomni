/**
 * backup.ts - 데이터 내보내기/가져오기 API
 * GET  /api/backup/export - DB 전체를 JSON으로 내보내기
 * POST /api/backup/import - JSON을 DB에 복원
 */
import { Router, type Request, type Response } from 'express';
import { getDb } from '../../db/client';

const EXPORT_TABLES = [
  'missions',
  'agents',
  'feed_items',
  'research_items',
  'cost_events',
  'issues',
  'schedules',
  'integrations',
] as const;

type ExportTable = typeof EXPORT_TABLES[number];

interface BackupData {
  version: string;
  exported_at: string;
  tables: Partial<Record<ExportTable, unknown[]>>;
}

export function backupRouter(): Router {
  const router = Router();

  // GET /api/backup/export - DB 전체를 JSON으로 내보내기
  router.get('/export', async (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const tables: Partial<Record<ExportTable, unknown[]>> = {};

      for (const table of EXPORT_TABLES) {
        const result = await db.query(`SELECT * FROM ${table}`);
        tables[table] = result.rows;
      }

      const backup: BackupData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        tables,
      };

      const filename = `oomni-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(backup);
    } catch (err) {
      res.status(500).json({ error: '데이터 내보내기 실패', detail: String(err) });
    }
  });

  // POST /api/backup/import - JSON을 DB에 복원
  router.post('/import', async (req: Request, res: Response) => {
    const backup = req.body as BackupData;

    if (!backup?.tables || typeof backup.tables !== 'object') {
      res.status(400).json({ error: '올바른 백업 파일이 아닙니다' });
      return;
    }

    try {
      const db = getDb();

      // 테이블별 복원 (순서 중요: FK 의존성 고려)
      const ORDER: ExportTable[] = [
        'missions',
        'agents',
        'issues',
        'schedules',
        'integrations',
        'feed_items',
        'research_items',
        'cost_events',
      ];

      let totalImported = 0;

      for (const table of ORDER) {
        const rows = backup.tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        // 기존 데이터 삭제
        await db.query(`DELETE FROM ${table}`);

        for (const row of rows) {
          if (typeof row !== 'object' || row === null) continue;
          const obj = row as Record<string, unknown>;
          const cols = Object.keys(obj);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const values = cols.map(k => obj[k]);
          await db.query(
            `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
            values
          );
          totalImported++;
        }
      }

      res.json({
        success: true,
        message: `${totalImported}개 레코드를 복원했습니다`,
        imported: totalImported,
      });
    } catch (err) {
      res.status(500).json({ error: '데이터 복원 실패', detail: String(err) });
    }
  });

  return router;
}
