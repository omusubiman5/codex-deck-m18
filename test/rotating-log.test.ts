import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendRotatingLogSync } from "../src/rotating-log.js";

test("bounded logs retain one previous generation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codex-deck-log-"));
  const log = join(directory, "runtime.log");
  try {
    appendRotatingLogSync(log, "first-line\n", 20);
    appendRotatingLogSync(log, "second-line\n", 20);
    assert.equal(await readFile(`${log}.previous`, "utf8"), "first-line\n");
    assert.equal(await readFile(log, "utf8"), "second-line\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
