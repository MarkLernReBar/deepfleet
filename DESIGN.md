# DeepFleet — Open-source Fleet management for DeepAgent agents

An open-source, self-hostable clone of **LangSmith Fleet** for building, running,
sharing, governing, and observing a fleet of **LangChain `deepagents`** agents.

## 1. What we are cloning (LangSmith Fleet feature map)

| Fleet capability | DeepFleet implementation |
| --- | --- |
| **Create** agents from a prompt (no-code) | Agent builder form: name, description, model, system prompt, tools, sub-agents |
| **Fleet** = central workspace of agents | Dashboard listing all agents grouped by fleet/team |
| **Two agent identity types** (Claw = shared creds / Assistant = per-user creds) | `identity_type` field: `claw` \| `assistant` |
| **Tiered permissions & sharing** (can clone / can run / can edit) | Per-agent share records with role: `viewer/run/edit/owner` |
| **Agent identity & credentials** (OAuth / service account) | Credential records attached to agents + tools |
| **Connect tools securely** (first-party + remote MCP) | Tool catalog: builtin tools + MCP server registry |
| **Inbox** (human-in-the-loop approvals) | Approval inbox: pending tool calls awaiting approve/reject |
| **Observability** (native tracing, audit trail) | Run traces: every step, tool call, decision captured & inspectable |
| **Model neutral** | Model selector: OpenAI / Anthropic / Gemini / custom |
| **Admin & access controls** | Roles, usage tracking, tool access controls |
| **Extend with code / API** | REST API + export agent config as `deepagents` Python file |

## 2. deepagents config we model (the "agent spec")

`create_deep_agent(model=..., tools=[...], system_prompt=..., subagents=[...])`

Agent spec fields:
- `model` — e.g. `openai:gpt-5.5`, `anthropic:claude-sonnet-4-6`
- `system_prompt`
- `tools` — builtin (web search, fetch, run query, filesystem) + MCP server tools
- `subagents` — named specialized agents with own prompt/tools (delegation)
- harness features: planning (todos), virtual filesystem, context mgmt, HITL approvals, skills, memory

## 3. Core entities / data model

- **User** — auth (provided by scaffold OAuth).
- **Fleet** — a workspace/group of agents (id, name, description, owner).
- **Agent** — the agent spec (fleet_id, name, description, identity_type, model,
  system_prompt, status, tools[], subagents[], created_by).
- **Tool** — catalog entry (builtin or MCP). Fields: name, type(`builtin`|`mcp`),
  description, config(JSON, e.g. mcp server url), requires_approval.
- **AgentTool** — join: which tools an agent has, with `requires_approval` override.
- **Subagent** — name, description, prompt, model, tools[], parent agent_id.
- **Credential** — name, provider, scope(`shared`/`per_user`), masked secret.
- **Share** — agent_id, principal(user or "workspace"), role(viewer/run/edit/clone/owner).
- **Run** — execution of an agent. agent_id, status(queued/running/awaiting_approval/
  succeeded/failed/cancelled), input, output, started/ended, token usage, cost.
- **RunStep** (trace) — run_id, idx, type(message/plan/tool_call/tool_result/subagent/
  decision), name, content(JSON), tokens, duration_ms, status.
- **Approval** (inbox item) — run_id, step, tool_name, args, status(pending/approved/
  rejected), decided_by, decided_at.
- **UsageEvent** — for usage tracking dashboards.

## 4. Pages (UI)

1. **Dashboard / Overview** — fleet KPIs: # agents, runs today, success rate, tokens, cost, charts.
2. **Fleets** — list & create fleets.
3. **Agents** — grid of agent cards (status, model, identity badge, owner). Filter by fleet.
4. **Agent detail** — tabs: Overview, Configuration (model/prompt/tools/subagents),
   Runs, Sharing & Permissions, Credentials, Code export.
5. **Agent builder** — create/edit agent (no-code form + advanced).
6. **Runs** — global run list with status, filterable; run detail = trace timeline viewer.
7. **Inbox** — pending approvals across the fleet; approve/reject.
8. **Tools / MCP** — tool catalog + register MCP servers.
9. **Observability / Usage** — charts: runs over time, tokens, cost, per-agent leaderboard.
10. **Settings** — credentials, members/roles.

## 5. Run orchestration

The platform must actually *run* deepagents. Approach:
- A Python **agent runner service** (FastAPI) that wraps `deepagents.create_deep_agent`,
  streams steps, and persists trace + token usage. Uses `OPENAI_API_KEY` already in env.
- The web backend creates a Run row, calls the runner, runner streams RunSteps back,
  honoring HITL approvals (pause -> Approval row -> resume).
- Builtin demo tools (web_search stub via Tavily-like, calculator, http_fetch) so runs
  work end-to-end without external setup. No mocks for the LLM call itself — real model
  calls through the provided OpenAI-compatible endpoint.

## 6. Tech stack
Decide after `webdev_init_project` (web-db-user scaffold: React+TS+Tailwind, Drizzle+MySQL,
S3, OAuth). The deepagents runner is a separate Python sidecar service the web app calls.
