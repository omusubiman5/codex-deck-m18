import { appendFileSync, existsSync, renameSync, statSync, unlinkSync } from "node:fs";

export function appendRotatingLogSync(path: string, line: string, maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("Log size limit must be a positive integer.");
  const bytes = Buffer.byteLength(line, "utf8");
  if (existsSync(path) && statSync(path).size + bytes > maxBytes) {
    const previous = `${path}.previous`;
    if (existsSync(previous)) unlinkSync(previous);
    renameSync(path, previous);
  }
  appendFileSync(path, line, "utf8");
}
