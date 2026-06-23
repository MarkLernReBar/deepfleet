import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, StatusTag, Tag } from "@/components/brutal";
import { useRoute, Link, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { runAgentStream, type StreamEvent, type TraceStep } from "@/lib/runStream";
import {
  ListChecks,
  Wrench,
  CornerDownRight,
  MessageSquare,
  Bot,
  ArrowLeft,
  Play,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEP_META: Record<string, { icon: typeof ListChecks; label: string }> = {
  plan: { icon: ListChecks, label: "plan" },
  tool_call: { icon: Wrench, label: "tool_call" },
  tool_result: { icon: CornerDownRight, label: "tool_result" },
  subagent: { icon: Bot, label: "subagent" },
  message: { icon: MessageSquare, label: "message" },
};

function StepCard({ step }: { step: TraceStep }) {
  const meta = STEP_META[step.type] ?? { icon: MessageSquare, label: step.type };
  const Icon = meta.icon;
  const c = step.content ?? {};

  return (
    <div className="relative pl-10">
      <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center border-2 border-foreground bg-card">
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <Panel className={cn("p-4", step.status === "awaiting_approval" && "border-dashed", step.status === "error" && "bg-muted")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag variant="solid">{meta.label}</Tag>
            {step.name && step.type !== "plan" && <span className="font-mono text-sm font-semibold">{step.name}</span>}
          </div>
          {step.status !== "done" && <StatusTag status={step.status} />}
        </div>

        {step.type === "plan" && Array.isArray((c as { steps?: string[] }).steps) && (
          <ol className="ml-4 list-decimal space-y-1 text-sm">
            {((c as { steps: string[] }).steps).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}

        {step.type === "tool_call" && (
          <div className="space-y-2">
            {typeof (c as { reason?: string }).reason === "string" && (
              <p className="text-sm text-muted-foreground">{(c as { reason: string }).reason}</p>
            )}
            <pre className="overflow-auto border border-input bg-muted p-2 font-mono text-[0.7rem]">{JSON.stringify((c as { args?: unknown }).args ?? {}, null, 2)}</pre>
          </div>
        )}

        {step.type === "tool_result" && (
          <div className="text-sm">
            {(c as { rejected?: boolean }).rejected ? (
              <p className="font-mono text-xs">{String((c as { message?: string }).message ?? "Rejected")}</p>
            ) : (
              <pre className="overflow-auto whitespace-pre-wrap border border-input bg-muted p-2 font-mono text-[0.7rem]">{String((c as { result?: string }).result ?? "")}</pre>
            )}
          </div>
        )}

        {step.type === "subagent" && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Task: {String((c as { task?: string }).task ?? "")}</p>
            <div className="border border-input bg-muted p-2 text-xs"><Streamdown>{String((c as { result?: string }).result ?? "")}</Streamdown></div>
          </div>
        )}

        {step.type === "message" && (
          <div className="prose-sm max-w-none text-sm"><Streamdown>{String((c as { text?: string }).text ?? "")}</Streamdown></div>
        )}
      </Panel>
    </div>
  );
}

export default function RunTrace() {
  const [, params] = useRoute("/runs/:id");
  const id = Number(params?.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.fleet.runs.get.useQuery({ id }, { enabled: !!id, refetchInterval: false });
  const { data: agentData } = trpc.fleet.agents.get.useQuery(
    { id: data?.run.agentId ?? 0 },
    { enabled: !!data?.run.agentId }
  );

  // live steps overlaid on persisted steps
  const [liveSteps, setLiveSteps] = useState<TraceStep[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{ approvalId: number; toolName: string } | null>(null);
  const [rerunInput, setRerunInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const decideM = trpc.fleet.approvals.decide.useMutation({
    onSuccess: () => { toast.success("Decision recorded"); setPendingApproval(null); },
    onError: (e) => toast.error(e.message),
  });

  // Merge persisted + live steps by idx (live wins).
  const steps = useMemo(() => {
    const map = new Map<number, TraceStep>();
    (data?.steps ?? []).forEach((s) =>
      map.set(s.idx, { id: s.id, idx: s.idx, type: s.type as TraceStep["type"], name: s.name, content: (s.content as Record<string, unknown>) ?? {}, status: s.status })
    );
    liveSteps.forEach((s) => map.set(s.idx, s));
    return Array.from(map.values()).sort((a, b) => a.idx - b.idx);
  }, [data?.steps, liveSteps]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps.length]);

  const onEvent = (e: StreamEvent) => {
    if (e.event === "run") setLiveStatus(e.data.status);
    else if (e.event === "step") setLiveSteps((prev) => { const m = new Map(prev.map((s) => [s.idx, s])); m.set(e.data.idx, e.data); return Array.from(m.values()); });
    else if (e.event === "awaiting_approval") setPendingApproval({ approvalId: e.data.approvalId, toolName: e.data.toolName });
    else if (e.event === "done") { setLiveStatus(e.data.status); setStreaming(false); utils.fleet.runs.get.invalidate({ id }); utils.fleet.analytics.invalidate(); }
    else if (e.event === "error") { toast.error(e.data.message); setStreaming(false); }
  };

  const rerun = async () => {
    if (!data?.run.agentId) return;
    const input = rerunInput.trim() || data.run.input;
    setStreaming(true);
    setLiveSteps([]);
    try {
      const newId = await runAgentStream(data.run.agentId, input, onEvent);
      if (newId !== id) navigate(`/runs/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setStreaming(false);
    }
  };

  if (isLoading || !data) return <div className="eyebrow animate-pulse">Loading run…</div>;

  const { run } = data;
  const status = liveStatus ?? run.status;
  const cost = (run.costMicroUsd / 1_000_000).toFixed(4);

  return (
    <div className="space-y-8">
      <Link href="/runs">
        <span className="press inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> <span className="mono-label">All runs</span>
        </span>
      </Link>

      <div className="flex flex-col gap-4 border-b-2 border-foreground pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow className="mb-2">Run #{run.id}</Eyebrow>
          <Link href={`/agents/${run.agentId}`}>
            <h1 className="display-hero text-4xl underline-offset-4 hover:underline md:text-5xl">{agentData?.agent.name ?? `Agent #${run.agentId}`}</h1>
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusTag status={status} />
            {run.model && <Tag variant="muted">{run.model}</Tag>}
            <Tag variant="muted">{run.totalTokens.toLocaleString()} tok</Tag>
            <Tag variant="muted">${cost}</Tag>
          </div>
        </div>
        {!streaming && (
          <button onClick={rerun} className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm">
            <Play className="h-4 w-4" /> <span className="mono-label">Re-run</span>
          </button>
        )}
      </div>

      <Panel className="p-4">
        <Eyebrow className="mb-2">Input</Eyebrow>
        <p className="text-sm">{run.input}</p>
      </Panel>

      {pendingApproval && (
        <Panel className="border-dashed p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <div className="flex-1">
              <div className="text-sm font-bold">Approval required</div>
              <div className="mono-label text-muted-foreground">{pendingApproval.toolName} needs sign-off to proceed</div>
            </div>
            <button onClick={() => decideM.mutate({ id: pendingApproval.approvalId, decision: "approved" })} className="press inline-flex items-center gap-1.5 bg-foreground px-3 py-2 text-background">
              <Check className="h-4 w-4" /> <span className="mono-label">Approve</span>
            </button>
            <button onClick={() => decideM.mutate({ id: pendingApproval.approvalId, decision: "rejected" })} className="press inline-flex items-center gap-1.5 border-2 border-foreground px-3 py-2">
              <X className="h-4 w-4" /> <span className="mono-label">Reject</span>
            </button>
          </div>
        </Panel>
      )}

      {/* trace */}
      <div>
        <Eyebrow className="mb-4">Trace</Eyebrow>
        {steps.length === 0 ? (
          <Panel className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{streaming ? "Waiting for the first step…" : "No steps recorded. Re-run to generate a trace."}</p>
          </Panel>
        ) : (
          <div className="relative space-y-4">
            <div className="absolute bottom-4 left-4 top-4 w-0.5 bg-foreground/20" />
            {steps.map((s) => <StepCard key={`${s.idx}-${s.id}`} step={s} />)}
          </div>
        )}
        {streaming && (
          <div className="mt-4 pl-10">
            <div className="eyebrow animate-pulse">Streaming…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {run.output && !streaming && (
        <Panel shadow className="p-5">
          <Eyebrow className="mb-3">Final output</Eyebrow>
          <div className="prose-sm max-w-none text-sm"><Streamdown>{run.output}</Streamdown></div>
        </Panel>
      )}

      {!streaming && (
        <Panel className="p-4">
          <Eyebrow className="mb-2">Re-run with a different input</Eyebrow>
          <Textarea value={rerunInput} onChange={(e) => setRerunInput(e.target.value)} placeholder={run.input} rows={3} className="border-2 border-foreground" />
          <button onClick={rerun} className="press mt-3 inline-flex items-center gap-2 bg-foreground px-4 py-2 text-background mono-label">
            <Play className="h-4 w-4" /> Launch
          </button>
        </Panel>
      )}
    </div>
  );
}
