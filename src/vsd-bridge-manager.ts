import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckLogger } from "./deck-runtime.js";

export type BridgeState = "checking" | "stopped" | "connectable" | "restart-required" | "connected" | "connecting" | "error";
export type BridgeInspection = "stopped" | "connectable" | "restart-required";
export type BridgeDependencies = {
  inspect: () => Promise<BridgeInspection>;
  connect: (interactive: boolean) => Promise<void>;
  healthy: () => boolean;
  now: () => number;
  logger: DeckLogger;
};

/** Owns only the bridge. Closing Codex after startup must not reopen it. */
export class VsdBridgeManager {
  state: BridgeState = "checking";
  detail = "接続状態を確認しています。";
  private initial = true;
  private busy = false;
  private stopped = false;
  private retryAt = 0;
  private timer?: NodeJS.Timeout;

  constructor(private readonly dependencies: BridgeDependencies) {}

  start(): void {
    if (this.timer) return;
    this.dependencies.logger.info("VSD Craft integrated bridge manager started.");
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 10_000);
    this.timer.unref();
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    if (this.busy || this.stopped) return;
    if (this.dependencies.healthy()) {
      this.markConnected();
      return;
    }
    if (this.state === "connected") {
      this.state = "checking";
      this.detail = "接続が切れました。再接続を確認しています。";
    }
    if (this.dependencies.now() < this.retryAt) return;
    this.busy = true;
    try {
      const inspection = await this.dependencies.inspect();
      if (this.stopped) return;
      if (this.dependencies.healthy()) {
        this.markConnected();
        return;
      }
      const autoStart = this.initial && inspection === "stopped";
      this.initial = false;
      this.state = inspection;
      this.detail = inspection === "restart-required"
        ? "接続にはCodexの再起動が必要です。「接続・復旧」から実行できます。"
        : inspection === "stopped" ? "Codexは終了しています。「接続・復旧」で起動できます。" : "再接続しています。";
      if (autoStart || inspection === "connectable") await this.connect(false);
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
  }

  async recover(): Promise<void> {
    if (this.busy || this.stopped) return;
    this.busy = true;
    this.initial = false;
    try { await this.connect(true); }
    catch (error) { this.fail(error); }
    finally { this.busy = false; }
  }

  private async connect(interactive: boolean): Promise<void> {
    this.dependencies.logger.info(`VSD Craft bridge connection requested (${interactive ? "user recovery" : "automatic"}).`);
    this.state = "connecting";
    this.detail = interactive ? "接続処理中。再起動の確認が表示された場合は内容をご確認ください。" : "接続しています。";
    await this.dependencies.connect(interactive);
    this.retryAt = this.dependencies.now() + 30_000;
    this.state = "checking";
    this.detail = "接続結果を確認しています。";
  }

  private fail(error: unknown): void {
    this.state = "error";
    this.detail = "接続できませんでした。「接続・復旧」で再試行できます。";
    this.retryAt = this.dependencies.now() + 30_000;
    this.dependencies.logger.warn(`VSD Craft bridge: ${String(error)}`);
  }

  private markConnected(): void {
    if (this.state !== "connected") this.dependencies.logger.info("VSD Craft integrated bridge connected; live snapshots are updating.");
    this.initial = false;
    this.state = "connected";
    this.detail = "接続済み。ボタンと使用量を更新しています。";
  }
}

function parseInspectionState(stdout: string): BridgeInspection {
  const result = JSON.parse(stdout) as { state?: string };
  if (result.state !== "stopped" && result.state !== "connectable" && result.state !== "restart-required") {
    throw new Error("Unexpected bridge inspection state");
  }
  return result.state;
}

function createWindowsVsdBridgeManager(root: string, logger: DeckLogger, healthy: () => boolean): VsdBridgeManager {
  const shell = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const run = (filename: string, args: string[], interactive = false): Promise<string> => new Promise((resolve, reject) => {
    execFile(shell, ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "launcher", filename), "-NodePath", process.execPath, ...args],
      { windowsHide: true, timeout: interactive ? 0 : 60_000, maxBuffer: 128 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  return new VsdBridgeManager({
    logger, healthy, now: Date.now,
    inspect: async () => parseInspectionState(await run("Start-CodexDeck.ps1", ["-Inspect"])),
    connect: async (interactive) => { await run(interactive ? "Connect-VSDCraftBridge.ps1" : "Start-CodexDeck.ps1", [], interactive); }
  });
}

function createMacOsVsdBridgeManager(root: string, logger: DeckLogger, healthy: () => boolean): VsdBridgeManager | undefined {
  const runtime = join(root, "launcher", "codex-deck-macos.mjs");
  if (!existsSync(runtime)) return;
  const run = (command: string, interactive = false): Promise<string> => new Promise((resolve, reject) => {
    execFile(process.execPath, [runtime, command],
      { timeout: interactive ? 0 : 60_000, maxBuffer: 128 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  return new VsdBridgeManager({
    logger, healthy, now: Date.now,
    inspect: async () => parseInspectionState(await run("inspect")),
    connect: async (interactive) => { await run(interactive ? "connect" : "start", interactive); }
  });
}

export function createVsdBridgeManager(
  logger: DeckLogger,
  healthy: () => boolean,
  options: { platform?: NodeJS.Platform; root?: string } = {}
): VsdBridgeManager | undefined {
  const root = options.root ?? fileURLToPath(new URL("../", import.meta.url));
  if (!existsSync(join(root, "vsd-bridge-managed.json"))) return;
  const platform = options.platform ?? process.platform;
  if (platform === "win32") return createWindowsVsdBridgeManager(root, logger, healthy);
  if (platform === "darwin") return createMacOsVsdBridgeManager(root, logger, healthy);
}
