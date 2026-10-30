import test from "node:test";
import assert from "node:assert/strict";
import { intersects, PHYSICS } from "../src/engine.js";
import { GROUND_Y, LEVELS, VIEW_HEIGHT } from "../src/levels.js";
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

test("the campaign has six uniquely named trails and the new ones use the park, beach, and night city themes", () => {
  assert.equal(LEVELS.length, 6);
  assert.equal(new Set(LEVELS.map((level) => level.name)).size, LEVELS.length);
  assert.deepEqual(LEVELS.slice(3).map((level) => level.theme), ["park", "beach", "city"]);
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
  for (const level of LEVELS) {
    const inside = (thing, label) => {
      assert.ok(thing.x >= 0 && thing.x + (thing.w ?? 0) <= level.width, `${level.name}: ${label} x out of bounds`);
      assert.ok(thing.y >= 0 && thing.y + (thing.h ?? 0) <= VIEW_HEIGHT + 80, `${level.name}: ${label} y out of bounds`);
    };
    for (const [label, list] of Object.entries({ ground: level.ground, platform: level.platforms, spike: level.spikes, treat: level.treats })) {
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
    assert.ok(level.treats.every((treat) => treat.y < GROUND_Y) && level.key.y < GROUND_Y, `${level.name}: pickup below ground`);
  }
});

test("the spawn point is clear of solids, spikes, and critters, and stands on ground", () => {
  for (const level of LEVELS) {
    const puppy = { ...level.start, ...PUPPY };
    assert.ok(solids(level).every((solid) => !intersects(puppy, solid)), `${level.name}: spawn overlaps a solid`);
    assert.ok(level.spikes.every((spike) => !intersects(puppy, spike)), `${level.name}: spawn overlaps spikes`);
    assert.ok(level.enemies.every((enemy) => !intersects(puppy, { ...enemy, x: enemy.left, w: enemy.right - enemy.left + enemy.w })),
      `${level.name}: spawn is inside a critter patrol`);
    assert.equal(level.start.y + PUPPY.h, GROUND_Y, `${level.name}: spawn is not standing on ground`);
  }
});

test("pickups are never buried inside solid ground or platforms", () => {
  for (const level of LEVELS) {
    for (const [index, item] of [...level.treats, level.key].entries()) {
      assert.ok(solids(level).every((solid) => !intersects(box(item), solid)), `${level.name}: pickup ${index} is inside a solid`);
    }
  }
});

test("hazards sit on solid ground and critters never wander out over water", () => {
  for (const level of LEVELS) {
    for (const spike of level.spikes) {
      assert.ok(level.ground.some((ground) => spike.x >= ground.x && spike.x + spike.w <= ground.x + ground.w), `${level.name}: spike at ${spike.x} floats over a gap`);
    }
    for (const enemy of level.enemies) {
      const [from, to] = [enemy.left + enemy.w / 2, enemy.right + enemy.w / 2];
      assert.ok(level.ground.some((ground) => from >= ground.x && to <= ground.x + ground.w), `${level.name}: critter at ${enemy.x} patrols over a gap`);
    }
    assert.ok(level.start.x < level.checkpoint.x && level.checkpoint.x < level.exit.x, `${level.name}: checkpoint is out of order`);
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

test("on every trail the golden key and the doghouse are reachable with ordinary jumps", () => {
  for (const level of LEVELS) {
    const { surfaces, reachable } = reachableSurfaces(level);
    const exitFloor = surfaceUnder(surfaces.filter((surface) => surface.id.startsWith("ground")), level.exit.x + 8);
    assert.ok(exitFloor, `${level.name}: the doghouse has no ground under it`);
    assert.ok(reachable.has(exitFloor), `${level.name}: the doghouse cannot be reached`);
    assert.ok([...reachable].some((surface) => canTouch(surface, level.key)), `${level.name}: the golden key cannot be reached`);
    for (const platform of surfaces) {
      assert.ok(reachable.has(platform), `${level.name}: ${platform.id} at x=${platform.x0}, y=${platform.y} cannot be reached`);
    }
  }
});
