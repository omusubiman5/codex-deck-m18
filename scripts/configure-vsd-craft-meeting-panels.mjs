import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const appData = process.env.APPDATA;
if (!appData) throw new Error("APPDATA is not available.");

const profileRoot = join(appData, "HotSpot", "StreamDock", "profiles");
const artworkRoot = join(process.cwd(), "static", "imgs", "meeting-panels", "generated");
const backupRoot = join(
  appData,
  "CodexDeck",
  "backups",
  `vsd-craft-meeting-panels-${new Date().toISOString().replaceAll(":", "-")}`
);

const panels = [
  {
    sourceName: "シーン 1",
    name: "TEAMS",
    color: "#5B5FC7",
    accent: "#8B8CC7",
    artwork: "teams.png",
    actions: [
      ["自分ミュート", "Ctrl Shift M", "M", { ctrl: true, shift: true }],
      ["音量 −", "SYSTEM", "VOLDOWN", {}],
      ["音量 ＋", "SYSTEM", "VOLUP", {}],
      ["マイク −", "INPUT", null, {}, "mic-input-down"],
      ["マイク ＋", "INPUT", null, {}, "mic-input-up"],
      ["カメラ", "Ctrl Shift O", "O", { ctrl: true, shift: true }],
      ["画面共有", "Ctrl Shift E", "E", { ctrl: true, shift: true }],
      ["挙手", "Ctrl Shift K", "K", { ctrl: true, shift: true }],
      ["チャット", "Ctrl Shift R", "R", { ctrl: true, shift: true }],
      ["設定", "APP", null, {}, "settings"],
      ["全員ミュート", "ADMIN", null, {}, "mute-all"],
      ["録画 開始/停止", "ADMIN", null, {}, "record-toggle"],
      ["録画 一時停止", "ADMIN", null, {}, "record-pause"],
      ["参加", "Ctrl Shift J", "J", { ctrl: true, shift: true }],
      ["通話終了", "Ctrl Shift H", "H", { ctrl: true, shift: true }, "danger"]
    ]
  },
  {
    sourceName: "シーン 2",
    name: "MEET",
    color: "#00897B",
    accent: "#00AC47",
    artwork: "meet.png",
    actions: [
      ["自分ミュート", "Ctrl D", "D", { ctrl: true }],
      ["音量 −", "SYSTEM", "VOLDOWN", {}],
      ["音量 ＋", "SYSTEM", "VOLUP", {}],
      ["マイク −", "INPUT", null, {}, "mic-input-down"],
      ["マイク ＋", "INPUT", null, {}, "mic-input-up"],
      ["カメラ", "Ctrl E", "E", { ctrl: true }],
      ["画面共有", "Ctrl Alt T", "T", { ctrl: true, alt: true }],
      ["挙手", "Ctrl Alt H", "H", { ctrl: true, alt: true }],
      ["チャット", "Ctrl Alt C", "C", { ctrl: true, alt: true }],
      ["設定", "APP", null, {}, "settings"],
      ["全員ミュート", "ADMIN", null, {}, "mute-all"],
      ["録画 開始/停止", "ADMIN", null, {}, "record-toggle"],
      ["録画 一時停止", "ADMIN", null, {}, "record-pause"],
      ["参加", "APP", null, {}, "join"],
      ["通話終了", "Ctrl W", "W", { ctrl: true }, "danger"]
    ]
  },
  {
    sourceName: "シーン 3",
    name: "ZOOM",
    color: "#2D8CFF",
    accent: "#0B5CFF",
    artwork: "zoom.png",
    actions: [
      ["自分ミュート", "Alt A", "A", { alt: true }],
      ["音量 −", "SYSTEM", "VOLDOWN", {}],
      ["音量 ＋", "SYSTEM", "VOLUP", {}],
      ["マイク −", "INPUT", null, {}, "mic-input-down"],
      ["マイク ＋", "INPUT", null, {}, "mic-input-up"],
      ["カメラ", "Alt V", "V", { alt: true }],
      ["画面共有", "Alt S", "S", { alt: true }],
      ["挙手", "Alt Y", "Y", { alt: true }],
      ["チャット", "Alt H", "H", { alt: true }],
      ["設定", "APP", null, {}, "settings"],
      ["全員ミュート", "Alt M", "M", { alt: true }],
      ["録画 開始/停止", "Alt R", "R", { alt: true }, "record"],
      ["録画 一時停止", "Alt P", "P", { alt: true }, "record"],
      ["参加", "APP", null, {}, "join"],
      ["通話終了", "Alt Q", "Q", { alt: true }, "danger"]
    ]
  },
  {
    sourceName: "シーン 4",
    name: "Discord",
    color: "#5865F2",
    accent: "#7289DA",
    artwork: "discord.png",
    actions: [
      ["自分ミュート", "Ctrl Shift M", "M", { ctrl: true, shift: true }],
      ["音量 −", "SYSTEM", "VOLDOWN", {}],
      ["音量 ＋", "SYSTEM", "VOLUP", {}],
      ["マイク −", "INPUT", null, {}, "mic-input-down"],
      ["マイク ＋", "INPUT", null, {}, "mic-input-up"],
      ["カメラ", "APP", null, {}, "camera"],
      ["画面共有", "APP", null, {}, "share"],
      ["挙手", "APP", null, {}, "hand"],
      ["チャット", "APP", null, {}, "chat"],
      ["設定", "Ctrl ,", "COMMA", { ctrl: true }],
      ["全員ミュート", "ADMIN", null, {}, "mute-all"],
      ["録画 開始/停止", "LOCAL", null, {}, "record-toggle"],
      ["録画 一時停止", "LOCAL", null, {}, "record-pause"],
      ["参加", "Ctrl Enter", "ENTER", { ctrl: true }],
      ["通話終了", "Esc", "ESC", {}, "danger"]
    ]
  }
];

const vk = {
  SPACE: 32, ENTER: 13, ESC: 27, UP: 38, DOWN: 40,
  F1: 112, F2: 113, F11: 122,
  VOLDOWN: 174, VOLUP: 175,
  COMMA: 188, PERIOD: 190, SLASH: 191, BACKSLASH: 220
};
for (let code = 65; code <= 90; code += 1) vk[String.fromCharCode(code)] = code;

function xml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function hotkey(key, modifiers = {}) {
  const code = vk[key];
  if (code == null) throw new Error(`Unsupported key: ${key}`);
  return {
    KeyCmd: false,
    KeyCtrl: Boolean(modifiers.ctrl),
    KeyModifiers: 65536,
    KeyOption: Boolean(modifiers.alt),
    KeyShift: Boolean(modifiers.shift),
    NativeCode: -1,
    QTKeyCode: -1,
    RKeyCmd: false,
    RKeyCtrl: false,
    RKeyOption: false,
    RKeyShift: false,
    VKeyCode: code
  };
}

function emptyHotkey() {
  return {
    KeyCmd: false, KeyCtrl: false, KeyModifiers: 65536, KeyOption: false, KeyShift: false,
    NativeCode: -1, QTKeyCode: -1, RKeyCmd: false, RKeyCtrl: false,
    RKeyOption: false, RKeyShift: false, VKeyCode: -1
  };
}

function actionId(panelIndex, actionIndex) {
  return `meeting-${panelIndex + 1}-${String(actionIndex + 1).padStart(2, "0")}-codex-deck`;
}

async function writeIcon(path, panel, label, tone, index) {
  const column = index % 5;
  const visualRow = Math.floor(index / 5);
  const artworkPath = join(artworkRoot, panel.artwork);
  if (!existsSync(artworkPath)) throw new Error(`Missing generated artwork: ${artworkPath}`);
  const tile = await sharp(artworkPath)
    .resize(1440, 864, { fit: "fill" })
    .extract({ left: column * 288, top: visualRow * 288, width: 288, height: 288 })
    .png()
    .toBuffer();
  const labelFill =
    index === 10 || index === 11 || index === 14 ? "#7F1D1DEE" :
    index === 12 ? "#78350FEE" :
    index === 13 ? "#14532DEE" :
    visualRow === 0 ? "#111827E8" : "#172554E8";
  const fontSize = label.length >= 9 ? 18 : label.length >= 7 ? 20 : 23;
  const svg = `
    <svg width="288" height="288" viewBox="0 0 288 288" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="226" width="260" height="48" rx="17" fill="${labelFill}" stroke="${panel.accent}" stroke-width="2"/>
      <text x="144" y="258" text-anchor="middle" fill="#FFFFFF" font-family="Yu Gothic UI, Meiryo UI, Segoe UI, sans-serif" font-size="${fontSize}" font-weight="800">${xml(label)}</text>
    </svg>`;
  await sharp(tile).composite([{ input: Buffer.from(svg) }]).png().toFile(path);
}

const customKinds = new Set([
  "mic-input-down", "mic-input-up", "settings", "mute-all",
  "record-toggle", "record-pause", "join", "camera", "share", "hand", "chat"
]);

const dirs = await readdir(profileRoot, { withFileTypes: true });
const profiles = [];
for (const dir of dirs) {
  if (!dir.isDirectory() || !dir.name.endsWith(".sdProfile")) continue;
  const manifestPath = join(profileRoot, dir.name, "manifest.json");
  if (!existsSync(manifestPath)) continue;
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    profiles.push({ dir: join(profileRoot, dir.name), manifestPath, manifest });
  } catch {
    // Ignore unrelated or incomplete vendor profiles.
  }
}

await mkdir(backupRoot, { recursive: true });

for (let panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
  const panel = panels[panelIndex];
  const candidates = profiles.filter(({ manifest }) =>
    manifest.Name === panel.sourceName || manifest.Name === panel.name
  );
  if (candidates.length !== 1) {
    throw new Error(`Expected one VSD Craft profile named ${panel.sourceName}; found ${candidates.length}.`);
  }

  const profile = candidates[0];
  await cp(profile.dir, join(backupRoot, basename(profile.dir)), { recursive: true });
  const imageDir = join(profile.dir, "Images");
  await mkdir(imageDir, { recursive: true });

  const actions = {};
  for (let index = 0; index < panel.actions.length; index += 1) {
    const [label, shortcut, key, modifiers, tone] = panel.actions[index];
    const column = index % 5;
    // VSD Craft stores M18 rows bottom-up while the editor renders them top-down.
    const row = 2 - Math.floor(index / 5);
    const imageName = `meeting-${String(index + 1).padStart(2, "0")}.png`;
    await writeIcon(join(imageDir, imageName), panel, label, tone, index);
    const custom = customKinds.has(tone);
    actions[`${column},${row}`] = {
      ActionID: actionId(panelIndex, index),
      Controller: "Keypad",
      Name: `${panel.name} · ${label}`,
      Settings: custom ? { meetingApp: panel.name } : {
        Coalesce: true,
        Hotkeys: [hotkey(key, modifiers), emptyHotkey(), emptyHotkey()],
        hotkeyRadioButtonIndex: 0
      },
      State: 0,
      States: [{ Image: imageName, Title: "" }],
      UUID: custom
        ? `com.simeo.codex-deck.meeting-${tone}`
        : "com.hotspot.streamdock.system.hotkey"
    };
  }

  profile.manifest.Name = panel.name;
  profile.manifest.Actions = actions;
  profile.manifest.AppIdentifier = profile.manifest.AppIdentifier ?? "";
  profile.manifest.AppIdentifier0 = profile.manifest.AppIdentifier0 ?? "";
  profile.manifest.AppIdentifier1 = profile.manifest.AppIdentifier1 ?? "";
  profile.manifest.AppIdentifier2 = profile.manifest.AppIdentifier2 ?? "";
  await writeFile(profile.manifestPath, `${JSON.stringify(profile.manifest, null, 4)}\n`, "utf8");
  console.log(`${panel.name}: ${profile.dir}`);
}

console.log(`Backup: ${backupRoot}`);
