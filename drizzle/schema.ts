import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* ------------------------------------------------------------------ */
/* Fleets — workspaces grouping agents                                 */
/* ------------------------------------------------------------------ */
export const fleets = mysqlTable(
  "fleets",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 16 }).default("#3f3f46"),
    ownerId: int("ownerId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({ ownerIdx: index("fleets_owner_idx").on(t.ownerId) })
);

export type Fleet = typeof fleets.$inferSelect;
export type InsertFleet = typeof fleets.$inferInsert;

/* ------------------------------------------------------------------ */
/* Agents — the deepagents spec                                        */
/* ------------------------------------------------------------------ */
export const agents = mysqlTable(
  "agents",
  {
    id: int("id").autoincrement().primaryKey(),
    fleetId: int("fleetId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    // identity type: Claw (shared credentials) vs Assistant (per-user credentials)
    identityType: mysqlEnum("identityType", ["claw", "assistant"])
      .default("claw")
      .notNull(),
    // provider:model string, e.g. anthropic:claude-sonnet-4-6
    modelProvider: varchar("modelProvider", { length: 48 }).default("openai").notNull(),
    model: varchar("model", { length: 120 }).default("gpt-5").notNull(),
    systemPrompt: text("systemPrompt"),
    status: mysqlEnum("status", ["draft", "active", "paused", "archived"])
      .default("draft")
      .notNull(),
    // harness options: { planning, filesystem, memory, skills, summarization }
    harness: json("harness").$type<HarnessOptions>(),
    // list of skill names (on-demand knowledge)
    skills: json("skills").$type<string[]>(),
    // AGENTS.md memory entries (legacy list; prefer memoryContent)
    memory: json("memory").$type<string[]>(),
    // AGENTS.md body persisted for the Memory workspace tab
    memoryContent: text("memoryContent"),
    memoryApprovalRequired: boolean("memoryApprovalRequired").default(true).notNull(),
    credentialId: int("credentialId"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    fleetIdx: index("agents_fleet_idx").on(t.fleetId),
    creatorIdx: index("agents_creator_idx").on(t.createdBy),
  })
);

export type HarnessOptions = {
  planning: boolean;
  filesystem: boolean;
  memory: boolean;
  skills: boolean;
  summarization: boolean;
};

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/* ------------------------------------------------------------------ */
/* Tool catalog — builtin tools + remote MCP servers                   */
/* ------------------------------------------------------------------ */
export const tools = mysqlTable("tools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  // builtin function or remote MCP server
  type: mysqlEnum("type", ["builtin", "mcp"]).default("builtin").notNull(),
  // for mcp: { serverUrl, transport, headers }
  config: json("config").$type<Record<string, unknown>>(),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  // platform-wide availability toggle (admin controlled)
  isAvailable: boolean("isAvailable").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tool = typeof tools.$inferSelect;
export type InsertTool = typeof tools.$inferInsert;

/* ------------------------------------------------------------------ */
/* Skills — workspace SKILL.md catalog                                 */
/* ------------------------------------------------------------------ */
export const skills = mysqlTable("skills", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  content: text("content").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Skill = typeof skills.$inferSelect;
export type InsertSkill = typeof skills.$inferInsert;

/* ------------------------------------------------------------------ */
/* AgentTool — which tools an agent has, with per-agent approval flag   */
/* ------------------------------------------------------------------ */
export const agentTools = mysqlTable(
  "agentTools",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: int("agentId").notNull(),
    toolId: int("toolId").notNull(),
    // overrides tool.requiresApproval for this agent (null = inherit)
    requiresApproval: boolean("requiresApproval"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ agentIdx: index("agenttools_agent_idx").on(t.agentId) })
);

export type AgentTool = typeof agentTools.$inferSelect;
export type InsertAgentTool = typeof agentTools.$inferInsert;

/* ------------------------------------------------------------------ */
/* Subagents — specialized delegated agents                            */
/* ------------------------------------------------------------------ */
export const subagents = mysqlTable(
  "subagents",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: int("agentId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    prompt: text("prompt"),
    model: varchar("model", { length: 120 }),
    // list of tool slugs available to this subagent
    tools: json("tools").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ agentIdx: index("subagents_agent_idx").on(t.agentId) })
);

export type Subagent = typeof subagents.$inferSelect;
export type InsertSubagent = typeof subagents.$inferInsert;

/* ------------------------------------------------------------------ */
/* Credentials — named API key / OAuth, shared (Claw) or per-user      */
/* ------------------------------------------------------------------ */
export const credentials = mysqlTable(
  "credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    kind: mysqlEnum("kind", ["api_key", "oauth"]).default("api_key").notNull(),
    // shared = Claw service account, per_user = Assistant per-user auth
    scope: mysqlEnum("scope", ["shared", "per_user"]).default("shared").notNull(),
    // stored masked; full secret value (in a real deploy use a secret manager)
    secretMasked: varchar("secretMasked", { length: 120 }),
    secretValue: text("secretValue"),
    ownerId: int("ownerId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({ ownerIdx: index("credentials_owner_idx").on(t.ownerId) })
);

export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = typeof credentials.$inferInsert;

/* ------------------------------------------------------------------ */
/* Shares — tiered sharing & permissions per agent                     */
/* ------------------------------------------------------------------ */
export const shares = mysqlTable(
  "shares",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: int("agentId").notNull(),
    // principal: a specific user id OR the whole workspace
    principalType: mysqlEnum("principalType", ["user", "workspace"])
      .default("user")
      .notNull(),
    principalUserId: int("principalUserId"),
    role: mysqlEnum("role", [
      "viewer",
      "can-run",
      "can-edit",
      "can-clone",
      "owner",
    ]).notNull(),
    grantedBy: int("grantedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ agentIdx: index("shares_agent_idx").on(t.agentId) })
);

export type Share = typeof shares.$inferSelect;
export type InsertShare = typeof shares.$inferInsert;

/* ------------------------------------------------------------------ */
/* Runs — agent executions                                             */
/* ------------------------------------------------------------------ */
export const runs = mysqlTable(
  "runs",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: int("agentId").notNull(),
    fleetId: int("fleetId").notNull(),
    input: text("input").notNull(),
    output: text("output"),
    status: mysqlEnum("status", [
      "queued",
      "running",
      "awaiting_approval",
      "succeeded",
      "failed",
      "cancelled",
    ])
      .default("queued")
      .notNull(),
    model: varchar("model", { length: 120 }),
    promptTokens: int("promptTokens").default(0).notNull(),
    completionTokens: int("completionTokens").default(0).notNull(),
    totalTokens: int("totalTokens").default(0).notNull(),
    // estimated cost in micro-dollars (1e-6 USD) to avoid float drift
    costMicroUsd: bigint("costMicroUsd", { mode: "number" }).default(0).notNull(),
    errorMessage: text("errorMessage"),
    triggeredBy: int("triggeredBy").notNull(),
    startedAt: timestamp("startedAt"),
    endedAt: timestamp("endedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index("runs_agent_idx").on(t.agentId),
    statusIdx: index("runs_status_idx").on(t.status),
    createdIdx: index("runs_created_idx").on(t.createdAt),
  })
);

export type Run = typeof runs.$inferSelect;
export type InsertRun = typeof runs.$inferInsert;

/* ------------------------------------------------------------------ */
/* RunSteps — the trace timeline                                       */
/* step types match exactly: plan, tool_call, tool_result, subagent,   */
/* message                                                             */
/* ------------------------------------------------------------------ */
export const runSteps = mysqlTable(
  "runSteps",
  {
    id: int("id").autoincrement().primaryKey(),
    runId: int("runId").notNull(),
    idx: int("idx").notNull(),
    type: mysqlEnum("type", [
      "plan",
      "tool_call",
      "tool_result",
      "subagent",
      "message",
    ]).notNull(),
    name: varchar("name", { length: 160 }),
    // arbitrary structured content for the step
    content: json("content").$type<Record<string, unknown>>(),
    status: mysqlEnum("status", ["running", "done", "error", "awaiting_approval"])
      .default("done")
      .notNull(),
    durationMs: int("durationMs").default(0).notNull(),
    tokens: int("tokens").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ runIdx: index("runsteps_run_idx").on(t.runId) })
);

export type RunStep = typeof runSteps.$inferSelect;
export type InsertRunStep = typeof runSteps.$inferInsert;

/* ------------------------------------------------------------------ */
/* Approvals — human-in-the-loop inbox items                           */
/* ------------------------------------------------------------------ */
export const approvals = mysqlTable(
  "approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    runId: int("runId").notNull(),
    agentId: int("agentId").notNull(),
    stepId: int("stepId"),
    toolName: varchar("toolName", { length: 160 }).notNull(),
    args: json("args").$type<Record<string, unknown>>(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"])
      .default("pending")
      .notNull(),
    decidedBy: int("decidedBy"),
    decidedAt: timestamp("decidedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("approvals_status_idx").on(t.status),
    runIdx: index("approvals_run_idx").on(t.runId),
  })
);

export type Approval = typeof approvals.$inferSelect;
export type InsertApproval = typeof approvals.$inferInsert;

/* ------------------------------------------------------------------ */
/* Custom models — workspace-registered LLM endpoints                  */
/* ------------------------------------------------------------------ */
export const customModels = mysqlTable(
  "customModels",
  {
    id: int("id").autoincrement().primaryKey(),
    // id passed to the LLM API, e.g. deepseek/deepseek-v4-pro
    modelId: varchar("modelId", { length: 160 }).notNull().unique(),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
    // name of env var holding the API key — never store the secret itself
    apiKeyEnvVar: varchar("apiKeyEnvVar", { length: 120 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({ creatorIdx: index("custommodels_creator_idx").on(t.createdBy) })
);

export type CustomModel = typeof customModels.$inferSelect;
export type InsertCustomModel = typeof customModels.$inferInsert;
