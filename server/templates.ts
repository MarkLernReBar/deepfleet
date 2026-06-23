import { TRPCError } from "@trpc/server";
import { getAgentTemplate } from "../shared/agentTemplates";
import * as db from "./db";

export async function instantiateAgentTemplate(
  templateId: string,
  fleetId: number,
  userId: number,
  name?: string
) {
  const template = getAgentTemplate(templateId);
  if (!template) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
  }

  const fleet = await db.getFleet(fleetId);
  if (!fleet) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Fleet not found" });
  }

  const catalog = await db.listTools(true);
  const slugToId = new Map(catalog.map((t) => [t.slug, t.id]));
  const toolIds = template.toolSlugs
    .map((slug) => slugToId.get(slug))
    .filter((id): id is number => id !== undefined);

  const agent = await db.createAgent({
    fleetId,
    name: name?.trim() || template.name,
    description: template.description,
    identityType: template.identityType,
    modelProvider: template.modelProvider,
    model: template.model,
    systemPrompt: template.systemPrompt,
    status: "draft",
    harness: template.harness,
    skills: template.skills,
    memoryContent: null,
    memoryApprovalRequired: true,
    credentialId: null,
    createdBy: userId,
  });
  if (!agent) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create agent" });
  }

  await db.setAgentTools(agent.id, toolIds);
  await db.setSubagents(agent.id, template.subagents);
  await db.createShare({
    agentId: agent.id,
    principalType: "user",
    principalUserId: userId,
    role: "owner",
    grantedBy: userId,
  });

  // Fleet default: chat channel on for template agents
  await db.upsertAgentChannel({
    agentId: agent.id,
    type: "chat",
    enabled: true,
    config: null,
  });

  return agent;
}
