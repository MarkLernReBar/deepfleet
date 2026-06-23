# Fleet Parity — Phase 1 Plan

Target: LangSmith Fleet essentials parity for agent spec editing (subagents, skills, models, memory).

Reference: LangSmith Fleet agent editor (graph nodes: Agent, Toolbox, Sub-agents, Skills, Schedule, Channels).

## Task 1: Subagent editor — model + tool subset (Fleet parity)

**Requirements:**
- In `client/src/pages/AgentBuilder.tsx` step "Subagents" (step index 4), each subagent panel MUST include:
  - **Model** field: optional text `Input` with placeholder `Inherit orchestrator model (leave empty)`. Stored in `SubAgentDraft.model`. Empty string means inherit (worker already omits model when falsy).
  - **Tools** multi-select: checkbox list from `trpc.fleet.tools.list({ onlyAvailable: true })`, storing **tool slugs** in `SubAgentDraft.tools[]` (not tool IDs). Match the visual pattern used in step "Tools" (step 3).
  - Helper text: "Leave model empty to use the orchestrator's model. Tools restrict what this subagent can call."
- In `client/src/pages/AgentDetail.tsx` "Tools & Subagents" tab, each subagent card MUST show:
  - Model (or "Inherits orchestrator" when empty)
  - Tool slugs as Tags (or "All orchestrator tools" when empty)
- **No backend changes** unless a bug is found — `fleetRouter` `subagentInput` already accepts `model` and `tools: string[]`.
- Run `pnpm check` — must pass.
- Do NOT commit (controller commits after review).

**Acceptance:**
- Create/edit agent with subagent that has custom model + tool subset persists via existing API.
- Agent detail displays model and tools.

## Task 2: Skills as first-class workspace entities

**Requirements:**
- Add `skills` table: `id`, `slug` (unique), `name`, `description`, `content` (text, SKILL.md body), `createdBy`, timestamps.
- Drizzle migration SQL in `drizzle/migrations/`.
- tRPC router `fleet.skills`: list, get, create, update, delete.
- New page `client/src/pages/Skills.tsx` + nav link in `Shell.tsx` (match Fleet sidebar "Skills").
- Agent builder: replace comma-separated skills input with multi-select of workspace skills (by slug).
- Worker: pass skill slugs in AgentSpec (already supported); mount skill content via env `DEEPFLEET_SKILLS_DIR` optional — document in worker README only for this task.
- Tests: at least one vitest for skills router slug validation.

## Task 3: Custom model registry

**Requirements:**
- Add `customModels` table: `id`, `modelId`, `displayName`, `baseUrl`, `apiKeyEnvVar` (name only, not secret value), `provider` enum, `createdBy`, timestamps.
- tRPC `fleet.models`: list, create, delete (admin or owner).
- Agent builder Model step: "+ Add custom model" opens dialog; saved models appear in provider/model picker alongside catalog defaults.
- `server/_core/env.ts` / worker: use custom model config when agent references a registered custom model id.
- Tests for model registry CRUD.

## Task  4: Memory workspace (AGENTS.md)

**Requirements:**
- Add `agentFiles` table or use object storage path pattern: per-agent `memories/AGENTS.md` content in DB blob.
- Agent detail tab "Memory" showing AGENTS.md editor (textarea + save).
- Worker `CompositeBackend` or equivalent: inject `AGENTS.md` into system prompt when memory harness enabled (match Fleet docs).
- Setting on agent: `memoryApprovalRequired` boolean (default true); wire to HITL on write_file if feasible in worker, else document as follow-up.

**Out of scope for Phase 1:** schedules, channels (Gmail/Slack), chat threads, graph editor, LangSmith trace export.
