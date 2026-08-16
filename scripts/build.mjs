import { build } from "esbuild";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import "./generate-plugin-icons.mjs";
import { writeDistributionLicenses } from "./distribution-licenses.mjs";

const output = resolve("dist/com.simeo.codex-deck.sdPlugin");
// Keep the package root itself because Windows may have a directory handle open
// while Stream Deck is installed. Clearing every child still prevents stale
// files from another OS (notably Finder AppleDouble `._*` entries) leaking into
// the next build.
await mkdir(output, { recursive: true });
for (const entry of await readdir(output)) {
  await rm(resolve(output, entry), { recursive: true, force: true });
}
await mkdir(resolve(output, "bin"), { recursive: true });
await mkdir(resolve(output, "static/imgs"), { recursive: true });
await mkdir(resolve(output, "static/property-inspector"), { recursive: true });
for (const filename of [
  "category-icon.svg", "category-icon@2x.svg",
  "key.svg", "key@2x.svg",
  "plugin-icon.png", "plugin-icon@2x.png"
]) {
  await cp(resolve("static/imgs", filename), resolve(output, "static/imgs", filename));
}
await cp(resolve("static/manifest.json"), resolve(output, "manifest.json"));
const manifestPath = resolve(output, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const action of manifest.Actions ?? []) {
  action.Icon = "static/imgs/category-icon";
  for (const state of action.States ?? []) state.Image = "static/imgs/key";
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await cp(resolve("static/property-inspector/usage-limit.html"), resolve(output, "static/property-inspector/usage-limit.html"));
await cp(resolve("static/property-inspector/agent.html"), resolve(output, "static/property-inspector/agent.html"));

const buildResult = await build({
  entryPoints: [resolve("src/plugin.ts")],
  outfile: resolve(output, "bin/plugin.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  metafile: true,
  sourcemap: true,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" }
});
await writeDistributionLicenses(output, buildResult.metafile);
