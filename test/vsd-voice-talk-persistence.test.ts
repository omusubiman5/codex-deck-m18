import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type Scene = { name: string; actions: Array<[string, string]> };
const generatorUrl = new URL("../scripts/configure-vsd-craft-codex-m18.mjs", import.meta.url).href;
const { profileIds, scenes } = await import(generatorUrl) as { profileIds: string[]; scenes: Scene[] };

const VOICE_UUID = "com.simeo.codex-deck.dictation";

test("VSD scene 2 coordinate 4,2 canonically persists Voice Talk", () => {
  const action = scenes[1]?.actions[4];
  assert.deepEqual(action, ["Voice Talk", VOICE_UUID]);
});

test("VSD Voice Talk uses the native voice renderer and command on startup and press", async () => {
  const source = await readFile(new URL("../src/actions.ts", import.meta.url), "utf8");
  assert.match(source, /class Dictation[\s\S]*registerFixedAction\([\s\S]*kind:\s*"builtin",\s*name:\s*"voice"/);
  assert.match(source, /class Dictation[\s\S]*pulseVoiceAction/);
  assert.match(source, /class Dictation[\s\S]*startM18VoiceConversation/);
  assert.match(source, new RegExp(`@action\\(\\{ UUID: "${VOICE_UUID.replaceAll(".", "\\.")}" \\}\\)`));
});

test("VSD canonical profile matrix preserves 45 unique controls and 9 direct scene shifts", () => {
  assert.equal(profileIds.length, 3);
  assert.deepEqual(scenes.map((scene) => scene.actions.length), [15, 15, 15]);

  const actions = scenes.flatMap((scene) => scene.actions);
  assert.equal(actions.length, 45);
  assert.equal(new Set(actions.map(([, uuid]) => uuid)).size, 45);
  assert.equal(profileIds.length * 3, 9);
});

test("only the intended VSD coordinate changes from the baseline matrix", () => {
  const expected = [
    "com.simeo.codex-deck.keycap-fast",
    "com.simeo.codex-deck.keycap-approve",
    "com.simeo.codex-deck.keycap-reject",
    "com.simeo.codex-deck.keycap-split",
    VOICE_UUID,
    "com.simeo.codex-deck.keycap-codex",
    "com.simeo.codex-deck.keycap-bug",
    "com.simeo.codex-deck.keycap-openai-docs",
    "com.simeo.codex-deck.keycap-terminal",
    "com.simeo.codex-deck.keycap-download",
    "com.simeo.codex-deck.keycap-archive",
    "com.simeo.codex-deck.keycap-new-task",
    "com.simeo.codex-deck.keycap-browser",
    "com.simeo.codex-deck.keycap-pin",
    "com.simeo.codex-deck.keycap-diff"
  ];
  assert.deepEqual(scenes[1]?.actions.map(([, uuid]) => uuid), expected);
});
