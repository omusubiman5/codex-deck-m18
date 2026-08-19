import assert from "node:assert/strict";
import test from "node:test";
import { agentPrimaryLabel, isSafeProjectLabel, normalizeProjectLabel } from "../src/project-label.js";

test("project labels expose only a bounded basename", () => {
  assert.equal(normalizeProjectLabel("C:\\Projects\\codex-deck-m18"), "codex-deck-m18");
  assert.equal(normalizeProjectLabel("/Users/test/My Project/"), "My Project");
  assert.equal(normalizeProjectLabel("  "), undefined);
  assert.equal(isSafeProjectLabel("codex-deck-m18"), true);
  assert.equal(isSafeProjectLabel("C:\\Projects\\secret"), false);
  assert.equal(isSafeProjectLabel("/Users/test/secret"), false);
});

test("agent labels prefer the project and retain the task fallback", () => {
  assert.equal(agentPrimaryLabel("codex-deck-m18", "Implement scenes"), "codex-deck-m18");
  assert.equal(agentPrimaryLabel(undefined, "Implement scenes"), "Implement scenes");
});
