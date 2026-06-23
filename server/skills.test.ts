import { describe, expect, it } from "vitest";
import { isValidSkillSlug, SKILL_SLUG_PATTERN } from "./skills";

describe("isValidSkillSlug", () => {
  it("accepts lowercase alphanumeric slugs with hyphens", () => {
    expect(isValidSkillSlug("research")).toBe(true);
    expect(isValidSkillSlug("research-notes")).toBe(true);
    expect(isValidSkillSlug("pdf-v2")).toBe(true);
    expect(isValidSkillSlug("a1-b2-c3")).toBe(true);
  });

  it("rejects invalid slug formats", () => {
    expect(isValidSkillSlug("")).toBe(false);
    expect(isValidSkillSlug("Research")).toBe(false);
    expect(isValidSkillSlug("research_notes")).toBe(false);
    expect(isValidSkillSlug("research notes")).toBe(false);
    expect(isValidSkillSlug("-research")).toBe(false);
    expect(isValidSkillSlug("research-")).toBe(false);
    expect(isValidSkillSlug("research--notes")).toBe(false);
    expect(isValidSkillSlug("research.")).toBe(false);
  });

  it("uses a stable exported pattern", () => {
    expect(SKILL_SLUG_PATTERN.test("valid-slug")).toBe(true);
    expect(SKILL_SLUG_PATTERN.test("Bad_Slug")).toBe(false);
  });
});
