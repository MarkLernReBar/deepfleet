import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock, Tag } from "@/components/brutal";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, KeyRound, Trash2, Users, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function Credentials() {
  const utils = trpc.useUtils();
  const { data: creds, isLoading } = trpc.fleet.credentials.list.useQuery();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("openai");
  const [kind, setKind] = useState<"api_key" | "oauth">("api_key");
  const [scope, setScope] = useState<"shared" | "per_user">("shared");
  const [secret, setSecret] = useState("");

  const createM = trpc.fleet.credentials.create.useMutation({
    onSuccess: () => { utils.fleet.credentials.list.invalidate(); setOpen(false); reset(); toast.success("Credential stored"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteM = trpc.fleet.credentials.delete.useMutation({
    onSuccess: () => { utils.fleet.credentials.list.invalidate(); toast.success("Credential deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const reset = () => { setName(""); setProvider("openai"); setKind("api_key"); setScope("shared"); setSecret(""); };

  const submit = () => {
    if (!name.trim()) return toast.error("Name is required");
    createM.mutate({ name, provider, kind, scope, secret });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Secrets"
        title="Credentials"
        description="Named API-key and OAuth credentials. Shared (Claw) credentials run for everyone; per-user (Assistant) credentials are scoped to each user."
        actions={
          <button onClick={() => setOpen(true)} className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm">
            <Plus className="h-4 w-4" /> <span className="mono-label">New credential</span>
          </button>
        }
      />

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading…</div>
      ) : (creds?.length ?? 0) === 0 ? (
        <EmptyBlock title="No credentials" description="Store an API key or OAuth credential to let agents authenticate at run time." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {creds!.map((c) => (
            <Panel key={c.id} className="group p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-muted">
                  <KeyRound className="h-5 w-5" />
                </div>
                <button onClick={() => deleteM.mutate({ id: c.id })} className="press border border-input p-1.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <h3 className="mt-3 text-lg font-bold tracking-tight">{c.name}</h3>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{c.secretMasked}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-input pt-3">
                <Tag variant="muted">{c.provider}</Tag>
                <Tag variant="outline">{c.kind}</Tag>
                <span className={cn("mono-label inline-flex items-center gap-1 px-2 py-0.5", c.scope === "shared" ? "bg-foreground text-background" : "border-2 border-foreground")}>
                  {c.scope === "shared" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {c.scope === "shared" ? "Claw" : "Assistant"}
                </span>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="display-hero text-2xl">New credential</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Eyebrow className="mb-1.5">Name</Eyebrow>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="OpenAI production key" className="border-2 border-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Eyebrow className="mb-1.5">Provider</Eyebrow>
                <Input value={provider} onChange={(e) => setProvider(e.target.value)} className="border-2 border-foreground font-mono" />
              </div>
              <div>
                <Eyebrow className="mb-1.5">Kind</Eyebrow>
                <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api_key">API key</SelectItem>
                    <SelectItem value="oauth">OAuth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Eyebrow className="mb-2">Scope</Eyebrow>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setScope("shared")} className={cn("press border-2 p-3 text-left", scope === "shared" ? "border-foreground bg-muted" : "border-input")}>
                  <div className="flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4" /> Shared (Claw)</div>
                  <p className="mt-1 text-xs text-muted-foreground">One key for all runs.</p>
                </button>
                <button onClick={() => setScope("per_user")} className={cn("press border-2 p-3 text-left", scope === "per_user" ? "border-foreground bg-muted" : "border-input")}>
                  <div className="flex items-center gap-1.5 text-sm font-bold"><User className="h-4 w-4" /> Per-user (Assistant)</div>
                  <p className="mt-1 text-xs text-muted-foreground">Scoped to each user.</p>
                </button>
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1.5">Secret value</Eyebrow>
              <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="sk-…" className="border-2 border-foreground font-mono" />
              <p className="mt-1.5 text-xs text-muted-foreground">Stored server-side and shown only as a masked preview.</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="press border-2 border-foreground px-4 py-2 mono-label">Cancel</button>
            <button onClick={submit} disabled={createM.isPending} className="press bg-foreground px-4 py-2 text-background mono-label disabled:opacity-50">Store</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
