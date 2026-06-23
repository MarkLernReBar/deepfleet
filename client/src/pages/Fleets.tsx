import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock, Tag } from "@/components/brutal";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type FleetForm = { id?: number; name: string; description: string; color: string };

const COLORS = ["#18181b", "#3f3f46", "#52525b", "#71717a", "#a1a1aa"];

export default function Fleets() {
  const utils = trpc.useUtils();
  const { data: fleets, isLoading } = trpc.fleet.fleets.list.useQuery();
  const { data: agents } = trpc.fleet.agents.list.useQuery(undefined);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FleetForm>({ name: "", description: "", color: COLORS[0] });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createM = trpc.fleet.fleets.create.useMutation({
    onSuccess: () => { utils.fleet.fleets.list.invalidate(); setOpen(false); toast.success("Fleet created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateM = trpc.fleet.fleets.update.useMutation({
    onSuccess: () => { utils.fleet.fleets.list.invalidate(); setOpen(false); toast.success("Fleet updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteM = trpc.fleet.fleets.delete.useMutation({
    onSuccess: () => { utils.fleet.invalidate(); setDeleteId(null); toast.success("Fleet deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const agentCount = (fleetId: number) => agents?.filter((a) => a.fleetId === fleetId).length ?? 0;

  const openCreate = () => { setForm({ name: "", description: "", color: COLORS[0] }); setOpen(true); };
  const openEdit = (f: NonNullable<typeof fleets>[number]) =>
    { setForm({ id: f.id, name: f.name, description: f.description ?? "", color: f.color ?? COLORS[0] }); setOpen(true); };

  const submit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (form.id) updateM.mutate({ id: form.id, name: form.name, description: form.description, color: form.color });
    else createM.mutate({ name: form.name, description: form.description, color: form.color });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspaces"
        title="Fleets"
        description="A fleet is a workspace that groups related agents, their runs, and shared configuration."
        actions={
          <button onClick={openCreate} className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm">
            <Plus className="h-4 w-4" /> <span className="mono-label">New fleet</span>
          </button>
        }
      />

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading…</div>
      ) : (fleets?.length ?? 0) === 0 ? (
        <EmptyBlock
          title="No fleets yet"
          description="Create your first fleet to start grouping agents."
          action={
            <button onClick={openCreate} className="press inline-flex items-center gap-2 border-2 border-foreground px-4 py-2.5">
              <Plus className="h-4 w-4" /> <span className="mono-label">New fleet</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {fleets!.map((f) => (
            <Panel key={f.id} shadow className="group relative flex flex-col">
              <div className="h-2 w-full" style={{ background: f.color ?? "#18181b" }} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between">
                  <Link href={`/agents?fleet=${f.id}`}>
                    <h3 className="text-xl font-bold tracking-tight underline-offset-4 hover:underline">{f.name}</h3>
                  </Link>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => openEdit(f)} className="press border border-input p-1.5 hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(f.id)} className="press border border-input p-1.5 hover:bg-muted">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{f.description || "No description"}</p>
                <div className="mt-4 flex items-center justify-between border-t border-input pt-3">
                  <Tag variant="muted">{agentCount(f.id)} agents</Tag>
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="display-hero text-2xl">{form.id ? "Edit fleet" : "New fleet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Eyebrow className="mb-1.5">Name</Eyebrow>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Research Operations" className="border-2 border-foreground" />
            </div>
            <div>
              <Eyebrow className="mb-1.5">Description</Eyebrow>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border-2 border-foreground" />
            </div>
            <div>
              <Eyebrow className="mb-2">Accent</Eyebrow>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 border-2 ${form.color === c ? "border-foreground ring-2 ring-foreground ring-offset-2" : "border-input"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="press border-2 border-foreground px-4 py-2 mono-label">Cancel</button>
            <button onClick={submit} disabled={createM.isPending || updateM.isPending} className="press bg-foreground px-4 py-2 text-background mono-label disabled:opacity-50">
              {form.id ? "Save" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="border-2 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fleet?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the fleet and all of its agents, runs, and traces. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-2 border-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-none bg-foreground" onClick={() => deleteId && deleteM.mutate({ id: deleteId })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
