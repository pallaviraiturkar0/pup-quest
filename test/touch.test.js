import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, startGame, stepGame } from "../src/engine.js";
import {
  actionAt, arrowPixels, clearTouches, createTouchState, PAW_SIZE, pawPixels, pawPrintSvg, pointerDown, pointerMove,
  pointerUp, shouldShowTouchControls, TOUCH_ACTIONS, TOUCH_SLOP, touchInput,
} from "../src/touch.js";

const ZONES = [
  { action: "left", left: 10, top: 100, right: 74, bottom: 164 },
  { action: "right", left: 86, top: 100, right: 150, bottom: 164 },
  { action: "jump", left: 280, top: 90, right: 362, bottom: 172 },
];

test("hit-testing finds the paw under a finger, forgives near misses, and ignores far touches", () => {
  assert.equal(actionAt(ZONES, 40, 130), "left");
  assert.equal(actionAt(ZONES, 120, 130), "right");
  assert.equal(actionAt(ZONES, 300, 172), "jump");
  assert.equal(actionAt(ZONES, 40, 164 + TOUCH_SLOP - 1), "left");
  assert.equal(actionAt(ZONES, 40, 164 + TOUCH_SLOP + 1), null);
  assert.equal(actionAt(ZONES, 220, 130), null);
  assert.equal(actionAt(ZONES, 78, 130), "left", "the gap goes to the nearer paw");
  assert.equal(actionAt(ZONES, 83, 130), "right");
  assert.equal(actionAt([{ action: "dig", left: 0, top: 0, right: 10, bottom: 10 }], 5, 5), null);
});

test("pressing paws maps to engine input and jump is queued once per press", () => {
  const state = createTouchState();
  assert.deepEqual(touchInput(state), { left: false, right: false, jumpHeld: false });
  assert.equal(pointerDown(state, 1, "right"), false);
  assert.deepEqual(touchInput(state), { left: false, right: true, jumpHeld: false });
  assert.equal(pointerDown(state, 2, "jump"), true);
  assert.deepEqual(touchInput(state), { left: false, right: true, jumpHeld: true });
  assert.equal(pointerDown(state, 3, "jump"), false, "a second finger on a held jump is not a new press");
  pointerUp(state, 2);
  assert.equal(touchInput(state).jumpHeld, true, "jump stays held while any finger is on it");
  pointerUp(state, 3);
  assert.deepEqual(touchInput(state), { left: false, right: true, jumpHeld: false });
  assert.equal(pointerDown(state, 4, null), false);
  assert.equal(pointerDown(state, 4, "bark"), false);
  assert.equal(state.pointers.size, 1);
  pointerUp(state, 99);
  clearTouches(state);
  assert.deepEqual(touchInput(state), { left: false, right: false, jumpHeld: false });
});

test("multi-touch: run and jump at the same time, and two directions can be held", () => {
  const state = createTouchState();
  pointerDown(state, 10, "left");
  pointerDown(state, 11, "right");
  assert.equal(pointerDown(state, 12, "jump"), true);
  assert.deepEqual(touchInput(state), { left: true, right: true, jumpHeld: true });
  pointerUp(state, 10);
  assert.deepEqual(touchInput(state), { left: false, right: true, jumpHeld: true });
});

test("a finger can slide between paws without lifting, and drifting off keeps its action", () => {
  const state = createTouchState();
  pointerDown(state, 1, "left");
  assert.equal(pointerMove(state, 1, actionAt(ZONES, 120, 130)), false);
  assert.deepEqual(touchInput(state), { left: false, right: true, jumpHeld: false });
  assert.equal(pointerMove(state, 1, actionAt(ZONES, 220, 130)), false, "off every paw");
  assert.equal(touchInput(state).right, true);
  assert.equal(pointerMove(state, 1, "jump"), true, "sliding onto jump is a jump press");
  assert.equal(pointerMove(state, 1, "jump"), false);
  assert.deepEqual(touchInput(state), { left: false, right: false, jumpHeld: true });
  assert.equal(pointerMove(state, 7, "left"), false, "untracked pointers are ignored");
  assert.equal(state.pointers.has(7), false);
});

test("sliding onto jump while another finger holds it is not a second press", () => {
  const state = createTouchState();
  pointerDown(state, 1, "jump");
  pointerDown(state, 2, "right");
  assert.equal(pointerMove(state, 2, "jump"), false);
});

test("touch input drives the engine: hold right and tap jump", () => {
  const game = createGame();
  startGame(game);
  game.events.length = 0;
  const state = createTouchState();
  const startX = game.player.x;
  pointerDown(state, 1, "right");
  let jumpQueued = pointerDown(state, 2, "jump");
  for (let i = 0; i < 30; i += 1) {
    stepGame(game, { ...touchInput(state), jumpPressed: jumpQueued }, 1 / 120);
    jumpQueued = false;
  }
  assert.ok(game.player.x > startX, "pup runs right");
  assert.ok(game.events.some((event) => event.type === "jump"), "pup jumps");
});

test("controls show only on touch-capable devices", () => {
  assert.equal(shouldShowTouchControls(), false);
  assert.equal(shouldShowTouchControls({ coarsePointer: false, maxTouchPoints: 0 }), false);
  assert.equal(shouldShowTouchControls({ coarsePointer: true }), true);
  assert.equal(shouldShowTouchControls({ maxTouchPoints: 5 }), true);
  assert.equal(shouldShowTouchControls({ touchSeen: true }), true);
});

test("the procedural paw has a pad and four separate toe beans on a symmetric grid", () => {
  const rows = pawPixels();
  assert.equal(rows.length, PAW_SIZE);
  for (const row of rows) {
    assert.equal(row.length, PAW_SIZE);
    assert.equal(row, [...row].reverse().join(""), "left-right symmetric");
  }
  const seen = new Set();
  let blobs = 0;
  for (let y = 0; y < PAW_SIZE; y += 1) {
    for (let x = 0; x < PAW_SIZE; x += 1) {
      if (rows[y][x] !== "#" || seen.has(`${x},${y}`)) continue;
      blobs += 1;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= PAW_SIZE || cy >= PAW_SIZE || rows[cy][cx] !== "#" || seen.has(`${cx},${cy}`)) continue;
        seen.add(`${cx},${cy}`);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    }
  }
  assert.equal(blobs, 5, "one main pad plus four toes");
});

test("each paw's arrow sits inside the main pad and points the action's way", () => {
  const rows = pawPixels();
  const mean = (pixels, axis) => pixels.reduce((sum, pixel) => sum + pixel[axis], 0) / pixels.length;
  for (const action of TOUCH_ACTIONS) {
    const arrow = arrowPixels(action);
    assert.equal(arrow.length, 24, action);
    for (const [x, y] of arrow) assert.equal(rows[y]?.[x], "#", `${action} arrow pixel ${x},${y} is on the pad`);
  }
  // The arrowhead holds most of the pixels, so the arrow's mass leans toward where it points.
  const [centreX, centreY] = [11.5, 15.5];
  assert.ok(mean(arrowPixels("jump"), 1) < centreY - 0.05, "jump points up");
  assert.ok(mean(arrowPixels("right"), 0) > centreX + 0.05, "right points right");
  assert.ok(mean(arrowPixels("left"), 0) < centreX - 0.05, "left points left");
  const [left, right] = [arrowPixels("left"), arrowPixels("right")];
  assert.deepEqual(left.map(([x, y]) => `${PAW_SIZE - 1 - x},${y}`).sort(), right.map(([x, y]) => `${x},${y}`).sort(), "left mirrors right");
  assert.throws(() => arrowPixels("fetch"), /Unknown touch action/);
});

test("paw buttons are self-contained inline SVG with no binary or external assets", () => {
  const faces = new Set();
  for (const action of TOUCH_ACTIONS) {
    const svg = pawPrintSvg(action);
    assert.match(svg, new RegExp(`^<svg class="paw" viewBox="0 0 ${PAW_SIZE} ${PAW_SIZE}" aria-hidden="true"`));
    assert.match(svg, /class="paw-pad" d="(M\d+ \d+h\d+v1h-\d+z)+"/);
    assert.match(svg, /class="paw-arrow" d="(M\d+ \d+h\d+v1h-\d+z)+"/);
    assert.doesNotMatch(svg, /<image|href=|url\(|data:/);
    assert.match(svg, /<\/svg>$/);
    faces.add(svg);
  }
  assert.equal(faces.size, TOUCH_ACTIONS.length, "each action has a distinct face");
  assert.throws(() => pawPrintSvg("sit"), /Unknown touch action/);
});

test("the page has one paw button per touch action and keeps keyboard hints", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const action of TOUCH_ACTIONS) assert.equal(html.match(new RegExp(`data-control="${action}"`, "g"))?.length, 1, action);
  assert.match(html, /class="keyboard-legend"/);
});
