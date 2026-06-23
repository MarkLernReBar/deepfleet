# Fleet Parity — Phase 2 Plan

Target: Schedules, Channels, Chat threads (Fleet sidebar essentials).

## Task 5: Agent schedules + cron runner ✅

- `agentSchedules` table + migration
- `agents.triggersPaused` boolean
- CRUD `fleet.schedules` on agent
- In-process `scheduleRunner` ticks every 60s, fires scheduled runs
- AgentDetail **Schedules** tab + Pause triggers toggle

## Task 6: Channels + Chat threads ✅

- `agentChannels`, `chatThreads`, `chatMessages` tables + migration
- CRUD `fleet.channels`, `fleet.chat.*`
- `/chat` page (Fleet-style agent + thread + message UI)
- AgentDetail **Channels** tab (chat on by default, Slack/Gmail connect stubs)
- Post final run output to active chat thread when chat channel enabled
