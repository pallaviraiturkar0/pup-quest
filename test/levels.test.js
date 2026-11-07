import test from "node:test";
import assert from "node:assert/strict";
import { enemyReach } from "../src/enemies.js";
import { ICE, intersects, PHYSICS } from "../src/engine.js";
import { GROUND_Y, LEVELS, SECRET_INDEX, SECRET_TRAIL, TRAILS, VIEW_HEIGHT } from "../src/levels.js";
import { THEMES } from "../src/themes.js";

const PUPPY = { w: 14, h: 18 };
const PICKUP_RADIUS = 9;
// Leave a little slack so the static check never approves a pixel-perfect jump.
const RISE_MARGIN = 3;
const REACH_MARGIN = 8;
const JUMP_HEIGHT = PHYSICS.jump ** 2 / (2 * PHYSICS.gravity);

function surfacesOf(level) {
  return [
    ...level.ground.map((block, index) => ({ id: `ground ${index}`, x0: block.x, x1: block.x + block.w, y: block.y })),
    ...level.platforms.map((block, index) => ({ id: `platform ${index}`, x0: block.x, x1: block.x + block.w, y: block.y })),
  ];
}

// A full-speed jump can land `rise` pixels higher (negative: lower) this far away.
function horizontalReach(rise) {
  const v = PHYSICS.jump;
  const discriminant = v * v - 2 * PHYSICS.gravity * rise;
  if (discriminant < 0) return -Infinity;
  return PHYSICS.speed * (v + Math.sqrt(discriminant)) / PHYSICS.gravity;
}

function canHop(from, to) {
  const rise = from.y - to.y;
  if (rise > JUMP_HEIGHT - RISE_MARGIN) return false;
  const gap = Math.max(0, to.x0 - from.x1, from.x0 - to.x1);
  // Dropping straight down from a ledge onto an overlapping lower surface.
  if (gap === 0) return true;
  // The puppy only needs to overlap each ledge, so its own width helps.
  return gap - PUPPY.w + REACH_MARGIN <= horizontalReach(rise);
}

function surfaceUnder(surfaces, x) {
  return surfaces
    .filter((surface) => x >= surface.x0 && x + PUPPY.w <= surface.x1)
    .sort((a, b) => a.y - b.y)[0];
}

function reachableSurfaces(level) {
  const surfaces = surfacesOf(level);
  const start = surfaces.find((surface) => surface.id.startsWith("ground") &&
    level.start.x >= surface.x0 && level.start.x + PUPPY.w <= surface.x1);
  assert.ok(start, `${level.name}: start is not on the ground`);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const from = queue.shift();
    for (const to of surfaces) {
      if (!seen.has(to) && canHop(from, to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return { surfaces, reachable: seen };
}

function canTouch(surface, point) {
  const top = surface.y - PUPPY.h - JUMP_HEIGHT + RISE_MARGIN;
  return point.x >= surface.x0 - PICKUP_RADIUS && point.x <= surface.x1 + PICKUP_RADIUS &&
    point.y + PICKUP_RADIUS >= top && point.y - PICKUP_RADIUS <= surface.y;
}

const solids = (level) => [...level.ground, ...level.platforms];
const box = (point, radius = 1) => ({ x: point.x - radius, y: point.y - radius, w: radius * 2, h: radius * 2 });

test("the campaign has seven uniquely named trails and the newer ones use the park, beach, night city, and castle themes", () => {
  assert.equal(LEVELS.length, 7);
  assert.equal(new Set(LEVELS.map((level) => level.name)).size, LEVELS.length);
  assert.deepEqual(LEVELS.slice(3).map((level) => level.theme), ["park", "beach", "city", "castle"]);
  for (const level of LEVELS) assert.ok(Object.hasOwn(THEMES, level.theme), `${level.name}: unknown theme ${level.theme}`);
});

test("new trails get progressively longer and busier after Starlit Summit", () => {
  const challenge = (level) => level.gaps.length + level.spikes.length + level.enemies.length;
  for (let index = 3; index < LEVELS.length; index += 1) {
    assert.ok(LEVELS[index].width >= LEVELS[index - 1].width, `${LEVELS[index].name} is shorter than the trail before it`);
    assert.ok(challenge(LEVELS[index]) >= challenge(LEVELS[index - 1]), `${LEVELS[index].name} is easier than the trail before it`);
  }
});

test("every level object stays inside the level bounds", () => {
  for (const level of TRAILS) {
    const inside = (thing, label) => {
      assert.ok(thing.x >= 0 && thing.x + (thing.w ?? 0) <= level.width, `${level.name}: ${label} x out of bounds`);
      assert.ok(thing.y >= 0 && thing.y + (thing.h ?? 0) <= VIEW_HEIGHT + 80, `${level.name}: ${label} y out of bounds`);
    };
    for (const [label, list] of Object.entries({ ground: level.ground, platform: level.platforms, spike: level.spikes, treat: level.treats, powerup: level.powerups })) {
      list.forEach((thing, index) => inside(thing, `${label} ${index}`));
    }
    level.enemies.forEach((enemy, index) => {
      inside({ ...enemy, x: enemy.left }, `enemy ${index} left`);
      inside({ ...enemy, x: enemy.right }, `enemy ${index} right`);
      assert.ok(enemy.left <= enemy.x && enemy.x <= enemy.right, `${level.name}: enemy ${index} starts outside its patrol`);
    });
    inside(level.key, "key");
    inside(level.exit, "exit");
    inside(level.start, "start");
    assert.ok(level.platforms.every((platform) => platform.y < GROUND_Y), `${level.name}: platform below ground`);
    assert.ok([...level.treats, ...level.powerups].every((item) => item.y < GROUND_Y) && level.key.y < GROUND_Y, `${level.name}: pickup below ground`);
  }
});

test("the spawn point is clear of solids, spikes, and critters, and stands on ground", () => {
  for (const level of TRAILS) {
    const puppy = { ...level.start, ...PUPPY };
    assert.ok(solids(level).every((solid) => !intersects(puppy, solid)), `${level.name}: spawn overlaps a solid`);
    assert.ok(level.spikes.every((spike) => !intersects(puppy, spike)), `${level.name}: spawn overlaps spikes`);
    assert.ok(level.enemies.every((enemy) => !intersects(puppy, enemyReach(enemy))),
      `${level.name}: spawn is inside a critter patrol`);
    assert.equal(level.start.y + PUPPY.h, GROUND_Y, `${level.name}: spawn is not standing on ground`);
  }
});

test("pickups are never buried inside solid ground or platforms", () => {
  for (const level of TRAILS) {
    for (const [index, item] of [...level.treats, ...level.powerups, level.key].entries()) {
      assert.ok(solids(level).every((solid) => !intersects(box(item), solid)), `${level.name}: pickup ${index} is inside a solid`);
    }
  }
});

test("hazards sit on solid ground and critters never wander out over water", () => {
  for (const level of TRAILS) {
    for (const spike of level.spikes) {
      assert.ok(level.ground.some((ground) => spike.x >= ground.x && spike.x + spike.w <= ground.x + ground.w), `${level.name}: spike at ${spike.x} floats over a gap`);
    }
    for (const enemy of level.enemies.filter((critter) => critter.type !== "seagull")) {
      // Walkers keep their whole hitbox on the ground or rooftop they patrol.
      const [from, to] = enemy.floor === GROUND_Y
        ? [enemy.left + enemy.w / 2, enemy.right + enemy.w / 2]
        : [enemy.left, enemy.right + enemy.w];
      assert.ok(solids(level).some((solid) => solid.y === enemy.floor && from >= solid.x && to <= solid.x + solid.w),
        `${level.name}: ${enemy.type} at ${enemy.x} patrols over a gap`);
    }
    assert.ok(level.start.x < level.checkpoint.x && level.checkpoint.x < level.exit.x, `${level.name}: checkpoint is out of order`);
  }
});

test("each new trail introduces its own critter, and only the new trails use them", () => {
  const types = (level) => new Set(level.enemies.map((enemy) => enemy.type));
  for (const level of LEVELS.slice(0, 3)) assert.deepEqual([...types(level)], ["squirrel"], `${level.name} should keep its squirrels`);
  assert.ok(types(LEVELS[3]).has("vacuum"), "Puppy Park needs robot vacuums");
  assert.ok(types(LEVELS[4]).has("seagull"), "Seashell Shore needs seagulls");
  assert.ok(types(LEVELS[5]).has("cat"), "Neon Nightwalk needs rooftop cats");
  for (const cat of LEVELS[5].enemies.filter((enemy) => enemy.type === "cat")) {
    assert.ok(cat.floor < GROUND_Y, "cats prowl rooftops, not the street");
  }
});

test("the static jump check agrees with the physics", () => {
  const ground = { x0: 0, x1: 100, y: GROUND_Y };
  assert.equal(canHop(ground, { x0: 160, x1: 200, y: GROUND_Y }), true, "a four-tile gap is jumpable");
  assert.equal(canHop(ground, { x0: 200, x1: 240, y: GROUND_Y }), false, "a hundred-pixel gap is not");
  assert.equal(canHop(ground, { x0: 80, x1: 140, y: GROUND_Y - 32 }), true, "two tiles up is jumpable");
  assert.equal(canHop(ground, { x0: 80, x1: 140, y: GROUND_Y - 64 }), false, "four tiles up is not");
  assert.equal(canHop({ x0: 80, x1: 140, y: GROUND_Y - 64 }, ground), true, "dropping down is always fine");
});

test("on every trail the golden key, power-ups, and the doghouse are reachable with ordinary jumps", () => {
  for (const level of TRAILS) {
    const { surfaces, reachable } = reachableSurfaces(level);
    const exitFloor = surfaceUnder(surfaces.filter((surface) => surface.id.startsWith("ground")), level.exit.x + 8);
    assert.ok(exitFloor, `${level.name}: the doghouse has no ground under it`);
    assert.ok(reachable.has(exitFloor), `${level.name}: the doghouse cannot be reached`);
    assert.ok([...reachable].some((surface) => canTouch(surface, level.key)), `${level.name}: the golden key cannot be reached`);
    for (const item of level.powerups) {
      assert.ok([...reachable].some((surface) => canTouch(surface, item)), `${level.name}: ${item.type} power-up at x=${item.x} cannot be reached`);
    }
    for (const platform of surfaces) {
      assert.ok(reachable.has(platform), `${level.name}: ${platform.id} at x=${platform.x0}, y=${platform.y} cannot be reached`);
    }
  }
});

test("Frosty Fjord is a secret arctic trail kept outside the campaign", () => {
  assert.equal(SECRET_TRAIL.name, "Frosty Fjord");
  assert.equal(SECRET_TRAIL.theme, "arctic");
  assert.equal(SECRET_TRAIL.secret, true);
  assert.equal(SECRET_INDEX, LEVELS.length);
  assert.equal(TRAILS[SECRET_INDEX], SECRET_TRAIL);
  assert.ok(LEVELS.every((level) => !level.secret && level.ice.length === 0 && level.platforms.every((platform) => !platform.ice)),
    "campaign trails keep their grip");
  assert.equal(SECRET_TRAIL.boss, null);
  assert.ok(!TRAILS.slice(0, -1).some((level) => level.name === SECRET_TRAIL.name));
});

test("ice is fair: patches sit on solid ground, clear of ledges, spikes, critters, and checkpoints", () => {
  const { ice, ground, spikes, enemies, platforms, checkpoint, start, exit } = SECRET_TRAIL;
  assert.ok(ice.length >= 3, "a few ground patches");
  assert.ok(platforms.filter((platform) => platform.ice).length >= 3, "a few icy ledges");
  assert.ok(platforms.some((platform) => !platform.ice), "plenty of grippy ledges too");
  const TILE = 16;
  for (const { x, w, ice: glaze } of platforms.filter((platform) => platform.ice)) {
    assert.ok(glaze.w >= TILE && glaze.x >= x + TILE && glaze.x + glaze.w <= x + w - TILE, `icy ledge at ${x} keeps a grippy tile at each end`);
  }
  for (const span of ice) {
    // At least a tile of grippy snow before every cliff edge, so a slide never ends in the water.
    assert.ok(ground.some((block) => span.x >= block.x + TILE && span.x + span.w <= block.x + block.w - TILE), `ice at ${span.x} runs up to a ledge`);
    for (const spike of spikes) {
      assert.ok(spike.x >= span.x + span.w + TILE * 2 || spike.x + spike.w <= span.x - TILE * 2, `spike at ${spike.x} is too close to ice at ${span.x}`);
    }
    for (const enemy of enemies.filter((critter) => critter.floor === GROUND_Y && critter.type !== "seagull")) {
      assert.ok(enemy.right + enemy.w <= span.x || enemy.left >= span.x + span.w, `${enemy.type} at ${enemy.x} patrols the ice`);
    }
    for (const x of [start.x, checkpoint.x + 12, exit.x]) {
      assert.ok(x + PUPPY.w <= span.x || x >= span.x + span.w, `respawn or exit at ${x} is on ice`);
    }
  }
});

test("every hop off an icy ledge is makeable from a standing start", () => {
  const { surfaces } = reachableSurfaces(SECRET_TRAIL);
  const icy = SECRET_TRAIL.platforms.filter((platform) => platform.ice);
  for (const platform of icy) {
    // From a standstill on ice, a pup builds up speed over the ledge's width before leaping.
    const runUp = platform.w - PUPPY.w;
    const launch = Math.min(PHYSICS.speed, Math.sqrt(2 * PHYSICS.acceleration * ICE.traction * runUp));
    assert.ok(launch >= PHYSICS.speed * 0.9, `ice ledge at x=${platform.x} is too short to get going`);
    const from = surfaces.find((surface) => surface.x0 === platform.x && surface.y === platform.y);
    // Jump reach scales with take-off speed.
    const onward = surfaces.filter((to) => {
      if (to === from || to.x0 <= from.x1 || from.y - to.y > JUMP_HEIGHT - RISE_MARGIN) return false;
      return to.x0 - from.x1 - PUPPY.w + REACH_MARGIN <= horizontalReach(from.y - to.y) * launch / PHYSICS.speed;
    });
    assert.ok(onward.length > 0, `nowhere to hop to from the ice ledge at x=${platform.x}`);
  }
});
