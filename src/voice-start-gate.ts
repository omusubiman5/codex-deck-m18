export type VoiceConversationStartResult = "started" | "already-active" | "suppressed";

export class VoiceStartGate {
  private inFlight?: Promise<VoiceConversationStartResult>;
  private settlingUntil = 0;

  constructor(
    private readonly settlingMs = 5_000,
    private readonly now: () => number = Date.now
  ) {}

  run(operation: () => Promise<VoiceConversationStartResult>): Promise<VoiceConversationStartResult> {
    if (this.inFlight || this.now() < this.settlingUntil) return Promise.resolve("suppressed");
    const pending = operation();
    this.inFlight = pending;
    return pending.then((result) => {
      if (result === "started") this.settlingUntil = this.now() + this.settlingMs;
      return result;
    }).finally(() => {
      if (this.inFlight === pending) this.inFlight = undefined;
    });
  }
}
