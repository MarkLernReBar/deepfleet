export type LangSmithConfig = {
  org?: string;
  project?: string;
  host?: string;
};

/** Build a LangSmith run URL when org, project, and run id are known. */
export function buildLangSmithTraceUrl(
  runId: string,
  config: LangSmithConfig = {}
): string | null {
  const org = config.org?.trim();
  const project = config.project?.trim();
  if (!org || !project || !runId.trim()) return null;
  const host = (config.host?.trim() || "https://smith.langchain.com").replace(/\/$/, "");
  const params = new URLSearchParams({
    organizationId: org,
    projectName: project,
    runId: runId.trim(),
  });
  return `${host}/o/${encodeURIComponent(org)}/projects/p/${encodeURIComponent(project)}?${params.toString()}`;
}
