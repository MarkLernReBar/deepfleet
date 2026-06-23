// Client helper that consumes the /api/runs/stream SSE endpoint.
// Uses fetch + ReadableStream rather than EventSource so we can POST a body
// and send credentials. Event shapes mirror server/orchestrator.ts StreamEvent.

export type StepType = "plan" | "tool_call" | "tool_result" | "subagent" | "message";

export type TraceStep = {
  id: number;
  idx: number;
  type: StepType;
  name: string | null;
  content: Record<string, unknown>;
  status: string;
};

export type StreamEvent =
  | { event: "run"; data: { id: number; status: string } }
  | { event: "step"; data: TraceStep }
  | { event: "awaiting_approval"; data: { approvalId: number; toolName: string; args: Record<string, unknown> } }
  | { event: "usage"; data: { promptTokens: number; completionTokens: number; totalTokens: number; costMicroUsd: number } }
  | { event: "done"; data: { status: string; output: string } }
  | { event: "error"; data: { message: string } };

/**
 * Starts a run and streams events through `onEvent`. Resolves with the run id
 * as soon as it is known (so callers can navigate to the run page). The stream
 * continues in the background, invoking `onEvent` for each event.
 */
export function runAgentStream(
  agentId: number,
  input: string,
  onEvent: (e: StreamEvent) => void
): Promise<number> {
  return new Promise(async (resolve, reject) => {
    let resolved = false;
    try {
      const res = await fetch("/api/runs/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentId, input }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        reject(new Error(txt || `Request failed (${res.status})`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handle = (json: string) => {
        if (!json) return;
        try {
          const evt = JSON.parse(json) as StreamEvent;
          if (evt.event === "run" && !resolved) {
            resolved = true;
            resolve(evt.data.id);
          }
          onEvent(evt);
        } catch {
          /* ignore malformed chunk */
        }
      };

      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (dataLine) handle(dataLine.slice(5).trim());
        }
        return pump();
      };
      await pump();
      if (!resolved) reject(new Error("Stream ended before run id was received"));
    } catch (err) {
      if (!resolved) reject(err instanceof Error ? err : new Error("Stream error"));
    }
  });
}
