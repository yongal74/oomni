/**
 * SQLite 클라이언트 (better-sqlite3)
 * - 설치/초기화 불필요, 파일 기반 DB
 * - PostgreSQL 호환 인터페이스 (query($1,$2...) → ?,?...) 제공
 * - 한국어 Windows 로케일 문제 없음
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL, runMigrations } from './schema.js';
import { logger } from '../logger.js';

// DB 파일 위치: 한글 경로 피하기 위해 C:/oomni-data 고정
const DATA_DIR = process.env.OOMNI_DATA_DIR ?? 'C:/oomni-data';
const DB_PATH = path.join(DATA_DIR, 'oomni.db');

// PostgreSQL 스타일 $1,$2... → SQLite ? 변환
function pgToSqlite(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

// SQLite INTEGER(0/1)를 boolean으로 변환할 컬럼 목록
const BOOL_COLS = new Set(['is_active', 'requires_approval']);

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = BOOL_COLS.has(k) ? (v === 1 || v === true) : v;
  }
  return out;
}

// boolean → 0/1, Date → ISO string 파라미터 정규화
function normalizeParams(params?: unknown[]): unknown[] {
  if (!params) return [];
  return params.map(p => {
    if (p === true) return 1;
    if (p === false) return 0;
    if (p instanceof Date) return p.toISOString();
    return p;
  });
}

export interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

let db: Database.Database | null = null;

// agents 테이블 재생성 SQL (migration v6 기준 — ceo role 포함)
const AGENTS_TABLE_SQL = `CREATE TABLE agents (
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
)`;

export function initDb(): DbClient {
  logger.info('[DB] SQLite 초기화 중...');

  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH, { verbose: undefined });

  // WAL 모드: 동시 읽기 성능 향상
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── 사전 복구 (SCHEMA_SQL 실행 전!) ────────────────────────────────────────
  // 핵심 이유: SCHEMA_SQL의 CREATE TABLE IF NOT EXISTS agents 가 먼저 실행되면
  // agents_v5 안의 실제 데이터를 잃게 됨. 반드시 SCHEMA_SQL 전에 처리해야 함.
  try {
    const existingTables = (db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[]).map(r => r.name);

    const hasV5     = existingTables.includes('agents_v5');
    const hasAgents = existingTables.includes('agents');

    if (hasV5 && !hasAgents) {
      // Case A: agents_v5만 있고 agents 없음 → 데이터 보존하며 복구
      logger.info('[DB] Pre-repair A: agents_v5 발견(agents 없음) — 복구 시작');
      db.pragma('foreign_keys = OFF');

      // schema_migrations가 아직 없을 수 있으므로 먼저 생성
      db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version        INTEGER PRIMARY KEY,
        description    TEXT,
        status         TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','rolled_back')),
        applied_at     TEXT NOT NULL DEFAULT (datetime('now')),
        rolled_back_at TEXT
      )`);

      db.exec(`${AGENTS_TABLE_SQL};
        INSERT OR IGNORE INTO agents SELECT * FROM agents_v5;
        DROP TABLE agents_v5;`);

      db.prepare(
        `INSERT OR IGNORE INTO schema_migrations (version, description, status, applied_at)
         VALUES (6, 'agents 복구 from agents_v5 (pre-repair A)', 'applied', datetime('now'))`
      ).run();

      db.pragma('foreign_keys = ON');
      logger.info('[DB] Pre-repair A: agents 복구 완료');

    } else if (hasV5 && hasAgents) {
      // Case B: 둘 다 있음 — 어느 쪽에 데이터가 있는지 확인
      const agentsCnt = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number }).c;
      const v5Cnt     = (db.prepare('SELECT COUNT(*) as c FROM agents_v5').get() as { c: number }).c;

      if (agentsCnt === 0 && v5Cnt > 0) {
        // agents는 빈 상태(SCHEMA_SQL이 이미 빈 테이블 만든 경우), agents_v5에 실제 데이터
        logger.info('[DB] Pre-repair B1: agents 비어있음+agents_v5 데이터 있음 — 복구');
        db.pragma('foreign_keys = OFF');
        db.exec('INSERT OR IGNORE INTO agents SELECT * FROM agents_v5; DROP TABLE agents_v5;');
        db.pragma('foreign_keys = ON');

        db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY, description TEXT,
          status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','rolled_back')),
          applied_at TEXT NOT NULL DEFAULT (datetime('now')),
          rolled_back_at TEXT
        )`);
        db.prepare(
          `INSERT OR IGNORE INTO schema_migrations (version, description, status, applied_at)
           VALUES (6, 'agents 복구 from agents_v5 (pre-repair B1)', 'applied', datetime('now'))`
        ).run();
        logger.info('[DB] Pre-repair B1: 복구 완료');
      } else {
        // agents에 데이터 있거나 둘 다 비어있음 — agents_v5 잔재 삭제
        logger.info(`[DB] Pre-repair B2: agents(${agentsCnt}행) 있음 — agents_v5 잔재 삭제`);
        db.pragma('foreign_keys = OFF');
        db.exec('DROP TABLE IF EXISTS agents_v5;');
        db.pragma('foreign_keys = ON');
      }
    }
    // hasV5=false, hasAgents=false → SCHEMA_SQL이 정상 생성
    // hasV5=false, hasAgents=true  → 정상 상태
  } catch (preRepairErr) {
    logger.error('[DB] Pre-repair 실패 (무시하고 계속):', preRepairErr);
  }

  // 기본 스키마 적용 (IF NOT EXISTS로 멱등)
  db.exec(SCHEMA_SQL);

  // 구버전 DB 방어 패치: 누락 컬럼 추가
  const columnPatches = [
    { sql: "ALTER TABLE token_usage ADD COLUMN mission_id TEXT DEFAULT ''",   label: 'token_usage.mission_id' },
    { sql: "ALTER TABLE heartbeat_runs ADD COLUMN task TEXT DEFAULT ''",       label: 'heartbeat_runs.task' },
  ];
  for (const patch of columnPatches) {
    try {
      db.exec(patch.sql);
      logger.info(`[DB] ${patch.label} 컬럼 추가 완료 (구버전 DB 마이그레이션)`);
    } catch {
      // 이미 존재하면 무시 ("duplicate column name" 오류)
    }
  }

  // 버전 기반 마이그레이션 실행
  // DDL 마이그레이션 중 FK 제약으로 막히지 않도록 일시 비활성화
  db.pragma('foreign_keys = OFF');
  const migrationResults = runMigrations(db);
  db.pragma('foreign_keys = ON');

  const failedMigrations = migrationResults.filter(
    r => r.status === 'failed' || r.status === 'rolled_back'
  );
  if (failedMigrations.length > 0) {
    logger.error(
      '[DB] 마이그레이션 실패:',
      failedMigrations.map(r => `v${r.version}(${r.status}): ${r.error}`).join(', ')
    );
  } else {
    logger.info('[DB] 스키마 마이그레이션 완료');
  }

  return createClient();
}

export function getDb(): DbClient {
  if (!db) throw new Error('DB가 초기화되지 않았습니다. initDb()를 먼저 호출하세요.');
  return createClient();
}

function createClient(): DbClient {
  return {
    query: async (sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> => {
      if (!db) throw new Error('DB가 초기화되지 않았습니다.');

      const sqliteSql = pgToSqlite(sql.trim());
      const normalizedParams = normalizeParams(params);

      const trimmed = sqliteSql.toUpperCase().trimStart();
      const isSelect =
        trimmed.startsWith('SELECT') ||
        trimmed.startsWith('WITH') ||
        trimmed.startsWith('PRAGMA');

      if (isSelect) {
        const rows = db.prepare(sqliteSql).all(...normalizedParams) as Record<string, unknown>[];
        return { rows: rows.map(normalizeRow) };
      } else {
        // INSERT/UPDATE RETURNING → SQLite에는 RETURNING 없음: 변경 후 SELECT로 조회
        const hasReturning = /RETURNING\s+\*/i.test(sqliteSql);
        if (hasReturning) {
          const cleanSql = sqliteSql.replace(/RETURNING\s+\*/i, '').trim().replace(/;?\s*$/, '');
          const stmt = db.prepare(cleanSql);
          const info = stmt.run(...normalizedParams);
          if (info.changes > 0) {
            const tableName = extractTableName(cleanSql);
            if (tableName) {
              const isUpdate = cleanSql.toUpperCase().trimStart().startsWith('UPDATE');
              const rowId = isUpdate
                ? normalizedParams[normalizedParams.length - 1]
                : normalizedParams[0];
              const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(rowId) as Record<string, unknown> | undefined;
              return { rows: row ? [normalizeRow(row)] : [] };
            }
          }
          return { rows: [] };
        }

        const stmt = db.prepare(sqliteSql);
        stmt.run(...normalizedParams);
        return { rows: [] };
      }
    },
  };
}

function extractTableName(sql: string): string | null {
  const insertMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
  if (insertMatch) return insertMatch[1] ?? null;
  const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (updateMatch) return updateMatch[1] ?? null;
  return null;
}

export async function shutdownDb(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
  logger.info('[DB] 종료 완료');
}
