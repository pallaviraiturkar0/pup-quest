// Trail Builder share codes. A built trail is a small grid: one ground row along the bottom plus
// rows above it for ledges and treats, and a doghouse goal. It travels as a compact, URL-safe
// code (`?trail=<code>`). Everything here is DOM-free so node tests can check the format.
//
// Code layout (base64url, no padding):
//   byte 0      format version (1)
//   byte 1      theme, an index into BUILDER_THEMES (append-only so old codes keep their look)
//   byte 2      columns (MIN_COLUMNS..MAX_COLUMNS)
//   byte 3      goal column: the doghouse covers it and the next column
//   bytes 4..   2-bit cells, column by column from the top row down; unused trailing bits are 0
//   last 2      Fletcher-16 checksum of everything before it, so typos are caught
//
// Decoding is strict: anything malformed is rejected with a friendly message, never thrown.

import { GROUND_Y, TILE } from "./levels.js";

export const CODE_VERSION = 1;
export const BUILDER_THEMES = Object.freeze(["meadow", "forest", "night", "park", "beach", "city", "castle", "arctic", "autumn"]);
export const MIN_COLUMNS = 30;
export const MAX_COLUMNS = 80;
export const DEFAULT_COLUMNS = 40;
// Rows 0..7 sit on tile rows 5..12 (ledges and treats); the last row is the ground at GROUND_Y.
export const ROWS = 9;
export const GROUND_ROW = ROWS - 1;
const TOP_TILE_ROW = GROUND_Y / TILE - GROUND_ROW;
// Biscuit starts in column 3, so the first columns are always plain ground.
export const START_COLUMNS = 6;
export const MAX_TREATS = 60;

export const CELL = Object.freeze({ EMPTY: 0, PLATFORM: 1, TREAT: 2 });
export const GROUND = Object.freeze({ GAP: 0, SOLID: 1, SPIKE: 2 });
export const TOOLS = Object.freeze(["ground", "platform", "spike", "treat", "goal", "erase"]);
export const TOOL_LABELS = Object.freeze({ ground: "Ground", platform: "Ledge", spike: "Spikes", treat: "Treat", goal: "Doghouse", erase: "Erase" });

const HEADER_BYTES = 4;
const CHECKSUM_BYTES = 2;
const cellBytes = (columns) => Math.ceil((columns * ROWS * 2) / 8);
export const MAX_CODE_LENGTH = Math.ceil(((HEADER_BYTES + cellBytes(MAX_COLUMNS) + CHECKSUM_BYTES) * 4) / 3);

export class TrailCodeError extends Error {}

function fail(message) {
  throw new TrailCodeError(message);
}

// A fresh trail: flat ground all the way with the doghouse near the end, like the campaign trails.
export function emptyTrail({ columns = DEFAULT_COLUMNS, theme = "park" } = {}) {
  const cells = Array.from({ length: ROWS }, (_, row) => Array(columns).fill(row === GROUND_ROW ? GROUND.SOLID : CELL.EMPTY));
  return { theme, columns, goal: columns - 6, cells };
}

export function cloneTrail(trail) {
  return { theme: trail.theme, columns: trail.columns, goal: trail.goal, cells: trail.cells.map((row) => [...row]) };
}

export function treatCount(trail) {
  return trail.cells.slice(0, GROUND_ROW).reduce((sum, row) => sum + row.filter((cell) => cell === CELL.TREAT).length, 0);
}

const goalColumns = (trail) => [trail.goal, trail.goal + 1];

// Everything a valid trail must satisfy. Returns a friendly message for the first problem, or null.
export function trailProblem(trail) {
  if (!trail || typeof trail !== "object") return "That trail is empty.";
  const { theme, columns, goal, cells } = trail;
  if (!BUILDER_THEMES.includes(theme)) return "That trail uses a theme this game doesn't know.";
  if (!Number.isInteger(columns) || columns < MIN_COLUMNS || columns > MAX_COLUMNS) return `Trails are ${MIN_COLUMNS} to ${MAX_COLUMNS} tiles long.`;
  if (!Array.isArray(cells) || cells.length !== ROWS || cells.some((row) => !Array.isArray(row) || row.length !== columns)) return "That trail's grid is the wrong size.";
  for (let row = 0; row < ROWS; row += 1) {
    const allowed = row === GROUND_ROW ? Object.values(GROUND) : Object.values(CELL);
    if (cells[row].some((cell) => !allowed.includes(cell))) return "That trail has a tile this game doesn't know.";
  }
  if (!Number.isInteger(goal) || goal < START_COLUMNS || goal > columns - 3) return "The doghouse has to sit between the start and the end of the trail.";
  const ground = cells[GROUND_ROW];
  if (ground.slice(0, START_COLUMNS).some((cell) => cell !== GROUND.SOLID)) return "Biscuit needs plain ground at the start of the trail.";
  if (goalColumns(trail).some((column) => ground[column] !== GROUND.SOLID)) return "The doghouse needs plain ground under it.";
  if (treatCount(trail) > MAX_TREATS) return `A trail can hold up to ${MAX_TREATS} treats.`;
  return null;
}

// Fletcher-16 over the bytes.
function checksum(bytes) {
  let a = 0;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 255;
    b = (b + a) % 255;
  }
  return [b, a];
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code) {
  const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeTrail(trail) {
  const problem = trailProblem(trail);
  if (problem) fail(problem);
  const { columns } = trail;
  const bytes = new Uint8Array(HEADER_BYTES + cellBytes(columns) + CHECKSUM_BYTES);
  bytes.set([CODE_VERSION, BUILDER_THEMES.indexOf(trail.theme), columns, trail.goal]);
  let bit = 0;
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      bytes[HEADER_BYTES + (bit >> 3)] |= trail.cells[row][column] << (6 - (bit & 7));
      bit += 2;
    }
  }
  bytes.set(checksum(bytes.subarray(0, bytes.length - CHECKSUM_BYTES)), bytes.length - CHECKSUM_BYTES);
  return toBase64Url(bytes);
}

function decodeOrThrow(code) {
  if (typeof code !== "string" || code.length === 0) fail("That trail code is empty.");
  if (code.length > MAX_CODE_LENGTH) fail("That trail code is too long.");
  // base64url never leaves a single character over a multiple of four.
  if (!/^[A-Za-z0-9_-]+$/.test(code) || code.length % 4 === 1) fail("That trail code has characters that don't belong in a code.");
  const bytes = fromBase64Url(code);
  // atob ignores unused bits in the last character, so only the canonical spelling is accepted.
  if (toBase64Url(bytes) !== code) fail("That trail code has a typo somewhere. Check it was copied exactly.");
  if (bytes.length < HEADER_BYTES + CHECKSUM_BYTES) fail("That trail code is too short. Check it was copied in full.");
  const [version, themeIndex, columns, goal] = bytes;
  if (version !== CODE_VERSION) fail("That trail code was made by a different version of Pup Quest.");
  if (columns < MIN_COLUMNS || columns > MAX_COLUMNS) fail(`Trails are ${MIN_COLUMNS} to ${MAX_COLUMNS} tiles long.`);
  if (bytes.length !== HEADER_BYTES + cellBytes(columns) + CHECKSUM_BYTES) fail("That trail code is the wrong length. Check it was copied in full.");
  const sum = checksum(bytes.subarray(0, bytes.length - CHECKSUM_BYTES));
  if (sum[0] !== bytes[bytes.length - 2] || sum[1] !== bytes[bytes.length - 1]) fail("That trail code has a typo somewhere. Check it was copied exactly.");
  if (themeIndex >= BUILDER_THEMES.length) fail("That trail uses a theme this game doesn't know.");
  const trail = emptyTrail({ columns, theme: BUILDER_THEMES[themeIndex] });
  trail.goal = goal;
  let bit = 0;
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      trail.cells[row][column] = (bytes[HEADER_BYTES + (bit >> 3)] >> (6 - (bit & 7))) & 3;
      bit += 2;
    }
  }
  const padding = bit & 7;
  if (padding && bytes[HEADER_BYTES + (bit >> 3)] & (0xff >> padding)) fail("That trail code has stray bits at the end.");
  const problem = trailProblem(trail);
  if (problem) fail(problem);
  return trail;
}

// Never throws: returns { trail } for a good code or { error } with a message players can read.
export function decodeTrail(code) {
  try {
    return { trail: decodeOrThrow(code) };
  } catch (error) {
    if (error instanceof TrailCodeError) return { error: error.message };
    // atob rejects some impossible inputs that slip past the checks above.
    if (error instanceof DOMException || error instanceof TypeError || error instanceof RangeError) return { error: "That trail code couldn't be read." };
    throw error;
  }
}

// Reads `?trail=` from a query string. Returns null when there is no code.
export function trailFromSearch(search) {
  const code = new URLSearchParams(search ?? "").get("trail");
  return code === null ? null : decodeTrail(code.trim());
}

export function shareUrl(code, location) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("trail", code);
  return url.href;
}

// Applies one tool to a cell. Returns { changed, message } where message explains a refused placement.
export function paintCell(trail, tool, column, row) {
  const { cells } = trail;
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || column >= trail.columns || row < 0 || row >= ROWS) return { changed: false, message: null };
  const set = (r, value) => {
    if (cells[r][column] === value) return { changed: false, message: null };
    cells[r][column] = value;
    return { changed: true, message: null };
  };
  const refuse = (message) => ({ changed: false, message });
  const onGround = row === GROUND_ROW;
  const protectedGround = column < START_COLUMNS ? "Biscuit needs plain ground at the start." : goalColumns(trail).includes(column) ? "The doghouse needs plain ground under it." : null;
  switch (tool) {
    case "ground":
      return onGround ? set(GROUND_ROW, GROUND.SOLID) : refuse("Ground goes on the bottom row.");
    case "spike":
      if (!onGround) return refuse("Spikes go on the bottom row.");
      return protectedGround ? refuse(protectedGround) : set(GROUND_ROW, GROUND.SPIKE);
    case "platform":
      return onGround ? refuse("Ledges go above the ground.") : set(row, CELL.PLATFORM);
    case "treat":
      if (onGround) return refuse("Treats go above the ground.");
      if (cells[row][column] !== CELL.TREAT && treatCount(trail) >= MAX_TREATS) return refuse(`A trail can hold up to ${MAX_TREATS} treats.`);
      return set(row, CELL.TREAT);
    case "goal": {
      if (column < START_COLUMNS || column > trail.columns - 3) return refuse("The doghouse fits between the start and the last two columns.");
      if (column === trail.goal) return { changed: false, message: null };
      trail.goal = column;
      cells[GROUND_ROW][column] = GROUND.SOLID;
      cells[GROUND_ROW][column + 1] = GROUND.SOLID;
      return { changed: true, message: null };
    }
    case "erase":
      if (!onGround) return set(row, CELL.EMPTY);
      return protectedGround ? refuse(protectedGround) : set(GROUND_ROW, GROUND.GAP);
    default:
      return refuse("Pick a tool first.");
  }
}

function runs(values, wanted) {
  const found = [];
  let from = null;
  values.forEach((value, index) => {
    if (wanted(value) && from === null) from = index;
    if (!wanted(value) && from !== null) {
      found.push([from, index - from]);
      from = null;
    }
  });
  if (from !== null) found.push([from, values.length - from]);
  return found;
}

// Builds a playable level in the same shape as the campaign trails. The doghouse is open from
// the start: on a built trail the goal is simply reaching it.
export function trailToLevel(trail, { code = encodeTrail(trail), name = "Your trail", shared = false } = {}) {
  const problem = trailProblem(trail);
  if (problem) fail(problem);
  const ground = trail.cells[GROUND_ROW];
  const solid = (cell) => cell !== GROUND.GAP;
  const exitX = trail.goal * TILE;
  return {
    name,
    theme: trail.theme,
    width: trail.columns * TILE,
    start: { x: 48, y: GROUND_Y - 18 },
    ground: runs(ground, solid).map(([x, w]) => ({ x: x * TILE, y: GROUND_Y, w: w * TILE, h: 80 })),
    gaps: runs(ground, (cell) => !solid(cell)).map(([x, w]) => ({ x: x * TILE, w: w * TILE })),
    platforms: trail.cells.slice(0, GROUND_ROW).flatMap((row, index) => runs(row, (cell) => cell === CELL.PLATFORM)
      .map(([x, w]) => ({ x: x * TILE, y: (TOP_TILE_ROW + index) * TILE, w: w * TILE, h: TILE, ice: null }))),
    ice: [],
    treats: trail.cells.slice(0, GROUND_ROW).flatMap((row, index) => row.flatMap((cell, column) => cell === CELL.TREAT
      ? [{ x: column * TILE + 8, y: (TOP_TILE_ROW + index) * TILE + 8, collected: false }] : [])),
    powerups: [],
    key: { x: exitX + 16, y: GROUND_Y - 20 },
    // Built trails have no checkpoint; this flag sits far off the left edge where the pup never goes.
    checkpoint: { x: -TILE * 20, y: GROUND_Y, active: false },
    spikes: ground.flatMap((cell, column) => cell === GROUND.SPIKE ? [{ x: column * TILE + 2, y: GROUND_Y - 8, w: TILE - 4, h: 8 }] : []),
    enemies: [],
    exit: { x: exitX, y: GROUND_Y - 32, w: 32, h: 32 },
    secret: false,
    boss: null,
    built: { code, shared },
  };
}

// The example trail shown in the README and offered in the builder.
export function exampleTrail() {
  const trail = emptyTrail({ columns: 40, theme: "beach" });
  const ground = trail.cells[GROUND_ROW];
  for (const column of [11, 12, 24, 25, 26]) ground[column] = GROUND.GAP;
  for (const column of [18, 32]) ground[column] = GROUND.SPIKE;
  for (const [row, from, to] of [[5, 10, 13], [6, 23, 27]]) {
    for (let column = from; column <= to; column += 1) trail.cells[row][column] = CELL.PLATFORM;
  }
  for (const [row, column] of [[7, 7], [7, 8], [4, 11], [4, 12], [6, 18], [5, 24], [5, 25], [5, 26], [7, 29], [6, 32], [7, 34]]) trail.cells[row][column] = CELL.TREAT;
  trail.goal = 35;
  return trail;
}

export const EXAMPLE_CODE = encodeTrail(exampleTrail());
