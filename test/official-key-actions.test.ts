import assert from "node:assert/strict";
import test from "node:test";
import {
  Dictation,
  KeycapAddFiles, KeycapAddPhotos, KeycapApprove, KeycapArchive, KeycapBranch, KeycapBrowser,
  KeycapBug, KeycapCodex, KeycapDiff, KeycapDownload, KeycapFast, KeycapGitCommit, KeycapLab,
  KeycapMerge, KeycapNewTask, KeycapOpenAiDocs, KeycapOpenFolder, KeycapPin, KeycapPlay,
  KeycapPullRequest, KeycapReasoningDown, KeycapReasoningUp, KeycapReject, KeycapSettings,
  KeycapSideChat, KeycapSkills, KeycapSplit, KeycapTasks, KeycapTerminal
} from "../src/actions.js";
import type { DeckController } from "../src/controller.js";
import { OFFICIAL_KEYCAP_IDS, type OfficialKeycapId } from "../src/keycaps.js";

type ControllerCall = { method: string; args: unknown[] };
type ActionConstructor = new (controller: DeckController) => {
  onKeyDown(event: never): Promise<void> | void;
  onKeyUp?(event: never): Promise<void> | void;
};

const classes: Record<OfficialKeycapId, ActionConstructor> = {
  FAST: KeycapFast,
  APPR: KeycapApprove,
  REJ: KeycapReject,
  SPLIT: KeycapSplit,
  MIC: Dictation,
  CODEX: KeycapCodex,
  BUG: KeycapBug,
  OAI: KeycapOpenAiDocs,
  TERM: KeycapTerminal,
  DWN: KeycapDownload,
  DEL: KeycapArchive,
  NEW: KeycapNewTask,
  NAV: KeycapBrowser,
  MAGIC: KeycapPin,
  DIFF: KeycapDiff,
  PLAY: KeycapPlay,
  GIT: KeycapGitCommit,
  BRCH: KeycapBranch,
  MRG: KeycapMerge,
  PR: KeycapPullRequest,
  PAINT: KeycapAddPhotos,
  LAB: KeycapLab,
  PARTY: KeycapSideChat,
  TIME: KeycapTasks,
  "MIND+": KeycapReasoningUp,
  "MIND-": KeycapReasoningDown,
  SETUP: KeycapSettings,
  FOLD: KeycapOpenFolder,
  UPL: KeycapAddFiles,
  APPS: KeycapSkills
};

function recordingController(calls: ControllerCall[]): DeckController {
  return new Proxy({}, {
    get: (_target, property) => (...args: unknown[]) => {
      calls.push({ method: String(property), args });
      return Promise.resolve();
    }
  }) as DeckController;
}

const event = { action: { id: "official-key", showAlert: async () => {} } } as never;

test("VSD Craft exposes all 30 official keys as ordinary single-press actions", async () => {
  assert.equal(OFFICIAL_KEYCAP_IDS.length, 30);
  assert.deepEqual(Object.keys(classes), [...OFFICIAL_KEYCAP_IDS]);

  for (const keycapId of OFFICIAL_KEYCAP_IDS) {
    const calls: ControllerCall[] = [];
    const instance = new classes[keycapId](recordingController(calls));
    await instance.onKeyDown(event);

    if (keycapId === "MIC") {
      assert.deepEqual(calls, [{ method: "sendMicroAction", args: ["ACT10_ACT11", 1] }], keycapId);
      await instance.onKeyUp?.(event);
      assert.deepEqual(calls, [
        { method: "sendMicroAction", args: ["ACT10_ACT11", 1] },
        { method: "sendMicroAction", args: ["ACT10_ACT11", 0] }
      ], keycapId);
    } else {
      assert.deepEqual(calls, [{ method: "runKeycap", args: [keycapId] }], keycapId);
      await instance.onKeyUp?.(event);
      assert.deepEqual(calls, [{ method: "runKeycap", args: [keycapId] }], `${keycapId} key-up`);
    }
  }
});
