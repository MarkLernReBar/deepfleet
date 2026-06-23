/** Non-empty model id passed to the LLM API (e.g. deepseek/deepseek-v4-pro). */
export function isValidModelId(modelId: string): boolean {
  return modelId.trim().length > 0;
}
