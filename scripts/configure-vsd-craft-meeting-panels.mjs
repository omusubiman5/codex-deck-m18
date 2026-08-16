import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const appData = process.env.APPDATA;
if (!appData) throw new Error("APPDATA is not available.");

const profileRoot = join(appData, "HotSpot", "StreamDock", "profiles");
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
  const danger = index === 10 || index === 11 || index === 14;
  const warning = index === 12;
  const positive = index === 13;
  const surface = danger ? "#3A171B" : warning ? "#352711" : positive ? "#123222" : "#202124";
  const border = danger ? "#F04444" : warning ? "#F9AB00" : positive ? "#34A853" : panel.color;
  const glyph = meetingGlyph(index);
  const fontSize = label.length >= 9 ? 18 : label.length >= 7 ? 20 : 22;
  const brandStripe = panel.name === "MEET"
    ? '<path d="M24 18h60v7H24z" fill="#00832D"/><path d="M84 18h60v7H84z" fill="#1A73E8"/><path d="M144 18h60v7H144z" fill="#F9AB00"/><path d="M204 18h60v7H204z" fill="#D93025"/>'
    : `<rect x="24" y="18" width="240" height="7" rx="3.5" fill="${panel.color}"/>`;
  const svg = `
    <svg width="288" height="288" viewBox="0 0 288 288" xmlns="http://www.w3.org/2000/svg">
      <rect width="288" height="288" rx="34" fill="#111214"/>
      <rect x="10" y="10" width="268" height="268" rx="28" fill="${surface}" stroke="${border}" stroke-width="4"/>
      ${brandStripe}
      <text x="144" y="52" text-anchor="middle" fill="#E8EAED" font-family="Segoe UI, Yu Gothic UI, sans-serif" font-size="18" font-weight="700" letter-spacing="1.6">${xml(panel.name)}</text>
      <g transform="translate(64 58)" fill="none" stroke="#F8F9FA" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
      <rect x="20" y="224" width="248" height="46" rx="14" fill="#0D0E10" fill-opacity=".92"/>
      <text x="144" y="255" text-anchor="middle" fill="#FFFFFF" font-family="Yu Gothic UI, Meiryo UI, Segoe UI, sans-serif" font-size="${fontSize}" font-weight="700">${xml(label)}</text>
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path);
}

function meetingGlyph(index) {
  const badge = (mark) => `<circle cx="132" cy="126" r="25" fill="#202124" stroke="currentColor"/><path d="${mark}"/>`;
  const icons = [
    '<rect x="61" y="8" width="38" height="78" rx="19"/><path d="M40 70v8a40 40 0 0 0 80 0v-8M80 118v24M56 142h48"/>',
    '<path d="M20 66h28l38-34v96L48 94H20zM110 80h36"/>',
    '<path d="M20 66h28l38-34v96L48 94H20zM110 80h36M128 62v36"/>',
    '<rect x="48" y="8" width="38" height="78" rx="19"/><path d="M27 70v8a40 40 0 0 0 80 0v-8M67 118v24M43 142h48M116 80h36"/>',
    '<rect x="48" y="8" width="38" height="78" rx="19"/><path d="M27 70v8a40 40 0 0 0 80 0v-8M67 118v24M43 142h48M116 80h36M134 62v36"/>',
    '<rect x="16" y="35" width="88" height="90" rx="16"/><path d="m104 62 40-22v80l-40-22z"/>',
    '<rect x="12" y="25" width="136" height="98" rx="12"/><path d="M80 112V55M54 80l26-26 26 26"/>',
    '<path d="M40 138V65c0-12 18-12 18 0V32c0-13 20-13 20 0v28-40c0-13 20-13 20 0v40-30c0-13 20-13 20 0v43-18c0-13 20-13 20 0v35c0 38-24 58-58 58H64z"/>',
    '<path d="M18 28h124v86H76l-34 28v-28H18zM48 70h4M78 70h4M108 70h4"/>',
    '<circle cx="80" cy="80" r="28"/><path d="M80 12v15M80 133v15M12 80h15M133 80h15M32 32l11 11M117 117l11 11M128 32l-11 11M43 117l-11 11"/>',
    '<circle cx="52" cy="55" r="20"/><circle cx="109" cy="55" r="20"/><path d="M18 130c3-31 18-46 42-46s40 15 42 46M77 130c2-23 14-35 35-35 17 0 29 10 33 30M22 18l124 124" stroke="#F04444"/>',
    '<circle cx="80" cy="80" r="55"/><circle cx="80" cy="80" r="27" fill="#F04444" stroke="none"/><rect x="112" y="112" width="24" height="24" rx="3" fill="#F8F9FA" stroke="none"/>',
    '<circle cx="80" cy="80" r="55"/><path d="M58 54v52M80 54v52M103 54l36 26-36 26z"/>',
    '<path d="M34 44c21 45 41 65 86 86l23-28-36-19-16 17c-15-9-22-16-31-31l17-16-19-36z" stroke="#34A853"/>',
    '<path d="M34 44c21 45 41 65 86 86l23-28-36-19-16 17c-15-9-22-16-31-31l17-16-19-36zM24 24l112 112" stroke="#F04444"/>'
  ];
  return icons[index] ?? badge('M112 80h36');
}

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
  await rm(imageDir, { recursive: true, force: true });
  await mkdir(imageDir, { recursive: true });

  const actions = {};
  for (let index = 0; index < panel.actions.length; index += 1) {
    const [label, shortcut, key, modifiers, tone] = panel.actions[index];
    const column = index % 5;
    // VSD Craft stores M18 rows bottom-up while the editor renders them top-down.
    const row = 2 - Math.floor(index / 5);
    const imageName = `meeting-${String(index + 1).padStart(2, "0")}.png`;
    await writeIcon(join(imageDir, imageName), panel, label, tone, index);
    actions[`${column},${row}`] = {
      ActionID: actionId(panelIndex, index),
      Controller: "Keypad",
      Name: `${panel.name} · ${label}`,
      Settings: {
        Coalesce: true,
        Hotkeys: [key ? hotkey(key, modifiers) : emptyHotkey(), emptyHotkey(), emptyHotkey()],
        hotkeyRadioButtonIndex: 0
      },
      State: 0,
      States: [{ Image: imageName, Title: "" }],
      UUID: "com.hotspot.streamdock.system.hotkey"
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
