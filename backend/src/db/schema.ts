export const TABLES = [
  'missions',
  'agents',
  'heartbeat_runs',
  'issues',
  'feed_items',
  'cost_events',
  'integrations',
  'schedules',
  'research_items',
  'token_usage',
  'sessions',
  'subscriptions',
  'payment_logs',
] as const;

// SQLite 스키마 (PostgreSQL 호환 제거: TIMESTAMPTZ→TEXT, BOOLEAN→INTEGER, JSONB→TEXT, NUMERIC→REAL)
export const SCHEMA_SQL = `
-- 미션 (프로젝트)
CREATE TABLE IF NOT EXISTS missions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 봇 에이전트
CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  mission_id    TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN (
                  'research','build','design','content','growth','ops','integration','n8n','ceo'
                )),
  schedule      TEXT NOT NULL DEFAULT 'manual' CHECK (schedule IN ('manual','hourly','daily','weekly')),
  system_prompt TEXT NOT NULL DEFAULT '',
  budget_cents  INTEGER NOT NULL DEFAULT 500 CHECK (budget_cents >= 0),
  is_active     INTEGER NOT NULL DEFAULT 1,
  reports_to    TEXT REFERENCES agents(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 하트비트 실행 기록
CREATE TABLE IF NOT EXISTS heartbeat_runs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  session_id    TEXT,
  output        TEXT,
  error         TEXT,
  tokens_input  INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_agent_id ON heartbeat_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_status ON heartbeat_runs(status);

-- 이슈/태스크
CREATE TABLE IF NOT EXISTS issues (
  id          TEXT PRIMARY KEY,
  mission_id  TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  agent_id    TEXT REFERENCES agents(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  parent_id   TEXT REFERENCES issues(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 실시간 피드 (WebSocket으로 전송)
CREATE TABLE IF NOT EXISTS feed_items (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_id           TEXT REFERENCES heartbeat_runs(id) ON DELETE SET NULL,
  type             TEXT NOT NULL CHECK (type IN ('info','result','approval','error')),
  content          TEXT NOT NULL,
  action_label     TEXT,
  action_data      TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  approved_at      TEXT,
  rejected_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_feed_items_agent_id ON feed_items(agent_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_requires_approval ON feed_items(requires_approval) WHERE requires_approval = 1;

-- 비용 추적
CREATE TABLE IF NOT EXISTS cost_events (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_id        TEXT NOT NULL,
  tokens_input  INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cost_events_agent_id ON cost_events(agent_id);

-- 외부 서비스 연동
-- credentials는 AES-256-GCM 암호화된 blob으로 저장
CREATE TABLE IF NOT EXISTS integrations (
  id          TEXT PRIMARY KEY,
  mission_id  TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN (
                'slack','notion','gmail','stripe','github','google_sheets',
                'n8n','hubspot','linear','figma',
                'perplexity','openai','telegram','discord',
                'posthog','ga4','polar','toss'
              )),
  label       TEXT NOT NULL DEFAULT '',
  credentials TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(mission_id, provider)
);

-- 스케줄 (챗봇 자동 실행 트리거)
CREATE TABLE IF NOT EXISTS schedules (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mission_id    TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT '',
  trigger_type  TEXT NOT NULL DEFAULT 'interval' CHECK (trigger_type IN ('interval','cron','webhook','bot_complete')),
  trigger_value TEXT NOT NULL DEFAULT '',
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_run_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_schedules_agent_id ON schedules(agent_id);

-- 리서치 스튜디오 아이템
CREATE TABLE IF NOT EXISTS research_items (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'url',
  source_url TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  tags TEXT DEFAULT '[]',
  signal_score INTEGER DEFAULT 0,
  filter_decision TEXT DEFAULT 'pending',
  next_action TEXT,
  converted_output TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_research_items_mission_id ON research_items(mission_id);
CREATE INDEX IF NOT EXISTS idx_research_items_filter_decision ON research_items(filter_decision);

-- 토큰 사용량 추적 (봇별 실행별 상세 기록)
CREATE TABLE IF NOT EXISTS token_usage (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  run_id TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  model TEXT DEFAULT 'claude-3-5-sonnet',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_id ON token_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_mission_id ON token_usage(mission_id);

-- 세션 토큰 영속화
CREATE TABLE IF NOT EXISTS sessions (
  token        TEXT PRIMARY KEY,
  user_id      TEXT,
  login_method TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  expires_at   TEXT,
  last_used_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 사용자 (라이선스/역할 관리)
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  license_key TEXT,
  license_valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

// ── DB 마이그레이션 시스템 ──────────────────────────────
import Database from 'better-sqlite3';

interface Migration {
  version: number;
  description: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'sessions 테이블 생성',
    sql: `CREATE TABLE IF NOT EXISTS sessions (
      token        TEXT PRIMARY KEY,
      user_id      TEXT,
      login_method TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      expires_at   TEXT,
      last_used_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);`,
  },
  {
    version: 2,
    description: 'users 테이블 생성 (라이선스/역할 관리)',
    sql: `CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      license_key TEXT,
      license_valid_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  },
  {
    version: 3,
    description: 'subscriptions + payment_logs 테이블 생성',
    sql: `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','personal','team')),
      billing_key TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired','pending')),
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payment_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT REFERENCES subscriptions(id),
      payment_key TEXT,
      order_id TEXT NOT NULL,
      order_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed','cancelled')),
      method TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON payment_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);
  `
  },
  {
    version: 4,
    description: 'users 테이블 display_name 컬럼 추가',
    sql: `ALTER TABLE users ADD COLUMN display_name TEXT;`
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      description TEXT,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );

  const applied = (
    db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  ).map((r) => r.version);

  for (const m of MIGRATIONS) {
    if (!applied.includes(m.version)) {
      db.exec(m.sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, datetime("now"))'
      ).run(m.version, m.description);
      console.log(`[DB] 마이그레이션 v${m.version} 적용: ${m.description}`);
    }
  }
}
