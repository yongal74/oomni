/**
 * payments.ts — Toss Payments 구독 결제 라우트
 * POST /api/payments/toss/confirm       — 결제 승인 (단건)
 * POST /api/payments/toss/billing/issue — 빌링키 발급 (정기결제)
 * POST /api/payments/toss/billing/pay   — 빌링키로 결제
 * GET  /api/payments/subscription       — 현재 구독 상태
 * POST /api/payments/subscription/cancel — 구독 취소
 * GET  /api/payments/plans              — 플랜 목록
 */
import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import { getDb } from '../../db/client.js';

// ── 플랜 정의 ─────────────────────────────────────────────────
const PLANS = {
  personal: { name: '개인', price: 9900, period: 'monthly', description: '1인 사업자, 프리랜서' },
  team: { name: '팀', price: 29000, period: 'monthly', description: '최대 5인 팀' },
} as const;

type PlanId = keyof typeof PLANS;

// ── Toss 비밀키 ───────────────────────────────────────────────
function getTossSecretKey(): string {
  return process.env.TOSS_SECRET_KEY ?? 'test_sk_zXLkKEypNArWmo50nX3lmeaxYG5pMkYmjYF4K';
}

function tossAuthHeader(): string {
  const key = getTossSecretKey();
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

// ── 30일 후 ISO 문자열 ────────────────────────────────────────
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── nanoid 대체 UUID 생성 ─────────────────────────────────────
import * as crypto from 'crypto';
function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// ── 세션에서 user_id 추출 헬퍼 ───────────────────────────────
async function getSessionUser(
  req: Request
): Promise<{ token: string; userId?: string } | null> {
  const token =
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.query['token'] as string);
  if (!token) return null;
  const db = getDb();
  const result = await db.query(
    `SELECT user_id FROM sessions WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [token]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0] as { user_id?: string };
  return { token, userId: row.user_id ?? undefined };
}

// ── Toss API 응답 타입 ────────────────────────────────────────
interface TossConfirmResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  status: string;
  method?: string;
  approvedAt?: string;
}

interface TossBillingIssueResponse {
  billingKey: string;
  customerKey: string;
  cardCompany?: string;
  cardNumber?: string;
}

interface TossBillingPayResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  status: string;
  method?: string;
  approvedAt?: string;
}

// ── 라우터 팩토리 ─────────────────────────────────────────────
export function paymentsRouter(): Router {
  const router = Router();

  /**
   * @openapi
   * /api/payments/plans:
   *   get:
   *     summary: 구독 플랜 목록 조회
   *     tags: [Payments]
   *     security: []
   *     responses:
   *       200:
   *         description: 플랜 목록
   */
  // GET /api/payments/plans — 플랜 목록 반환 (인증 불필요)
  router.get('/plans', (_req: Request, res: Response) => {
    const plans = Object.entries(PLANS).reduce<Record<string, { name: string; price: number; period: string; description: string } & { id: string }>>(
      (acc, [id, plan]) => {
        acc[id] = { id, ...plan };
        return acc;
      },
      {}
    );
    res.json({ data: plans });
  });

  /**
   * @openapi
   * /api/payments/toss/confirm:
   *   post:
   *     summary: Toss 단건 결제 승인
   *     tags: [Payments]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [paymentKey, orderId, amount, plan]
   *             properties:
   *               paymentKey: { type: string }
   *               orderId: { type: string }
   *               amount: { type: number }
   *               plan: { type: string, enum: [personal, team] }
   *     responses:
   *       200:
   *         description: 결제 완료
   *       400:
   *         description: 결제 실패
   */
  // POST /api/payments/toss/confirm — 단건 결제 승인
  router.post('/toss/confirm', async (req: Request, res: Response) => {
    const { paymentKey, orderId, amount, plan } = req.body as {
      paymentKey?: string;
      orderId?: string;
      amount?: number;
      plan?: string;
    };

    if (!paymentKey || !orderId || !amount || !plan) {
      res.status(400).json({ error: 'paymentKey, orderId, amount, plan이 필요합니다' });
      return;
    }

    if (!PLANS[plan as PlanId]) {
      res.status(400).json({ error: '유효하지 않은 플랜입니다' });
      return;
    }

    const session = await getSessionUser(req);
    const userId = session?.userId ?? orderId; // 세션 없으면 orderId를 임시 식별자로 사용

    const db = getDb();
    const paymentLogId = generateId();

    try {
      // Toss Payments 결제 승인 API 호출
      const tossRes = await axios.post<TossConfirmResponse>(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey, orderId, amount },
        {
          headers: {
            Authorization: tossAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      const tossData = tossRes.data;
      const planInfo = PLANS[plan as PlanId];
      const periodEnd = daysFromNow(30);
      const subscriptionId = generateId();

      // payment_logs INSERT (done)
      await db.query(
        `INSERT INTO payment_logs (id, user_id, subscription_id, payment_key, order_id, order_name, amount, status, method, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'done', ?, ?)`,
        [
          paymentLogId,
          userId,
          subscriptionId,
          tossData.paymentKey,
          tossData.orderId,
          tossData.orderName ?? planInfo.name,
          tossData.amount,
          tossData.method ?? null,
          tossData.approvedAt ?? new Date().toISOString(),
        ]
      );

      // subscriptions INSERT
      await db.query(
        `INSERT INTO subscriptions (id, user_id, plan, status, current_period_start, current_period_end)
         VALUES (?, ?, ?, 'active', datetime('now'), ?)`,
        [subscriptionId, userId, plan, periodEnd]
      );

      // users 테이블 license_valid_until 업데이트 (userId가 email일 경우 대응)
      await db.query(
        `UPDATE users SET license_valid_until = ? WHERE id = ? OR email = ?`,
        [periodEnd, userId, userId]
      );

      // 결제 성공 피드 알림 (실패해도 결제 성공으로 처리)
      try {
        const feedId = generateId();
        // 해당 유저의 가장 최근 미션 조회 (없으면 null)
        const missionResult = await db.query(
          `SELECT id FROM missions WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] }));
        const missionId = (missionResult.rows[0] as { id?: string } | undefined)?.id ?? null;
        // 대표 에이전트 조회 (미션에 속한 첫 번째 봇)
        const agentResult = await db.query(
          `SELECT id FROM agents ${missionId ? 'WHERE mission_id = ?' : 'LIMIT 1'} LIMIT 1`,
          missionId ? [missionId] : []
        ).catch(() => ({ rows: [] }));
        const agentId = (agentResult.rows[0] as { id?: string } | undefined)?.id;
        if (agentId) {
          await db.query(
            `INSERT INTO feed_items (id, agent_id, type, content, created_at)
             VALUES (?, ?, 'info', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
            [feedId, agentId, `결제 완료: ₩${tossData.amount}원 결제가 완료되었습니다`]
          );
        }
      } catch {
        // 피드 알림 실패는 무시 — 결제는 성공
      }

      res.json({ data: { success: true, message: '결제가 완료되었습니다', subscription_id: subscriptionId } });
    } catch (err: unknown) {
      // 결제 실패 로그 기록
      try {
        await db.query(
          `INSERT INTO payment_logs (id, user_id, subscription_id, payment_key, order_id, order_name, amount, status)
           VALUES (?, ?, NULL, ?, ?, ?, ?, 'failed')`,
          [paymentLogId, userId, paymentKey, orderId, PLANS[plan as PlanId]?.name ?? plan, amount]
        );
      } catch {
        // 로그 저장 실패는 무시
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      const axiosErr = err as { response?: { data?: { message?: string; code?: string } } };
      const tossMsg = axiosErr.response?.data?.message ?? errMsg;
      res.status(400).json({ error: `결제 승인 실패: ${tossMsg}` });
    }
  });

  // POST /api/payments/toss/billing/issue — 빌링키 발급
  router.post('/toss/billing/issue', async (req: Request, res: Response) => {
    const { authKey, customerKey } = req.body as {
      authKey?: string;
      customerKey?: string;
    };

    if (!authKey || !customerKey) {
      res.status(400).json({ error: 'authKey, customerKey가 필요합니다' });
      return;
    }

    const session = await getSessionUser(req);
    if (!session?.userId) {
      res.status(401).json({ error: '인증이 필요합니다' });
      return;
    }

    try {
      const tossRes = await axios.post<TossBillingIssueResponse>(
        `https://api.tosspayments.com/v1/billing/authorizations/${authKey}`,
        { customerKey },
        {
          headers: {
            Authorization: tossAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      const { billingKey } = tossRes.data;
      const db = getDb();
      const subscriptionId = generateId();

      // subscriptions에 billing_key 저장 (pending 상태로 생성)
      await db.query(
        `INSERT INTO subscriptions (id, user_id, plan, billing_key, status)
         VALUES (?, ?, 'personal', ?, 'pending')`,
        [subscriptionId, session.userId, billingKey]
      );

      res.json({ data: { success: true, billing_key: billingKey, subscription_id: subscriptionId } });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const tossMsg = axiosErr.response?.data?.message ?? (err instanceof Error ? err.message : String(err));
      res.status(400).json({ error: `빌링키 발급 실패: ${tossMsg}` });
    }
  });

  // POST /api/payments/toss/billing/pay — 빌링키로 결제
  router.post('/toss/billing/pay', async (req: Request, res: Response) => {
    const { customerKey, plan } = req.body as {
      customerKey?: string;
      plan?: string;
    };

    if (!customerKey || !plan) {
      res.status(400).json({ error: 'customerKey, plan이 필요합니다' });
      return;
    }

    if (!PLANS[plan as PlanId]) {
      res.status(400).json({ error: '유효하지 않은 플랜입니다' });
      return;
    }

    const session = await getSessionUser(req);
    if (!session?.userId) {
      res.status(401).json({ error: '인증이 필요합니다' });
      return;
    }

    const db = getDb();

    // DB에서 billing_key 조회
    const subResult = await db.query(
      `SELECT id, billing_key FROM subscriptions WHERE user_id = ? AND billing_key IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [session.userId]
    );

    if (!subResult.rows.length) {
      res.status(404).json({ error: '빌링키가 등록되지 않았습니다' });
      return;
    }

    const subRow = subResult.rows[0] as { id: string; billing_key: string };
    const billingKey = subRow.billing_key;
    const planInfo = PLANS[plan as PlanId];
    const orderId = `oomni-${generateId()}`;
    const paymentLogId = generateId();
    const periodEnd = daysFromNow(30);

    try {
      const tossRes = await axios.post<TossBillingPayResponse>(
        `https://api.tosspayments.com/v1/billing/${billingKey}`,
        {
          customerKey,
          amount: planInfo.price,
          orderId,
          orderName: `OOMNI ${planInfo.name} 플랜 월정액`,
        },
        {
          headers: {
            Authorization: tossAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      const tossData = tossRes.data;

      // payment_logs INSERT (done)
      await db.query(
        `INSERT INTO payment_logs (id, user_id, subscription_id, payment_key, order_id, order_name, amount, status, method, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'done', ?, ?)`,
        [
          paymentLogId,
          session.userId,
          subRow.id,
          tossData.paymentKey,
          tossData.orderId,
          tossData.orderName,
          tossData.amount,
          tossData.method ?? null,
          tossData.approvedAt ?? new Date().toISOString(),
        ]
      );

      // subscription 업데이트
      await db.query(
        `UPDATE subscriptions SET plan = ?, status = 'active', current_period_start = datetime('now'), current_period_end = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [plan, periodEnd, subRow.id]
      );

      // users 테이블 license_valid_until 업데이트
      await db.query(
        `UPDATE users SET license_valid_until = ? WHERE id = ? OR email = ?`,
        [periodEnd, session.userId, session.userId]
      );

      // 정기결제 성공 피드 알림 (실패해도 결제 성공으로 처리)
      try {
        const feedId = generateId();
        const agentResult = await db.query(
          `SELECT a.id FROM agents a
           JOIN missions m ON a.mission_id = m.id
           WHERE m.user_id = ? OR a.id IN (SELECT id FROM agents LIMIT 1)
           LIMIT 1`,
          [session.userId]
        ).catch(() => ({ rows: [] }));
        const agentId = (agentResult.rows[0] as { id?: string } | undefined)?.id;
        if (agentId) {
          await db.query(
            `INSERT INTO feed_items (id, agent_id, type, content, created_at)
             VALUES (?, ?, 'info', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
            [feedId, agentId, `결제 완료: ₩${tossData.amount}원 결제가 완료되었습니다`]
          );
        }
      } catch {
        // 피드 알림 실패는 무시 — 결제는 성공
      }

      res.json({ data: { success: true, message: '정기결제가 완료되었습니다' } });
    } catch (err: unknown) {
      try {
        await db.query(
          `INSERT INTO payment_logs (id, user_id, subscription_id, payment_key, order_id, order_name, amount, status)
           VALUES (?, ?, ?, NULL, ?, ?, ?, 'failed')`,
          [paymentLogId, session.userId, subRow.id, orderId, `OOMNI ${planInfo.name} 플랜 월정액`, planInfo.price]
        );
      } catch {
        // 로그 저장 실패는 무시
      }

      const axiosErr = err as { response?: { data?: { message?: string } } };
      const tossMsg = axiosErr.response?.data?.message ?? (err instanceof Error ? err.message : String(err));
      res.status(400).json({ error: `빌링 결제 실패: ${tossMsg}` });
    }
  });

  // GET /api/payments/subscription — 현재 구독 상태 조회
  router.get('/subscription', async (req: Request, res: Response) => {
    const session = await getSessionUser(req);
    if (!session?.userId) {
      res.status(401).json({ error: '인증이 필요합니다' });
      return;
    }

    const db = getDb();

    // 활성 구독 조회
    const subResult = await db.query(
      `SELECT plan, status, current_period_end, cancel_at_period_end
       FROM subscriptions
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [session.userId]
    );

    // users 테이블 조회
    const userResult = await db.query(
      `SELECT license_valid_until, display_name, email FROM users WHERE id = ? OR email = ? LIMIT 1`,
      [session.userId, session.userId]
    );

    const sub = subResult.rows[0] as {
      plan: string;
      status: string;
      current_period_end: string | null;
      cancel_at_period_end: number;
    } | undefined;

    const user = userResult.rows[0] as {
      license_valid_until: string | null;
      display_name: string | null;
      email: string | null;
    } | undefined;

    res.json({
      data: {
        plan: sub?.plan ?? 'free',
        status: sub?.status ?? 'active',
        current_period_end: sub?.current_period_end ?? null,
        cancel_at_period_end: !!(sub?.cancel_at_period_end),
        license_valid_until: user?.license_valid_until ?? null,
        display_name: user?.display_name ?? null,
        email: user?.email ?? null,
      },
    });
  });

  // GET /api/payments/toss/success — Toss 결제 성공 리다이렉트 (브라우저 → 자동 confirm)
  router.get('/toss/success', async (req: Request, res: Response) => {
    const { paymentKey, orderId, amount, plan } = req.query as {
      paymentKey?: string; orderId?: string; amount?: string; plan?: string;
    };

    if (!paymentKey || !orderId || !amount) {
      res.status(400).send(`<html><body style="font-family:sans-serif;background:#0F0F10;color:#fff;text-align:center;padding:60px">
        <h2 style="color:#e05252">결제 오류</h2><p>필수 파라미터가 누락되었습니다.</p>
        <p style="color:#888">앱으로 돌아가세요.</p></body></html>`);
      return;
    }

    // orderId에서 plan 추출 (OOMNI-{timestamp}-{PLAN} 형식)
    const planFromOrder = plan ?? (orderId.split('-').pop() ?? 'personal').toLowerCase();
    const resolvedPlan = PLANS[planFromOrder as PlanId] ? planFromOrder : 'personal';
    const numAmount = parseInt(amount, 10);

    try {
      const tossRes = await axios.post<TossConfirmResponse>(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey, orderId, amount: numAmount },
        { headers: { Authorization: tossAuthHeader(), 'Content-Type': 'application/json' } }
      );

      const tossData = tossRes.data;
      const db = getDb();
      const subscriptionId = generateId();
      const paymentLogId = generateId();
      const periodEnd = daysFromNow(30);

      // orderId로 userId 추론 (세션 없는 외부 브라우저 콜백)
      const userId = orderId;

      await db.query(
        `INSERT INTO payment_logs (id, user_id, subscription_id, payment_key, order_id, order_name, amount, status, method, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'done', ?, ?)`,
        [paymentLogId, userId, subscriptionId, tossData.paymentKey, tossData.orderId,
         tossData.orderName ?? `OOMNI ${resolvedPlan} 플랜`, tossData.amount,
         tossData.method ?? null, tossData.approvedAt ?? new Date().toISOString()]
      );
      await db.query(
        `INSERT INTO subscriptions (id, user_id, plan, status, current_period_start, current_period_end)
         VALUES (?, ?, ?, 'active', datetime('now'), ?)`,
        [subscriptionId, userId, resolvedPlan, periodEnd]
      );
      await db.query(
        `UPDATE users SET license_valid_until = ? WHERE id = ? OR email = ?`,
        [periodEnd, userId, userId]
      );

      res.send(`<html><body style="font-family:sans-serif;background:#0F0F10;color:#fff;text-align:center;padding:60px">
        <h2 style="color:#D97B5B">결제 완료!</h2>
        <p style="font-size:18px">OOMNI ${PLANS[resolvedPlan as PlanId]?.name ?? resolvedPlan} 플랜이 활성화되었습니다.</p>
        <p style="color:#888;margin-top:24px">이 창을 닫고 앱으로 돌아가세요.</p>
        <script>setTimeout(() => window.close(), 4000)</script>
      </body></html>`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const tossMsg = axiosErr.response?.data?.message ?? (err instanceof Error ? err.message : '결제 확인 실패');
      res.status(400).send(`<html><body style="font-family:sans-serif;background:#0F0F10;color:#fff;text-align:center;padding:60px">
        <h2 style="color:#e05252">결제 확인 실패</h2><p>${tossMsg}</p>
        <p style="color:#888">앱으로 돌아가서 다시 시도해주세요.</p></body></html>`);
    }
  });

  // GET /api/payments/toss/fail — Toss 결제 실패 리다이렉트
  router.get('/toss/fail', (req: Request, res: Response) => {
    const { message, code } = req.query as { message?: string; code?: string };
    res.send(`<html><body style="font-family:sans-serif;background:#0F0F10;color:#fff;text-align:center;padding:60px">
      <h2 style="color:#e05252">결제 실패</h2>
      <p>${message ?? '결제가 취소되었거나 실패했습니다.'} ${code ? `(${code})` : ''}</p>
      <p style="color:#888;margin-top:24px">이 창을 닫고 앱에서 다시 시도해주세요.</p>
      <script>setTimeout(() => window.close(), 4000)</script>
    </body></html>`);
  });

  // POST /api/payments/toss/webhook — Toss 웹훅 (결제 상태 변경 알림)
  router.post('/toss/webhook', async (req: Request, res: Response) => {
    // Toss는 X-TOSS-SIGNATURE 헤더로 서명 전달 (선택적 검증)
    const { eventType, data } = req.body as {
      eventType?: string;
      data?: { paymentKey?: string; orderId?: string; status?: string; amount?: number };
    };

    if (!eventType || !data) {
      res.status(400).json({ error: 'invalid webhook payload' });
      return;
    }

    try {
      const db = getDb();
      if (eventType === 'PAYMENT_STATUS_CHANGED' && data.status === 'DONE' && data.paymentKey) {
        // 이미 처리된 paymentKey인지 확인
        const existing = await db.query(
          `SELECT id FROM payment_logs WHERE payment_key = ?`, [data.paymentKey]
        );
        if (!(existing.rows as unknown[]).length) {
          // 새 결제 로그 기록
          const logId = generateId();
          await db.query(
            `INSERT INTO payment_logs (id, user_id, payment_key, order_id, order_name, amount, status)
             VALUES (?, 'webhook', ?, ?, 'Toss 웹훅', ?, 'done')`,
            [logId, data.paymentKey, data.orderId ?? '', data.amount ?? 0]
          );
        }
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'webhook processing failed' });
    }
  });

  // POST /api/payments/subscription/cancel — 구독 취소
  // GET /api/payments/quota — 무료 플랜 사용량 조회
  // 월간 token_usage 행 수로 실행 횟수를 추정, 유료 구독이면 무제한 반환
  router.get('/quota', async (req: Request, res: Response) => {
    const FREE_MONTHLY_LIMIT = 10;
    const db = getDb();

    // 유저 구독 확인
    const session = await getSessionUser(req);
    if (session?.userId) {
      const subResult = await db.query(
        `SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [session.userId]
      );
      const plan = (subResult.rows[0] as { plan?: string } | undefined)?.plan ?? 'free';
      if (plan !== 'free') {
        res.json({ data: { plan, runCount: 0, limit: -1, exceeded: false, remaining: -1 } });
        return;
      }
    }

    // 이번 달 실행 수 (token_usage 기준)
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM token_usage
       WHERE created_at >= strftime('%Y-%m-01', 'now')`,
      []
    );
    const runCount = (countResult.rows[0] as { count?: number } | undefined)?.count ?? 0;
    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - runCount);
    res.json({
      data: {
        plan: 'free',
        runCount,
        limit: FREE_MONTHLY_LIMIT,
        exceeded: runCount >= FREE_MONTHLY_LIMIT,
        remaining,
      },
    });
  });

  router.post('/subscription/cancel', async (req: Request, res: Response) => {
    const session = await getSessionUser(req);
    if (!session?.userId) {
      res.status(401).json({ error: '인증이 필요합니다' });
      return;
    }

    const db = getDb();

    await db.query(
      `UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = datetime('now')
       WHERE user_id = ? AND status = 'active'`,
      [session.userId]
    );

    res.json({ data: { success: true, message: '구독이 기간 만료 후 취소됩니다' } });
  });

  return router;
}
