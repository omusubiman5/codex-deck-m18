import { M18_ACTION_CATALOG, type M18ActionSpec } from "./action-catalog.js";

export const M18_SCENE_COUNT = 3;
export const M18_LCD_KEYS_PER_SCENE = 15;

export const M18_SCENES: readonly (readonly M18ActionSpec[])[] = [
  M18_ACTION_CATALOG.slice(0, 15),
  M18_ACTION_CATALOG.slice(15, 30),
  M18_ACTION_CATALOG.slice(30, 45)
];

export function assertM18Layout(): void {
  if (M18_SCENES.length !== M18_SCENE_COUNT) throw new Error("M18 requires exactly three scenes.");
  if (M18_SCENES.some((scene) => scene.length !== M18_LCD_KEYS_PER_SCENE)) {
    throw new Error("Every M18 scene must contain exactly 15 LCD actions.");
  }
  const flattened = M18_SCENES.flat();
  if (flattened.length !== 45 || new Set(flattened.map((action) => action.id)).size !== 45) {
    throw new Error("The M18 layout must contain 45 unique actions.");
  }
}

assertM18Layout();
