# ADR-006: CEO 봇 role CHECK constraint — Schema Migration v6

**날짜**: 2026-04
**상태**: 채택됨 (v2.9.5)

---

## 배경

OOMNI의 봇 파이프라인은 `Research → Content → Build → Design → Growth → Ops → CEO` 7개 역할로 구성된다. `agents` 테이블의 `role` 컬럼에 허용 값을 제한하는 CHECK constraint가 있었으나, 초기 스키마 설계 시 `ceo` role이 누락되어 있었다.

## 문제

CEO 봇 추가 시 `INSERT INTO agents ... role = 'ceo'` → SQLite CHECK constraint 위반 → 500 에러

```sql
-- v5 schema (버그)
CHECK(role IN ('research','content','build','design','growth','ops'))
-- 'ceo' 없음!
```

## 결정

Schema migration v6에서 `agents` 테이블을 재생성하여 `ceo` role을 CHECK constraint에 추가한다.

```sql
-- migration v6
CREATE TABLE agents_new (
  ...
  role TEXT NOT NULL CHECK(role IN ('research','content','build','design','growth','ops','ceo')),
  ...
);
INSERT INTO agents_new SELECT * FROM agents;
DROP TABLE agents;
ALTER TABLE agents_new RENAME TO agents;
```

SQLite는 `ALTER TABLE ... MODIFY COLUMN`을 지원하지 않으므로 테이블 재생성 방식 사용.

## 교훈

- SQLite CHECK constraint 변경은 항상 테이블 재생성이 필요 — 마이그레이션 비용이 높음
- 초기 스키마 설계 시 모든 허용 값을 확정하고 CHECK constraint 작성
- 봇 파이프라인 역할 추가 시 반드시 schema.ts의 CHECK constraint 동시 업데이트

## 관련 파일
- `backend/src/db/schema.ts` — migration v6, agents 테이블 재생성
