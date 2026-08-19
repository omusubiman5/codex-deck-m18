import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DeckController } from "./controller.js";
import { codexDeckStateRoot } from "./codex-deck-paths.js";
import type { DeckRuntime, DeckSurfaceAction } from "./deck-runtime.js";
import { createM18Binding } from "./m18-action-bindings.js";
import type { Binding } from "./m18-bindings.js";
import { M18AdapterClient } from "./m18-adapter-client.js";
import { M18_SCENES } from "./m18-layout.js";
import { M18SceneController } from "./m18-scene-controller.js";

const logger = {
  info: (message: string) => console.log(`[info] ${message}`),
  warn: (message: string) => console.warn(`[warn] ${message}`),
  error: (message: string) => console.error(`[error] ${message}`)
};

const runtime: DeckRuntime = {
  logger,
  getGlobalSettings: async <T>() => ({ showContextRings: true }) as T
};

let sceneController: M18SceneController | undefined;
const pressedBindings = new Map<number, Binding>();
const sceneSelectors: Binding[] = [0, 1, 2].map((scene) => ({
  down: async () => sceneController?.selectScene(scene)
}));
const eventLog = join(codexDeckStateRoot(), "m18-events.log");
const adapter = new M18AdapterClient(async (event) => {
  logger.info(`M18 ${event.type} key=${event.key}.`);
  appendFileSync(eventLog, `${new Date().toISOString()} ${event.type} key=${event.key}\n`, "utf8");
  const binding = event.type === "key_down"
    ? (event.key < 15 ? sceneController?.bindingForLcd(event.key) : sceneSelectors[event.key - 15])
    : pressedBindings.get(event.key);
  if (!binding) return;
  if (event.type === "key_down") {
    if (pressedBindings.has(event.key)) return;
    pressedBindings.set(event.key, binding);
    await binding.down();
  } else {
    pressedBindings.delete(event.key);
    await binding.up?.();
  }
}, (message) => logger.info(`adapter: ${message}`));

const ready = await adapter.start();
logger.info(`Connected to ${ready.name} (${hex(ready.vid)}:${hex(ready.pid)}).`);

const controller = new DeckController(runtime);
const lcdActions = Array.from({ length: 15 }, (_, key): DeckSurfaceAction => ({
  id: `m18-lcd-${key}`,
  setImage: (image) => adapter.setImage(key, image),
  setTitle: async () => {}
}));

const scenes = M18_SCENES.map((scene) => scene.map((spec) => createM18Binding(controller, spec)));
sceneController = new M18SceneController(scenes, lcdActions);
sceneController.mount();
await controller.start();

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  sceneController?.unmount();
  controller.stop();
  await adapter.stop();
};
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

function hex(value: number): string {
  return `0x${value.toString(16).padStart(4, "0")}`;
}
