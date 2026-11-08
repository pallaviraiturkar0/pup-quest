import test from "node:test";
import assert from "node:assert/strict";
import { soundRecipe, recipeDuration } from "../src/audio.js";
import { createGame, keyAvailable, startGame, stepGame } from "../src/engine.js";
import { enemyReach } from "../src/enemies.js";
import { GROUND_Y, SECRET_INDEX, SECRET_TRAIL } from "../src/levels.js";
import { BURSTS, createParticles, emitForEvent, EVENT_BURSTS } from "../src/particles.js";
import { createRenderer } from "../src/render.js";
import { iceAt, makeYeti, resetYeti, stompYeti, updateYeti, YETI, yetiDangerous, yetiHazardHits, yetiHealth, YETI_MODES } from "../src/yeti.js";

const DT = 1 / 120;
// A 300px arena with ice from 120 to 180; the Yeti naps on snow in the middle.
const ICE_SPAN = { x: 120, w: 60 };
const arena = () => makeYeti({ x: 234, left: 100, right: 400, floor: GROUND_Y, ice: [ICE_SPAN, { x: 900, w: 50 }] });
const pupAt = (x, y = GROUND_Y - 18) => ({ x, y, w: 14, h: 18, vx: 0, vy: 0 });

function run(yeti, seconds, player) {
  const cues = [];
  for (let t = 0; t < seconds; t += DT) updateYeti(yeti, DT, player, (type) => cues.push(type));
  return cues;
}

function runUntil(yeti, mode, player, limit = 20) {
  const cues = [];
  for (let t = 0; t < limit; t += DT) {
    if (yeti.mode === mode) return cues;
    updateYeti(yeti, DT, player, (type) => cues.push(type));
  }
  assert.fail(`the Yeti never reached ${mode}; stuck in ${yeti.mode}`);
}

test("the Yeti starts asleep inside its arena and only tracks the arena's ice", () => {
  assert.throws(() => makeYeti({ x: 380, left: 100, right: 400, floor: GROUND_Y }), /outside its arena/);
  const yeti = arena();
  assert.equal(yeti.kind, "yeti");
  assert.equal(yeti.mode, "sleep");
  assert.equal(yeti.y + yeti.h, GROUND_Y);
  assert.deepEqual(yeti.ice, [ICE_SPAN]);
  assert.equal(yetiHealth(yeti), YETI.hits);
  assert.ok(YETI_MODES.includes(yeti.mode));
});

test("it naps until the pup enters, then telegraphs each snowball before throwing it at where the pup stood", () => {
  const yeti = arena();
  assert.deepEqual(run(yeti, 2, pupAt(40)), []);
  const pup = pupAt(300);
  assert.deepEqual(run(yeti, DT, pup), ["yeti-wake"]);
  assert.equal(yeti.direction, 1, "it turns to face the pup");
  const cues = runUntil(yeti, "aim", pup);
  assert.ok(cues.includes("yeti-aim"));
  assert.equal(yeti.target, 307, "it aims at the pup's centre");
  const aimed = runUntil(yeti, "idle", pupAt(200));
  assert.ok(aimed.includes("yeti-throw"));
  assert.equal(yeti.snowballs.length, 1);
  const [ball] = yeti.snowballs;
  assert.equal(ball.landX, 307 - ball.w / 2, "the shadow marks where it lands");
  const splats = [];
  for (let t = 0; t < YETI.snowball.flight + 0.05; t += DT) updateYeti(yeti, DT, pupAt(200), (type, x) => type === "snowball-splat" && splats.push(x));
  assert.equal(yeti.snowballs.length, 0, "a snowball bursts on snow");
  assert.ok(Math.abs(splats[0] - 307) < 3, `it lands on target (${splats[0]})`);
  assert.ok(YETI.aim.every((seconds) => seconds >= 0.5), "the wind-up is always readable");
  assert.ok(YETI.snowball.flight < Math.min(...YETI.idle), "there is time to move between throws");
});

test("snowballs that land on ice keep rolling until they reach snow", () => {
  const yeti = arena();
  Object.assign(yeti, { mode: "aim", timer: 0, target: 170, throwsLeft: 1, direction: -1 });
  const cues = run(yeti, YETI.snowball.flight - 0.02, pupAt(40));
  assert.ok(cues.includes("yeti-throw"));
  run(yeti, 0.05, pupAt(40));
  assert.equal(yeti.snowballs[0]?.rolling, true, "it skids on the ice");
  assert.ok(yeti.snowballs[0].vx <= -YETI.snowball.roll);
  const splat = runUntil(yeti, "aim", pupAt(40));
  assert.ok(splat.includes("snowball-splat"));
  assert.equal(yeti.snowballs.length, 0, "it bursts at the edge of the ice");
});

test("after its throws it crouches toward the pup; landing on snow sends shockwaves, landing on ice makes it slip", () => {
  const yeti = arena();
  Object.assign(yeti, { mode: "idle", timer: 0, throwsLeft: 0 });
  const snowPup = pupAt(300);
  assert.deepEqual(run(yeti, DT, snowPup), ["yeti-crouch"]);
  assert.equal(yeti.target, 307 - YETI.w / 2, "it marks a landing spot under the pup");
  const quake = runUntil(yeti, "idle", snowPup);
  assert.ok(quake.includes("yeti-quake"));
  assert.equal(yeti.x, 291);
  assert.deepEqual(yeti.waves.map((wave) => wave.direction), [-1, 1]);
  assert.ok(yeti.waves.every((wave) => wave.h < 51 - 18), "shockwaves are low enough to hop");
  run(yeti, 3, pupAt(40));
  assert.equal(yeti.waves.length, 0, "shockwaves fade at the arena walls");

  const lured = arena();
  Object.assign(lured, { mode: "idle", timer: 0, throwsLeft: 0 });
  const icePup = pupAt(143);
  run(lured, DT, icePup);
  const slip = runUntil(lured, "slip", icePup);
  assert.ok(slip.includes("yeti-slip"));
  assert.equal(lured.h, YETI.lyingH, "it falls flat on its back");
  assert.equal(lured.y + lured.h, GROUND_Y);
  assert.ok(lured.vx < 0, "it skids on in the direction it leapt");
  assert.equal(yetiDangerous(lured), false, "a slipped Yeti is safe to touch");
  run(lured, 1, icePup);
  assert.ok(iceAt(lured, lured.x + lured.w / 2) || lured.vx === 0, "the skid stops once it reaches snow");
  assert.ok(lured.x >= lured.left);
  run(lured, YETI.slip, icePup);
  assert.equal(lured.mode, "idle");
  assert.equal(lured.h, YETI.h, "it gets back up");
});

test("away from home it always hops back to the middle before attacking again", () => {
  const yeti = arena();
  Object.assign(yeti, { mode: "idle", timer: 0, throwsLeft: 2, x: 120 });
  assert.deepEqual(run(yeti, DT, pupAt(300)), ["yeti-return"]);
  assert.equal(yeti.target, yeti.home);
  runUntil(yeti, "idle", pupAt(300));
  assert.equal(yeti.x, yeti.home);
});

test("only a slipped Yeti can be stomped; three belly stomps befriend it, and each round is quicker", () => {
  const yeti = arena();
  for (const mode of ["sleep", "idle", "aim", "crouch", "leap", "hurt"]) {
    yeti.mode = mode;
    assert.equal(stompYeti(yeti), null, `${mode} shrugs off a stomp`);
  }
  for (const [index, expected] of ["yeti-hit", "yeti-hit", "yeti-befriended"].entries()) {
    yeti.mode = "slip";
    yeti.snowballs = [{ x: 0, y: 0, w: 10, h: 10, vx: 0, vy: 0 }];
    assert.equal(stompYeti(yeti), expected);
    assert.equal(yeti.hits, index + 1);
  }
  assert.equal(yeti.mode, "defeated");
  assert.equal(yeti.snowballs.length, 0, "befriending clears the snowballs");
  assert.deepEqual(run(yeti, 5, pupAt(150)), [], "a friendly Yeti stays put");
  for (const list of [YETI.idle, YETI.aim, YETI.crouch]) assert.ok(list[0] > list[1] && list[1] > list[2]);
  assert.ok(YETI.slip >= 2, "there is always time to reach its belly");
});

test("snowballs and shockwaves hurt; resetting after a lost heart sends it home to nap but keeps its bruises", () => {
  const yeti = arena();
  yeti.waves.push({ x: 200, y: GROUND_Y - 9, w: 12, h: 9, direction: 1 });
  assert.equal(yetiHazardHits(yeti, pupAt(195)), true);
  assert.equal(yetiHazardHits(yeti, pupAt(195, GROUND_Y - 40)), false, "jumping clears a shockwave");
  Object.assign(yeti, { mode: "slip", x: 130, h: YETI.lyingH, hits: 2 });
  resetYeti(yeti);
  assert.deepEqual([yeti.mode, yeti.x, yeti.h, yeti.hits, yeti.waves.length], ["sleep", 234, YETI.h, 2, 0]);
  yeti.mode = "defeated";
  resetYeti(yeti);
  assert.equal(yeti.mode, "defeated");
});

function arenaGame() {
  const game = createGame(SECRET_INDEX);
  startGame(game);
  stepGame(game);
  game.events.length = 0;
  return game;
}

function place(game, x, y, vy = 0) {
  Object.assign(game.player, { x, y, vx: 0, vy, grounded: false, coyote: 0, buffer: 0, invincible: 0 });
}

test("Frosty Fjord ends in a fair Yeti arena: solid floor, ice to lure it onto, no critters or spikes, key and doghouse placed sensibly", () => {
  const { boss, ground, spikes, enemies, checkpoint, key, exit, platforms } = SECRET_TRAIL;
  assert.equal(boss.kind, "yeti");
  assert.ok(ground.some((block) => block.x <= boss.left && boss.right <= block.x + block.w), "no water inside the arena");
  assert.ok(spikes.every((spike) => spike.x + spike.w < boss.left - 32 || spike.x > boss.right), "no spikes in the arena");
  for (const enemy of enemies) {
    const reach = enemyReach(enemy);
    assert.ok(reach.x + reach.w < boss.left - 32, `${enemy.type} at ${enemy.x} wanders into the arena`);
  }
  assert.ok(platforms.every((platform) => platform.x + platform.w < boss.left || platform.x > boss.right), "nothing overhead to snag a leap");
  assert.ok(boss.ice.length >= 2, "ice on both sides of the Yeti");
  assert.ok(boss.ice.some((span) => span.x + span.w < boss.home) && boss.ice.some((span) => span.x > boss.home + boss.w));
  assert.equal(iceAt(boss, boss.home + boss.w / 2), false, "home is on snow, so the hop back never slips");
  assert.ok(boss.ice.every((span) => span.w >= YETI.w), "patches are wide enough to land on");
  assert.ok(checkpoint.x + 40 < boss.left, "the checkpoint sits just before the arena");
  assert.ok(boss.left < key.x && key.x < boss.right, "the key drops inside the arena");
  assert.ok(key.y + 9 >= GROUND_Y - 18, "the key can be picked up from the arena floor");
  assert.ok(exit.x >= boss.right, "the doghouse waits past the arena");
});

test("in the engine, the key stays hidden until the Yeti is befriended, stomps bonk unless it slipped, and hazards cost a heart", () => {
  const game = arenaGame();
  const { boss: yeti, key } = game.level;
  assert.equal(keyAvailable(game.level), false);

  Object.assign(yeti, { mode: "idle", timer: 10, throwsLeft: 2 });
  place(game, yeti.x - 10, GROUND_Y - 18);
  stepGame(game);
  assert.equal(game.deaths, 1, "bumping into it costs a heart");
  assert.equal(yeti.mode, "sleep", "it naps after the pup respawns");

  Object.assign(yeti, { mode: "idle", timer: 10 });
  game.events.length = 0;
  place(game, yeti.x + 10, yeti.y - 18, 120);
  stepGame(game);
  assert.equal(game.deaths, 1);
  assert.ok(game.player.vy < 0, "the pup bounces off its head");
  assert.ok(game.events.some((event) => event.type === "boss-bonk"));

  Object.assign(yeti, { mode: "idle", timer: 10 });
  yeti.snowballs.push({ x: yeti.left + 20, y: GROUND_Y - 10, w: 10, h: 10, vx: 0, vy: 0, rolling: true });
  yeti.ice.push({ x: yeti.left, w: 64 });
  place(game, yeti.left + 18, GROUND_Y - 18);
  stepGame(game);
  assert.equal(game.deaths, 2, "a snowball costs a heart");
  yeti.ice.pop();

  const score = game.score;
  for (let round = 1; round <= YETI.hits; round += 1) {
    Object.assign(yeti, { mode: "slip", timer: YETI.slip, x: yeti.left + 50, h: YETI.lyingH, y: GROUND_Y - YETI.lyingH, vx: 0 });
    game.events.length = 0;
    place(game, yeti.x + 10, yeti.y - 18, 120);
    stepGame(game);
    assert.equal(yeti.hits, round);
    assert.equal(game.deaths, 2, "belly stomps never hurt the pup");
  }
  assert.equal(yeti.mode, "defeated");
  assert.ok(game.events.some((event) => event.type === "yeti-befriended"), "the victory moment is announced");
  assert.equal(game.score, score + 50 * (YETI.hits - 1) + YETI.score);
  assert.equal(keyAvailable(game.level), true);
  place(game, key.x - 7, key.y - 9);
  stepGame(game);
  assert.equal(game.keyFound, true);
});

test("every Yeti cue has a short sound, and its effects use known particle bursts with calm reduced-motion fallbacks", () => {
  const cues = ["yeti-wake", "yeti-aim", "yeti-throw", "yeti-crouch", "yeti-return", "yeti-quake", "yeti-slip", "snowball-splat", "yeti-hit", "yeti-befriended"];
  for (const type of cues) {
    const recipe = soundRecipe(type);
    assert.ok(recipe?.length > 0, `${type} has a sound`);
    assert.ok(recipeDuration(recipe) < 1.5, `${type} is short`);
  }
  for (const type of ["yeti-quake", "yeti-slip", "snowball-splat", "yeti-hit", "yeti-befriended"]) {
    assert.ok(EVENT_BURSTS[type]?.every((kind) => BURSTS[kind]), `${type} has particles`);
  }
  const system = createParticles();
  assert.ok(emitForEvent(system, { type: "yeti-befriended", x: 10, y: 10 }) >= BURSTS.confetti.count + BURSTS.hearts.count);
  const calm = createParticles();
  emitForEvent(calm, { type: "yeti-befriended", x: 10, y: 10 }, { reducedMotion: true });
  assert.ok(calm.pool.filter((particle) => particle.alive).every((particle) => particle.vx === 0 && particle.vy === 0 && particle.gravity === 0));
  assert.equal(emitForEvent(createParticles(), { type: "yeti-quake", x: 10, y: 10 }, { reducedMotion: true }), 0);
});

test("the Yeti, its snowballs, shockwaves and landing shadows draw in every mode with valid colors", () => {
  const fills = new Set();
  const noop = () => {};
  const ctx = {
    imageSmoothingEnabled: true, globalAlpha: 1, font: "",
    set fillStyle(value) { fills.add(value); }, get fillStyle() { return ""; },
    fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
    save: noop, restore: noop, translate: noop, scale: noop, fillText: noop,
  };
  const renderer = createRenderer({ getContext: () => ctx });
  const game = arenaGame();
  const { boss: yeti } = game.level;
  game.cameraX = yeti.x - 200;
  yeti.snowballs.push({ x: yeti.x - 40, y: 150, w: 10, h: 10, vx: -100, vy: 0, rolling: false, landX: yeti.x - 80 });
  yeti.waves.push({ x: yeti.x - 20, y: GROUND_Y - 9, w: 12, h: 9, direction: -1 });
  for (const mode of YETI_MODES) {
    yeti.mode = mode;
    yeti.leap = mode === "leap" ? { from: yeti.x, to: yeti.x - 60, t: 0.3 } : null;
    for (const direction of [-1, 1]) {
      yeti.direction = direction;
      for (const reducedMotion of [false, true]) {
        assert.doesNotThrow(() => renderer.render(game, 3.3, 1 / 60, reducedMotion), mode);
      }
    }
  }
  renderer.effect({ type: "yeti-befriended", x: 300, y: 180 });
  renderer.render(game, 4, 1 / 60, false);
  for (const color of fills) assert.match(color, /^#[0-9a-f]{6}$/i, `drew ${color}`);
});
