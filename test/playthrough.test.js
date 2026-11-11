import test from "node:test";
import assert from "node:assert/strict";
import { createGame, ICE, nextLevel, PHYSICS, startGame, stepGame } from "../src/engine.js";
import { BONUS_INDEX, LEVELS, SECRET_INDEX } from "../src/levels.js";
import { createRandom, dailyChallenge, MODIFIER_IDS, MODIFIERS, remixTrail } from "../src/daily.js";
import { BOSS } from "../src/boss.js";
import { YETI } from "../src/yeti.js";
import { MAX_LIVES } from "../src/powerups.js";
import { medalFor, runMs } from "../src/medals.js";

// These waypoints use only ordinary movement and jumps, never teleportation.
// Each tuple is [destination x, landing surface y, jump].
const ROUTES = [
  [
    [420, 208], [509, 208, true], [623, 208], [715, 176, true],
    [739, 176], [809, 144, true], [841, 144], [967, 176, true],
    [1070, 208], [1320, 208], [1410, 208, true], [1470, 208],
    [1565, 208, true], [1590, 176, true], [1627, 176],
    [1730, 208, true], [1812, 208], [1900, 208, true], [1940, 208],
  ],
  [
    [364, 208], [450, 176, true], [552, 176, true],
    [590, 176], [680, 144, true], [713, 144], [820, 176, true],
    [878, 176], [981, 176, true], [1027, 176], [1107, 144, true],
    [1141, 144], [1220, 112, true], [1242, 112], [1360, 176, true],
    [1405, 176], [1506, 176, true], [1544, 176], [1642, 144, true],
    [1677, 144], [1791, 176, true], [1868, 176], [1958, 176, true],
    [1980, 176], [2070, 160, true], [2132, 208],
  ],
  [
    [332, 208], [408, 176, true], [428, 176], [512, 176, true],
    [541, 176], [629, 144, true], [667, 144], [758, 176, true],
    [829, 176], [930, 176, true], [974, 176], [1048, 144, true],
    [1068, 144], [1154, 112, true], [1196, 112], [1250, 176, true],
    [1360, 208], [1412, 176, true], [1437, 176], [1523, 144, true],
    [1564, 144], [1683, 176, true], [1739, 176], [1794, 144, true],
    [1836, 144], [1910, 112, true], [1931, 112], [2010, 176, true],
    [2077, 176], [2180, 176, true], [2290, 208],
  ],
  [
    [234, 208], [146, 176, true], [158, 176], [248, 144, true], [334, 176, true],
    [530, 208, true], [466, 176, true], [478, 176], [568, 144, true], [658, 112, true],
    [730, 176, true], [900, 208, true], [872, 176, true], [962, 144, true],
    [1048, 112, true], [1134, 176, true], [1342, 208, true], [1266, 176, true], [1278, 176],
    [1368, 144, true], [1464, 112, true], [1562, 176, true], [1714, 208, true],
    [1698, 176, true], [1794, 144, true], [1880, 112, true], [1978, 176, true],
    [2202, 208, true], [2120, 176, true], [2144, 176], [2226, 160, true], [2190, 208, true],
    [2312, 208],
  ],
  [
    [234, 208], [146, 176, true], [226, 144, true], [314, 176, true], [350, 176],
    [418, 144, true], [504, 112, true], [606, 176, true], [734, 208, true],
    [722, 176, true], [802, 144, true], [858, 176, true], [992, 208, true],
    [978, 176, true], [1058, 144, true], [1138, 112, true], [1210, 176, true],
    [1332, 208, true], [1330, 176, true], [1400, 144, true], [1486, 176, true], [1522, 176],
    [1602, 144, true], [1682, 112, true], [1754, 176, true], [1790, 176], [1880, 144, true],
    [1954, 112, true], [2040, 80, true], [2106, 176, true], [2312, 208, true],
    [2242, 176, true], [2338, 160, true], [2300, 208, true], [2408, 208],
  ],
  [
    [130, 176, true], [210, 144, true], [282, 176, true], [318, 176], [402, 144, true],
    [482, 112, true], [570, 176, true], [606, 176], [674, 144, true], [754, 112, true],
    [814, 176, true], [866, 208, true], [930, 176, true], [1010, 144, true],
    [1082, 176, true], [1118, 176], [1202, 144, true], [1282, 112, true], [1370, 176, true],
    [1492, 208, true], [1490, 176, true], [1570, 144, true], [1614, 176, true], [1650, 176],
    [1730, 144, true], [1810, 112, true], [1914, 176, true], [1950, 176], [2018, 144, true],
    [2082, 112, true], [2146, 80, true], [2202, 176, true], [2238, 176], [2306, 144, true],
    [2414, 176, true], [2450, 176], [2546, 160, true], [2580, 208, true], [2600, 208],
  ],
  [
    [100, 176, true], [180, 144, true], [262, 176, true], [300, 176], [356, 144, true],
    [436, 112, true], [484, 144], [512, 144], [612, 176, true], [676, 144, true], [724, 112, true],
    [752, 112], [870, 176, true], [948, 144, true], [976, 144], [1060, 176, true], [1088, 176],
    [1140, 144, true], [1168, 144], [1206, 176, true], [1268, 176, true], [1348, 144, true],
    [1412, 112, true], [1440, 112], [1588, 176, true], [1652, 144, true], [1700, 112, true],
    [1728, 112], [1812, 176, true], [1846, 144, true], [1920, 144, true], [1966, 208], [1970, 208],
    [2040, 176, true], [2070, 176], [2116, 144, true], [2164, 176, true], [2240, 176], [2300, 208],
  ],
];

// Frosty Fjord, the secret trail, hops across icy ledges to the Grumpy Yeti's arena.
const SECRET_ROUTE = [
  [120, 208], [150, 176, true], [176, 176], [250, 144, true], [274, 144], [345, 176, true], [400, 176],
  [470, 144, true], [514, 144], [570, 176, true], [594, 176], [640, 176, true], [690, 176], [745, 144, true],
  // Short pauses at 930 and 1590 let the patrolling seagulls swoop past first.
  [770, 144], [825, 112, true], [866, 112], [920, 176, true], [930, 176], [992, 176], [1060, 144, true], [1090, 144],
  [1140, 112, true], [1170, 112], [1240, 176, true], [1298, 176], [1370, 144, true], [1410, 144],
  [1460, 112, true], [1490, 112], [1530, 176, true], [1600, 176], [1590, 176], [1600, 176], [1670, 144, true], [1698, 144],
  [1750, 112, true], [1790, 112], [1850, 176, true], [1940, 208], [1990, 160, true], [2080, 208, true], [2190, 208],
];

// Harvest Hollow, the bonus Trail 08: three hay-bale bounces reach a loft, the hayloft key, and the pond cart.
const HARVEST_ROUTE = [
  [270, 208], [350, 208, true], [470, 208], [540, 176, true], [570, 96, true], [590, 96], [715, 208, true],
  [760, 176, true], [820, 144, true], [880, 112, true], [1020, 208, true], [1150, 208], [1205, 208, true],
  [1255, 176, true], [1400, 208, true], [1470, 176, true], [1500, 96, true], [1525, 96], [1620, 208, true],
  [1650, 208], [1730, 208, true], [1760, 176, true], [1840, 144, true], [1900, 176, true], [2030, 176, true],
  [2140, 176, true], [2220, 144, true], [2315, 208, true], [2400, 208, true], [2450, 176, true], [2540, 160, true],
  [2670, 208, true],
];

// The Grumpy Yeti's arena: the pup waits on the left ice patch so the Yeti leaps
// onto it and slips, sidesteps every snowball, hops shockwaves and rolling
// snowballs, and stomps the Yeti's belly while it lies flat.
const YETI_FIGHT = { ice: 2313, snow: 2262, safe: 2200, home: [[2600, 208], [2790, 208]] };

function yetiInput(game) {
  const { player: p, level: { boss: yeti } } = game;
  const { snow, ice, safe } = YETI_FIGHT;
  const pupCenter = p.x + p.w / 2;
  let goal;
  let jump = false;
  if (yeti.mode === "sleep") goal = ice;
  // Dodge each snowball to the other spot. Standing on the snow before the last
  // throw means the final dodge lands the pup on the ice, right as the Yeti crouches.
  else if (yeti.mode === "aim") goal = Math.abs(yeti.target - snow - p.w / 2) < Math.abs(yeti.target - ice - p.w / 2) ? ice : snow;
  else if (yeti.mode === "idle") goal = Math.abs(yeti.x - yeti.home) > 1 ? safe : yeti.throwsLeft % 2 ? snow : ice;
  else if (yeti.mode === "slip") {
    goal = yeti.x + yeti.w / 2 - p.w / 2;
    jump = Math.abs(yeti.x + yeti.w / 2 - pupCenter) < 34;
  } else goal = safe;
  for (const hazard of [...yeti.waves, ...yeti.snowballs.filter((ball) => ball.rolling)]) {
    const speed = hazard.direction ? hazard.direction * YETI.wave.speed : hazard.vx;
    const gap = hazard.x + hazard.w / 2 - pupCenter;
    if (Math.abs(gap) < 44 && Math.sign(gap) !== Math.sign(speed)) jump = true;
  }
  return { goal, jump };
}

// Steps toward `goal` like `travel`, braking early on ice.
function steer(game, goal, jump) {
  const p = game.player;
  const grip = p.grounded && p.onIce ? ICE.traction : 1;
  const brakingDistance = p.vx * p.vx / (2 * PHYSICS.acceleration * grip);
  const distance = goal - p.x;
  const direction = Math.abs(distance) > brakingDistance + 0.6 ? Math.sign(distance) : 0;
  stepGame(game, { left: direction < 0, right: direction > 0, jumpPressed: jump && p.grounded, jumpHeld: jump }, 1 / 120);
}

function fightYeti(game) {
  const { boss: yeti } = game.level;
  const seen = new Set();
  let iceFrames = 0;
  for (let frame = 0; frame < 120 * 60 && yeti.mode !== "defeated"; frame += 1) {
    const { goal, jump } = yetiInput(game);
    steer(game, goal, jump);
    for (const event of game.events.splice(0)) seen.add(event.type);
    if (game.player.onIce) iceFrames += 1;
    assert.equal(game.deaths, 0, `the Grumpy Yeti caught the pup while it was in ${yeti.mode}`);
  }
  assert.equal(yeti.mode, "defeated", `the Yeti fight stalled with the Yeti in ${yeti.mode}`);
  for (const [x, floor, jump] of YETI_FIGHT.home) travel(game, x, floor, jump);
  return { seen, iceFrames };
}

// Moonlit Keep ends in the Mega-Vac's arena: wait on the left wall ledge, let it
// charge into the wall, drop onto its lid while it's dizzy, then hop back.
const BOSS_FIGHT = {
  approach: [[2372, 176, true], [2410, 176]],
  retreat: [2400, 176],
  home: [[2593, 208], [2593, 208, true], [2824, 208]],
};

function waitFor(game, ready, input = {}) {
  for (let frame = 0; frame < 2400; frame += 1) {
    if (ready()) return;
    stepGame(game, input, 1 / 120);
    game.events.length = 0;
    assert.equal(game.deaths, 0, `${game.level.name}: lost a life during the boss fight`);
  }
  assert.fail(`${game.level.name}: the boss fight stalled with the boss in ${game.level.boss.mode}`);
}

function fightBoss(game) {
  const { boss } = game.level;
  for (const [x, floor, jump] of BOSS_FIGHT.approach) travel(game, x, floor, jump);
  while (boss.hits < BOSS.hits) {
    waitFor(game, () => boss.mode === "dizzy");
    const hits = boss.hits;
    waitFor(game, () => boss.hits > hits, { right: true });
    if (boss.hits < BOSS.hits) travel(game, ...BOSS_FIGHT.retreat);
  }
  assert.equal(boss.mode, "defeated");
  for (const [x, floor, jump] of BOSS_FIGHT.home) travel(game, x, floor, jump);
}

// Returns how many frames the pup spent standing on ice along the way.
function travel(game, x, floor, jump = false) {
  let airborne = false;
  let iceFrames = 0;
  for (let frame = 0; frame < 1600; frame += 1) {
    const p = game.player;
    const distance = x - p.x;
    // On ice the pup needs a longer run-out to stop, so it eases off sooner.
    const grip = p.grounded && p.onIce ? ICE.traction : 1;
    const brakingDistance = p.vx * p.vx / (2 * PHYSICS.acceleration * grip);
    const direction = Math.abs(distance) > brakingDistance + 0.6 ? Math.sign(distance) : 0;
    stepGame(game, {
      left: direction < 0, right: direction > 0,
      jumpPressed: jump && frame === 0, jumpHeld: jump,
    }, 1 / 120);
    game.events.length = 0;
    airborne ||= !game.player.grounded;
    if (game.player.onIce) iceFrames += 1;
    assert.equal(game.deaths, 0, `${game.level.name}: lost a life en route to ${x}/${floor}`);
    if (game.status !== "playing") return iceFrames;
    if (Math.abs(game.player.x - x) < 2 && Math.abs(game.player.vx) < 10 &&
        game.player.grounded && Math.abs(game.player.y + game.player.h - floor) < 1 &&
        (!jump || airborne)) return iceFrames;
  }
  assert.fail(`${game.level.name}: cannot reach ${x}/${floor}; stopped at ${game.player.x.toFixed(1)}/${(game.player.y + game.player.h).toFixed(1)}`);
}

test("a real-input playthrough beats the Mega-Vac, reaches every golden key, and wins all seven trails inside gold par without losing a heart", () => {
  const game = createGame();
  startGame(game);
  stepGame(game);
  for (const [index, route] of ROUTES.entries()) {
    for (const [x, floor, jump] of route) travel(game, x, floor, jump);
    if (game.level.boss) fightBoss(game);
    assert.equal(game.keyFound, true, `${game.level.name}: golden key was not reachable`);
    // Par times are tuned from this replay: its careful route must earn gold.
    assert.equal(medalFor(runMs(game.levelTime), game.level.par), "gold", `${game.level.name}: ${game.levelTime.toFixed(2)}s misses gold`);
    assert.equal(game.status, index === ROUTES.length - 1 ? "won" : "level-complete");
    if (game.status === "level-complete") {
      nextLevel(game);
      stepGame(game);
    }
  }
  assert.equal(game.deaths, 0);
  // Bone treats along the route top the pup up to the heart cap.
  assert.equal(game.lives, MAX_LIVES);
  assert.ok(game.totalTreats > 0);
});

test("a real-input run of the secret icy trail befriends the Grumpy Yeti, finds the key and wins inside gold par without losing a heart", () => {
  const game = createGame(SECRET_INDEX);
  startGame(game);
  stepGame(game);
  let iceFrames = 0;
  for (const [x, floor, jump] of SECRET_ROUTE) iceFrames += travel(game, x, floor, jump);
  assert.ok(iceFrames >= 120, `the route really crosses the ice (${iceFrames} frames)`);
  const fight = fightYeti(game);
  for (const type of ["yeti-wake", "yeti-aim", "yeti-throw", "yeti-crouch", "yeti-slip", "yeti-hit", "yeti-befriended"]) {
    assert.ok(fight.seen.has(type), `the fight never showed ${type}`);
  }
  assert.ok(fight.iceFrames > 0, "the pup lures the Yeti from the ice");
  assert.equal(game.keyFound, true);
  assert.equal(game.status, "won");
  assert.equal(medalFor(runMs(game.levelTime), game.level.par), "gold", `${game.levelTime.toFixed(2)}s misses gold`);
  assert.equal(game.deaths, 0);
});

test("a real-input run of Harvest Hollow bounces off hay bales to the hayloft key and wins inside gold par without losing a heart", () => {
  const game = createGame(BONUS_INDEX);
  startGame(game);
  stepGame(game);
  let hayJumps = 0;
  const step = game.events.push.bind(game.events);
  game.events.push = (...events) => {
    hayJumps += events.filter((event) => event.type === "hay-jump").length;
    return step(...events);
  };
  for (const [x, floor, jump] of HARVEST_ROUTE) travel(game, x, floor, jump);
  assert.ok(hayJumps >= 3, `the route bounces off the bales (${hayJumps})`);
  assert.equal(game.keyFound, true);
  assert.equal(game.status, "won");
  assert.equal(medalFor(runMs(game.levelTime), game.level.par), "gold", `${game.levelTime.toFixed(2)}s misses gold`);
  assert.equal(game.deaths, 0);
});

test("every Daily Walk remix stays winnable: the real-input route finds the key and reaches the doghouse with each modifier", () => {
  for (const modifier of MODIFIER_IDS) {
    for (const trail of MODIFIERS[modifier].trails) {
      for (const seed of [1, 2024, 0xdecafbad]) {
        const level = remixTrail(LEVELS[trail], modifier, createRandom(seed));
        level.daily = { trail, modifier };
        const game = createGame(trail, { level });
        startGame(game);
        stepGame(game);
        let iceFrames = 0;
        for (const [x, floor, jump] of ROUTES[trail]) iceFrames += travel(game, x, floor, jump);
        const label = `${level.name} (${modifier}, seed ${seed})`;
        assert.equal(game.keyFound, true, `${label}: golden key was not reachable`);
        assert.equal(game.status, "won", `${label}: the walk should end at the doghouse`);
        assert.equal(game.deaths, 0, label);
        if (modifier === "slippery") assert.ok(iceFrames > 0, `${label}: the route never touched the ice`);
      }
    }
  }
});

test("a whole year of real Daily Walks can be won with real inputs", () => {
  const day = Date.UTC(2027, 0, 1);
  for (let offset = 0; offset < 365; offset += 1) {
    const { date, trail, level } = dailyChallenge(new Date(day + offset * 864e5).toISOString().slice(0, 10));
    const game = createGame(trail, { level });
    startGame(game);
    stepGame(game);
    for (const [x, floor, jump] of ROUTES[trail]) travel(game, x, floor, jump);
    assert.equal(game.status, "won", `${date}: ${level.daily.title} was not won`);
    assert.equal(game.deaths, 0, date);
  }
});
