import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseTrail, createTrailMap, isUnlocked, mergeUnlocked, moveSelection, parseUnlocked, stopColors, trailPath, unlockAfterClear,
} from "../src/trailmap.js";
import { createGame, nextLevel, restartGame, startGame } from "../src/engine.js";
import { LEVELS } from "../src/levels.js";
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

test("each stop is tinted by its trail's theme with readable ink", () => {
  for (const level of LEVELS) {
    const colors = stopColors(level.theme);
    assert.equal(colors.fill, THEMES[level.theme].palette.sky);
    assert.notEqual(colors.ink, colors.fill);
  }
  assert.equal(stopColors("night").dark, true);
  assert.equal(stopColors("castle").ink, THEMES.castle.palette.flower);
  assert.equal(stopColors("meadow").dark, false);
  assert.equal(stopColors("meadow").ink, THEMES.meadow.palette.tree);
});
