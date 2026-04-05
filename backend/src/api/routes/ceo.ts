import { Router, type Request, type Response } from 'express';
import axios from 'axios';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export function ceoRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/ceo/summary
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const { mission_id } = req.query;

      // Get current mission
      let mission: unknown = null;
      if (mission_id) {
        const missionResult = await db.query('SELECT * FROM missions WHERE id = $1', [mission_id]);
        mission = (missionResult.rows as unknown[])[0] ?? null;
      } else {
        const missionResult = await db.query('SELECT * FROM missions ORDER BY created_at DESC LIMIT 1');
        mission = (missionResult.rows as unknown[])[0] ?? null;
      }

      const activeMissionId = (mission as Record<string, unknown> | null)?.id ?? mission_id;

      // Get agents with last run info
      let agentsResult: { rows: unknown[] } = { rows: [] };
      if (activeMissionId) {
        agentsResult = await db.query(
          `SELECT
            a.*,
            (
              SELECT f.created_at
              FROM feed_items f
              WHERE f.agent_id = a.id
              ORDER BY f.created_at DESC
              LIMIT 1
            ) AS last_run_at,
            (
              SELECT f.type
              FROM feed_items f
              WHERE f.agent_id = a.id
              ORDER BY f.created_at DESC
              LIMIT 1
            ) AS last_run_status,
            (
              SELECT COUNT(*)
              FROM feed_items f
              WHERE f.agent_id = a.id
            ) AS run_count
          FROM agents a
          WHERE a.mission_id = $1
          ORDER BY a.created_at DESC`,
          [activeMissionId],
        );
      }

      const agents = agentsResult.rows as Array<Record<string, unknown>>;

      // Feed summary
      let feedSummary = { total: 0, approvals_pending: 0, errors_today: 0, completed_today: 0 };
      if (activeMissionId) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const totalResult = await db.query(
          `SELECT COUNT(*) as cnt FROM feed_items fi
           JOIN agents a ON a.id = fi.agent_id
           WHERE a.mission_id = $1`,
          [activeMissionId],
        );
        const totalRow = (totalResult.rows as Array<Record<string, unknown>>)[0];

        const approvalsResult = await db.query(
          `SELECT COUNT(*) as cnt FROM feed_items fi
           JOIN agents a ON a.id = fi.agent_id
           WHERE a.mission_id = $1
             AND fi.requires_approval = 1
             AND fi.approved_at IS NULL
             AND fi.rejected_at IS NULL`,
          [activeMissionId],
        );
        const approvalsRow = (approvalsResult.rows as Array<Record<string, unknown>>)[0];

        const errorsResult = await db.query(
          `SELECT COUNT(*) as cnt FROM feed_items fi
           JOIN agents a ON a.id = fi.agent_id
           WHERE a.mission_id = $1
             AND fi.type = 'error'
             AND fi.created_at >= $2`,
          [activeMissionId, `${today}T00:00:00.000Z`],
        );
        const errorsRow = (errorsResult.rows as Array<Record<string, unknown>>)[0];

        const completedResult = await db.query(
          `SELECT COUNT(*) as cnt FROM feed_items fi
           JOIN agents a ON a.id = fi.agent_id
           WHERE a.mission_id = $1
             AND fi.type = 'result'
             AND fi.created_at >= $2`,
          [activeMissionId, `${today}T00:00:00.000Z`],
        );
        const completedRow = (completedResult.rows as Array<Record<string, unknown>>)[0];

        feedSummary = {
          total: Number(totalRow?.cnt ?? 0),
          approvals_pending: Number(approvalsRow?.cnt ?? 0),
          errors_today: Number(errorsRow?.cnt ?? 0),
          completed_today: Number(completedRow?.cnt ?? 0),
        };
      }

      // AI summary
      let ai_summary = 'Claude API 키를 설정하면 AI 요약이 생성됩니다.';
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (apiKey) {
        try {
          const missionName = (mission as Record<string, unknown> | null)?.name ?? '(미션 없음)';
          const activeAgents = agents.filter(a => a.is_active);
          const agentSummary = agents
            .map(a => `- ${String(a.name)} (${String(a.role)}): ${a.is_active ? '활성' : '비활성'}, 실행 ${a.run_count ?? 0}회`)
            .join('\n');

          const prompt = `당신은 Solo Factory OS의 CEO 대시보드 AI 어시스턴트입니다.
다음 현황을 바탕으로 간결한 주간 요약 (3~5문장)을 한국어로 작성해주세요.

미션: ${missionName}
활성 봇: ${activeAgents.length}개 / 전체 ${agents.length}개
오늘 완료: ${feedSummary.completed_today}건
오늘 오류: ${feedSummary.errors_today}건
승인 대기: ${feedSummary.approvals_pending}건
총 피드 항목: ${feedSummary.total}건

봇 상세:
${agentSummary || '(봇 없음)'}

위 데이터를 기반으로 현재 팀 상태와 주요 이슈, 다음 액션을 간략히 요약해주세요.`;

          const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 300,
              messages: [{ role: 'user', content: prompt }],
            },
            {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              timeout: 30000,
            },
          );

          const data = response.data as {
            content: Array<{ type: string; text: string }>;
          };
          const textContent = data.content.find(c => c.type === 'text');
          if (textContent) {
            ai_summary = textContent.text;
          }
        } catch (_err) {
          ai_summary = 'AI 요약 생성에 실패했습니다. API 키와 네트워크 상태를 확인해주세요.';
        }
      }

      res.json({
        data: {
          mission,
          agents,
          feed_summary: feedSummary,
          ai_summary,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
