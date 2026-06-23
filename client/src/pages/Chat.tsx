import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock, Tag } from "@/components/brutal";
import { useSearch, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, MessageSquare, Plus, Send, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function Chat() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const agentIdParam = params.get("agentId");
  const threadIdParam = params.get("threadId");
  const agentId = agentIdParam ? Number(agentIdParam) : undefined;
  const threadId = threadIdParam ? Number(threadIdParam) : undefined;

  const [attentionOnly, setAttentionOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: agents, isLoading: agentsLoading } = trpc.fleet.agents.list.useQuery(undefined);
  const activeAgents = useMemo(
    () => (agents ?? []).filter((a) => a.status === "active"),
    [agents]
  );

  const { data: threads, isLoading: threadsLoading } = trpc.fleet.chat.threads.list.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId }
  );

  const filteredThreads = useMemo(
    () => (threads ?? []).filter((t) => !attentionOnly || t.needsAttention),
    [threads, attentionOnly]
  );

  const { data: messages, isLoading: messagesLoading } = trpc.fleet.chat.messages.list.useQuery(
    { threadId: threadId! },
    { enabled: !!threadId, refetchInterval: threadId ? 3000 : false }
  );

  const createThreadM = trpc.fleet.chat.threads.create.useMutation({
    onSuccess: (thread) => {
      utils.fleet.chat.threads.list.invalidate({ agentId: thread.agentId });
      navigate(`/chat?agentId=${thread.agentId}&threadId=${thread.id}`);
      toast.success("New chat started");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendM = trpc.fleet.chat.messages.send.useMutation({
    onSuccess: () => {
      utils.fleet.chat.messages.list.invalidate({ threadId: threadId! });
      utils.fleet.chat.threads.list.invalidate({ agentId: agentId! });
      setDraft("");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (agentId || activeAgents.length === 0) return;
    navigate(`/chat?agentId=${activeAgents[0]!.id}`);
  }, [agentId, activeAgents, navigate]);

  useEffect(() => {
    if (!agentId || threadId || filteredThreads.length === 0) return;
    navigate(`/chat?agentId=${agentId}&threadId=${filteredThreads[0]!.id}`);
  }, [agentId, threadId, filteredThreads, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, sendM.isPending]);

  const selectAgent = (id: number) => navigate(`/chat?agentId=${id}`);
  const selectThread = (id: number) => navigate(`/chat?agentId=${agentId}&threadId=${id}`);

  const send = () => {
    const content = draft.trim();
    if (!content || !threadId) return;
    sendM.mutate({ threadId, content });
  };

  const attentionCount = (threads ?? []).filter((t) => t.needsAttention).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Channels"
        title="Chat"
        description="Talk to your agents in threaded conversations. Scheduled runs and chat replies land here."
      />

      <div className="grid min-h-[32rem] grid-cols-1 gap-0 border-2 border-foreground lg:grid-cols-[12rem_14rem_1fr]">
        {/* agents */}
        <Panel className="rounded-none border-0 border-b-2 border-foreground lg:border-b-0 lg:border-r-2">
          <div className="border-b border-input p-3">
            <Eyebrow>Agents</Eyebrow>
          </div>
          <div className="max-h-64 overflow-y-auto lg:max-h-[28rem]">
            {agentsLoading ? (
              <p className="p-3 text-xs text-muted-foreground">Loading…</p>
            ) : activeAgents.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No active agents.</p>
            ) : (
              activeAgents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => selectAgent(a.id)}
                  className={cn(
                    "press flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm",
                    agentId === a.id ? "bg-foreground text-background" : "hover:bg-muted"
                  )}
                >
                  <Bot className="h-4 w-4 shrink-0" />
                  <span className="truncate font-medium">{a.name}</span>
                </button>
              ))
            )}
          </div>
        </Panel>

        {/* threads */}
        <Panel className="rounded-none border-0 border-b-2 border-foreground lg:border-b-0 lg:border-r-2">
          <div className="flex items-center justify-between border-b border-input p-3">
            <Eyebrow>Threads</Eyebrow>
            {agentId && (
              <button
                onClick={() => createThreadM.mutate({ agentId })}
                disabled={createThreadM.isPending}
                className="press border border-input p-1 hover:bg-muted disabled:opacity-50"
                title="New thread"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 border-b border-input p-2">
            <button
              onClick={() => setAttentionOnly(false)}
              className={cn(
                "press px-2 py-1 mono-label text-[0.65rem]",
                !attentionOnly ? "bg-foreground text-background" : "border border-input"
              )}
            >
              All
            </button>
            <button
              onClick={() => setAttentionOnly(true)}
              className={cn(
                "press inline-flex items-center gap-1 px-2 py-1 mono-label text-[0.65rem]",
                attentionOnly ? "bg-foreground text-background" : "border border-input"
              )}
            >
              Attention
              {attentionCount > 0 && (
                <span className="rounded bg-background px-1 text-foreground">{attentionCount}</span>
              )}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto lg:max-h-[24rem]">
            {!agentId ? (
              <p className="p-3 text-xs text-muted-foreground">Select an agent.</p>
            ) : threadsLoading ? (
              <p className="p-3 text-xs text-muted-foreground">Loading…</p>
            ) : filteredThreads.length === 0 ? (
              <EmptyBlock
                title={attentionOnly ? "Nothing needs attention" : "No threads"}
                description={attentionOnly ? undefined : "Start a new chat."}
              />
            ) : (
              filteredThreads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={cn(
                    "press flex w-full flex-col gap-1 border-b border-input px-3 py-2.5 text-left",
                    threadId === t.id ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{t.title}</span>
                    {t.needsAttention && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                  </div>
                  <span className="font-mono text-[0.6rem] text-muted-foreground">
                    {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString() : "New"}
                  </span>
                </button>
              ))
            )}
          </div>
        </Panel>

        {/* messages */}
        <Panel className="flex min-h-[20rem] flex-col rounded-none border-0">
          {!threadId ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyBlock title="Pick a thread" description="Choose or create a conversation to start chatting." />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                {messagesLoading ? (
                  <p className="text-xs text-muted-foreground">Loading messages…</p>
                ) : (messages?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Send a message to start.</p>
                ) : (
                  <div className="space-y-4">
                    {messages!.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[85%] rounded-none border-2 px-4 py-3",
                          m.role === "user"
                            ? "ml-auto border-foreground bg-foreground text-background"
                            : "border-input bg-muted"
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Tag variant={m.role === "user" ? "solid" : "outline"}>{m.role}</Tag>
                          {m.runId && (
                            <a href={`/runs/${m.runId}`} className="font-mono text-[0.6rem] underline opacity-70">
                              run #{m.runId}
                            </a>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                      </div>
                    ))}
                    {sendM.isPending && (
                      <div className="max-w-[85%] border-2 border-input bg-muted px-4 py-3">
                        <p className="text-sm text-muted-foreground">Agent is thinking…</p>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
              <div className="border-t-2 border-foreground p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="Message this agent…"
                    className="min-h-0 flex-1 resize-none border-2 border-foreground"
                    disabled={sendM.isPending}
                  />
                  <button
                    onClick={send}
                    disabled={sendM.isPending || !draft.trim()}
                    className="press flex shrink-0 items-center gap-2 self-end bg-foreground px-4 py-2.5 text-background disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    <span className="mono-label hidden sm:inline">Send</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
