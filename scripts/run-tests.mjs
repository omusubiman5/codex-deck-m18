import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const tests = (await readdir(resolve("test")))
  .filter((filename) => filename.endsWith(".test.ts"))
  .sort()
  .map((filename) => resolve("test", filename));

if (tests.length === 0) throw new Error("No test files were found.");

const child = spawn(process.execPath, ["--import", "tsx", "--test", ...tests], {
  stdio: "inherit"
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) console.error(`Test runner terminated by ${signal}.`);
  process.exitCode = code ?? 1;
});
