export type WatcherObservation = {
  now: number;
  generation: string | null;
  bridgeHealthy: boolean;
};

export type WatcherAction =
  | { type: "preserve-initial-session" }
  | { type: "reuse-bridge" }
  | { type: "wait"; reason: string };

export type WatcherPolicyState = {
  initialized: boolean;
  lastGeneration: string | null;
  suppressedInitialGeneration: string | null;
};

export function createWatcherPolicyState(_now = Date.now()): WatcherPolicyState {
  return {
    initialized: false,
    lastGeneration: null,
    suppressedInitialGeneration: null
  };
}

export function resumeWatcherPolicyState(
  stored: WatcherPolicyState | null,
  now = Date.now()
): WatcherPolicyState {
  if (!stored) return createWatcherPolicyState(now);
  return {
    initialized: stored.initialized === true,
    lastGeneration: typeof stored.lastGeneration === "string" ? stored.lastGeneration : null,
    suppressedInitialGeneration: typeof stored.suppressedInitialGeneration === "string"
      ? stored.suppressedInitialGeneration
      : null
  };
}

export function evaluateWatcherPolicy(
  state: WatcherPolicyState,
  observation: WatcherObservation
): { state: WatcherPolicyState; action: WatcherAction } {
  const next: WatcherPolicyState = { ...state };
  const { generation, bridgeHealthy } = observation;

  if (!state.initialized) {
    next.initialized = true;
    next.lastGeneration = generation;
    if (generation != null) {
      if (bridgeHealthy) {
        return { state: next, action: { type: "reuse-bridge" } };
      }
      next.suppressedInitialGeneration = generation;
      return { state: next, action: { type: "preserve-initial-session" } };
    }
    return { state: next, action: { type: "wait", reason: "launch-agent-startup-grace" } };
  }

  if (generation == null) {
    next.lastGeneration = null;
    next.suppressedInitialGeneration = null;
    return { state: next, action: { type: "wait", reason: "codex-not-running" } };
  }

  next.lastGeneration = generation;

  if (bridgeHealthy) {
    next.suppressedInitialGeneration = null;
    return { state: next, action: { type: "reuse-bridge" } };
  }

  if (generation === next.suppressedInitialGeneration) {
    return { state: next, action: { type: "preserve-initial-session" } };
  }

  return { state: next, action: { type: "wait", reason: "automatic-restart-disabled" } };
}
