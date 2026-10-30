import test from "node:test";
import assert from "node:assert/strict";
import { CAT, ENEMY_TYPES, enemyReach, makeEnemy, SEAGULL, updateEnemy, VACUUM, vacuumSpots } from "../src/enemies.js";
import { createGame, intersects, startGame, stepGame } from "../src/engine.js";
import { GROUND_Y, LEVELS } from "../src/levels.js";
import { createRenderer } from "../src/render.js";

const DT = 1 / 120;
// An open stretch of Sunny Meadow ground with no platforms overhead.
const ARENA_X = 1090;
const ROOF = 176;

const critter = (type, options = {}) => makeEnemy({
  type, x: ARENA_X, left: ARENA_X - 40, right: ARENA_X + 40, speed: 20, floor: GROUND_Y, ...options,
});
const pup = (x, bottom = GROUND_Y) => ({ x, y: bottom - 18, w: 14, h: 18 });

function run(enemy, seconds, player) {
  const trace = [];
  for (let t = 0; t < seconds; t += DT) {
    updateEnemy(enemy, DT, player);
    trace.push({ x: enemy.x, y: enemy.y, mode: enemy.mode, swooping: enemy.swooping, warning: enemy.warning });
  }
  return trace;
}

function arena(enemy) {
  const game = createGame();
  startGame(game);
  stepGame(game, {}, DT);
  game.level.enemies = [enemy];
  game.events.length = 0;
  return game;
}

function place(game, x, y, vy = 0) {
  Object.assign(game.player, { x, y, vx: 0, vy, grounded: false, coyote: 0, buffer: 0, invincible: 0 });
}

function expectSideHitHurts(enemy, playerY = enemy.y) {
  const game = arena(enemy);
  place(game, enemy.x + 2, playerY);
  stepGame(game, {}, DT);
  assert.equal(game.lives, 2, `${enemy.type}: touching it from the side should cost a heart`);
  assert.equal(enemy.alive, true);
}

function expectStompBounces(enemy) {
  const game = arena(enemy);
  place(game, enemy.x + 2, enemy.y - game.player.h - 0.5, 160);
  stepGame(game, { jumpHeld: true }, DT);
  assert.equal(enemy.alive, false, `${enemy.type}: landing on top should defeat it`);
  assert.equal(game.lives, 3);
  assert.equal(game.score, 10);
  assert.ok(game.player.vy < 0, `${enemy.type}: the pup should bounce`);
  const stomp = game.events.find((event) => event.type === "stomp");
  assert.equal(stomp.x, enemy.x + enemy.w / 2);
}

test("critters are built from data and reject unknown types or bad patrols", () => {
  assert.deepEqual(ENEMY_TYPES, ["squirrel", "vacuum", "seagull", "cat"]);
  for (const type of ENEMY_TYPES) {
    const enemy = critter(type);
    assert.equal(enemy.type, type);
    assert.equal(enemy.alive, true);
    assert.ok(enemy.w > 0 && enemy.h > 0);
  }
  assert.throws(() => critter("dragon"), /Unknown critter type/);
  assert.throws(() => critter("cat", { x: ARENA_X + 100 }), /outside its patrol/);
  const squirrel = LEVELS[0].enemies[0];
  assert.deepEqual([squirrel.type, squirrel.w, squirrel.h, squirrel.y], ["squirrel", 18, 12, GROUND_Y - 12]);
});

test("squirrels pace back and forth between their patrol posts", () => {
  const enemy = critter("squirrel");
  const trace = run(enemy, 10);
  assert.ok(trace.every(({ x, y }) => x >= enemy.left && x <= enemy.right && y === GROUND_Y - enemy.h));
  assert.equal(Math.min(...trace.map(({ x }) => x)), enemy.left);
  assert.equal(Math.max(...trace.map(({ x }) => x)), enemy.right);
});

test("a robot vacuum only notices a pup ahead of it on its own floor", () => {
  const enemy = critter("vacuum");
  assert.equal(vacuumSpots(enemy, pup(ARENA_X + 60)), true);
  assert.equal(vacuumSpots(enemy, pup(ARENA_X - 40)), false, "behind it");
  assert.equal(vacuumSpots(enemy, pup(ARENA_X + 60, GROUND_Y - 40)), false, "on a ledge above it");
  assert.equal(vacuumSpots(enemy, pup(ARENA_X + VACUUM.sight + 30)), false, "too far away");
  assert.equal(vacuumSpots(enemy, null), false);
});

test("a robot vacuum revs up in place, dashes at triple speed, then cools down", () => {
  const enemy = critter("vacuum");
  const player = pup(ARENA_X + 70);
  updateEnemy(enemy, DT, player);
  assert.equal(enemy.mode, "windup");
  const revX = enemy.x;
  run(enemy, VACUUM.windup - 2 * DT, player);
  assert.equal(enemy.mode, "windup");
  assert.equal(enemy.x, revX, "it telegraphs the dash by holding still");
  run(enemy, 3 * DT, player);
  assert.equal(enemy.mode, "dash");
  const before = enemy.x;
  updateEnemy(enemy, DT, player);
  assert.ok(Math.abs(enemy.x - before - enemy.speed * VACUUM.dashMultiplier * DT) < 1e-9);
  while (enemy.mode === "dash") updateEnemy(enemy, DT, player);
  assert.equal(enemy.mode, "patrol", "hitting the end of its beat ends the dash");
  assert.equal(enemy.x, enemy.right);
  assert.equal(enemy.direction, -1);
  const ahead = pup(enemy.left);
  run(enemy, VACUUM.cooldown - 0.1, ahead);
  assert.equal(enemy.mode, "patrol", "no new dash while cooling down");
  run(enemy, 0.2, ahead);
  assert.equal(enemy.mode, "windup", "it can spot the pup again after cooling down");
});

test("robot vacuums hurt on contact and can be stomped", () => {
  expectSideHitHurts(critter("vacuum"), GROUND_Y - 18);
  expectStompBounces(critter("vacuum"));
});

test("a seagull cruises above the pup's head, warns, then swoops to puppy height", () => {
  const enemy = critter("seagull", { speed: 24 });
  const standing = pup(0);
  const cruiseBottom = GROUND_Y - SEAGULL.altitude + SEAGULL.bob;
  const trace = run(enemy, SEAGULL.period * 2);
  const glide = trace.filter((frame) => !frame.swooping);
  assert.ok(glide.every(({ y }) => y + enemy.h <= cruiseBottom + 1e-9), "gliding stays high");
  assert.ok(glide.every(({ y }) => y + enemy.h < standing.y), "a standing pup is safe while it glides");
  const lowest = Math.max(...trace.map(({ y }) => y));
  assert.ok(Math.abs(lowest + enemy.h - (GROUND_Y - SEAGULL.swoopClearance)) < 0.5);
  assert.ok(lowest + enemy.h > standing.y, "the swoop reaches a standing pup");
  const firstSwoop = trace.findIndex((frame) => frame.swooping);
  assert.ok(trace[firstSwoop - 1].warning, "a warning comes right before the swoop");
  assert.ok(Math.abs(firstSwoop * DT - (SEAGULL.period - SEAGULL.swoopTime)) < 2 * DT);
  assert.ok(trace.every(({ x }) => x >= enemy.left && x <= enemy.right));
});

test("seagull phases stagger flocks so they do not swoop together", () => {
  const early = critter("seagull");
  const late = critter("seagull", { phase: 1.3 });
  const a = run(early, SEAGULL.period).findIndex((frame) => frame.swooping);
  const b = run(late, SEAGULL.period).findIndex((frame) => frame.swooping);
  assert.ok(Math.abs((a - b) * DT - 1.3) < 2 * DT);
});

test("a swooping seagull hurts a standing pup, and a gliding one can be stomped", () => {
  const swooping = critter("seagull");
  run(swooping, SEAGULL.period - SEAGULL.swoopTime / 2);
  assert.equal(swooping.swooping, true);
  expectSideHitHurts(swooping, GROUND_Y - 18);
  expectStompBounces(critter("seagull"));
});

test("an alley cat prowls its rooftop, crouches as a tell, then pounces and lands", () => {
  const enemy = critter("cat", { floor: ROOF, speed: 18 });
  const rest = ROOF - enemy.h;
  let trace = run(enemy, CAT.period - DT);
  assert.ok(trace.every(({ y, mode }) => y === rest && mode === "prowl"));
  updateEnemy(enemy, DT);
  updateEnemy(enemy, DT);
  assert.equal(enemy.mode, "crouch");
  const crouchX = enemy.x;
  run(enemy, CAT.crouch - 2 * DT);
  assert.equal(enemy.x, crouchX, "it freezes while crouching");
  trace = run(enemy, 2 * CAT.pounce / CAT.gravity + 0.1);
  const peak = Math.min(...trace.map(({ y }) => y));
  assert.ok(Math.abs(rest - peak - CAT.pounce ** 2 / (2 * CAT.gravity)) < 2);
  assert.ok(trace.some(({ mode }) => mode === "pounce"));
  assert.equal(enemy.mode, "prowl");
  assert.equal(enemy.y, rest, "it lands back on the same rooftop");
  assert.ok(trace.every(({ x }) => x >= enemy.left && x <= enemy.right));
});

test("a pouncing cat covers ground faster than a prowling one", () => {
  const prowl = critter("cat", { x: ARENA_X - 40 });
  const start = prowl.x;
  updateEnemy(prowl, DT);
  const prowlStep = prowl.x - start;
  const pounce = critter("cat", { x: ARENA_X - 40, phase: CAT.period });
  run(pounce, CAT.crouch + 2 * DT);
  assert.equal(pounce.mode, "pounce");
  const before = pounce.x;
  updateEnemy(pounce, DT);
  assert.ok(Math.abs(pounce.x - before - prowlStep * CAT.leapMultiplier) < 1e-9);
});

test("alley cats hurt on contact and can be stomped", () => {
  expectSideHitHurts(critter("cat"), GROUND_Y - 18);
  expectStompBounces(critter("cat"));
});

test("each critter's reach box covers every spot it visits", () => {
  for (const type of ENEMY_TYPES) {
    const enemy = critter(type, { floor: type === "cat" ? ROOF : GROUND_Y });
    const reach = enemyReach(enemy);
    const player = pup(ARENA_X + 30);
    for (const frame of run(enemy, 8, player)) {
      const box = { x: frame.x, y: frame.y, w: enemy.w, h: enemy.h };
      assert.ok(box.x >= reach.x - 1e-9 && box.x + box.w <= reach.x + reach.w + 1e-9, `${type} left its reach horizontally`);
      assert.ok(box.y >= reach.y - 0.5 && box.y + box.h <= reach.y + reach.h + 1e-9, `${type} left its reach vertically`);
      assert.ok(intersects(box, reach));
    }
  }
});

test("every critter draws in each of its moods using only hex colors", () => {
  const moods = [
    critter("squirrel"),
    critter("vacuum"), { ...critter("vacuum"), mode: "windup" }, { ...critter("vacuum"), mode: "dash", direction: -1 },
    critter("seagull"), { ...critter("seagull"), warning: true }, { ...critter("seagull"), swooping: true, y: GROUND_Y - 30 },
    critter("cat"), { ...critter("cat"), mode: "crouch" }, { ...critter("cat"), mode: "pounce", direction: -1 },
  ];
  for (const enemy of moods) {
    const fills = new Set();
    const noop = () => {};
    const ctx = {
      imageSmoothingEnabled: true, globalAlpha: 1, font: "",
      set fillStyle(value) { fills.add(value); }, get fillStyle() { return ""; },
      fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
      save: noop, restore: noop, translate: noop, scale: noop, fillText: noop,
    };
    const renderer = createRenderer({ getContext: () => ctx });
    const game = createGame();
    game.level.enemies = [enemy];
    game.cameraX = ARENA_X - 200;
    for (const reducedMotion of [false, true]) {
      assert.doesNotThrow(() => renderer.render(game, 3.3, 1 / 60, reducedMotion), `${enemy.type} ${enemy.mode ?? ""}`);
    }
    for (const color of fills) assert.match(color, /^#[0-9a-f]{6}$/i, `${enemy.type} drew ${color}`);
  }
});
