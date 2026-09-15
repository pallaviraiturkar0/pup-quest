import test from "node:test";
import assert from "node:assert/strict";
import { createGame, nextLevel, PHYSICS, startGame, stepGame } from "../src/engine.js";

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
];

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

test("a real-input playthrough reaches every golden key and wins all three trails without losing a heart", () => {
  const game = createGame();
  startGame(game);
  stepGame(game);
  for (const [index, route] of ROUTES.entries()) {
    for (const [x, floor, jump] of route) travel(game, x, floor, jump);
    assert.equal(game.keyFound, true, `${game.level.name}: golden key was not reachable`);
    assert.equal(game.status, index === ROUTES.length - 1 ? "won" : "level-complete");
    if (game.status === "level-complete") {
      nextLevel(game);
      stepGame(game);
    }
  }
  assert.equal(game.deaths, 0);
  assert.equal(game.lives, 3);
  assert.ok(game.totalTreats > 0);
});
