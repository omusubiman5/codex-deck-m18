import assert from "node:assert/strict";
import test from "node:test";
import { environmentForButton, savedCodexEnvironment } from "../src/m18-environment.js";

test("the three bottom buttons select environments and LCD keys do not", () => {
  assert.equal(environmentForButton(14), undefined);
  assert.equal(environmentForButton(15), 1);
  assert.equal(environmentForButton(16), 2);
  assert.equal(environmentForButton(17), 3);
  assert.equal(environmentForButton(18), undefined);
});

test("only Codex environments are restored directly by the runtime", () => {
  assert.equal(savedCodexEnvironment("1"), 1);
  assert.equal(savedCodexEnvironment("2\r\n"), 2);
  assert.equal(savedCodexEnvironment("3"), 1);
  assert.equal(savedCodexEnvironment(undefined), 1);
});
