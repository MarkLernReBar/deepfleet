import { invokeLLM, type Message, type Tool } from "./_core/llm";
import {
  createApproval,
  createRunStep,
  getAgent,
  getAgentTools,
  getApproval,
  getRun,
  getSubagents,
  updateRun,
  updateRunStep,
} from "./db";
import { estimateCostMicroUsd } from "../shared/catalog";
import type { StepType } from "../shared/catalog";

export type StreamEvent =
  | { event: "run"; data: { id: number; status: string } }
  | {
      event: "step";
      data: {
        id: number;
        idx: number;
        type: StepType;
        name: string | null;
        content: Record<string, unknown>;
        status: string;
      };
    }
  | { event: "awaiting_approval"; data: { approvalId: number; toolName: string; args: Record<string, unknown> } }
  | { event: "usage"; data: { promptTokens: number; completionTokens: number; totalTokens: number; costMicroUsd: number } }
  | { event: "done"; data: { status: string; output: string } }
  | { event: "error"; data: { message: string } };

type Emit = (e: StreamEvent) => void;

type PlanResult = {
  plan: string[];
  tool_calls: { tool: string; reason: string; args: Record<string, unknown> }[];
  needs_subagent: { name: string; task: string } | null;
};

const PLAN_SCHEMA = {
  name: "agent_plan",
  strict: true,
  schema: {
    type: "object",
    properties: {
      plan: { type: "array", items: { type: "string" }, description: "Ordered list of steps the agent will take" },
      tool_calls: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tool: { type: "string" },
            reason: { type: "string" },
            args: { type: "object", additionalProperties: true },
          },
          required: ["tool", "reason", "args"],
          additionalProperties: false,
        },
      },
      needs_subagent: {
        type: ["object", "null"],
        properties: { name: { type: "string" }, task: { type: "string" } },
        required: ["name", "task"],
        additionalProperties: false,
      },
    },
    required: ["plan", "tool_calls", "needs_subagent"],
    additionalProperties: false,
  },
} as const;

function modelId(provider: string, model: string): string {
  // The built-in gateway accepts bare model ids; provider is informational.
  return model;
}

async function waitForApproval(approvalId: number, timeoutMs = 120_000): Promise<"approved" | "rejected" | "timeout"> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const a = await getApproval(approvalId);
    if (a?.status === "approved") return "approved";
    if (a?.status === "rejected") return "rejected";
    await new Promise((r) => setTimeout(r, 1500));
  }
  return "timeout";
}

/**
 * Execute an agent run as a deepagents-style loop, streaming each step.
 * Steps emitted use the exact labels: plan, tool_call, tool_result, subagent, message.
 */
export async function executeRun(runId: number, emit: Emit): Promise<void> {
  const run = await getRun(runId);
  if (!run) {
    emit({ event: "error", data: { message: "Run not found" } });
    return;
  }
  const agent = await getAgent(run.agentId);
  if (!agent) {
    emit({ event: "error", data: { message: "Agent not found" } });
    return;
  }

  const model = modelId(agent.modelProvider, agent.model);
  let idx = 0;
  let promptTokens = 0;
  let completionTokens = 0;

  const accumulateUsage = (u?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => {
    if (!u) return;
    promptTokens += u.prompt_tokens ?? 0;
    completionTokens += u.completion_tokens ?? 0;
  };

  const persistStep = async (
    type: StepType,
    name: string | null,
    content: Record<string, unknown>,
    status: string = "done",
    tokens = 0
  ) => {
    const step = await createRunStep({
      runId,
      idx: idx++,
      type,
      name,
      content,
      status: status as never,
      tokens,
    });
    emit({
      event: "step",
      data: { id: step.id, idx: step.idx, type, name, content, status },
    });
    return step;
  };

  try {
    await updateRun(runId, { status: "running", startedAt: new Date(), model });
    emit({ event: "run", data: { id: runId, status: "running" } });

    const agentToolRows = await getAgentTools(run.agentId);
    const subagentRows = await getSubagents(run.agentId);
    const harness = agent.harness ?? { planning: true, filesystem: true, memory: false, skills: false, summarization: true };

    const toolList = agentToolRows.map((t) => ({
      slug: t.tool.slug,
      name: t.tool.name,
      requiresApproval: t.requiresApproval ?? t.tool.requiresApproval,
    }));

    // 1) Planning phase — ask the model for a plan + intended tool calls.
    const toolCatalogText =
      toolList.length > 0
        ? toolList
            .map((t) => `- ${t.slug}${t.requiresApproval ? " (requires human approval)" : ""}: ${t.name}`)
            .join("\n")
        : "(none)";
    const subagentCatalogText =
      subagentRows.length > 0 ? subagentRows.map((s) => `- ${s.name}: ${s.description ?? ""}`).join("\n") : "(none)";

    const planMessages: Message[] = [
      {
        role: "system",
        content:
          `You are ${agent.name}, a deep agent built on the deepagents harness. ${agent.systemPrompt ?? ""}\n\n` +
          `AVAILABLE TOOLS:\n${toolCatalogText}\n\n` +
          `AVAILABLE SUBAGENTS:\n${subagentCatalogText}\n\n` +
          (harness.planning
            ? "Produce a short ordered plan (2-5 concise steps) describing how you will accomplish the task. "
            : "") +
          "Then populate `tool_calls` with the tools you will actually use. " +
          "IMPORTANT: If any tools are available and are even slightly relevant to the task, you MUST select at least one and put it in `tool_calls` with realistic arguments — do not answer from memory when a relevant tool exists. " +
          "If a subagent is available and the task involves drafting, summarizing, or a distinct sub-task, set `needs_subagent` to delegate that piece; otherwise set it to null. " +
          "Only return an empty `tool_calls` array when no available tool is relevant at all.",
      },
      { role: "user", content: run.input },
    ];

    const planResp = await invokeLLM({
      model,
      messages: planMessages,
      response_format: { type: "json_schema", json_schema: PLAN_SCHEMA },
    });
    accumulateUsage(planResp.usage);
    let parsed: PlanResult;
    try {
      const raw = planResp.choices[0]?.message?.content;
      parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as PlanResult;
    } catch {
      parsed = { plan: ["Respond to the user"], tool_calls: [], needs_subagent: null };
    }

    if (harness.planning && parsed.plan?.length) {
      await persistStep("plan", "Plan", { steps: parsed.plan }, "done", planResp.usage?.total_tokens ?? 0);
    }

    const toolResults: { tool: string; result: string }[] = [];

    // 2) Tool-calling phase — honoring human-in-the-loop approvals.
    for (const call of parsed.tool_calls ?? []) {
      const toolMeta = toolList.find((t) => t.slug === call.tool);
      const needsApproval = toolMeta?.requiresApproval ?? false;

      const callStep = await persistStep(
        "tool_call",
        call.tool,
        { args: call.args, reason: call.reason },
        needsApproval ? "awaiting_approval" : "running"
      );

      if (needsApproval) {
        const approval = await createApproval({
          runId,
          agentId: run.agentId,
          stepId: callStep.id,
          toolName: call.tool,
          args: call.args,
        });
        await updateRun(runId, { status: "awaiting_approval" });
        emit({ event: "run", data: { id: runId, status: "awaiting_approval" } });
        emit({ event: "awaiting_approval", data: { approvalId: approval.id, toolName: call.tool, args: call.args } });

        const decision = await waitForApproval(approval.id);
        if (decision !== "approved") {
          await updateRunStep(callStep.id, { status: "error" });
          const msg = decision === "rejected" ? "Tool call rejected by reviewer." : "Tool approval timed out.";
          await persistStep("tool_result", call.tool, { rejected: true, message: msg }, "error");
          continue;
        }
        await updateRun(runId, { status: "running" });
        emit({ event: "run", data: { id: runId, status: "running" } });
        await updateRunStep(callStep.id, { status: "done" });
      }

      // Execute the tool via the LLM acting as the tool's environment (real model call).
      const toolResp = await invokeLLM({
        model,
        messages: [
          {
            role: "system",
            content: `You are simulating the execution of the tool "${call.tool}". Given the arguments, return a concise, realistic tool result as plain text.`,
          },
          { role: "user", content: `Arguments: ${JSON.stringify(call.args)}` },
        ],
      });
      accumulateUsage(toolResp.usage);
      const resultText =
        typeof toolResp.choices[0]?.message?.content === "string"
          ? (toolResp.choices[0].message.content as string)
          : JSON.stringify(toolResp.choices[0]?.message?.content ?? "");
      toolResults.push({ tool: call.tool, result: resultText });
      await persistStep("tool_result", call.tool, { result: resultText }, "done", toolResp.usage?.total_tokens ?? 0);
    }

    // 3) Optional subagent delegation.
    if (parsed.needs_subagent) {
      const sub = subagentRows.find((s) => s.name === parsed.needs_subagent!.name) ?? subagentRows[0];
      const subName = parsed.needs_subagent.name;
      const subResp = await invokeLLM({
        model: sub?.model || model,
        messages: [
          { role: "system", content: `You are the "${subName}" subagent. ${sub?.prompt ?? ""}` },
          { role: "user", content: parsed.needs_subagent.task },
        ],
      });
      accumulateUsage(subResp.usage);
      const subOut =
        typeof subResp.choices[0]?.message?.content === "string"
          ? (subResp.choices[0].message.content as string)
          : "";
      await persistStep(
        "subagent",
        subName,
        { task: parsed.needs_subagent.task, result: subOut },
        "done",
        subResp.usage?.total_tokens ?? 0
      );
      toolResults.push({ tool: `subagent:${subName}`, result: subOut });
    }

    // 4) Final message — synthesize the answer from context + tool results.
    const finalMessages: Message[] = [
      { role: "system", content: `You are ${agent.name}. ${agent.systemPrompt ?? ""}` },
      { role: "user", content: run.input },
    ];
    if (toolResults.length) {
      finalMessages.push({
        role: "system",
        content:
          "Tool results gathered so far:\n" +
          toolResults.map((t) => `- ${t.tool}: ${t.result}`).join("\n") +
          "\nUse these to write the final answer.",
      });
    }
    const finalResp = await invokeLLM({ model, messages: finalMessages });
    accumulateUsage(finalResp.usage);
    const finalText =
      typeof finalResp.choices[0]?.message?.content === "string"
        ? (finalResp.choices[0].message.content as string)
        : JSON.stringify(finalResp.choices[0]?.message?.content ?? "");
    await persistStep("message", "Final response", { text: finalText }, "done", finalResp.usage?.total_tokens ?? 0);

    const totalTokens = promptTokens + completionTokens;
    const costMicroUsd = estimateCostMicroUsd(agent.model, totalTokens);
    emit({ event: "usage", data: { promptTokens, completionTokens, totalTokens, costMicroUsd } });

    await updateRun(runId, {
      status: "succeeded",
      output: finalText,
      promptTokens,
      completionTokens,
      totalTokens,
      costMicroUsd,
      endedAt: new Date(),
    });
    emit({ event: "done", data: { status: "succeeded", output: finalText } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateRun(runId, { status: "failed", errorMessage: message, endedAt: new Date() });
    emit({ event: "error", data: { message } });
    emit({ event: "done", data: { status: "failed", output: "" } });
  }
}
