/**
 * cdpTriggerService.ts — CDP 동적 루프 트리거
 * v5.2.0
 *
 * CDP 세그먼트 변화 감지 → Growth Bot 자동 트리거
 *
 * 트리거 조건:
 *   1. churn_risk 세그먼트 인원 임계값 초과 (기본: 5명)
 *   2. 리드 점수 70+ 달성 (hot tier 전환)
 *   3. 특정 세그먼트 인원 20%+ 증가
 *
 * 30초마다 폴링 or 이벤트 기반 감지
 */
import { logger } from '../logger'
import { getLeadStats, scoreLead } from './leadScoringService'

type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
}

export interface TriggerConfig {
  enabled: boolean
  churnRiskThreshold: number   // 이탈 위험 프로필 수 임계값 (기본 5)
  hotLeadThreshold: number     // hot lead 달성 즉시 트리거
  segmentGrowthRate: number    // 세그먼트 증가율 임계값 (0.2 = 20%)
  pollingIntervalMs: number    // 폴링 주기 (기본 30초)
}

const DEFAULT_CONFIG: TriggerConfig = {
  enabled: false,
  churnRiskThreshold: 5,
  hotLeadThreshold: 70,
  segmentGrowthRate: 0.2,
  pollingIntervalMs: 30_000,
}

// 미션별 트리거 타이머 맵
const triggerTimers = new Map<string, ReturnType<typeof setInterval>>()

// 미션별 이전 스냅샷 (증가율 계산용)
const snapshots = new Map<string, { churnCount: number; hotCount: number; checkedAt: number }>()

/**
 * 특정 미션의 CDP 트리거 시작
 */
export function startCdpTrigger(
  db: DbClient,
  missionId: string,
  config: Partial<TriggerConfig> = {},
  onTrigger: (missionId: string, reason: string) => Promise<void>,
): void {
  const cfg: TriggerConfig = { ...DEFAULT_CONFIG, ...config }
  if (!cfg.enabled) return

  if (triggerTimers.has(missionId)) {
    stopCdpTrigger(missionId)
  }

  logger.info(`[cdpTrigger] 시작 mission=${missionId} interval=${cfg.pollingIntervalMs}ms`)

  const timer = setInterval(async () => {
    try {
      await checkAndTrigger(db, missionId, cfg, onTrigger)
    } catch (e) {
      logger.error(`[cdpTrigger] 오류 mission=${missionId}:`, e)
    }
  }, cfg.pollingIntervalMs)

  triggerTimers.set(missionId, timer)
}

/**
 * 트리거 중지
 */
export function stopCdpTrigger(missionId: string): void {
  const timer = triggerTimers.get(missionId)
  if (timer) {
    clearInterval(timer)
    triggerTimers.delete(missionId)
    logger.info(`[cdpTrigger] 중지 mission=${missionId}`)
  }
}

/**
 * 모든 트리거 중지 (앱 종료 시)
 */
export function stopAllTriggers(): void {
  for (const [missionId] of triggerTimers) {
    stopCdpTrigger(missionId)
  }
}

// ── 내부 감지 로직 ────────────────────────────────────────────────────────

async function checkAndTrigger(
  db: DbClient,
  missionId: string,
  cfg: TriggerConfig,
  onTrigger: (missionId: string, reason: string) => Promise<void>,
): Promise<void> {
  // 1. CDP 이탈 위험 세그먼트 인원 조회
  const { rows: churnRows } = await db.query(
    `SELECT COUNT(*) as cnt FROM cdp_segment_history
     WHERE mission_id = $1 AND to_tier = 'low'
     AND created_at > datetime('now', '-1 hour')`,
    [missionId],
  )
  const churnCount = Number((churnRows[0] as Record<string, unknown>)?.cnt ?? 0)

  // 2. Hot lead 수 조회
  const stats = await getLeadStats(db, missionId)

  const prev = snapshots.get(missionId)
  const now = Date.now()

  // 조건 1: 이탈 위험 임계값 초과
  if (churnCount >= cfg.churnRiskThreshold) {
    const reason = `이탈 위험 세그먼트 ${churnCount}명 (임계값: ${cfg.churnRiskThreshold})`
    logger.info(`[cdpTrigger] 트리거 발동 - ${reason}`)
    await onTrigger(missionId, reason)
    // 리드 시그널 기록
    await scoreLead(db, missionId, null, 'repeat_browse', 20)
    snapshots.set(missionId, { churnCount, hotCount: stats.hot, checkedAt: now })
    return
  }

  // 조건 2: Hot lead 증가
  if (prev && stats.hot > prev.hotCount) {
    const reason = `Hot lead ${prev.hotCount} → ${stats.hot} 증가`
    logger.info(`[cdpTrigger] 트리거 발동 - ${reason}`)
    await onTrigger(missionId, reason)
  }

  // 조건 3: CDP 이탈 위험 인원 20%+ 증가 (이전 스냅샷 대비)
  if (prev && prev.churnCount > 0) {
    const growthRate = (churnCount - prev.churnCount) / prev.churnCount
    if (growthRate >= cfg.segmentGrowthRate) {
      const reason = `이탈 위험 세그먼트 ${Math.round(growthRate * 100)}% 증가`
      logger.info(`[cdpTrigger] 트리거 발동 - ${reason}`)
      await onTrigger(missionId, reason)
    }
  }

  snapshots.set(missionId, { churnCount, hotCount: stats.hot, checkedAt: now })
}

/**
 * 수동 트리거 (테스트 또는 API 호출)
 */
export async function manualTrigger(
  _db: DbClient,
  missionId: string,
  reason = '수동 트리거',
  onTrigger: (missionId: string, reason: string) => Promise<void>,
): Promise<void> {
  logger.info(`[cdpTrigger] 수동 트리거 mission=${missionId} reason=${reason}`)
  await onTrigger(missionId, reason)
}

/**
 * 현재 활성 트리거 목록
 */
export function getActiveTriggers(): string[] {
  return Array.from(triggerTimers.keys())
}
