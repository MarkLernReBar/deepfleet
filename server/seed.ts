import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { tools as toolsTable } from "../drizzle/schema";
import { BUILTIN_TOOLS, FIRST_PARTY_INTEGRATION_TOOLS, HARNESS_DEFAULTS, estimateCostMicroUsd } from "../shared/catalog";

/**
 * Seed the builtin tool catalog. Idempotent — only inserts tools whose slug
 * does not already exist.
 */
export async function seedBuiltinTools(userId: number): Promise<{ inserted: number }> {
  const d = await getDb();
  if (!d) return { inserted: 0 };
  const existing = await d.select({ slug: toolsTable.slug }).from(toolsTable);
  const have = new Set(existing.map((r) => r.slug));
  let inserted = 0;
  for (const t of BUILTIN_TOOLS) {
    if (have.has(t.slug)) continue;
    await db.createTool({
      name: t.name,
      slug: t.slug,
      description: t.description,
      type: "builtin",
      requiresApproval: t.requiresApproval,
      isAvailable: true,
      createdBy: userId,
    });
    inserted++;
  }
  for (const t of FIRST_PARTY_INTEGRATION_TOOLS) {
    if (have.has(t.slug)) continue;
    await db.createTool({
      name: t.name,
      slug: t.slug,
      description: t.description,
      type: "mcp",
      config: t.config,
      requiresApproval: t.requiresApproval,
      isAvailable: true,
      createdBy: userId,
    });
    inserted++;
  }
  return { inserted };
}

/**
 * Seed a couple of demo fleets, agents, and historical runs so the dashboard
 * has real content. Skips if the user already has fleets.
 */
export async function seedDemoData(userId: number): Promise<{ created: boolean; fleets: number; agents: number }> {
  const d = await getDb();
  if (!d) return { created: false, fleets: 0, agents: 0 };

  const existingFleets = await db.listFleets();
  if (existingFleets.length > 0) {
    return { created: false, fleets: existingFleets.length, agents: 0 };
  }

  const allTools = await db.listTools(false);
  const toolBySlug = new Map(allTools.map((t) => [t.slug, t]));
  const pick = (slugs: string[]) => slugs.map((s) => toolBySlug.get(s)?.id).filter((x): x is number => !!x);

  // Fleet 1 — Research
  const research = await db.createFleet({
    name: "Research Operations",
    description: "Agents that gather, synthesize, and report on external information.",
    color: "#52525b",
    ownerId: userId,
  });
  // Fleet 2 — Support
  const support = await db.createFleet({
    name: "Customer Support",
    description: "Front-line assistant agents that triage and resolve customer questions.",
    color: "#3f3f46",
    ownerId: userId,
  });

  const agentsSpec = [
    {
      fleetId: research!.id,
      name: "Market Analyst",
      description: "Researches markets and competitors, then writes a brief.",
      identityType: "claw" as const,
      modelProvider: "anthropic",
      model: "claude-sonnet-4-6",
      systemPrompt: "You are a meticulous market analyst. Research thoroughly, cite sources, and produce concise briefs.",
      status: "active" as const,
      tools: pick(["web_search", "http_fetch", "write_file"]),
    },
    {
      fleetId: research!.id,
      name: "Data Wrangler",
      description: "Queries databases and produces summary tables.",
      identityType: "claw" as const,
      modelProvider: "openai",
      model: "gpt-5",
      systemPrompt: "You analyze data and produce clear summaries. Prefer tables.",
      status: "active" as const,
      tools: pick(["run_query", "calculator", "write_file"]),
    },
    {
      fleetId: support!.id,
      name: "Support Triager",
      description: "Triages incoming tickets and drafts responses.",
      identityType: "assistant" as const,
      modelProvider: "openai",
      model: "gpt-5-mini",
      systemPrompt: "You are a friendly support agent. Triage issues and draft helpful replies. Escalate when unsure.",
      status: "active" as const,
      tools: pick(["http_fetch", "send_email"]),
    },
  ];

  const createdAgents = [];
  for (const spec of agentsSpec) {
    const agent = await db.createAgent({
      fleetId: spec.fleetId,
      name: spec.name,
      description: spec.description,
      identityType: spec.identityType,
      modelProvider: spec.modelProvider,
      model: spec.model,
      systemPrompt: spec.systemPrompt,
      status: spec.status,
      harness: HARNESS_DEFAULTS,
      skills: [],
      memory: [],
      createdBy: userId,
    });
    if (agent) {
      await db.setAgentTools(agent.id, spec.tools);
      await db.createShare({ agentId: agent.id, principalType: "user", principalUserId: userId, role: "owner", grantedBy: userId });
      createdAgents.push(agent);
    }
  }

  // Subagent example for Market Analyst
  if (createdAgents[0]) {
    await db.setSubagents(createdAgents[0].id, [
      {
        name: "fact-checker",
        description: "Verifies claims against sources.",
        prompt: "Verify each claim and flag anything unsupported.",
        model: "claude-haiku-4-5",
        tools: ["web_search"],
      },
    ]);
  }

  // Seed historical runs across the last 10 days for charts.
  const now = Date.now();
  for (let i = 0; i < 24; i++) {
    const agent = createdAgents[i % createdAgents.length];
    if (!agent) continue;
    const daysAgo = Math.floor(Math.random() * 10);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 12) * 3600_000);
    const totalTokens = 800 + Math.floor(Math.random() * 6000);
    const promptTokens = Math.floor(totalTokens * 0.4);
    const succeeded = Math.random() > 0.15;
    await db.createRun({
      agentId: agent.id,
      fleetId: agent.fleetId,
      input: "Demo run: analyze the request and produce a result.",
      output: succeeded ? "Completed successfully." : null,
      status: succeeded ? "succeeded" : "failed",
      model: agent.model,
      promptTokens,
      completionTokens: totalTokens - promptTokens,
      totalTokens,
      costMicroUsd: estimateCostMicroUsd(agent.model, totalTokens),
      errorMessage: succeeded ? null : "Tool timeout",
      triggeredBy: userId,
      startedAt: createdAt,
      endedAt: new Date(createdAt.getTime() + 12000),
      createdAt,
    });
  }

  return { created: true, fleets: 2, agents: createdAgents.length };
}

// silence unused import in some build configs
void eq;
