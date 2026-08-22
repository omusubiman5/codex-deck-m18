import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import sharp from "sharp";
import { renderAgentKey } from "../src/render.js";

const adapterPath = process.argv[2];
if (!adapterPath) throw new Error("Adapter path is required.");

const child = spawn(adapterPath, [], { stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
const lines = createInterface({ input: child.stdout });
let nextId = 1;
const pending = new Map<number, { resolve(): void; reject(error: Error): void }>();

function command(body: Record<string, unknown>): Promise<void> {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ id, ...body })}\n`);
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function rgbImage(key: number): string {
  const colors = ["#ff1744", "#00e676", "#2979ff"];
  const background = colors[Math.floor(key / 5)]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${background}"/><rect x="3" y="3" width="58" height="58" fill="none" stroke="#fff" stroke-width="4"/><text x="32" y="42" text-anchor="middle" font-family="Arial" font-size="30" font-weight="900" fill="#fff">${key + 1}</text></svg>`;
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

async function rasterizedAgentImage(): Promise<string> {
  const dataUrl = renderAgentKey(0, "NORMAL UI", "idle", true, 0, "light", "W", "ready", 35, true, "DISPLAY TEST");
  const svg = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const png = await sharp(Buffer.from(svg, "utf8"))
    .resize(64, 64, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

lines.on("line", async (line) => {
  const event = JSON.parse(line) as { type: string; id?: number; message?: string; name?: string };
  if (event.type === "ack" || event.type === "error") {
    const request = event.id == null ? undefined : pending.get(event.id);
    if (event.id != null) pending.delete(event.id);
    if (event.type === "ack") request?.resolve();
    else request?.reject(new Error(event.message));
    return;
  }
  if (event.type !== "ready") return;
  console.log(`READY adapter=${adapterPath} device=${event.name}`);
  await command({ type: "set_brightness", brightness: 100 });
  const normalImage = await rasterizedAgentImage();
  for (let key = 0; key < 15; key += 1) {
    const image = key === 0
      ? normalImage
      : rgbImage(key);
    await command({ type: "set_image", key, image });
    console.log(`PRODUCTION_FRAME_TEST_ACK key=${key} kind=${key === 0 ? "opaque-64px-png" : "rgb-control"}`);
  }
  console.log("PRODUCTION_FRAME_TEST_READY key1=normal-ui keys2-15=rgb-control");
});

child.once("exit", (code) => process.exit(code ?? 1));
setInterval(() => {}, 60_000);
