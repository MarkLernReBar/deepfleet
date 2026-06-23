import { listEnabledSchedules, updateAgentSchedule } from "./db";
import { isCronDue } from "./scheduleCron";
import { runScheduledAgent } from "./scheduledRun";

const TICK_MS = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

async function tickSchedules(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const rows = await listEnabledSchedules();
    const now = new Date();
    for (const { schedule } of rows) {
      if (!isCronDue(schedule.cronExpression, schedule.lastRunAt, now)) continue;
      await updateAgentSchedule(schedule.id, { lastRunAt: now });
      try {
        await runScheduledAgent(schedule.agentId, schedule.prompt, schedule.createdBy);
      } catch (err) {
        console.error("[ScheduleRunner] Failed scheduled run:", schedule.id, err);
      }
    }
  } catch (err) {
    console.error("[ScheduleRunner] Tick failed:", err);
  } finally {
    ticking = false;
  }
}

export function startScheduleRunner(): void {
  if (timer) return;
  void tickSchedules();
  timer = setInterval(() => {
    void tickSchedules();
  }, TICK_MS);
}
