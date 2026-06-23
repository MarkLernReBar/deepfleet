import { ENV } from "./_core/env";
import {
  createRunStep,
  getAgent,
  getAgentTools,
  getCustomModelByModelId,
  getRun,
  getSubagents,
  updateRun,
} from "./db";
import { estimateCostMicroUsd, toProviderModelString, type ModelProvider, type StepType } from "../shared/catalog";
import type { StreamEvent } from "./orchestrator";

type Emit = (e: StreamEvent) => void;

export function isWorkerConfigured(): boolean {
  return Boolean(ENV.workerUrl);
}

/**
 * Probe the worker's /health endpoint. Returns true only when reachable and the
 * deepagents library is importable on the worker.
 */
export async function workerHealthy(timeoutMs = 4000): Promise<boolean> {
  if (!ENV.workerUrl) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${ENV.workerUrl.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string; deepagents?: boolean };
    return body.status === "ok" && body.deepagents === true;
  } catch {
    return false;
  }
}

/**
 * Build the AgentSpec payload the Python worker expects from a DeepFleet agent.
 */
export async function buildSpec(agentId: number, input: string) {
  const agent = await getAgent(agentId);
  if (!agent) throw new Error("Agent not found");
  const toolRows = await getAgentTools(agentId);
  const subagentRows = await getSubagents(agentId);
  const harness = (agent.harness ?? {}) as Record<string, boolean>;

  const tools = toolRows.map((t) => t.tool.slug);
  const approvalTools = toolRows
    .filter((t) => (t.requiresApproval ?? t.tool.requiresApproval))
    .map((t) => t.tool.slug);

  const model = toProviderModelString(agent.modelProvider as ModelProvider, agent.model);

  // When the agent uses a workspace-registered custom model, pass endpoint metadata
  // so the worker can route via an OpenAI-compatible gateway. Without a registry
  // match the worker falls back to resolve_model() with the custom:modelId string.
  let custom_model_config: { base_url: string; api_key_env: string; model_id: string } | undefined;
  if (agent.modelProvider === "custom") {
    const row = await getCustomModelByModelId(agent.model);
    if (row) {
      custom_model_config = {
        base_url: row.baseUrl,
        api_key_env: row.apiKeyEnvVar,
        model_id: row.modelId,
      };
    }
  }

  return {
    agent,
    payload: {
      run_id: undefined as number | undefined,
      name: agent.name,
      model,
      ...(custom_model_config ? { custom_model_config } : {}),
      system_prompt: agent.systemPrompt ?? "",
      tools,
      approval_tools: approvalTools,
      subagents: subagentRows.map((s) => ({
        name: s.name,
        description: s.description ?? "",
        prompt: s.prompt ?? "",
        model: s.model ?? null,
        tools: (s.tools ?? []) as string[],
      })),
      harness,
      skills: (agent.skills ?? []) as string[],
      ...(harness.memory
        ? {
            memory_content: agent.memoryContent ?? "",
            memory_approval_required: agent.memoryApprovalRequired ?? true,
          }
        : {}),
      input,
    },
  };
}

/**
 * Dispatch a run to the self-hosted deepagents worker and stream genuine harness
 * steps back, persisting each step and updating run state. Mirrors the emit
 * contract of the built-in orchestrator so the UI is identical for both engines.
 */
export async function executeRunViaWorker(runId: number, emit: Emit): Promise<void> {
  const run = await getRun(runId);
  if (!run) {
    emit({ event: "error", data: { message: "Run not found" } });
    return;
  }

  const { agent, payload } = await buildSpec(run.agentId, run.input);
  payload.run_id = runId;

  const model = payload.model;
  let idx = 0;
  let totalTokens = 0;

  const persistStep = async (type: StepType, name: string | null, content: Record<string, unknown>) => {
    const step = await createRunStep({ runId, idx: idx++, type, name, content, status: "done" as never, tokens: 0 });
    emit({ event: "step", data: { id: step.id, idx: step.idx, type, name, content, status: "done" } });
  };

  await updateRun(runId, { status: "running", startedAt: new Date(), model });
  emit({ event: "run", data: { id: runId, status: "running" } });

  const url = `${ENV.workerUrl.replace(/\/$/, "")}/v1/runs/stream`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ENV.workerToken) headers["Authorization"] = `Bearer ${ENV.workerToken}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok || !res.body) {
    throw new Error(`Worker responded ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalOutput = "";
  let sawMessageStep = false;

  const handleEvent = async (eventName: string, dataStr: string) => {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (eventName === "step") {
      const type = data.type as StepType;
      const content = (data.content ?? {}) as Record<string, unknown>;
      // Normalize the message content key so the trace viewer (which reads
      // `content.text`) renders worker and built-in runs identically.
      if (type === "message" && content.message && !content.text) {
        content.text = content.message;
      }
      const name =
        type === "plan"
          ? "Plan"
          : type === "message"
          ? "Final response"
          : (content.tool as string) || (content.name as string) || null;
      if (type === "message") sawMessageStep = true;
      await persistStep(type, name, content);
    } else if (eventName === "done") {
      finalOutput = (data.output as string) ?? "";
      const langsmithRunId = (data.langsmith_run_id as string) ?? (data.langsmithRunId as string);
      if (langsmithRunId) {
        await updateRun(runId, { langsmithRunId });
      }
    } else if (eventName === "error") {
      throw new Error((data.error as string) ?? "Worker run failed");
    }
  };

  // Parse the worker's SSE stream (event:/data: framing).
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const lines = chunk.split("\n");
      let eventName = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (dataStr) await handleEvent(eventName, dataStr);
    }
  }

  // If the worker delivered the final answer only via the `done` event (common
  // when the last action was a tool call), persist it as a `message` step so the
  // trace ends with the assistant's answer just like the built-in engine.
  if (!sawMessageStep && finalOutput) {
    await persistStep("message", "Final response", { text: finalOutput });
  }

  // The worker does not return token usage; estimate from the produced text so the
  // cost/token KPIs remain populated for worker-backed runs.
  totalTokens = Math.round((run.input.length + finalOutput.length) / 4);
  const costMicroUsd = estimateCostMicroUsd(agent.model, totalTokens);
  emit({ event: "usage", data: { promptTokens: 0, completionTokens: totalTokens, totalTokens, costMicroUsd } });

  await updateRun(runId, {
    status: "succeeded",
    output: finalOutput,
    promptTokens: 0,
    completionTokens: totalTokens,
    totalTokens,
    costMicroUsd,
    endedAt: new Date(),
  });
  emit({ event: "done", data: { status: "succeeded", output: finalOutput } });
}
