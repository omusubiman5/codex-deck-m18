import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("M18 build packages the environment switch helper", async () => {
  const build = await readFile(new URL("../scripts/build-m18.mjs", import.meta.url), "utf8");
  assert.match(build, /Set-CodexDeck-M18-Environment\.ps1/);
});

test("M18 watcher keeps VSD Craft exclusive while environment 3 is selected", async () => {
  const watcher = await readFile(new URL("../scripts/Watch-CodexDeck-M18.ps1", import.meta.url), "utf8");
  assert.match(watcher, /Get-M18Environment\) -eq 3/);
  assert.match(watcher, /VSDCraft\.exe/);
  assert.match(watcher, /Start-Process -FilePath \$vsdCraft/);
  assert.match(watcher, /continue/);
});
