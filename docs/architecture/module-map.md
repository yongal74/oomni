# OOMNI v3 — 모듈 맵

> v3.0.0 목표 상태 (삭제 완료 후)

```
oomni/
├── CLAUDE.md                          # 핵심 규칙 (200줄 이내)
├── .claude/
│   ├── settings.json                  # Hooks 설정
│   └── rules/
│       ├── 00-global.md
│       ├── 10-db.md
│       ├── 20-api.md
│       ├── 30-frontend.md
│       ├── 40-bot.md
│       ├── 50-release.md
│       └── 60-doc-sync.md
│
├── docs/
│   ├── prd/PRD-v2.md
│   ├── architecture/
│   │   ├── system-context.md
│   │   ├── module-map.md              ← 이 파일
│   │   └── code-audit.md
│   ├── wbs/WBS-v3.0.0.md
│   └── standards/feature-ids.md
│
├── electron/
│   └── main.js                        # KEEP — 윈도우/IPC/EADDRINUSE 처리
│
├── backend/src/
│   ├── index.ts                       # KEEP
│   ├── config.ts                      # KEEP
│   ├── logger.ts                      # KEEP
│   │
│   ├── db/
│   │   ├── client.ts                  # REWRITE → 100줄 (migration 제거)
│   │   ├── schema.ts                  # REWRITE → 200줄 (SCHEMA_SQL만)
│   │   └── types.ts                   # KEEP
│   │
│   ├── api/
│   │   ├── app.ts                     # KEEP (삭제 라우터 import 제거)
│   │   └── routes/
│   │       ├── agents.ts              # KEEP
│   │       ├── missions.ts            # KEEP
│   │       ├── feed.ts                # KEEP
│   │       ├── auth.ts                # REWRITE → PIN 전용 (OAuth 제거)
│   │       ├── settings.ts            # KEEP
│   │       ├── cost.ts                # KEEP
│   │       ├── issues.ts              # KEEP
│   │       ├── schedules.ts           # KEEP
│   │       ├── reports.ts             # KEEP
│   │       ├── research.ts            # KEEP
│   │       ├── ceo.ts                 # KEEP (Dashboard 통합용)
│   │       ├── templates.ts           # KEEP
│   │       ├── design-systems.ts      # KEEP
│   │       ├── integrations.ts        # KEEP
│   │       ├── obsidian.ts            # KEEP
│   │       ├── webhooks.ts            # KEEP
│   │       └── backup.ts              # KEEP
│   │       # ❌ n8n.ts — 삭제
│   │       # ❌ video.ts — 삭제
│   │       # ❌ payments.ts — 삭제
│   │       # ❌ cdp.ts — 삭제
│   │       # ❌ devtools.ts — 삭제
│   │
│   ├── services/
│   │   ├── claudeCodeService.ts       # KEEP
│   │   ├── claudeCodeExecutor.ts      # KEEP
│   │   ├── ptyService.ts              # KEEP
│   │   ├── parallelExecutor.ts        # KEEP
│   │   └── roleExecutors/
│   │       ├── base.ts                # KEEP
│   │       ├── research.ts            # KEEP
│   │       ├── content.ts             # KEEP
│   │       ├── growth.ts              # KEEP
│   │       ├── ops.ts                 # KEEP
│   │       ├── ceo.ts                 # KEEP
│   │       ├── build.ts               # KEEP
│   │       ├── design.ts              # KEEP
│   │       └── index.ts               # KEEP
│   │       # ❌ videoService.ts — 삭제
│   │
│   ├── agents/
│   │   ├── heartbeat.ts               # KEEP
│   │   ├── runner.ts                  # KEEP
│   │   └── llm-provider.ts            # KEEP
│   │   # ❌ bots/n8n.ts — 삭제
│   │   # ❌ bots/integration.ts — 삭제
│   │
│   ├── ws/server.ts                   # KEEP
│   ├── crypto/vault.ts                # KEEP
│   └── middleware/
│       ├── apiError.ts                # KEEP
│       └── requireAuth.ts             # KEEP
│
└── frontend/src/
    ├── router.tsx                     # KEEP (DevTools 라우트 제거)
    ├── store/app.store.ts             # KEEP
    │
    ├── pages/
    │   ├── DashboardPage.tsx          # KEEP (CEO Bot 통합)
    │   ├── UnifiedBotPage.tsx         # NEW (Research/Content/Growth)
    │   ├── PtyBotPage.tsx             # NEW (Build/Design/Ops)
    │   ├── ResearchPage.tsx           # KEEP
    │   ├── OnboardingPage.tsx         # KEEP
    │   ├── SettingsPage.tsx           # KEEP
    │   ├── ApprovalPage.tsx           # KEEP
    │   ├── IssuesPage.tsx             # KEEP
    │   ├── SchedulePage.tsx           # KEEP
    │   ├── CostPage.tsx               # KEEP
    │   ├── ReportPage.tsx             # KEEP
    │   ├── IntegrationsPage.tsx       # KEEP
    │   ├── MonitoringPage.tsx         # KEEP (검토 후 결정)
    │   ├── PipelinePage.tsx           # KEEP
    │   └── PinPage.tsx                # KEEP
    │   # ❌ BotDetailPage.tsx — 삭제 (UnifiedBotPage + PtyBotPage로 교체)
    │   # ❌ CeoBotPage.tsx — 삭제 (Dashboard 통합)
    │   # ❌ DevToolsPage.tsx — 삭제
    │
    ├── components/
    │   ├── layout/AppLayout.tsx       # KEEP
    │   ├── BotRunModal.tsx            # KEEP
    │   ├── BotRunHistory.tsx          # KEEP
    │   ├── BotStreamOutput.tsx        # KEEP
    │   └── bot/
    │       ├── XTerminal.tsx          # KEEP
    │       ├── PipelineBar.tsx        # KEEP
    │       ├── ModelSwitcher.tsx      # KEEP
    │       ├── shared/                # KEEP
    │       └── panels/
    │           ├── ResearchPanel.tsx  # KEEP
    │           ├── ContentPanel.tsx   # KEEP
    │           ├── BuildPanel.tsx     # KEEP
    │           ├── DesignPanel.tsx    # KEEP
    │           ├── GrowthPanel.tsx    # KEEP
    │           ├── OpsPanel.tsx       # KEEP
    │           ├── CeoPanel.tsx       # KEEP (Dashboard용)
    │           └── GenericPanel.tsx   # KEEP
    │       # ❌ LiveStreamDrawer.tsx — 삭제
    │       # ❌ video/ — 삭제
    │
    ├── lib/
    │   ├── api.ts                     # KEEP (video/cdp/payments import 제거)
    │   ├── ws.ts                      # KEEP
    │   └── notifications.ts           # KEEP
    │   # ❌ firebase.ts — 삭제
    │
    └── hooks/useAuth.ts               # KEEP
```
