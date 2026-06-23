import { trpc } from "@/lib/trpc";
import { Eyebrow, Panel, PageHeader, EmptyBlock } from "@/components/brutal";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SkillForm = {
  id?: number;
  slug: string;
  name: string;
  description: string;
  content: string;
};

const EMPTY_FORM: SkillForm = { slug: "", name: "", description: "", content: "" };

export default function Skills() {
  const utils = trpc.useUtils();
  const { data: skills, isLoading } = trpc.fleet.skills.list.useQuery(undefined);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SkillForm>(EMPTY_FORM);

  const createM = trpc.fleet.skills.create.useMutation({
    onSuccess: () => {
      utils.fleet.skills.list.invalidate();
      setOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Skill created");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateM = trpc.fleet.skills.update.useMutation({
    onSuccess: () => {
      utils.fleet.skills.list.invalidate();
      setOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Skill updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteM = trpc.fleet.skills.delete.useMutation({
    onSuccess: () => {
      utils.fleet.skills.list.invalidate();
      toast.success("Skill removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (s: NonNullable<typeof skills>[number]) => {
    setForm({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description ?? "",
      content: s.content,
    });
    setOpen(true);
  };

  const submit = () => {
    const slug = form.slug.trim();
    if (!form.name.trim() || !slug || !form.content.trim()) {
      return toast.error("Slug, name, and content are required");
    }
    if (form.id) {
      updateM.mutate({
        id: form.id,
        slug,
        name: form.name,
        description: form.description,
        content: form.content,
      });
    } else {
      createM.mutate({
        slug,
        name: form.name,
        description: form.description,
        content: form.content,
      });
    }
  };

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Knowledge"
        title="Skills"
        description="Workspace SKILL.md catalog. Agents load these on demand when the skills harness is enabled."
        actions={
          <button
            onClick={openCreate}
            className="press inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-background shadow-brutal-sm"
          >
            <Plus className="h-4 w-4" /> <span className="mono-label">New skill</span>
          </button>
        }
      />

      {isLoading ? (
        <div className="eyebrow animate-pulse">Loading…</div>
      ) : (skills?.length ?? 0) === 0 ? (
        <EmptyBlock
          title="No skills yet"
          description="Create workspace skills that agents can load on demand during runs."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills?.map((s) => (
            <Panel key={s.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-mono text-sm font-bold">{s.slug}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(s)}
                    className="press border border-input p-1 hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteM.mutate({ id: s.id })}
                    className="press border border-input p-1 hover:bg-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold">{s.name}</p>
              <p className="mt-1 min-h-8 text-xs text-muted-foreground">{s.description}</p>
              <p className="mt-2 truncate font-mono text-[0.65rem] text-muted-foreground">
                {s.content.slice(0, 80)}
                {s.content.length > 80 ? "…" : ""}
              </p>
            </Panel>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="display-hero text-2xl">
              {form.id ? "Edit skill" : "New skill"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Eyebrow className="mb-1.5">Name</Eyebrow>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="border-2 border-foreground"
                />
              </div>
              <div>
                <Eyebrow className="mb-1.5">Slug</Eyebrow>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="research-notes"
                  className="border-2 border-foreground font-mono"
                />
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1.5">Description</Eyebrow>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="border-2 border-foreground"
              />
            </div>
            <div>
              <Eyebrow className="mb-1.5">Content (SKILL.md body)</Eyebrow>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={12}
                className="border-2 border-foreground font-mono text-xs"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="press border-2 border-foreground px-4 py-2 mono-label">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={isPending}
              className="press bg-foreground px-4 py-2 text-background mono-label disabled:opacity-50"
            >
              {form.id ? "Save" : "Create"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
