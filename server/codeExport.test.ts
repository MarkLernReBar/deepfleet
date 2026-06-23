import { describe, expect, it } from "vitest";
import { generateAgentCode } from "./codeExport";
import { toProviderModelString } from "../shared/catalog";
import type { Agent, Subagent } from "../drizzle/schema";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 1,
    fleetId: 1,
    ownerId: 1,
    name: "Market Analyst",
    description: "Analyzes markets",
    identityType: "Claw",
    status: "active",
    modelProvider: "anthropic",
    model: "claude-sonnet-4-6",
    systemPrompt: "You are a careful market analyst.",
    harness: { planning: true, filesystem: true, memory: false, skills: false },
    skills: [],
    memory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Agent;
}

describe("generateAgentCode", () => {
  it("emits a create_deep_agent() snippet reflecting model, prompt and tools", () => {
    const code = generateAgentCode(
      makeAgent(),
      [
        { slug: "web_search", type: "builtin" },
        { slug: "http_fetch", type: "builtin" },
      ],
      []
    );

    expect(code).toContain("from deepagents import create_deep_agent");
    expect(code).toContain("agent = create_deep_agent(");
    // provider:model string is used by the deepagents harness
    expect(code).toContain('model="anthropic:claude-sonnet-4-6"');
    expect(code).toContain('system_prompt="You are a careful market analyst."');
    expect(code).toContain("def web_search(");
    expect(code).toContain("def http_fetch(");
    expect(code).toContain("tools=[web_search, http_fetch]");
    expect(code).toContain('name="Market Analyst"');
  });

  it("includes subagents and MCP servers when present", () => {
    const subagents: Subagent[] = [
      {
        id: 1,
        agentId: 1,
        name: "writer",
        description: "Writes summaries",
        prompt: "You write concise summaries.",
        model: null,
        tools: [],
        createdAt: new Date(),
      } as unknown as Subagent,
    ];

    const code = generateAgentCode(
      makeAgent(),
      [
        { slug: "web_search", type: "builtin" },
        {
          slug: "github_mcp",
          type: "mcp",
          config: { serverUrl: "https://mcp.example.com", transport: "streamable_http" },
        },
      ],
      subagents
    );

    expect(code).toContain("from deepagents import SubAgent");
    expect(code).toContain("MultiServerMCPClient({");
    expect(code).toContain('"github_mcp": {"url": "https://mcp.example.com"');
    expect(code).toContain("*mcp_tools");
    expect(code).toContain("subagents=subagents,");
    expect(code).toContain('"name": "writer"');
    expect(code).toContain('"prompt": "You write concise summaries."');
  });

  it("includes skills only when the harness enables them", () => {
    const withSkills = generateAgentCode(
      makeAgent({
        harness: { planning: true, filesystem: true, memory: false, skills: true } as Agent["harness"],
        skills: ["pdf", "excel"] as unknown as Agent["skills"],
      }),
      [{ slug: "web_search", type: "builtin" }],
      []
    );
    expect(withSkills).toContain('skills=["pdf", "excel"]');

    const withoutSkills = generateAgentCode(
      makeAgent({
        harness: { planning: true, filesystem: true, memory: false, skills: false } as Agent["harness"],
        skills: ["pdf"] as unknown as Agent["skills"],
      }),
      [{ slug: "web_search", type: "builtin" }],
      []
    );
    expect(withoutSkills).not.toContain("skills=[");
  });
});

describe("toProviderModelString", () => {
  it("maps each provider to the deepagents provider:model convention", () => {
    expect(toProviderModelString("anthropic", "claude-sonnet-4-6")).toBe("anthropic:claude-sonnet-4-6");
    expect(toProviderModelString("openai", "gpt-5.5")).toBe("openai:gpt-5.5");
    // Gemini maps to LangChain's google_genai provider prefix
    expect(toProviderModelString("gemini", "gemini-3.1-pro-preview")).toBe(
      "google_genai:gemini-3.1-pro-preview"
    );
  });

  it("falls back to the raw provider id for custom providers", () => {
    expect(toProviderModelString("custom", "my-model")).toBe("custom:my-model");
  });
});
