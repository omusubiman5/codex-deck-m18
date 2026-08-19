import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";

const appData = process.env.APPDATA;
if (!appData) throw new Error("APPDATA is not available.");

const profileRoot = join(appData, "HotSpot", "StreamDock", "profiles");
const profileIds = [
  "958M229P-ODG0-T190-KT30-D18NN43IM5HZ",
  "E20ACZ9G-35Q9-UTQ7-9VN0-38058CP6N18K",
  "2YD4ACZ2-8K19-0184-XYLF-H11W2P0MWH22"
];

const scenes = [
  {
    name: "Codex Projects",
    actions: [
      ["Agent 1", "com.simeo.codex-deck.agent-1"],
      ["Agent 2", "com.simeo.codex-deck.agent-2"],
      ["Agent 3", "com.simeo.codex-deck.agent-3"],
      ["Agent 4", "com.simeo.codex-deck.agent-4"],
      ["Agent 5", "com.simeo.codex-deck.agent-5"],
      ["Agent 6", "com.simeo.codex-deck.agent-6"],
      ["Joystick Up", "com.simeo.codex-deck.plan"],
      ["Joystick Down", "com.simeo.codex-deck.sidebar"],
      ["Joystick Left", "com.simeo.codex-deck.back"],
      ["Joystick Right", "com.simeo.codex-deck.forward"],
      ["Reasoning Encoder Click", "com.simeo.codex-deck.reasoning"],
      ["Windows / Mac Target + Health", "com.simeo.codex-deck.host-toggle"],
      ["Usage Limit", "com.simeo.codex-deck.usage-limit"],
      ["Usage Overview", "com.simeo.codex-deck.usage-overview"],
      ["Rate Limit Reset", "com.simeo.codex-deck.rate-limit-reset"]
    ]
  },
  {
    name: "Codex Keys 1",
    actions: [
      ["Keycap · Fast Mode", "com.simeo.codex-deck.keycap-fast"],
      ["Keycap · Approve", "com.simeo.codex-deck.keycap-approve"],
      ["Keycap · Reject", "com.simeo.codex-deck.keycap-reject"],
      ["Keycap · Fork Chat", "com.simeo.codex-deck.keycap-split"],
      ["Keycap · Push-to-talk", "com.simeo.codex-deck.dictation"],
      ["Keycap · Codex / Submit", "com.simeo.codex-deck.keycap-codex"],
      ["Keycap · Bug / Feedback", "com.simeo.codex-deck.keycap-bug"],
      ["Keycap · OpenAI Docs", "com.simeo.codex-deck.keycap-openai-docs"],
      ["Keycap · Terminal", "com.simeo.codex-deck.keycap-terminal"],
      ["Keycap · Copy Chat Markdown", "com.simeo.codex-deck.keycap-download"],
      ["Keycap · Archive Chat", "com.simeo.codex-deck.keycap-archive"],
      ["Keycap · New Task", "com.simeo.codex-deck.keycap-new-task"],
      ["Keycap · Browser", "com.simeo.codex-deck.keycap-browser"],
      ["Keycap · Pin / Unpin Chat", "com.simeo.codex-deck.keycap-pin"],
      ["Keycap · Review", "com.simeo.codex-deck.keycap-diff"]
    ]
  },
  {
    name: "Codex Keys 2",
    actions: [
      ["Keycap · Run Environment Action", "com.simeo.codex-deck.keycap-play"],
      ["Keycap · Git Commit", "com.simeo.codex-deck.keycap-git-commit"],
      ["Keycap · Branch Review", "com.simeo.codex-deck.keycap-branch"],
      ["Keycap · Merge Review", "com.simeo.codex-deck.keycap-merge"],
      ["Keycap · Create Pull Request", "com.simeo.codex-deck.keycap-pull-request"],
      ["Keycap · Add Photos", "com.simeo.codex-deck.keycap-add-photos"],
      ["Keycap · Lab / Settings", "com.simeo.codex-deck.keycap-lab"],
      ["Keycap · Side Chat", "com.simeo.codex-deck.keycap-side-chat"],
      ["Keycap · Manage Tasks", "com.simeo.codex-deck.keycap-tasks"],
      ["Keycap · Reasoning Up", "com.simeo.codex-deck.keycap-reasoning-up"],
      ["Keycap · Reasoning Down", "com.simeo.codex-deck.keycap-reasoning-down"],
      ["Keycap · Settings", "com.simeo.codex-deck.keycap-settings"],
      ["Keycap · Open Folder", "com.simeo.codex-deck.keycap-open-folder"],
      ["Keycap · Add Files", "com.simeo.codex-deck.keycap-add-files"],
      ["Keycap · Skills", "com.simeo.codex-deck.keycap-skills"]
    ]
  }
];

const backupRoot = join(
  appData,
  "CodexDeck",
  "backups",
  `vsd-craft-codex-m18-${new Date().toISOString().replaceAll(":", "-")}`
);

function keypadAction(name, uuid) {
  return {
    ActionID: randomUUID(),
    Controller: "Keypad",
    Name: name,
    Settings: {},
    SoftwareSettings: {},
    State: 0,
    States: [{ Image: "static/imgs/key", Title: "" }],
    UUID: uuid
  };
}

function sceneShift(profileId) {
  return {
    ActionID: randomUUID(),
    Controller: "Keypad",
    Name: "Scene Shift",
    Settings: { DeviceUUID: "", ProfileUUID: profileId },
    SoftwareSettings: {},
    State: 0,
    States: [{ Image: "" }],
    UUID: "com.hotspot.streamdock.profile.rotate"
  };
}

await mkdir(backupRoot, { recursive: true });

for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
  const profileId = profileIds[sceneIndex];
  const profileDir = join(profileRoot, `${profileId}.sdProfile`);
  const manifestPath = join(profileDir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`Missing VSD Craft profile: ${profileId}`);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.DeviceUUID !== "VSDM18") throw new Error(`${profileId} is not an M18 profile.`);
  await cp(profileDir, join(backupRoot, basename(profileDir)), { recursive: true });

  const actions = {};
  for (let index = 0; index < scenes[sceneIndex].actions.length; index += 1) {
    const column = index % 5;
    const row = 2 - Math.floor(index / 5);
    const [name, uuid] = scenes[sceneIndex].actions[index];
    actions[`${column},${row}`] = keypadAction(name, uuid);
  }
  for (let button = 0; button < 3; button += 1) {
    actions[`5,${button}`] = sceneShift(profileIds[button]);
  }

  manifest.Name = scenes[sceneIndex].name;
  manifest.Actions = actions;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`, "utf8");
  console.log(`${scenes[sceneIndex].name}: ${profileDir}`);
}

console.log(`Backup: ${backupRoot}`);
