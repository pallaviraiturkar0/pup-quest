import { LEVELS, VIEW_HEIGHT, VIEW_WIDTH } from "./levels.js";

export const PHYSICS = Object.freeze({
  speed: 112,
  acceleration: 950,
  gravity: 660,
  jump: 260,
  shortJump: 115,
  maxFall: 360,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
});

export function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

function playerAt(x, y) {
  return { x, y, w: 14, h: 18, vx: 0, vy: 0, facing: 1, grounded: false, coyote: 0, buffer: 0, invincible: 0, stride: 0 };
}

function loadLevel(game) {
  game.level = structuredClone(LEVELS[game.levelIndex]);
  game.player = playerAt(game.level.start.x, game.level.start.y);
  game.cameraX = 0;
  game.keyFound = false;
  game.levelTreats = 0;
  game.levelTime = 0;
  game.exitHintCooldown = 0;
}

export function createGame() {
  const game = {
    status: "ready", levelIndex: 0, lives: 3, score: 0, totalTreats: 0,
    elapsed: 0, events: [], deaths: 0,
  };
  loadLevel(game);
  return game;
}

export function startGame(game) {
  if (game.status === "ready") {
    game.status = "playing";
    game.events.push({ type: "start" });
  }
}

export function restartGame(game) {
  Object.assign(game, createGame());
  startGame(game);
}

export function nextLevel(game) {
  if (game.status !== "level-complete") return;
  game.levelIndex += 1;
  game.lives = Math.min(3, game.lives + 1);
  loadLevel(game);
  game.status = "playing";
  game.events.push({ type: "start" });
}

export function pauseGame(game) {
  if (game.status === "playing") game.status = "paused";
}

export function resumeGame(game) {
  if (game.status === "paused") game.status = "playing";
}

function loseLife(game, reason) {
  const { player, level } = game;
  if (player.invincible > 0 && reason !== "fall") return false;
  game.lives -= 1;
  game.deaths += 1;
  game.events.push({ type: "hurt", x: player.x, y: player.y });
  if (game.lives === 0) {
    game.status = "game-over";
    game.events.push({ type: "game-over" });
    return true;
  }
  const spawn = level.checkpoint.active
    ? { x: level.checkpoint.x + 12, y: level.start.y }
    : level.start;
  game.player = playerAt(spawn.x, spawn.y);
  game.player.invincible = 1.5;
  game.cameraX = clamp(spawn.x - VIEW_WIDTH * 0.36, 0, level.width - VIEW_WIDTH);
  return true;
}

function nearPickup(player, item, radius) {
  return intersects(player, { x: item.x - radius, y: item.y - radius, w: radius * 2, h: radius * 2 });
}

export function stepGame(game, input = {}, dt = 1 / 120) {
  if (game.status !== "playing") return;
  const { player: p, level } = game;
  game.elapsed += dt;
  game.levelTime += dt;
  game.exitHintCooldown = Math.max(0, game.exitHintCooldown - dt);
  p.invincible = Math.max(0, p.invincible - dt);
  p.coyote = p.grounded ? PHYSICS.coyoteTime : Math.max(0, p.coyote - dt);
  p.buffer = input.jumpPressed ? PHYSICS.jumpBuffer : Math.max(0, p.buffer - dt);

  const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
  p.vx = approach(p.vx, direction * PHYSICS.speed, PHYSICS.acceleration * dt);
  if (direction) p.facing = direction;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -PHYSICS.jump;
    p.grounded = false;
    p.coyote = 0;
    p.buffer = 0;
    game.events.push({ type: "jump", x: p.x + p.w / 2, y: p.y + p.h });
  }
  if (!input.jumpHeld && p.vy < -PHYSICS.shortJump) p.vy = -PHYSICS.shortJump;
  p.vy = Math.min(PHYSICS.maxFall, p.vy + PHYSICS.gravity * dt);
  const previousBottom = p.y + p.h;

  p.x = clamp(p.x + p.vx * dt, 0, level.width - p.w);
  for (const block of level.ground) {
    if (intersects(p, block)) {
      p.x = p.vx > 0 ? block.x - p.w : block.x + block.w;
      p.vx = 0;
    }
  }
  p.y += p.vy * dt;
  p.grounded = false;
  for (const surface of [...level.ground, ...level.platforms]) {
    if (p.vy >= 0 && previousBottom <= surface.y + 0.1 &&
        p.y + p.h >= surface.y && p.x + p.w > surface.x && p.x < surface.x + surface.w) {
      p.y = surface.y - p.h;
      p.vy = 0;
      p.grounded = true;
    }
  }
  p.stride += Math.abs(p.vx) * dt;

  if (p.y > VIEW_HEIGHT + 18) {
    loseLife(game, "fall");
    return;
  }
  for (const spike of level.spikes) {
    if (intersects(p, spike) && loseLife(game, "spikes")) return;
  }
  for (const enemy of level.enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.speed * enemy.direction * dt;
    if (enemy.x >= enemy.right) { enemy.x = enemy.right; enemy.direction = -1; }
    if (enemy.x <= enemy.left) { enemy.x = enemy.left; enemy.direction = 1; }
    if (!intersects(p, enemy)) continue;
    if (p.vy > 0 && previousBottom <= enemy.y + 5) {
      enemy.alive = false;
      p.vy = -190;
      game.score += 10;
      game.events.push({ type: "stomp", x: enemy.x + 9, y: enemy.y });
    } else if (loseLife(game, "enemy")) return;
  }

  for (const treat of level.treats) {
    if (!treat.collected && nearPickup(p, treat, 6)) {
      treat.collected = true;
      game.levelTreats += 1;
      game.totalTreats += 1;
      game.score += 25;
      game.events.push({ type: "treat", x: treat.x, y: treat.y });
    }
  }
  if (!game.keyFound && nearPickup(p, level.key, 9)) {
    game.keyFound = true;
    game.score += 100;
    game.events.push({ type: "key", x: level.key.x, y: level.key.y });
  }
  if (!level.checkpoint.active && p.x >= level.checkpoint.x && p.x < level.checkpoint.x + 40 && p.grounded) {
    level.checkpoint.active = true;
    game.events.push({ type: "checkpoint", x: level.checkpoint.x, y: level.checkpoint.y - 24 });
  }
  if (intersects(p, level.exit)) {
    if (game.keyFound) {
      game.score += game.lives * 50;
      game.status = game.levelIndex === LEVELS.length - 1 ? "won" : "level-complete";
      game.events.push({ type: game.status });
    } else if (game.exitHintCooldown === 0) {
      game.exitHintCooldown = 3;
      game.events.push({ type: "need-key" });
    }
  }
  const cameraTarget = clamp(p.x - VIEW_WIDTH * 0.36, 0, level.width - VIEW_WIDTH);
  game.cameraX += (cameraTarget - game.cameraX) * (1 - Math.exp(-7 * dt));
}
