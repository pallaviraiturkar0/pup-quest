import test from "node:test";
import assert from "node:assert/strict";
import {
  commitDailyBest, createRandom, DAILY_BEST_KEY, DAILY_TRAILS, dailyChallenge, MODIFIER_IDS, MODIFIERS, parseDailyBest, perches,
  remixTrail, seedFromDate, utcDateKey,
} from "../src/daily.js";
import { createGame, restartGame, startGame, stepGame } from "../src/engine.js";
import { GROUND_Y, LEVELS, TILE } from "../src/levels.js";
import { BEST_TIMES_KEY } from "../src/medals.js";
import { THEMES } from "../src/themes.js";

const YEAR = Array.from({ length: 365 }, (_, offset) => new Date(Date.UTC(2027, 0, 1) + offset * 864e5).toISOString().slice(0, 10));

test("the date key is the UTC day, whatever the local time zone", () => {
  assert.equal(utcDateKey(new Date("2026-11-09T23:30:00-05:00")), "2026-11-10");
  assert.equal(utcDateKey(new Date("2026-11-10T00:30:00+09:00")), "2026-11-09");
});

test("the same date always builds the same walk, and different days vary", () => {
  assert.equal(seedFromDate("2026-11-09"), seedFromDate("2026-11-09"));
  assert.notEqual(seedFromDate("2026-11-09"), seedFromDate("2026-11-10"));
  const a = createRandom(42);
  const b = createRandom(42);
  const sequence = Array.from({ length: 50 }, () => a());
  assert.deepEqual(Array.from({ length: 50 }, () => b()), sequence);
  assert.ok(sequence.every((value) => value >= 0 && value < 1));
  assert.deepEqual(dailyChallenge("2026-11-09"), dailyChallenge("2026-11-09"));
  const challenges = YEAR.map((date) => dailyChallenge(date));
  assert.deepEqual(new Set(challenges.map((c) => c.modifier)), new Set(MODIFIER_IDS));
  assert.deepEqual(new Set(challenges.map((c) => c.trail)), new Set(DAILY_TRAILS));
  assert.ok(new Set(challenges.map((c) => JSON.stringify(c.level.treats))).size > 300, "treat layouts should rarely repeat");
});

test("daily walks only remix boss-free trails with modifiers proven for them", () => {
  assert.ok(DAILY_TRAILS.length > 0 && DAILY_TRAILS.every((index) => !LEVELS[index].boss));
  for (const date of YEAR) {
    const { trail, modifier, title, blurb, level } = dailyChallenge(date);
    assert.ok(MODIFIERS[modifier].trails.includes(trail), `${date}: ${modifier} is not proven on trail ${trail}`);
    assert.equal(title, `${MODIFIERS[modifier].title} on ${LEVELS[trail].name}`);
    assert.equal(level.daily.title, title);
    assert.ok(blurb.length > 0);
    assert.ok(Object.hasOwn(THEMES, level.theme));
  }
});

test("a remix never moves the trail's ground, ledges, spikes, critters, key or doghouse, and never mutates the original", () => {
  const before = structuredClone(LEVELS);
  for (const date of YEAR.slice(0, 60)) {
    const { trail, level } = dailyChallenge(date);
    const base = LEVELS[trail];
    for (const field of ["ground", "gaps", "spikes", "enemies", "key", "exit", "start", "checkpoint", "width"]) {
      assert.deepEqual(level[field], base[field], `${date}: ${field} changed`);
    }
    assert.deepEqual(level.platforms.map(({ x, y, w, h }) => ({ x, y, w, h })), base.platforms.map(({ x, y, w, h }) => ({ x, y, w, h })));
  }
  assert.deepEqual(LEVELS, before);
});

const onSolid = (level, item) => {
  const ground = item.y === GROUND_Y - 20 && level.ground.some((block) => item.x >= block.x + TILE && item.x <= block.x + block.w - TILE);
  const ledge = level.platforms.some((p) => item.y === p.y - 12 && item.x >= p.x && item.x < p.x + p.w);
  return ground || ledge;
};

test("every remixed treat and power-up sits on solid footing, clear of spikes, gaps and each other", () => {
  for (const modifier of MODIFIER_IDS) {
    for (const trail of MODIFIERS[modifier].trails) {
      for (const seed of [1, 99, 2024]) {
        const base = LEVELS[trail];
        const level = remixTrail(base, modifier, createRandom(seed));
        const label = `${base.name} ${modifier} ${seed}`;
        const items = [...level.treats, ...level.powerups];
        assert.equal(level.treats.length, modifier === "snacks" ? base.treats.length + Math.ceil(base.treats.length / 2) : base.treats.length, label);
        assert.equal(level.powerups.length, base.powerups.length + (modifier === "bones" ? 3 : 0), label);
        assert.equal(new Set(items.map(({ x, y }) => `${x},${y}`)).size, items.length, `${label}: two pickups share a spot`);
        for (const item of level.treats.concat(level.powerups.slice(base.powerups.length))) {
          assert.ok(onSolid(level, item), `${label}: pickup at ${item.x},${item.y} floats over nothing`);
          assert.ok(!level.spikes.some((s) => item.x > s.x - 2 * TILE && item.x < s.x + s.w + 2 * TILE), `${label}: pickup next to spikes`);
          assert.ok(item.x < level.exit.x - TILE * 2, `${label}: pickup inside the doghouse`);
        }
      }
    }
  }
  assert.ok(perches(LEVELS[0]).length > LEVELS[0].treats.length * 2, "plenty of perches to choose from");
});

test("Slippery Day ice keeps grippy footing before every gap and around every spike", () => {
  for (const trail of MODIFIERS.slippery.trails) {
    const level = remixTrail(LEVELS[trail], "slippery", createRandom(7));
    assert.equal(level.theme, "arctic");
    assert.ok(level.ice.length > 0);
    for (const span of level.ice) {
      const block = level.ground.find((g) => span.x >= g.x && span.x + span.w <= g.x + g.w);
      assert.ok(block, `ice at ${span.x} hangs over a gap`);
      assert.ok(span.x - block.x >= 3 * TILE && block.x + block.w - (span.x + span.w) >= 3 * TILE, `ice at ${span.x} runs too close to an edge`);
      for (const spike of level.spikes) {
        assert.ok(span.x + span.w <= spike.x - 2 - 2 * TILE || span.x >= spike.x + spike.w + 2 + 2 * TILE, `ice at ${span.x} runs into spikes`);
      }
    }
    for (const platform of level.platforms) {
      if (platform.ice) assert.deepEqual(platform.ice, { x: platform.x + TILE, w: platform.w - 2 * TILE });
    }
  }
  assert.throws(() => remixTrail(LEVELS[0], "lava", createRandom(1)), /Unknown Daily Walk modifier/);
});

test("today's best time lives under its own key and resets each day", () => {
  assert.notEqual(DAILY_BEST_KEY, BEST_TIMES_KEY);
  const today = "2026-11-09";
  assert.equal(parseDailyBest(null, today), null);
  assert.equal(parseDailyBest("not json", today), null);
  assert.equal(parseDailyBest('{"date":"2026-11-08","ms":30000}', today), null);
  assert.equal(parseDailyBest('{"date":"2026-11-09","ms":-5}', today), null);
  assert.equal(parseDailyBest('{"date":"2026-11-09","ms":30000}', today), 30000);

  const first = commitDailyBest(41230, null, today);
  assert.deepEqual(first, { best: 41230, previous: null, newBest: true, raw: '{"date":"2026-11-09","ms":41230}' });
  assert.equal(commitDailyBest(50000, first.raw, today).newBest, false);
  assert.equal(commitDailyBest(50000, first.raw, today).best, 41230);
  assert.equal(commitDailyBest(41230, first.raw, today).newBest, false, "a tie is not a new best");
  assert.equal(commitDailyBest(39000, first.raw, today).best, 39000);
  assert.deepEqual(commitDailyBest(60000, first.raw, "2026-11-10"), { best: 60000, previous: null, newBest: true, raw: '{"date":"2026-11-10","ms":60000}' });
  assert.equal(commitDailyBest(50000, first.raw, today).raw, null, "nothing to save without a new best");
  assert.equal(commitDailyBest(0, null, today).raw, null);
  assert.equal(commitDailyBest(20000, '{"date":"2026-11-10","ms":90000}', today).raw, null, "yesterday's walk never overwrites today's record");
});

test("a Daily Walk ends at the doghouse, and restarting replays the same walk", () => {
  const { trail, level } = dailyChallenge("2026-11-09");
  const game = createGame(trail, { level });
  assert.equal(game.levelIndex, trail);
  assert.equal(game.level.daily.date, "2026-11-09");
  startGame(game);
  game.keyFound = true;
  game.player.x = game.level.exit.x;
  game.player.y = game.level.exit.y;
  stepGame(game);
  assert.equal(game.status, "won");
  restartGame(game);
  assert.equal(game.status, "playing");
  assert.deepEqual(game.level.treats, level.treats);
  assert.equal(game.level.daily.title, level.daily.title);
  assert.equal(createGame(trail).custom, null, "an ordinary run never inherits the remix");
  assert.equal(createGame(trail).level.daily, undefined);
});
