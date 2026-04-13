# ADR-009: Build/Design Bot — Always-On PowerShell Shell Terminal

**Date**: 2026-04-13
**Status**: Accepted
**Version**: v2.9.7

## Context

Prior to v2.9.7, Build Bot and Design Bot (PTY mode) spawned a Claude Code CLI process (`claude --dangerously-skip-permissions`) automatically when the user clicked "실행". This caused a persistent **exit code 1** issue:

- The PTY session spawned the Node.js + Claude Code CLI process
- Claude Code CLI has a startup initialization phase (loading config, MCP servers, etc.)
- If any input was sent before CLI finished initializing, the process exited with code 1
- This was partially worked around with `initialInput` + 800ms delay (v2.9.3), but the timing was unreliable
- v2.9.5 removed `initialInput` entirely and replaced with a `taskHint` display, but the underlying spawn failure still occurred intermittently

The root problem: automatically spawning Claude Code CLI from a PTY is fragile — the CLI was not designed to be spawned programmatically with stdin/stdout redirected through a PTY multiplexer.

## Decision

Switch to **Antigravity IDE style**: the PTY session spawns a plain shell (`powershell.exe` on Windows, `$SHELL` on Linux/Mac) instead of Claude Code CLI. The user can then manually run `claude --dangerously-skip-permissions` in the terminal when they want to start Claude Code.

Two new props were added to `XTerminal`:

- `alwaysOn?: boolean` — connect WebSocket on component mount, regardless of `isRunning` state
- `shellMode?: boolean` — spawn `powershell.exe` / `$SHELL` instead of Claude Code CLI; includes `?mode=shell` in WebSocket URL

Backend (`ptyService.ts`) reads `?mode=shell` query param and branches:

```typescript
if (shellMode) {
  spawnExec = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/bash');
  spawnArgs = process.platform === 'win32' ? ['-NoLogo'] : [];
} else {
  // original Claude Code CLI spawn
}
```

Applied to:
- **Build Bot**: `<XTerminal alwaysOn shellMode ... />` — always-on workspace PowerShell
- **Design Bot SSE mode**: additional `<XTerminal agentId={id+'-shell'} alwaysOn shellMode ... />` at bottom — persistent PowerShell alongside the SSE output pane

## Consequences

**Positive**:
- Eliminates exit code 1 entirely — a plain shell never exits unexpectedly
- Terminal is ready immediately on page load (alwaysOn), no need to click "실행" first
- Matches Antigravity IDE UX pattern — feels like a persistent workspace terminal
- Simpler code path — no timing hacks or initialization delays

**Negative**:
- User must manually type `claude --dangerously-skip-permissions` to start Claude Code
- Task hint text (`taskHint` prop) is displayed as a reminder, but it's an extra step
- If the user forgets to run `claude`, the Build Bot won't execute the task autonomously

## Alternatives Considered

- **Retry with backoff**: Retry Claude Code CLI spawn after detecting exit code 1 — fragile, adds complexity, still fundamentally unreliable
- **Wait for CLI ready signal**: Parse stdout for a "ready" marker before sending task — Claude Code CLI doesn't emit a stable ready signal
- **IPC-based spawn from Electron main process**: Would bypass PTY limitations but requires major architecture change

## Related

- ADR-005: Build Bot PTY no initialInput (precursor to this decision)
- ADR-003: Design Bot dual mode (SSE vs PTY)
- `frontend/src/components/bot/XTerminal.tsx`
- `frontend/src/pages/BotDetailPage.tsx`
- `backend/src/services/ptyService.ts`
