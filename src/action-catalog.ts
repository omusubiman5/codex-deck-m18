import { ADDITIONAL_KEYCAPS, OFFICIAL_KEYCAP_IDS, type OfficialKeycapId } from "./keycaps.js";
import type { MicroDirection } from "./types.js";

type M18ActionBase = { id: string; manifestUuid: string };

export type M18ActionSpec = M18ActionBase & (
  | { id: `agent-${number}`; kind: "agent"; slot: number }
  | { id: `joystick-${MicroDirection}`; kind: "joystick"; direction: MicroDirection }
  | { id: "encoder-click"; kind: "encoder" }
  | { id: "host-toggle"; kind: "host-toggle" }
  | { id: "usage-limit"; kind: "usage-limit" }
  | { id: "usage-overview"; kind: "usage-overview" }
  | { id: "rate-limit-reset"; kind: "rate-limit-reset" }
  | { id: `keycap-${string}`; kind: "keycap"; keycapId: OfficialKeycapId }
);

const agents = Array.from({ length: 6 }, (_, slot): M18ActionSpec => ({
  id: `agent-${slot + 1}`,
  manifestUuid: `com.simeo.codex-deck.agent-${slot + 1}`,
  kind: "agent",
  slot
}));

const navigation: M18ActionSpec[] = (["up", "down", "left", "right"] as const).map((direction) => ({
  id: `joystick-${direction}`,
  manifestUuid: `com.simeo.codex-deck.${joystickActionName(direction)}`,
  kind: "joystick",
  direction
}));

const system: M18ActionSpec[] = [
  { id: "encoder-click", manifestUuid: "com.simeo.codex-deck.reasoning", kind: "encoder" },
  { id: "host-toggle", manifestUuid: "com.simeo.codex-deck.host-toggle", kind: "host-toggle" },
  { id: "usage-limit", manifestUuid: "com.simeo.codex-deck.usage-limit", kind: "usage-limit" },
  { id: "usage-overview", manifestUuid: "com.simeo.codex-deck.usage-overview", kind: "usage-overview" },
  { id: "rate-limit-reset", manifestUuid: "com.simeo.codex-deck.rate-limit-reset", kind: "rate-limit-reset" }
];

const keycaps: M18ActionSpec[] = OFFICIAL_KEYCAP_IDS.map((keycapId) => ({
  id: `keycap-${keycapId.toLowerCase().replace(/[+-]/g, (token) => token === "+" ? "-plus" : "-minus")}`,
  manifestUuid: keycapManifestUuid(keycapId),
  kind: "keycap",
  keycapId
}));

export const M18_ACTION_CATALOG = [...agents, ...navigation, ...system, ...keycaps] as const;

export function assertM18ActionCatalog(): void {
  if (M18_ACTION_CATALOG.length !== 45) throw new Error(`Expected 45 M18 actions, got ${M18_ACTION_CATALOG.length}.`);
  const ids = new Set(M18_ACTION_CATALOG.map((action) => action.id));
  if (ids.size !== M18_ACTION_CATALOG.length) throw new Error("M18 action IDs must be unique.");
  const official = M18_ACTION_CATALOG.filter((action) => action.kind === "keycap").map((action) => action.keycapId);
  if (official.length !== OFFICIAL_KEYCAP_IDS.length || official.some((id, index) => id !== OFFICIAL_KEYCAP_IDS[index])) {
    throw new Error("M18 official keycaps must match OFFICIAL_KEYCAP_IDS exactly.");
  }
}

assertM18ActionCatalog();

function joystickActionName(direction: MicroDirection): string {
  if (direction === "up") return "plan";
  if (direction === "left") return "back";
  if (direction === "right") return "forward";
  return "sidebar";
}

function keycapManifestUuid(keycapId: OfficialKeycapId): string {
  if (keycapId === "MIC") return "com.simeo.codex-deck.dictation";
  const keycap = ADDITIONAL_KEYCAPS.find((candidate) => candidate.id === keycapId);
  if (!keycap) throw new Error(`No manifest action is mapped to official keycap ${keycapId}.`);
  return `com.simeo.codex-deck.keycap-${keycap.slug}`;
}
