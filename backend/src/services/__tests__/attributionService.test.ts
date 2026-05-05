import { getAttributionReport } from '../attributionService';

// ── 인메모리 DB 스텁 ──────────────────────────────────────────────────────────
function makeDb(contentRows: unknown[], timeRows: unknown[], leadRows: unknown[]) {
  let callCount = 0;
  return {
    query: async (_sql: string, _params?: unknown[]) => {
      const call = callCount++;
      if (call === 0) return { rows: contentRows };
      if (call === 1) return { rows: timeRows };
      return { rows: leadRows };
    },
  };
}

describe('attributionService', () => {
  const MID = 'mission-001';

  test('빈 미션 — 0-error, topChannel=""', async () => {
    const db = makeDb([], [], []);
    const report = await getAttributionReport(db, MID);

    expect(report.channels).toHaveLength(0);
    expect(report.totalLeads).toBe(0);
    expect(report.totalContent).toBe(0);
    expect(report.topChannel).toBe('');
    expect(report.kpis.conversionRate).toBe(0);
    expect(report.kpis.engagementRate).toBe(0);
  });

  test('attribution 합계가 100이어야 한다 (반올림 보정)', async () => {
    // 3채널 × 가중치가 균등하지 않은 경우
    const contentRows = [
      { channel: 'x', cnt: 3, published: 2 },
      { channel: 'instagram', cnt: 5, published: 4 },
      { channel: 'youtube', cnt: 2, published: 1 },
    ];
    const timeRows = [
      { channel: 'instagram' }, { channel: 'instagram' }, { channel: 'instagram' },
      { channel: 'x' }, { channel: 'x' },
      { channel: 'youtube' },
    ];
    const leadRows = [
      { tier: 'hot', score: 80 },
      { tier: 'nurture', score: 50 },
      { tier: 'cold', score: 20 },
    ];

    const db = makeDb(contentRows, timeRows, leadRows);
    const report = await getAttributionReport(db, MID);

    const sum = report.channels.reduce((s, c) => s + c.attributionPct, 0);
    expect(sum).toBe(100);
  });

  test('시간 감쇠 — 최신 채널이 가장 높은 기여도', async () => {
    const contentRows = [
      { channel: 'new_ch', cnt: 1, published: 1 },
      { channel: 'old_ch', cnt: 1, published: 1 },
    ];
    // timeRows: new_ch가 먼저 (최신), old_ch가 나중 (오래됨)
    const timeRows = [{ channel: 'new_ch' }, { channel: 'old_ch' }];
    const leadRows: unknown[] = [];

    const db = makeDb(contentRows, timeRows, leadRows);
    const report = await getAttributionReport(db, MID);

    const newCh = report.channels.find(c => c.channel === 'new_ch')!;
    const oldCh = report.channels.find(c => c.channel === 'old_ch')!;
    expect(newCh.attributionPct).toBeGreaterThan(oldCh.attributionPct);
  });

  test('전환율 — hot 2 / total 4 → 50%', async () => {
    const contentRows = [{ channel: 'instagram', cnt: 2, published: 2 }];
    const timeRows = [{ channel: 'instagram' }, { channel: 'instagram' }];
    const leadRows = [
      { tier: 'hot', score: 90 },
      { tier: 'hot', score: 85 },
      { tier: 'cold', score: 10 },
      { tier: 'cold', score: 15 },
    ];

    const db = makeDb(contentRows, timeRows, leadRows);
    const report = await getAttributionReport(db, MID);

    expect(report.kpis.conversionRate).toBe(50);
    expect(report.kpis.hotLeads).toBe(2);
  });
});
