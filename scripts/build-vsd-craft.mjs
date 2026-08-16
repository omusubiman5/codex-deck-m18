import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { copyDistributionLicenses } from "./distribution-licenses.mjs";

const source = resolve("dist/com.simeo.codex-deck.sdPlugin");
const output = resolve("dist-vsd-craft/com.simeo.codex-deck.sdPlugin");

await rm(resolve("dist-vsd-craft"), { recursive: true, force: true });
await mkdir(resolve("dist-vsd-craft"), { recursive: true });
await cp(source, output, { recursive: true });
await copyDistributionLicenses(source, output);
await mkdir(resolve(output, "launcher"), { recursive: true });
for (const filename of ["Start-CodexDeck.ps1", "Watch-CodexDeck.ps1", "runtime-override.mjs"]) {
  await cp(resolve("release/codex-deck-launcher", filename), resolve(output, "launcher", filename));
}
await cp(
  resolve("release/codex-deck-launcher/node_modules"),
  resolve(output, "launcher/node_modules"),
  { recursive: true }
);

const manifestPath = resolve(output, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.SDKVersion = 1;
manifest.CodePathWin = manifest.CodePath;
manifest.CodePathMac = manifest.CodePath;
manifest.Software = { MinimumVersion: "3.10.188.226" };
manifest.Nodejs = { Version: "20" };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (manifest.CodePathWin !== "bin/plugin.mjs") throw new Error("Unexpected VSD Craft CodePathWin.");
if (manifest.CodePathMac !== "bin/plugin.mjs") throw new Error("Unexpected VSD Craft CodePathMac.");
if (!Array.isArray(manifest.Actions) || manifest.Actions.length === 0) throw new Error("VSD Craft package has no actions.");
console.log(`VSD Craft package created with ${manifest.Actions.length} actions: ${output}`);
