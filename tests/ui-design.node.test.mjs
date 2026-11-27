import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("launcher and viewer keep the visual redesign assets local and complete", async () => {
  const [launcher, viewer, styles, icon, viewerSource] = await Promise.all([
    read("../index.html"),
    read("../viewer.html"),
    read("../src/styles.css"),
    read("../public/icon.svg"),
    read("../src/viewer.ts"),
  ]);

  assert.match(launcher, /id="launcher-status"/);
  assert.match(launcher, /id="launch-button"/);
  assert.match(launcher, /class="button-label"/);
  assert.match(launcher, /data-state="checking"/);

  const requiredIds = [
    "scene-canvas", "scene-status", "view-iso", "view-top", "camera-reset",
    "close-viewer", "scene-tools", "tool-settings-toggle", "tool-settings",
    "tool-settings-close", "tool-settings-title", "tool-settings-description",
    "drawing-settings", "measure-settings", "fire-settings", "text-settings",
    "integrations-panel", "integrations-toggle", "integrations-close",
    "measure-readout", "token-toolbar", "selection-label", "scale-token-down",
    "scale-token-up", "rotate-token-left", "rotate-token-right",
    "toggle-token-lock", "toggle-token-visibility", "delete-selected-tokens",
    "deselect-tokens", "map-count", "token-count", "prop-count",
    "message-panel", "message-symbol", "message-title", "message-body",
    "message-retry", "toast", "map-scale-toggle", "map-scale-panel",
    "map-scale-close", "map-scale-input", "map-scale-value",
  ];
  for (const id of requiredIds) assert.ok(viewer.includes(`id="${id}"`), `Missing viewer element #${id}`);

  const symbols = new Set([...viewer.matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]));
  const references = [...viewer.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(references.length > 0, "Viewer must use its in-document vector symbols");
  for (const reference of references) assert.ok(symbols.has(reference), `Undefined vector symbol #${reference}`);

  const expectedTools = ["select", "pan", "measure", "marker", "brush", "line", "rectangle", "circle", "triangle", "hexagon", "fire", "text"];
  const actualTools = [...viewer.matchAll(/data-scene-tool="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(actualTools, expectedTools);

  assert.doesNotMatch(launcher + viewer + icon, /\p{Extended_Pictographic}/u, "UI and app icon must not contain emoji");
  assert.match(viewer, /type="range" min="50" max="200" step="1" value="100"/);
  assert.match(viewer, /redimensionadas juntas/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /\.scene-tool:hover/);
  assert.match(styles, /\.scene-tool\.active/);
  assert.match(styles, /\.launch-button:disabled/);
  assert.match(styles, /\.toast\.visible/);
  assert.match(viewer, /aria-keyshortcuts="V"/);
  assert.match(viewerSource, /selectionProxy/);
  assert.match(viewerSource, /getMapPositionAtDragPointer/);
  assert.match(viewerSource, /getItemUpdateBlockReason/);
  assert.match(viewerSource, /Ferramenta Selecionar ativada \(V\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("visual system avoids template effects, pill controls and oversized corner radii", async () => {
  const styles = await read("../src/styles.css");
  assert.doesNotMatch(styles, /radial-gradient|linear-gradient|backdrop-filter|box-shadow|blur\(/i);

  const radii = [...styles.matchAll(/border-radius:\s*([\d.]+)px/g)].map((match) => Number(match[1]));
  assert.ok(radii.length > 0);
  assert.ok(radii.every((radius) => radius <= 2), "UI corners should remain square and consistent");
  assert.doesNotMatch(styles, /transition:\s*all\b/i, "Transitions must be limited to the changed properties");
  assert.match(styles, /--accent:\s*#c48a55/i, "One restrained warm accent anchors the interface");
});
