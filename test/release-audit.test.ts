import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const auditScript = fileURLToPath(new URL("../scripts/audit-release.mjs", import.meta.url));

test("release audit accepts explicit clean roots and rejects private state", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-deck-audit-"));
  try {
    const clean = join(root, "clean");
    await mkdir(clean);
    await writeFile(join(clean, "LICENSE"), "test license\n", "utf8");
    await writeFile(join(clean, "README.txt"), "public release fixture\n", "utf8");
    const cleanResult = spawnSync(process.execPath, [auditScript, clean], { encoding: "utf8" });
    assert.equal(cleanResult.status, 0, cleanResult.stderr);
    assert.match(cleanResult.stdout, /passed for 1 artifact roots/);

    await writeFile(join(clean, "relay-client.json"), "{}\n", "utf8");
    const privateResult = spawnSync(process.execPath, [auditScript, clean], { encoding: "utf8" });
    assert.equal(privateResult.status, 1);
    assert.match(privateResult.stderr, /private runtime state must not be packaged/);

    await rm(join(clean, "relay-client.json"));
    await writeFile(join(clean, "._manifest.json"), "local metadata\n", "utf8");
    const metadataResult = spawnSync(process.execPath, [auditScript, clean], { encoding: "utf8" });
    assert.equal(metadataResult.status, 1);
    assert.match(metadataResult.stderr, /platform metadata must not be packaged/);

    await rm(join(clean, "._manifest.json"));
    await rm(join(clean, "LICENSE"));
    const licenseResult = spawnSync(process.execPath, [auditScript, clean], { encoding: "utf8" });
    assert.equal(licenseResult.status, 1);
    assert.match(licenseResult.stderr, /distribution LICENSE is missing/);

    const plugin = join(root, "fixture.sdPlugin");
    await mkdir(plugin);
    await writeFile(join(plugin, "LICENSE"), "test license\n", "utf8");
    const noticesResult = spawnSync(process.execPath, [auditScript, plugin], { encoding: "utf8" });
    assert.equal(noticesResult.status, 1);
    assert.match(noticesResult.stderr, /bundled dependency notices are missing/);

    const m18 = join(root, "m18");
    await mkdir(m18);
    await writeFile(join(m18, "LICENSE"), "MIT test license\n", "utf8");
    await writeFile(
      join(m18, "THIRD_PARTY_NOTICES.md"),
      "codex-deck-m18-adapter.exe is GPL-3.0-only; see LICENSE.adapter-GPL-3.0.\n",
      "utf8"
    );
    await writeFile(join(m18, "codex-deck-m18-adapter.exe"), "test adapter\n", "utf8");
    const missingGplResult = spawnSync(process.execPath, [auditScript, m18], { encoding: "utf8" });
    assert.equal(missingGplResult.status, 1);
    assert.match(missingGplResult.stderr, /M18 adapter GPL-3\.0 license is missing/);

    await writeFile(join(m18, "LICENSE.adapter-GPL-3.0"), "GNU GENERAL PUBLIC LICENSE\nVersion 3\n", "utf8");
    const completeM18Result = spawnSync(process.execPath, [auditScript, m18], { encoding: "utf8" });
    assert.equal(completeM18Result.status, 0, completeM18Result.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
