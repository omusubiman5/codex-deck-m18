import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("M18 watcher bounds UTF-8 logs and backs off repeated startup failures", async () => {
  const source = await readFile(new URL("../scripts/Watch-CodexDeck-M18.ps1", import.meta.url), "utf8");
  assert.match(source, /Rotate-M18Log/);
  assert.match(source, /8MB/);
  assert.match(source, /Add-Content[^\n]+-Encoding UTF8/);
  assert.match(source, /\$retrySeconds = 5/);
  assert.match(source, /\$maxRetrySeconds = 60/);
  assert.match(source, /\[Math\]::Min\(\$maxRetrySeconds, \$retrySeconds \* 2\)/);
  assert.doesNotMatch(source, /\*>>/);
});
