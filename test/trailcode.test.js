import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILDER_THEMES, CELL, cloneTrail, decodeTrail, emptyTrail, encodeTrail, EXAMPLE_CODE, exampleTrail, GROUND, GROUND_ROW, MAX_CODE_LENGTH,
  MAX_COLUMNS, MAX_TREATS, MIN_COLUMNS, paintCell, ROWS, shareUrl, START_COLUMNS, TrailCodeError, trailFromSearch, trailToLevel, treatCount,
} from "../src/trailcode.js";
import { createGame, restartGame, startGame, stepGame } from "../src/engine.js";
import { GROUND_Y, TILE } from "../src/levels.js";
import { createRandom } from "../src/daily.js";
import { THEMES } from "../src/themes.js";

const toBytes = (code) => [...Buffer.from(code, "base64url")];
const toCode = (bytes) => Buffer.from(bytes).toString("base64url");
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
// Rewrites a code's bytes and fixes up its checksum, so only the edited field is wrong.
function edit(code, change) {
  const bytes = toBytes(code).slice(0, -2);
  change(bytes);
  let a = 0;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 255;
    b = (b + a) % 255;
  }
  return toCode([...bytes, b, a]);
}

// Packs a trail into a checksummed code without validating it.
function pack(trail) {
  const cells = new Array(Math.ceil((trail.columns * ROWS * 2) / 8)).fill(0);
  let bit = 0;
  for (let column = 0; column < trail.columns; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      cells[bit >> 3] |= trail.cells[row][column] << (6 - (bit & 7));
      bit += 2;
    }
  }
  return edit(toCode([0, 0, 0, 0, 0, 0]), (bytes) => bytes.splice(0, bytes.length, 1, BUILDER_THEMES.indexOf(trail.theme), trail.columns, trail.goal, ...cells));
}

function randomTrail(random) {
  const columns = MIN_COLUMNS + Math.floor(random() * (MAX_COLUMNS - MIN_COLUMNS + 1));
  const trail = emptyTrail({ columns, theme: BUILDER_THEMES[Math.floor(random() * BUILDER_THEMES.length)] });
  trail.goal = START_COLUMNS + Math.floor(random() * (columns - 2 - START_COLUMNS));
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < GROUND_ROW; row += 1) {
      const roll = random();
      trail.cells[row][column] = roll < 0.1 ? CELL.PLATFORM : roll < 0.13 ? CELL.TREAT : CELL.EMPTY;
    }
    if (column >= START_COLUMNS && column !== trail.goal && column !== trail.goal + 1) trail.cells[GROUND_ROW][column] = Math.floor(random() * 3);
  }
  return trail;
}

test("trails survive an encode/decode round trip", () => {
  assert.deepEqual(decodeTrail(EXAMPLE_CODE).trail, exampleTrail());
  assert.equal(pack(exampleTrail()), EXAMPLE_CODE);
  const random = createRandom(7);
  for (let index = 0; index < 300; index += 1) {
    const trail = randomTrail(random);
    if (treatCount(trail) > MAX_TREATS) continue;
    const code = encodeTrail(trail);
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    assert.ok(code.length <= MAX_CODE_LENGTH);
    assert.equal(encodeURIComponent(code), code, "codes need no URL escaping");
    assert.deepEqual(decodeTrail(code).trail, trail);
  }
  for (const columns of [MIN_COLUMNS, MAX_COLUMNS]) {
    for (const theme of BUILDER_THEMES) {
      const trail = emptyTrail({ columns, theme });
      assert.deepEqual(decodeTrail(encodeTrail(trail)).trail, trail);
    }
  }
});

test("every builder theme is a real theme, and the order is append-only", () => {
  assert.deepEqual(BUILDER_THEMES.slice(0, 10), ["meadow", "forest", "night", "park", "beach", "city", "castle", "arctic", "autumn", "canyon"]);
  assert.ok(BUILDER_THEMES.every((theme) => Object.hasOwn(THEMES, theme)));
});

test("malformed codes are rejected with a friendly message and never throw", () => {
  const bad = [
    "", null, undefined, 42, {}, ["AQ"], "a".repeat(MAX_CODE_LENGTH + 1), "abc!", "a b", "AQ==", "%41Q", "<script>", "A",
    EXAMPLE_CODE.slice(0, -5), `${EXAMPLE_CODE}AA`, EXAMPLE_CODE.slice(0, 20) + (EXAMPLE_CODE[20] === "A" ? "B" : "A") + EXAMPLE_CODE.slice(21),
    edit(EXAMPLE_CODE, (bytes) => { bytes[0] = 2; }),
    edit(EXAMPLE_CODE, (bytes) => { bytes[1] = BUILDER_THEMES.length; }),
    edit(EXAMPLE_CODE, (bytes) => { bytes[2] = MIN_COLUMNS - 1; }),
    edit(EXAMPLE_CODE, (bytes) => { bytes[2] = MAX_COLUMNS + 1; }),
    edit(EXAMPLE_CODE, (bytes) => { bytes[3] = 2; }),
    edit(EXAMPLE_CODE, (bytes) => { bytes[3] = 39; }),
    edit(EXAMPLE_CODE, (bytes) => { bytes[4] = 0xc0; }), // a 2-bit cell of 3
    // 31 columns of 18 bits leave two unused bits in the last byte.
    edit(encodeTrail(emptyTrail({ columns: 31 })), (bytes) => { bytes[bytes.length - 1] |= 1; }),
    edit(EXAMPLE_CODE, (bytes) => { bytes.push(0); }),
    // atob drops the unused low bits of the last character; a noncanonical spelling must still be refused.
    ((code) => code.slice(0, -1) + B64URL[B64URL.indexOf(code.at(-1)) ^ 1])(encodeTrail(emptyTrail({ columns: 30 }))),
  ];
  for (const code of bad) {
    const result = decodeTrail(code);
    assert.equal(result.trail, undefined, `accepted ${JSON.stringify(code)}`);
    assert.equal(typeof result.error, "string");
    assert.ok(result.error.length > 0 && !result.error.includes("Error"), result.error);
  }
  assert.ok(decodeTrail(edit(encodeTrail(emptyTrail({ columns: 31 })), () => {})).trail, "the edit helper alone keeps a code valid");
  const random = createRandom(99);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=+/ %!";
  for (let index = 0; index < 3000; index += 1) {
    const length = Math.floor(random() * 140);
    const code = random() < 0.5
      ? Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join("")
      : EXAMPLE_CODE.slice(0, length) + alphabet[Math.floor(random() * 64)] + EXAMPLE_CODE.slice(length + 1);
    const result = decodeTrail(code);
    assert.ok(result.trail || typeof result.error === "string");
    if (result.trail) assert.equal(encodeTrail(result.trail), code);
  }
});

test("decoded trails keep the start and doghouse on plain ground", () => {
  const startGap = cloneTrail(exampleTrail());
  startGap.cells[GROUND_ROW][2] = GROUND.GAP;
  const spikeUnderHouse = cloneTrail(exampleTrail());
  spikeUnderHouse.cells[GROUND_ROW][36] = GROUND.SPIKE;
  const greedy = emptyTrail();
  for (let column = 0; column < greedy.columns; column += 1) greedy.cells[0][column] = greedy.cells[1][column] = CELL.TREAT;
  for (const trail of [startGap, spikeUnderHouse, greedy]) {
    assert.throws(() => encodeTrail(trail), TrailCodeError);
    // A hand-packed code with the same problem is rejected too.
    const code = pack(trail);
    assert.ok(decodeTrail(code).error);
  }
});

test("?trail= codes load from the query string", () => {
  assert.equal(trailFromSearch(""), null);
  assert.equal(trailFromSearch("?theme=beach"), null);
  assert.deepEqual(trailFromSearch(`?trail=${EXAMPLE_CODE}`).trail, exampleTrail());
  assert.deepEqual(trailFromSearch(`?theme=night&trail=${EXAMPLE_CODE}%20`).trail, exampleTrail());
  assert.ok(trailFromSearch("?trail=").error);
  assert.ok(trailFromSearch("?trail=not+a+code").error);
  assert.ok(trailFromSearch("?trail=%E2%9C%A8").error);
  const url = shareUrl(EXAMPLE_CODE, { href: "https://example.com/pup-quest/?trail=old&theme=city#game" });
  assert.equal(url, `https://example.com/pup-quest/?trail=${EXAMPLE_CODE}`);
  assert.deepEqual(trailFromSearch(new URL(url).search).trail, exampleTrail());
});

test("a built trail becomes a level the engine can play", () => {
  const trail = exampleTrail();
  const level = trailToLevel(trail, { shared: true });
  assert.equal(level.width, 40 * TILE);
  assert.deepEqual(level.gaps, [{ x: 11 * TILE, w: 2 * TILE }, { x: 24 * TILE, w: 3 * TILE }]);
  assert.deepEqual(level.ground.map(({ x, w }) => [x / TILE, w / TILE]), [[0, 11], [13, 11], [27, 13]]);
  assert.deepEqual(level.platforms.map(({ x, y, w }) => [x / TILE, y / TILE, w / TILE]), [[10, 10, 4], [23, 11, 5]]);
  assert.deepEqual(level.spikes.map((spike) => (spike.x - 2) / TILE), [18, 32]);
  assert.equal(level.treats.length, treatCount(trail));
  assert.equal(level.exit.x, 35 * TILE);
  assert.deepEqual(level.built, { code: EXAMPLE_CODE, shared: true });
  assert.equal(level.treats.find((treat) => treat.x === 7 * TILE + 8).y, GROUND_Y - 8, "bottom-row treats sit where a walking pup grabs them");

  const game = createGame(0, { level });
  assert.equal(game.keyFound, true, "built trails have an open doghouse");
  startGame(game);
  // A simple bot: run right and jump just before every gap or spike.
  const ground = trail.cells[GROUND_ROW];
  let frames = 0;
  let treats = 0;
  while (game.status === "playing" && frames < 120 * 30) {
    const { player } = game;
    const ahead = Math.floor((player.x + player.w + 10) / TILE);
    const jump = player.grounded && ground[ahead] !== undefined && ground[ahead] !== GROUND.SOLID;
    stepGame(game, { right: true, jumpPressed: jump, jumpHeld: true });
    treats = game.levelTreats;
    frames += 1;
  }
  assert.equal(game.status, "won");
  assert.equal(game.deaths, 0);
  assert.ok(treats > 0);

  restartGame(game);
  assert.equal(game.level.built.code, EXAMPLE_CODE, "restarting replays the same built trail");
  for (let step = 0; step < 120 * 20 && game.status === "playing"; step += 1) stepGame(game, { right: true });
  assert.ok(game.deaths > 0, "running blindly into the example's spikes or water costs hearts");
});

test("the builder's tools keep the trail valid", () => {
  const trail = emptyTrail();
  assert.equal(paintCell(trail, "platform", 10, 3).changed, true);
  assert.equal(trail.cells[3][10], CELL.PLATFORM);
  assert.equal(paintCell(trail, "platform", 10, 3).changed, false);
  assert.equal(paintCell(trail, "treat", 10, 3).changed, true);
  assert.equal(paintCell(trail, "erase", 10, 3).changed, true);
  assert.equal(trail.cells[3][10], CELL.EMPTY);
  assert.equal(paintCell(trail, "erase", 10, GROUND_ROW).changed, true);
  assert.equal(trail.cells[GROUND_ROW][10], GROUND.GAP);
  assert.equal(paintCell(trail, "spike", 12, GROUND_ROW).changed, true);
  assert.equal(paintCell(trail, "ground", 12, GROUND_ROW).changed, true);
  for (const [tool, row] of [["ground", 2], ["spike", 2], ["platform", GROUND_ROW], ["treat", GROUND_ROW]]) {
    assert.match(paintCell(trail, tool, 15, row).message, /row|above/);
  }
  assert.match(paintCell(trail, "erase", 2, GROUND_ROW).message, /start/);
  assert.match(paintCell(trail, "spike", trail.goal + 1, GROUND_ROW).message, /doghouse/);
  assert.equal(paintCell(trail, "goal", 3, 4).changed, false);
  paintCell(trail, "erase", 20, GROUND_ROW);
  paintCell(trail, "spike", 21, GROUND_ROW);
  assert.equal(paintCell(trail, "goal", 20, 1).changed, true);
  assert.equal(trail.goal, 20);
  assert.deepEqual(trail.cells[GROUND_ROW].slice(20, 22), [GROUND.SOLID, GROUND.SOLID], "placing the doghouse lays ground under it");
  assert.equal(paintCell(trail, "treat", -1, 0).changed, false);
  assert.equal(paintCell(trail, "treat", 0, ROWS).changed, false);
  assert.ok(paintCell(trail, "dig", 15, 2).message);
  for (let column = 0; column < trail.columns && treatCount(trail) < MAX_TREATS; column += 1) {
    for (const row of [0, 1]) if (treatCount(trail) < MAX_TREATS) paintCell(trail, "treat", column, row);
  }
  assert.match(paintCell(trail, "treat", 5, 6).message, /treats/);
  assert.deepEqual(decodeTrail(encodeTrail(trail)).trail, trail);
});
