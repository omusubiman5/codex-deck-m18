import { build } from "esbuild";
import { appendFile, copyFile, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { writeDistributionLicenses } from "./distribution-licenses.mjs";

const output = resolve("dist/m18");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const buildResult = await build({
  entryPoints: [resolve("src/m18.ts")],
  outfile: resolve(output, "codex-deck-m18.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["sharp"],
  metafile: true,
  sourcemap: true,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" }
});
await mkdir(resolve(output, "node_modules/@img"), { recursive: true });
for (const dependency of ["sharp", "detect-libc", "semver"]) {
  await cp(resolve("node_modules", dependency), resolve(output, "node_modules", dependency), { recursive: true });
}
for (const dependency of ["colour", "sharp-win32-x64"]) {
  await cp(resolve("node_modules/@img", dependency), resolve(output, "node_modules/@img", dependency), { recursive: true });
}
await writeDistributionLicenses(output, buildResult.metafile);
await copyFile(resolve("m18-adapter/LICENSE"), resolve(output, "LICENSE.adapter-GPL-3.0"));
await appendFile(
  resolve(output, "THIRD_PARTY_NOTICES.md"),
  [
    "",
    "# M18 adapter binary",
    "",
    "`codex-deck-m18-adapter.exe` (Windows) and `codex-deck-m18-adapter` (other platforms) are licensed GPL-3.0-only.",
    "The complete GNU GPL version 3 license text is included as `LICENSE.adapter-GPL-3.0` in this distribution.",
    "The corresponding adapter source is available at https://github.com/omusubiman5/codex-deck-m18/tree/main/m18-adapter.",
    ""
  ].join("\n"),
  "utf8"
);
const executable = process.platform === "win32" ? "codex-deck-m18-adapter.exe" : "codex-deck-m18-adapter";
await copyFile(resolve("m18-adapter/target/release", executable), resolve(output, executable));
await copyFile(resolve("scripts/Start-CodexDeck-M18.ps1"), resolve(output, "Start-CodexDeck-M18.ps1"));
await copyFile(resolve("scripts/Watch-CodexDeck-M18.ps1"), resolve(output, "Watch-CodexDeck-M18.ps1"));
await cp(resolve("release/codex-deck-launcher"), resolve(output, "launcher"), { recursive: true });
