import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DeckController, type FixedIconSource } from "./controller.js";
import { codexDeckStateRoot } from "./codex-deck-paths.js";
import type { DeckRuntime, DeckSurfaceAction } from "./deck-runtime.js";
import { createTapOrHoldBinding, type Binding } from "./m18-bindings.js";
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
const adapter = new M18AdapterClient(async (event) => {
  logger.info(`M18 ${event.type} key=${event.key}.`);
  appendFileSync(eventLog, `${new Date().toISOString()} ${event.type} key=${event.key}\n`, "utf8");
  const binding = bindings[event.key];
  if (!binding) return;
  if (event.type === "key_down") await binding.down();
  else await binding.up?.();
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
  down: () => controller.sendAgent(slot, 1),
  up: () => controller.sendAgent(slot, 0)
});
const micro = (slot: MicroActionSlot): Binding => ({
  register: (action) => controller.registerMicroAction(slot, action),
  down: () => controller.sendMicroAction(slot, 1),
  up: () => controller.sendMicroAction(slot, 0)
});
const joystick = (direction: MicroDirection, icon?: FixedIconSource): Binding => ({
  register: icon ? (action) => controller.registerFixedAction(`joystick-${direction}`, action, icon) : undefined,
  down: () => controller.sendJoystick(direction, 1),
  up: () => controller.sendJoystick(direction, 0)
});
const encoderGesture = (): Binding => createTapOrHoldBinding({
  holdMs: 500,
  tap: () => controller.adjustReasoning("decrease"),
  holdDown: () => controller.sendEncoder(1),
  holdUp: () => controller.sendEncoder(0),
  onError: (error) => logger.error(`M18 encoder gesture failed: ${String(error)}`)
});

bindings = [
  agent(0), agent(1), agent(2), agent(3), agent(4), agent(5),
  micro("ACT06"), micro("ACT07"), micro("ACT08"), micro("ACT09"), micro("ACT10_ACT11"), micro("ACT12"),
  joystick("up", { kind: "local", keycapId: "BRCH" }),
  joystick("left", { kind: "builtin", name: "back" }),
  joystick("right", { kind: "builtin", name: "forward" }),
  joystick("down"), encoderGesture(), { down: () => controller.adjustReasoning("increase") }
];

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

function hex(value: number): string {
  return `0x${value.toString(16).padStart(4, "0")}`;
}
