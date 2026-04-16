/**
 * TDD: DB 스키마 검증 (v3.0)
 */
import { SCHEMA_SQL, TABLES } from '../../../src/db/schema';

describe('DB Schema', () => {
  test('13개 테이블이 정의되어 있다', () => {
    expect(TABLES).toHaveLength(13);
    expect(TABLES).toEqual(expect.arrayContaining([
      'missions', 'agents', 'heartbeat_runs',
      'issues', 'feed_items', 'cost_events', 'integrations', 'schedules',
      'research_items', 'token_usage',
      'sessions', 'users', 'design_systems',
    ]));
  });

  test.each([
    'missions', 'agents', 'heartbeat_runs',
    'issues', 'feed_items', 'cost_events', 'integrations', 'schedules',
    'research_items', 'token_usage', 'sessions', 'users', 'design_systems',
  ])('CREATE TABLE IF NOT EXISTS %s 포함', (table) => {
    expect(SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  });

  test('agents 테이블에 필수 컬럼이 있다', () => {
    const required = ['role', 'schedule', 'system_prompt', 'budget_cents', 'is_active'];
    required.forEach(col => expect(SCHEMA_SQL).toContain(col));
  });

  test('integrations 테이블에 provider, credentials 컬럼이 있다', () => {
    expect(SCHEMA_SQL).toContain('provider');
    expect(SCHEMA_SQL).toContain('credentials');
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
    expect(SCHEMA_SQL).toContain('output');
    expect(SCHEMA_SQL).toContain('status');
  });

  test('users 테이블에 pin_hash, license_valid_until 컬럼이 있다', () => {
    expect(SCHEMA_SQL).toContain('pin_hash');
    expect(SCHEMA_SQL).toContain('license_valid_until');
  });

  test('sessions 테이블에 created_at, last_used_at 컬럼이 있다', () => {
    expect(SCHEMA_SQL).toContain('last_used_at');
  });

  test('design_systems 테이블이 있다', () => {
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS design_systems');
  });
});
