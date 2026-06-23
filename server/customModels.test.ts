import { describe, expect, it } from "vitest";
import { isValidModelId } from "./customModels";

describe("isValidModelId", () => {
  it("accepts non-empty model ids", () => {
    expect(isValidModelId("deepseek/deepseek-v4-pro")).toBe(true);
    expect(isValidModelId("my-org/my-model")).toBe(true);
    expect(isValidModelId("gpt-4o")).toBe(true);
  });

  it("rejects empty model ids", () => {
    expect(isValidModelId("")).toBe(false);
    expect(isValidModelId("   ")).toBe(false);
  });
});
