import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { rasterizeM18Image } from "../src/m18-image.js";
import { renderAgentKey, renderVoiceKeycap } from "../src/render.js";

test("M18 images are rasterized to opaque 64px PNGs", async () => {
  const image = await rasterizeM18Image(renderAgentKey(0, "NORMAL UI", "idle", true, 0, "light"));
  assert.match(image, /^data:image\/png;base64,/);
  const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 64);
  assert.equal(metadata.hasAlpha, false);
});

test("every Voice pulse frame uses the same opaque 64px PNG transport", async () => {
  for (const level of [0.22, 0.62, 1, 0.42, 0]) {
    const image = await rasterizeM18Image(renderVoiceKeycap("light", level));
    const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
    const metadata = await sharp(bytes).metadata();
    assert.deepEqual({ width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha }, {
      width: 64, height: 64, hasAlpha: false
    });
  }
});
