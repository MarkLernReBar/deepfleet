import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow, Tag } from "@/components/brutal";
import {
  Bot,
  Calendar,
  MessageSquare,
  Radio,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

type GraphTool = { slug: string; type?: string };
type GraphSubagent = { name: string; model?: string | null };
type GraphChannel = { type: string; enabled: boolean };
type GraphSchedule = { name: string; enabled: boolean; cronExpression: string };

type AgentGraphProps = {
  agentName: string;
  model: string;
  tools: GraphTool[];
  subagents: GraphSubagent[];
  skills: string[];
  schedules: GraphSchedule[];
  channels: GraphChannel[];
  triggersPaused?: boolean;
};

function Node({
  title,
  icon: Icon,
  children,
  className,
  accent,
}: {
  title: string;
  icon: typeof Bot;
  children?: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-2 border-foreground bg-card p-4 shadow-brutal-sm",
        accent && "bg-foreground text-background",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="mono-label text-[0.65rem]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Connector({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      className={cn(
        "bg-foreground",
        vertical ? "mx-auto h-6 w-0.5" : "my-auto h-0.5 w-6 shrink-0"
      )}
      aria-hidden
    />
  );
}

export function AgentGraph({
  agentName,
  model,
  tools,
  subagents,
  skills,
  schedules,
  channels,
  triggersPaused,
}: AgentGraphProps) {
  const enabledChannels = channels.filter((c) => c.enabled);
  const enabledSchedules = schedules.filter((s) => s.enabled);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[52rem] space-y-6">
        {/* triggers row */}
        <div className="flex items-start justify-center gap-4">
          <Node title="Schedules" icon={Calendar} className="min-w-[12rem]">
            {triggersPaused ? (
              <Tag variant="outline">Paused</Tag>
            ) : enabledSchedules.length === 0 ? (
              <p className="text-xs opacity-80">No schedules</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {enabledSchedules.slice(0, 3).map((s) => (
                  <li key={s.name}>
                    <span className="font-semibold">{s.name}</span>
                    <div className="font-mono text-[0.6rem] opacity-70">{s.cronExpression}</div>
                  </li>
                ))}
              </ul>
            )}
          </Node>
          <Connector />
          <Node title="Agent" icon={Bot} accent className="min-w-[14rem]">
            <div className="text-sm font-bold">{agentName}</div>
            <div className="mt-1 font-mono text-[0.65rem] opacity-80">{model}</div>
          </Node>
          <Connector />
          <Node title="Channels" icon={Radio} className="min-w-[12rem]">
            {enabledChannels.length === 0 ? (
              <p className="text-xs opacity-80">None enabled</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {enabledChannels.map((c) => (
                  <Tag key={c.type} variant="outline">
                    {c.type}
                  </Tag>
                ))}
              </div>
            )}
          </Node>
        </div>

        <div className="flex justify-center">
          <Connector vertical />
        </div>

        {/* toolbox row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Node title="Toolbox" icon={Wrench}>
            {tools.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tools</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {tools.map((t) => (
                  <Tag key={t.slug} variant="muted">
                    {t.slug}
                  </Tag>
                ))}
              </div>
            )}
          </Node>
          <Node title="Sub-agents" icon={Users}>
            {subagents.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {subagents.map((s) => (
                  <li key={s.name}>
                    <span className="font-semibold">{s.name}</span>
                    {s.model && (
                      <div className="font-mono text-[0.6rem] text-muted-foreground">{s.model}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Node>
          <Node title="Skills" icon={Sparkles}>
            {skills.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {skills.map((s) => (
                  <Tag key={s} variant="outline">
                    {s}
                  </Tag>
                ))}
              </div>
            )}
          </Node>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Read-only graph view — mirrors LangSmith Fleet agent editor layout.
        </p>
      </div>
    </div>
  );
}
