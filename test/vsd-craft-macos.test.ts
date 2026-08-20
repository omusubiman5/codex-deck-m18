import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string): Promise<string> =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("VSD Craft package declares the shared Node entry point for Windows and macOS", async () => {
  const [builder, validator] = await Promise.all([
    source("scripts/build-vsd-craft.mjs"),
    source("scripts/validate-vsd-craft.mjs")
  ]);
  for (const contents of [builder, validator]) {
    assert.match(contents, /CodePathWin/);
    assert.match(contents, /CodePathMac/);
  }
});

test("macOS installer uses the standard VSD Craft plugin directory and preserves rollback", async () => {
  const installer = await source("scripts/install-vsd-craft-codex-deck-macos.sh");
  assert.match(installer, /Library\/Application Support\/HotSpot\/StreamDock\/plugins/);
  assert.match(installer, /Library\/Application Support\/CodexDeck/);
  assert.match(installer, /backup_root="\$state_root\/backups"/);
  assert.match(installer, /mv \"\$plugin_target\" \"\$backup\"/);
  assert.match(installer, /start-codex-deck\.sh/);
  assert.match(installer, /\"\$launcher\" install/);
  assert.match(installer, /open \"\$vsd_app\"/);
  assert.doesNotMatch(installer, /sudo|xattr\s+-[a-z]*r/i);
});

test("macOS installer refuses non-macOS hosts", async () => {
  const installer = await source("scripts/install-vsd-craft-codex-deck-macos.sh");
  assert.match(installer, /uname -s/);
  assert.match(installer, /this installer is for macOS only/);
});

test("standalone VSD Craft installers use bundled artifacts without rebuilding source", async () => {
  const [windows, macOS, packager] = await Promise.all([
    source("scripts/installers/Install-CodexDeck-VSDCraft.ps1"),
    source("scripts/installers/Install Codex Deck.command"),
    source("scripts/package-vsd-craft-installers.mjs")
  ]);
  assert.match(windows, /plugin\\com\.simeo\.codex-deck\.sdPlugin/);
  assert.match(windows, /VSD Craft is not installed/);
  assert.match(windows, /download\.vsdinside\.com\/streamdock\/win\/VSD-Craft-Installer_Windows\.msi/);
  assert.match(windows, /Get-AuthenticodeSignature/);
  assert.match(windows, /Shenzhen An Rui Xin Technology Co\., Ltd\./);
  assert.match(windows, /\.installing\.\$PID/);
  assert.doesNotMatch(windows, /VSDCraftInstallerPath|npm\s|node\s/);
  assert.match(macOS, /plugin\/com\.simeo\.codex-deck\.sdPlugin/);
  assert.match(macOS, /launcher-macos/);
  assert.match(macOS, /Library\/Application Support\/HotSpot\/StreamDock\/plugins/);
  assert.match(macOS, /download\.vsdinside\.com\/streamdock\/mac\/VSD-Craft-Installer_Mac\.pkg/);
  assert.match(macOS, /pkgutil --check-signature/);
  assert.match(macOS, /open -W "\$official_pkg"/);
  assert.doesNotMatch(macOS, /npm\s|scripts\/build/);
  assert.match(packager, /codex-deck-vsd-craft-windows/);
  assert.match(packager, /codex-deck-vsd-craft-macos/);
  assert.match(packager, /SHA256SUMS\.txt/);
  assert.match(packager, /0o100755/);
});
