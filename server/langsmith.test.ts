import { describe, expect, it } from "vitest";
import { buildLangSmithTraceUrl } from "../shared/langsmith";

describe("buildLangSmithTraceUrl", () => {
  it("returns null when org or project missing", () => {
    expect(buildLangSmithTraceUrl("run-1", { org: "acme" })).toBeNull();
    expect(buildLangSmithTraceUrl("run-1", { project: "fleet" })).toBeNull();
  });

  it("builds URL with org, project, and run id", () => {
    const url = buildLangSmithTraceUrl("abc-123", { org: "my-org", project: "deepfleet" });
    expect(url).toContain("smith.langchain.com");
    expect(url).toContain("abc-123");
    expect(url).toContain("my-org");
    expect(url).toContain("deepfleet");
  });
});
