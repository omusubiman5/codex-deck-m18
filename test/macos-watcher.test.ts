import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acquirePidLock, isBridgeStateStale, removeStaleBridgeStateFile } from "../launcher/macos/codex-deck-macos.js";
import {
  createWatcherPolicyState,
  evaluateWatcherPolicy,
  resumeWatcherPolicyState
} from "../launcher/macos/watcher-policy.js";

test("initial existing normal session remains untouched", () => {
  const result = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: "A", bridgeHealthy: false
  });
  assert.equal(result.action.type, "preserve-initial-session");
  assert.equal(result.state.suppressedInitialGeneration, "A");
});

test("an unbridged replacement generation is never recovery-restarted", () => {
  let result = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: "A", bridgeHealthy: true
  });
  result = evaluateWatcherPolicy(result.state, { now: 30_000, generation: "B", bridgeHealthy: false });
  result = evaluateWatcherPolicy(result.state, { now: 40_000, generation: "B", bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "automatic-restart-disabled" });
  result = evaluateWatcherPolicy(result.state, { now: 71_000, generation: "B", bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "automatic-restart-disabled" });
});

test("rapid main-process replacement is detected without observing a stopped poll", () => {
  let result = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: "A", bridgeHealthy: true
  });
  result = evaluateWatcherPolicy(result.state, { now: 30_000, generation: "B", bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "automatic-restart-disabled" });
  result = evaluateWatcherPolicy(result.state, { now: 40_000, generation: "B", bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "automatic-restart-disabled" });
});

test("an observed stopped interval never auto-launches Codex", () => {
  let result = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: "A", bridgeHealthy: true
  });
  result = evaluateWatcherPolicy(result.state, { now: 6_000, generation: null, bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "codex-not-running" });
  result = evaluateWatcherPolicy(result.state, { now: 8_001, generation: null, bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "codex-not-running" });
});

test("previous healthy bridge does not authorize restart after app update replacement", () => {
  let result = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: "A:/Applications/Old.app", bridgeHealthy: true
  });
  result = evaluateWatcherPolicy(result.state, {
    now: 30_000, generation: "B:/Applications/New.app", bridgeHealthy: false
  });
  assert.equal(result.action.type, "wait");
  result = evaluateWatcherPolicy(result.state, {
    now: 40_000, generation: "B:/Applications/New.app", bridgeHealthy: false
  });
  assert.deepEqual(result.action, { type: "wait", reason: "automatic-restart-disabled" });
});

test("replacement generations stay observation-only without a recovery circuit", () => {
  let result = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: "A", bridgeHealthy: true
  });
  result = evaluateWatcherPolicy(result.state, { now: 30_000, generation: "B", bridgeHealthy: false });
  result = evaluateWatcherPolicy(result.state, { now: 40_000, generation: "B", bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "automatic-restart-disabled" });
  result = evaluateWatcherPolicy(result.state, { now: 71_000, generation: "C", bridgeHealthy: false });
  assert.deepEqual(result.action, { type: "wait", reason: "automatic-restart-disabled" });
});

test("LaunchAgent startup race and resumed state remain observation-only", () => {
  let fresh = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: null, bridgeHealthy: false
  });
  fresh = evaluateWatcherPolicy(fresh.state, { now: 2_000, generation: "LOGIN", bridgeHealthy: false });
  assert.deepEqual(fresh.action, { type: "wait", reason: "automatic-restart-disabled" });

  let prior = evaluateWatcherPolicy(createWatcherPolicyState(0), {
    now: 0, generation: "OLD", bridgeHealthy: true
  }).state;
  prior = resumeWatcherPolicyState(prior, 100_000);
  let resumed = evaluateWatcherPolicy(prior, { now: 101_000, generation: "LOGIN", bridgeHealthy: false });
  assert.deepEqual(resumed.action, { type: "wait", reason: "automatic-restart-disabled" });
  resumed = evaluateWatcherPolicy(resumed.state, { now: 130_000, generation: "LOGIN", bridgeHealthy: false });
  assert.deepEqual(resumed.action, { type: "wait", reason: "automatic-restart-disabled" });
});

test("stale port state is identified while the live port is retained", () => {
  assert.equal(isBridgeStateStale(56_871, 56_871), false);
  assert.equal(isBridgeStateStale(56_871, 56_872), true);
  assert.equal(isBridgeStateStale(70_000, null), true);
  assert.equal(isBridgeStateStale("not-a-port", null), true);
});

test("stale bridge-port file is removed but the active one is preserved", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-deck-state-test-"));
  try {
    const path = join(root, "codex-micro-bridge.json");
    await writeFile(path, `${JSON.stringify({ port: 56_871 })}\n`);
    assert.equal(await removeStaleBridgeStateFile(path, 56_871), false);
    assert.match(await readFile(path, "utf8"), /56871/);
    assert.equal(await removeStaleBridgeStateFile(path, null), true);
    await assert.rejects(readFile(path, "utf8"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("duplicate watcher instances exit safely under a PID lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-deck-lock-test-"));
  try {
    const lockPath = join(root, "watcher.lock");
    const release = await acquirePidLock(lockPath);
    assert.ok(release);
    assert.equal(await acquirePidLock(lockPath), null);
    await release();
    const reacquired = await acquirePidLock(lockPath);
    assert.ok(reacquired);
    await reacquired();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
