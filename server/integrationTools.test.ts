import { describe, expect, it } from "vitest";
import { FIRST_PARTY_INTEGRATION_TOOLS } from "../shared/catalog";

describe("FIRST_PARTY_INTEGRATION_TOOLS", () => {
  it("includes gmail slack tavily and calendar entries", () => {
    const slugs = FIRST_PARTY_INTEGRATION_TOOLS.map((t) => t.slug);
    expect(slugs).toContain("gmail_read");
    expect(slugs).toContain("gmail_send");
    expect(slugs).toContain("slack_post");
    expect(slugs).toContain("tavily_search");
    expect(slugs).toContain("google_calendar");
  });
});
