import type { DeckSurfaceAction } from "./deck-runtime.js";
import type { Binding } from "./m18-bindings.js";

export class M18SceneController {
  private activeScene = 0;

  constructor(
    private readonly scenes: readonly (readonly Binding[])[],
    private readonly lcdActions: readonly DeckSurfaceAction[]
  ) {
    if (scenes.length !== 3 || scenes.some((scene) => scene.length !== 15) || lcdActions.length !== 15) {
      throw new Error("M18SceneController requires three 15-key scenes and 15 LCD surfaces.");
    }
  }

  mount(): void {
    this.registerScene(this.activeScene);
  }

  currentScene(): number {
    return this.activeScene;
  }

  bindingForLcd(key: number): Binding | undefined {
    return this.scenes[this.activeScene]?.[key];
  }

  selectScene(scene: number): void {
    if (!Number.isInteger(scene) || scene < 0 || scene >= this.scenes.length) return;
    if (scene === this.activeScene) return;
    this.unregisterScene(this.activeScene);
    this.activeScene = scene;
    this.registerScene(scene);
  }

  unmount(): void {
    this.unregisterScene(this.activeScene);
  }

  private registerScene(scene: number): void {
    this.scenes[scene]!.forEach((binding, key) => binding.register?.(this.lcdActions[key]!));
  }

  private unregisterScene(scene: number): void {
    this.scenes[scene]!.forEach((binding, key) => binding.unregister?.(this.lcdActions[key]!));
  }
}
