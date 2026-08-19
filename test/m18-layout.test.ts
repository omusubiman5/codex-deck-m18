import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { M18_ACTION_CATALOG } from "../src/action-catalog.js";
import type { DeckSurfaceAction } from "../src/deck-runtime.js";
import type { Binding } from "../src/m18-bindings.js";
import { M18_SCENES } from "../src/m18-layout.js";
import { M18SceneController } from "../src/m18-scene-controller.js";
import { OFFICIAL_KEYCAP_IDS } from "../src/keycaps.js";

test("M18 catalog fits 45 unique operations into three complete scenes", () => {
  assert.equal(M18_ACTION_CATALOG.length, 45);
  assert.equal(new Set(M18_ACTION_CATALOG.map((action) => action.id)).size, 45);
  assert.deepEqual(M18_SCENES.map((scene) => scene.length), [15, 15, 15]);
  assert.deepEqual(
    M18_SCENES.flat().filter((action) => action.kind === "keycap").map((action) => action.keycapId),
    OFFICIAL_KEYCAP_IDS
  );
  assert.deepEqual(M18_SCENES[0]!.map((action) => action.kind), [
    "agent", "agent", "agent", "agent", "agent", "agent",
    "joystick", "joystick", "joystick", "joystick",
    "encoder", "host-toggle", "usage-limit", "usage-overview", "rate-limit-reset"
  ]);
});

test("all 45 physical operations map to stable public manifest actions", async () => {
  const manifest = JSON.parse(await readFile(new URL("../static/manifest.json", import.meta.url), "utf8")) as {
    Actions: Array<{ UUID: string }>;
  };
  const uuids = new Set(manifest.Actions.map((action) => action.UUID));
  assert.equal(manifest.Actions.length, 53);
  for (const action of M18_ACTION_CATALOG) assert.equal(uuids.has(action.manifestUuid), true, action.id);
});

test("scene controller unregisters the old surface before mounting the selected scene", () => {
  const events: string[] = [];
  const scenes = Array.from({ length: 3 }, (_, scene) => Array.from({ length: 15 }, (_, key): Binding => ({
    register: (action) => events.push(`register:${scene}:${key}:${action.id}`),
    unregister: (action) => events.push(`unregister:${scene}:${key}:${action.id}`),
    down: async () => {}
  })));
  const actions = Array.from({ length: 15 }, (_, key): DeckSurfaceAction => ({
    id: `lcd-${key}`, setImage: async () => {}, setTitle: async () => {}
  }));
  const controller = new M18SceneController(scenes, actions);
  controller.mount();
  assert.equal(controller.currentScene(), 0);
  events.length = 0;
  controller.selectScene(2);
  assert.equal(controller.currentScene(), 2);
  assert.equal(events.length, 30);
  assert.equal(events[0], "unregister:0:0:lcd-0");
  assert.equal(events[14], "unregister:0:14:lcd-14");
  assert.equal(events[15], "register:2:0:lcd-0");
  assert.equal(events[29], "register:2:14:lcd-14");
});
