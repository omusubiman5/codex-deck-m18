export interface DeckSurfaceAction {
  readonly id: string;
  setImage(image: string): Promise<void>;
  setTitle(title: string): Promise<void>;
}

export interface DeckLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface DeckRuntime {
  readonly logger: DeckLogger;
  getGlobalSettings<T>(): Promise<T>;
}
