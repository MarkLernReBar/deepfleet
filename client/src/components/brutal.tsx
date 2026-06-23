import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** A hard-edged bordered panel with optional offset shadow. */
export function Panel({
  children,
  className,
  shadow,
}: {
  children: ReactNode;
  className?: string;
  shadow?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-2 border-foreground bg-card",
        shadow && "shadow-brutal",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Widely-spaced uppercase eyebrow label. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("eyebrow text-muted-foreground", className)}>{children}</div>;
}

/** Massive heavy display headline. */
export function Display({
  children,
  className,
  as: Tag = "h1",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return <Tag className={cn("display-hero", className)}>{children}</Tag>;
}

/** Monospace tag chip. */
export function Tag({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "outline" | "solid" | "muted";
}) {
  const variants: Record<string, string> = {
    default: "bg-foreground text-background",
    solid: "bg-foreground text-background",
    outline: "border-2 border-foreground bg-transparent text-foreground",
    muted: "bg-muted text-muted-foreground border border-input",
  };
  return (
    <span
      className={cn(
        "mono-label inline-flex items-center px-2 py-0.5 leading-none",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Page header with eyebrow + display + optional actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b-2 border-foreground pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <Display className="text-4xl md:text-6xl">{title}</Display>
        {description && (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Empty state block. */
export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-2 border-dashed border-input p-12 text-center">
      <Eyebrow className="mb-2">Empty</Eyebrow>
      <p className="text-xl font-semibold tracking-tight">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

const IDENTITY_LABELS: Record<string, string> = { claw: "Claw", assistant: "Assistant" };

export function IdentityTag({ type }: { type: string }) {
  return <Tag variant={type === "claw" ? "solid" : "outline"}>{IDENTITY_LABELS[type] ?? type}</Tag>;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-foreground text-background",
  draft: "bg-muted text-muted-foreground border border-input",
  paused: "border-2 border-foreground text-foreground bg-transparent",
  archived: "bg-muted text-muted-foreground line-through",
  succeeded: "bg-foreground text-background",
  failed: "border-2 border-foreground text-foreground bg-transparent",
  running: "bg-foreground text-background animate-pulse",
  queued: "bg-muted text-muted-foreground border border-input",
  awaiting_approval: "border-2 border-foreground text-foreground bg-transparent",
  cancelled: "bg-muted text-muted-foreground",
  pending: "border-2 border-foreground text-foreground",
  approved: "bg-foreground text-background",
  rejected: "bg-muted text-muted-foreground line-through",
};

export function StatusTag({ status }: { status: string }) {
  return (
    <span className={cn("mono-label inline-flex items-center px-2 py-0.5 leading-none", STATUS_STYLES[status] ?? "bg-muted")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
