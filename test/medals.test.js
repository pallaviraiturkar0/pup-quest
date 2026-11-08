import test from "node:test";
import assert from "node:assert/strict";
import {
  BEST_TIMES_KEY, commitBestTimes, formatTime, MEDAL_COLORS, MEDALS, medalFor, medalSvg, mergeBestTimes, nextMedal, parseBestTimes,
  recordBestTime, recordKeys, runMs, serializeBestTimes, spokenTime, withSaveLock,
} from "../src/medals.js";
import { createGame, pauseGame, resumeGame, startGame, stepGame } from "../src/engine.js";
import { LEVELS, TRAILS } from "../src/levels.js";
import { contrastRatio } from "../src/trailmap.js";

const TOTAL = LEVELS.length;
const PAR = { gold: 20, silver: 30, bronze: 45 };
// A best-times array sized to the campaign, with times set only for the given trail indexes.
const trails = (entries = {}) => Array.from({ length: TOTAL }, (_, index) => entries[index] ?? null);

test("the trail timer runs only while playing, so pauses never count", () => {
  const game = createGame();
  stepGame(game, {}, 1);
  assert.equal(game.levelTime, 0, "the title screen does not start the clock");
  startGame(game);
  for (let frame = 0; frame < 120; frame += 1) stepGame(game, {}, 1 / 120);
  pauseGame(game);
  for (let frame = 0; frame < 600; frame += 1) stepGame(game, {}, 1 / 120);
  resumeGame(game);
  for (let frame = 0; frame < 60; frame += 1) stepGame(game, {}, 1 / 120);
  assert.equal(runMs(game.levelTime), 1500);
  assert.equal(runMs(Number.NaN), 0);
  assert.equal(runMs(-1), 0);
});

test("medals follow each trail's par times, inclusive of the par itself", () => {
  assert.equal(medalFor(12_345, PAR), "gold");
  assert.equal(medalFor(20_000, PAR), "gold");
  assert.equal(medalFor(20_001, PAR), "silver");
  assert.equal(medalFor(30_000, PAR), "silver");
  assert.equal(medalFor(45_000, PAR), "bronze");
  assert.equal(medalFor(45_001, PAR), null);
  assert.equal(medalFor(0, PAR), null);
  assert.deepEqual(nextMedal(45_001, PAR), { medal: "bronze", ms: 45_000 });
  assert.deepEqual(nextMedal(31_000, PAR), { medal: "silver", ms: 30_000 });
  assert.deepEqual(nextMedal(25_000, PAR), { medal: "gold", ms: 20_000 });
  assert.equal(nextMedal(19_000, PAR), null);
});

test("every trail has ordered, positive par times", () => {
  for (const level of TRAILS) {
    const { gold, silver, bronze } = level.par;
    assert.ok(gold > 0 && gold < silver && silver < bronze, `${level.name} pars are ordered`);
  }
});

test("the secret trail's best time is saved under its own key, apart from runs before the Yeti arrived", () => {
  const keys = recordKeys(TRAILS);
  assert.deepEqual(keys.slice(0, TOTAL), LEVELS.map((_, index) => String(index + 1)), "campaign trails keep their numbers");
  assert.equal(keys[TRAILS.length - 1], "8-yeti");
  const times = Array(TRAILS.length).fill(null);
  times[TRAILS.length - 1] = 30_000;
  const raw = serializeBestTimes(times, keys);
  assert.equal(raw, '{"8-yeti":30000}');
  assert.deepEqual(parseBestTimes(raw, keys), times);
  const old = '{"1":20000,"8":55000}';
  assert.deepEqual(parseBestTimes(old, keys), [20_000, ...Array(TRAILS.length - 1).fill(null)], "campaign records load; a boss-free Fjord time is not a Yeti-run record");
  const commit = commitBestTimes(times, old, keys);
  assert.equal(commit.raw, '{"1":20000,"8-yeti":30000}');
});

test("saved best times survive missing, corrupt, and tampered data", () => {
  const empty = trails();
  assert.equal(BEST_TIMES_KEY, "best-times");
  for (const raw of [null, undefined, "", "{", "null", "42", "[1,2]", '"text"']) assert.deepEqual(parseBestTimes(raw, TOTAL), empty, String(raw));
  const parsed = parseBestTimes(`{"1":19420,"2":"20000","3":-5,"4":1.5,"5":0,"6":99999999999,"${TOTAL + 1}":1000,"__proto__":5}`, TOTAL);
  assert.deepEqual(parsed, trails({ 0: 19420 }), "only whole positive milliseconds for real trails are kept");
  const times = trails({ 0: 19420, 2: 25110, 6: 61000 });
  assert.equal(serializeBestTimes(times), '{"1":19420,"3":25110,"7":61000}');
  assert.deepEqual(parseBestTimes(serializeBestTimes(times), TOTAL), times);
});

test("clearing a trail keeps the fastest time and flags only real improvements", () => {
  const start = trails();
  const first = recordBestTime(start, 2, 30_000);
  assert.deepEqual(first, { times: trails({ 2: 30_000 }), previous: null, best: 30_000, newBest: true });
  assert.deepEqual(start, trails(), "the input is not mutated");
  const slower = recordBestTime(first.times, 2, 31_000);
  assert.equal(slower.newBest, false);
  assert.equal(slower.best, 30_000);
  assert.equal(recordBestTime(first.times, 2, 30_000).newBest, false, "a tie is not a new best");
  const faster = recordBestTime(first.times, 2, 29_990);
  assert.equal(faster.newBest, true);
  assert.equal(faster.previous, 30_000);
  assert.equal(recordBestTime(first.times, 2, 0).newBest, false, "an empty run is never saved");
});

test("a stale tab never overwrites a faster time saved by another tab", () => {
  const mine = trails({ 0: 20_000, 1: 40_000 });
  const saved = serializeBestTimes(trails({ 0: 25_000, 1: 30_000, 2: 50_000 }));
  const merged = mergeBestTimes(mine, saved, TOTAL);
  assert.deepEqual(merged, trails({ 0: 20_000, 1: 30_000, 2: 50_000 }));
  const run = recordBestTime(merged, 1, 35_000);
  assert.equal(run.newBest, false, "the other tab's 0:30 still beats this tab's 0:35");
  assert.equal(run.best, 30_000);
  assert.deepEqual(mergeBestTimes(mine, "garbage", TOTAL), mine);
  assert.deepEqual(mergeBestTimes(mine, null, TOTAL), mine);
});

// A shared store plus a lock manager that grants one holder at a time, like navigator.locks across tabs.
function sharedStorage() {
  const store = { raw: null };
  let queue = Promise.resolve();
  const locks = {
    request(name, task) {
      const turn = queue.then(async () => {
        await new Promise((resolve) => setImmediate(resolve));
        return task();
      });
      queue = turn.catch(() => {});
      return turn;
    },
  };
  return { store, locks };
}

function tabSave({ store, locks }, tab) {
  return withSaveLock(locks, "pup-quest:best-times", () => {
    const commit = commitBestTimes(tab.times, store.raw, TOTAL);
    tab.times = commit.times;
    store.raw = commit.raw;
  });
}

test("overlapping saves from two tabs keep every faster time", async () => {
  const shared = sharedStorage();
  shared.store.raw = serializeBestTimes(trails({ 1: 30_000 }));
  // Both tabs loaded the 0:30 record, then each clears a run before either saves.
  const a = { times: recordBestTime(trails({ 1: 30_000 }), 1, 20_000).times };
  const b = { times: recordBestTime(trails({ 1: 30_000 }), 1, 25_000).times };
  b.times = recordBestTime(b.times, 4, 40_000).times;
  await Promise.all([tabSave(shared, a), tabSave(shared, b)]);
  assert.deepEqual(parseBestTimes(shared.store.raw, TOTAL), trails({ 1: 20_000, 4: 40_000 }), "tab A's 0:20 survives tab B's later 0:25, and B's other trail is kept");
  assert.deepEqual(b.times, trails({ 1: 20_000, 4: 40_000 }), "the later tab also learns the faster time");
});

test("saving still works without the Web Locks API or when a lock is refused", async () => {
  const store = { raw: null };
  const save = (locks, ms) => withSaveLock(locks, "best", () => {
    store.raw = commitBestTimes(trails({ 0: ms }), store.raw, TOTAL).raw;
  });
  await save(undefined, 30_000);
  await save({ request: () => Promise.reject(new DOMException("denied", "SecurityError")) }, 25_000);
  assert.deepEqual(parseBestTimes(store.raw, TOTAL), trails({ 0: 25_000 }));
  await assert.rejects(withSaveLock({ request: (name, task) => Promise.resolve().then(task) }, "best", () => { throw new Error("boom"); }), /boom/, "an error from the save itself is not retried");
});

test("times read naturally on screen and to screen readers", () => {
  assert.equal(formatTime(0), "0:00.00");
  assert.equal(formatTime(19_429), "0:19.42", "rounds down so a time is never shown faster than it was");
  assert.equal(formatTime(65_200), "1:05.20");
  assert.equal(formatTime(600_000), "10:00.00");
  assert.equal(spokenTime(19_429), "19.42 seconds");
  assert.equal(spokenTime(65_200), "1 minute 5.20 seconds");
  assert.equal(spokenTime(125_000), "2 minutes 5.00 seconds");
});

test("medals are inline pixel-art paws with readable outlines", () => {
  for (const medal of MEDALS) {
    const svg = medalSvg(medal);
    assert.match(svg, /^<svg class="medal \w+" viewBox="0 0 12 12" aria-hidden="true"/);
    assert.ok(svg.includes(MEDAL_COLORS[medal].fill));
    const { fill, ring, ink } = MEDAL_COLORS[medal];
    assert.ok(contrastRatio(ring, "#fffdf0") >= 3, `${medal} rim stands out on the card`);
    assert.ok(contrastRatio(ink, fill) >= 3, `${medal} paw stands out on the medal`);
  }
  assert.equal(medalSvg("tin"), "");
});
