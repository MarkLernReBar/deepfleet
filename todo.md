# DeepFleet TODO

## Data layer
- [x] Schema: fleets, agents, tools, agentTools, subagents, credentials, shares, runs, runSteps, approvals
- [x] Generate + apply migration SQL
- [x] db.ts query helpers for all entities

## Backend (tRPC)
- [x] fleets router (list/create/update/delete)
- [x] agents router (list/get/create/update/delete/clone)
- [x] tools router (list/create/update/delete, admin toggle availability)
- [x] credentials router (list/create/update/delete, shared vs per-user scope)
- [x] shares router (list/grant/revoke; roles viewer/can-run/can-edit/can-clone/owner)
- [x] runs router (trigger/list/get with steps)
- [x] approvals router (inbox list, approve/reject)
- [x] analytics router (overview KPIs, time-series runs & tokens per agent)
- [x] codeExport: generate create_deep_agent() python snippet

## Run orchestration
- [x] SSE streaming endpoint powered by built-in invokeLLM
- [x] Stream + persist run steps: plan, tool_call, tool_result, subagent, message
- [x] HITL: tool_call with requires_approval pauses -> approval inbox -> resume
- [x] Token usage + estimated cost tracking

## Frontend (brutalist monochrome)
- [x] Global theme: grayscale palette, massive heavy headlines, spaced uppercase subtext, overlapping blocks
- [x] DashboardLayout sidebar nav (Shell.tsx)
- [x] Overview dashboard (KPIs + charts)
- [x] Fleets page (CRUD)
- [x] Agents grid (filter by fleet, status, identity badge Claw/Assistant)
- [x] Agent builder wizard (model selector, system prompt, tool picker, subagents, harness options)
- [x] Agent detail (overview, config, runs, sharing, credentials, code export tabs)
- [x] Runs list + run trace timeline viewer (real-time stream)
- [x] Inbox (approvals)
- [x] Tools / MCP catalog (register MCP, requires_approval, admin availability)
- [x] Credentials manager
- [x] Code export view (tab in Agent Detail)

## QA
- [x] vitest specs: codeExport (5 tests) + auth.logout (1 test) — all pass
- [x] seed demo data (fleets, agents, tools, runs) via SQL + seed endpoint
- [x] visual verification via screenshots

## Real deepagents harness worker (bridge)
- [x] Build FastAPI worker that calls create_deep_agent() with the LangChain deepagents harness
- [x] Worker streams real harness steps (plan/tool_call/tool_result/subagent/message) over SSE
- [x] Worker maps DeepFleet agent config (model, system_prompt, tools, subagents, harness, interrupt_on) into create_deep_agent()
- [x] Worker supports HITL interrupt_on approvals and resume
- [x] Worker secured with bearer token
- [x] systemd unit so worker auto-starts on reboot (deepfleet-worker.service)
- [x] Dockerfile for containerized deployment
- [x] DeepFleet: WORKER_URL + WORKER_TOKEN env vars
- [x] DeepFleet: dispatch runs to worker, stream real steps back, persist to DB
- [x] DeepFleet: graceful fallback to built-in engine when worker not configured
- [x] Verified real harness run end-to-end: tool_call (web_search) → tool_result → message persisted

## Documentation
- [x] Comprehensive README.md (features, architecture, quick start, API reference, terminology)
- [x] worker/README.md (setup, Docker, systemd, wiring instructions)
- [x] env.example.txt (all environment variables documented)
- [x] DESIGN.md (product design document)
