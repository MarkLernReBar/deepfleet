import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agents,
  agentTools,
  approvals,
  credentials,
  fleets,
  runs,
  runSteps,
  shares,
  subagents,
  tools,
  users,
  type InsertAgent,
  type InsertAgentTool,
  type InsertApproval,
  type InsertCredential,
  type InsertFleet,
  type InsertRun,
  type InsertRunStep,
  type InsertShare,
  type InsertSubagent,
  type InsertTool,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function db() {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  return d;
}

/* ----------------------------- Users ----------------------------- */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const d = await getDb();
  if (!d) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await d.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const d = await getDb();
  if (!d) return undefined;
  const result = await d.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listUsers() {
  return (await db()).select().from(users).orderBy(users.name);
}

/* ----------------------------- Fleets ----------------------------- */
export async function listFleets() {
  return (await db()).select().from(fleets).orderBy(desc(fleets.createdAt));
}
export async function getFleet(id: number) {
  const r = await (await db()).select().from(fleets).where(eq(fleets.id, id)).limit(1);
  return r[0];
}
export async function createFleet(data: InsertFleet) {
  const d = await db();
  const r = await d.insert(fleets).values(data).$returningId();
  return getFleet(r[0].id);
}
export async function updateFleet(id: number, data: Partial<InsertFleet>) {
  await (await db()).update(fleets).set(data).where(eq(fleets.id, id));
  return getFleet(id);
}
export async function deleteFleet(id: number) {
  const d = await db();
  const fleetAgents = await d.select({ id: agents.id }).from(agents).where(eq(agents.fleetId, id));
  const agentIds = fleetAgents.map((a) => a.id);
  if (agentIds.length) {
    await Promise.all(agentIds.map((aid) => deleteAgentCascade(aid)));
  }
  await d.delete(fleets).where(eq(fleets.id, id));
}

/* ----------------------------- Agents ----------------------------- */
export async function listAgents(fleetId?: number) {
  const d = await db();
  if (fleetId) {
    return d.select().from(agents).where(eq(agents.fleetId, fleetId)).orderBy(desc(agents.createdAt));
  }
  return d.select().from(agents).orderBy(desc(agents.createdAt));
}
export async function getAgent(id: number) {
  const r = await (await db()).select().from(agents).where(eq(agents.id, id)).limit(1);
  return r[0];
}
export async function createAgent(data: InsertAgent) {
  const d = await db();
  const r = await d.insert(agents).values(data).$returningId();
  return getAgent(r[0].id);
}
export async function updateAgent(id: number, data: Partial<InsertAgent>) {
  await (await db()).update(agents).set(data).where(eq(agents.id, id));
  return getAgent(id);
}
export async function deleteAgentCascade(id: number) {
  const d = await db();
  await d.delete(agentTools).where(eq(agentTools.agentId, id));
  await d.delete(subagents).where(eq(subagents.agentId, id));
  await d.delete(shares).where(eq(shares.agentId, id));
  const agentRuns = await d.select({ id: runs.id }).from(runs).where(eq(runs.agentId, id));
  const runIds = agentRuns.map((r) => r.id);
  if (runIds.length) {
    await d.delete(runSteps).where(inArray(runSteps.runId, runIds));
    await d.delete(approvals).where(inArray(approvals.runId, runIds));
    await d.delete(runs).where(eq(runs.agentId, id));
  }
  await d.delete(agents).where(eq(agents.id, id));
}

/* --------------------------- Agent tools -------------------------- */
export async function getAgentTools(agentId: number) {
  const d = await db();
  return d
    .select({
      id: agentTools.id,
      agentId: agentTools.agentId,
      toolId: agentTools.toolId,
      requiresApproval: agentTools.requiresApproval,
      tool: tools,
    })
    .from(agentTools)
    .innerJoin(tools, eq(agentTools.toolId, tools.id))
    .where(eq(agentTools.agentId, agentId));
}
export async function setAgentTools(agentId: number, toolIds: number[]) {
  const d = await db();
  await d.delete(agentTools).where(eq(agentTools.agentId, agentId));
  if (toolIds.length) {
    const rows: InsertAgentTool[] = toolIds.map((toolId) => ({ agentId, toolId }));
    await d.insert(agentTools).values(rows);
  }
}

/* ---------------------------- Subagents --------------------------- */
export async function getSubagents(agentId: number) {
  return (await db()).select().from(subagents).where(eq(subagents.agentId, agentId));
}
export async function setSubagents(agentId: number, items: Omit<InsertSubagent, "agentId">[]) {
  const d = await db();
  await d.delete(subagents).where(eq(subagents.agentId, agentId));
  if (items.length) {
    await d.insert(subagents).values(items.map((i) => ({ ...i, agentId })));
  }
}

/* ----------------------------- Tools ------------------------------ */
export async function listTools(onlyAvailable = false) {
  const d = await db();
  if (onlyAvailable) {
    return d.select().from(tools).where(eq(tools.isAvailable, true)).orderBy(tools.name);
  }
  return d.select().from(tools).orderBy(tools.name);
}
export async function getTool(id: number) {
  const r = await (await db()).select().from(tools).where(eq(tools.id, id)).limit(1);
  return r[0];
}
export async function createTool(data: InsertTool) {
  const d = await db();
  const r = await d.insert(tools).values(data).$returningId();
  return getTool(r[0].id);
}
export async function updateTool(id: number, data: Partial<InsertTool>) {
  await (await db()).update(tools).set(data).where(eq(tools.id, id));
  return getTool(id);
}
export async function deleteTool(id: number) {
  const d = await db();
  await d.delete(agentTools).where(eq(agentTools.toolId, id));
  await d.delete(tools).where(eq(tools.id, id));
}

/* -------------------------- Credentials --------------------------- */
export async function listCredentials() {
  return (await db()).select().from(credentials).orderBy(desc(credentials.createdAt));
}
export async function getCredential(id: number) {
  const r = await (await db()).select().from(credentials).where(eq(credentials.id, id)).limit(1);
  return r[0];
}
export async function createCredential(data: InsertCredential) {
  const d = await db();
  const r = await d.insert(credentials).values(data).$returningId();
  return getCredential(r[0].id);
}
export async function updateCredential(id: number, data: Partial<InsertCredential>) {
  await (await db()).update(credentials).set(data).where(eq(credentials.id, id));
  return getCredential(id);
}
export async function deleteCredential(id: number) {
  await (await db()).delete(credentials).where(eq(credentials.id, id));
}

/* ----------------------------- Shares ----------------------------- */
export async function listShares(agentId: number) {
  const d = await db();
  return d
    .select({
      id: shares.id,
      agentId: shares.agentId,
      principalType: shares.principalType,
      principalUserId: shares.principalUserId,
      role: shares.role,
      grantedBy: shares.grantedBy,
      createdAt: shares.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(shares)
    .leftJoin(users, eq(shares.principalUserId, users.id))
    .where(eq(shares.agentId, agentId))
    .orderBy(desc(shares.createdAt));
}
export async function createShare(data: InsertShare) {
  const d = await db();
  const r = await d.insert(shares).values(data).$returningId();
  const rows = await d.select().from(shares).where(eq(shares.id, r[0].id)).limit(1);
  return rows[0];
}
export async function deleteShare(id: number) {
  await (await db()).delete(shares).where(eq(shares.id, id));
}

/* ------------------------------ Runs ------------------------------ */
export async function listRuns(filter?: { agentId?: number; status?: string; limit?: number }) {
  const d = await db();
  const conds = [];
  if (filter?.agentId) conds.push(eq(runs.agentId, filter.agentId));
  if (filter?.status) conds.push(eq(runs.status, filter.status as Run["status"]));
  const base = d
    .select({
      id: runs.id,
      agentId: runs.agentId,
      fleetId: runs.fleetId,
      input: runs.input,
      output: runs.output,
      status: runs.status,
      model: runs.model,
      totalTokens: runs.totalTokens,
      costMicroUsd: runs.costMicroUsd,
      triggeredBy: runs.triggeredBy,
      startedAt: runs.startedAt,
      endedAt: runs.endedAt,
      createdAt: runs.createdAt,
      agentName: agents.name,
    })
    .from(runs)
    .leftJoin(agents, eq(runs.agentId, agents.id))
    .orderBy(desc(runs.createdAt))
    .limit(filter?.limit ?? 100);
  if (conds.length) return base.where(and(...conds));
  return base;
}
export async function getRun(id: number) {
  const r = await (await db()).select().from(runs).where(eq(runs.id, id)).limit(1);
  return r[0];
}
export async function createRun(data: InsertRun) {
  const d = await db();
  const r = await d.insert(runs).values(data).$returningId();
  return getRun(r[0].id);
}
export async function updateRun(id: number, data: Partial<InsertRun>) {
  await (await db()).update(runs).set(data).where(eq(runs.id, id));
  return getRun(id);
}

/* ---------------------------- Run steps --------------------------- */
export async function listRunSteps(runId: number) {
  return (await db()).select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(runSteps.idx);
}
export async function createRunStep(data: InsertRunStep) {
  const d = await db();
  const r = await d.insert(runSteps).values(data).$returningId();
  const rows = await d.select().from(runSteps).where(eq(runSteps.id, r[0].id)).limit(1);
  return rows[0];
}
export async function updateRunStep(id: number, data: Partial<InsertRunStep>) {
  await (await db()).update(runSteps).set(data).where(eq(runSteps.id, id));
}

/* ---------------------------- Approvals --------------------------- */
export async function listApprovals(status?: string) {
  const d = await db();
  const base = d
    .select({
      id: approvals.id,
      runId: approvals.runId,
      agentId: approvals.agentId,
      stepId: approvals.stepId,
      toolName: approvals.toolName,
      args: approvals.args,
      status: approvals.status,
      decidedBy: approvals.decidedBy,
      decidedAt: approvals.decidedAt,
      createdAt: approvals.createdAt,
      agentName: agents.name,
    })
    .from(approvals)
    .leftJoin(agents, eq(approvals.agentId, agents.id))
    .orderBy(desc(approvals.createdAt));
  if (status) return base.where(eq(approvals.status, status as Approval["status"]));
  return base;
}
export async function getApproval(id: number) {
  const r = await (await db()).select().from(approvals).where(eq(approvals.id, id)).limit(1);
  return r[0];
}
export async function createApproval(data: InsertApproval) {
  const d = await db();
  const r = await d.insert(approvals).values(data).$returningId();
  return getApproval(r[0].id);
}
export async function updateApproval(id: number, data: Partial<InsertApproval>) {
  await (await db()).update(approvals).set(data).where(eq(approvals.id, id));
  return getApproval(id);
}

/* ---------------------------- Analytics --------------------------- */
export async function analyticsOverview() {
  const d = await db();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [agentCount] = await d.select({ c: sql<number>`count(*)` }).from(agents);
  const [fleetCount] = await d.select({ c: sql<number>`count(*)` }).from(fleets);
  const [runsToday] = await d
    .select({ c: sql<number>`count(*)` })
    .from(runs)
    .where(gte(runs.createdAt, since));
  const [succeeded] = await d
    .select({ c: sql<number>`count(*)` })
    .from(runs)
    .where(eq(runs.status, "succeeded"));
  const [totalRuns] = await d.select({ c: sql<number>`count(*)` }).from(runs);
  const [tokenAgg] = await d
    .select({ t: sql<number>`coalesce(sum(${runs.totalTokens}),0)`, cost: sql<number>`coalesce(sum(${runs.costMicroUsd}),0)` })
    .from(runs);
  const [pendingApprovals] = await d
    .select({ c: sql<number>`count(*)` })
    .from(approvals)
    .where(eq(approvals.status, "pending"));
  return {
    agentCount: Number(agentCount?.c ?? 0),
    fleetCount: Number(fleetCount?.c ?? 0),
    runsToday: Number(runsToday?.c ?? 0),
    totalRuns: Number(totalRuns?.c ?? 0),
    succeeded: Number(succeeded?.c ?? 0),
    totalTokens: Number(tokenAgg?.t ?? 0),
    totalCostMicroUsd: Number(tokenAgg?.cost ?? 0),
    pendingApprovals: Number(pendingApprovals?.c ?? 0),
  };
}

export async function analyticsRunsTimeseries(days = 14) {
  const d = await db();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Bucket by day in JS. We intentionally avoid a SQL GROUP BY on a date
  // expression: under TiDB/MySQL ONLY_FULL_GROUP_BY with prepared statements
  // (the path drizzle uses) the SELECT and GROUP BY expressions are not treated
  // as identical, which raises ER_WRONG_FIELD_WITH_GROUP. Run volumes per
  // window are small, so client-side aggregation is simpler and robust.
  const rows = await d
    .select({ createdAt: runs.createdAt, tokens: runs.totalTokens })
    .from(runs)
    .where(gte(runs.createdAt, since));

  const buckets = new Map<string, { runs: number; tokens: number }>();
  // Pre-seed every day in the window so the chart has a continuous x-axis.
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    buckets.set(dt.toISOString().slice(0, 10), { runs: 0, tokens: 0 });
  }
  for (const r of rows) {
    const key = new Date(r.createdAt).toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { runs: 0, tokens: 0 };
    b.runs += 1;
    b.tokens += Number(r.tokens ?? 0);
    buckets.set(key, b);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({ day, runs: v.runs, tokens: v.tokens }));
}

export async function analyticsTokensPerAgent() {
  const d = await db();
  const rows = await d
    .select({
      agentId: runs.agentId,
      agentName: agents.name,
      tokens: sql<number>`coalesce(sum(${runs.totalTokens}),0)`,
      runs: sql<number>`count(*)`,
    })
    .from(runs)
    .leftJoin(agents, eq(runs.agentId, agents.id))
    .groupBy(runs.agentId, agents.name)
    .orderBy(desc(sql`sum(${runs.totalTokens})`))
    .limit(10);
  return rows.map((r) => ({
    agentId: r.agentId,
    agentName: r.agentName ?? `Agent #${r.agentId}`,
    tokens: Number(r.tokens),
    runs: Number(r.runs),
  }));
}

// re-export types used in this file's signatures
import type { Run, Approval } from "../drizzle/schema";
