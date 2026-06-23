import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  Boxes,
  Bot,
  LayoutDashboard,
  Inbox,
  Wrench,
  Sparkles,
  KeyRound,
  Menu,
  X,
  LogOut,
  Activity,
  MessageSquare,
  LayoutTemplate,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Display, Eyebrow } from "@/components/brutal";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; match: (p: string) => boolean };

const NAV: NavItem[] = [
  { href: "/chat", label: "Chat", icon: MessageSquare, match: (p) => p.startsWith("/chat") },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, match: (p) => p.startsWith("/templates") },
  { href: "/", label: "Overview", icon: LayoutDashboard, match: (p) => p === "/" },
  { href: "/fleets", label: "Fleets", icon: Boxes, match: (p) => p.startsWith("/fleets") },
  { href: "/agents", label: "Agents", icon: Bot, match: (p) => p.startsWith("/agents") },
  { href: "/runs", label: "Runs", icon: Activity, match: (p) => p.startsWith("/runs") },
  { href: "/inbox", label: "Inbox", icon: Inbox, match: (p) => p.startsWith("/inbox") },
  { href: "/tools", label: "Tools & MCP", icon: Wrench, match: (p) => p.startsWith("/tools") },
  { href: "/skills", label: "Skills", icon: Sparkles, match: (p) => p.startsWith("/skills") },
  { href: "/credentials", label: "Credentials", icon: KeyRound, match: (p) => p.startsWith("/credentials") },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: pending } = trpc.fleet.approvals.list.useQuery({ status: "pending" });
  const pendingCount = pending?.length ?? 0;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-6">
        <Link href="/" onClick={onNavigate}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
              <span className="font-mono text-sm font-bold">DF</span>
            </div>
            <div className="leading-none">
              <div className="text-base font-bold tracking-tight text-sidebar-primary">DEEPFLEET</div>
              <div className="eyebrow mt-1 text-sidebar-foreground/60">Fleet Control</div>
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = item.match(location);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <div
                className={cn(
                  "press group mb-1 flex items-center gap-3 px-3 py-2.5 text-sm font-medium",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="mono-label flex-1 text-[0.7rem]">{item.label}</span>
                {item.href === "/inbox" && pendingCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center bg-sidebar-primary px-1 font-mono text-[0.65rem] font-bold text-sidebar-primary-foreground group-data-[active=true]:bg-sidebar-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground font-mono text-xs font-bold">
            {(user?.name ?? "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{user?.name ?? "User"}</div>
            <div className="truncate text-[0.65rem] text-sidebar-foreground/50">{user?.email ?? ""}</div>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="press flex w-full items-center justify-center gap-2 border border-sidebar-border py-2 text-[0.7rem] font-medium hover:bg-sidebar-accent"
        >
          <LogOut className="h-3.5 w-3.5" /> <span className="mono-label">Sign out</span>
        </button>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="eyebrow animate-pulse">Loading DeepFleet…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
        {/* overlapping gray blocks */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-10 h-72 w-72 bg-muted" />
          <div className="absolute right-10 top-40 h-96 w-80 bg-accent" />
          <div className="absolute bottom-0 left-1/3 h-64 w-[28rem] bg-secondary" />
        </div>
        <div className="relative z-10 w-full max-w-lg border-2 border-foreground bg-card p-10 shadow-brutal">
          <Eyebrow className="mb-4">Open-source agent fleet control</Eyebrow>
          <Display className="text-5xl md:text-6xl">DEEP<br />FLEET</Display>
          <p className="mt-5 text-sm text-muted-foreground">
            Create, run, monitor, and govern fleets of deepagents end-to-end. A no-code control center
            for the LangChain <span className="font-mono">deepagents</span> harness.
          </p>
          <a
            href={getLoginUrl()}
            className="press mt-8 inline-flex w-full items-center justify-center bg-foreground py-3 text-sm font-semibold text-background shadow-brutal-sm"
          >
            <span className="mono-label">Sign in to continue</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r-2 border-foreground md:block">
        <Sidebar />
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 border-r-2 border-foreground">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-foreground bg-background px-4 py-3 md:hidden">
          <button onClick={() => setMobileOpen(true)} className="press border-2 border-foreground p-2">
            <Menu className="h-4 w-4" />
          </button>
          <span className="font-bold tracking-tight">DEEPFLEET</span>
          <div className="w-9" />
        </header>
        <main className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}

export { X };
