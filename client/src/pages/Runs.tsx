import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock, StatusTag, Tag } from "@/components/brutal";
import { Link } from "wouter";
import { useMemo, useState } from "react";

const STATUSES = ["all", "succeeded", "running", "awaiting_approval", "failed", "queued"] as const;

export default function Runs() {
  const { data: runs, isLoading } = trpc.fleet.runs.list.useQuery({ limit: 200 });
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const filtered = useMemo(
    () => (runs ?? []).filter((r) => status === "all" || r.status === status),
    [runs, status]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Orchestration"
        title="Runs"
        description="Every agent execution, with its streamed trace, token usage, and cost."
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`press px-3 py-1.5 mono-label ${status === s ? "bg-foreground text-background" : "border border-input hover:bg-muted"}`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyBlock title="No runs" description="Trigger a run from any agent to populate this list." />
      ) : (
        <Panel className="overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b-2 border-foreground bg-muted px-4 py-2.5">
            <div className="col-span-1 mono-label text-muted-foreground">#</div>
            <div className="col-span-4 mono-label text-muted-foreground">Agent</div>
            <div className="col-span-2 mono-label text-muted-foreground">Status</div>
            <div className="col-span-2 mono-label text-right text-muted-foreground">Tokens</div>
            <div className="col-span-3 mono-label text-right text-muted-foreground">When</div>
          </div>
          <div className="divide-y divide-input">
            {filtered.map((r) => (
              <Link key={r.id} href={`/runs/${r.id}`}>
                <div className="press grid grid-cols-12 items-center gap-2 px-4 py-3 hover:bg-muted">
                  <div className="col-span-1 font-mono text-xs text-muted-foreground">{r.id}</div>
                  <div className="col-span-4 truncate text-sm font-semibold">{r.agentName ?? `Agent #${r.agentId}`}</div>
                  <div className="col-span-2"><StatusTag status={r.status} /></div>
                  <div className="col-span-2 text-right font-mono text-xs">{r.totalTokens.toLocaleString()}</div>
                  <div className="col-span-3 text-right font-mono text-[0.65rem] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
