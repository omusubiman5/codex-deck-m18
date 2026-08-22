import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CODEX_MICRO_COLORS, renderAgentSvg, renderBuiltinKeycap, renderFallbackKeycap, renderHostTargetKey, renderImportedKeycap, renderVoiceKeycap, SIGNAL_COLORS } from "../src/render.js";

test("agent status colors match the instructed Codex Micro semantics", () => {
  const expected = {
    empty: "#9CA3AF", idle: "#1D9528", thinking: "#732BE1",
    complete: "#1D9528", input: "#FF880A", error: "#E42D2D"
  };
  assert.deepEqual(SIGNAL_COLORS.light, expected);
  assert.deepEqual(SIGNAL_COLORS.dark, expected);
  assert.equal(CODEX_MICRO_COLORS.selected, "#0C5AFB");
});

test("working, completed, selected, approval, error, and off are visibly distinct", () => {
  const working = renderAgentSvg(0, "Build", "thinking", false, 0, "dark");
  const completed = renderAgentSvg(0, "Build", "complete", false, 0, "dark");
  const selected = renderAgentSvg(0, "Build", "idle", true, 0, "dark");
  const approval = renderAgentSvg(0, "Build", "input", false, 0, "dark");
  const error = renderAgentSvg(0, "Build", "error", false, 0, "dark");
  const off = renderAgentSvg(0, "Build", "empty", false, 0, "dark");

  assert.match(working, new RegExp(CODEX_MICRO_COLORS.active, "i"));
  assert.match(completed, new RegExp(CODEX_MICRO_COLORS.ready, "i"));
  assert.match(selected, new RegExp(CODEX_MICRO_COLORS.selected, "i"));
  assert.match(approval, new RegExp(CODEX_MICRO_COLORS.approval, "i"));
  assert.match(error, new RegExp(CODEX_MICRO_COLORS.error, "i"));
  assert.match(off, new RegExp(CODEX_MICRO_COLORS.off, "i"));
  assert.notEqual(working, completed);
});

test("dark agent tiles use Codex-like charcoal surfaces without pure black", () => {
  const svg = renderAgentSvg(0, "Building dark mode", "thinking", true, 4, "dark");
  assert.match(svg, /data-theme="dark"/);
  assert.match(svg, /#343638/);
  assert.match(svg, /#222426/);
  assert.match(svg, /#F2F2EF/);
  assert.match(svg, new RegExp(SIGNAL_COLORS.dark.thinking, "i"));
  assert.doesNotMatch(svg, /#000(?:000)?\b/i);
});

test("light and dark agent themes remain visually distinct", () => {
  const light = renderAgentSvg(0, "Ready", "idle", false, 0, "light");
  const dark = renderAgentSvg(0, "Ready", "idle", false, 0, "dark");
  assert.match(light, /data-theme="light"/);
  assert.match(light, /#FFFFFF/);
  assert.notEqual(light, dark);
});

test("agent tiles show a project as the primary label and a task as secondary text", () => {
  const svg = renderAgentSvg(0, "codex-deck-m18", "thinking", false, 0, "dark", "W", "ready", 20, true, "Implement scene switching");
  assert.match(svg, />codex-deck-m18<\/text>/);
  assert.match(svg, /data-agent-task-label="true"/);
  assert.match(svg, />Implement scene switching<\/text>/);
});

test("agent context ring is bounded and can be hidden globally", () => {
  const visible = renderAgentSvg(0, "Context test", "thinking", false, 0, "dark", "M", "ready", 84, true);
  assert.match(visible, /data-context-used="84"/);
  assert.match(visible, new RegExp(SIGNAL_COLORS.dark.input, "i"));

  const hidden = renderAgentSvg(0, "Context test", "thinking", false, 0, "dark", "M", "ready", 84, false);
  assert.doesNotMatch(hidden, /data-context-used=/);

  const pending = renderAgentSvg(0, "New task", "idle", false, 0, "dark", "M", "ready", undefined, true);
  assert.match(pending, /data-context-used="unknown"/);

  const empty = renderAgentSvg(0, "Not assigned", "empty", false, 0, "dark", "M", "ready", undefined, true);
  assert.doesNotMatch(empty, /data-context-used=/);
});

test("user-local monochrome SVGs normalize to an off-white dark glyph", () => {
  const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h20v20H2z" stroke="#000"/></svg>';
  const output = decodeURIComponent(renderImportedKeycap(input, "dark").replace(/^data:image\/svg\+xml;charset=utf8,/, ""));
  assert.match(output, /data-theme="dark"/);
  assert.match(output, /fill="#F2F2EE"/);
  assert.match(output, /stroke="#F2F2EE"/);
  assert.doesNotMatch(output, /#000(?:000)?\b/i);
});

test("original navigation icons use the same dark keycap system", () => {
  for (const icon of ["back", "forward", "sidebar", "home", "navigation"] as const) {
    const output = decodeURIComponent(renderBuiltinKeycap(icon, "dark").replace(/^data:image\/svg\+xml;charset=utf8,/, ""));
    assert.match(output, /data-theme="dark"/);
    assert.match(output, /data-icon-source="codex-deck-original"/);
    assert.match(output, /stroke="#F2F2EE"/);
    assert.doesNotMatch(output, /#000(?:000)?\b/i);
  }
});

test("Voice conversation key is explicitly labeled on the M18 display", () => {
  const output = decodeURIComponent(renderBuiltinKeycap("voice", "dark").replace(/^data:image\/svg\+xml;charset=utf8,/, ""));
  assert.match(output, />VOICE TALK<\/text>/);
  assert.match(output, /data-icon-source="fallback-label"/);
  assert.doesNotMatch(output, /data-icon-source="codex-deck-original"/);
  assert.equal(renderBuiltinKeycap("voice", "dark"), renderFallbackKeycap("VOICE TALK", "dark"));
});

test("Voice pulse preserves the fallback design and returns to the static key", () => {
  const pulse = decodeURIComponent(renderVoiceKeycap("dark", 1).replace(/^data:image\/svg\+xml;charset=utf8,/, ""));
  assert.match(pulse, /data-voice-pulse="1\.00"/);
  assert.match(pulse, /data-voice-accent="active"/);
  assert.match(pulse, new RegExp(`fill="${CODEX_MICRO_COLORS.active}" fill-opacity="0\\.920"`));
  assert.match(pulse, /font-weight="700"[^>]+fill="#FFFFFF">VOICE TALK<\/text>/);
  assert.match(pulse, />VOICE TALK<\/text>/);
  assert.doesNotMatch(pulse, /codex-deck-original/);
  assert.equal(renderVoiceKeycap("dark", 0), renderFallbackKeycap("VOICE TALK", "dark"));
});

test("renderer snapshot derives a theme without a versioned asset hash", async () => {
  const source = await readFile(new URL("../src/codex-micro-renderer-bridge.ts", import.meta.url), "utf8");
  assert.match(source, /backgroundColor/);
  assert.match(source, /prefers-color-scheme: dark/);
  assert.match(source, /theme\s*=\s*explicitDark/);
});

test("dark title contrast stays above WCAG AA for small text", () => {
  assert.ok(contrast("#F2F2EF", "#2A2C2E") > 7);
});

test("missing local assets receive a readable themed fallback", () => {
  const output = decodeURIComponent(renderFallbackKeycap("TERM", "dark").replace(/^data:image\/svg\+xml;charset=utf8,/, ""));
  assert.match(output, /data-icon-source="fallback-label"/);
  assert.match(output, />TERM<\/text>/);
  assert.doesNotMatch(output, /#000(?:000)?\b/i);
});

test("host target and affected agent keys expose degraded and offline state", () => {
  const target = decodeURIComponent(renderHostTargetKey("MAC", "degraded", "dark").replace(/^data:image\/svg\+xml;charset=utf8,/, ""));
  assert.match(target, /data-host-health="degraded"/);
  assert.match(target, />DEGRADED<\/text>/);
  assert.match(target, new RegExp(SIGNAL_COLORS.dark.input, "i"));

  const degradedAgent = renderAgentSvg(0, "Last known task", "idle", false, 0, "dark", "M", "degraded");
  assert.match(degradedAgent, /data-agent-host="M"/);
  assert.match(degradedAgent, /data-agent-host-health="degraded"/);
  const offlineAgent = renderAgentSvg(0, "Last known task", "idle", false, 0, "dark", "M", "offline");
  assert.match(offlineAgent, /data-agent-host-health="offline"/);
});

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + .05) / (darker! + .05);
}

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * channels[0]! + .7152 * channels[1]! + .0722 * channels[2]!;
}
