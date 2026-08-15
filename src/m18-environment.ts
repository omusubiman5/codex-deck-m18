export type M18Environment = 1 | 2 | 3;
export type CodexM18Environment = 1 | 2;

export function environmentForButton(key: number): M18Environment | undefined {
  return key >= 15 && key <= 17 ? (key - 14) as M18Environment : undefined;
}

export function savedCodexEnvironment(value: string | undefined): CodexM18Environment {
  return value?.trim() === "2" ? 2 : 1;
}
