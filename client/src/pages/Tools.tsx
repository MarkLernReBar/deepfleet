import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Eyebrow, Panel, PageHeader, EmptyBlock, Tag } from "@/components/brutal";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Server, Wrench, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function Tools() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: tools, isLoading } = trpc.fleet.tools.list.useQuery(undefined);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"builtin" | "mcp">("mcp");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);

  const seedM = trpc.seed.run.useMutation({
    onSuccess: () => { utils.fleet.tools.list.invalidate(); toast.success("Builtin tools seeded"); },
    onError: (e) => toast.error(e.message),
  });
  const createM = trpc.fleet.tools.create.useMutation({
    onSuccess: () => { utils.fleet.tools.list.invalidate(); setOpen(false); resetForm(); toast.success("Tool registered"); },
    onError: (e) => toast.error(e.message),
  });
  const availM = trpc.fleet.tools.setAvailability.useMutation({
    onSuccess: () => utils.fleet.tools.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const approvalM = trpc.fleet.tools.update.useMutation({
    onSuccess: () => utils.fleet.tools.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteM = trpc.fleet.tools.delete.useMutation({
    onSuccess: () => { utils.fleet.tools.list.invalidate(); toast.success("Tool removed"); },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => { setName(""); setSlug(""); setDescription(""); setUrl(""); setRequiresApproval(false); setType("mcp"); };

  const submit = () => {
    if (!name.trim() || !slug.trim()) return toast.error("Name and slug are required");
    createM.mutate({
      name, slug: slug.trim().replace(/\s+/g, "_"), description, type,
      requiresApproval,
      config: type === "mcp" ? { url } : {},
    });
  };

  const builtins = tools?.filter((t) => t.type === "builtin") ?? [];
  const mcps = tools?.filter((t) => t.type === "mcp") ?? [];

  const renderTool = (t: NonNullable<typeof tools>[number]) => (
    <Panel key={t.id} className={cn("p-4", !t.isAvailable && "opacity-50")}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {t.type === "mcp" ? <Server className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
          <span className="font-mono text-sm font-bold">{t.slug}</span>
        </div>
        <div className="flex items-center gap-1">
          {t.type === "mcp" && <Tag variant="solid">mcp</Tag>}
          {isAdmin && (
            <button onClick={() => deleteM.mutate({ id: t.id })} className="press border border-input p-1 hover:bg-muted">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 min-h-8 text-xs text-muted-foreground">{t.description}</p>
      {t.type === "mcp" && (t.config as { url?: string })?.url && (
        <p className="mt-1 truncate font-mono text-[0.65rem] text-muted-foreground">{(t.config as { url: string }).url}</p>
      )}
      <div className="mt-3 space-y-2 border-t border-input pt-3">
        <div className="flex items-center justify-between">
          <span className="mono-label text-muted-foreground">Requires approval</span>
          <Switch checked={t.requiresApproval} disabled={!isAdmin} onCheckedChange={(v) => approvalM.mutate({ id: t.id, requiresApproval: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="mono-label text-muted-foreground">Available {!isAdmin && "(admin)"}</span>
          <Switch checked={t.isAvailable} disabled={!isAdmin} onCheckedChange={(v) => availM.mutate({ id: t.id, isAvailable: v })} />
        </div>
      </div>
    </Panel>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Capabilities"
        title="Tools & MCP"
        description="The platform tool registry. Register remote MCP servers and control which tools agents may use."
        actions={
          <div className="flex items-center gap-2">
            {builtins.length === 0 && (
              <button onClick={() => seedM.mutate()} className="press border-2 border-foreground px-4 py-2.5 mono-label">Seed builtins</button>
            )}
            <button onClick={() => setOpen(true)} className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm">
              <Plus className="h-4 w-4" /> <span className="mono-label">Register</span>
            </button>
          </div>
        }
      />

      {!isAdmin && (
        <p className="border-2 border-dashed border-input p-3 text-xs text-muted-foreground">
          You can register tools and MCP servers. Platform-wide availability and approval flags are controlled by admins.
        </p>
      )}

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading…</div>
      ) : (tools?.length ?? 0) === 0 ? (
        <EmptyBlock title="No tools yet" description="Seed the builtin catalog or register an MCP server." />
      ) : (
        <div className="space-y-8">
          <div>
            <Eyebrow className="mb-4">Builtin tools ({builtins.length})</Eyebrow>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{builtins.map(renderTool)}</div>
          </div>
          <div>
            <Eyebrow className="mb-4">MCP servers ({mcps.length})</Eyebrow>
            {mcps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No remote MCP servers registered.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{mcps.map(renderTool)}</div>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="display-hero text-2xl">Register tool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Eyebrow className="mb-2">Type</Eyebrow>
              <div className="grid grid-cols-2 gap-2">
                {(["mcp", "builtin"] as const).map((t) => (
                  <button key={t} onClick={() => setType(t)} className={cn("press border-2 py-2.5 mono-label", type === t ? "border-foreground bg-foreground text-background" : "border-input")}>
                    {t === "mcp" ? "MCP server" : "Builtin"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Eyebrow className="mb-1.5">Name</Eyebrow>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="border-2 border-foreground" />
              </div>
              <div>
                <Eyebrow className="mb-1.5">Slug</Eyebrow>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="github_search" className="border-2 border-foreground font-mono" />
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1.5">Description</Eyebrow>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="border-2 border-foreground" />
            </div>
            {type === "mcp" && (
              <div>
                <Eyebrow className="mb-1.5">MCP server URL</Eyebrow>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/sse" className="border-2 border-foreground font-mono" />
              </div>
            )}
            <div className="flex items-center justify-between border-2 border-foreground p-3">
              <span className="text-sm font-semibold">Requires approval</span>
              <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="press border-2 border-foreground px-4 py-2 mono-label">Cancel</button>
            <button onClick={submit} disabled={createM.isPending} className="press bg-foreground px-4 py-2 text-background mono-label disabled:opacity-50">Register</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
