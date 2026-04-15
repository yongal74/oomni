# ADR-001: SQLite ALTER TABLE RENAME으로 인한 FK 참조 손상 수정 방법

- **날짜**: 2026-04-15
- **버전**: v2.9.17
- **상태**: 적용됨

---

## 컨텍스트

OOMNI DB(SQLite)에서 agents 테이블 스키마 변경 시 role CHECK 제약 재생성을 위해
`ALTER TABLE agents RENAME TO agents_v5` → CREATE TABLE agents → INSERT → DROP agents_v5
패턴의 migration(v6, v7)을 사용.

## 발견된 문제

**SQLite 3.26.0 이상**에서 `ALTER TABLE foo RENAME TO foo_bak` 실행 시,
다른 테이블의 CREATE TABLE DDL(sqlite_master.sql)에서 `REFERENCES foo`가
자동으로 `REFERENCES "foo_bak"`으로 업데이트된다.

이로 인해 migration v6 실행 후:
- `heartbeat_runs.agent_id` → `REFERENCES "agents_v5"(id)`
- `feed_items.agent_id` → `REFERENCES "agents_v5"(id)`
- `cost_events.agent_id` → `REFERENCES "agents_v5"(id)`
- `issues.agent_id` → `REFERENCES "agents_v5"(id)`
- `schedules.agent_id` → `REFERENCES "agents_v5"(id)`
- `token_usage.agent_id` → `REFERENCES "agents_v5"(id)`

migration v6 완료 후 `agents_v5` DROP → FK 참조 dangling.
`PRAGMA foreign_keys = ON` 상태에서 위 테이블에 INSERT 시:
```
SQLite Error: no such table: main.agents_v5
```

### 증상
- Research/Content/Growth/Ops/CEO Bot 채팅창(AntigravityRightPanel)에서
  메시지 전송 즉시 "오류: no such table: main.agents_v5" 표시
- `saveFeedItem()` → `INSERT INTO feed_items` 가 첫 번째 DB 작업이므로 즉시 실패

### 발견 방법
```python
import sqlite3
conn = sqlite3.connect('C:/oomni-data/oomni.db')
cur = conn.cursor()
cur.execute("SELECT name, sql FROM sqlite_master WHERE sql LIKE '%agents_v5%'")
# → 6개 테이블 모두 REFERENCES "agents_v5" 포함 확인
```

## 결정

**PRAGMA writable_schema**를 이용해 sqlite_master를 직접 패치하는 migration v9 추가:

```sql
PRAGMA writable_schema = ON;
UPDATE sqlite_master
  SET sql = REPLACE(REPLACE(sql, 'agents_v5', 'agents'), 'agents_v6', 'agents')
  WHERE sql LIKE '%agents_v5%' OR sql LIKE '%agents_v6%';
PRAGMA writable_schema = OFF;
```

### 선택 이유
| 방안 | 장점 | 단점 |
|------|------|------|
| **writable_schema 패치** | 간단, 데이터 유지, 인덱스 재생성 불필요 | sqlite_master 직접 수정 (비표준) |
| 테이블 재생성 | 표준적 방법 | 6개 테이블 × rename/create/copy/drop = 24개 SQL, CASCADE FK 순서 관리 복잡, 인덱스 재생성 필요 |

writable_schema 패치는 단순 문자열 치환이므로 데이터 손실 위험 없음.
트랜잭션 안에서 실행되어 실패 시 rollback 가능.

## 추가 수정

### migration v5 no-op 변경
SCHEMA_SQL에 `outputs_json TEXT`가 이미 포함되어 있어, 신규 설치 시:
1. SCHEMA_SQL이 `outputs_json` 컬럼 생성
2. migration v5가 `ALTER TABLE research_items ADD COLUMN outputs_json TEXT` 시도 → "duplicate column name" 오류
3. migration runner의 `break;` → v6~v8 실행 불가 → FK repair migration v9도 실행 불가

**해결**: migration v5 sql을 `SELECT 1;` (no-op)으로 변경.
기존 DB 대응은 `columnPatches`의 try/catch로 처리.

## 결과

- v2.9.17 이후 앱 시작 시 migration v9 자동 실행
- 6개 테이블의 FK 참조가 `agents_v5/v6 → agents`로 수정
- 채팅 오류 해소

## 교훈 및 규칙

1. **SQLite에서 테이블 재생성(rename-create-copy-drop) 패턴 사용 시**
   반드시 FK 참조를 수정하는 후속 migration 동반 필요.

2. **더 안전한 대안**: `PRAGMA legacy_alter_table = ON` 설정 후 rename하면
   FK 참조 자동 업데이트가 발생하지 않음. 단, 이 설정은 session-level이고
   migration runner의 FK=OFF와 병행 시 주의 필요.

3. **migration 멱등성**: SCHEMA_SQL에 컬럼이 있으면 해당 컬럼 추가 migration은
   no-op으로 만들어야 함. `columnPatches`가 기존 DB 대응의 안전망.
