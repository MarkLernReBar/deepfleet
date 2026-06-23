import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock, Tag } from "@/components/brutal";
import { useState } from "react";
import { toast } from "sonner";
import { LayoutTemplate, Plus, Bot, Wrench, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Templates() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.fleet.templates.list.useQuery();
  const { data: fleets } = trpc.fleet.fleets.list.useQuery();

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fleetId, setFleetId] = useState<string>("");
  const [name, setName] = useState("");

  const selected = templates?.find((t) => t.id === selectedId);

  const instantiateM = trpc.fleet.templates.instantiate.useMutation({
    onSuccess: (agent) => {
      utils.fleet.invalidate();
      setOpen(false);
      toast.success("Agent created from template");
      navigate(`/agents/${agent.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = (templateId: string) => {
    setSelectedId(templateId);
    setName("");
    setFleetId(fleets?.[0] ? String(fleets[0].id) : "");
    setOpen(true);
  };

  const submit = () => {
    if (!selectedId || !fleetId) return toast.error("Pick a fleet");
    instantiateM.mutate({
      templateId: selectedId,
      fleetId: Number(fleetId),
      name: name.trim() || undefined,
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Fleet gallery"
        title="Templates"
        description="Start from curated agent blueprints — model, prompt, tools, and subagents pre-configured."
        actions={
          <Link href="/agents/new">
            <span className="press inline-flex items-center gap-2 border-2 border-foreground px-4 py-2.5">
              <Plus className="h-4 w-4" /> <span className="mono-label">Blank agent</span>
            </span>
          </Link>
        }
      />

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading templates…</div>
      ) : (templates?.length ?? 0) === 0 ? (
        <EmptyBlock title="No templates" description="Built-in templates will appear here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates!.map((t) => (
            <Panel key={t.id} className="flex flex-col p-6">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-muted">
                  <LayoutTemplate className="h-5 w-5" />
                </div>
                <Tag variant="muted">{t.category}</Tag>
              </div>
              <h3 className="text-xl font-bold tracking-tight">{t.name}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-input pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" /> {t.toolCount} tools
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {t.subagentCount} subagents
                </span>
              </div>
              <button
                onClick={() => openCreate(t.id)}
                className="press mt-4 inline-flex w-full items-center justify-center gap-2 bg-foreground py-2.5 text-background"
              >
                <Bot className="h-4 w-4" /> <span className="mono-label">Use template</span>
              </button>
            </Panel>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="display-hero text-2xl">
              {selected?.name ?? "Create from template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Eyebrow className="mb-1.5">Fleet</Eyebrow>
              <Select value={fleetId} onValueChange={setFleetId}>
                <SelectTrigger className="rounded-none border-2 border-foreground">
                  <SelectValue placeholder="Select fleet" />
                </SelectTrigger>
                <SelectContent>
                  {fleets?.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Eyebrow className="mb-1.5">Agent name (optional)</Eyebrow>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selected?.name ?? "My agent"}
                className="border-2 border-foreground"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="press border-2 border-foreground px-4 py-2 mono-label">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={instantiateM.isPending || !fleetId}
              className="press bg-foreground px-4 py-2 text-background mono-label disabled:opacity-50"
            >
              {instantiateM.isPending ? "Creating…" : "Create agent"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
