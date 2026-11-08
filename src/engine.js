import { BOSS, bossDangerous, bossDefeated, resetBoss, stompBoss, updateBoss } from "./boss.js";
import { updateEnemy } from "./enemies.js";
import { GROUND_Y, LEVELS, TRAILS, VIEW_HEIGHT, VIEW_WIDTH } from "./levels.js";
import { resetYeti, stompYeti, updateYeti, YETI, yetiDangerous, yetiHazardHits } from "./yeti.js";
import { applyPowerup, isScared, PICKUP_RADIUS, speedMultiplier, tickPlayerPowerups, tickScared } from "./powerups.js";

export const PHYSICS = Object.freeze({
  speed: 112,
  acceleration: 950,
  gravity: 660,
  jump: 260,
  shortJump: 115,
  maxFall: 360,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  landingSpeed: 120,
});

// Ice keeps top speed and air control but cuts grip, so the pup speeds up and stops more slowly.
// At full speed a pup slides about 1.4 tiles after letting go: noticeable, never a trap.
export const ICE = Object.freeze({ traction: 0.3 });

export function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

function playerAt(x, y) {
  return { x, y, w: 14, h: 18, vx: 0, vy: 0, facing: 1, grounded: false, onIce: false, coyote: 0, buffer: 0, invincible: 0, stride: 0, zoomies: 0 };
}

function loadLevel(game) {
  game.level = structuredClone(TRAILS[game.levelIndex]);
  game.player = playerAt(game.level.start.x, game.level.start.y);
  game.cameraX = 0;
  game.keyFound = false;
  game.levelTreats = 0;
  game.levelTime = 0;
  game.exitHintCooldown = 0;
}

export function createGame(startIndex = 0) {
  const first = Number.isInteger(startIndex) && startIndex >= 0 && startIndex < TRAILS.length ? startIndex : 0;
  const game = {
    status: "ready", levelIndex: first, startIndex: first, lives: 3, score: 0, totalTreats: 0,
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

// Restarts from the trail this run began on (picked on the Trail Map), or from trail 01.
export function restartGame(game, startIndex = game.startIndex ?? 0) {
  Object.assign(game, createGame(startIndex));
  startGame(game);
}

export function nextLevel(game) {
  if (game.status !== "level-complete") return;
  game.levelIndex += 1;
  // Hearts from bone treats above three carry over to the next trail.
  game.lives = Math.max(game.lives, Math.min(3, game.lives + 1));
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

// How each boss kind moves, takes stomps and hurts the pup.
const BOSS_RULES = {
  megavac: {
    config: BOSS,
    update(boss, dt, player, emit) {
      const cue = updateBoss(boss, dt, player);
      if (cue) emit(cue);
    },
    stomp: stompBoss, dangerous: bossDangerous, reset: resetBoss, hazard: () => false,
  },
  yeti: {
    config: YETI,
    update: updateYeti, stomp: stompYeti, dangerous: yetiDangerous, reset: resetYeti, hazard: yetiHazardHits,
  },
};

const bossRules = (boss) => BOSS_RULES[boss.kind] ?? BOSS_RULES.megavac;

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
  if (level.boss) bossRules(level.boss).reset(level.boss);
  game.cameraX = clamp(spawn.x - VIEW_WIDTH * 0.36, 0, level.width - VIEW_WIDTH);
  return true;
}

// On a boss trail the golden key only appears once the boss is beaten.
export function keyAvailable(level) {
  return !level.boss || bossDefeated(level.boss);
}

function stepBoss(game, previousBottom, dt) {
  const { player: p, level: { boss } } = game;
  const rules = bossRules(boss);
  rules.update(boss, dt, p, (type, x = boss.x + boss.w / 2, y = boss.y) => game.events.push({ type, x, y }));
  if (bossDefeated(boss)) return false;
  if (intersects(p, boss)) {
    const onTop = p.vy > 0 && previousBottom <= boss.y + rules.config.stompTolerance;
    if (onTop) {
      const result = rules.stomp(boss);
      p.vy = -(result ? rules.config.stompBounce : rules.config.bonkBounce);
      p.y = boss.y - p.h;
      if (bossDefeated(boss)) game.score += rules.config.score;
      else if (result) game.score += 50;
      game.events.push({ type: result ?? "boss-bonk", x: boss.x + boss.w / 2, y: boss.y, health: rules.config.hits - boss.hits });
    } else if (rules.dangerous(boss)) return loseLife(game, "boss");
  }
  return rules.hazard(boss, p) && loseLife(game, "boss");
}

// Whether the pup standing on `surface` has its feet (centre) on ice.
export function iceUnder(level, surface, player) {
  const spans = surface.ice ? [surface.ice] : surface.y === GROUND_Y ? level.ice ?? [] : [];
  const centre = player.x + player.w / 2;
  return spans.some((span) => centre >= span.x && centre < span.x + span.w);
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
  tickPlayerPowerups(p, dt);
  p.coyote = p.grounded ? PHYSICS.coyoteTime : Math.max(0, p.coyote - dt);
  p.buffer = input.jumpPressed ? PHYSICS.jumpBuffer : Math.max(0, p.buffer - dt);

  const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
  const grip = p.grounded && p.onIce ? ICE.traction : 1;
  p.vx = approach(p.vx, direction * PHYSICS.speed * speedMultiplier(p), PHYSICS.acceleration * grip * dt);
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
  const wasGrounded = p.grounded;
  const impactSpeed = p.vy;
  p.grounded = false;
  p.onIce = false;
  for (const surface of [...level.ground, ...level.platforms]) {
    if (p.vy >= 0 && previousBottom <= surface.y + 0.1 &&
        p.y + p.h >= surface.y && p.x + p.w > surface.x && p.x < surface.x + surface.w) {
      p.y = surface.y - p.h;
      p.vy = 0;
      p.grounded = true;
      p.onIce ||= iceUnder(level, surface, p);
    }
  }
  p.stride += Math.abs(p.vx) * dt;
  if (p.grounded && !wasGrounded && impactSpeed >= PHYSICS.landingSpeed) {
    game.events.push({ type: "land", x: p.x + p.w / 2, y: p.y + p.h, speed: impactSpeed });
  }

  if (p.y > VIEW_HEIGHT + 18) {
    loseLife(game, "fall");
    return;
  }
  for (const spike of level.spikes) {
    if (intersects(p, spike) && loseLife(game, "spikes")) return;
  }
  for (const enemy of level.enemies) {
    if (!enemy.alive) continue;
    if (!tickScared(enemy, dt)) updateEnemy(enemy, dt, p);
    if (!intersects(p, enemy)) continue;
    if (p.vy > 0 && previousBottom <= enemy.y + 5) {
      enemy.alive = false;
      p.vy = -190;
      game.score += 10;
      game.events.push({ type: "stomp", x: enemy.x + enemy.w / 2, y: enemy.y });
    } else if (!isScared(enemy) && loseLife(game, "enemy")) return;
  }

  if (level.boss && stepBoss(game, previousBottom, dt)) return;

  for (const treat of level.treats) {
    if (!treat.collected && nearPickup(p, treat, 6)) {
      treat.collected = true;
      game.levelTreats += 1;
      game.totalTreats += 1;
      game.score += 25;
      game.events.push({ type: "treat", x: treat.x, y: treat.y });
    }
  }
  for (const item of level.powerups) {
    if (!item.collected && nearPickup(p, item, PICKUP_RADIUS)) applyPowerup(game, item);
  }
  if (!game.keyFound && keyAvailable(level) && nearPickup(p, level.key, 9)) {
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
      // The finale and the secret trail both end the run; other trails lead on to the next.
      game.status = level.secret || game.levelIndex === LEVELS.length - 1 ? "won" : "level-complete";
      game.events.push({ type: game.status, x: level.exit.x + level.exit.w / 2, y: level.exit.y });
    } else if (game.exitHintCooldown === 0) {
      game.exitHintCooldown = 3;
      game.events.push({ type: "need-key" });
    }
  }
  const cameraTarget = clamp(p.x - VIEW_WIDTH * 0.36, 0, level.width - VIEW_WIDTH);
  game.cameraX += (cameraTarget - game.cameraX) * (1 - Math.exp(-7 * dt));
}
