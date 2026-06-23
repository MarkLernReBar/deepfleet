export type AgentTemplateHarness = {
  planning: boolean;
  filesystem: boolean;
  memory: boolean;
  skills: boolean;
  summarization: boolean;
};

export type AgentTemplateSubagent = {
  name: string;
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
};

export type AgentTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  identityType: "claw" | "assistant";
  modelProvider: string;
  model: string;
  systemPrompt: string;
  toolSlugs: string[];
  subagents: AgentTemplateSubagent[];
  harness: AgentTemplateHarness;
  skills: string[];
};

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "executive-assistant",
    name: "Executive Assistant",
    description: "Calendar-aware assistant that triages email, schedules meetings, and drafts replies.",
    category: "Productivity",
    identityType: "assistant",
    modelProvider: "openai",
    model: "gpt-5",
    systemPrompt: `You are an executive assistant. Triage incoming requests, draft concise replies, and propose calendar actions. Always confirm before sending email or changing schedules.`,
    toolSlugs: ["web_search", "http_fetch", "send_email", "read_file", "write_file"],
    subagents: [
      {
        name: "scheduler",
        description: "Finds open slots and proposes meeting times",
        prompt: "You specialize in calendar scheduling. Propose 2–3 time options with time zones.",
        tools: ["web_search"],
      },
      {
        name: "inbox-triage",
        description: "Summarizes and prioritizes messages",
        prompt: "Summarize threads, label urgency, and draft short replies.",
        tools: ["read_file", "write_file"],
      },
    ],
    harness: { planning: true, filesystem: true, memory: true, skills: false, summarization: true },
    skills: [],
  },
  {
    id: "research-analyst",
    name: "Research Analyst",
    description: "Deep web research with structured reports and cited sources.",
    category: "Research",
    identityType: "claw",
    modelProvider: "anthropic",
    model: "claude-sonnet-4-6",
    systemPrompt: `You are a research analyst. Break questions into sub-questions, search multiple sources, and produce structured reports with citations.`,
    toolSlugs: ["web_search", "http_fetch", "read_file", "write_file", "run_query"],
    subagents: [
      {
        name: "web-researcher",
        description: "Runs targeted searches and fetches pages",
        prompt: "Gather facts from the web. Return bullet points with URLs.",
        tools: ["web_search", "http_fetch"],
      },
    ],
    harness: { planning: true, filesystem: true, memory: false, skills: false, summarization: true },
    skills: [],
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description: "Reviews diffs, flags risks, and suggests focused improvements.",
    category: "Engineering",
    identityType: "claw",
    modelProvider: "openai",
    model: "gpt-5",
    systemPrompt: `You are a senior code reviewer. Focus on correctness, security, and maintainability. Be concise and actionable.`,
    toolSlugs: ["read_file", "write_file", "run_shell", "http_fetch"],
    subagents: [
      {
        name: "security-pass",
        description: "Checks for security issues",
        prompt: "Review for injection, auth, and secret-handling risks only.",
        tools: ["read_file"],
      },
    ],
    harness: { planning: true, filesystem: true, memory: false, skills: false, summarization: true },
    skills: [],
  },
  {
    id: "customer-support",
    name: "Customer Support",
    description: "Answers product questions and escalates edge cases with empathy.",
    category: "Support",
    identityType: "assistant",
    modelProvider: "openai",
    model: "gpt-5-mini",
    systemPrompt: `You are a helpful customer support agent. Answer clearly, ask clarifying questions when needed, and escalate uncertain cases.`,
    toolSlugs: ["web_search", "read_file", "write_file", "send_email"],
    subagents: [],
    harness: { planning: true, filesystem: false, memory: true, skills: false, summarization: true },
    skills: [],
  },
];

export function getAgentTemplate(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id);
}
