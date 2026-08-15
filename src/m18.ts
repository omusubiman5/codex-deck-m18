import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DeckController, type FixedIconSource } from "./controller.js";
import { codexDeckStateRoot } from "./codex-deck-paths.js";
import type { DeckRuntime, DeckSurfaceAction } from "./deck-runtime.js";
import type { Binding } from "./m18-bindings.js";
import { environmentForButton, savedCodexEnvironment, type CodexM18Environment } from "./m18-environment.js";
import { M18AdapterClient } from "./m18-adapter-client.js";
import type { MicroActionSlot, MicroDirection } from "./types.js";

const logger = {
  info: (message: string) => console.log(`[info] ${message}`),
  warn: (message: string) => console.warn(`[warn] ${message}`),
  error: (message: string) => console.error(`[error] ${message}`)
};

const runtime: DeckRuntime = {
  logger,
  getGlobalSettings: async <T>() => ({ showContextRings: true }) as T
};

let bindings: Binding[] = [];
const eventLog = join(codexDeckStateRoot(), "m18-events.log");
const environmentFile = join(codexDeckStateRoot(), "m18-environment");
let activeEnvironment: CodexM18Environment = readSavedEnvironment();
let switching = false;
const pressedKeys = new Set<number>();
const adapter = new M18AdapterClient(async (event) => {
  logger.info(`M18 ${event.type} key=${event.key}.`);
  appendFileSync(eventLog, `${new Date().toISOString()} ${event.type} key=${event.key}\n`, "utf8");
  const selectedEnvironment = environmentForButton(event.key);
  if (event.type === "key_down" && selectedEnvironment) {
    await selectEnvironment(selectedEnvironment);
    return;
  }
  if (event.key >= 15) return;
  const binding = bindings[event.key];
  if (!binding) return;
  if (event.type === "key_down") {
    pressedKeys.add(event.key);
    await binding.down();
  } else {
    pressedKeys.delete(event.key);
    await binding.up?.();
  }
}, (message) => logger.info(`adapter: ${message}`));

const ready = await adapter.start();
logger.info(`Connected to ${ready.name} (${hex(ready.vid)}:${hex(ready.pid)}).`);

const controller = new DeckController(runtime);
const actions = Array.from({ length: 18 }, (_, key): DeckSurfaceAction => ({
  id: `m18-${key}`,
  setImage: key < 15 ? (image) => adapter.setImage(key, image) : async () => {},
  setTitle: async () => {}
}));

const agent = (slot: number): Binding => ({
  register: (action) => controller.registerAgent(slot, action),
  unregister: (action) => controller.unregisterAgent(action),
  down: () => controller.sendAgent(slot, 1),
  up: () => controller.sendAgent(slot, 0)
});
const micro = (slot: MicroActionSlot): Binding => ({
  register: (action) => controller.registerMicroAction(slot, action),
  unregister: (action) => controller.unregisterMicroAction(action),
  down: () => controller.sendMicroAction(slot, 1),
  up: () => controller.sendMicroAction(slot, 0)
});
const joystick = (direction: MicroDirection, icon?: FixedIconSource): Binding => ({
  register: icon ? (action) => controller.registerFixedAction(`joystick-${direction}`, action, icon) : undefined,
  unregister: icon ? (action) => controller.unregisterFixedAction(action) : undefined,
  down: () => controller.sendJoystick(direction, 1),
  up: () => controller.sendJoystick(direction, 0)
});
const fixed = (id: string, icon: FixedIconSource, down: () => Promise<void>, up?: () => Promise<void>): Binding => ({
  register: (action) => controller.registerFixedAction(id, action, icon),
  unregister: (action) => controller.unregisterFixedAction(action),
  down,
  up
});
const keycap = (keycapId: Parameters<DeckController["runKeycap"]>[0]): Binding =>
  fixed(`keycap-${keycapId}`, { kind: "local", keycapId }, () => controller.runKeycap(keycapId));
const newTask = (): Binding => fixed("new-task", { kind: "local", keycapId: "NEW" }, () => controller.createTask());
const hostToggle = (): Binding => ({
  register: (action) => controller.registerHostToggle(action),
  unregister: (action) => controller.unregisterHostToggle(action),
  down: () => controller.toggleTargetHost()
});
const usageLimit = (mode: "five-hour" | "weekly"): Binding => ({
  register: (action) => controller.registerUsageLimit(action, mode),
  unregister: (action) => controller.unregisterUsageLimit(action),
  down: async () => {}
});
const usageOverview = (): Binding => ({
  register: (action) => controller.registerUsageOverview(action),
  unregister: (action) => controller.unregisterUsageOverview(action),
  down: async () => {}
});
const resetCredit = (): Binding => {
  let registeredAction: DeckSurfaceAction | undefined;
  return {
    register: (action) => { registeredAction = action; controller.registerRateLimitReset(action); },
    unregister: (action) => { controller.unregisterRateLimitReset(action); registeredAction = undefined; },
    down: async () => {
      if (!registeredAction) throw new Error("Reset Credit surface is not registered.");
      controller.beginRateLimitReset(registeredAction);
    },
    up: async () => {
      if (!registeredAction) return;
      await controller.finishRateLimitReset(registeredAction);
    }
  };
};

const environmentOne = (): Binding[] => [
  agent(0), agent(1), agent(2), agent(3), agent(4), agent(5),
  micro("ACT06"), micro("ACT07"), micro("ACT08"), micro("ACT09"), micro("ACT10_ACT11"), micro("ACT12"),
  joystick("up", { kind: "local", keycapId: "BRCH" }),
  joystick("left", { kind: "builtin", name: "back" }),
  joystick("right", { kind: "builtin", name: "forward" })
];

const environmentTwo = (): Binding[] => [
  joystick("down", { kind: "builtin", name: "sidebar" }),
  fixed("reasoning", { kind: "local", keycapId: "MIND-" }, () => controller.sendEncoder(1), () => controller.sendEncoder(0)),
  fixed("reasoning-decrease", { kind: "local", keycapId: "MIND-" }, () => controller.adjustReasoning("decrease")),
  fixed("reasoning-increase", { kind: "local", keycapId: "MIND+" }, () => controller.adjustReasoning("increase")),
  newTask(), usageOverview(), usageLimit("five-hour"), usageLimit("weekly"), resetCredit(), hostToggle(),
  keycap("CODEX"), keycap("TERM"), keycap("DIFF"), keycap("NAV"), keycap("SETUP")
];

bindings = activeEnvironment === 1 ? environmentOne() : environmentTwo();
for (const [key, binding] of bindings.entries()) binding.register?.(actions[key]!);
await controller.start();

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  controller.stop();
  await adapter.stop();
};
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

async function selectEnvironment(environment: 1 | 2 | 3): Promise<void> {
  if (switching || environment === activeEnvironment) return;
  switching = true;
  try {
    for (const key of pressedKeys) await bindings[key]?.up?.();
    pressedKeys.clear();
    for (const [key, binding] of bindings.entries()) binding.unregister?.(actions[key]!);
    if (environment === 3) {
      persistEnvironment(3);
      logger.info("Environment 3 selected; releasing M18 to VSD Craft.");
      await stop();
      process.exitCode = 30;
      return;
    }
    activeEnvironment = environment;
    bindings = environment === 1 ? environmentOne() : environmentTwo();
    for (const [key, binding] of bindings.entries()) binding.register?.(actions[key]!);
    persistEnvironment(environment);
    logger.info(`Environment ${environment} selected.`);
  } finally {
    switching = false;
  }
}

function persistEnvironment(environment: 1 | 2 | 3): void {
  mkdirSync(codexDeckStateRoot(), { recursive: true });
  writeFileSync(environmentFile, String(environment), "utf8");
}

function readSavedEnvironment(): CodexM18Environment {
  try { return savedCodexEnvironment(readFileSync(environmentFile, "utf8")); }
  catch { return savedCodexEnvironment(undefined); }
}

function hex(value: number): string {
  return `0x${value.toString(16).padStart(4, "0")}`;
}
