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

type Pending = { resolve(): void; reject(error: Error): void; timer: NodeJS.Timeout };

export type M18EventHandler = (event: Extract<AdapterEvent, { type: "key_down" | "key_up" }>) => void | Promise<void>;
export type M18AdapterClientOptions = {
  executable?: string;
  args?: string[];
  commandTimeoutMs?: number;
  onDisconnect?: (error: Error) => void;
};

export class M18AdapterClient {
  private child?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private stopping = false;
  private disconnectNotified = false;

  constructor(
    private readonly onInput: M18EventHandler,
    private readonly log: (message: string) => void,
    private readonly options: M18AdapterClientOptions = {}
  ) {}

  async start(): Promise<Extract<AdapterEvent, { type: "ready" }>> {
    if (this.child) throw new Error("M18 adapter is already running.");
    this.stopping = false;
    this.disconnectNotified = false;
    const executable = this.options.executable ?? process.env.CODEX_DECK_M18_ADAPTER ?? defaultAdapterPath();
    const child = spawn(executable, this.options.args ?? [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => this.log(chunk.trimEnd()));

    const lines = createInterface({ input: child.stdout });
    return await new Promise((resolveReady, rejectReady) => {
      let ready = false;
      const fail = (error: Error): void => {
        this.failAll(error, child);
        if (!ready) rejectReady(error);
        else this.notifyDisconnect(error);
      };
      child.once("error", fail);
      child.once("exit", (code, signal) => fail(new Error(
        ready
          ? `M18 adapter exited (${code ?? signal ?? "unknown"}).`
          : `M18 adapter exited before ready (${code ?? signal ?? "unknown"}).`
      )));
      lines.on("line", (line) => {
        let event: AdapterEvent;
        try { event = JSON.parse(line) as AdapterEvent; }
        catch { this.log(`Ignoring invalid adapter output: ${line}`); return; }
        if (event.type === "ready") {
          ready = true;
          resolveReady(event);
        } else if (event.type === "ack") {
          const pending = this.pending.get(event.id);
          this.pending.delete(event.id);
          if (pending) clearTimeout(pending.timer);
          pending?.resolve();
        } else if (event.type === "error") {
          if (event.id != null) {
            const pending = this.pending.get(event.id);
            this.pending.delete(event.id);
            if (pending) clearTimeout(pending.timer);
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
    this.stopping = true;
    const child = this.child;
    try { await this.command({ type: "shutdown" }); }
    catch { if (!child.killed) child.kill(); }
    finally { if (this.child === child) this.child = undefined; }
  }

  private command(command: Record<string, unknown>): Promise<void> {
    const child = this.child;
    if (!child?.stdin.writable) return Promise.reject(new Error("M18 adapter is not connected."));
    const id = this.nextId++;
    return new Promise<void>((resolveCommand, rejectCommand) => {
      const timeoutMs = this.options.commandTimeoutMs ?? 5_000;
      const timer = setTimeout(() => {
        const error = new Error(`M18 adapter command timed out after ${timeoutMs} ms.`);
        this.failAll(error, child);
        this.notifyDisconnect(error);
        if (!child.killed) child.kill();
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveCommand, reject: rejectCommand, timer });
      child.stdin.write(`${JSON.stringify({ id, ...command })}\n`, (error) => {
        if (!error) return;
        this.failAll(error, child);
        this.notifyDisconnect(error);
        if (!child.killed) child.kill();
      });
    });
  }

  private failAll(error: Error, expected?: ChildProcessWithoutNullStreams): void {
    if (expected && this.child !== expected) return;
    this.child = undefined;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private notifyDisconnect(error: Error): void {
    if (this.stopping || this.disconnectNotified) return;
    this.disconnectNotified = true;
    this.options.onDisconnect?.(error);
  }
}

function defaultAdapterPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const executable = process.platform === "win32" ? "codex-deck-m18-adapter.exe" : "codex-deck-m18-adapter";
  return resolve(here, executable);
}
