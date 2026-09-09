import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

test("inspector uses existing socket and action context for status and recovery", async () => {
  const source = await readFile(new URL("../static/property-inspector/bridge.js", import.meta.url), "utf8");
  const nodes: any[] = [];
  const listeners: Record<string, (event?: any) => void> = {};
  const sent: any[] = [];
  let interval!: () => void;
  let cleared = false;
  const window: any = { addEventListener() {} };
  const socket = {
    readyState: 1,
    send: (message: string) => sent.push(JSON.parse(message)),
    addEventListener: (name: string, listener: (event?: any) => void) => { listeners[name] = listener; }
  };
  runInNewContext(source, {
    window, WebSocket: { OPEN: 1 },
    setInterval: (callback: () => void) => { interval = callback; return 1; },
    clearInterval: () => { cleared = true; },
    document: {
      body: { append() {} },
      createElement: () => {
        const node: any = { style: {}, append() {}, setAttribute() {}, addEventListener(name: string, cb: () => void) { node[name] = cb; } };
        nodes.push(node);
        return node;
      }
    }
  });
  window.attachBridgeControls(socket, JSON.stringify({ action: "com.simeo.codex-deck.usage-limit", context: "key-12" }));
  assert.equal(nodes[0].hidden, true); // Hidden for ordinary Stream Deck/macOS.
  listeners.open!();
  assert.deepEqual(sent[0], { event: "sendToPlugin", action: "com.simeo.codex-deck.usage-limit", context: "key-12", payload: { type: "vsd-bridge", command: "status" } });
  listeners.message!({ data: JSON.stringify({ event: "sendToPropertyInspector", payload: { type: "vsd-bridge", state: "restart-required", detail: "再起動が必要" } }) });
  assert.equal(nodes[0].hidden, false);
  assert.equal(nodes[2].textContent, "再起動が必要");
  nodes[3].click();
  assert.equal(sent[1].payload.command, "recover");
  assert.equal(nodes[3].disabled, true);
  interval();
  assert.equal(sent[2].payload.command, "status");
  listeners.close!();
  assert.equal(cleared, true);
  assert.equal(nodes[3].disabled, true);
});
