import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, IdentityTag, StatusTag, Tag, EmptyBlock } from "@/components/brutal";
import { useLocation, useRoute, Link, useSearch } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Play,
  Pencil,
  Copy,
  Trash2,
  Share2,
  Code2,
  Users,
  Wrench,
  Bot,
  ArrowLeft,
  X,
  Brain,
  Calendar,
  Radio,
  Network,
} from "lucide-react";
import { AgentGraph } from "@/components/AgentGraph";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SHARE_ROLES } from "@shared/catalog";
import { cn } from "@/lib/utils";
import { runAgentStream } from "@/lib/runStream";

type TabId = "overview" | "graph" | "memory" | "tools" | "schedules" | "channels" | "sharing" | "code";

export default function AgentDetail() {
  const [, params] = useRoute("/agents/:id");
  const id = Number(params?.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.fleet.agents.get.useQuery({ id }, { enabled: !!id });
  const { data: codeData } = trpc.fleet.agents.code.useQuery({ id }, { enabled: !!id });
  const { data: fleets } = trpc.fleet.fleets.list.useQuery();
  const { data: users } = trpc.fleet.users.list.useQuery();
  const { data: creds } = trpc.fleet.credentials.list.useQuery();
  const { data: schedules } = trpc.fleet.schedules.list.useQuery({ agentId: id }, { enabled: !!id });
  const { data: channels } = trpc.fleet.channels.list.useQuery({ agentId: id }, { enabled: !!id });
  const { data: integrationStatus } = trpc.fleet.integrations.status.useQuery();

  const search = useSearch();
  const tabParam = new URLSearchParams(search).get("tab");

  const [tab, setTab] = useState<TabId>("overview");
  const [runOpen, setRunOpen] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryApprovalRequired, setMemoryApprovalRequired] = useState(true);
  const [memoryDirty, setMemoryDirty] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    description: "",
    cronExpression: "0 9 * * *",
    prompt: "",
    enabled: true,
  });

  // sharing form
  const [shareRole, setShareRole] = useState<(typeof SHARE_ROLES)[number]>("viewer");
  const [sharePrincipal, setSharePrincipal] = useState<string>("workspace");

  const cloneM = trpc.fleet.agents.clone.useMutation({
    onSuccess: (a) => { utils.fleet.invalidate(); toast.success("Agent cloned"); navigate(`/agents/${a!.id}`); },
    onError: (e) => toast.error(e.message),
  });
  const deleteM = trpc.fleet.agents.delete.useMutation({
    onSuccess: () => { utils.fleet.invalidate(); toast.success("Agent deleted"); navigate("/agents"); },
    onError: (e) => toast.error(e.message),
  });
  const grantM = trpc.fleet.shares.grant.useMutation({
    onSuccess: () => { utils.fleet.agents.get.invalidate({ id }); toast.success("Access granted"); },
    onError: (e) => toast.error(e.message),
  });
  const revokeM = trpc.fleet.shares.revoke.useMutation({
    onSuccess: () => { utils.fleet.agents.get.invalidate({ id }); toast.success("Access revoked"); },
    onError: (e) => toast.error(e.message),
  });
  const updateM = trpc.fleet.agents.update.useMutation({
    onSuccess: () => {
      utils.fleet.agents.get.invalidate({ id });
      setMemoryDirty(false);
      toast.success("Agent updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const createScheduleM = trpc.fleet.schedules.create.useMutation({
    onSuccess: () => {
      utils.fleet.schedules.list.invalidate({ agentId: id });
      setScheduleOpen(false);
      setScheduleForm({ name: "", description: "", cronExpression: "0 9 * * *", prompt: "", enabled: true });
      toast.success("Schedule created");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateScheduleM = trpc.fleet.schedules.update.useMutation({
    onSuccess: () => {
      utils.fleet.schedules.list.invalidate({ agentId: id });
      toast.success("Schedule updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteScheduleM = trpc.fleet.schedules.delete.useMutation({
    onSuccess: () => {
      utils.fleet.schedules.list.invalidate({ agentId: id });
      toast.success("Schedule removed");
    },
    onError: (e) => toast.error(e.message),
  });
  const upsertChannelM = trpc.fleet.channels.upsert.useMutation({
    onSuccess: () => {
      utils.fleet.channels.list.invalidate({ agentId: id });
      toast.success("Channel updated");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!tabParam) return;
    const allowed: TabId[] = ["overview", "graph", "memory", "tools", "schedules", "channels", "sharing", "code"];
    if (allowed.includes(tabParam as TabId)) setTab(tabParam as TabId);
  }, [tabParam]);

  useEffect(() => {
    if (memoryDirty || !data?.agent) return;
    setMemoryContent(data.agent.memoryContent ?? "");
    setMemoryApprovalRequired(data.agent.memoryApprovalRequired ?? true);
  }, [data?.agent.memoryContent, data?.agent.memoryApprovalRequired, memoryDirty, data?.agent]);

  if (isLoading || !data) {
    return <div className="eyebrow animate-pulse">Loading agent…</div>;
  }

  const { agent, tools, subagents, shares, runs } = data;
  const memoryHarnessOn = Boolean(agent.harness?.memory);
  const fleet = fleets?.find((f) => f.id === agent.fleetId);
  const credential = creds?.find((c) => c.id === agent.credentialId);

  const launch = async () => {
    if (!runInput.trim()) return toast.error("Enter an input for the run");
    setLaunching(true);
    try {
      const runId = await runAgentStream(agent.id, runInput, () => {});
      toast.success("Run started");
      setRunOpen(false);
      setRunInput("");
      navigate(`/runs/${runId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setLaunching(false);
    }
  };

  const grant = () => {
    if (sharePrincipal === "workspace") {
      grantM.mutate({ agentId: id, principalType: "workspace", role: shareRole });
    } else {
      grantM.mutate({ agentId: id, principalType: "user", principalUserId: Number(sharePrincipal), role: shareRole });
    }
  };

  const TABS: { id: TabId; label: string; icon: typeof Bot; prominent?: boolean }[] = [
    { id: "overview", label: "Overview", icon: Bot },
    { id: "graph", label: "Graph", icon: Network },
    ...(memoryHarnessOn
      ? [{ id: "memory" as const, label: "Memory", icon: Brain, prominent: true }]
      : [{ id: "memory" as const, label: "Memory", icon: Brain }]),
    { id: "tools", label: "Tools & Subagents", icon: Wrench },
    { id: "schedules", label: "Schedules", icon: Calendar },
    { id: "channels", label: "Channels", icon: Radio },
    { id: "sharing", label: "Sharing", icon: Users },
    { id: "code", label: "Code export", icon: Code2 },
  ];

  const saveMemory = () => {
    updateM.mutate({
      id,
      memoryContent: memoryContent.trim() || null,
      memoryApprovalRequired,
    });
  };

  const channelEnabled = (type: "chat" | "slack" | "gmail") =>
    channels?.find((c) => c.type === type)?.enabled ?? (type === "chat");

  const channelConfig = (type: "chat" | "slack" | "gmail") => {
    const ch = channels?.find((c) => c.type === type);
    return (ch?.config as { credentialId?: number } | null) ?? {};
  };

  const toggleChannel = (type: "chat" | "slack" | "gmail", enabled: boolean) => {
    const config = channelConfig(type);
    upsertChannelM.mutate({
      agentId: id,
      type,
      enabled,
      config: Object.keys(config).length ? config : null,
    });
  };

  const setChannelCredential = (type: "slack" | "gmail", credentialId: string) => {
    upsertChannelM.mutate({
      agentId: id,
      type,
      enabled: channelEnabled(type),
      config: credentialId ? { credentialId: Number(credentialId) } : null,
    });
  };

  const credsForProvider = (provider: string) =>
    creds?.filter((c) => c.provider === provider || (provider === "gmail" && c.provider === "google")) ?? [];

  const connectChannel = (type: "slack" | "gmail") => {
    const ok = type === "gmail" ? integrationStatus?.google : integrationStatus?.slack;
    if (!ok) {
      return toast.error(
        type === "gmail"
          ? "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server"
          : "Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET on the server"
      );
    }
    window.location.href = `/api/integrations/${type === "gmail" ? "google" : "slack"}/start?agentId=${id}`;
  };

  const submitSchedule = () => {
    if (!scheduleForm.name.trim() || !scheduleForm.cronExpression.trim() || !scheduleForm.prompt.trim()) {
      return toast.error("Name, cron, and prompt are required");
    }
    createScheduleM.mutate({
      agentId: id,
      name: scheduleForm.name.trim(),
      description: scheduleForm.description.trim() || undefined,
      cronExpression: scheduleForm.cronExpression.trim(),
      prompt: scheduleForm.prompt.trim(),
      enabled: scheduleForm.enabled,
    });
  };

  return (
    <div className="space-y-8">
      <Link href="/agents">
        <span className="press inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> <span className="mono-label">All agents</span>
        </span>
      </Link>

      <PageHeader
        eyebrow={fleet ? `Fleet · ${fleet.name}` : "Agent"}
        title={agent.name}
        description={agent.description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRunOpen(true)} className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm">
              <Play className="h-4 w-4" /> <span className="mono-label">Run</span>
            </button>
            <Link href={`/agents/${id}/edit`}>
              <span className="press inline-flex items-center gap-2 border-2 border-foreground px-3 py-2.5"><Pencil className="h-4 w-4" /></span>
            </Link>
            <button onClick={() => cloneM.mutate({ id })} className="press border-2 border-foreground px-3 py-2.5"><Copy className="h-4 w-4" /></button>
            <button onClick={() => setDeleteOpen(true)} className="press border-2 border-foreground px-3 py-2.5"><Trash2 className="h-4 w-4" /></button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusTag status={agent.status} />
        <IdentityTag type={agent.identityType} />
        <Tag variant="outline">{agent.model}</Tag>
        {credential && <Tag variant="muted">cred: {credential.name}</Tag>}
        {agent.triggersPaused && <Tag variant="outline">Triggers paused</Tag>}
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-2 border-b-2 border-foreground">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "press -mb-0.5 flex items-center gap-2 border-2 border-b-0 px-4 py-2.5",
                tab === t.id
                  ? "border-foreground bg-foreground text-background"
                  : t.prominent
                  ? "border-foreground bg-muted text-foreground shadow-brutal-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" /> <span className="mono-label">{t.label}</span>
              {t.prominent && tab !== t.id && (
                <span className="mono-label bg-foreground px-1.5 py-0.5 text-[0.6rem] text-background">ON</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="p-5 lg:col-span-2">
            <Eyebrow className="mb-3">System prompt</Eyebrow>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap border border-input bg-muted p-4 font-mono text-xs">{agent.systemPrompt || "No system prompt set."}</pre>
          </Panel>
          <div className="space-y-4">
            <Panel className="p-5">
              <Eyebrow className="mb-3">Harness</Eyebrow>
              <div className="space-y-2">
                {Object.entries(agent.harness ?? {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{k}</span>
                    <span className={cn("mono-label px-2 py-0.5", v ? "bg-foreground text-background" : "border border-input text-muted-foreground")}>{v ? "ON" : "OFF"}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="p-5">
              <Eyebrow className="mb-3">Triggers</Eyebrow>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-sm">Pause scheduled runs</span>
                <Switch
                  checked={agent.triggersPaused}
                  onCheckedChange={(v) => updateM.mutate({ id, triggersPaused: v })}
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                When paused, cron schedules will not fire until re-enabled.
              </p>
            </Panel>
            <Panel className="p-5">
              <Eyebrow className="mb-3">Recent runs</Eyebrow>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                <div className="divide-y divide-input">
                  {runs.slice(0, 6).map((r) => (
                    <Link key={r.id} href={`/runs/${r.id}`}>
                      <div className="press flex items-center justify-between py-2 hover:bg-muted">
                        <span className="font-mono text-[0.65rem] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                        <StatusTag status={r.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === "graph" && (
        <Panel className="p-5">
          <AgentGraph
            agentName={agent.name}
            model={`${agent.modelProvider}:${agent.model}`}
            tools={tools.map((t) => ({ slug: t.tool.slug, type: t.tool.type }))}
            subagents={subagents.map((s) => ({ name: s.name, model: s.model }))}
            skills={(agent.skills as string[]) ?? []}
            schedules={(schedules ?? []).map((s) => ({
              name: s.name,
              enabled: s.enabled,
              cronExpression: s.cronExpression,
            }))}
            channels={(channels ?? []).map((c) => ({ type: c.type, enabled: c.enabled }))}
            triggersPaused={agent.triggersPaused}
          />
        </Panel>
      )}

      {tab === "memory" && (
        <Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <Eyebrow>AGENTS.md</Eyebrow>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Persistent agent memory injected into the system prompt on each run when the memory harness is enabled.
              </p>
            </div>
            {!memoryHarnessOn && (
              <Tag variant="outline">Memory harness off — enable in agent settings to inject at runtime</Tag>
            )}
          </div>
          <Textarea
            value={memoryContent}
            onChange={(e) => {
              setMemoryContent(e.target.value);
              setMemoryDirty(true);
            }}
            rows={18}
            placeholder="# Agent memory&#10;&#10;Notes, preferences, and context that persist across runs…"
            className="border-2 border-foreground font-mono text-xs"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t-2 border-foreground pt-4">
            <label className="flex cursor-pointer items-center gap-3">
              <Switch
                checked={memoryApprovalRequired}
                onCheckedChange={(v) => {
                  setMemoryApprovalRequired(v);
                  setMemoryDirty(true);
                }}
              />
              <span className="text-sm">Require approval before memory writes</span>
            </label>
            <button
              onClick={saveMemory}
              disabled={updateM.isPending || !memoryDirty}
              className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background disabled:opacity-50"
            >
              <span className="mono-label">{updateM.isPending ? "Saving…" : "Save memory"}</span>
            </button>
          </div>
        </Panel>
      )}

      {tab === "tools" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel className="p-5">
            <Eyebrow className="mb-4">Tools ({tools.length})</Eyebrow>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tools attached.</p>
            ) : (
              <div className="space-y-2">
                {tools.map((t) => (
                  <div key={t.id} className="flex items-center justify-between border border-input p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{t.tool.slug}</span>
                        {t.tool.type === "mcp" && <span className="mono-label bg-foreground px-1 text-background">mcp</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.tool.description}</p>
                    </div>
                    {t.tool.requiresApproval && <span className="mono-label border border-foreground px-1.5 py-0.5">approval</span>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel className="p-5">
            <Eyebrow className="mb-4">Subagents ({subagents.length})</Eyebrow>
            {subagents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subagents.</p>
            ) : (
              <div className="space-y-2">
                {subagents.map((s) => {
                  const subagentTools = (s.tools as string[]) ?? [];
                  return (
                    <div key={s.id} className="border border-input p-3">
                      <div className="font-mono text-sm font-semibold">{s.name}</div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="mono-label text-muted-foreground">Model</span>
                        {s.model ? (
                          <Tag variant="muted">{s.model}</Tag>
                        ) : (
                          <span className="text-xs text-muted-foreground">Inherits orchestrator</span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="mono-label text-muted-foreground">Tools</span>
                        {subagentTools.length === 0 ? (
                          <span className="text-xs text-muted-foreground">All orchestrator tools</span>
                        ) : (
                          subagentTools.map((slug) => (
                            <Tag key={slug} variant="outline">{slug}</Tag>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "schedules" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Cron schedules run this agent automatically. Standard 5-field cron (UTC).
            </p>
            <button
              onClick={() => setScheduleOpen(true)}
              className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background"
            >
              <Calendar className="h-4 w-4" /> <span className="mono-label">Add schedule</span>
            </button>
          </div>
          {(schedules?.length ?? 0) === 0 ? (
            <EmptyBlock title="No schedules" description="Add a cron schedule to run this agent on a timer." />
          ) : (
            <div className="space-y-3">
              {schedules!.map((s) => (
                <Panel key={s.id} className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold">{s.name}</span>
                        <Tag variant={s.enabled ? "solid" : "outline"}>{s.enabled ? "enabled" : "disabled"}</Tag>
                      </div>
                      {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
                      <div className="mt-2 font-mono text-xs">
                        <span className="text-muted-foreground">cron </span>
                        {s.cronExpression}
                      </div>
                      <pre className="mt-2 max-h-24 overflow-auto border border-input bg-muted p-2 font-mono text-[0.7rem]">{s.prompt}</pre>
                      {s.lastRunAt && (
                        <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">
                          Last run: {new Date(s.lastRunAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        onClick={() => updateScheduleM.mutate({ id: s.id, enabled: !s.enabled })}
                        className="press border-2 border-foreground px-3 py-1.5 mono-label"
                      >
                        {s.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteScheduleM.mutate({ id: s.id })}
                        className="press border border-input p-1.5 hover:bg-muted"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "channels" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              { type: "chat" as const, label: "Chat", desc: "In-app threaded chat (enabled by default)" },
              { type: "slack" as const, label: "Slack", desc: "Post and receive via Slack workspace" },
              { type: "gmail" as const, label: "Gmail", desc: "Email inbox and send via Gmail" },
            ] as const
          ).map((ch) => (
            <Panel key={ch.type} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Eyebrow>{ch.label}</Eyebrow>
                <Switch
                  checked={channelEnabled(ch.type)}
                  onCheckedChange={(v) => toggleChannel(ch.type, v)}
                  disabled={upsertChannelM.isPending}
                />
              </div>
              <p className="text-sm text-muted-foreground">{ch.desc}</p>
              {ch.type === "chat" && channelEnabled("chat") && (
                <Link href={`/chat?agentId=${id}`}>
                  <span className="press mt-4 inline-block mono-label text-sm underline">Open chat →</span>
                </Link>
              )}
              {(ch.type === "slack" || ch.type === "gmail") && (
                <div className="mt-4 space-y-2 border-t border-input pt-4">
                  <Eyebrow>Credential</Eyebrow>
                  {!channelConfig(ch.type).credentialId && (
                    <button
                      onClick={() => connectChannel(ch.type)}
                      className="press mb-2 w-full bg-foreground py-2 text-background mono-label text-sm"
                    >
                      Connect {ch.label}
                    </button>
                  )}
                  <Select
                    value={channelConfig(ch.type).credentialId ? String(channelConfig(ch.type).credentialId) : ""}
                    onValueChange={(v) => setChannelCredential(ch.type, v)}
                  >
                    <SelectTrigger className="rounded-none border-2 border-foreground">
                      <SelectValue placeholder={`Select ${ch.label} OAuth credential`} />
                    </SelectTrigger>
                    <SelectContent>
                      {credsForProvider(ch.type).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} ({c.kind})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Link href="/credentials">
                    <span className="text-xs underline text-muted-foreground">Manage credentials →</span>
                  </Link>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}

      {tab === "sharing" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="p-5 lg:col-span-2">
            <Eyebrow className="mb-4">Access list</Eyebrow>
            {shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">No share records.</p>
            ) : (
              <div className="divide-y divide-input">
                {shares.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-muted">
                        {s.principalType === "workspace" ? <Users className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {s.principalType === "workspace" ? "Entire workspace" : s.userName ?? s.userEmail ?? `User #${s.principalUserId}`}
                        </div>
                        <div className="mono-label text-muted-foreground">{s.principalType}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag variant={s.role === "owner" ? "solid" : "outline"}>{s.role}</Tag>
                      {s.role !== "owner" && (
                        <button onClick={() => revokeM.mutate({ id: s.id })} className="press border border-input p-1 hover:bg-muted">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel className="p-5">
            <Eyebrow className="mb-4">Grant access</Eyebrow>
            <div className="space-y-3">
              <div>
                <span className="mono-label mb-1.5 block text-muted-foreground">Principal</span>
                <Select value={sharePrincipal} onValueChange={setSharePrincipal}>
                  <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">Entire workspace</SelectItem>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name ?? u.email ?? `User #${u.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="mono-label mb-1.5 block text-muted-foreground">Role</span>
                <Select value={shareRole} onValueChange={(v) => setShareRole(v as typeof shareRole)}>
                  <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHARE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <button onClick={grant} disabled={grantM.isPending} className="press flex w-full items-center justify-center gap-2 bg-foreground py-2.5 text-background disabled:opacity-50">
                <Share2 className="h-4 w-4" /> <span className="mono-label">Grant</span>
              </button>
            </div>
          </Panel>
        </div>
      )}

      {tab === "code" && (
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <Eyebrow>create_deep_agent() snippet</Eyebrow>
            <button
              onClick={() => { navigator.clipboard.writeText(codeData?.code ?? ""); toast.success("Copied"); }}
              className="press inline-flex items-center gap-1.5 border-2 border-foreground px-3 py-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> <span className="mono-label">Copy</span>
            </button>
          </div>
          <pre className="overflow-auto border border-input bg-muted p-4 font-mono text-xs leading-relaxed">{codeData?.code ?? "Generating…"}</pre>
        </Panel>
      )}

      {/* run dialog */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="display-hero text-2xl">Run agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Eyebrow>Input</Eyebrow>
            <Textarea value={runInput} onChange={(e) => setRunInput(e.target.value)} rows={5} placeholder="Describe the task for this agent…" className="border-2 border-foreground" />
            <p className="text-xs text-muted-foreground">Steps stream live and are persisted to the run trace.</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setRunOpen(false)} className="press border-2 border-foreground px-4 py-2 mono-label">Cancel</button>
            <button onClick={launch} disabled={launching} className="press inline-flex items-center gap-2 bg-foreground px-4 py-2 text-background mono-label disabled:opacity-50">
              <Play className="h-4 w-4" /> {launching ? "Starting…" : "Launch"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-2 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the agent and its runs, traces, shares, and subagents.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-2 border-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-none bg-foreground" onClick={() => deleteM.mutate({ id })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="display-hero text-2xl">New schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Eyebrow className="mb-1">Name</Eyebrow>
              <Input
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))}
                className="border-2 border-foreground"
                placeholder="Daily standup digest"
              />
            </div>
            <div>
              <Eyebrow className="mb-1">Cron (UTC)</Eyebrow>
              <Input
                value={scheduleForm.cronExpression}
                onChange={(e) => setScheduleForm((f) => ({ ...f, cronExpression: e.target.value }))}
                className="border-2 border-foreground font-mono"
                placeholder="0 9 * * *"
              />
            </div>
            <div>
              <Eyebrow className="mb-1">Prompt</Eyebrow>
              <Textarea
                value={scheduleForm.prompt}
                onChange={(e) => setScheduleForm((f) => ({ ...f, prompt: e.target.value }))}
                rows={4}
                className="border-2 border-foreground"
                placeholder="What should the agent do on each run?"
              />
            </div>
            <label className="flex items-center gap-3">
              <Switch
                checked={scheduleForm.enabled}
                onCheckedChange={(v) => setScheduleForm((f) => ({ ...f, enabled: v }))}
              />
              <span className="text-sm">Enabled</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setScheduleOpen(false)} className="press border-2 border-foreground px-4 py-2 mono-label">Cancel</button>
            <button onClick={submitSchedule} disabled={createScheduleM.isPending} className="press bg-foreground px-4 py-2 text-background mono-label disabled:opacity-50">
              {createScheduleM.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
