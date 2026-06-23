import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock, StatusTag, Tag } from "@/components/brutal";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, AlertTriangle } from "lucide-react";

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

export default function Inbox() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const { data: approvals, isLoading } = trpc.fleet.approvals.list.useQuery(
    filter === "all" ? undefined : { status: filter },
    { refetchInterval: 4000 }
  );

  const decideM = trpc.fleet.approvals.decide.useMutation({
    onSuccess: () => { utils.fleet.approvals.invalidate(); toast.success("Decision recorded"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Approval Inbox"
        description="Tool calls that require human sign-off pause here. Approve or reject to let the run continue."
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`press px-3 py-1.5 mono-label ${filter === f ? "bg-foreground text-background" : "border border-input hover:bg-muted"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading…</div>
      ) : (approvals?.length ?? 0) === 0 ? (
        <EmptyBlock title="Inbox zero" description="No tool calls are waiting for approval." />
      ) : (
        <div className="space-y-4">
          {approvals!.map((a) => (
            <Panel key={a.id} shadow={a.status === "pending"} className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    {a.status === "pending" && <AlertTriangle className="h-4 w-4" />}
                    <span className="font-mono text-sm font-bold">{a.toolName}</span>
                    <StatusTag status={a.status} />
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Link href={`/agents/${a.agentId}`}><span className="underline">{a.agentName ?? `Agent #${a.agentId}`}</span></Link>
                    <span>·</span>
                    <Link href={`/runs/${a.runId}`}><span className="underline">Run #{a.runId}</span></Link>
                    <span>·</span>
                    <span className="font-mono">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <pre className="max-h-32 overflow-auto border border-input bg-muted p-2 font-mono text-[0.7rem]">{JSON.stringify(a.args ?? {}, null, 2)}</pre>
                </div>
                {a.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => decideM.mutate({ id: a.id, decision: "approved" })} className="press inline-flex items-center gap-1.5 bg-foreground px-4 py-2.5 text-background">
                      <Check className="h-4 w-4" /> <span className="mono-label">Approve</span>
                    </button>
                    <button onClick={() => decideM.mutate({ id: a.id, decision: "rejected" })} className="press inline-flex items-center gap-1.5 border-2 border-foreground px-4 py-2.5">
                      <X className="h-4 w-4" /> <span className="mono-label">Reject</span>
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
