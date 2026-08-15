import assert from "node:assert/strict";
import test from "node:test";
import { createTapOrHoldBinding } from "../src/m18-bindings.js";

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("short press emits only the tap gesture", async () => {
  const events: string[] = [];
  const binding = createTapOrHoldBinding({
    holdMs: 30,
    tap: async () => { events.push("tap"); },
    holdDown: async () => { events.push("hold-down"); },
    holdUp: async () => { events.push("hold-up"); },
    onError: (error) => { throw error; }
  });

  await binding.down();
  await binding.up?.();
  await wait(40);
  assert.deepEqual(events, ["tap"]);
});

test("long press emits encoder down and up without a tap", async () => {
  const events: string[] = [];
  const binding = createTapOrHoldBinding({
    holdMs: 15,
    tap: async () => { events.push("tap"); },
    holdDown: async () => { events.push("hold-down"); },
    holdUp: async () => { events.push("hold-up"); },
    onError: (error) => { throw error; }
  });

  await binding.down();
  await wait(25);
  await binding.up?.();
  assert.deepEqual(events, ["hold-down", "hold-up"]);
});
