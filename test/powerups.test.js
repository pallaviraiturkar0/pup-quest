import test from "node:test";
import assert from "node:assert/strict";
import { makeEnemy } from "../src/enemies.js";
import { createGame, nextLevel, PHYSICS, startGame, stepGame } from "../src/engine.js";
import { GROUND_Y, LEVELS } from "../src/levels.js";
import { makePowerup, MAX_LIVES, POWERUP_TYPES, POWERUPS } from "../src/powerups.js";
import { createRenderer } from "../src/render.js";

const tick = (game, input = {}) => stepGame(game, input, 1 / 120);

// An empty, flat arena so each power-up can be tested in isolation.
function arena(...powerups) {
  const game = createGame();
  startGame(game);
  Object.assign(game.level, {
    ground: [{ x: 0, y: GROUND_Y, w: game.level.width, h: 80 }], platforms: [], spikes: [],
    treats: [], enemies: [], powerups,
  });
  Object.assign(game.player, { x: 400, y: GROUND_Y - 18, vx: 0, vy: 0, grounded: true });
  tick(game);
  game.events.length = 0;
  return game;
}

const atPup = (game, type) => makePowerup(type, game.player.x + 7, game.player.y + 9);
const squirrel = (x) => makeEnemy({ x, left: x - 32, right: x + 32, speed: 20, floor: GROUND_Y });

test("unknown power-up types are rejected", () => {
  assert.throws(() => makePowerup("tennis-ball", 0, 0), /Unknown power-up/);
  assert.deepEqual(POWERUP_TYPES, ["bone", "zoomies", "squeaky"]);
});

test("power-ups are picked up once, award points, and announce themselves", () => {
  const game = arena();
  const item = makePowerup("zoomies", game.player.x + 7, game.player.y + 9);
  const far = makePowerup("bone", game.player.x + 200, game.player.y + 9);
  game.level.powerups.push(item, far);
  const score = game.score;
  tick(game);
  assert.equal(item.collected, true);
  assert.equal(far.collected, false);
  assert.equal(game.score, score + POWERUPS.zoomies.score);
  assert.deepEqual(game.events.map((event) => [event.type, event.powerup]), [["powerup", "zoomies"]]);
  tick(game);
  assert.equal(game.score, score + POWERUPS.zoomies.score, "collected power-ups never pay out twice");
});

test("a bone treat adds a heart, up to the heart cap", () => {
  const game = arena();
  game.level.powerups.push(atPup(game, "bone"));
  tick(game);
  assert.equal(game.lives, 4);
  game.lives = MAX_LIVES;
  game.level.powerups.push(atPup(game, "bone"));
  tick(game);
  assert.equal(game.lives, MAX_LIVES);
});

test("extra hearts from bone treats carry over to the next trail", () => {
  const game = arena();
  game.lives = 4;
  game.status = "level-complete";
  nextLevel(game);
  assert.equal(game.lives, 4);
  game.lives = 2;
  game.status = "level-complete";
  nextLevel(game);
  assert.equal(game.lives, 3, "the usual one-heart top-up still applies");
});

test("the zoomies raise top speed for a while, then wear off", () => {
  const game = arena();
  game.level.powerups.push(atPup(game, "zoomies"));
  tick(game);
  assert.equal(game.player.zoomies, POWERUPS.zoomies.duration);
  for (let i = 0; i < 120; i += 1) tick(game, { right: true });
  const boosted = PHYSICS.speed * POWERUPS.zoomies.speedMultiplier;
  assert.ok(Math.abs(game.player.vx - boosted) < 1, `expected ~${boosted}, got ${game.player.vx}`);
  for (let i = 0; i < 120 * POWERUPS.zoomies.duration; i += 1) tick(game, { right: true });
  assert.equal(game.player.zoomies, 0);
  assert.ok(Math.abs(game.player.vx - PHYSICS.speed) < 1, "speed returns to normal");
});

test("losing a heart ends the zoomies", () => {
  const game = arena();
  game.level.powerups.push(atPup(game, "zoomies"));
  tick(game);
  game.level.spikes.push({ x: game.player.x, y: game.player.y + 10, w: 14, h: 8 });
  tick(game);
  assert.equal(game.lives, 2);
  assert.equal(game.player.zoomies, 0);
});

test("a squeaky toy freezes nearby critters, which cannot hurt the pup until it wears off", () => {
  const game = arena();
  const near = squirrel(game.player.x + 60);
  const distant = squirrel(game.player.x + POWERUPS.squeaky.radius + 80);
  game.level.enemies.push(near, distant);
  game.level.powerups.push(atPup(game, "squeaky"));
  tick(game);
  assert.equal(game.events.find((event) => event.type === "powerup").scared, 1);
  assert.equal(near.scared, POWERUPS.squeaky.duration);
  assert.ok(!(distant.scared > 0), "critters far away are not scared");

  const frozenAt = near.x;
  const distantAt = distant.x;
  tick(game);
  assert.equal(near.x, frozenAt, "scared critters stop moving");
  assert.notEqual(distant.x, distantAt);

  Object.assign(game.player, { x: near.x, y: near.y - 4, vy: 0 });
  near.x = game.player.x;
  tick(game);
  assert.equal(game.lives, 3, "touching a scared critter is harmless");
  assert.equal(near.alive, true);

  for (let i = 0; i < 120 * POWERUPS.squeaky.duration; i += 1) {
    Object.assign(game.player, { x: 100, y: GROUND_Y - 18, vx: 0, vy: 0 });
    tick(game);
  }
  assert.equal(near.scared, 0);
  const thawedAt = near.x;
  tick(game);
  assert.notEqual(near.x, thawedAt, "critters move again once the fright wears off");
});

test("scared critters can still be stomped for points", () => {
  const game = arena();
  const critter = squirrel(game.player.x + 40);
  critter.scared = 2;
  game.level.enemies.push(critter);
  Object.assign(game.player, { x: critter.x + 2, y: critter.y - 18 - 1, vy: 120, grounded: false });
  const score = game.score;
  tick(game);
  assert.equal(critter.alive, false);
  assert.equal(game.score, score + 10);
});

test("every trail offers one of each power-up, and level definitions are not mutated", () => {
  for (const level of LEVELS) {
    assert.deepEqual(level.powerups.map((item) => item.type).sort(), [...POWERUP_TYPES].sort(), level.name);
  }
  const game = createGame();
  game.level.powerups[0].collected = true;
  assert.equal(LEVELS[0].powerups[0].collected, false);
});

test("power-ups, scared critters, and zoomies draw using only hex colors", () => {
  const fills = new Set();
  const noop = () => {};
  const ctx = {
    imageSmoothingEnabled: true, globalAlpha: 1, font: "",
    set fillStyle(value) { fills.add(value); }, get fillStyle() { return ""; },
    fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
    save: noop, restore: noop, translate: noop, scale: noop, fillText: noop,
  };
  const renderer = createRenderer({ getContext: () => ctx });
  const game = arena();
  game.level.powerups.push(...POWERUP_TYPES.map((type, index) => makePowerup(type, game.player.x + 30 + index * 20, GROUND_Y - 20)));
  const critter = squirrel(game.player.x + 120);
  critter.scared = 1;
  game.level.enemies.push(critter);
  Object.assign(game.player, { zoomies: 2, vx: 150 });
  game.cameraX = game.player.x - 100;
  for (const time of [0, 0.25, 0.5, 0.75]) {
    for (const reducedMotion of [false, true]) {
      assert.doesNotThrow(() => renderer.render(game, time, 1 / 60, reducedMotion));
    }
  }
  for (const color of fills) assert.match(color, /^#[0-9a-f]{6}$/i, `drew ${color}`);
});
