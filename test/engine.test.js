import test from "node:test";
import assert from "node:assert/strict";
import { createGame, intersects, nextLevel, pauseGame, PHYSICS, restartGame, resumeGame, startGame, stepGame } from "../src/engine.js";
import { GROUND_Y, LEVELS, VIEW_HEIGHT, VIEW_WIDTH } from "../src/levels.js";

const tick = (game, input = {}) => stepGame(game, input, 1 / 120);
function playing() {
  const game = createGame();
  startGame(game);
  tick(game);
  game.events.length = 0;
  return game;
}

function place(game, x, y) {
  Object.assign(game.player, { x, y, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, invincible: 0 });
}

function finish(game) {
  place(game, game.level.key.x - 7, game.level.key.y - 9);
  tick(game);
  assert.equal(game.keyFound, true);
  place(game, game.level.exit.x + 8, GROUND_Y - game.player.h);
  tick(game);
}

test("a new adventure waits for the player and does not mutate level definitions", () => {
  const game = createGame();
  assert.equal(game.status, "ready");
  assert.equal(game.lives, 3);
  stepGame(game, { right: true }, 1);
  assert.equal(game.elapsed, 0);
  assert.equal(game.player.x, 48);
  game.level.treats[0].collected = true;
  assert.equal(createGame().level.treats[0].collected, false);
  assert.equal(LEVELS[0].treats[0].collected, false);
});

test("run controls accelerate, stop responsively, and respect world bounds", () => {
  const game = playing();
  for (let i = 0; i < 40; i += 1) tick(game, { right: true });
  assert.equal(game.player.vx, PHYSICS.speed);
  assert.ok(game.player.x > 70);
  for (let i = 0; i < 20; i += 1) tick(game);
  assert.equal(game.player.vx, 0);
  for (let i = 0; i < 180; i += 1) tick(game, { left: true });
  assert.equal(game.player.x, 0);
  assert.equal(game.player.facing, -1);
});

test("opposite movement buttons cancel one another", () => {
  const game = playing();
  tick(game, { left: true, right: true });
  assert.equal(game.player.vx, 0);
});

test("holding jump makes a higher leap than tapping it", () => {
  function jumpHeight(hold) {
    const game = playing();
    const start = game.player.y;
    let top = start;
    for (let i = 0; i < 120; i += 1) {
      tick(game, { jumpPressed: i === 0, jumpHeld: hold || i === 0 });
      top = Math.min(top, game.player.y);
    }
    assert.equal(game.player.grounded, true);
    return start - top;
  }
  const full = jumpHeight(true);
  const short = jumpHeight(false);
  assert.ok(full > 48 && full < 53, `Full jump height: ${full}`);
  assert.ok(full > short + 25);
});

test("holding jump does not automatically jump again on landing", () => {
  const game = playing();
  for (let i = 0; i < 240; i += 1) tick(game, { jumpPressed: i === 0, jumpHeld: true });
  assert.equal(game.events.filter((event) => event.type === "jump").length, 1);
  assert.equal(game.player.grounded, true);
});

test("a jump shortly after walking off an edge uses coyote time", () => {
  const game = playing();
  game.player.x = game.level.gaps[0].x - 1;
  for (let i = 0; i < 30 && game.player.grounded; i += 1) tick(game, { right: true });
  assert.equal(game.player.grounded, false);
  tick(game, { right: true, jumpPressed: true, jumpHeld: true });
  assert.ok(game.player.vy < -200);
});

test("a buffered jump fires on landing, but cannot create a double jump", () => {
  const game = playing();
  place(game, 48, GROUND_Y - game.player.h - 4);
  game.player.vy = 80;
  for (let i = 0; i < 12; i += 1) tick(game, { jumpPressed: i === 0, jumpHeld: true });
  assert.ok(game.events.some((event) => event.type === "jump"));
  assert.ok(game.player.vy < 0);
  game.events.length = 0;
  game.player.coyote = 0;
  tick(game, { jumpPressed: true, jumpHeld: true });
  assert.equal(game.events.some((event) => event.type === "jump"), false);
});

test("floating platforms allow jumping through from below and landing on top", () => {
  const game = playing();
  const platform = game.level.platforms[0];
  place(game, platform.x + 12, platform.y + 2);
  game.player.vy = -240;
  tick(game, { jumpHeld: true });
  assert.ok(game.player.y < platform.y + 2);
  for (let i = 0; i < 120; i += 1) tick(game, { jumpHeld: true });
  assert.equal(game.player.y + game.player.h, platform.y);
  assert.equal(game.player.grounded, true);
});

test("treats award points only once and stay collected after a fall", () => {
  const game = playing();
  const treat = game.level.treats[0];
  place(game, treat.x - 7, treat.y - 9);
  tick(game);
  tick(game);
  assert.equal(game.score, 25);
  assert.equal(game.levelTreats, 1);
  assert.equal(game.totalTreats, 1);
  game.player.y = VIEW_HEIGHT + 20;
  tick(game);
  assert.equal(game.lives, 2);
  assert.equal(treat.collected, true);
  assert.equal(game.score, 25);
});

test("the doghouse requires the key, not all optional treats", () => {
  const game = playing();
  place(game, game.level.exit.x + 8, GROUND_Y - game.player.h);
  tick(game);
  assert.equal(game.status, "playing");
  assert.ok(game.events.some((event) => event.type === "need-key"));
  finish(game);
  assert.equal(game.status, "level-complete");
  assert.equal(game.totalTreats, 0);
  assert.equal(game.score, 250);
  const score = game.score;
  tick(game);
  assert.equal(game.score, score);
});

test("checkpoints restore the puppy to safe ground, retaining the golden key", () => {
  const game = playing();
  place(game, game.level.checkpoint.x + 2, GROUND_Y - game.player.h);
  tick(game);
  assert.equal(game.level.checkpoint.active, true);
  game.keyFound = true;
  game.player.y = VIEW_HEIGHT + 20;
  tick(game);
  assert.equal(game.player.x, game.level.checkpoint.x + 12);
  assert.equal(game.keyFound, true);
  assert.ok(game.player.invincible > 0);
  assert.ok(game.cameraX > 0);
});

test("spikes cost a heart and temporary protection prevents repeated damage", () => {
  const game = playing();
  const spike = game.level.spikes[0];
  place(game, spike.x, GROUND_Y - game.player.h);
  tick(game);
  assert.equal(game.lives, 2);
  game.player.x = spike.x;
  game.player.y = GROUND_Y - game.player.h;
  tick(game);
  assert.equal(game.lives, 2);
});

test("critter side collisions hurt, while landing on top gives a bounce", () => {
  const game = playing();
  let enemy = game.level.enemies[0];
  place(game, enemy.x, GROUND_Y - game.player.h);
  tick(game);
  assert.equal(game.lives, 2);
  enemy = game.level.enemies[0];
  place(game, enemy.x, enemy.y - game.player.h - 0.5);
  game.player.vy = 160;
  tick(game, { jumpHeld: true });
  assert.equal(enemy.alive, false);
  assert.ok(game.player.vy < 0);
  assert.equal(game.score, 10);
});

test("pausing freezes the game and resuming preserves the run", () => {
  const game = playing();
  pauseGame(game);
  const before = structuredClone(game);
  for (let i = 0; i < 30; i += 1) tick(game, { right: true, jumpPressed: true });
  assert.deepEqual(game, before);
  resumeGame(game);
  tick(game, { right: true });
  assert.equal(game.status, "playing");
  assert.ok(game.player.x > before.player.x);
});

test("three falls end a run; restarting resets campaign state", () => {
  const game = playing();
  for (let i = 0; i < 3; i += 1) {
    game.player.y = VIEW_HEIGHT + 20;
    tick(game);
  }
  assert.equal(game.status, "game-over");
  assert.equal(game.lives, 0);
  restartGame(game);
  assert.equal(game.status, "playing");
  assert.equal(game.lives, 3);
  assert.equal(game.levelIndex, 0);
  assert.equal(game.score, 0);
  assert.equal(game.deaths, 0);
});

test("all three trails lead to victory without overflowing the level array", () => {
  const game = playing();
  for (let index = 0; index < LEVELS.length; index += 1) {
    assert.equal(game.levelIndex, index);
    game.lives = 2;
    finish(game);
    if (index < LEVELS.length - 1) {
      nextLevel(game);
      assert.equal(game.status, "playing");
      assert.equal(game.lives, 3);
      assert.equal(game.keyFound, false);
      assert.equal(game.levelTreats, 0);
    }
  }
  assert.equal(game.status, "won");
  nextLevel(game);
  assert.equal(game.levelIndex, LEVELS.length - 1);
});

test("every spawn, checkpoint, and exit has safe ground, and gaps are jumpable", () => {
  for (const level of LEVELS) {
    for (const x of [level.start.x, level.checkpoint.x + 12, level.exit.x + 8]) {
      const puppy = { x, y: GROUND_Y - 18, w: 14, h: 18 };
      assert.ok(level.ground.some((ground) => x >= ground.x && x + 14 <= ground.x + ground.w), `${level.name}: unsupported spawn or exit at ${x}`);
      assert.ok(level.spikes.every((spike) => !intersects(puppy, spike)));
      assert.ok(level.enemies.every((enemy) => x + 14 < enemy.left || x > enemy.right + enemy.w));
    }
    const jumpDistance = PHYSICS.speed * PHYSICS.jump * 2 / PHYSICS.gravity;
    assert.ok(level.gaps.every((gap) => gap.w < jumpDistance - 16));
    assert.ok(level.width > VIEW_WIDTH);
  }
});
