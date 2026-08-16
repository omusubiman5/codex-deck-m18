import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("dist-vsd-craft/com.simeo.codex-deck.sdPlugin");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const failures = [];

if (manifest.SDKVersion !== 1) failures.push("SDKVersion must be 1.");
if (manifest.Software?.MinimumVersion !== "3.10.188.226") failures.push("Unexpected VSD Craft minimum version.");
if (manifest.CodePathWin !== "bin/plugin.mjs") failures.push("CodePathWin must target bin/plugin.mjs.");
if (manifest.CodePathMac !== "bin/plugin.mjs") failures.push("CodePathMac must target bin/plugin.mjs.");
if (manifest.Nodejs?.Version !== "20") failures.push("VSD Craft Node.js version must be 20.");
if (!Array.isArray(manifest.Actions) || manifest.Actions.length !== 53) failures.push("Expected all 53 Codex Deck actions.");
await access(resolve(root, manifest.CodePathWin));
await access(resolve(root, manifest.CodePathMac));
await access(resolve(root, "LICENSE"));
await access(resolve(root, "THIRD_PARTY_NOTICES.md"));
for (const filename of ["Start-CodexDeck.ps1", "Watch-CodexDeck.ps1", "runtime-override.mjs"]) {
  await access(resolve(root, "launcher", filename));
}
await access(resolve(root, "launcher/node_modules/ws/package.json"));
for (const action of manifest.Actions ?? []) {
  if (action.Icon !== "static/imgs/category-icon") failures.push(`Action ${action.UUID} has a fixed icon.`);
  if (action.States?.[0]?.Image !== "static/imgs/key") failures.push(`Action ${action.UUID} has a fixed state image.`);
}
try {
  await access(resolve(root, "static/imgs/actions"));
  failures.push("Fixed artwork directory must not be packaged.");
} catch {}

if (failures.length > 0) throw new Error(failures.join("\n"));
console.log(`VSD Craft manifest validation passed (${manifest.Actions.length} live-rendered actions, no fixed artwork).`);
