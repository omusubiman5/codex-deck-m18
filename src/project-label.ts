const MAX_PROJECT_LABEL_LENGTH = 80;

export function normalizeProjectLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const basename = trimmed.split(/[\\/]/).filter(Boolean).at(-1)?.trim();
  if (!basename) return undefined;
  return basename.slice(0, MAX_PROJECT_LABEL_LENGTH);
}

export function isSafeProjectLabel(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_PROJECT_LABEL_LENGTH &&
    !value.includes("/") && !value.includes("\\") && value.trim() === value;
}

export function agentPrimaryLabel(projectLabel: string | undefined, taskTitle: string): string {
  return normalizeProjectLabel(projectLabel) ?? taskTitle;
}
