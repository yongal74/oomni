# ADR-008: DB Migration Repair Pattern for Partial Migration State

**Date**: 2026-04-13
**Status**: Accepted
**Version**: v2.9.7

## Context

SQLite migration v6 (agents_v5 → agents with `ceo` role CHECK constraint) performs a table rename and recreation. If the app crashes mid-migration (e.g., during `ALTER TABLE`/`RENAME`), the DB can be left in a partially migrated state:

- `agents_v5` exists (old table was renamed)
- `agents` does NOT exist (new table was not yet created)

On next launch, all agent queries fail with `no such table: main.agents` — making the app completely unusable.

Additionally, v2.9.6 discovered that running this migration with `foreign_keys=ON` caused `DROP TABLE agents_v5` to fail due to FK constraints, leading to repeated ROLLBACK failures on every app launch.

## Decision

Add a **defensive repair block** in `initDb()` — executed before `runMigrations()` — that detects and recovers from the partial migration state:

```typescript
// backend/src/db/client.ts — initDb()
const tables = (db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table'"
).all() as { name: string }[]).map(r => r.name);

const hasV5 = tables.includes('agents_v5');
const hasAgents = tables.includes('agents');

if (hasV5 && !hasAgents) {
  // Partial migration: rebuild agents from v5 data
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE agents ( ... full schema ... );
    INSERT INTO agents SELECT * FROM agents_v5;
    DROP TABLE agents_v5;
  `);
  db.pragma('foreign_keys = ON');
  db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)`
  ).run(6, new Date().toISOString(), 'repair: agents_v5 → agents');
} else if (hasV5 && hasAgents) {
  // Both exist: safe to drop the old table
  db.exec('DROP TABLE IF EXISTS agents_v5;');
}
```

`runMigrations()` is also wrapped with `foreign_keys = OFF/ON` (established in v2.9.6) so migration v6 itself never fails on FK constraints.

## Consequences

**Positive**:
- App recovers automatically from crash-during-migration without manual DB repair
- No data loss: all rows are copied from `agents_v5` before it is dropped
- Idempotent: `INSERT OR IGNORE` prevents duplicate `schema_migrations` records

**Negative**:
- `initDb()` grows slightly more complex
- The repair schema definition must stay in sync with the actual `agents` table schema

## Alternatives Considered

- **Manual repair scripts**: Requires user intervention — unacceptable for end-user desktop app
- **WAL + checkpoint**: SQLite WAL mode reduces crash window but doesn't eliminate it
- **Version-check before migration**: Already done via `schema_migrations` table, but doesn't help when the crash happens within a migration transaction

## Related

- ADR-006: CEO Bot role CHECK constraint (root cause of migration v6 being needed)
- `backend/src/db/client.ts`
