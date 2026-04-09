/**
 * design-systems.ts — 미션별 디자인 시스템 설정 API
 * GET  /api/design-systems/:missionId — 설정 조회 (없으면 기본값 반환)
 * PUT  /api/design-systems/:missionId — 설정 저장/업데이트
 */
import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface Db {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

const DEFAULT_SYSTEM = {
  preset: 'oomni',
  primary_color: '#D4763B',
  bg_color: '#0F0F10',
  surface_color: '#1A1A1C',
  text_color: '#E8E8E8',
  muted_color: '#888888',
  accent_color: '#D4763B',
  font_family: 'Pretendard',
  border_radius: '8px',
  style_voice: 'modern-dark',
};

export function designSystemsRouter(db: Db): Router {
  const router = Router();

  router.get('/:missionId', async (req: Request, res: Response) => {
    try {
      const { missionId } = req.params;
      const result = await db.query(
        'SELECT * FROM design_systems WHERE mission_id = ?',
        [missionId]
      );
      if (result.rows.length === 0) {
        res.json({ data: { ...DEFAULT_SYSTEM, mission_id: missionId } });
        return;
      }
      res.json({ data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: '디자인 시스템 조회 실패' });
    }
  });

  router.put('/:missionId', async (req: Request, res: Response) => {
    try {
      const { missionId } = req.params;
      const {
        preset, primary_color, bg_color, surface_color, text_color,
        muted_color, accent_color, font_family, border_radius, style_voice,
      } = req.body;

      // upsert
      const existing = await db.query(
        'SELECT id FROM design_systems WHERE mission_id = ?',
        [missionId]
      );

      if (existing.rows.length === 0) {
        const id = uuidv4();
        await db.query(
          `INSERT INTO design_systems (id, mission_id, preset, primary_color, bg_color, surface_color, text_color, muted_color, accent_color, font_family, border_radius, style_voice)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, missionId, preset ?? DEFAULT_SYSTEM.preset,
           primary_color ?? DEFAULT_SYSTEM.primary_color,
           bg_color ?? DEFAULT_SYSTEM.bg_color,
           surface_color ?? DEFAULT_SYSTEM.surface_color,
           text_color ?? DEFAULT_SYSTEM.text_color,
           muted_color ?? DEFAULT_SYSTEM.muted_color,
           accent_color ?? DEFAULT_SYSTEM.accent_color,
           font_family ?? DEFAULT_SYSTEM.font_family,
           border_radius ?? DEFAULT_SYSTEM.border_radius,
           style_voice ?? DEFAULT_SYSTEM.style_voice]
        );
      } else {
        await db.query(
          `UPDATE design_systems SET
            preset = ?, primary_color = ?, bg_color = ?, surface_color = ?,
            text_color = ?, muted_color = ?, accent_color = ?,
            font_family = ?, border_radius = ?, style_voice = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE mission_id = ?`,
          [preset ?? DEFAULT_SYSTEM.preset,
           primary_color ?? DEFAULT_SYSTEM.primary_color,
           bg_color ?? DEFAULT_SYSTEM.bg_color,
           surface_color ?? DEFAULT_SYSTEM.surface_color,
           text_color ?? DEFAULT_SYSTEM.text_color,
           muted_color ?? DEFAULT_SYSTEM.muted_color,
           accent_color ?? DEFAULT_SYSTEM.accent_color,
           font_family ?? DEFAULT_SYSTEM.font_family,
           border_radius ?? DEFAULT_SYSTEM.border_radius,
           style_voice ?? DEFAULT_SYSTEM.style_voice,
           missionId]
        );
      }

      const updated = await db.query(
        'SELECT * FROM design_systems WHERE mission_id = ?',
        [missionId]
      );
      res.json({ data: updated.rows[0] });
    } catch (err) {
      res.status(500).json({ error: '디자인 시스템 저장 실패' });
    }
  });

  return router;
}
