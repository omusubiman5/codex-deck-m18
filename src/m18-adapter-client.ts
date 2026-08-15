import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type AdapterEvent =
  | { type: "ready"; name: string; vid: number; pid: number }
  | { type: "key_down"; key: number }
  | { type: "key_up"; key: number }
  | { type: "ack"; id: number }
  | { type: "error"; id?: number; message: string };

type Pending = { resolve(): void; reject(error: Error): void };

export type M18EventHandler = (event: Extract<AdapterEvent, { type: "key_down" | "key_up" }>) => void | Promise<void>;

export class M18AdapterClient {
  private child?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(
    private readonly onInput: M18EventHandler,
    private readonly log: (message: string) => void
  ) {}

  async start(): Promise<Extract<AdapterEvent, { type: "ready" }>> {
    if (this.child) throw new Error("M18 adapter is already running.");
    const executable = process.env.CODEX_DECK_M18_ADAPTER || defaultAdapterPath();
    const child = spawn(executable, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => this.log(chunk.trimEnd()));
    child.once("exit", (code, signal) => this.failAll(new Error(`M18 adapter exited (${code ?? signal ?? "unknown"}).`)));

    const lines = createInterface({ input: child.stdout });
    return await new Promise((resolveReady, rejectReady) => {
      const onSpawnError = (error: Error): void => rejectReady(error);
      const onEarlyExit = (code: number | null, signal: NodeJS.Signals | null): void =>
        rejectReady(new Error(`M18 adapter exited before ready (${code ?? signal ?? "unknown"}).`));
      child.once("error", onSpawnError);
      child.once("exit", onEarlyExit);
      lines.on("line", (line) => {
        let event: AdapterEvent;
        try { event = JSON.parse(line) as AdapterEvent; }
        catch { this.log(`Ignoring invalid adapter output: ${line}`); return; }
        if (event.type === "ready") {
          child.off("error", onSpawnError);
          child.off("exit", onEarlyExit);
          resolveReady(event);
        } else if (event.type === "ack") {
          const pending = this.pending.get(event.id);
          this.pending.delete(event.id);
          pending?.resolve();
        } else if (event.type === "error") {
          if (event.id != null) {
            const pending = this.pending.get(event.id);
            this.pending.delete(event.id);
            pending?.reject(new Error(event.message));
          } else this.log(`M18 adapter: ${event.message}`);
        } else void Promise.resolve(this.onInput(event)).catch((error) => this.log(`M18 input failed: ${String(error)}`));
      });
    });
  }

  setImage(key: number, image: string): Promise<void> {
    return this.command({ type: "set_image", key, image });
  }

  setBrightness(brightness: number): Promise<void> {
    return this.command({ type: "set_brightness", brightness });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    try { await this.command({ type: "shutdown" }); } catch {}
    this.child = undefined;
  }

  private command(command: Record<string, unknown>): Promise<void> {
    const child = this.child;
    if (!child?.stdin.writable) return Promise.reject(new Error("M18 adapter is not connected."));
    const id = this.nextId++;
    return new Promise<void>((resolveCommand, rejectCommand) => {
      this.pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
      child.stdin.write(`${JSON.stringify({ id, ...command })}\n`, (error) => {
        if (!error) return;
        this.pending.delete(id);
        rejectCommand(error);
      });
    });
  }

  private failAll(error: Error): void {
    this.child = undefined;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

function defaultAdapterPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const executable = process.platform === "win32" ? "codex-deck-m18-adapter.exe" : "codex-deck-m18-adapter";
  return resolve(here, executable);
}
