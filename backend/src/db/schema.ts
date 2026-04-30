// backend/src/db/schema.ts
// v3.0 Clean Schema — migration 없음, 초기 생성 시 단일 실행

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN (
      'research','build','design','content','ops','ceo',
      'project_setup','env','security_audit','frontend','backend','infra'
    )),
    schedule TEXT,
    system_prompt TEXT,
    budget_cents INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    reports_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS heartbeat_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    task TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','skipped')),
    output TEXT,
    error TEXT,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS feed_items (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES heartbeat_runs(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info','result','approval','error')),
    content TEXT NOT NULL,
    requires_approval INTEGER NOT NULL DEFAULT 0,
    approved_at TEXT,
    rejected_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cost_events (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES heartbeat_runs(id) ON DELETE SET NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done','cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    parent_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    mission_id TEXT REFERENCES missions(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('interval','cron','webhook','bot_complete')),
    trigger_value TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS research_items (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    source_type TEXT,
    source_url TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    tags TEXT,
    filter_decision TEXT DEFAULT 'pending',
    signal_score REAL,
    outputs_json TEXT,
    converted_output TEXT,
    next_action TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
    run_id TEXT REFERENCES heartbeat_runs(id) ON DELETE SET NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    pin_hash TEXT,
    license_key TEXT,
    license_valid_until TEXT,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS design_systems (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE,
    preset TEXT,
    colors TEXT,
    fonts TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    credentials TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS setup_wizard_sessions (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    app_name    TEXT NOT NULL,
    app_type    TEXT NOT NULL CHECK(app_type IN ('web','mobile','desktop')),
    needs_ai    INTEGER NOT NULL DEFAULT 0,
    needs_payment INTEGER NOT NULL DEFAULT 0,
    market      TEXT NOT NULL CHECK(market IN ('domestic','global')),
    stack_json  TEXT,
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','running','completed','failed')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_agent_id ON heartbeat_runs(agent_id);
  CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_status ON heartbeat_runs(status);
  CREATE INDEX IF NOT EXISTS idx_feed_items_agent_id ON feed_items(agent_id);
  CREATE INDEX IF NOT EXISTS idx_feed_items_approval ON feed_items(requires_approval) WHERE requires_approval = 1;
  CREATE INDEX IF NOT EXISTS idx_cost_events_agent_id ON cost_events(agent_id);
  CREATE INDEX IF NOT EXISTS idx_research_items_mission_id ON research_items(mission_id);
  CREATE INDEX IF NOT EXISTS idx_research_items_filter ON research_items(filter_decision);
  CREATE INDEX IF NOT EXISTS idx_token_usage_agent_id ON token_usage(agent_id);
  CREATE INDEX IF NOT EXISTS idx_token_usage_mission_id ON token_usage(mission_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_design_systems_mission_id ON design_systems(mission_id);
  CREATE INDEX IF NOT EXISTS idx_schedules_agent_id ON schedules(agent_id);

  CREATE TABLE IF NOT EXISTS design_outputs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    mission_id TEXT REFERENCES missions(id) ON DELETE CASCADE,
    title TEXT,
    html_content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_design_outputs_agent_id ON design_outputs(agent_id);

  CREATE TABLE IF NOT EXISTS build_todos (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_build_todos_agent_id ON build_todos(agent_id);
`;

// v3.0 테이블 목록 (테스트 검증용)
export const TABLES = [
  'missions', 'agents', 'heartbeat_runs',
  'feed_items', 'cost_events', 'issues', 'schedules',
  'research_items', 'token_usage',
  'sessions', 'users', 'design_systems', 'integrations', 'design_outputs', 'build_todos',
];

// v2.x 감지용 — v2.x DB는 agents_v5 또는 agents_v6 잔재 혹은 subscriptions 테이블 보유
export const V2_DETECTION_TABLES = ['agents_v5', 'agents_v6', 'subscriptions', 'payment_logs'];
