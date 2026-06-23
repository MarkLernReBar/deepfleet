import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../drizzle/schema";
import { buildSpec } from "./workerBridge";

vi.mock("./db", () => ({
  getAgent: vi.fn(),
  getAgentTools: vi.fn(),
  getSubagents: vi.fn(),
  getCustomModelByModelId: vi.fn(),
}));

import { getAgent, getAgentTools, getSubagents } from "./db";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 42,
    fleetId: 1,
    name: "Memory Agent",
    description: null,
    identityType: "claw",
    modelProvider: "openai",
    model: "gpt-5",
    systemPrompt: "You are helpful.",
    status: "active",
    harness: { planning: true, filesystem: true, memory: true, skills: false, summarization: false },
    skills: [],
    memory: [],
    memoryContent: "# Agent notes\nPrefer concise answers.",
    memoryApprovalRequired: true,
    credentialId: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Agent;
}

describe("buildSpec memory fields", () => {
  beforeEach(() => {
    vi.mocked(getAgentTools).mockResolvedValue([]);
    vi.mocked(getSubagents).mockResolvedValue([]);
  });

  it("includes memory_content and memory_approval_required when harness.memory is enabled", async () => {
    vi.mocked(getAgent).mockResolvedValue(makeAgent());

    const { payload } = await buildSpec(42, "Hello");

    expect(payload.memory_content).toBe("# Agent notes\nPrefer concise answers.");
    expect(payload.memory_approval_required).toBe(true);
    expect(payload.harness.memory).toBe(true);
  });

  it("omits memory fields when harness.memory is disabled", async () => {
    vi.mocked(getAgent).mockResolvedValue(
      makeAgent({
        harness: { planning: true, filesystem: true, memory: false, skills: false, summarization: false },
        memoryContent: "Should not be sent",
      })
    );

    const { payload } = await buildSpec(42, "Hello");

    expect(payload).not.toHaveProperty("memory_content");
    expect(payload).not.toHaveProperty("memory_approval_required");
  });
});
