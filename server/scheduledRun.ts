import {
  createChatMessage,
  createChatThread,
  getAgentChannelByType,
  getLatestThreadForUserAgent,
} from "./db";
import { createAndExecuteRun } from "./agentRun";

/**
 * Creates a run for the agent, executes it headlessly, and posts the assistant
 * reply to the user's latest chat thread when the chat channel is enabled.
 */
export async function runScheduledAgent(agentId: number, input: string, triggeredBy: number): Promise<void> {
  const { runId, output } = await createAndExecuteRun(agentId, input, triggeredBy);

  const chatChannel = await getAgentChannelByType(agentId, "chat");
  if (!chatChannel?.enabled) return;

  let thread = await getLatestThreadForUserAgent(agentId, triggeredBy);
  if (!thread) {
    thread = await createChatThread({
      agentId,
      userId: triggeredBy,
      title: "Scheduled run",
    });
  }
  if (!thread) return;

  await createChatMessage({
    threadId: thread.id,
    role: "assistant",
    content: output || "(No response)",
    runId,
  });
}
