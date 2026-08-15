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
const actionImages = new Set();
for (const action of manifest.Actions ?? []) {
  for (const image of [action.Icon, action.States?.[0]?.Image]) {
    if (typeof image === "string" && image.startsWith("static/imgs/actions/")) actionImages.add(image);
  }
}
for (const image of actionImages) {
  for (const suffix of [".png", "@2x.png"]) {
    try { await access(resolve(root, `${image}${suffix}`)); }
    catch { failures.push(`Missing packaged action image: ${image}${suffix}`); }
  }
}
for (let agent = 1; agent <= 6; agent += 1) {
  const stem = `static/imgs/actions/micro-${String(agent).padStart(2, "0")}-agent-${agent}`;
  for (const status of ["empty", "idle", "thinking", "complete", "input", "error"]) {
    for (const suffix of [".png", "@2x.png"]) {
      const image = `${stem}-status-${status}${suffix}`;
      try { await access(resolve(root, image)); }
      catch { failures.push(`Missing packaged agent-status image: ${image}`); }
    }
  }
}

if (failures.length > 0) throw new Error(failures.join("\n"));
console.log(`VSD Craft manifest validation passed (${manifest.Actions.length} actions, ${actionImages.size} action images).`);
