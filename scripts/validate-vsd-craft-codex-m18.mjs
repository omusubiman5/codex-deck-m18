import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { profileIds, scenes } from "./configure-vsd-craft-codex-m18.mjs";

const appData = process.env.APPDATA;
if (!appData) throw new Error("APPDATA is not available.");

const profileRoot = join(appData, "HotSpot", "StreamDock", "profiles");
const pluginManifestPath = join(
  appData,
  "HotSpot",
  "StreamDock",
  "plugins",
  "com.simeo.codex-deck.sdPlugin",
  "manifest.json"
);
const pluginManifest = JSON.parse(await readFile(pluginManifestPath, "utf8"));
const publishedUuids = new Set(pluginManifest.Actions.map((action) => action.UUID));
const observedUuids = [];

for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
  const profileId = profileIds[sceneIndex];
  const manifestPath = join(profileRoot, `${profileId}.sdProfile`, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expectedPage = `${profileId}.sdProfile`;
  if (manifest.Name !== scenes[sceneIndex].name) throw new Error(`${profileId}: unexpected scene name.`);
  if (manifest.Pages?.Current !== expectedPage || JSON.stringify(manifest.Pages?.Pages) !== JSON.stringify([expectedPage])) {
    throw new Error(`${manifest.Name}: active VSD Craft page is not the rewritten root profile.`);
  }

  for (let index = 0; index < scenes[sceneIndex].actions.length; index += 1) {
    const position = `${index % 5},${2 - Math.floor(index / 5)}`;
    const expectedUuid = scenes[sceneIndex].actions[index][1];
    const actualUuid = manifest.Actions?.[position]?.UUID;
    if (actualUuid !== expectedUuid) {
      throw new Error(`${manifest.Name} ${position}: expected ${expectedUuid}, got ${actualUuid ?? "missing"}.`);
    }
    if (!publishedUuids.has(actualUuid)) throw new Error(`${manifest.Name}: unpublished action ${actualUuid}.`);
    observedUuids.push(actualUuid);
  }

  for (let button = 0; button < 3; button += 1) {
    const shift = manifest.Actions?.[`5,${button}`];
    if (shift?.UUID !== "com.hotspot.streamdock.profile.rotate" || shift.Settings?.ProfileUUID !== profileIds[button]) {
      throw new Error(`${manifest.Name}: invalid Scene Shift ${button + 1}.`);
    }
  }
}

if (observedUuids.length !== 45 || new Set(observedUuids).size !== 45) {
  throw new Error(`Expected 45 unique LCD actions, got ${observedUuids.length}/${new Set(observedUuids).size}.`);
}

console.log("VSD Craft Codex M18 profile validation passed: 3 scenes, 45 unique actions, 9 direct Scene Shifts.");
