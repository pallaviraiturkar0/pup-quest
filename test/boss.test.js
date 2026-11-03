import test from "node:test";
import assert from "node:assert/strict";
import { BOSS, BOSS_MODES, bossDangerous, bossHealth, makeBoss, resetBoss, stompBoss, updateBoss } from "../src/boss.js";
import { createGame, keyAvailable, nextLevel, startGame, stepGame } from "../src/engine.js";
import { enemyReach } from "../src/enemies.js";
import { GROUND_Y, LEVELS } from "../src/levels.js";
import { createRenderer } from "../src/render.js";

const DT = 1 / 120;
const arena = () => makeBoss({ x: 200, left: 100, right: 400, floor: GROUND_Y });
const pupAt = (x, y = GROUND_Y - 18) => ({ x, y, w: 14, h: 18, vx: 0, vy: 0 });

function run(boss, seconds, player) {
  const cues = [];
  for (let t = 0; t < seconds; t += DT) {
    const cue = updateBoss(boss, DT, player);
    if (cue) cues.push(cue);
  }
  return cues;
}

function runUntil(boss, mode, player, limit = 20) {
  for (let t = 0; t < limit; t += DT) {
    if (boss.mode === mode) return t;
    updateBoss(boss, DT, player);
  }
  assert.fail(`boss never reached ${mode}; stuck in ${boss.mode}`);
}

test("the Mega-Vac must start inside its arena", () => {
  assert.throws(() => makeBoss({ x: 380, left: 100, right: 400, floor: GROUND_Y }), /outside its arena/);
  const boss = arena();
  assert.equal(boss.mode, "sleep");
  assert.equal(boss.y + boss.h, GROUND_Y);
  assert.equal(bossHealth(boss), BOSS.hits);
  assert.ok(BOSS_MODES.includes(boss.mode));
});

test("it naps until the pup steps into the arena, then wakes facing the pup", () => {
  const boss = arena();
  assert.deepEqual(run(boss, 3, pupAt(40)), []);
  assert.equal(boss.mode, "sleep");
  assert.equal(boss.x, 200, "a sleeping boss stays put");
  assert.deepEqual(run(boss, DT, pupAt(110)), ["boss-wake"]);
  assert.equal(boss.mode, "roam");
  assert.equal(boss.direction, -1);
});

test("roam, a visible wind-up, then a charge toward the pup that ends dizzy at the wall", () => {
  const boss = arena();
  const pup = pupAt(105);
  updateBoss(boss, DT, pup);
  const roam = runUntil(boss, "windup", pup);
  assert.ok(Math.abs(roam - BOSS.roamTime) < 0.05, `roamed for ${roam}s`);
  assert.equal(boss.direction, -1, "it revs up facing the pup");
  const windup = runUntil(boss, "charge", pup);
  assert.ok(Math.abs(windup - BOSS.windup[0]) < 0.05, `wound up for ${windup}s`);
  const before = boss.x;
  updateBoss(boss, 0.1, pup);
  assert.ok(Math.abs(before - boss.x - BOSS.chargeSpeed[0] * 0.1) < 0.01, "it charges at full speed");
  const cues = [];
  while (boss.mode === "charge") cues.push(updateBoss(boss, DT, pup));
  assert.ok(cues.includes("boss-crash"));
  assert.equal(boss.mode, "dizzy");
  assert.equal(boss.x, boss.left, "it stops against the arena wall");
});

test("a charge always runs toward where the pup was when it revved up", () => {
  const boss = arena();
  const pup = pupAt(380);
  updateBoss(boss, DT, pup);
  runUntil(boss, "charge", pup);
  assert.equal(boss.direction, 1);
  runUntil(boss, "dizzy", pupAt(105));
  assert.equal(boss.x + boss.w, boss.right, "it doesn't turn around mid-charge");
});

test("only a dizzy Mega-Vac can be stomped; three stomps power it down", () => {
  const boss = arena();
  for (const mode of ["sleep", "roam", "windup", "charge", "hurt"]) {
    boss.mode = mode;
    assert.equal(stompBoss(boss), null, `${mode} shrugs off a stomp`);
  }
  for (const [index, expected] of ["boss-hit", "boss-hit", "boss-defeated"].entries()) {
    boss.mode = "dizzy";
    assert.equal(stompBoss(boss), expected);
    assert.equal(boss.hits, index + 1);
  }
  assert.equal(boss.mode, "defeated");
  assert.equal(bossHealth(boss), 0);
  assert.deepEqual(run(boss, 5, pupAt(150)), [], "a defeated boss stays down");
});

test("being dizzy or hurt wears off, and each stomp makes the next round quicker", () => {
  const boss = arena();
  const pup = pupAt(105);
  Object.assign(boss, { mode: "dizzy", timer: BOSS.dizzy, x: boss.left });
  run(boss, BOSS.dizzy + 0.02, pup);
  assert.equal(boss.mode, "roam");
  assert.equal(boss.direction, 1, "it rolls away from the wall it hit");
  boss.mode = "dizzy";
  stompBoss(boss);
  assert.equal(boss.mode, "hurt");
  assert.equal(bossDangerous(boss), false, "a hurt boss is safe to touch");
  run(boss, BOSS.hurt + 0.02, pup);
  assert.equal(boss.mode, "roam");
  for (const list of [BOSS.roamSpeed, BOSS.chargeSpeed]) assert.ok(list[0] < list[1] && list[1] < list[2]);
  assert.ok(BOSS.windup[2] < BOSS.windup[0]);
  assert.ok(BOSS.windup.every((seconds) => seconds >= 0.5), "the tell is always readable");
  assert.ok(BOSS.dizzy >= 2, "there is always time to reach the lid");
});

test("resetting after a lost heart sends it home to nap but keeps its dents", () => {
  const boss = arena();
  Object.assign(boss, { mode: "charge", x: 120, hits: 2, direction: 1 });
  resetBoss(boss);
  assert.deepEqual([boss.mode, boss.x, boss.hits], ["sleep", 200, 2]);
  boss.mode = "defeated";
  resetBoss(boss);
  assert.equal(boss.mode, "defeated");
});

function finale() {
  const game = createGame();
  startGame(game);
  game.levelIndex = LEVELS.length - 2;
  game.status = "level-complete";
  nextLevel(game);
  stepGame(game);
  game.events.length = 0;
  return game;
}

function place(game, x, y, vy = 0) {
  Object.assign(game.player, { x, y, vx: 0, vy, grounded: false, coyote: 0, buffer: 0, invincible: 0 });
}

test("Moonlit Keep is the finale trail, right after Neon Nightwalk, and the only boss trail", () => {
  assert.equal(LEVELS[5].name, "Neon Nightwalk");
  assert.equal(LEVELS[6].name, "Moonlit Keep");
  assert.equal(LEVELS.at(-1), LEVELS[6]);
  assert.deepEqual(LEVELS.map((level) => Boolean(level.boss)), [false, false, false, false, false, false, true]);
  const game = finale();
  assert.equal(game.level.name, "Moonlit Keep");
  assert.equal(game.level.boss.mode, "sleep");
});

test("the arena is fair: solid floor, safe wall ledges, no other critters, checkpoint and key placed sensibly", () => {
  const level = LEVELS[6];
  const { boss } = level;
  assert.ok(level.ground.some((ground) => ground.x <= boss.left && boss.right <= ground.x + ground.w), "no water inside the arena");
  assert.ok(level.spikes.every((spike) => spike.x + spike.w < boss.left - 32 || spike.x > boss.right), "no spikes in the arena");
  for (const enemy of level.enemies) {
    const reach = enemyReach(enemy);
    assert.ok(reach.x + reach.w < boss.left - 32, `${enemy.type} at ${enemy.x} wanders into the arena`);
  }
  assert.ok(level.checkpoint.x + 40 < boss.left, "the checkpoint sits just before the arena");
  assert.ok(boss.left < level.key.x && level.key.x < boss.right, "the key drops inside the arena");
  assert.ok(level.exit.x >= boss.right, "the doghouse waits past the arena");
  for (const [wall, side] of [[boss.left, "left"], [boss.right - boss.w, "right"]]) {
    const ledge = level.platforms.find((platform) => platform.x < wall + boss.w && wall < platform.x + platform.w);
    assert.ok(ledge, `no ledge above the ${side} wall`);
    assert.ok(ledge.y <= boss.y - 4, `the ${side} ledge is low enough for the boss to hit the pup`);
    const covered = Math.min(ledge.x + ledge.w, wall + boss.w) - Math.max(ledge.x, wall);
    assert.ok(boss.w - covered >= 24, `the ${side} ledge leaves room to drop onto the lid`);
  }
});

test("the golden key stays hidden until the Mega-Vac is beaten", () => {
  const game = finale();
  const { key, boss } = game.level;
  assert.equal(keyAvailable(game.level), false);
  place(game, key.x - 7, key.y - 9);
  stepGame(game);
  assert.equal(game.keyFound, false);
  boss.mode = "defeated";
  assert.equal(keyAvailable(game.level), true);
  place(game, key.x - 7, key.y - 9);
  stepGame(game);
  assert.equal(game.keyFound, true);
  assert.equal(keyAvailable(LEVELS[0]), true, "ordinary trails keep their key out");
});

test("the doghouse stays locked with a boss hint while the Mega-Vac is awake", () => {
  const game = finale();
  place(game, game.level.exit.x + 8, GROUND_Y - 18);
  stepGame(game);
  assert.equal(game.status, "playing");
  assert.ok(game.events.some((event) => event.type === "need-key"));
});

test("in the engine, side contact hurts, stomping a non-dizzy lid bonks, and three dizzy stomps win the key", () => {
  const game = finale();
  const { boss } = game.level;
  Object.assign(boss, { mode: "roam", timer: 10 });
  place(game, boss.x - 10, GROUND_Y - 18);
  stepGame(game);
  assert.equal(game.deaths, 1, "running into its side costs a heart");
  assert.equal(boss.mode, "sleep", "it rolls home after the pup respawns");

  Object.assign(boss, { mode: "roam", timer: 10 });
  game.events.length = 0;
  place(game, boss.x + 10, boss.y - 18, 120);
  stepGame(game);
  assert.equal(game.deaths, 1);
  assert.ok(game.player.vy < 0, "the pup bounces off");
  assert.equal(boss.hits, 0);
  assert.ok(game.events.some((event) => event.type === "boss-bonk"));

  const score = game.score;
  for (let round = 1; round <= BOSS.hits; round += 1) {
    Object.assign(boss, { mode: "dizzy", timer: BOSS.dizzy });
    game.events.length = 0;
    place(game, boss.x + 10, boss.y - 18, 120);
    stepGame(game);
    assert.equal(boss.hits, round);
    assert.equal(game.deaths, 1, "stomping never hurts the pup");
  }
  assert.equal(boss.mode, "defeated");
  const defeat = game.events.find((event) => event.type === "boss-defeated");
  assert.ok(defeat, "defeat is announced");
  assert.equal(game.score, score + 50 * (BOSS.hits - 1) + BOSS.score);
  place(game, boss.x - 10, GROUND_Y - 18);
  stepGame(game);
  assert.equal(game.deaths, 1, "a powered-down boss is harmless");
});

test("the boss trail and its victory draw every mode with valid colors", () => {
  const fills = new Set();
  const noop = () => {};
  const ctx = {
    imageSmoothingEnabled: true, globalAlpha: 1, font: "",
    set fillStyle(value) { fills.add(value); }, get fillStyle() { return ""; },
    fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
    save: noop, restore: noop, translate: noop, scale: noop, fillText: noop,
  };
  const renderer = createRenderer({ getContext: () => ctx });
  const game = finale();
  game.cameraX = game.level.boss.x - 200;
  for (const mode of BOSS_MODES) {
    game.level.boss.mode = mode;
    for (const reducedMotion of [false, true]) {
      assert.doesNotThrow(() => renderer.render(game, 3.3, 1 / 60, reducedMotion), mode);
    }
  }
  renderer.effect({ type: "boss-defeated", x: 300, y: 180 });
  renderer.render(game, 4, 1 / 60, false);
  for (const color of fills) assert.match(color, /^#[0-9a-f]{6}$/i, `drew ${color}`);
});
