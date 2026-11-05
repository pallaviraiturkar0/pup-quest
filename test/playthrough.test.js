import test from "node:test";
import assert from "node:assert/strict";
import { createGame, nextLevel, PHYSICS, startGame, stepGame } from "../src/engine.js";
import { BOSS } from "../src/boss.js";
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

function travel(game, x, floor, jump = false) {
  let airborne = false;
  for (let frame = 0; frame < 1600; frame += 1) {
    const p = game.player;
    const distance = x - p.x;
    const brakingDistance = p.vx * p.vx / (2 * PHYSICS.acceleration);
    const direction = Math.abs(distance) > brakingDistance + 0.6 ? Math.sign(distance) : 0;
    stepGame(game, {
      left: direction < 0, right: direction > 0,
      jumpPressed: jump && frame === 0, jumpHeld: jump,
    }, 1 / 120);
    game.events.length = 0;
    airborne ||= !game.player.grounded;
    assert.equal(game.deaths, 0, `${game.level.name}: lost a life en route to ${x}/${floor}`);
    if (game.status !== "playing") return;
    if (Math.abs(game.player.x - x) < 2 && Math.abs(game.player.vx) < 10 &&
        game.player.grounded && Math.abs(game.player.y + game.player.h - floor) < 1 &&
        (!jump || airborne)) return;
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
