import assert from "node:assert/strict";
import test from "node:test";
import { M18_ACTION_CATALOG, type M18ActionSpec } from "../src/action-catalog.js";
import type { DeckController } from "../src/controller.js";
import type { DeckSurfaceAction } from "../src/deck-runtime.js";
import { createM18Binding } from "../src/m18-action-bindings.js";
import { OFFICIAL_KEYCAP_IDS } from "../src/keycaps.js";

type RecordedCall = { method: string; args: unknown[] };

function recordingController(calls: RecordedCall[]): DeckController {
  return new Proxy({}, {
    get: (_target, property) => (...args: unknown[]) => {
      calls.push({ method: String(property), args: args.map(normalizeArgument) });
      return Promise.resolve(property === "finishRateLimitReset");
    }
  }) as DeckController;
}

function normalizeArgument(argument: unknown): unknown {
  if (argument && typeof argument === "object" && "id" in argument) {
    return { id: String((argument as { id: unknown }).id) };
  }
  return argument;
}

function expectedDispatch(spec: M18ActionSpec, action: DeckSurfaceAction): RecordedCall[] {
  switch (spec.kind) {
    case "agent":
      return [
        { method: "sendAgent", args: [spec.slot, 1] },
        { method: "sendAgent", args: [spec.slot, 0] }
      ];
    case "joystick":
      return [
        { method: "sendJoystick", args: [spec.direction, 1] },
        { method: "sendJoystick", args: [spec.direction, 0] }
      ];
    case "encoder":
      return [
        { method: "sendEncoder", args: [1] },
        { method: "sendEncoder", args: [0] }
      ];
    case "host-toggle":
      return [{ method: "toggleTargetHost", args: [] }];
    case "usage-limit":
    case "usage-overview":
      return [];
    case "rate-limit-reset":
      return [
        { method: "beginRateLimitReset", args: [{ id: action.id }] },
        { method: "finishRateLimitReset", args: [{ id: action.id }] }
      ];
    case "keycap":
      if (spec.keycapId === "MIC") {
        return [
          { method: "sendMicroAction", args: ["ACT10_ACT11", 1] },
          { method: "sendMicroAction", args: ["ACT10_ACT11", 0] }
        ];
      }
      return [{ method: "runKeycap", args: [spec.keycapId] }];
  }
}

test("all 45 M18 operations dispatch once to the expected controller boundary", async () => {
  assert.equal(M18_ACTION_CATALOG.length, 45);
  for (const spec of M18_ACTION_CATALOG) {
    const calls: RecordedCall[] = [];
    const action: DeckSurfaceAction = {
      id: `matrix-${spec.id}`,
      setImage: async () => {},
      setTitle: async () => {}
    };
    const binding = createM18Binding(recordingController(calls), spec);
    binding.register?.(action);
    calls.length = 0;

    await binding.down();
    await binding.up?.();

    assert.deepEqual(calls, expectedDispatch(spec, action), spec.id);
    binding.unregister?.(action);
  }
});

test("all 30 official keycaps are ordinary single-press inputs", async () => {
  assert.equal(OFFICIAL_KEYCAP_IDS.length, 30);
  const specs = M18_ACTION_CATALOG.filter((spec) => spec.kind === "keycap");
  assert.deepEqual(specs.map((spec) => spec.keycapId), [...OFFICIAL_KEYCAP_IDS]);

  for (const spec of specs) {
    const calls: RecordedCall[] = [];
    const binding = createM18Binding(recordingController(calls), spec);
    await binding.down();
    if (spec.keycapId === "MIC") {
      assert.deepEqual(calls, [{ method: "sendMicroAction", args: ["ACT10_ACT11", 1] }], spec.keycapId);
      await binding.up?.();
      assert.deepEqual(calls, [
        { method: "sendMicroAction", args: ["ACT10_ACT11", 1] },
        { method: "sendMicroAction", args: ["ACT10_ACT11", 0] }
      ], spec.keycapId);
    } else {
      assert.deepEqual(calls, [{ method: "runKeycap", args: [spec.keycapId] }], spec.keycapId);
      await binding.up?.();
      assert.deepEqual(calls, [{ method: "runKeycap", args: [spec.keycapId] }], `${spec.keycapId} key-up`);
    }
  }
});
