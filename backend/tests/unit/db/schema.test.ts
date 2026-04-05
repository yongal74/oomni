/**
 * TDD: DB 스키마 검증
 */
import { SCHEMA_SQL, TABLES } from '../../../src/db/schema';

describe('DB Schema', () => {
  test('10개 테이블이 정의되어 있다', () => {
    expect(TABLES).toHaveLength(10);
    expect(TABLES).toEqual(expect.arrayContaining([
      'missions', 'agents', 'heartbeat_runs',
      'issues', 'feed_items', 'cost_events', 'integrations', 'schedules',
      'research_items', 'token_usage'
    ]));
  });

  test.each([
    'missions', 'agents', 'heartbeat_runs',
    'issues', 'feed_items', 'cost_events', 'integrations', 'schedules'
  ])('CREATE TABLE IF NOT EXISTS %s 포함', (table) => {
    expect(SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  });

  test('agents 테이블에 필수 컬럼이 있다', () => {
    const required = ['role', 'schedule', 'system_prompt', 'budget_cents', 'is_active'];
    required.forEach(col => expect(SCHEMA_SQL).toContain(col));
  });

  test('integrations 테이블에 provider, credentials 컬럼이 있다', () => {
    expect(SCHEMA_SQL).toContain('provider');
    expect(SCHEMA_SQL).toContain('credentials'); // encrypted blob
  });

  test('integrations에 n8n provider 타입이 enum에 포함된다', () => {
    expect(SCHEMA_SQL).toContain("'n8n'");
  });

  test('cost_events에 tokens, cost_usd 컬럼이 있다', () => {
    expect(SCHEMA_SQL).toContain('tokens_input');
    expect(SCHEMA_SQL).toContain('tokens_output');
    expect(SCHEMA_SQL).toContain('cost_usd');
  });

  test('feed_items에 requires_approval, approved_at 컬럼이 있다', () => {
    expect(SCHEMA_SQL).toContain('requires_approval');
    expect(SCHEMA_SQL).toContain('approved_at');
  });

  test('heartbeat_runs에 session_id, output, status 컬럼이 있다', () => {
    expect(SCHEMA_SQL).toContain('session_id');
    expect(SCHEMA_SQL).toContain('output');
    expect(SCHEMA_SQL).toContain('status');
  });
});
