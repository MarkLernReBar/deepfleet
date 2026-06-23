## Learned User Preferences

- Primary product goal is 1:1 parity with LangSmith Fleet features and UX patterns.
- Uses "go", "proceed", and "GO for everything" to mean run autonomously end-to-end without asking for permission on reversible work.
- Often attaches poteto-mode for multi-step DeepFleet implementation work.
- Expects agents to verify with real commands (`pnpm check`, `pnpm test`, `pnpm build`) before declaring work done.
- Local deepagents example project lives at `/Users/marklerner/deepagents_phase1_researcher` (not `phase1_deepagents_researcher`).

## Learned Workspace Facts

- DeepFleet is an open-source LangSmith Fleet clone for LangChain deepagents; GitHub remote is `MarkLernReBar/deepfleet`.
- Monorepo layout: `client/` (React+Vite), `server/` (Express+tRPC), `drizzle/`, `shared/`, `worker/` (Python FastAPI sidecar).
- Built on Manus WebDev scaffold (tRPC, Drizzle, Vite, OAuth); the flat export was reorganized using `dominhduy09/minigpt-showcase` for missing `_core` files.
- This workspace has no `scripts/factory` (Surface Factory coordinator sync is not available here).
- Agents are stored in MySQL via Drizzle; there is no import path from local Python deepagents projects (export to Python only).
- Python worker runs `create_deep_agent()` when `WORKER_URL`/`WORKER_TOKEN` are set; otherwise the server falls back to the built-in TypeScript run engine.
- Fleet parity shipped Phases 1–3: subagents/skills/custom models/memory, schedules/channels/chat, templates/graph/LangSmith trace links.
- Dev stack: Node 22+, pnpm, MySQL-compatible DB; local smoke used Docker MySQL on port 3307.
- Worker only resolves known tool slugs from the catalog/MCP; custom `@tool` Python code requires MCP registration or worker extension.
