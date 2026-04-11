# ADR-001: Electron 백엔드 인-프로세스(In-Process) 실행

**날짜**: 2025-04
**상태**: 채택됨

---

## 배경

OOMNI는 Electron 앱 안에서 Express 백엔드 서버를 실행해야 한다. 두 가지 방법이 있다:

1. **Child Process (spawn)**: 별도 Node.js 프로세스로 백엔드 실행
2. **In-Process (require)**: Electron 메인 프로세스에서 직접 `require`로 백엔드 실행

## 결정

**In-Process 방식** 채택. `electron/main.js`에서 `require(path.join(backendPath, 'dist', 'index.js'))` 로 직접 실행한다.

```javascript
function launchBackend(backendPath, done) {
  process.env.OOMNI_IN_PROCESS = 'true'
  require(path.join(backendPath, 'dist', 'index.js'))
  done()
}
```

## 근거

| 항목 | Child Process | In-Process |
|------|--------------|------------|
| 프로세스 관리 | 별도 관리 필요 | 자동 (앱 종료 시 같이 종료) |
| 포트 충돌 처리 | 복잡 | 간단 |
| IPC 복잡도 | 높음 | 낮음 |
| node-pty 동작 | ✅ | ✅ (ELECTRON_RUN_AS_NODE=1 필요) |
| 메모리 | 절약 | 공유 |
| 패키징 복잡도 | 높음 (extraResources + spawn) | 낮음 |

## 주의사항

- 백엔드에서 `process.exit()` 호출 금지 → Electron 앱 전체 종료됨
- `OOMNI_IN_PROCESS=true` 환경변수로 체크 후 종료 방지
- PTY WebSocket에서 `ELECTRON_RUN_AS_NODE=1` 설정 필요 (node 실행 시)
