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
    if (BOOL_COLS.has(k)) {
      out[k] = v === 1 || v === true;
    } else {
      out[k] = v;
    }
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

export function initDb(): DbClient {
  logger.info('[DB] SQLite 초기화 중...');

  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH, { verbose: undefined });

  // WAL 모드: 동시 읽기 성능 향상
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 기본 스키마 적용 (IF NOT EXISTS로 멱등)
  db.exec(SCHEMA_SQL);

  // 구버전 DB 방어 패치: token_usage.mission_id 컬럼이 없으면 추가
  // (CREATE TABLE IF NOT EXISTS는 기존 테이블의 누락 컬럼을 추가하지 않으므로 별도 처리)
  try {
    db.exec("ALTER TABLE token_usage ADD COLUMN mission_id TEXT DEFAULT ''");
    logger.info('[DB] token_usage.mission_id 컬럼 추가 완료 (구버전 DB 마이그레이션)');
  } catch {
    // 이미 존재하면 무시 ("duplicate column name" 오류)
  }

  // 버전 기반 마이그레이션 실행
  const migrationResults = runMigrations(db);
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
              // INSERT → 첫 번째 파라미터가 id
              // UPDATE ... WHERE id = ? → 마지막 파라미터가 id
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
