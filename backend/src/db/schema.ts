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
  'design_systems',
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
                  'research','build','design','content','growth','ops','integration','ceo'
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
  outputs_json TEXT,
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

-- 디자인 시스템 (미션별 설정)
CREATE TABLE IF NOT EXISTS design_systems (
  id           TEXT PRIMARY KEY,
  mission_id   TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  preset       TEXT NOT NULL DEFAULT 'oomni',
  primary_color TEXT NOT NULL DEFAULT '#D4763B',
  bg_color     TEXT NOT NULL DEFAULT '#0F0F10',
  surface_color TEXT NOT NULL DEFAULT '#1A1A1C',
  text_color   TEXT NOT NULL DEFAULT '#E8E8E8',
  muted_color  TEXT NOT NULL DEFAULT '#888888',
  accent_color TEXT NOT NULL DEFAULT '#D4763B',
  font_family  TEXT NOT NULL DEFAULT 'Pretendard',
  border_radius TEXT NOT NULL DEFAULT '8px',
  style_voice  TEXT NOT NULL DEFAULT 'modern-dark',
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_design_systems_mission ON design_systems(mission_id);
`;

// ── DB 마이그레이션 시스템 ──────────────────────────────
import Database from 'better-sqlite3';

interface Migration {
  version: number;
  description: string;
  sql: string;
  /** 롤백 SQL (선택사항 — ALTER TABLE 등 역방향이 불가한 경우 생략 가능) */
  rollbackSql?: string;
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
    rollbackSql: `DROP TABLE IF EXISTS sessions;`,
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
    rollbackSql: `DROP TABLE IF EXISTS users;`,
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
  `,
    rollbackSql: `DROP TABLE IF EXISTS payment_logs; DROP TABLE IF EXISTS subscriptions;`,
  },
  {
    version: 4,
    description: 'users 테이블 display_name 컬럼 추가',
    sql: `ALTER TABLE users ADD COLUMN display_name TEXT;`,
    // SQLite는 ALTER TABLE DROP COLUMN을 지원하지 않으므로 rollbackSql 생략
  },
  {
    version: 5,
    description: 'research_items 테이블 outputs_json 컬럼 추가 (SCHEMA_SQL + columnPatch로 이동됨, no-op)',
    // SCHEMA_SQL에 이미 outputs_json이 포함됨 → 신규 설치 시 duplicate column 오류로 v6~v8 실행 불가
    // columnPatch가 기존 DB 처리, SCHEMA_SQL이 신규 DB 처리 → 이 마이그레이션은 no-op
    sql: `SELECT 1;`,
  },
  {
    version: 6,
    description: 'agents 테이블 role CHECK에 ceo 추가 (테이블 재생성)',
    // 근본 원인 방지: PRAGMA legacy_alter_table = ON 으로 RENAME 시 SQLite가
    // 다른 테이블(heartbeat_runs 등)의 FK 참조를 "agents_v5"로 자동 업데이트하는 것을 막음.
    // legacy_alter_table = OFF(기본) 상태로 RENAME 하면 child 테이블 DDL이 agents_v5를
    // 참조하게 되고, agents_v5 DROP 후 FK 참조가 깨져 "no such table: agents_v5" 발생.
    sql: `
      PRAGMA legacy_alter_table = ON;
      DROP TABLE IF EXISTS agents_v5;
      ALTER TABLE agents RENAME TO agents_v5;
      PRAGMA legacy_alter_table = OFF;
      CREATE TABLE agents (
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
      INSERT OR IGNORE INTO agents SELECT * FROM agents_v5;
      DROP TABLE IF EXISTS agents_v5;
    `,
  },
  {
    version: 7,
    description: 'agents 테이블 role CHECK에서 n8n 제거 — 기존 n8n 봇 삭제',
    sql: `
      DELETE FROM agents WHERE role = 'n8n';
      PRAGMA legacy_alter_table = ON;
      DROP TABLE IF EXISTS agents_v6;
      ALTER TABLE agents RENAME TO agents_v6;
      PRAGMA legacy_alter_table = OFF;
      CREATE TABLE agents (
        id            TEXT PRIMARY KEY,
        mission_id    TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN (
                        'research','build','design','content','growth','ops','integration','ceo'
                      )),
        schedule      TEXT NOT NULL DEFAULT 'manual' CHECK (schedule IN ('manual','hourly','daily','weekly')),
        system_prompt TEXT NOT NULL DEFAULT '',
        budget_cents  INTEGER NOT NULL DEFAULT 500 CHECK (budget_cents >= 0),
        is_active     INTEGER NOT NULL DEFAULT 1,
        reports_to    TEXT REFERENCES agents(id) ON DELETE SET NULL,
        created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      INSERT OR IGNORE INTO agents SELECT * FROM agents_v6;
      DROP TABLE IF EXISTS agents_v6;
    `,
  },
  {
    version: 8,
    description: 'n8n 이름 포함 agents 정리 — v7에서 ops로 변환된 n8n 봇 삭제',
    sql: `
      DELETE FROM agents WHERE name LIKE '%n8n%';
    `,
  },
  {
    version: 9,
    description: 'FK 참조 수정 — agents_v5/v6 → agents (migration v6/v7 ALTER TABLE RENAME 부작용 수정)',
    // 근본 원인: SQLite는 ALTER TABLE agents RENAME TO agents_v5 실행 시
    // 다른 테이블의 DDL(sqlite_master.sql)에서 REFERENCES agents → REFERENCES "agents_v5"로 자동 업데이트.
    // 이후 agents_v5 DROP 시 heartbeat_runs/feed_items/cost_events/issues/schedules/token_usage의
    // FK 참조가 존재하지 않는 "agents_v5"를 가리켜 foreign_keys=ON 상태에서 INSERT 시
    // "no such table: main.agents_v5" 오류 발생.
    // PRAGMA writable_schema로 sqlite_master를 직접 패치하여 수정.
    // 실패 시 client.ts의 postMigrationFkRepair()가 DROP+CREATE 방식으로 보완.
    sql: `
      PRAGMA writable_schema = ON;
      UPDATE sqlite_master
        SET sql = REPLACE(REPLACE(sql, 'agents_v5', 'agents'), 'agents_v6', 'agents')
        WHERE sql LIKE '%agents_v5%' OR sql LIKE '%agents_v6%';
      PRAGMA writable_schema = OFF;
    `,
  },
];

// ── 마이그레이션 결과 타입 ──────────────────────────────────────

export interface MigrationResult {
  version: number;
  description: string;
  status: 'applied' | 'skipped' | 'failed' | 'rolled_back';
  error?: string;
  durationMs: number;
}

// ── 마이그레이션 실행 (트랜잭션 + 롤백 지원) ────────────────────

export function runMigrations(db: Database.Database): MigrationResult[] {
  // schema_migrations 테이블 보장
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','rolled_back')),
      applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
      rolled_back_at TEXT
    )`
  );

  // status 컬럼이 없는 구버전 schema_migrations 대응 (silent)
  try {
    db.exec(`ALTER TABLE schema_migrations ADD COLUMN status TEXT NOT NULL DEFAULT 'applied'`);
  } catch {
    // 이미 존재하면 무시
  }
  try {
    db.exec(`ALTER TABLE schema_migrations ADD COLUMN rolled_back_at TEXT`);
  } catch {
    // 이미 존재하면 무시
  }

  const applied = (
    db.prepare(
      `SELECT version FROM schema_migrations WHERE status = 'applied'`
    ).all() as { version: number }[]
  ).map((r) => r.version);

  const results: MigrationResult[] = [];

  for (const m of MIGRATIONS) {
    if (applied.includes(m.version)) {
      results.push({
        version: m.version,
        description: m.description,
        status: 'skipped',
        durationMs: 0,
      });
      continue;
    }

    const startMs = Date.now();
    console.log(`[DB Migration] v${m.version} 시작: ${m.description}`);

    // SQLite는 DDL을 트랜잭션 안에 넣을 수 있음 (BEGIN/COMMIT 수동)
    try {
      db.exec('BEGIN');
      db.exec(m.sql);
      db.prepare(
        `INSERT INTO schema_migrations (version, description, status, applied_at)
         VALUES (?, ?, 'applied', datetime('now'))`
      ).run(m.version, m.description);
      db.exec('COMMIT');

      const durationMs = Date.now() - startMs;
      console.log(`[DB Migration] v${m.version} 완료 (${durationMs}ms): ${m.description}`);
      results.push({
        version: m.version,
        description: m.description,
        status: 'applied',
        durationMs,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[DB Migration] v${m.version} 실패: ${errMsg}`);

      // 트랜잭션 롤백 시도
      try {
        db.exec('ROLLBACK');
        console.log(`[DB Migration] v${m.version} 트랜잭션 롤백 완료`);
      } catch (rollbackErr) {
        console.error(`[DB Migration] v${m.version} 롤백 실패:`, rollbackErr);
      }

      // rollbackSql이 있으면 추가 정리 시도
      if (m.rollbackSql) {
        try {
          db.exec(m.rollbackSql);
          db.prepare(
            `INSERT OR REPLACE INTO schema_migrations
               (version, description, status, applied_at, rolled_back_at)
             VALUES (?, ?, 'rolled_back', datetime('now'), datetime('now'))`
          ).run(m.version, m.description);
          console.log(`[DB Migration] v${m.version} rollbackSql 실행 완료`);
          results.push({
            version: m.version,
            description: m.description,
            status: 'rolled_back',
            error: errMsg,
            durationMs: Date.now() - startMs,
          });
        } catch (cleanupErr) {
          const cleanupMsg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
          console.error(`[DB Migration] v${m.version} rollbackSql 실패: ${cleanupMsg}`);
          results.push({
            version: m.version,
            description: m.description,
            status: 'failed',
            error: `migration: ${errMsg} | rollback: ${cleanupMsg}`,
            durationMs: Date.now() - startMs,
          });
        }
      } else {
        results.push({
          version: m.version,
          description: m.description,
          status: 'failed',
          error: errMsg,
          durationMs: Date.now() - startMs,
        });
      }

      // 마이그레이션 실패 시 이후 마이그레이션 중단 (의존성 보호)
      console.error(
        `[DB Migration] v${m.version} 실패로 이후 마이그레이션 중단. ` +
        `남은 마이그레이션: ${MIGRATIONS.filter(x => x.version > m.version).map(x => `v${x.version}`).join(', ') || '없음'}`
      );
      break;
    }
  }

  // 요약 로그
  const applied_count = results.filter(r => r.status === 'applied').length;
  const skipped_count = results.filter(r => r.status === 'skipped').length;
  const failed_count  = results.filter(r => r.status === 'failed' || r.status === 'rolled_back').length;
  console.log(
    `[DB Migration] 완료 — 적용: ${applied_count}, 건너뜀: ${skipped_count}, 실패: ${failed_count}`
  );

  return results;
}
