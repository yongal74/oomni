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
      'research','build','design','content','growth','ops','ceo',
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
    primary_color TEXT,
    bg_color TEXT,
    surface_color TEXT,
    text_color TEXT,
    muted_color TEXT,
    accent_color TEXT,
    font_family TEXT,
    border_radius TEXT,
    style_voice TEXT,
    updated_at TEXT,
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

  CREATE TABLE IF NOT EXISTS research_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'rss' CHECK(type IN ('rss','youtube','x','special')),
    category TEXT NOT NULL DEFAULT 'tech',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_research_sources_active ON research_sources(is_active);

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

  -- ── v5.0.1 Mission Board ─────────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#6366f1',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    layer TEXT NOT NULL DEFAULT 'build'
      CHECK(layer IN ('build','frontend','backend','infra','content','research','design','marketing','ops')),
    engine TEXT NOT NULL DEFAULT 'claude_code'
      CHECK(engine IN ('claude_code','codex','claude_design','research','growth','ops','chat')),
    priority TEXT NOT NULL DEFAULT 'P1' CHECK(priority IN ('P0','P1','P2')),
    status TEXT NOT NULL DEFAULT 'todo'
      CHECK(status IN ('todo','in_progress','review','done')),
    due_date TEXT,
    estimated_hours REAL,
    recipe_id TEXT,
    requires_approval INTEGER NOT NULL DEFAULT 0,
    checkout_lock TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_blockers (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    blocker_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    engine TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL CHECK(status IN ('success','failed','cancelled')),
    output TEXT,
    file_paths TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    content TEXT NOT NULL,
    is_builtin INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── v5.0.1 Growth Studio ─────────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS growth_content (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK(channel IN ('x','instagram','youtube','linkedin','blog','tiktok','naver_blog')),
    tone TEXT DEFAULT 'authority' CHECK(tone IN ('humor','authority','empathy','contrarian','proof')),
    content_type TEXT DEFAULT 'text' CHECK(content_type IN ('text','image','video_script','video','thread')),
    content TEXT NOT NULL,
    image_url TEXT,
    video_url TEXT,
    segment TEXT CHECK(segment IN ('new_visitor','re_purchase','churn_risk','vip')),
    publish_channels TEXT,
    published_at TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK(status IN ('draft','pending_approval','approved','scheduled','posted')),
    scheduled_at TEXT,
    posted_at TEXT,
    performance_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── v5.2.0 Lead Generation ────────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS growth_leads (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    profile_id TEXT REFERENCES cdp_profiles(id) ON DELETE SET NULL,
    score INTEGER DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'cold' CHECK(tier IN ('hot','nurture','cold')),
    signals TEXT DEFAULT '[]',
    last_signal_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sns_connections (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK(platform IN ('instagram','youtube','tiktok','x','naver_blog','linkedin')),
    access_token TEXT,
    refresh_token TEXT,
    account_name TEXT,
    account_id TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── v5.0.1 CDP / ID-Graphing ─────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS cdp_profiles (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id TEXT,
    anonymous_id TEXT,
    email_hash TEXT,
    phone_hash TEXT,
    channel TEXT,
    sources TEXT DEFAULT '[]',
    traits TEXT DEFAULT '{}',
    event_count INTEGER DEFAULT 0,
    ltv REAL DEFAULT 0,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cdp_identity_index (
    hash TEXT NOT NULL,
    type TEXT NOT NULL,
    profile_id TEXT NOT NULL REFERENCES cdp_profiles(id) ON DELETE CASCADE,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    id_class TEXT NOT NULL DEFAULT 'deterministic'
      CHECK(id_class IN ('deterministic','probabilistic','behavioral')),
    confidence REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (hash)
  );

  -- 병합 히스토리 (그래프 시각화용)
  CREATE TABLE IF NOT EXISTS cdp_merge_log (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    winner_id TEXT NOT NULL,
    loser_id TEXT NOT NULL,
    merged_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 세그먼트 전이 히스토리 (동적 마케팅용)
  CREATE TABLE IF NOT EXISTS cdp_segment_history (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES cdp_profiles(id) ON DELETE CASCADE,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    from_tier TEXT,
    to_tier TEXT NOT NULL,
    trigger TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cdp_events (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    profile_id TEXT REFERENCES cdp_profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    properties TEXT DEFAULT '{}',
    channel TEXT,
    source TEXT,
    anonymous_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cdp_profiles_mission ON cdp_profiles(mission_id);
  CREATE INDEX IF NOT EXISTS idx_cdp_profiles_email ON cdp_profiles(email_hash);
  CREATE INDEX IF NOT EXISTS idx_cdp_profiles_user ON cdp_profiles(user_id);
  CREATE INDEX IF NOT EXISTS idx_cdp_index_mission ON cdp_identity_index(mission_id);
  CREATE INDEX IF NOT EXISTS idx_cdp_index_profile ON cdp_identity_index(profile_id);
  CREATE INDEX IF NOT EXISTS idx_cdp_events_profile ON cdp_events(profile_id);
  CREATE INDEX IF NOT EXISTS idx_cdp_events_mission ON cdp_events(mission_id);
  CREATE INDEX IF NOT EXISTS idx_cdp_merge_log_winner ON cdp_merge_log(winner_id);
  CREATE INDEX IF NOT EXISTS idx_cdp_segment_history_profile ON cdp_segment_history(profile_id);

  -- ── v5.0.1 Ops / AX Clinic ───────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS ax_clinic_log (
    id TEXT PRIMARY KEY,
    mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK(direction IN ('oomni_to_ax','ax_to_oomni')),
    workflow_name TEXT,
    payload TEXT,
    status TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── v5.0.1 인덱스 ────────────────────────────────────────────────────────

  CREATE INDEX IF NOT EXISTS idx_tasks_mission_status ON tasks(mission_id, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_engine ON tasks(engine);
  CREATE INDEX IF NOT EXISTS idx_task_results_task ON task_results(task_id);
  CREATE INDEX IF NOT EXISTS idx_growth_content_mission ON growth_content(mission_id, status);
  CREATE INDEX IF NOT EXISTS idx_growth_content_channel ON growth_content(channel);
  CREATE INDEX IF NOT EXISTS idx_growth_leads_mission ON growth_leads(mission_id);
  CREATE INDEX IF NOT EXISTS idx_growth_leads_tier ON growth_leads(tier);
  CREATE INDEX IF NOT EXISTS idx_sns_connections_mission ON sns_connections(mission_id);
  CREATE INDEX IF NOT EXISTS idx_projects_mission ON projects(mission_id);
`;

// v3.0 테이블 목록 (테스트 검증용)
export const TABLES = [
  'missions', 'agents', 'heartbeat_runs',
  'feed_items', 'cost_events', 'issues', 'schedules',
  'research_items', 'token_usage',
  'sessions', 'users', 'design_systems', 'integrations', 'design_outputs', 'build_todos',
  // v5.0.1
  'projects', 'tasks', 'task_blockers', 'task_results', 'recipes',
  'cdp_profiles', 'cdp_identity_index', 'cdp_events', 'cdp_merge_log', 'cdp_segment_history',
  'growth_content', 'growth_leads', 'sns_connections', 'ax_clinic_log',
];

// v2.x 감지용 — v2.x DB는 agents_v5 또는 agents_v6 잔재 혹은 subscriptions 테이블 보유
export const V2_DETECTION_TABLES = ['agents_v5', 'agents_v6', 'subscriptions', 'payment_logs'];
