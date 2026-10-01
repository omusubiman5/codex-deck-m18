import assert from "node:assert/strict";
import test from "node:test";
import { bridgeInspectionFor, buildCodexLaunchSpec, buildLaunchAgentPlist, buildWatcherLaunchScript, parseDebugPort } from "../launcher/macos/codex-deck-macos.js";
import { codexDeckStateRoot } from "../src/codex-deck-paths.js";

test("macOS launcher uses LaunchServices and passes loopback-only CDP arguments", () => {
  const spec = buildCodexLaunchSpec({ appPath: "/Applications/Unexpected Codex Name.app" }, 43123);
  assert.equal(spec.command, "/usr/bin/open");
  assert.deepEqual(spec.args, [
    "-n",
    "-a",
    "/Applications/Unexpected Codex Name.app",
    "--args",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=43123"
  ]);
  assert.doesNotMatch(spec.args.join(" "), /0\.0\.0\.0/);
});

test("macOS launcher validates ports and parses both supported flag forms", () => {
  assert.throws(() => buildCodexLaunchSpec({ appPath: "/Applications/Codex.app" }, 0), /Invalid debugging port/);
  assert.equal(parseDebugPort("Codex --remote-debugging-port=43123"), 43123);
  assert.equal(parseDebugPort("Codex --remote-debugging-port 43124"), 43124);
  assert.equal(parseDebugPort("Codex --remote-debugging-port=70000"), null);
});

test("bridge and user icon state use the native macOS Application Support root", () => {
  assert.equal(
    codexDeckStateRoot("darwin", "/Users/tester"),
    "/Users/tester/Library/Application Support/CodexDeck"
  );
  assert.equal(
    codexDeckStateRoot("win32", "C:\\Users\\tester", "C:\\Users\\tester\\AppData\\Local"),
    "C:\\Users\\tester\\AppData\\Local\\CodexDeck"
  );
});

test("LaunchAgent uses a dynamic Node resolver instead of pinning an NVM version", () => {
  const launcher = buildWatcherLaunchScript("/tmp/Codex Deck/runtime.mjs");
  const plist = buildLaunchAgentPlist("/tmp/Codex Deck/watcher-launch.sh");
  assert.match(launcher, /\.nvm\/versions\/node\/\*\/bin\/node/);
  assert.match(launcher, /Contents\/Resources\/cua_node\/bin\/node/);
  assert.match(launcher, /Node\.js 20 or newer/);
  assert.match(plist, /<string>\/bin\/zsh<\/string>/);
  assert.match(plist, /watcher-launch\.sh/);
  assert.match(plist, /watcher\.stderr\.log/);
  assert.doesNotMatch(plist, /\.nvm\/versions\/node\/v\d/);
});

test("manual and double-click launch resolve Node outside an interactive shell", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../launcher/start-codex-deck.sh", import.meta.url), "utf8"));
  assert.match(source, /\.nvm\/versions\/node\/\*\/bin\/node/);
  assert.match(source, /Contents\/Resources\/cua_node\/bin\/node/);
  assert.match(source, /node_major/);
  assert.doesNotMatch(source, /exec \/usr\/bin\/env node/);
});

test("macOS release packaging preserves executable launchers", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../scripts/package-macos-release.sh", import.meta.url), "utf8"));
  assert.match(source, /chmod 755/);
  assert.match(source, /start-codex-deck\.sh/);
  assert.match(source, /Start Codex Deck\.command/);
  assert.match(source, /ditto -c -k/);
});

test("macOS bridge inspection follows the shared inspect contract", () => {
  assert.equal(bridgeInspectionFor(false, null), "stopped");
  assert.equal(bridgeInspectionFor(false, 43123), "connectable");
  assert.equal(bridgeInspectionFor(true, 43123), "connectable");
  assert.equal(bridgeInspectionFor(true, null), "restart-required");
});

test("macOS interactive recovery confirms before restarting Codex", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../launcher/macos/codex-deck-macos.ts", import.meta.url), "utf8"));
  assert.match(source, /command === "inspect"/);
  assert.match(source, /command === "connect"/);
  assert.match(source, /BRIDGE_LAUNCH_LOCK_PATH/);
  assert.match(source, /BRIDGE_RECOVERY_LOCK_PATH/);
  assert.match(source, /\/usr\/bin\/osascript/);
  assert.match(source, /display dialog/);
  assert.match(source, /RESTART_CANCEL_BUTTON = "キャンセル"/);
  assert.match(source, /default button \$\{quoted\(RESTART_CANCEL_BUTTON\)\}/);
  assert.match(source, /cancel button \$\{quoted\(RESTART_CANCEL_BUTTON\)\}/);
  assert.match(source, /CANCELLED/);
  assert.match(source, /startOnce\(true\)/);
  assert.doesNotMatch(source, /SIGKILL|kill\(-9|Stop-Process/);
});

test("macOS runtime supports relay pairing without exposing the CDP listener", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../launcher/macos/codex-deck-macos.ts", import.meta.url), "utf8"));
  assert.match(source, /relay-config/);
  assert.match(source, /RELAY_SERVER_CONFIG_PATH/);
  assert.match(source, /CodexRelayServer/);
  assert.doesNotMatch(source, /remote-debugging-address=0\.0\.0\.0/);
});
