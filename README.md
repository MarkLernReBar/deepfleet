# DeepFleet

Open-source fleet management for LangChain **deepagents**. Build, run, share, govern, and observe a fleet of agents from a self-hostable web app.

See [DESIGN.md](./DESIGN.md) for the product spec and feature map.

## Repository layout

```
deepfleet/
├── client/                 React + Vite frontend (brutalist UI)
│   └── src/
│       ├── pages/          Chat, Overview, Agents, Runs, Inbox, Skills, …
│       ├── components/     Shell, brutal design system, shadcn/ui
│       └── lib/            tRPC client, SSE run stream helper
├── server/                 Express + tRPC backend
│   ├── routers.ts          Auth + fleet router mount
│   ├── fleetRouter.ts      Fleets, agents, runs, approvals, analytics
│   ├── orchestrator.ts     Built-in run engine (LLM loop)
│   ├── workerBridge.ts     Optional deepagents Python worker dispatch
│   ├── runStream.ts        POST /api/runs/stream SSE endpoint
│   └── _core/              OAuth, Vite bridge, LLM gateway, session SDK
├── drizzle/
│   ├── schema.ts           MySQL schema (fleets, agents, runs, …)
│   └── migrations/
├── shared/                 Types and catalogs shared by client + server
├── worker/                 Python FastAPI deepagents harness sidecar
│   └── deepfleet_worker/
└── docs/                   Reference docs (Manus persistent computing, etc.)
```

## Quick start (web app)

Requires Node 22+, pnpm, and a MySQL-compatible database.

```bash
pnpm install
cp .env.example .env        # fill DATABASE_URL, JWT_SECRET, OAuth, LLM keys
pnpm db:push                # sync schema (or: npx drizzle-kit migrate)
pnpm dev                    # http://localhost:3000
```

## Optional deepagents worker

For real `create_deep_agent()` runs instead of the built-in TypeScript engine, start the Python worker and set `WORKER_URL` + `WORKER_TOKEN`. See [worker/README.md](./worker/README.md).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server (Vite + Express) |
| `pnpm build` | Production build |
| `pnpm start` | Run production server |
| `pnpm check` | TypeScript check |
| `pnpm test` | Vitest (server tests) |
| `pnpm db:push` | Sync schema via Drizzle (`generate` + `migrate`) |

## Fleet parity (Phases 1–2)

Phase 1: subagent model/tools UI, workspace skills, custom model registry, AGENTS.md memory.

Phase 2: cron schedules + pause triggers, channels (chat/Slack/Gmail stubs), threaded chat at `/chat`.

Phase 3: templates gallery, agent graph view, LangSmith trace links, channel credential wiring.

Plan docs: [docs/plans/fleet-parity-phase-1.md](./docs/plans/fleet-parity-phase-1.md), [docs/plans/fleet-parity-phase-2.md](./docs/plans/fleet-parity-phase-2.md), [docs/plans/fleet-parity-phase-3.md](./docs/plans/fleet-parity-phase-3.md).

## Environment

Copy `.env.example` to `.env`. Key variables:

- `DATABASE_URL` — MySQL connection string
- `JWT_SECRET` — session cookie signing secret
- `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` — Manus OAuth (or your OAuth provider)
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — LLM gateway for the built-in run engine
- `WORKER_URL`, `WORKER_TOKEN` — optional Python deepagents worker

## License

MIT
