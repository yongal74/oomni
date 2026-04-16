# 60 — 문서 동기화 규칙

## 코드 변경 시 문서 업데이트 의무

| 변경 사항 | 업데이트 필요 문서 |
|---|---|
| 새 기능 추가 | `PRD-v2.md` Feature ID 체크, `WBS-v3.0.0.md` 상태 업데이트 |
| 파일 삭제 | `code-audit.md` 상태 업데이트 |
| 아키텍처 변경 | `system-context.md`, `module-map.md` |
| 새 규칙 발견 | `.claude/rules/` 해당 파일에 즉시 추가 |
| 버그 수정 | `CLAUDE.md` 또는 해당 rules 파일에 재발 방지 규칙 추가 |

## Feature ID 추적 규칙

- 모든 커밋 메시지에 Feature ID 포함: `[BOT-01] Research Bot 우측 패널 수정`
- WBS 태스크 완료 시 `docs/wbs/WBS-v3.0.0.md` 상태를 `✅`로 업데이트
- 새 Feature ID 발급 시 `docs/standards/feature-ids.md` 등록

## CLAUDE.md 200줄 제한

- CLAUDE.md는 200줄 이내 유지
- 세부 규칙은 `.claude/rules/` 파일로 분리
- 중복 내용 발견 시 CLAUDE.md에서 제거하고 rules 파일로 이동

## 문서 파일 위치

```
docs/
  prd/PRD-v2.md              — 제품 요구사항
  architecture/
    system-context.md        — 시스템 경계 다이어그램
    module-map.md            — 디렉토리 구조
    code-audit.md            — Keep/Rewrite/Delete 감사
  wbs/WBS-v3.0.0.md         — 작업 분류 구조
  standards/feature-ids.md   — Feature ID 레지스트리
.claude/
  rules/                     — 세부 규칙 모음
  settings.json              — Hooks 설정
CLAUDE.md                    — 핵심 규칙 (200줄 이내)
```
