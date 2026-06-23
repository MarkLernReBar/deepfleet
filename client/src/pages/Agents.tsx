import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock, IdentityTag, StatusTag, Tag } from "@/components/brutal";
import { Link, useSearch } from "wouter";
import { useMemo, useState } from "react";
import { Plus, Bot } from "lucide-react";

const STATUSES = ["all", "active", "draft", "paused", "archived"] as const;

export default function Agents() {
  const search = useSearch();
  const fleetParam = new URLSearchParams(search).get("fleet");
  const fleetFilter = fleetParam ? Number(fleetParam) : undefined;

  const { data: agents, isLoading } = trpc.fleet.agents.list.useQuery(
    fleetFilter ? { fleetId: fleetFilter } : undefined
  );
  const { data: fleets } = trpc.fleet.fleets.list.useQuery();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const fleetName = (id: number) => fleets?.find((f) => f.id === id)?.name ?? `Fleet #${id}`;
  const fleetColor = (id: number) => fleets?.find((f) => f.id === id)?.color ?? "#18181b";

  const filtered = useMemo(
    () => (agents ?? []).filter((a) => status === "all" || a.status === status),
    [agents, status]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={fleetFilter ? `Fleet · ${fleetName(fleetFilter)}` : "All agents"}
        title="Agents"
        description="Every deepagent across your fleets. Each agent carries its model, prompt, tools, subagents, and harness."
        actions={
          <Link href={fleetFilter ? `/agents/new?fleet=${fleetFilter}` : "/agents/new"}>
            <span className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm">
              <Plus className="h-4 w-4" /> <span className="mono-label">New agent</span>
            </span>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`press px-3 py-1.5 mono-label ${status === s ? "bg-foreground text-background" : "border border-input hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title="No agents"
          description="Build your first agent with the no-code wizard."
          action={
            <Link href="/agents/new">
              <span className="press inline-flex items-center gap-2 border-2 border-foreground px-4 py-2.5">
                <Plus className="h-4 w-4" /> <span className="mono-label">New agent</span>
              </span>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`}>
              <Panel shadow className="press group flex h-full flex-col p-5 hover:bg-card">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground" style={{ background: fleetColor(a.fleetId) }}>
                    <Bot className="h-5 w-5 text-background" />
                  </div>
                  <StatusTag status={a.status} />
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-tight">{a.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{a.description || "No description"}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-input pt-3">
                  <IdentityTag type={a.identityType} />
                  <Tag variant="muted">{a.model}</Tag>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
