# ADR-010: Chat Endpoint — 전역 인증 미들웨어 예외 처리

**Date**: 2026-04-14
**Status**: Accepted
**Version**: v2.9.14

## Context

v2.9.12에서 `POST /api/agents/:id/chat` 엔드포인트를 신규 추가했다. Electron 로컬 앱에서 `sessionStorage`의 세션 토큰 또는 Electron IPC를 통한 내부 API 키로 인증하는 구조다.

v2.9.13에서 이 엔드포인트가 **401 Unauthorized**를 반환하는 버그가 발생했다. 잘못된 진단으로 라우터 핸들러 내부의 인증 체크만 제거했으나 문제가 지속됐다. 실제 원인은 전역 인증 미들웨어(`backend/src/api/app.ts`)였다.

### 근본 원인
`app.ts`의 `isPublicPath()` 함수가 허용 경로를 정규식으로 검사한다. `/api/agents/:id/chat` 패턴이 이 목록에 없었기 때문에, 요청이 **라우터에 도달하기 전에** 미들웨어에서 401을 반환했다.

```typescript
// app.ts — isPublicPath에 추가된 패턴
/^\/agents\/[^/]+\/chat$/.test(req.path)
```

## Decision

`/api/agents/:id/chat` 엔드포인트를 `isPublicPath` 예외 목록에 추가한다. 이 엔드포인트는 Electron 로컬 앱 전용이므로 외부 노출 위험이 없다.

인증은 라우터 레벨에서 `Authorization: Bearer {token}` 헤더를 검사하는 방식으로 유지한다.

## Consequences

**Positive**:
- Electron 로컬 앱에서 채팅 엔드포인트 정상 동작
- 전역 미들웨어와 라우터 레벨 인증의 역할 분리 명확화

**Negative**:
- 새 엔드포인트 추가 시 isPublicPath 수정을 잊으면 동일한 버그 재발 가능

## 교훈 — 절대 잊지 말 것

401 디버깅 순서:
1. **라우터보다 미들웨어 먼저** 확인 (`app.ts` isPublicPath)
2. 라우터 핸들러는 미들웨어 통과 후에야 실행됨
3. 새 엔드포인트 추가 시 isPublicPath 필요 여부 반드시 검토

## Related

- `backend/src/api/app.ts` — isPublicPath 함수
- `backend/src/api/routes/agents.ts` — POST /:id/chat 라우터
- ADR-011: 스트리밍 lineBuffer 패턴 (이 엔드포인트의 스트리밍 구현)
