# ADR-013: Antigravity 전역 MCP 설정에서 Pencil 제거

**Date**: 2026-04-15
**Status**: Accepted
**Version**: v2.9.18

## Context

v2.9.15~v2.9.16에서 OOMNI 소스 코드(claudeCodeService.ts, runner.ts, ptyService.ts, agents.ts)의 Antigravity 참조를 모두 제거하고 `npx @pencilapp/mcp-server` 독립 실행 방식으로 전환했다(ADR-012).

그러나 시스템 레벨의 Antigravity 전역 MCP 설정 파일이 남아 있었다.

## 발견된 문제

`C:/Users/장우경/.gemini/antigravity/mcp_config.json`에 Pencil MCP가 전역 설정으로 등록되어 있었다:

```json
{
  "mcpServers": {
    "n8n-mcp": { ... },
    "pencil": {
      "command": "C:\\Users\\장우경\\.pencil\\mcp\\antigravity\\out\\mcp-server-windows-x64.exe",
      "args": ["--app", "antigravity"],
      "env": {}
    }
  }
}
```

OOMNI가 Claude Code CLI를 실행할 때(`claudeCodeService.ts`의 `--mcp-config` 플래그로 역할별 MCP를 주입) **Antigravity의 전역 MCP 설정도 함께 로드**된다. 그 결과:

1. **Research 봇 포함 모든 봇이 Pencil MCP를 로드** — Design Bot 전용이어야 할 Pencil이 Research 봇 실행 시에도 활성화
2. **Pencil 연산이 Antigravity 앱 창에서 실행** — `--app antigravity` 플래그 때문에 Pencil 에디터 UI가 Antigravity 앱 내부에 표시됨
3. **OOMNI 중앙 패널의 PencilInAppView가 동작하지 않음** — Antigravity가 Pencil 세션을 "소유"하므로 OOMNI가 localhost URL을 받지 못함

### 왜 소스 수정만으로는 부족했나

ADR-012에서 OOMNI 소스의 Antigravity 참조는 모두 제거했으나, **Claude Code CLI 자체가 Antigravity의 전역 설정을 자동 로드**하는 메커니즘이 있었다. Claude Code는 `~/.gemini/antigravity/mcp_config.json`을 자체적으로 읽어 MCP 서버를 등록하므로, OOMNI가 `--mcp-config`로 역할별 설정을 주입해도 Antigravity의 전역 pencil 설정이 추가로 로드됐다.

## Decision

`~/.gemini/antigravity/mcp_config.json`에서 `pencil` 항목을 제거한다. `n8n-mcp`는 Ops Bot 연동에 필요하므로 유지.

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "node",
      "args": ["C:\\Users\\장우경\\AppData\\Roaming\\npm\\node_modules\\n8n-mcp\\dist\\mcp\\index.js"],
      "env": { ... }
    }
  }
}
```

Pencil MCP는 Design Bot 실행 시 OOMNI가 자체적으로 `npx -y @pencilapp/mcp-server`를 주입하므로 전역 등록 불필요.

## Consequences

**Positive**:
- Research/Content/Growth/Ops/CEO 봇이 Pencil MCP를 로드하지 않음
- Pencil 연산이 Antigravity 창이 아닌 pencil.dev 자체 창에서 실행
- OOMNI 중앙 패널 PencilInAppView가 localhost URL을 정상 수신 가능

**Negative**:
- `mcp_config.json`은 소스 코드 레포에 포함되지 않는 시스템 파일 — 신규 설치 환경에서 자동 적용 불가
- 재설치 또는 환경 초기화 시 수동으로 pencil 항목 제거 필요

## 규칙

- `~/.gemini/antigravity/mcp_config.json`에 `pencil` 항목 절대 재추가 금지
- OOMNI 소스의 Pencil MCP 설정(`getRoleMcpConfig('design')`)은 `npx -y @pencilapp/mcp-server` 유지
- n8n-mcp는 전역 설정 유지 (Ops Bot 연동)

## Related

- `~/.gemini/antigravity/mcp_config.json` — 시스템 설정 파일 (레포 외부)
- ADR-012: Pencil MCP Antigravity 연동 제거, npx 독립 실행
- `backend/src/services/claudeCodeService.ts` — getRoleMcpConfig()
