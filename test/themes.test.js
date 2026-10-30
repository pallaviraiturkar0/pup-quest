import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/engine.js";
import { LEVELS, VIEW_WIDTH } from "../src/levels.js";
import { createRenderer } from "../src/render.js";
import {
  DEFAULT_THEME, getTheme, LANDMARK_KINDS, LAYER_KINDS, PALETTE_KEYS, resolveColor,
  SCATTER_KINDS, THEMES, themeForLevel, themeOverrideFromSearch,
} from "../src/themes.js";

const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_FIELDS = ["color", "halo", "shadow", "crater", "window", "foam", "highlight", "post", "light"];

test("every level uses a defined theme and existing levels keep their backdrops", () => {
  for (const level of LEVELS) assert.ok(Object.hasOwn(THEMES, level.theme), `${level.name} theme ${level.theme}`);
  assert.deepEqual(LEVELS.map((level) => level.theme), ["meadow", "forest", "night"]);
});

test("the new park, beach, and night city backdrops are available", () => {
  for (const name of ["park", "beach", "city"]) assert.ok(THEMES[name], name);
  assert.ok(THEMES.beach.layers.some((layer) => layer.kind === "sea"));
  assert.ok(THEMES.city.layers.filter((layer) => layer.kind === "skyline").length >= 2);
  assert.ok(THEMES.park.layers.some((layer) => layer.kind === "lamps"));
});

test("theme palettes are complete hex colors", () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    assert.equal(typeof theme.label, "string", name);
    assert.deepEqual(Object.keys(theme.palette).sort(), [...PALETTE_KEYS].sort(), name);
    for (const [key, value] of Object.entries(theme.palette)) assert.match(value, HEX, `${name}.${key}`);
  }
});

test("theme layers are known kinds with valid parallax and colors", () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    assert.ok(theme.layers.length >= 3, name);
    for (const layer of theme.layers) {
      assert.ok(LAYER_KINDS.includes(layer.kind), `${name}: ${layer.kind}`);
      assert.ok(layer.parallax >= 0 && layer.parallax < 1, `${name}: ${layer.kind} parallax`);
      for (const field of COLOR_FIELDS) {
        if (field in layer) assert.match(resolveColor(theme, layer[field]), HEX, `${name}: ${layer.kind}.${field}`);
      }
      if ("spacing" in layer) assert.ok(layer.spacing > 0);
      if ("count" in layer) assert.ok(Number.isInteger(layer.count) && layer.count > 0);
      if (layer.kind === "skyline") {
        assert.ok(layer.minHeight > 0 && layer.maxHeight >= layer.minHeight);
        assert.ok(layer.lit >= 0 && layer.lit <= 1);
      }
    }
    assert.ok(SCATTER_KINDS.includes(theme.decor.scatter), `${name} scatter`);
    assert.ok(LANDMARK_KINDS.includes(theme.decor.landmark), `${name} landmark`);
  }
});

test("theme selection falls back safely and honours a valid preview override", () => {
  assert.equal(getTheme("beach"), THEMES.beach);
  assert.equal(getTheme("nope"), THEMES[DEFAULT_THEME]);
  assert.equal(getTheme("toString"), THEMES[DEFAULT_THEME]);
  assert.equal(getTheme(undefined), THEMES[DEFAULT_THEME]);
  assert.equal(themeForLevel(LEVELS[1]), THEMES.forest);
  assert.equal(themeForLevel(LEVELS[1], "city"), THEMES.city);
  assert.equal(themeForLevel(LEVELS[1], "bogus"), THEMES.forest);
  assert.equal(themeForLevel(null), THEMES[DEFAULT_THEME]);
});

test("preview override is read from the query string and validated", () => {
  assert.equal(themeOverrideFromSearch("?theme=beach"), "beach");
  assert.equal(themeOverrideFromSearch("?level=2&theme=city"), "city");
  assert.equal(themeOverrideFromSearch("?theme=__proto__"), null);
  assert.equal(themeOverrideFromSearch("?theme="), null);
  assert.equal(themeOverrideFromSearch(""), null);
  assert.equal(themeOverrideFromSearch(undefined), null);
});

test("palette keys resolve while literal colors pass through", () => {
  assert.equal(resolveColor(THEMES.meadow, "hill"), THEMES.meadow.palette.hill);
  assert.equal(resolveColor(THEMES.meadow, "#123456"), "#123456");
});

function fakeCanvas() {
  const fills = new Set();
  const noop = () => {};
  const ctx = {
    imageSmoothingEnabled: true, globalAlpha: 1, font: "",
    set fillStyle(value) { fills.add(value); }, get fillStyle() { return ""; },
    fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
    save: noop, restore: noop, translate: noop, scale: noop, fillText: noop,
  };
  return { fills, canvas: { getContext: () => ctx } };
}

test("every theme renders across the level with only valid colors", () => {
  for (const name of Object.keys(THEMES)) {
    for (const reducedMotion of [false, true]) {
      const { fills, canvas } = fakeCanvas();
      const renderer = createRenderer(canvas, { themeOverride: name });
      const game = createGame();
      for (const cameraX of [0, 777, game.level.width - VIEW_WIDTH]) {
        game.cameraX = cameraX;
        assert.doesNotThrow(() => renderer.render(game, 12.5, 1 / 60, reducedMotion), `${name} @ ${cameraX}`);
      }
      for (const color of fills) assert.match(color, HEX, `${name} drew ${color}`);
    }
  }
});
