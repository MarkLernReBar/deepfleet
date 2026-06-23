import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, IdentityTag, StatusTag, Tag, EmptyBlock } from "@/components/brutal";
import { useLocation, useRoute, Link } from "wouter";
import { useState } from "react";
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
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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

type TabId = "overview" | "tools" | "sharing" | "code";

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

  const [tab, setTab] = useState<TabId>("overview");
  const [runOpen, setRunOpen] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  if (isLoading || !data) {
    return <div className="eyebrow animate-pulse">Loading agent…</div>;
  }

  const { agent, tools, subagents, shares, runs } = data;
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

  const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
    { id: "overview", label: "Overview", icon: Bot },
    { id: "tools", label: "Tools & Subagents", icon: Wrench },
    { id: "sharing", label: "Sharing", icon: Users },
    { id: "code", label: "Code export", icon: Code2 },
  ];

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
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-2 border-b-2 border-foreground">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("press -mb-0.5 flex items-center gap-2 border-2 border-b-0 px-4 py-2.5", tab === t.id ? "border-foreground bg-foreground text-background" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-4 w-4" /> <span className="mono-label">{t.label}</span>
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
    </div>
  );
}
