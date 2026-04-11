import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export function ceoRouter(db: DbClient): Router {
  const router = Router();

  // GET /api/ceo/summary-stream  — SSE 스트리밍 (AI 요약 포함)
  router.get('/summary-stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { mission_id } = req.query;

      // 미션 조회
      let mission: unknown = null;
      if (mission_id) {
        const r = await db.query('SELECT * FROM missions WHERE id = $1', [mission_id]);
        mission = (r.rows as unknown[])[0] ?? null;
      } else {
        const r = await db.query('SELECT * FROM missions ORDER BY created_at DESC LIMIT 1');
        mission = (r.rows as unknown[])[0] ?? null;
      }

      const activeMissionId = (mission as Record<string, unknown> | null)?.id ?? mission_id;

      // 에이전트 조회
      let agentsResult: { rows: unknown[] } = { rows: [] };
      if (activeMissionId) {
        agentsResult = await db.query(
          `SELECT a.*,
            (SELECT f.created_at FROM feed_items f WHERE f.agent_id = a.id ORDER BY f.created_at DESC LIMIT 1) AS last_run_at,
            (SELECT f.type FROM feed_items f WHERE f.agent_id = a.id ORDER BY f.created_at DESC LIMIT 1) AS last_run_status,
            (SELECT COUNT(*) FROM feed_items f WHERE f.agent_id = a.id) AS run_count
          FROM agents a
          WHERE a.mission_id = $1
          ORDER BY a.created_at DESC`,
          [activeMissionId],
        );
      }
      const agents = agentsResult.rows as Array<Record<string, unknown>>;

      // 피드 요약
      let feedSummary = { total: 0, approvals_pending: 0, errors_today: 0, completed_today: 0 };
      if (activeMissionId) {
        const today = new Date().toISOString().slice(0, 10);
        const [totalR, approvalsR, errorsR, completedR] = await Promise.all([
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1`, [activeMissionId]),
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1 AND fi.requires_approval=1 AND fi.approved_at IS NULL AND fi.rejected_at IS NULL`, [activeMissionId]),
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1 AND fi.type='error' AND fi.created_at>=$2`, [activeMissionId, `${today}T00:00:00.000Z`]),
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1 AND fi.type='result' AND fi.created_at>=$2`, [activeMissionId, `${today}T00:00:00.000Z`]),
        ]);
        feedSummary = {
          total: Number((totalR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
          approvals_pending: Number((approvalsR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
          errors_today: Number((errorsR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
          completed_today: Number((completedR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
        };
      }

      // DB 데이터 즉시 전송 (AI 요약 전에 화면 채우기)
      send('data', { mission, agents, feed_summary: feedSummary });

      // AI 요약 스트리밍
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        send('ai_summary', { text: 'Claude API 키를 설정하면 AI 요약이 생성됩니다.' });
        send('done', {});
        res.end();
        return;
      }

      send('progress', { message: 'AI 요약 생성 중...' });

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

      const client = new Anthropic({ apiKey });
      let aiText = '';

      const stream = await client.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          aiText += chunk.delta.text;
          send('ai_chunk', { text: chunk.delta.text });
        }
      }

      send('ai_summary', { text: aiText });
      send('done', {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send('error', { message });
    } finally {
      res.end();
    }
  });

  // GET /api/ceo/summary — 레거시 REST (하위 호환)
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const { mission_id } = req.query;

      let mission: unknown = null;
      if (mission_id) {
        const r = await db.query('SELECT * FROM missions WHERE id = $1', [mission_id]);
        mission = (r.rows as unknown[])[0] ?? null;
      } else {
        const r = await db.query('SELECT * FROM missions ORDER BY created_at DESC LIMIT 1');
        mission = (r.rows as unknown[])[0] ?? null;
      }

      const activeMissionId = (mission as Record<string, unknown> | null)?.id ?? mission_id;

      let agentsResult: { rows: unknown[] } = { rows: [] };
      if (activeMissionId) {
        agentsResult = await db.query(
          `SELECT a.*,
            (SELECT f.created_at FROM feed_items f WHERE f.agent_id = a.id ORDER BY f.created_at DESC LIMIT 1) AS last_run_at,
            (SELECT f.type FROM feed_items f WHERE f.agent_id = a.id ORDER BY f.created_at DESC LIMIT 1) AS last_run_status,
            (SELECT COUNT(*) FROM feed_items f WHERE f.agent_id = a.id) AS run_count
          FROM agents a WHERE a.mission_id = $1 ORDER BY a.created_at DESC`,
          [activeMissionId],
        );
      }
      const agents = agentsResult.rows as Array<Record<string, unknown>>;

      let feedSummary = { total: 0, approvals_pending: 0, errors_today: 0, completed_today: 0 };
      if (activeMissionId) {
        const today = new Date().toISOString().slice(0, 10);
        const [totalR, approvalsR, errorsR, completedR] = await Promise.all([
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1`, [activeMissionId]),
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1 AND fi.requires_approval=1 AND fi.approved_at IS NULL AND fi.rejected_at IS NULL`, [activeMissionId]),
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1 AND fi.type='error' AND fi.created_at>=$2`, [activeMissionId, `${today}T00:00:00.000Z`]),
          db.query(`SELECT COUNT(*) as cnt FROM feed_items fi JOIN agents a ON a.id=fi.agent_id WHERE a.mission_id=$1 AND fi.type='result' AND fi.created_at>=$2`, [activeMissionId, `${today}T00:00:00.000Z`]),
        ]);
        feedSummary = {
          total: Number((totalR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
          approvals_pending: Number((approvalsR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
          errors_today: Number((errorsR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
          completed_today: Number((completedR.rows[0] as Record<string, unknown>)?.cnt ?? 0),
        };
      }

      res.json({ data: { mission, agents, feed_summary: feedSummary, ai_summary: '' } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
