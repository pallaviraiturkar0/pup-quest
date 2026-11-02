// Dog-themed power-ups. Levels place them as [type, column, y] tuples; the
// engine calls these helpers so the pickup and effect rules stay testable.

export const MAX_LIVES = 5;
export const PICKUP_RADIUS = 8;

export const POWERUPS = Object.freeze({
  // A big bone treat: one extra heart, even above the usual three.
  bone: Object.freeze({ score: 50 }),
  // The zoomies: a burst of speed for a few seconds.
  zoomies: Object.freeze({ score: 25, duration: 5, speedMultiplier: 1.5 }),
  // A squeaky toy: nearby critters freeze in fright and can't hurt the pup.
  squeaky: Object.freeze({ score: 25, duration: 4, radius: 200 }),
});

export const POWERUP_TYPES = Object.freeze(Object.keys(POWERUPS));

export function makePowerup(type, x, y) {
  if (!POWERUPS[type]) throw new Error(`Unknown power-up type: ${type}`);
  return { type, x, y, collected: false };
}

function center(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function applyPowerup(game, item) {
  const p = game.player;
  const rules = POWERUPS[item.type];
  item.collected = true;
  game.score += rules.score;
  const event = { type: "powerup", powerup: item.type, x: item.x, y: item.y };
  if (item.type === "bone") {
    game.lives = Math.min(MAX_LIVES, game.lives + 1);
  } else if (item.type === "zoomies") {
    p.zoomies = rules.duration;
  } else if (item.type === "squeaky") {
    const pup = center(p);
    let scared = 0;
    for (const enemy of game.level.enemies) {
      if (!enemy.alive) continue;
      const critter = center(enemy);
      if (Math.hypot(critter.x - pup.x, critter.y - pup.y) <= rules.radius) {
        enemy.scared = rules.duration;
        scared += 1;
      }
    }
    event.scared = scared;
  }
  game.events.push(event);
}

export function speedMultiplier(player) {
  return player.zoomies > 0 ? POWERUPS.zoomies.speedMultiplier : 1;
}

export function isScared(enemy) {
  return enemy.scared > 0;
}

export function tickPlayerPowerups(player, dt) {
  player.zoomies = Math.max(0, (player.zoomies ?? 0) - dt);
}

// Returns true while the critter is frozen and should skip its normal update.
export function tickScared(enemy, dt) {
  if (!isScared(enemy)) return false;
  enemy.scared = Math.max(0, enemy.scared - dt);
  return true;
}
