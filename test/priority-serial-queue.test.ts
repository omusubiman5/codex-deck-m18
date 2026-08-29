import assert from "node:assert/strict";
import test from "node:test";
import { PrioritySerialQueue } from "../src/priority-serial-queue.js";

test("commands overtake queued snapshots without overlapping evaluation", async () => {
  const queue = new PrioritySerialQueue();
  const order: string[] = [];
  let active = 0;
  let maximumActive = 0;
  let releaseFirst!: () => void;
  const blocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const operation = (name: string, wait?: Promise<void>) => async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    order.push(name);
    await wait;
    active -= 1;
    return name;
  };

  const first = queue.run("snapshot", operation("snapshot-1", blocked));
  const second = queue.run("snapshot", operation("snapshot-2"));
  const command = queue.run("command", operation("command"));
  releaseFirst();

  assert.deepEqual(await Promise.all([first, second, command]), ["snapshot-1", "snapshot-2", "command"]);
  assert.deepEqual(order, ["snapshot-1", "command", "snapshot-2"]);
  assert.equal(maximumActive, 1);
});

test("closing the queue rejects work that has not started", async () => {
  const queue = new PrioritySerialQueue();
  let release!: () => void;
  const first = queue.run("snapshot", () => new Promise<void>((resolve) => { release = resolve; }));
  const queued = queue.run("command", async () => {});
  queue.close(new Error("closed for test"));
  release();
  await first;
  await assert.rejects(queued, /closed for test/);
});
