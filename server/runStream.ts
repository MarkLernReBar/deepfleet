import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { createRun, getAgent } from "./db";
import { executeRun, type StreamEvent } from "./orchestrator";
import { executeRunViaWorker, isWorkerConfigured, workerHealthy } from "./workerBridge";

function writeEvent(res: Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function handleRunStream(req: Request, res: Response) {
  const user = await sdk.authenticateRequest(req);
  const { agentId, input } = req.body as { agentId?: number; input?: string };

  if (typeof agentId !== "number" || !input?.trim()) {
    res.status(400).json({ error: "agentId and input are required" });
    return;
  }

  const agent = await getAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const run = await createRun({
    agentId,
    fleetId: agent.fleetId,
    input: input.trim(),
    status: "queued",
    triggeredBy: user.id,
  });

  if (!run) {
    res.status(500).json({ error: "Failed to create run" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const emit = (event: StreamEvent) => writeEvent(res, event);

  try {
    const useWorker = isWorkerConfigured() && (await workerHealthy());
    const runner = useWorker ? executeRunViaWorker : executeRun;
    await runner(run.id, emit);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed";
    emit({ event: "error", data: { message } });
    emit({ event: "done", data: { status: "failed", output: "" } });
  } finally {
    res.end();
  }
}

export function registerRunStream(app: Express) {
  app.post("/api/runs/stream", async (req, res) => {
    try {
      await handleRunStream(req, res);
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status = err instanceof Error && err.message.includes("session") ? 401 : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : "Unauthorized" });
    }
  });
}
