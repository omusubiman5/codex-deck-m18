import { CodexMicroRendererBridge } from "../src/codex-micro-renderer-bridge.js";

type Evaluator = {
  evaluate<T>(expression: string): Promise<T>;
};

const bridge = new CodexMicroRendererBridge((message) => console.error(message));

try {
  const snapshot = await bridge.refresh();
  if (process.argv.includes("--agents")) {
    const agentDom = await (bridge as unknown as Evaluator).evaluate(`(() => ({
      url: location.href,
      conversationIds: [...document.querySelectorAll('[data-above-composer-conversation-id]')].map((element) => element.getAttribute('data-above-composer-conversation-id')),
      sidebarItems: [...document.querySelectorAll('[data-app-action-sidebar-thread-id]')].map((element) => ({
        threadId: element.getAttribute('data-app-action-sidebar-thread-id'),
        active: element.getAttribute('data-app-action-sidebar-thread-active'),
        ariaCurrent: element.getAttribute('aria-current'),
        tag: element.tagName,
        role: element.getAttribute('role'),
        descendants: [...element.querySelectorAll('button, a, [role="button"], [role="link"]')].slice(0, 4).map((child) => ({
          tag: child.tagName,
          role: child.getAttribute('role'),
          ariaCurrent: child.getAttribute('aria-current'),
          action: child.getAttribute('data-app-action')
        }))
      }))
    }))()`);
    console.error(JSON.stringify(agentDom, null, 2));
  }
  if (process.argv.includes("--exercise")) {
    await bridge.runKeycap("TERM");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await bridge.runKeycap("TERM");
    console.error("Codex Tools TERM round-trip succeeded.");
  }
  if (process.argv.includes("--exercise-agent")) {
    const canonical = (value: string | undefined) => value?.replace(/^local:/, "");
    const originalSlot = snapshot.slots.findIndex((slot) => canonical(slot.threadKey) === canonical(snapshot.activeThreadKey));
    const targetSlot = snapshot.slots.findIndex((slot, index) => Boolean(slot.threadKey) && index !== originalSlot);
    if (originalSlot < 0 || targetSlot < 0) throw new Error("Two switchable Codex agent slots are required.");
    await bridge.sendAgent(targetSlot, 1, snapshot.slots[targetSlot].threadKey);
    await bridge.sendAgent(targetSlot, 0, snapshot.slots[targetSlot].threadKey);
    await bridge.sendAgent(originalSlot, 1, snapshot.slots[originalSlot].threadKey);
    await bridge.sendAgent(originalSlot, 0, snapshot.slots[originalSlot].threadKey);
    console.error("Codex agent switch round-trip succeeded.");
  }
  const modules = await (bridge as unknown as Evaluator).evaluate(`(async () => {
    const urls = [...new Set([
      ...[...document.querySelectorAll('link[href], script[src]')].map((element) => element.href || element.src),
      ...performance.getEntriesByType('resource').map((entry) => entry.name)
    ])].filter((url) => url.includes('/assets/') && url.endsWith('.js'));
    const selected = urls.filter((url) => /run-command-|codex-micro-bridge-|codex-micro-layout-/.test(url));
    const result = [];
    for (const url of selected) {
      try {
        const namespace = await import(url);
        const source = url.includes('/codex-micro-bridge-') ? await (await fetch(url)).text() : '';
        result.push({
          url,
          exports: Object.entries(namespace).map(([name, value]) => ({ name, type: typeof value })),
          ...(source ? {
            commandContext: source.split(';').filter((part) => part.includes('codex_micro_hid')).slice(0, 4),
            runnerDefinitions: [
              ...(source.match(/function Zt\\([^}]{0,1000}/g) ?? []),
              ...(source.match(/(?:const|let|var) Zt=[^;]{0,1000}/g) ?? [])
            ],
            imports: source.match(/import[^;]+;/g)?.slice(0, 12) ?? []
          } : {})
        });
      } catch (error) {
        result.push({ url, error: String(error) });
      }
    }
    return result;
  })()`);
  console.log(JSON.stringify({
    activeThreadKey: snapshot.activeThreadKey ?? null,
    slotCount: snapshot.slots.length,
    ...(process.argv.includes("--agents") ? { slots: snapshot.slots } : {}),
    modules
  }, null, 2));
} finally {
  bridge.disconnect();
}
