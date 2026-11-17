// Data-driven critters. Each type has a hitbox size and an update rule; levels
// place them with plain objects, so new trails can mix and match freely.

const SIZES = Object.freeze({
  squirrel: { w: 18, h: 12 },
  vacuum: { w: 20, h: 9 },
  seagull: { w: 18, h: 10 },
  cat: { w: 18, h: 12 },
  vulture: { w: 18, h: 10 },
  crab: { w: 18, h: 10 },
  pufferfish: { w: 14, h: 12 },
});

export const ENEMY_TYPES = Object.freeze(Object.keys(SIZES));

// A robot vacuum patrols, revs up when it spots the pup ahead, then dashes to the end of its beat.
export const VACUUM = Object.freeze({ sight: 96, windup: 0.4, dashMultiplier: 3, cooldown: 1.2, floorTolerance: 2 });
// A seagull glides high above the sand and swoops down to puppy height on a steady rhythm.
// The canyon's vulture is a seagull in desert feathers: same glide, same swoop, same tells.
export const SEAGULL = Object.freeze({ altitude: 64, swoopClearance: 14, period: 2.6, swoopTime: 1.1, warning: 0.4, bob: 2 });
// An alley cat prowls a rooftop, crouches as a tell, then pounces in a short hop.
export const SWOOPERS = Object.freeze(["seagull", "vulture"]);
export const CAT = Object.freeze({ period: 2.2, crouch: 0.35, pounce: 170, gravity: 520, leapMultiplier: 2 });
// A pufferfish drifts through deep water, bobbing gently. Every `period` seconds it trembles for `warning`
// seconds, then holds still and puffs up `grow` pixels on every side for `puffTime` seconds. A puffed
// pufferfish is spiky: it cannot be stomped. Its `floor` is the lowest its belly ever sinks.
export const PUFFER = Object.freeze({ period: 3, warning: 0.5, puffTime: 1.1, grow: 4, bob: 6 });
export const SWIMMERS = Object.freeze(["pufferfish"]);

export function makeEnemy({ type = "squirrel", x, left, right, speed, floor, phase = 0 }) {
  const size = SIZES[type];
  if (!size) throw new Error(`Unknown critter type: ${type}`);
  if (!(left <= x && x <= right)) throw new Error(`${type} at ${x} starts outside its patrol ${left}-${right}`);
  const enemy = { type, x, y: floor - size.h, ...size, left, right, speed, direction: 1, alive: true, floor };
  if (type === "vacuum") Object.assign(enemy, { mode: "patrol", timer: 0 });
  if (SWOOPERS.includes(type)) Object.assign(enemy, { timer: phase, swooping: false, warning: false, y: seagullCruiseY(enemy) });
  if (type === "cat") Object.assign(enemy, { mode: "prowl", timer: phase, vy: 0 });
  if (type === "pufferfish") Object.assign(enemy, { timer: phase, puffed: false, warning: false, grow: 0, y: enemy.y - pufferBob(phase) });
  return enemy;
}

function seagullCruiseY(enemy) {
  return enemy.floor - SEAGULL.altitude - enemy.h;
}

// Highest point the critter's top edge can ever reach, for level-design checks.
export function enemyTop(enemy) {
  if (SWOOPERS.includes(enemy.type)) return seagullCruiseY(enemy) - SEAGULL.bob;
  if (enemy.type === "cat") return enemy.floor - enemy.h - CAT.pounce ** 2 / (2 * CAT.gravity);
  if (enemy.type === "pufferfish") return enemy.floor - SIZES.pufferfish.h - PUFFER.bob - PUFFER.grow;
  return enemy.floor - enemy.h;
}

// Every point the critter's hitbox can occupy over its whole routine.
export function enemyReach(enemy) {
  const top = enemyTop(enemy);
  if (enemy.type === "pufferfish") {
    const { w } = SIZES.pufferfish;
    return { x: enemy.left - PUFFER.grow, y: top, w: enemy.right - enemy.left + w + PUFFER.grow * 2, h: enemy.floor + PUFFER.grow - top };
  }
  return { x: enemy.left, y: top, w: enemy.right - enemy.left + enemy.w, h: enemy.floor - top };
}

function patrol(enemy, speed, dt) {
  enemy.x += speed * enemy.direction * dt;
  if (enemy.x >= enemy.right) { enemy.x = enemy.right; enemy.direction = -1; return true; }
  if (enemy.x <= enemy.left) { enemy.x = enemy.left; enemy.direction = 1; return true; }
  return false;
}

export function vacuumSpots(enemy, player) {
  if (!player || Math.abs(player.y + player.h - enemy.floor) > VACUUM.floorTolerance) return false;
  const ahead = (player.x + player.w / 2 - (enemy.x + enemy.w / 2)) * enemy.direction;
  return ahead > 0 && ahead <= VACUUM.sight;
}

function updateVacuum(enemy, dt, player) {
  if (enemy.mode === "windup") {
    enemy.timer -= dt;
    if (enemy.timer <= 0) enemy.mode = "dash";
    return;
  }
  const dashing = enemy.mode === "dash";
  const turned = patrol(enemy, dashing ? enemy.speed * VACUUM.dashMultiplier : enemy.speed, dt);
  if (dashing) {
    if (turned) { enemy.mode = "patrol"; enemy.timer = VACUUM.cooldown; }
    return;
  }
  enemy.timer = Math.max(0, enemy.timer - dt);
  if (enemy.timer === 0 && vacuumSpots(enemy, player)) {
    enemy.mode = "windup";
    enemy.timer = VACUUM.windup;
  }
}

function updateSeagull(enemy, dt) {
  patrol(enemy, enemy.speed, dt);
  enemy.timer += dt;
  const cruise = seagullCruiseY(enemy);
  const cycle = enemy.timer % SEAGULL.period;
  const swoopStart = SEAGULL.period - SEAGULL.swoopTime;
  enemy.swooping = cycle >= swoopStart;
  enemy.warning = !enemy.swooping && cycle >= swoopStart - SEAGULL.warning;
  if (enemy.swooping) {
    const low = enemy.floor - SEAGULL.swoopClearance - enemy.h;
    enemy.y = cruise + (low - cruise) * Math.sin(Math.PI * (cycle - swoopStart) / SEAGULL.swoopTime);
  } else {
    enemy.y = cruise + SEAGULL.bob * Math.sin(enemy.timer * 4);
  }
}

function updateCat(enemy, dt) {
  if (enemy.mode === "crouch") {
    enemy.timer -= dt;
    if (enemy.timer <= 0) { enemy.mode = "pounce"; enemy.vy = -CAT.pounce; }
    return;
  }
  if (enemy.mode === "pounce") {
    patrol(enemy, enemy.speed * CAT.leapMultiplier, dt);
    enemy.vy += CAT.gravity * dt;
    enemy.y += enemy.vy * dt;
    if (enemy.y >= enemy.floor - enemy.h) {
      Object.assign(enemy, { y: enemy.floor - enemy.h, vy: 0, mode: "prowl", timer: 0 });
    }
    return;
  }
  patrol(enemy, enemy.speed, dt);
  enemy.timer += dt;
  if (enemy.timer >= CAT.period) { enemy.mode = "crouch"; enemy.timer = CAT.crouch; }
}

function pufferBob(timer) {
  return PUFFER.bob * (1 + Math.sin(timer * 2)) / 2;
}

function updatePufferfish(enemy, dt) {
  const size = SIZES.pufferfish;
  // Patrol with the resting body, then grow the hitbox evenly around it.
  enemy.x += enemy.grow;
  if (!enemy.puffed) patrol(enemy, enemy.speed, dt);
  enemy.timer += dt;
  const cycle = enemy.timer % PUFFER.period;
  const puffStart = PUFFER.period - PUFFER.puffTime;
  enemy.puffed = cycle >= puffStart;
  enemy.warning = !enemy.puffed && cycle >= puffStart - PUFFER.warning;
  enemy.grow = enemy.puffed ? PUFFER.grow : 0;
  enemy.w = size.w + enemy.grow * 2;
  enemy.h = size.h + enemy.grow * 2;
  enemy.x -= enemy.grow;
  enemy.y = enemy.floor - size.h - pufferBob(enemy.timer) - enemy.grow;
}

export function updateEnemy(enemy, dt, player) {
  if (enemy.type === "vacuum") updateVacuum(enemy, dt, player);
  else if (SWOOPERS.includes(enemy.type)) updateSeagull(enemy, dt);
  else if (enemy.type === "cat") updateCat(enemy, dt);
  else if (enemy.type === "pufferfish") updatePufferfish(enemy, dt);
  else patrol(enemy, enemy.speed, dt);
}
