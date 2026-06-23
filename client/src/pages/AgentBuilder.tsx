import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, IdentityTag } from "@/components/brutal";
import { useLocation, useRoute, useSearch } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  MODEL_PROVIDERS,
  MODELS_BY_PROVIDER,
  HARNESS_DEFAULTS,
  type ModelProvider,
} from "@shared/catalog";
import { cn } from "@/lib/utils";

type SubAgentDraft = { name: string; description: string; prompt: string; model: string; tools: string[] };

const STEPS = ["Identity", "Model", "Prompt", "Tools", "Subagents", "Harness"] as const;

export default function AgentBuilder() {
  const [, params] = useRoute("/agents/:id/edit");
  const editId = params?.id ? Number(params.id) : null;
  const search = useSearch();
  const fleetParam = new URLSearchParams(search).get("fleet");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: fleets } = trpc.fleet.fleets.list.useQuery();
  const { data: tools } = trpc.fleet.tools.list.useQuery({ onlyAvailable: true });
  const { data: existing } = trpc.fleet.agents.get.useQuery(
    { id: editId! },
    { enabled: editId !== null }
  );

  const [step, setStep] = useState(0);
  const [fleetId, setFleetId] = useState<number | null>(fleetParam ? Number(fleetParam) : null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [identityType, setIdentityType] = useState<"claw" | "assistant">("claw");
  const [provider, setProvider] = useState<ModelProvider>("openai");
  const [model, setModel] = useState("gpt-5");
  const [customModel, setCustomModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [toolIds, setToolIds] = useState<number[]>([]);
  const [subagents, setSubagents] = useState<SubAgentDraft[]>([]);
  const [harness, setHarness] = useState({ ...HARNESS_DEFAULTS });
  const [skills, setSkills] = useState("");

  // hydrate on edit
  useEffect(() => {
    if (!existing) return;
    const a = existing.agent;
    setFleetId(a.fleetId);
    setName(a.name);
    setDescription(a.description ?? "");
    setIdentityType(a.identityType);
    setProvider(a.modelProvider as ModelProvider);
    setModel(a.model);
    setSystemPrompt(a.systemPrompt ?? "");
    setToolIds(existing.tools.map((t) => t.toolId));
    setSubagents(
      existing.subagents.map((s) => ({
        name: s.name,
        description: s.description ?? "",
        prompt: s.prompt ?? "",
        model: s.model ?? "",
        tools: (s.tools as string[]) ?? [],
      }))
    );
    setHarness({ ...HARNESS_DEFAULTS, ...(a.harness ?? {}) });
    setSkills(((a.skills as string[]) ?? []).join(", "));
  }, [existing]);

  // default fleet
  useEffect(() => {
    if (fleetId === null && fleets && fleets.length) setFleetId(fleets[0].id);
  }, [fleets, fleetId]);

  const effectiveModel = provider === "custom" ? customModel : model;

  const createM = trpc.fleet.agents.create.useMutation({
    onSuccess: (a) => { utils.fleet.invalidate(); toast.success("Agent created"); navigate(`/agents/${a!.id}`); },
    onError: (e) => toast.error(e.message),
  });
  const updateM = trpc.fleet.agents.update.useMutation({
    onSuccess: () => { utils.fleet.invalidate(); toast.success("Agent updated"); navigate(`/agents/${editId}`); },
    onError: (e) => toast.error(e.message),
  });

  const toggleTool = (id: number) => setToolIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = () => {
    if (!fleetId) return toast.error("Select a fleet");
    if (!name.trim()) return toast.error("Name is required");
    if (!effectiveModel.trim()) return toast.error("Model is required");
    const payload = {
      fleetId,
      name,
      description,
      identityType,
      modelProvider: provider,
      model: effectiveModel,
      systemPrompt,
      harness,
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      toolIds,
      subagents: subagents.filter((s) => s.name.trim()),
    };
    if (editId) updateM.mutate({ id: editId, ...payload });
    else createM.mutate({ ...payload, status: "active" });
  };

  const models = MODELS_BY_PROVIDER[provider];
  const selectedFleet = fleets?.find((f) => f.id === fleetId);

  const canNext = useMemo(() => {
    if (step === 0) return !!fleetId && name.trim().length > 0;
    if (step === 1) return effectiveModel.trim().length > 0;
    return true;
  }, [step, fleetId, name, effectiveModel]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={editId ? "Edit agent" : "No-code builder"}
        title={editId ? "Edit Agent" : "Build Agent"}
        description="Configure a deepagents agent step by step. No code required."
      />

      {/* stepper */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={cn(
              "press flex items-center gap-2 border-2 px-3 py-1.5",
              i === step ? "border-foreground bg-foreground text-background" : i < step ? "border-foreground" : "border-input text-muted-foreground"
            )}
          >
            <span className="font-mono text-[0.65rem]">{i < step ? <Check className="h-3 w-3" /> : `0${i + 1}`}</span>
            <span className="mono-label">{s}</span>
          </button>
        ))}
      </div>

      <Panel shadow className="p-6 md:p-8">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <Eyebrow className="mb-2">Fleet</Eyebrow>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {fleets?.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFleetId(f.id)}
                    className={cn("press border-2 p-3 text-left", fleetId === f.id ? "border-foreground bg-muted" : "border-input")}
                  >
                    <div className="mb-2 h-2 w-8" style={{ background: f.color ?? "#18181b" }} />
                    <div className="text-sm font-bold">{f.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Eyebrow className="mb-1.5">Name</Eyebrow>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Market Analyst" className="border-2 border-foreground" />
              </div>
              <div>
                <Eyebrow className="mb-1.5">Description</Eyebrow>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Researches markets…" className="border-2 border-foreground" />
              </div>
            </div>
            <div>
              <Eyebrow className="mb-2">Identity type</Eyebrow>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button onClick={() => setIdentityType("claw")} className={cn("press border-2 p-4 text-left", identityType === "claw" ? "border-foreground bg-muted" : "border-input")}>
                  <div className="mb-1 flex items-center gap-2"><IdentityTag type="claw" /></div>
                  <p className="text-xs text-muted-foreground">Shared service identity. Uses shared (Claw) credentials for every run.</p>
                </button>
                <button onClick={() => setIdentityType("assistant")} className={cn("press border-2 p-4 text-left", identityType === "assistant" ? "border-foreground bg-muted" : "border-input")}>
                  <div className="mb-1 flex items-center gap-2"><IdentityTag type="assistant" /></div>
                  <p className="text-xs text-muted-foreground">Per-user identity. Each user runs with their own (Assistant) credentials.</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Eyebrow className="mb-2">Provider</Eyebrow>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {MODEL_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setProvider(p.id); if (p.id !== "custom") setModel(MODELS_BY_PROVIDER[p.id][0] ?? ""); }}
                    className={cn("press border-2 p-3 text-center", provider === p.id ? "border-foreground bg-foreground text-background" : "border-input")}
                  >
                    <span className="mono-label">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {provider === "custom" ? (
              <div>
                <Eyebrow className="mb-1.5">Custom model id</Eyebrow>
                <Input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="my-org/my-model" className="border-2 border-foreground font-mono" />
                <p className="mt-2 text-xs text-muted-foreground">The provider prefix in the export will be <span className="font-mono">custom:</span>.</p>
              </div>
            ) : (
              <div>
                <Eyebrow className="mb-2">Model</Eyebrow>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {models.map((m) => (
                    <button key={m} onClick={() => setModel(m)} className={cn("press border-2 px-4 py-3 text-left font-mono text-sm", model === m ? "border-foreground bg-muted" : "border-input")}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Eyebrow>System prompt</Eyebrow>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={14}
              placeholder="You are a meticulous market analyst. Research thoroughly, cite sources…"
              className="border-2 border-foreground font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{systemPrompt.length} characters</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Eyebrow>Tool picker</Eyebrow>
            {(tools?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No tools available. Add tools in the Tools & MCP catalog.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {tools!.map((t) => {
                  const on = toolIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => toggleTool(t.id)} className={cn("press flex items-start gap-3 border-2 p-3 text-left", on ? "border-foreground bg-muted" : "border-input")}>
                      <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 border-foreground", on && "bg-foreground")}>
                        {on && <Check className="h-3 w-3 text-background" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{t.slug}</span>
                          {t.requiresApproval && <span className="mono-label border border-foreground px-1">approval</span>}
                          {t.type === "mcp" && <span className="mono-label bg-foreground px-1 text-background">mcp</span>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Eyebrow>Subagents</Eyebrow>
              <button
                onClick={() => setSubagents((p) => [...p, { name: "", description: "", prompt: "", model: "", tools: [] }])}
                className="press inline-flex items-center gap-1.5 border-2 border-foreground px-3 py-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> <span className="mono-label">Add subagent</span>
              </button>
            </div>
            {subagents.length === 0 && <p className="text-sm text-muted-foreground">No subagents. The agent will operate on its own.</p>}
            {subagents.map((s, i) => (
              <Panel key={i} className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="mono-label">Subagent {i + 1}</span>
                  <button onClick={() => setSubagents((p) => p.filter((_, j) => j !== i))} className="press border border-input p-1 hover:bg-muted">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input value={s.name} onChange={(e) => setSubagents((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="name (e.g. fact-checker)" className="border-2 border-foreground" />
                  <Input value={s.description} onChange={(e) => setSubagents((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="description" className="border-2 border-foreground" />
                </div>
                <Textarea value={s.prompt} onChange={(e) => setSubagents((p) => p.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} placeholder="subagent prompt" rows={3} className="mt-3 border-2 border-foreground font-mono text-sm" />
              </Panel>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <Eyebrow className="mb-3">Harness options</Eyebrow>
              <div className="divide-y divide-input border-2 border-foreground">
                {([
                  ["planning", "Planning", "Maintain a structured to-do plan across steps."],
                  ["filesystem", "Filesystem", "Give the agent a virtual file system for scratch work."],
                  ["memory", "Memory", "Persist long-term memory across runs (AGENTS.md)."],
                  ["skills", "Skills", "Load on-demand skill instructions when relevant."],
                  ["summarization", "Summarization", "Auto-summarize long histories to manage context."],
                ] as const).map(([key, label, desc]) => (
                  <div key={key} className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    <Switch checked={harness[key]} onCheckedChange={(v) => setHarness((h) => ({ ...h, [key]: v }))} />
                  </div>
                ))}
              </div>
            </div>
            {harness.skills && (
              <div>
                <Eyebrow className="mb-1.5">Skills (comma-separated)</Eyebrow>
                <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="research, citations" className="border-2 border-foreground font-mono" />
              </div>
            )}
            {selectedFleet && (
              <p className="text-xs text-muted-foreground">
                This agent will be created in <span className="font-semibold">{selectedFleet.name}</span> with model{" "}
                <span className="font-mono">{provider !== "custom" ? `${provider}:` : "custom:"}{effectiveModel}</span>.
              </p>
            )}
          </div>
        )}

        {/* nav */}
        <div className="mt-8 flex items-center justify-between border-t-2 border-foreground pt-5">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="press inline-flex items-center gap-1.5 border-2 border-foreground px-4 py-2 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> <span className="mono-label">Back</span>
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className="press inline-flex items-center gap-1.5 bg-foreground px-4 py-2 text-background disabled:opacity-30"
            >
              <span className="mono-label">Next</span> <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={createM.isPending || updateM.isPending}
              className="press inline-flex items-center gap-1.5 bg-foreground px-6 py-2 text-background shadow-brutal-sm disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> <span className="mono-label">{editId ? "Save agent" : "Create agent"}</span>
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
}
