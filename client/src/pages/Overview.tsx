import { trpc } from "@/lib/trpc";
import { Display, Eyebrow, Panel, PageHeader, StatusTag } from "@/components/brutal";
import { Link } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Panel className="p-5">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-3 font-mono text-4xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Panel>
  );
}

export default function Overview() {
  const utils = trpc.useUtils();
  const { data: overview } = trpc.fleet.analytics.overview.useQuery();
  const { data: timeseries } = trpc.fleet.analytics.runsTimeseries.useQuery({ days: 14 });
  const { data: perAgent } = trpc.fleet.analytics.tokensPerAgent.useQuery();
  const { data: fleets } = trpc.fleet.fleets.list.useQuery();
  const { data: recentRuns } = trpc.fleet.runs.list.useQuery({ limit: 8 });

  const seed = trpc.seed.run.useMutation({
    onSuccess: (r) => {
      toast.success(r.created ? `Seeded ${r.fleets} fleets and ${r.agents} agents` : "Demo data already present");
      utils.fleet.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const successRate =
    overview && overview.totalRuns > 0 ? Math.round((overview.succeeded / overview.totalRuns) * 100) : 0;
  const costUsd = overview ? (overview.totalCostMicroUsd / 1_000_000).toFixed(2) : "0.00";
  const tokens = overview ? overview.totalTokens.toLocaleString() : "0";

  const chartData = (timeseries ?? []).map((d) => ({
    day: d.day.slice(5),
    runs: d.runs,
    tokens: d.tokens,
  }));

  const isEmpty = (fleets?.length ?? 0) === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Control Center"
        title="Overview"
        description="Operational snapshot of every fleet, agent, and run across the platform."
        actions={
          isEmpty ? (
            <button
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span className="mono-label">{seed.isPending ? "Seeding…" : "Load demo data"}</span>
            </button>
          ) : (
            <Link href="/agents/new">
              <span className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm">
                <span className="mono-label">New agent</span>
              </span>
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI label="Active agents" value={String(overview?.agentCount ?? 0)} sub={`${overview?.fleetCount ?? 0} fleets`} />
        <KPI label="Runs today" value={String(overview?.runsToday ?? 0)} sub={`${overview?.totalRuns ?? 0} all-time`} />
        <KPI label="Success rate" value={`${successRate}%`} sub={`${overview?.succeeded ?? 0} succeeded`} />
        <KPI label="Est. cost" value={`$${costUsd}`} sub={`${tokens} tokens`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Eyebrow>Runs · last 14 days</Eyebrow>
            <span className="mono-label text-muted-foreground">RUNS / DAY</span>
          </div>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.2} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ border: "2px solid var(--foreground)", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 12, background: "var(--card)" }}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar dataKey="runs" fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <Eyebrow>Tokens · last 14 days</Eyebrow>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.2} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="var(--muted-foreground)" width={36} />
                <Tooltip
                  contentStyle={{ border: "2px solid var(--foreground)", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 12, background: "var(--card)" }}
                />
                <Line type="stepAfter" dataKey="tokens" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <Eyebrow className="mb-4">Tokens per agent</Eyebrow>
          {(perAgent?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No run data yet.</p>
          ) : (
            <div className="space-y-3">
              {perAgent!.map((a) => {
                const max = Math.max(...perAgent!.map((x) => x.tokens), 1);
                return (
                  <div key={a.agentId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold">{a.agentName}</span>
                      <span className="font-mono text-muted-foreground">{a.tokens.toLocaleString()}</span>
                    </div>
                    <div className="h-3 w-full bg-muted">
                      <div className="h-full bg-foreground" style={{ width: `${(a.tokens / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <Eyebrow>Recent runs</Eyebrow>
            <Link href="/runs"><span className="mono-label underline">View all</span></Link>
          </div>
          {(recentRuns?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="divide-y divide-input">
              {recentRuns!.map((r) => (
                <Link key={r.id} href={`/runs/${r.id}`}>
                  <div className="press flex items-center justify-between py-3 hover:bg-muted">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{r.agentName ?? `Agent #${r.agentId}`}</div>
                      <div className="truncate font-mono text-[0.65rem] text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <StatusTag status={r.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
