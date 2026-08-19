import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckLogger } from "./deck-runtime.js";

export function startWindowsBridgeSupervisor(logger: DeckLogger): void {
  if (process.platform !== "win32") return;

  const packagedWatcher = fileURLToPath(new URL("../launcher/Watch-CodexDeck.ps1", import.meta.url));
  const installedWatcher = join(
    process.env.LOCALAPPDATA ?? "",
    "CodexDeck",
    "launcher",
    "Watch-CodexDeck.ps1"
  );
  const watcher = [packagedWatcher, installedWatcher].find((candidate) => existsSync(candidate));
  if (!watcher) {
    logger.warn("Codex Deck bridge supervisor is unavailable; the Windows launcher bundle is missing.");
    return;
  }

  try {
    const child = spawn(
      join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      [
        "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
        "-File", watcher
      ],
      { stdio: "ignore", windowsHide: true }
    );
    child.once("error", (error) => {
      logger.warn(`Codex Deck bridge supervisor failed: ${String(error)}`);
    });
    child.once("exit", (code, signal) => {
      if (code !== 0) {
        logger.warn(`Codex Deck bridge supervisor exited unexpectedly (code=${String(code)}, signal=${String(signal)}).`);
      }
    });
    logger.info("Codex Deck bridge observer requested without automatic recovery permission.");
  } catch (error) {
    logger.warn(`Codex Deck bridge supervisor could not be started: ${String(error)}`);
  }
}
