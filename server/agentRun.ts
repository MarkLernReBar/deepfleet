import { createRun, getAgent, getRun } from "./db";
import { executeRun, type StreamEvent } from "./orchestrator";
import { executeRunViaWorker, isWorkerConfigured, workerHealthy } from "./workerBridge";

const noopEmit = (_event: StreamEvent) => {};

async function executeRunHeadless(runId: number): Promise<string> {
  const useWorker = isWorkerConfigured() && (await workerHealthy());
  const runner = useWorker ? executeRunViaWorker : executeRun;
  await runner(runId, noopEmit);
  const finished = await getRun(runId);
  return finished?.output ?? "";
}

export async function createAndExecuteRun(
  agentId: number,
  input: string,
  triggeredBy: number
): Promise<{ runId: number; output: string }> {
  const agent = await getAgent(agentId);
  if (!agent) throw new Error("Agent not found");

  const run = await createRun({
    agentId,
    fleetId: agent.fleetId,
    input: input.trim(),
    status: "queued",
    triggeredBy,
  });
  if (!run) throw new Error("Failed to create run");

  const output = await executeRunHeadless(run.id);
  return { runId: run.id, output };
}
