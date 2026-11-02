import test from "node:test";
import assert from "node:assert/strict";
import { createGame, startGame, stepGame } from "../src/engine.js";
import { GROUND_Y } from "../src/levels.js";
import {
  activeParticles, BURSTS, clearParticles, createParticles, emit, emitForEvent, EVENT_BURSTS, PARTICLE_CAP,
  particleAlpha, SHAPE_PIXELS, updateParticles,
} from "../src/particles.js";
import { createRenderer } from "../src/render.js";

// A tiny deterministic PRNG so bursts are repeatable.
function seeded(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test("the pool is allocated once and never grows past its cap", () => {
  const system = createParticles({ capacity: 32, random: seeded() });
  const slots = [...system.pool];
  for (let i = 0; i < 20; i += 1) emit(system, "confetti", 100, 100);
  assert.equal(system.pool.length, 32);
  assert.equal(activeParticles(system).length, 32);
  assert.ok(system.pool.every((particle, index) => particle === slots[index]), "particle objects are reused");
  assert.equal(createParticles().pool.length, PARTICLE_CAP);
  assert.throws(() => createParticles({ capacity: 0 }), /positive integer/);
});

test("a full pool recycles the oldest particles first", () => {
  const system = createParticles({ capacity: 10, random: seeded() });
  emit(system, "dust", 0, 0);
  emit(system, "sparkle", 50, 50);
  const shapes = system.pool.map((particle) => particle.shape);
  assert.equal(shapes.filter((shape) => shape === "sparkle").length, 10, "sparkles overwrote the older dust");
});

test("every game event with an effect maps to known bursts", () => {
  for (const [type, kinds] of Object.entries(EVENT_BURSTS)) {
    for (const kind of kinds) assert.ok(BURSTS[kind], `${type} uses ${kind}`);
  }
  const system = createParticles({ random: seeded() });
  assert.ok(emitForEvent(system, { type: "land", x: 10, y: 10 }) > 0, "landing makes dust");
  assert.ok(emitForEvent(system, { type: "treat", x: 10, y: 10 }) > 0, "pickups sparkle");
  assert.ok(emitForEvent(system, { type: "level-complete", x: 10, y: 10 }) >= BURSTS.confetti.count, "level complete throws confetti");
  const shapes = new Set(activeParticles(system).map((particle) => particle.shape));
  assert.ok(shapes.has("confetti") && shapes.has("paw"), "confetti and paw prints both appear");
  assert.equal(emitForEvent(system, { type: "need-key" }), 0);
  assert.equal(emitForEvent(system, { type: "treat", x: Number.NaN, y: 0 }), 0, "bad positions are ignored");
  assert.equal(emit(system, "fireworks", 0, 0), 0);
});

test("particles move, fall, fade, and expire", () => {
  const system = createParticles({ random: seeded() });
  emit(system, "sparkle", 100, 100);
  const [particle] = activeParticles(system);
  const { x, y, vy } = particle;
  updateParticles(system, 0.05);
  assert.notDeepEqual([particle.x, particle.y], [x, y]);
  assert.ok(particle.vy > vy, "gravity pulls particles down");
  assert.ok(particleAlpha(particle) > 0 && particleAlpha(particle) <= 1);
  updateParticles(system, 5);
  assert.equal(activeParticles(system).length, 0);
  emit(system, "dust", 0, 0);
  clearParticles(system);
  assert.equal(activeParticles(system).length, 0);
});

test("reduced motion disables moving bursts and keeps only a few still sparkles", () => {
  const system = createParticles({ random: seeded() });
  for (const type of ["land", "jump", "stomp", "hurt", "level-complete"]) {
    assert.equal(emitForEvent(system, { type, x: 10, y: 10 }, { reducedMotion: true }), 0, `${type} is calm`);
  }
  const count = emitForEvent(system, { type: "treat", x: 10, y: 10 }, { reducedMotion: true });
  assert.ok(count > 0 && count < BURSTS.sparkle.count);
  const before = activeParticles(system).map((particle) => [particle.x, particle.y]);
  updateParticles(system, 0.2);
  assert.deepEqual(activeParticles(system).map((particle) => [particle.x, particle.y]), before, "sparkles hold still");
});

test("hard landings raise a land event but standing still does not", () => {
  const game = createGame();
  startGame(game);
  Object.assign(game.level, { platforms: [], spikes: [], enemies: [], treats: [], powerups: [] });
  game.level.ground = [{ x: 0, y: GROUND_Y, w: game.level.width, h: 80 }];
  Object.assign(game.player, { x: 300, y: GROUND_Y - 80, vx: 0, vy: 0, grounded: false });
  game.events.length = 0;
  for (let i = 0; i < 120; i += 1) stepGame(game, {}, 1 / 120);
  const lands = game.events.filter((event) => event.type === "land");
  assert.equal(lands.length, 1);
  assert.equal(lands[0].y, GROUND_Y);
  assert.ok(Number.isFinite(lands[0].x));
  game.events.length = 0;
  for (let i = 0; i < 120; i += 1) stepGame(game, {}, 1 / 120);
  assert.equal(game.events.length, 0);
});

test("level complete events carry the doghouse position for confetti", () => {
  const game = createGame();
  startGame(game);
  game.keyFound = true;
  const { exit } = game.level;
  Object.assign(game.player, { x: exit.x + 2, y: exit.y + 2, vx: 0, vy: 0 });
  stepGame(game, {}, 1 / 120);
  const done = game.events.find((event) => event.type === "level-complete");
  assert.ok(done);
  assert.equal(done.x, exit.x + exit.w / 2);
  assert.equal(done.y, exit.y);
});

test("the renderer draws pooled particles in every shape and keeps confetti falling on the results screen", () => {
  const fills = new Set();
  let drawn = 0;
  const noop = () => {};
  const ctx = {
    imageSmoothingEnabled: true, globalAlpha: 1, font: "",
    set fillStyle(value) { fills.add(value); }, get fillStyle() { return ""; },
    fillRect() { drawn += 1; }, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
    save: noop, restore: noop, translate: noop, scale: noop, fillText: noop,
  };
  const renderer = createRenderer({ getContext: () => ctx });
  const game = createGame();
  startGame(game);
  renderer.render(game, 0, 1 / 60, false);
  const baseline = drawn;
  for (const type of ["land", "treat", "stomp", "hurt", "won"]) renderer.effect({ type, x: 200, y: 100 });
  assert.ok(renderer.particles.pool.length <= PARTICLE_CAP);
  game.status = "level-complete";
  const confetti = activeParticles(renderer.particles).find((particle) => particle.shape === "confetti");
  const y = confetti.y;
  drawn = 0;
  renderer.render(game, 0.1, 1 / 60, false);
  assert.ok(drawn > baseline, "particles add draw calls");
  assert.notEqual(confetti.y, y, "confetti keeps animating after the level ends");
  for (const color of fills) assert.match(color, /^#[0-9a-f]{6}$/i, `drew ${color}`);
  game.status = "paused";
  const frozen = confetti.y;
  renderer.render(game, 0.2, 1 / 60, false);
  assert.equal(confetti.y, frozen, "particles freeze while paused");
  renderer.clearEffects();
  assert.equal(activeParticles(renderer.particles).length, 0);
  assert.ok(Object.values(SHAPE_PIXELS).every((pixels) => pixels.length > 0));
});
