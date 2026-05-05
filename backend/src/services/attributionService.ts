/**
 * attributionService.ts — AI Attribution Engine v1
 *
 * Multi-Touch Attribution (시간 감쇠 모델):
 *   최근 콘텐츠에 높은 가중치 → 채널별 기여도 산출
 *
 * 7 KPIs:
 *   1. totalReach     — 발행된 콘텐츠 수
 *   2. totalLeads     — 수집된 리드 수
 *   3. hotLeads       — 전환 리드 (Hot tier)
 *   4. conversionRate — hot / total × 100
 *   5. avgScore       — 리드 평균 점수
 *   6. engagementRate — 리드 / 콘텐츠 비율
 *   7. topChannel     — 가장 높은 attribution 채널
 */

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export interface ChannelAttribution {
  channel:         string
  contentCount:    number
  publishCount:    number
  leadsAttr:       number   // attribution-weighted lead count
  hotAttr:         number
  attributionPct:  number   // 0-100
  engagementRate:  number
}

export interface AttributionReport {
  channels:    ChannelAttribution[]
  totalLeads:  number
  totalContent: number
  topChannel:  string
  kpis: {
    totalReach:      number   // published content count
    totalLeads:      number
    hotLeads:        number
    conversionRate:  number   // %
    avgScore:        number
    engagementRate:  number   // leads per content
    topChannel:      string
  }
}

export async function getAttributionReport(db: Db, missionId: string): Promise<AttributionReport> {
  // 3개 쿼리 병렬 실행
  const [{ rows: contentRows }, { rows: timeRows }, { rows: leadRows }] = await Promise.all([
    db.query(
      `SELECT channel,
         COUNT(*) AS cnt,
         COUNT(CASE WHEN status='posted' THEN 1 END) AS published
       FROM growth_content WHERE mission_id = $1 GROUP BY channel`,
      [missionId],
    ),
    // LIMIT 200 — 오래된 콘텐츠는 감쇠 가중치 근사 0이라 무의미
    db.query(
      `SELECT channel FROM growth_content WHERE mission_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [missionId],
    ),
    db.query(
      `SELECT tier, score FROM growth_leads WHERE mission_id = $1`,
      [missionId],
    ),
  ]);

  type ContentRow = { channel: string; cnt: number; published: number };
  type LeadRow    = { tier: string; score: number };

  const contents = contentRows as ContentRow[];
  const leads    = leadRows    as LeadRow[];
  const timeList = timeRows    as { channel: string }[];

  const totalLeads = leads.length;
  const hotLeads   = leads.filter(l => l.tier === 'hot').length;
  const avgScore   = totalLeads > 0
    ? Math.round(leads.reduce((s, l) => s + l.score, 0) / totalLeads)
    : 0;

  // ── 시간 감쇠 가중치 ────────────────────────────────────────────────────
  // w_i = 1 / (1 + i × 0.15)  →  최신=1.0, 오래될수록 감소
  const channelWeight: Record<string, number> = {};
  timeList.forEach((row, i) => {
    const w = 1 / (1 + i * 0.15);
    channelWeight[row.channel] = (channelWeight[row.channel] ?? 0) + w;
  });
  const totalW = Object.values(channelWeight).reduce((s, w) => s + w, 0) || 1;

  // ── 채널별 attribution 구성 ─────────────────────────────────────────────
  const channelMap: Record<string, ChannelAttribution> = {};
  for (const c of contents) {
    const pct = Math.round((channelWeight[c.channel] ?? 0) / totalW * 100);
    channelMap[c.channel] = {
      channel:        c.channel,
      contentCount:   Number(c.cnt),
      publishCount:   Number(c.published),
      leadsAttr:      Math.round(totalLeads * pct / 100),
      hotAttr:        Math.round(hotLeads   * pct / 100),
      attributionPct: pct,
      engagementRate: Number(c.cnt) > 0
        ? Math.round(totalLeads * pct / 100 / Number(c.cnt) * 100) / 100
        : 0,
    };
  }

  const channels = Object.values(channelMap).sort((a, b) => b.attributionPct - a.attributionPct);

  // 반올림으로 합계가 100이 되지 않을 수 있음 → 마지막 채널로 보정
  if (channels.length > 1) {
    const sumExLast = channels.slice(0, -1).reduce((s, c) => s + c.attributionPct, 0);
    channels[channels.length - 1].attributionPct = Math.max(0, 100 - sumExLast);
  }

  const topChannel = channels[0]?.channel ?? '';
  const totalContent = contents.reduce((s, c) => s + Number(c.cnt), 0);
  const totalPublished = contents.reduce((s, c) => s + Number(c.published), 0);

  return {
    channels,
    totalLeads,
    totalContent,
    topChannel,
    kpis: {
      totalReach:     totalPublished,
      totalLeads,
      hotLeads,
      conversionRate: totalLeads > 0 ? Math.round(hotLeads / totalLeads * 100) : 0,
      avgScore,
      engagementRate: totalContent > 0 ? Math.round(totalLeads / totalContent * 100) / 100 : 0,
      topChannel,
    },
  };
}
