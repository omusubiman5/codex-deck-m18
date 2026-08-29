import assert from "node:assert/strict";
import test from "node:test";
import { VoiceStartGate } from "../src/voice-start-gate.js";

test("Voice start is single-flight and suppressed while Codex settles", async () => {
  let now = 1_000;
  let release!: () => void;
  let calls = 0;
  const gate = new VoiceStartGate(5_000, () => now);
  const first = gate.run(() => {
    calls += 1;
    return new Promise<"started">((resolve) => { release = () => resolve("started"); });
  });

  assert.equal(await gate.run(async () => "started"), "suppressed");
  release();
  assert.equal(await first, "started");
  assert.equal(await gate.run(async () => "started"), "suppressed");
  assert.equal(calls, 1);

  now += 5_001;
  assert.equal(await gate.run(async () => { calls += 1; return "started"; }), "started");
  assert.equal(calls, 2);
});

test("inactive or failed starts do not create a settling window", async () => {
  const gate = new VoiceStartGate(5_000, () => 1_000);
  assert.equal(await gate.run(async () => "already-active"), "already-active");
  assert.equal(await gate.run(async () => "already-active"), "already-active");
  await assert.rejects(gate.run(async () => { throw new Error("not available"); }), /not available/);
  assert.equal(await gate.run(async () => "already-active"), "already-active");
});
