import type { DeckSurfaceAction } from "./deck-runtime.js";

export class RegistrationImageWriter {
  private readonly generations = new Map<string, number>();
  private readonly lastImages = new Map<string, string>();
  private readonly writes = new Map<string, Promise<void>>();

  register(actionId: string): number {
    const generation = (this.generations.get(actionId) ?? 0) + 1;
    this.generations.set(actionId, generation);
    this.lastImages.delete(actionId);
    return generation;
  }

  unregister(actionId: string): void {
    this.generations.set(actionId, (this.generations.get(actionId) ?? 0) + 1);
    this.lastImages.delete(actionId);
  }

  current(actionId: string): number | undefined {
    return this.generations.get(actionId);
  }

  async write(
    action: DeckSurfaceAction,
    image: string,
    title: string,
    generation: number | undefined
  ): Promise<void> {
    if (generation == null) return;
    const previous = this.writes.get(action.id) ?? Promise.resolve();
    const write = previous.catch(() => {}).then(async () => {
      if (this.generations.get(action.id) !== generation) return;
      const signature = `${title}\n${image}`;
      if (this.lastImages.get(action.id) === signature) return;
      await Promise.all([action.setImage(image), action.setTitle(title)]);
      if (this.generations.get(action.id) === generation) this.lastImages.set(action.id, signature);
    });
    this.writes.set(action.id, write);
    try { await write; }
    finally { if (this.writes.get(action.id) === write) this.writes.delete(action.id); }
  }
}
