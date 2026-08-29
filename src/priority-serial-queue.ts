export type TaskPriority = "command" | "snapshot";

type QueuedTask = {
  operation: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export class PrioritySerialQueue {
  private readonly commands: QueuedTask[] = [];
  private readonly snapshots: QueuedTask[] = [];
  private running = false;
  private closedError?: Error;

  run<T>(priority: TaskPriority, operation: () => Promise<T>): Promise<T> {
    if (this.closedError) return Promise.reject(this.closedError);
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask = {
        operation,
        resolve: (value) => resolve(value as T),
        reject
      };
      (priority === "command" ? this.commands : this.snapshots).push(task);
      void this.drain();
    });
  }

  close(error = new Error("Task queue was closed.")): void {
    if (this.closedError) return;
    this.closedError = error;
    for (const task of [...this.commands.splice(0), ...this.snapshots.splice(0)]) task.reject(error);
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.closedError) {
        const task = this.commands.shift() ?? this.snapshots.shift();
        if (!task) return;
        try { task.resolve(await task.operation()); }
        catch (error) { task.reject(error); }
      }
    } finally {
      this.running = false;
    }
  }
}
