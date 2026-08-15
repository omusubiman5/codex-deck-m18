import { build } from "esbuild";
import { copyFile, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("dist/m18");
await mkdir(output, { recursive: true });
await build({
  entryPoints: [resolve("src/m18.ts")],
  outfile: resolve(output, "codex-deck-m18.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" }
});
const executable = process.platform === "win32" ? "codex-deck-m18-adapter.exe" : "codex-deck-m18-adapter";
await copyFile(resolve("m18-adapter/target/release", executable), resolve(output, executable));
await copyFile(resolve("scripts/Start-CodexDeck-M18.ps1"), resolve(output, "Start-CodexDeck-M18.ps1"));
await copyFile(resolve("scripts/Watch-CodexDeck-M18.ps1"), resolve(output, "Watch-CodexDeck-M18.ps1"));
await cp(resolve("release/codex-deck-launcher"), resolve(output, "launcher"), { recursive: true });
