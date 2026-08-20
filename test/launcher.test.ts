import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildRuntimeOverrideExpression, buildRuntimeVerificationExpression, selectRuntimeTarget } from "../launcher/runtime-override.js";

const execFileAsync = promisify(execFile);

test("launcher discovers the persisted-signal module without a build hash", () => {
  const expression = buildRuntimeOverrideExpression();
  assert.match(expression, /\/assets\/persisted-signal-/);
  assert.doesNotMatch(expression, /persisted-signal-[A-Za-z0-9_-]+\.js/);
  assert.match(expression, /codex-micro-has-ever-been-detected/);
});

test("launcher rejects an unsafe feature-gate expression", () => {
  assert.throws(() => buildRuntimeOverrideExpression("1);alert(1)//"), /digits only/);
});

test("runtime override targets the main renderer instead of macOS avatar surfaces", () => {
  const target = selectRuntimeTarget([
    { type: "page", url: "app://-/index.html?initialRoute=%2Favatar-overlay", webSocketDebuggerUrl: "ws://route" },
    { type: "page", url: "app://-/avatar-overlay-composition-surface.html?surfaceId=mascot-badge", webSocketDebuggerUrl: "ws://mascot" },
    { type: "page", url: "app://-/index.html", webSocketDebuggerUrl: "ws://main" }
  ]);

  assert.equal(target?.webSocketDebuggerUrl, "ws://main");
});

test("startup monitoring is observation-only and never restarts Codex", async () => {
  const [watcher, launcher, build, supervisor] = await Promise.all([
    readFile(new URL("../launcher/Watch-CodexDeck.ps1", import.meta.url), "utf8"),
    readFile(new URL("../launcher/Start-CodexDeck.ps1", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-launcher.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/windows-bridge-supervisor.ts", import.meta.url), "utf8")
  ]);

  assert.match(watcher, /Local\\CodexDeckBridgeWatcher/);
  assert.match(watcher, /Get-AppxPackage -Name 'OpenAI\.Codex'/);
  assert.match(watcher, /observation-only mode/i);
  assert.match(watcher, /automatic restart disabled/i);
  assert.doesNotMatch(watcher, /RecoverExistingSession/);
  assert.doesNotMatch(watcher, /Invoke-CodexDeckLauncher -ForceRestart/);
  assert.match(watcher, /Clear-StalePortFile/);

  assert.doesNotMatch(supervisor, /watcher, "-RecoverExistingSession"/);
  assert.match(supervisor, /without automatic recovery permission/i);

  assert.match(launcher, /Watch-CodexDeck\.ps1/);
  assert.doesNotMatch(launcher, /-RecoverExistingSession/);
  assert.match(launcher, /Start-BridgeWatcher/);
  assert.match(launcher, /Get-InstalledLauncherRoot/);
  assert.match(launcher, /Install-WatcherBundle/);
  assert.match(launcher, /LocalAppData.*CodexDeck.*launcher/is);
  assert.match(launcher, /-not \$existingPort -and -not \$ForceRestart/);
  assert.match(launcher, /was left untouched[\s\S]*run again with -ForceRestart/i);
  assert.match(launcher, /if \(\$ForceRestart\)[\s\S]*Stop-Process/);
  assert.match(build, /Watch-CodexDeck\.ps1/);
  assert.match(build, /Configure-CodexDeckRelay\.ps1/);
  assert.match(build, /Configure-CodexDeckMobile\.ps1/);
  assert.match(build, /replace\(\/\\r\\n\/g, "\\n"\)/);
  assert.match(build, /Cloud-sync conflict/);
  assert.match(build, /"package\.json", "browser\.js", "index\.js", "wrapper\.mjs"/);
  assert.doesNotMatch(build, /cp\(resolve\("node_modules\/ws"\).*recursive: true/s);
});

test("watcher observation self-test passes in PowerShell", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows PowerShell watcher self-test runs on Windows");
    return;
  }

  const watcherPath = fileURLToPath(new URL("../launcher/Watch-CodexDeck.ps1", import.meta.url));
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", watcherPath, "-SelfTest"
  ]);
  assert.match(stdout, /self-test passed \(3 cases\)/i);
});

test("launcher supports the current shared-chunk native detection path", () => {
  const expression = buildRuntimeOverrideExpression();
  assert.match(expression, /native-device-event/);
  assert.match(expression, /codex-micro-device-state-changed/);
  assert.match(expression, /dispatchHostMessage/);
  assert.match(expression, /deviceEventDispatched/);
  assert.match(expression, /3207467860/);
});

test("launcher verifies the settings gate and native Micro handlers", () => {
  const expression = buildRuntimeVerificationExpression();
  assert.match(expression, /settings\/codex-micro/);
  assert.match(expression, /codex-micro-hid-event/);
  assert.match(expression, /codex-micro-joystick-event/);
  assert.match(expression, /nativeEventBus/);
});
