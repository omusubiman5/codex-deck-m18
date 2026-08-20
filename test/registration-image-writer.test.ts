import assert from "node:assert/strict";
import test from "node:test";
import type { DeckSurfaceAction } from "../src/deck-runtime.js";
import { RegistrationImageWriter } from "../src/registration-image-writer.js";

test("a stale scene render cannot overwrite the current registration", async () => {
  const images: string[] = [];
  let releaseOldWrite!: () => void;
  let markOldStarted!: () => void;
  const oldWriteBlocked = new Promise<void>((resolve) => { releaseOldWrite = resolve; });
  const oldWriteStarted = new Promise<void>((resolve) => { markOldStarted = resolve; });
  const action: DeckSurfaceAction = {
    id: "lcd-0",
    setImage: async (image) => {
      images.push(image);
      if (image === "old") {
        markOldStarted();
        await oldWriteBlocked;
      }
    },
    setTitle: async () => {}
  };
  const writer = new RegistrationImageWriter();
  const oldGeneration = writer.register(action.id);
  const oldWrite = writer.write(action, "old", "", oldGeneration);
  await oldWriteStarted;

  writer.unregister(action.id);
  const currentGeneration = writer.register(action.id);
  const currentWrite = writer.write(action, "current", "", currentGeneration);
  releaseOldWrite();
  await Promise.all([oldWrite, currentWrite]);

  assert.deepEqual(images, ["old", "current"]);
});

test("a delayed stale image is discarded before writing", async () => {
  const images: string[] = [];
  const action: DeckSurfaceAction = {
    id: "lcd-1",
    setImage: async (image) => { images.push(image); },
    setTitle: async () => {}
  };
  const writer = new RegistrationImageWriter();
  const staleGeneration = writer.register(action.id);
  writer.unregister(action.id);
  const currentGeneration = writer.register(action.id);

  await writer.write(action, "stale", "", staleGeneration);
  await writer.write(action, "current", "", currentGeneration);

  assert.deepEqual(images, ["current"]);
});
