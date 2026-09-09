import assert from "node:assert/strict";
import test from "node:test";
import { VsdBridgeManager, type BridgeInspection } from "../src/vsd-bridge-manager.js";

function setup(initial: BridgeInspection) {
  let inspection = initial;
  let now = 100_000;
  let healthy = false;
  const connections: boolean[] = [];
  const manager = new VsdBridgeManager({
    inspect: async () => inspection,
    connect: async (interactive) => { connections.push(interactive); },
    healthy: () => healthy, now: () => now,
    logger: { info() {}, warn() {}, error() {} }
  });
  return { manager, connections, setInspection: (value: BridgeInspection) => { inspection = value; },
    advance: () => { now += 31_000; }, setHealthy: (value: boolean) => { healthy = value; } };
}

test("plugin starts absent Codex once and respects a later user exit", async () => {
  const s = setup("stopped");
  await s.manager.tick();
  assert.deepEqual(s.connections, [false]);
  s.advance();
  await s.manager.tick();
  assert.deepEqual(s.connections, [false]);
  assert.equal(s.manager.state, "stopped");
});

test("normal Codex is never automatically restarted; recovery is explicit", async () => {
  const s = setup("restart-required");
  await s.manager.tick();
  assert.deepEqual(s.connections, []);
  assert.equal(s.manager.state, "restart-required");
  await s.manager.recover();
  assert.deepEqual(s.connections, [true]);
  s.advance();
  await s.manager.tick(); // Also represents a cancelled restart dialog.
  assert.deepEqual(s.connections, [true]);
  assert.equal(s.manager.state, "restart-required");
});

test("healthy bridge is reused and disconnected bridge retries with backoff", async () => {
  const s = setup("connectable");
  s.setHealthy(true);
  await s.manager.tick();
  assert.equal(s.manager.state, "connected");
  assert.deepEqual(s.connections, []);
  s.setHealthy(false);
  await s.manager.tick();
  await s.manager.tick();
  assert.deepEqual(s.connections, [false]);
  s.advance();
  await s.manager.tick();
  assert.deepEqual(s.connections, [false, false]);
  s.manager.stop();
  s.advance();
  await s.manager.tick();
  await s.manager.recover();
  assert.deepEqual(s.connections, [false, false]);
});

test("repeated requests cannot create simultaneous recovery dialogs", async () => {
  let complete!: () => void;
  let count = 0;
  const manager = new VsdBridgeManager({
    inspect: async () => "restart-required", healthy: () => false, now: Date.now,
    connect: async () => { count++; await new Promise<void>((resolve) => { complete = resolve; }); },
    logger: { info() {}, warn() {}, error() {} }
  });
  const pending = manager.recover();
  await manager.recover();
  await manager.tick();
  assert.equal(count, 1);
  complete();
  await pending;
});

test("stopping during inspection prevents a delayed launch", async () => {
  let complete!: (state: BridgeInspection) => void;
  let count = 0;
  const manager = new VsdBridgeManager({
    inspect: () => new Promise((resolve) => { complete = resolve; }),
    healthy: () => false, now: Date.now, connect: async () => { count++; },
    logger: { info() {}, warn() {}, error() {} }
  });
  const pending = manager.tick();
  manager.stop();
  complete("stopped");
  await pending;
  assert.equal(count, 0);
});

test("failed recovery surfaces an error and does not spin", async () => {
  let count = 0;
  const manager = new VsdBridgeManager({
    inspect: async () => "connectable", healthy: () => false, now: () => 1000,
    connect: async () => { count++; throw new Error("runtime unavailable"); },
    logger: { info() {}, warn() {}, error() {} }
  });
  await manager.tick();
  await manager.tick();
  assert.equal(manager.state, "error");
  assert.equal(count, 1);
});

test("disconnect during retry backoff immediately clears the connected label", async () => {
  const s = setup("connectable");
  await s.manager.tick();
  s.setHealthy(true);
  await s.manager.tick();
  assert.equal(s.manager.state, "connected");
  s.setHealthy(false);
  await s.manager.tick();
  assert.notEqual(s.manager.state, "connected");
  assert.deepEqual(s.connections, [false]);
});
