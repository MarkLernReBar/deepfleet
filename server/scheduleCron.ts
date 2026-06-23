import { CronExpressionParser } from "cron-parser";

const PARSE_OPTS = { tz: "UTC" } as const;

/**
 * Returns true when the cron expression has a fire time after `lastRunAt`
 * (or within the last minute if never run) that is at or before `now`.
 */
export function isCronDue(cronExpression: string, lastRunAt: Date | null, now: Date = new Date()): boolean {
  try {
    if (lastRunAt === null) {
      const expr = CronExpressionParser.parse(cronExpression, { ...PARSE_OPTS, currentDate: now });
      const prevRun = expr.prev().toDate();
      return now.getTime() - prevRun.getTime() <= 60_000;
    }
    const expr = CronExpressionParser.parse(cronExpression, { ...PARSE_OPTS, currentDate: lastRunAt });
    const nextRun = expr.next().toDate();
    return nextRun.getTime() <= now.getTime();
  } catch {
    return false;
  }
}
