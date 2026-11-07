import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseTrail, contrastRatio, createTrailMap, isStopOpen, isUnlocked, mergeUnlocked, moveSelection, parseUnlocked, secretTrailOpen, stopColors,
  trailPath, unlockAfterClear,
} from "../src/trailmap.js";
import { createGame, nextLevel, restartGame, startGame } from "../src/engine.js";
import { LEVELS, SECRET_INDEX } from "../src/levels.js";
import { THEMES } from "../src/themes.js";

const TOTAL = LEVELS.length;

test("saved progress parses safely and trail 01 is always open", () => {
  assert.equal(parseUnlocked(null, TOTAL), 1);
  assert.equal(parseUnlocked("", TOTAL), 1);
  assert.equal(parseUnlocked("banana", TOTAL), 1);
  assert.equal(parseUnlocked("2.5", TOTAL), 1);
  assert.equal(parseUnlocked("0", TOTAL), 1);
  assert.equal(parseUnlocked("-3", TOTAL), 1);
  assert.equal(parseUnlocked("4", TOTAL), 4);
  assert.equal(parseUnlocked("99", TOTAL), TOTAL);
});

test("clearing a trail unlocks the next one and never re-locks", () => {
  assert.equal(unlockAfterClear(1, 0, TOTAL), 2);
  assert.equal(unlockAfterClear(2, 1, TOTAL), 3);
  assert.equal(unlockAfterClear(5, 0, TOTAL), 5, "replaying an early trail keeps later trails open");
  assert.equal(unlockAfterClear(TOTAL, TOTAL - 1, TOTAL), TOTAL, "the finale cannot unlock past the last trail");
  assert.ok(isUnlocked(0, 1));
  assert.ok(!isUnlocked(1, 1));
  assert.ok(!isUnlocked(-1, 3));
});

test("progress saved by another tab is never overwritten with a smaller count", () => {
  assert.equal(mergeUnlocked(2, "5", TOTAL), 5);
  assert.equal(unlockAfterClear(mergeUnlocked(2, "5", TOTAL), 0, TOTAL), 5, "clearing trail 01 in a stale tab keeps 05 open");
  assert.equal(mergeUnlocked(4, "2", TOTAL), 4);
  assert.equal(mergeUnlocked(3, null, TOTAL), 3);
  assert.equal(mergeUnlocked(3, "junk", TOTAL), 3);
});

test("arrow keys walk every stop, clamp at the ends, and ignore other keys", () => {
  const map = createTrailMap(3, TOTAL);
  assert.equal(map.selected, 2, "opens on the furthest unlocked trail");
  assert.ok(moveSelection(map, "ArrowRight"));
  assert.equal(map.selected, 3, "locked stops can be focused so their padlock is announced");
  moveSelection(map, "End");
  assert.equal(map.selected, TOTAL - 1);
  moveSelection(map, "ArrowDown");
  assert.equal(map.selected, TOTAL - 1);
  moveSelection(map, "Home");
  moveSelection(map, "ArrowLeft");
  moveSelection(map, "ArrowUp");
  assert.equal(map.selected, 0);
  assert.equal(moveSelection(map, "KeyQ"), false);
});

test("only unlocked trails can be chosen", () => {
  const map = createTrailMap(2, TOTAL, 0);
  assert.equal(map.selected, 0);
  assert.equal(chooseTrail(map), 0);
  assert.equal(chooseTrail(map, 1), 1);
  assert.equal(chooseTrail(map, 2), null);
  assert.equal(chooseTrail(map, TOTAL - 1), null);
  assert.equal(createTrailMap(2, TOTAL, 6).selected, 1, "a preferred locked trail falls back to the furthest open one");
});

test("a game can start, advance, and restart from a chosen trail", () => {
  const game = createGame(3);
  assert.equal(game.levelIndex, 3);
  assert.equal(game.level.name, LEVELS[3].name);
  startGame(game);
  assert.equal(game.status, "playing");
  assert.deepEqual(game.events, [{ type: "start" }]);
  game.status = "level-complete";
  nextLevel(game);
  assert.equal(game.levelIndex, 4);
  game.status = "game-over";
  restartGame(game);
  assert.equal(game.levelIndex, 3, "try again goes back to the picked trail");
  assert.equal(game.lives, 3);
  restartGame(game, 0);
  assert.equal(game.levelIndex, 0);
  assert.equal(createGame(99).levelIndex, 0, "out-of-range picks fall back to trail 01");
  assert.equal(createGame().levelIndex, 0);
});

test("the winding path is deterministic, in bounds, and moves left to right", () => {
  const first = trailPath(TOTAL);
  assert.deepEqual(trailPath(TOTAL), first);
  assert.equal(first.stops.length, TOTAL);
  assert.match(first.d, /^M\d+ \d+( C[\d. -]+){6}$/);
  for (const [index, stop] of first.stops.entries()) {
    assert.ok(stop.x >= 40 && stop.x <= 440 && stop.y >= 40 && stop.y <= 216, `stop ${index} in bounds`);
    if (index) {
      const previous = first.stops[index - 1];
      assert.ok(stop.x > previous.x, "stops progress left to right");
      assert.ok(Math.hypot(stop.x - previous.x, stop.y - previous.y) >= 50, "stops are far enough apart to tap");
    }
  }
  assert.ok(new Set(first.stops.map(({ y }) => y)).size > 3, "the path winds instead of running flat");
  assert.notDeepEqual(trailPath(TOTAL, { seed: 99 }).stops, first.stops);
});

test("each stop is tinted by its trail's theme with a paw that meets 3:1 contrast", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(1), "21.0");
  for (const name of Object.keys(THEMES)) {
    const colors = stopColors(name);
    assert.equal(colors.fill, THEMES[name].palette.sky);
    assert.ok(contrastRatio(colors.ink, colors.fill) >= 3, `${name} paw contrast`);
  }
  assert.equal(stopColors("night").dark, true);
  assert.equal(stopColors("castle").ink, THEMES.castle.palette.flower, "night skies keep a themed light ink");
  assert.equal(stopColors("forest").ink, THEMES.forest.palette.tree, "the theme's tree colour is used when it is readable");
  assert.equal(stopColors("beach").ink, "#283d32", "falls back to page ink when no theme colour is readable");
});

test("the secret trail opens after beating the Mega-Vac or earning any gold paw", () => {
  const times = (entries = {}) => Array.from({ length: TOTAL + 1 }, (_, index) => entries[index] ?? null);
  const par = (index, medal) => LEVELS[index].par[medal] * 1000;
  assert.equal(secretTrailOpen(times(), LEVELS), false, "a fresh save keeps it hidden");
  assert.equal(secretTrailOpen(null, LEVELS), false);
  assert.equal(secretTrailOpen(times({ 0: par(0, "silver"), 3: par(3, "bronze") }), LEVELS), false, "silver and bronze are not enough");
  assert.equal(secretTrailOpen(times({ 2: par(2, "gold") }), LEVELS), true, "a gold paw on any trail");
  assert.equal(secretTrailOpen(times({ [TOTAL - 1]: par(TOTAL - 1, "bronze") * 2 }), LEVELS), true, "any clear of the boss finale");
  assert.equal(secretTrailOpen(times({ [TOTAL]: 1000 }), LEVELS), false, "its own time cannot open it");
  assert.equal(secretTrailOpen(times({ [TOTAL - 1]: -5 }), LEVELS), false, "tampered times are ignored");
});

test("once found, the secret trail is an extra open stop on the map, even with campaign trails still locked", () => {
  const hidden = createTrailMap(2, TOTAL);
  assert.equal(hidden.total, TOTAL);
  assert.equal(chooseTrail(hidden, SECRET_INDEX), null);
  const map = createTrailMap(2, TOTAL, 1, { secret: true });
  assert.equal(map.total, TOTAL + 1);
  assert.equal(isStopOpen(map, SECRET_INDEX), true);
  assert.equal(isStopOpen(map, 2), false, "finding the secret never opens campaign trails");
  assert.equal(chooseTrail(map, SECRET_INDEX), SECRET_INDEX);
  moveSelection(map, "End");
  assert.equal(map.selected, SECRET_INDEX);
  assert.equal(createTrailMap(2, TOTAL, SECRET_INDEX, { secret: true }).selected, SECRET_INDEX, "replaying it reopens the map on its stop");
  assert.equal(createTrailMap(2, TOTAL, SECRET_INDEX).selected, 1, "a hidden secret falls back to the furthest open trail");
  assert.equal(trailPath(TOTAL + 1).stops.length, TOTAL + 1);
});
