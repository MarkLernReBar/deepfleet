# Fleet Parity — Phase 3 Plan

Target: Templates, graph view, observability links, channel credential wiring.

## Task 7: Agent templates gallery ✅

- Built-in templates in `shared/agentTemplates.ts`
- tRPC `fleet.templates.list` + `fleet.templates.instantiate`
- `/templates` page + nav link
- "Browse templates" from Agents page

## Task 8: Agent graph view (read-only) ✅

- `AgentGraph` component mirroring Fleet editor nodes
- **Graph** tab on Agent detail

## Task 9: LangSmith trace linking ✅

- `runs.langsmithRunId` column
- URL builder from `LANGSMITH_ORG` / `LANGSMITH_PROJECT` env
- Worker `done` event may include `langsmith_run_id`
- Run trace page "Open in LangSmith" link

## Task 10: Channel credential connect ✅

- Credential provider presets (gmail, slack, google_calendar, tavily)
- Channels tab links Slack/Gmail to stored credentials via channel `config.credentialId`
