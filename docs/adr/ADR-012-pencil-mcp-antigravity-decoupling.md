# ADR-012: Pencil MCP — Antigravity 연동 제거, npx 독립 실행

**Date**: 2026-04-14
**Status**: Accepted
**Version**: v2.9.15

## Context

Design Bot은 Claude Code CLI가 Pencil.dev MCP를 통해 `.pen` 파일을 읽고 편집할 수 있어야 한다. v2.9.6부터 `claudeCodeService.ts`의 `findPencilMcpExe()` 함수가 Antigravity IDE의 확장 디렉토리에서 Pencil MCP 실행파일을 탐색했다:

```typescript
const antigravityBase = path.join(homeDir, '.gemini', 'antigravity', 'extensions');
const pencilExt = entries.find(e => e.startsWith('highagency.pencildev'));
// → 실행 시: command: pencilExe, args: ['--app', 'antigravity']
```

### 문제점

1. **Pencil UI가 OOMNI 대신 Antigravity 패널에 표시됨**: `--app antigravity` 플래그가 Pencil MCP 서버에게 "Antigravity를 호스트 앱으로 사용하라"고 지시. Pencil의 디자인 에디터 UI가 Antigravity 패널 안에서 렌더링됨

2. **Antigravity의 pencil을 끄면 재시작 요청**: Antigravity가 자체 플러그인 시스템으로 pencil MCP를 관리하므로, 꺼도 자동으로 다시 켜려 함

3. **OOMNI 중앙 패널에 Pencil 미표시**: OOMNI의 `handleUnifiedOutputCapture`/`handleDesignOutputCapture`가 터미널 출력에서 `localhost:XXXX` URL을 캡처하는 방식인데, Antigravity가 Pencil 세션을 "소유"하므로 OOMNI가 URL을 받지 못함

4. **Antigravity 의존성**: Antigravity가 설치되어 있어야만 Design Bot이 Pencil MCP를 사용할 수 있는 구조

## Decision

`findPencilMcpExe()` 함수와 Antigravity extensions 경로 탐색 로직을 완전히 삭제한다. 대신 `findNpxPath()`로 시스템의 npx를 찾아 `npx -y @pencilapp/mcp-server`를 직접 실행한다.

```typescript
// Before (삭제됨)
function findPencilMcpExe(): string | null {
  const antigravityBase = path.join(homeDir, '.gemini', 'antigravity', 'extensions');
  // ...
}
// command: pencilExe, args: ['--app', 'antigravity']

// After
function findNpxPath(): string {
  if (process.platform === 'win32') {
    const candidates = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'npx.cmd'),
      'C:\\Program Files\\nodejs\\npx.cmd',
      ...
    ];
    return candidates.find(p => fs.existsSync(p)) ?? 'npx';
  }
  // ... macOS/Linux 경로
}

// getRoleMcpConfig('design'):
return {
  pencil: {
    command: findNpxPath(),
    args: ['-y', '@pencilapp/mcp-server'],
    env: {},
  },
};
```

Design Bot의 `designPencil` 프롬프트를 항상 사용하도록 변경한다 (Pencil MCP가 항상 활성화되므로 조건 분기 불필요):

```typescript
// Before
const rawPrompt = (this.role === 'design' && findPencilMcpExe())
  ? ROLE_PROMPTS['designPencil'] ?? ROLE_PROMPTS[this.role]
  : ROLE_PROMPTS[this.role];

// After
const rawPrompt = this.role === 'design'
  ? ROLE_PROMPTS['designPencil'] ?? ROLE_PROMPTS[this.role]
  : ROLE_PROMPTS[this.role];
```

DevToolsPage의 Pencil 설치 안내도 업데이트: "Claude Code MCP 전역 설정 필요" → "OOMNI가 자동 연결, pencil.dev 앱만 설치하면 됨"

## Consequences

**Positive**:
- Antigravity 완전 독립 — Antigravity 설치 여부와 무관하게 Design Bot 동작
- Pencil UI가 Antigravity 패널 대신 독립 실행 (pencil.dev 자체 창)
- `@pencilapp/mcp-server` npm 패키지로 버전 관리 및 자동 업데이트
- Antigravity의 pencil 재시작 간섭 해소

**Negative**:
- npx 실행 시 첫 실행에 패키지 다운로드 지연 가능 (-y 플래그로 자동 설치)
- npx가 PATH에 없는 환경에서는 findNpxPath() 폴백 필요 (환경변수 NPX_PATH로 오버라이드 가능)
- pencil.dev 데스크탑 앱이 설치되어 있어야 Pencil 에디터 UI 동작

## 규칙 — 절대 위반 금지

- `findPencilMcpExe()` 함수 재작성 금지
- Pencil MCP 설정에 `~/.gemini/antigravity/extensions` 경로 참조 금지
- Pencil MCP args에 `--app antigravity` 추가 금지
- `getRoleMcpConfig('design')` 변경 시 항상 npx 독립 실행 방식 유지

## Related

- `backend/src/services/claudeCodeService.ts` — findNpxPath(), getRoleMcpConfig()
- `frontend/src/pages/DevToolsPage.tsx` — Pencil 설치 안내
- ADR-003: Design Bot 듀얼 모드 (이전 Pencil 연동 방식 배경)
