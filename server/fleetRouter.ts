import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { isValidSkillSlug } from "./skills";
import { isValidModelId } from "./customModels";
import { generateAgentCode } from "./codeExport";
import { SHARE_ROLES } from "../shared/catalog";
import { isWorkerConfigured, workerHealthy } from "./workerBridge";
import { createAndExecuteRun } from "./agentRun";

const harnessSchema = z.object({
  planning: z.boolean(),
  filesystem: z.boolean(),
  memory: z.boolean(),
  skills: z.boolean(),
  summarization: z.boolean(),
});

const subagentInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  prompt: z.string().optional().default(""),
  model: z.string().optional(),
  tools: z.array(z.string()).optional().default([]),
});

const skillSlugSchema = z
  .string()
  .min(1)
  .refine(isValidSkillSlug, { message: "Slug must be lowercase alphanumeric with hyphens only" });

export const fleetRouter = router({
  /* --------------------------- Run engine --------------------------- */
  engine: router({
    // Reports which run engine is active: the real deepagents harness worker
    // (when WORKER_URL is configured and reachable) or the built-in engine.
    status: protectedProcedure.query(async () => {
      const configured = isWorkerConfigured();
      const healthy = configured ? await workerHealthy() : false;
      return {
        configured,
        healthy,
        engine: healthy ? "deepagents-harness-worker" : "built-in",
      } as const;
    }),
  }),

  /* ----------------------------- Fleets ----------------------------- */
  fleets: router({
    list: protectedProcedure.query(() => db.listFleets()),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getFleet(input.id)),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional(), color: z.string().optional() }))
      .mutation(({ ctx, input }) =>
        db.createFleet({ name: input.name, description: input.description, color: input.color, ownerId: ctx.user.id })
      ),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), color: z.string().optional() }))
      .mutation(({ input }) => db.updateFleet(input.id, { name: input.name, description: input.description, color: input.color })),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteFleet(input.id);
      return { success: true };
    }),
  }),

  /* ----------------------------- Agents ----------------------------- */
  agents: router({
    list: protectedProcedure
      .input(z.object({ fleetId: z.number().optional() }).optional())
      .query(({ input }) => db.listAgents(input?.fleetId)),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const agent = await db.getAgent(input.id);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND" });
      const [tools, subagents, shares, runs] = await Promise.all([
        db.getAgentTools(input.id),
        db.getSubagents(input.id),
        db.listShares(input.id),
        db.listRuns({ agentId: input.id, limit: 20 }),
      ]);
      return { agent, tools, subagents, shares, runs };
    }),
    create: protectedProcedure
      .input(
        z.object({
          fleetId: z.number(),
          name: z.string().min(1),
          description: z.string().optional(),
          identityType: z.enum(["claw", "assistant"]).default("claw"),
          modelProvider: z.string().default("openai"),
          model: z.string().default("gpt-5"),
          systemPrompt: z.string().optional(),
          status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
          harness: harnessSchema.optional(),
          skills: z.array(z.string()).optional(),
          memory: z.array(z.string()).optional(),
          memoryContent: z.string().nullable().optional(),
          memoryApprovalRequired: z.boolean().optional(),
          credentialId: z.number().nullable().optional(),
          toolIds: z.array(z.number()).optional().default([]),
          subagents: z.array(subagentInput).optional().default([]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const agent = await db.createAgent({
          fleetId: input.fleetId,
          name: input.name,
          description: input.description,
          identityType: input.identityType,
          modelProvider: input.modelProvider,
          model: input.model,
          systemPrompt: input.systemPrompt,
          status: input.status,
          harness: input.harness,
          skills: input.skills,
          memory: input.memory,
          memoryContent: input.memoryContent ?? null,
          memoryApprovalRequired: input.memoryApprovalRequired,
          credentialId: input.credentialId ?? null,
          createdBy: ctx.user.id,
        });
        if (!agent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.setAgentTools(agent.id, input.toolIds);
        await db.setSubagents(agent.id, input.subagents);
        // owner gets an explicit owner share
        await db.createShare({ agentId: agent.id, principalType: "user", principalUserId: ctx.user.id, role: "owner", grantedBy: ctx.user.id });
        return agent;
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          identityType: z.enum(["claw", "assistant"]).optional(),
          modelProvider: z.string().optional(),
          model: z.string().optional(),
          systemPrompt: z.string().optional(),
          status: z.enum(["draft", "active", "paused", "archived"]).optional(),
          harness: harnessSchema.optional(),
          skills: z.array(z.string()).optional(),
          memory: z.array(z.string()).optional(),
          memoryContent: z.string().nullable().optional(),
          memoryApprovalRequired: z.boolean().optional(),
          credentialId: z.number().nullable().optional(),
          triggersPaused: z.boolean().optional(),
          toolIds: z.array(z.number()).optional(),
          subagents: z.array(subagentInput).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, toolIds, subagents, ...rest } = input;
        const agent = await db.updateAgent(id, rest);
        if (toolIds) await db.setAgentTools(id, toolIds);
        if (subagents) await db.setSubagents(id, subagents);
        return agent;
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteAgentCascade(input.id);
      return { success: true };
    }),
    clone: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const src = await db.getAgent(input.id);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });
      const srcTools = await db.getAgentTools(input.id);
      const srcSubs = await db.getSubagents(input.id);
      const agent = await db.createAgent({
        fleetId: src.fleetId,
        name: `${src.name} (clone)`,
        description: src.description,
        identityType: src.identityType,
        modelProvider: src.modelProvider,
        model: src.model,
        systemPrompt: src.systemPrompt,
        status: "draft",
        harness: src.harness,
        skills: src.skills,
        memory: src.memory,
        memoryContent: src.memoryContent,
        memoryApprovalRequired: src.memoryApprovalRequired,
        createdBy: ctx.user.id,
      });
      if (!agent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.setAgentTools(agent.id, srcTools.map((t) => t.toolId));
      await db.setSubagents(
        agent.id,
        srcSubs.map((s) => ({ name: s.name, description: s.description, prompt: s.prompt, model: s.model, tools: s.tools }))
      );
      await db.createShare({ agentId: agent.id, principalType: "user", principalUserId: ctx.user.id, role: "owner", grantedBy: ctx.user.id });
      return agent;
    }),
    code: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const agent = await db.getAgent(input.id);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND" });
      const tools = await db.getAgentTools(input.id);
      const subs = await db.getSubagents(input.id);
      return {
        code: generateAgentCode(
          agent,
          tools.map((t) => ({ slug: t.tool.slug, type: t.tool.type, config: t.tool.config })),
          subs
        ),
      };
    }),
  }),

  /* ----------------------------- Tools ------------------------------ */
  tools: router({
    list: protectedProcedure.input(z.object({ onlyAvailable: z.boolean().optional() }).optional()).query(({ input }) =>
      db.listTools(input?.onlyAvailable ?? false)
    ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          type: z.enum(["builtin", "mcp"]).default("builtin"),
          config: z.record(z.string(), z.unknown()).optional(),
          requiresApproval: z.boolean().default(false),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createTool({
          name: input.name,
          slug: input.slug,
          description: input.description,
          type: input.type,
          config: input.config,
          requiresApproval: input.requiresApproval,
          createdBy: ctx.user.id,
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          config: z.record(z.string(), z.unknown()).optional(),
          requiresApproval: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => db.updateTool(input.id, input)),
    setAvailability: adminProcedure
      .input(z.object({ id: z.number(), isAvailable: z.boolean() }))
      .mutation(({ input }) => db.updateTool(input.id, { isAvailable: input.isAvailable })),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteTool(input.id);
      return { success: true };
    }),
  }),

  /* ----------------------------- Skills ----------------------------- */
  skills: router({
    list: protectedProcedure.query(() => db.listSkills()),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const skill = await db.getSkill(input.id);
      if (!skill) throw new TRPCError({ code: "NOT_FOUND" });
      return skill;
    }),
    create: protectedProcedure
      .input(
        z.object({
          slug: skillSlugSchema,
          name: z.string().min(1),
          description: z.string().optional(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getSkillBySlug(input.slug);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Slug already in use" });
        return db.createSkill({
          slug: input.slug,
          name: input.name,
          description: input.description,
          content: input.content,
          createdBy: ctx.user.id,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          slug: skillSlugSchema.optional(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          content: z.string().min(1).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, slug, ...rest } = input;
        if (slug) {
          const existing = await db.getSkillBySlug(slug);
          if (existing && existing.id !== id) {
            throw new TRPCError({ code: "CONFLICT", message: "Slug already in use" });
          }
        }
        const skill = await db.updateSkill(id, { ...rest, ...(slug ? { slug } : {}) });
        if (!skill) throw new TRPCError({ code: "NOT_FOUND" });
        return skill;
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteSkill(input.id);
      return { success: true };
    }),
  }),

  /* -------------------------- Credentials --------------------------- */
  credentials: router({
    list: protectedProcedure.query(async () => {
      const rows = await db.listCredentials();
      // never leak the raw secret to the client
      return rows.map(({ secretValue, ...rest }) => rest);
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          provider: z.string().min(1),
          kind: z.enum(["api_key", "oauth"]).default("api_key"),
          scope: z.enum(["shared", "per_user"]).default("shared"),
          secret: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const secret = input.secret ?? "";
        const masked = secret ? `${secret.slice(0, 3)}••••${secret.slice(-2)}` : "••••";
        return db.createCredential({
          name: input.name,
          provider: input.provider,
          kind: input.kind,
          scope: input.scope,
          secretMasked: masked,
          secretValue: secret,
          ownerId: ctx.user.id,
        });
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteCredential(input.id);
      return { success: true };
    }),
  }),

  /* ------------------------- Custom models -------------------------- */
  customModels: router({
    list: protectedProcedure.query(() => db.listCustomModels()),
    create: protectedProcedure
      .input(
        z.object({
          modelId: z.string().refine(isValidModelId, { message: "modelId is required" }),
          displayName: z.string().min(1),
          baseUrl: z.string().url(),
          apiKeyEnvVar: z.string().min(1),
          provider: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getCustomModelByModelId(input.modelId.trim());
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "modelId already registered" });
        return db.createCustomModel({
          modelId: input.modelId.trim(),
          displayName: input.displayName,
          baseUrl: input.baseUrl,
          apiKeyEnvVar: input.apiKeyEnvVar,
          provider: input.provider,
          createdBy: ctx.user.id,
        });
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteCustomModel(input.id);
      return { success: true };
    }),
  }),

  /* ----------------------------- Shares ----------------------------- */
  shares: router({
    list: protectedProcedure.input(z.object({ agentId: z.number() })).query(({ input }) => db.listShares(input.agentId)),
    grant: protectedProcedure
      .input(
        z.object({
          agentId: z.number(),
          principalType: z.enum(["user", "workspace"]).default("user"),
          principalUserId: z.number().nullable().optional(),
          role: z.enum(SHARE_ROLES),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createShare({
          agentId: input.agentId,
          principalType: input.principalType,
          principalUserId: input.principalType === "user" ? input.principalUserId ?? null : null,
          role: input.role,
          grantedBy: ctx.user.id,
        })
      ),
    revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteShare(input.id);
      return { success: true };
    }),
  }),

  /* ------------------------------ Runs ------------------------------ */
  runs: router({
    list: protectedProcedure
      .input(z.object({ agentId: z.number().optional(), status: z.string().optional(), limit: z.number().optional() }).optional())
      .query(({ input }) => db.listRuns(input ?? {})),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const run = await db.getRun(input.id);
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      const steps = await db.listRunSteps(input.id);
      return { run, steps };
    }),
  }),

  /* ---------------------------- Approvals --------------------------- */
  approvals: router({
    list: protectedProcedure.input(z.object({ status: z.string().optional() }).optional()).query(({ input }) =>
      db.listApprovals(input?.status)
    ),
    decide: protectedProcedure
      .input(z.object({ id: z.number(), decision: z.enum(["approved", "rejected"]) }))
      .mutation(async ({ ctx, input }) => {
        const approval = await db.updateApproval(input.id, {
          status: input.decision,
          decidedBy: ctx.user.id,
          decidedAt: new Date(),
        });
        return approval;
      }),
  }),

  /* ---------------------------- Analytics --------------------------- */
  analytics: router({
    overview: protectedProcedure.query(() => db.analyticsOverview()),
    runsTimeseries: protectedProcedure.input(z.object({ days: z.number().optional() }).optional()).query(({ input }) =>
      db.analyticsRunsTimeseries(input?.days ?? 14)
    ),
    tokensPerAgent: protectedProcedure.query(() => db.analyticsTokensPerAgent()),
  }),

  /* --------------------------- Schedules ---------------------------- */
  schedules: router({
    list: protectedProcedure.input(z.object({ agentId: z.number() })).query(({ input }) =>
      db.listSchedulesForAgent(input.agentId)
    ),
    create: protectedProcedure
      .input(
        z.object({
          agentId: z.number(),
          name: z.string().min(1),
          description: z.string().optional(),
          cronExpression: z.string().min(1).max(120),
          prompt: z.string().min(1),
          enabled: z.boolean().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createAgentSchedule({
          agentId: input.agentId,
          name: input.name,
          description: input.description,
          cronExpression: input.cronExpression,
          prompt: input.prompt,
          enabled: input.enabled ?? true,
          createdBy: ctx.user.id,
        })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          cronExpression: z.string().min(1).max(120).optional(),
          prompt: z.string().min(1).optional(),
          enabled: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...rest } = input;
        return db.updateAgentSchedule(id, rest);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteAgentSchedule(input.id);
      return { success: true };
    }),
  }),

  /* ---------------------------- Channels ---------------------------- */
  channels: router({
    list: protectedProcedure.input(z.object({ agentId: z.number() })).query(({ input }) =>
      db.listChannelsForAgent(input.agentId)
    ),
    upsert: protectedProcedure
      .input(
        z.object({
          agentId: z.number(),
          type: z.enum(["chat", "slack", "gmail"]),
          enabled: z.boolean(),
          config: z.record(z.string(), z.unknown()).nullable().optional(),
        })
      )
      .mutation(({ input }) =>
        db.upsertAgentChannel({
          agentId: input.agentId,
          type: input.type,
          enabled: input.enabled,
          config: input.config ?? null,
        })
      ),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteAgentChannel(input.id);
      return { success: true };
    }),
  }),

  /* ------------------------------- Chat ----------------------------- */
  chat: router({
    threads: router({
      list: protectedProcedure.input(z.object({ agentId: z.number() })).query(({ ctx, input }) =>
        db.listThreadsForAgent(input.agentId, ctx.user.id)
      ),
      create: protectedProcedure
        .input(z.object({ agentId: z.number(), title: z.string().optional() }))
        .mutation(({ ctx, input }) =>
          db.createChatThread({
            agentId: input.agentId,
            userId: ctx.user.id,
            title: input.title?.trim() || "New chat",
          })
        ),
      markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const thread = await db.getChatThread(input.id);
        if (!thread || thread.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return db.updateChatThread(input.id, { isRead: true });
      }),
      setAttention: protectedProcedure
        .input(z.object({ id: z.number(), needsAttention: z.boolean() }))
        .mutation(async ({ ctx, input }) => {
          const thread = await db.getChatThread(input.id);
          if (!thread || thread.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
          return db.updateChatThread(input.id, { needsAttention: input.needsAttention });
        }),
    }),
    messages: router({
      list: protectedProcedure.input(z.object({ threadId: z.number() })).query(async ({ ctx, input }) => {
        const thread = await db.getChatThread(input.threadId);
        if (!thread || thread.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return db.listMessagesForThread(input.threadId);
      }),
      send: protectedProcedure
        .input(z.object({ threadId: z.number(), content: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          const thread = await db.getChatThread(input.threadId);
          if (!thread || thread.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

          const userMessage = await db.createChatMessage({
            threadId: input.threadId,
            role: "user",
            content: input.content.trim(),
          });
          await db.updateChatThread(input.threadId, { isRead: true, needsAttention: false });

          const { runId, output } = await createAndExecuteRun(thread.agentId, input.content, ctx.user.id);
          const assistantMessage = await db.createChatMessage({
            threadId: input.threadId,
            role: "assistant",
            content: output || "(No response)",
            runId,
          });

          return { runId, userMessage, assistantMessage };
        }),
    }),
  }),

  /* ------------------------------ Users ----------------------------- */
  users: router({
    list: protectedProcedure.query(async () => {
      const rows = await db.listUsers();
      return rows.map((u) => ({ id: u.id, name: u.name, email: u.email }));
    }),
  }),
});
