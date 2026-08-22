import assert from "node:assert/strict";
import test from "node:test";
import { DeckController, VOICE_PULSE_DELAYS_MS, VOICE_PULSE_LEVELS } from "../src/controller.js";
import type { DeckSurfaceAction } from "../src/deck-runtime.js";

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("Voice pulse is bounded, one-shot, and restores the static frame", async () => {
  assert.equal(VOICE_PULSE_LEVELS.length, 4);
  assert.equal(VOICE_PULSE_DELAYS_MS.reduce((sum, value) => sum + value, 0), 320);
  const images: string[] = [];
  const controller = createController();
  const action: DeckSurfaceAction = {
    id: "voice-pulse",
    setImage: async (image) => { images.push(decodeURIComponent(image.slice(image.indexOf(",") + 1))); },
    setTitle: async () => {}
  };
  controller.registerFixedAction("keycap-mic", action, { kind: "builtin", name: "voice" });
  await wait(20);
  images.length = 0;
  controller.pulseVoiceAction(action);
  await wait(430);
  assert.equal(images.length, 5);
  assert.ok(images.slice(0, 4).every((image) => image.includes("data-voice-pulse")));
  assert.match(images.at(-1) ?? "", /data-icon-source="fallback-label"/);
  assert.doesNotMatch(images.at(-1) ?? "", /data-voice-pulse/);
});

test("a repeated Voice pulse cancels the active run and rate-limits new frames", async () => {
  const images: string[] = [];
  const controller = createController();
  const action: DeckSurfaceAction = {
    id: "voice-repeat",
    setImage: async (image) => { images.push(decodeURIComponent(image.slice(image.indexOf(",") + 1))); },
    setTitle: async () => {}
  };
  controller.registerFixedAction("keycap-mic", action, { kind: "builtin", name: "voice" });
  await wait(20);
  images.length = 0;
  controller.pulseVoiceAction(action);
  await wait(15);
  controller.pulseVoiceAction(action);
  await wait(150);
  assert.ok(images.length <= 2);
  assert.match(images.at(-1) ?? "", /data-icon-source="fallback-label"/);
  assert.doesNotMatch(images.at(-1) ?? "", /data-voice-pulse/);
});

test("a failed Voice pulse leaves the already-rendered static fallback in place", async () => {
  const successful: string[] = [];
  const errors: string[] = [];
  const controller = new DeckController({
    logger: { info: () => {}, warn: () => {}, error: (message) => { errors.push(message); } },
    getGlobalSettings: async <T>() => ({}) as T
  });
  const action: DeckSurfaceAction = {
    id: "voice-failure",
    setImage: async (image) => {
      const svg = decodeURIComponent(image.slice(image.indexOf(",") + 1));
      if (svg.includes("data-voice-pulse")) throw new Error("simulated display failure");
      successful.push(svg);
    },
    setTitle: async () => {}
  };
  controller.registerFixedAction("keycap-mic", action, { kind: "builtin", name: "voice" });
  await wait(20);
  controller.pulseVoiceAction(action);
  await wait(80);
  assert.equal(successful.length, 1);
  assert.match(successful[0] ?? "", /data-icon-source="fallback-label"/);
  assert.ok(errors.some((message) => message.includes("restoring the static frame")));
});

function createController(): DeckController {
  return new DeckController({
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    getGlobalSettings: async <T>() => ({}) as T
  });
}
