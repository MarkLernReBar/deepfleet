import { describe, expect, it } from "vitest";
import { isCronDue } from "./scheduleCron";

describe("isCronDue", () => {
  it("returns true when a minute-bound cron fired since lastRunAt", () => {
    const now = new Date("2026-06-23T09:01:00Z");
    const lastRunAt = new Date("2026-06-23T09:00:00Z");
    expect(isCronDue("* * * * *", lastRunAt, now)).toBe(true);
  });

  it("returns false when the next fire is still in the future", () => {
    const now = new Date("2026-06-23T08:30:00Z");
    const lastRunAt = new Date("2026-06-23T08:00:00Z");
    expect(isCronDue("0 9 * * *", lastRunAt, now)).toBe(false);
  });

  it("returns true for first run within the current minute window", () => {
    const now = new Date("2026-06-23T09:01:00Z");
    expect(isCronDue("0 9 * * *", null, now)).toBe(true);
  });

  it("returns false for invalid cron expressions", () => {
    expect(isCronDue("not-a-cron", null, new Date())).toBe(false);
  });
});
