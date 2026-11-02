// Touch controls: pure pointer-to-action logic plus procedural paw-print button art.
// Nothing here touches the DOM, so it runs under node tests.

export const TOUCH_ACTIONS = ["left", "right", "jump"];

// Extra hit area (CSS pixels) around each button so a drifting thumb stays on target.
export const TOUCH_SLOP = 12;

export function createTouchState() {
  return { pointers: new Map() };
}

export function isTouchAction(action) {
  return TOUCH_ACTIONS.includes(action);
}

/**
 * Finds the action under a point. `zones` is a list of `{ action, left, top, right, bottom }`
 * rectangles (for example from getBoundingClientRect). A point inside a button wins; otherwise
 * the closest button within `slop` pixels does. Returns null when no button is close enough.
 */
export function actionAt(zones, x, y, slop = TOUCH_SLOP) {
  let best = null;
  let bestDistance = Infinity;
  for (const zone of zones) {
    if (!isTouchAction(zone.action)) continue;
    const dx = Math.max(zone.left - x, 0, x - zone.right);
    const dy = Math.max(zone.top - y, 0, y - zone.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance <= slop && distance < bestDistance) {
      best = zone.action;
      bestDistance = distance;
    }
  }
  return best;
}

function heldBy(state, action) {
  for (const held of state.pointers.values()) if (held === action) return true;
  return false;
}

/** A finger lands. Returns true when it should queue a jump press. */
export function pointerDown(state, pointerId, action) {
  if (!isTouchAction(action)) return false;
  const jumpPressed = action === "jump" && !heldBy(state, "jump");
  state.pointers.set(pointerId, action);
  return jumpPressed;
}

/**
 * A tracked finger slides. Moving onto another button switches to it, so a thumb can roll from
 * left to right (or onto jump) without lifting. Sliding off every button keeps the last action,
 * which forgives thumbs that drift while running. Returns true when it should queue a jump press.
 */
export function pointerMove(state, pointerId, action) {
  const current = state.pointers.get(pointerId);
  if (current === undefined || !isTouchAction(action) || action === current) return false;
  state.pointers.delete(pointerId);
  return pointerDown(state, pointerId, action);
}

export function pointerUp(state, pointerId) {
  state.pointers.delete(pointerId);
}

export function clearTouches(state) {
  state.pointers.clear();
}

/** Held actions in the same shape the engine's input uses. */
export function touchInput(state) {
  return { left: heldBy(state, "left"), right: heldBy(state, "right"), jumpHeld: heldBy(state, "jump") };
}

/**
 * Show on-screen controls only on touch-capable devices: a coarse primary pointer, any touch
 * points, or a touch that has actually happened (for hybrid laptops and tablets with keyboards).
 */
export function shouldShowTouchControls({ coarsePointer = false, maxTouchPoints = 0, touchSeen = false } = {}) {
  return Boolean(coarsePointer || maxTouchPoints > 0 || touchSeen);
}

// --- Procedural paw-print art -----------------------------------------------------------

export const PAW_SIZE = 24;

// Main pad and four toe beans, as ellipses on a 24 x 24 pixel grid (toes point up).
const PAW_SHAPES = [
  { cx: 12, cy: 16.4, rx: 7.8, ry: 5.8 },
  { cx: 3.6, cy: 9.6, rx: 2.3, ry: 2.9 },
  { cx: 8.4, cy: 5, rx: 2.4, ry: 3.1 },
  { cx: 15.6, cy: 5, rx: 2.4, ry: 3.1 },
  { cx: 20.4, cy: 9.6, rx: 2.3, ry: 2.9 },
];

// An up-arrow stamped into the main pad, centred on the pixel corner ARROW_CENTRE.
const ARROW = [
  "...##...",
  "..####..",
  ".######.",
  "########",
  "...##...",
  "...##...",
];
const ARROW_CENTRE = [12, 16];

/** The arrow's [x, y] pixels, turned a quarter turn to point left or right when needed. */
export function arrowPixels(action) {
  if (!isTouchAction(action)) throw new Error(`Unknown touch action: ${action}`);
  const [cx, cy] = ARROW_CENTRE;
  const pixels = [];
  ARROW.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell !== "#") return;
    // Pixel centre relative to the arrow's centre, rotated clockwise for right and anticlockwise for left.
    const dx = x + 0.5 - ARROW[0].length / 2;
    const dy = y + 0.5 - ARROW.length / 2;
    const [rx, ry] = action === "right" ? [-dy, dx] : action === "left" ? [dy, -dx] : [dx, dy];
    pixels.push([cx + rx - 0.5, cy + ry - 0.5]);
  }));
  return pixels;
}

/** Rasterizes the paw into rows of "#" (pad) and "." (empty) on a PAW_SIZE grid. */
export function pawPixels() {
  return Array.from({ length: PAW_SIZE }, (_, y) => Array.from({ length: PAW_SIZE }, (_, x) => {
    const px = x + 0.5;
    const py = y + 0.5;
    return PAW_SHAPES.some(({ cx, cy, rx, ry }) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1) ? "#" : ".";
  }).join(""));
}

function rowRunsPath(isOn) {
  let path = "";
  for (let y = 0; y < PAW_SIZE; y += 1) {
    let x = 0;
    while (x < PAW_SIZE) {
      if (!isOn(x, y)) { x += 1; continue; }
      const start = x;
      while (x < PAW_SIZE && isOn(x, y)) x += 1;
      path += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  }
  return path;
}

/**
 * Builds inline SVG markup for a pixel paw-print button face: an upright paw with an arrow
 * stamped into its main pad, pointing up for jump and sideways for left and right.
 */
export function pawPrintSvg(action) {
  const arrow = new Set(arrowPixels(action).map(([x, y]) => `${x},${y}`));
  const rows = pawPixels();
  const pad = rowRunsPath((x, y) => rows[y][x] === "#" && !arrow.has(`${x},${y}`));
  const mark = rowRunsPath((x, y) => arrow.has(`${x},${y}`));
  return `<svg class="paw" viewBox="0 0 ${PAW_SIZE} ${PAW_SIZE}" aria-hidden="true" focusable="false" shape-rendering="crispEdges">`
    + `<path class="paw-pad" d="${pad}" fill="currentColor"/>`
    + `<path class="paw-arrow" d="${mark}"/>`
    + "</svg>";
}
