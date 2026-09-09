import type { HostHealth, MicroSnapshot, UsageLimitMode, UsageSnapshot, UsageWindow, UsageWindowKind } from "./types.js";

export type AccountUsageSource = {
  health: HostHealth;
  hostId?: string;
  snapshot?: MicroSnapshot;
};

export const FIVE_HOUR_MINUTES = 5 * 60;
export const WEEKLY_MINUTES = 7 * 24 * 60;

export function usageWindowKind(minutes: number | null): UsageWindowKind {
  if (minutes != null && Math.abs(minutes - FIVE_HOUR_MINUTES) <= 1) return "five-hour";
  if (minutes != null && Math.abs(minutes - WEEKLY_MINUTES) <= 1) return "weekly";
  return "other";
}

export function selectUsageWindow(usage: UsageSnapshot | undefined, mode: UsageLimitMode): UsageWindow | undefined {
  const windows = usage?.windows ?? [];
  if (mode === "five-hour" || mode === "weekly") return windows.find((window) => window.kind === mode);
  return windows.find((window) => window.kind === "five-hour")
    ?? windows.find((window) => window.kind === "weekly")
    ?? [...windows].sort((left, right) =>
      (left.windowDurationMins ?? Number.MAX_SAFE_INTEGER) - (right.windowDurationMins ?? Number.MAX_SAFE_INTEGER))[0];
}

export function parseUsageLimitMode(value: unknown): UsageLimitMode {
  return value === "five-hour" || value === "weekly" ? value : "auto";
}

export function usageLabel(kind: UsageWindowKind): string {
  if (kind === "five-hour") return "5H";
  if (kind === "weekly") return "WK";
  return "LIMIT";
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function selectAccountUsageSource(local: AccountUsageSource, remote?: AccountUsageSource): AccountUsageSource {
  const candidates = [local, remote].filter((candidate): candidate is AccountUsageSource => candidate != null);
  return candidates.find((candidate) => candidate.health.state === "ready" && candidate.snapshot?.usage != null)
    ?? { ...local, snapshot: undefined };
}
