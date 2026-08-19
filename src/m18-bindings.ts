import type { DeckSurfaceAction } from "./deck-runtime.js";

export type Binding = {
  register?(action: DeckSurfaceAction): void;
  unregister?(action: DeckSurfaceAction): void;
  down(): Promise<void>;
  up?(): Promise<void>;
};

type TapOrHoldOptions = {
  holdMs: number;
  tap(): Promise<void>;
  holdDown(): Promise<void>;
  holdUp(): Promise<void>;
  onError(error: unknown): void;
};

export function createTapOrHoldBinding(options: TapOrHoldOptions): Binding {
  let pressed = false;
  let held = false;
  let timer: NodeJS.Timeout | undefined;
  let holdPromise: Promise<void> | undefined;

  return {
    down: async () => {
      if (pressed) return;
      pressed = true;
      timer = setTimeout(() => {
        timer = undefined;
        held = true;
        holdPromise = options.holdDown().catch(options.onError);
      }, options.holdMs);
    },
    up: async () => {
      if (!pressed) return;
      pressed = false;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
        await options.tap();
        return;
      }
      if (held) {
        held = false;
        await holdPromise;
        holdPromise = undefined;
        await options.holdUp();
      }
    }
  };
}
