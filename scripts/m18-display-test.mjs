import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const adapterPath = process.argv[2];
if (!adapterPath) throw new Error("Adapter path is required.");

const child = spawn(adapterPath, [], { stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
const lines = createInterface({ input: child.stdout });
let nextId = 1;
const pending = new Map();

function command(body) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ id, ...body })}\n`);
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function testImage(key) {
  const colors = ["#ff1744", "#00e676", "#2979ff"];
  const background = colors[Math.floor(key / 5)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${background}"/><rect x="3" y="3" width="58" height="58" fill="none" stroke="#fff" stroke-width="4"/><text x="32" y="42" text-anchor="middle" font-family="Arial" font-size="30" font-weight="900" fill="#fff">${key + 1}</text></svg>`;
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

lines.on("line", async (line) => {
  const event = JSON.parse(line);
  if (event.type === "ack" || event.type === "error") {
    const request = pending.get(event.id);
    pending.delete(event.id);
    if (event.type === "ack") request?.resolve();
    else request?.reject(new Error(event.message));
    return;
  }
  if (event.type !== "ready") return;
  console.log(`READY serial-path adapter=${adapterPath} device=${event.name} vid=${event.vid} pid=${event.pid}`);
  await command({ type: "set_brightness", brightness: 100 });
  for (let key = 0; key < 15; key += 1) {
    await command({ type: "set_image", key, image: testImage(key) });
    console.log(`DISPLAY_TEST_ACK key=${key} label=${key + 1}`);
  }
  console.log("DISPLAY_TEST_READY red=1-5 green=6-10 blue=11-15");
});

child.once("exit", (code) => process.exit(code ?? 1));
setInterval(() => {}, 60_000);
