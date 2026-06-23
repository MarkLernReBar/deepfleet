// Shared catalogs used by both client and server.

export type ModelProvider = "openai" | "anthropic" | "gemini" | "custom";

export const MODEL_PROVIDERS: { id: ModelProvider; label: string; prefix: string }[] = [
  { id: "openai", label: "OpenAI", prefix: "openai" },
  { id: "anthropic", label: "Anthropic", prefix: "anthropic" },
  { id: "gemini", label: "Google Gemini", prefix: "google_genai" },
  { id: "custom", label: "Custom", prefix: "custom" },
];

// Suggested models per provider (the platform's built-in LLM gateway exposes these ids).
export const MODELS_BY_PROVIDER: Record<ModelProvider, string[]> = {
  openai: ["gpt-5.5", "gpt-5", "gpt-5-mini", "gpt-5-nano"],
  anthropic: ["claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  gemini: ["gemini-3.1-pro-preview", "gemini-3-flash-preview"],
  custom: [],
};

// provider:model string used by create_deep_agent()
export function toProviderModelString(provider: ModelProvider, model: string): string {
  const p = MODEL_PROVIDERS.find((x) => x.id === provider);
  return `${p?.prefix ?? provider}:${model}`;
}

// Rough cost estimate (USD per 1k tokens, blended) for the cost KPI.
export const MODEL_COST_PER_1K: Record<string, number> = {
  "gpt-5.5": 0.01,
  "gpt-5": 0.008,
  "gpt-5-mini": 0.002,
  "gpt-5-nano": 0.0006,
  "claude-opus-4-7": 0.02,
  "claude-opus-4-6": 0.018,
  "claude-sonnet-4-6": 0.006,
  "claude-haiku-4-5": 0.0015,
  "gemini-3.1-pro-preview": 0.007,
  "gemini-3-flash-preview": 0.0008,
};

export function estimateCostMicroUsd(model: string, totalTokens: number): number {
  const per1k = MODEL_COST_PER_1K[model] ?? 0.005;
  return Math.round((totalTokens / 1000) * per1k * 1_000_000);
}

export type BuiltinToolSeed = {
  name: string;
  slug: string;
  description: string;
  requiresApproval: boolean;
};

// Default builtin tools seeded into the catalog.
export const BUILTIN_TOOLS: BuiltinToolSeed[] = [
  { name: "Web Search", slug: "web_search", description: "Search the web and return ranked results.", requiresApproval: false },
  { name: "HTTP Fetch", slug: "http_fetch", description: "Fetch the contents of a URL.", requiresApproval: false },
  { name: "Calculator", slug: "calculator", description: "Evaluate arithmetic expressions.", requiresApproval: false },
  { name: "Read File", slug: "read_file", description: "Read a file from the virtual filesystem.", requiresApproval: false },
  { name: "Write File", slug: "write_file", description: "Create or overwrite a file in the virtual filesystem.", requiresApproval: true },
  { name: "Run Shell", slug: "run_shell", description: "Execute a shell command in the sandbox.", requiresApproval: true },
  { name: "Send Email", slug: "send_email", description: "Send an email on behalf of the agent.", requiresApproval: true },
  { name: "SQL Query", slug: "run_query", description: "Run a read-only SQL query against a connected database.", requiresApproval: false },
];

export type FirstPartyIntegrationToolSeed = BuiltinToolSeed & {
  config: Record<string, string>;
};

/** LangSmith Fleet first-party MCP-style tools (require OAuth credentials at runtime). */
export const FIRST_PARTY_INTEGRATION_TOOLS: FirstPartyIntegrationToolSeed[] = [
  {
    name: "Gmail Read",
    slug: "gmail_read",
    description: "Read messages from a connected Gmail inbox.",
    requiresApproval: false,
    config: { provider: "gmail", integration: "first_party" },
  },
  {
    name: "Gmail Send",
    slug: "gmail_send",
    description: "Send email via a connected Gmail account.",
    requiresApproval: true,
    config: { provider: "gmail", integration: "first_party" },
  },
  {
    name: "Slack Post",
    slug: "slack_post",
    description: "Post a message to a Slack channel using a connected workspace token.",
    requiresApproval: true,
    config: { provider: "slack", integration: "first_party" },
  },
  {
    name: "Tavily Search",
    slug: "tavily_search",
    description: "Search the web via Tavily (requires Tavily API credential).",
    requiresApproval: false,
    config: { provider: "tavily", integration: "first_party" },
  },
  {
    name: "Google Calendar",
    slug: "google_calendar",
    description: "List and create calendar events via Google Calendar API.",
    requiresApproval: true,
    config: { provider: "google_calendar", integration: "first_party" },
  },
];

export const HARNESS_DEFAULTS = {
  planning: true,
  filesystem: true,
  memory: false,
  skills: false,
  summarization: true,
};

export const SHARE_ROLES = ["viewer", "can-run", "can-edit", "can-clone", "owner"] as const;
export type ShareRole = (typeof SHARE_ROLES)[number];

export const CREDENTIAL_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "gmail", label: "Gmail" },
  { id: "google_calendar", label: "Google Calendar" },
  { id: "slack", label: "Slack" },
  { id: "tavily", label: "Tavily" },
  { id: "custom", label: "Custom" },
] as const;

export const STEP_TYPES = ["plan", "tool_call", "tool_result", "subagent", "message"] as const;
export type StepType = (typeof STEP_TYPES)[number];
