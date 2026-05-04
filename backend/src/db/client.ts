/**
 * SQLite 클라이언트 (better-sqlite3)
 * v3.0 — migration 체인 제거, v2.x 감지+백업+리셋
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL, V2_DETECTION_TABLES } from './schema';
import { logger } from '../logger';

const DATA_DIR = process.env.OOMNI_DATA_DIR ?? 'C:/oomni-data';
const DB_PATH = path.join(DATA_DIR, 'oomni.db');

// SQLite INTEGER(0/1)를 boolean으로 변환할 컬럼 목록
const BOOL_COLS = new Set(['is_active', 'requires_approval']);

// PostgreSQL $1,$2... → SQLite ? 변환
function pgToSqlite(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = BOOL_COLS.has(k) ? (v === 1 || v === true) : v;
  }
  return out;
}

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

/**
 * v2.x DB 감지: V2_DETECTION_TABLES 중 하나라도 존재하면 v2.x
 */
function isV2Database(database: Database.Database): boolean {
  for (const table of V2_DETECTION_TABLES) {
    const row = database.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(table);
    if (row) return true;
  }
  return false;
}

/**
 * v2.x DB 자동 백업
 */
function backupV2Database(): void {
  if (!fs.existsSync(DB_PATH)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(DATA_DIR, `oomni-backup-${timestamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  logger.info(`[DB] v2.x 백업 완료: ${backupPath}`);
}

export function initDb(): DbClient {
  logger.info('[DB] SQLite 초기화 중...');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 기존 DB가 있으면 v2.x 여부 확인
  if (fs.existsSync(DB_PATH)) {
    const tempDb = new Database(DB_PATH, { readonly: true });
    const isV2 = isV2Database(tempDb);
    tempDb.close();

    if (isV2) {
      backupV2Database();
      // IPC로 Electron에 리셋 필요 신호 전송 (electron/main.js에서 처리)
      process.env.OOMNI_DB_RESET_REQUIRED = 'true';
      // v2 DB 삭제 후 새로 생성
      fs.unlinkSync(DB_PATH);
      logger.info('[DB] v2.x DB 감지 → 리셋 완료');
    }
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  // 기존 DB 컬럼 패치 (IF NOT EXISTS 없이 ALTER TABLE — 오류 시 무시)
  const columnPatches = [
    { sql: "ALTER TABLE users ADD COLUMN pin_hash TEXT",                label: 'users.pin_hash' },
    { sql: "ALTER TABLE users ADD COLUMN license_valid_until TEXT",      label: 'users.license_valid_until' },
    { sql: "ALTER TABLE sessions ADD COLUMN created_at TEXT",            label: 'sessions.created_at' },
    { sql: "ALTER TABLE sessions ADD COLUMN last_used_at TEXT",          label: 'sessions.last_used_at' },
    // research_items 누락 컬럼
    { sql: "ALTER TABLE research_items ADD COLUMN tags TEXT",             label: 'research_items.tags' },
    { sql: "ALTER TABLE research_items ADD COLUMN source_url TEXT",       label: 'research_items.source_url' },
    { sql: "ALTER TABLE research_items ADD COLUMN next_action TEXT",      label: 'research_items.next_action' },
    { sql: "ALTER TABLE research_items ADD COLUMN converted_output TEXT", label: 'research_items.converted_output' },
    // v5.2.0 growth_content 확장
    { sql: "ALTER TABLE growth_content ADD COLUMN video_url TEXT",        label: 'growth_content.video_url' },
    { sql: "ALTER TABLE growth_content ADD COLUMN segment TEXT",          label: 'growth_content.segment' },
    { sql: "ALTER TABLE growth_content ADD COLUMN publish_channels TEXT", label: 'growth_content.publish_channels' },
    { sql: "ALTER TABLE growth_content ADD COLUMN published_at TEXT",     label: 'growth_content.published_at' },
  ];
  for (const patch of columnPatches) {
    try {
      db.exec(patch.sql);
      logger.info(`[DB] ${patch.label} 컬럼 추가 완료`);
    } catch {
      // 이미 존재하면 무시
    }
  }

  // research_items filter_decision CHECK 제약 수정
  // 구버전 스키마: CHECK(filter_decision IN ('keep','maybe','skip')) → 'pending','drop','watch' INSERT 실패
  try {
    const schemaRow = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='research_items'"
    ).get() as { sql: string } | undefined;
    if (schemaRow?.sql?.includes("'keep','maybe','skip'")) {
      logger.info('[DB] research_items 구버전 CHECK 제약 감지 → 테이블 재생성');
      const _db = db;
      _db.pragma('foreign_keys = OFF');
      _db.transaction(() => {
        _db.exec(`ALTER TABLE research_items RENAME TO research_items_old`);
        _db.exec(`CREATE TABLE research_items (
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
        )`);
        _db.exec(`INSERT INTO research_items
          (id, mission_id, source_type, title, summary, content, filter_decision, signal_score, outputs_json, created_at)
          SELECT id, mission_id, source_type, title, summary, content,
            CASE WHEN filter_decision IN ('keep') THEN 'keep' ELSE 'pending' END,
            signal_score, outputs_json, created_at
          FROM research_items_old`);
        _db.exec(`DROP TABLE research_items_old`);
      })();
      _db.pragma('foreign_keys = ON');
      logger.info('[DB] research_items 재생성 완료');
    }
  } catch (e) {
    logger.warn('[DB] research_items 스키마 수정 건너뜀:', e);
    try { db.pragma('foreign_keys = ON'); } catch { /* ignore */ }
  }

  // integration → ops 역할 마이그레이션 (growth는 v5.2.0부터 독립 role)
  try {
    db.exec(`UPDATE agents SET role = 'ops' WHERE role = 'integration'`);
    logger.info('[DB] integration→ops 마이그레이션 완료');
  } catch {
    // 이미 마이그레이션됐거나 해당 행 없으면 무시
  }

  // v5.2.0: agents CHECK 제약에 'growth' 없는 경우 → 테이블 재생성
  try {
    const agentsSchema = db.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'`
    ).get() as { sql: string } | undefined;
    if (agentsSchema?.sql && !agentsSchema.sql.includes("'growth'")) {
      logger.info('[DB] agents CHECK에 growth 없음 → 테이블 재생성');
      const _db = db;
      _db.pragma('foreign_keys = OFF');
      _db.transaction(() => {
        _db.exec(`ALTER TABLE agents RENAME TO agents_old_v52`);
        _db.exec(`CREATE TABLE agents (
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
        )`);
        _db.exec(`INSERT INTO agents SELECT * FROM agents_old_v52`);
        _db.exec(`DROP TABLE agents_old_v52`);
      })();
      _db.pragma('foreign_keys = ON');
      logger.info('[DB] agents 재생성 완료 (growth role 추가)');
    }
  } catch (e) {
    logger.warn('[DB] agents CHECK 수정 건너뜀:', e);
    try { db.pragma('foreign_keys = ON'); } catch { /* ignore */ }
  }

  // CEO 봇 중복 제거 (같은 미션에 CEO가 여러 개인 경우 rowid 기준 첫 번째만 유지)
  try {
    db.exec(`
      DELETE FROM agents
      WHERE role = 'ceo'
      AND rowid NOT IN (
        SELECT MIN(rowid) FROM agents WHERE role = 'ceo' GROUP BY mission_id
      )
    `);
  } catch {
    // CEO가 없거나 중복 없으면 무시
  }

  logger.info('[DB] 초기화 완료');

  return createClient();
}

export function getDb(): DbClient {
  if (!db) throw new Error('DB가 초기화되지 않았습니다. initDb()를 먼저 호출하세요.');
  return createClient();
}

/** better-sqlite3 raw 인스턴스 반환 (동기 prepare/get/run 필요 시 사용) */
export function getRawDb(): Database.Database {
  if (!db) throw new Error('DB가 초기화되지 않았습니다. initDb()를 먼저 호출하세요.');
  return db;
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
      }

      // INSERT/UPDATE RETURNING → SQLite에는 RETURNING 없음: 변경 후 SELECT로 조회
      const hasReturning = /RETURNING\s+\*/i.test(sqliteSql);
      if (hasReturning) {
        const cleanSql = sqliteSql.replace(/RETURNING\s+\*/i, '').trim().replace(/;?\s*$/, '');
        const info = db.prepare(cleanSql).run(...normalizedParams);
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

      db.prepare(sqliteSql).run(...normalizedParams);
      return { rows: [] };
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

// PostgreSQL $1,$2 → SQLite ? 변환 (하위 호환)
export function toSqlite(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

// 불리언 변환 헬퍼
export function boolToInt(val: boolean | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  return val ? 1 : 0;
}

export function intToBool(val: number | undefined): boolean {
  return val === 1;
}

export default { getDb, initDb, toSqlite, boolToInt, intToBool };
