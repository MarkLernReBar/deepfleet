# Fleet Parity — Phase 4 Plan

Target: Close observability and channel integration gaps left after Phase 3.

## Done predicate (falsifiable)

1. Worker `done` SSE includes `langsmith_run_id` when LangSmith tracing is active; DeepFleet persists it and Run trace link works when `LANGSMITH_ORG` + `LANGSMITH_PROJECT` are set.
2. First-party Gmail, Slack, Tavily tools appear in Tools catalog (MCP type) after seed.
3. Slack/Gmail **Connect** buttons start OAuth when server env is configured; callback stores OAuth credential and links channel `config.credentialId`.
4. `pnpm check`, `pnpm test`, `pnpm build` pass.

## Out of scope (Phase 5)

- Editable drag-and-drop graph editor (read-only graph shipped in Phase 3).
- Live inbound Slack/Gmail webhooks and message delivery.
- Full MCP server implementations for Gmail/Slack (catalog + OAuth wiring only).

## Task 11: Worker LangSmith run id ✅

## Task 12: First-party integration tools ✅

## Task 13: OAuth connect for channels ✅

## Task 14: Channels Connect UI ✅
