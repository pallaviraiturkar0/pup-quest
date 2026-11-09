// Daily Walk: one remixed trail per UTC day, the same for every player. Everything here is
// DOM-free and deterministic so node tests can check the seed and the layout it produces.
// The best time for today is saved as JSON under `pup-quest:daily-best`, e.g.
// {"date":"2026-11-09","ms":41230}. A new day simply starts a fresh record.

import { GROUND_Y, LEVELS, TILE } from "./levels.js";
import { makePowerup } from "./powerups.js";
import { THEMES } from "./themes.js";
import { MAX_TIME_MS } from "./medals.js";

export const DAILY_BEST_KEY = "daily-best";

// Boss trails need a scripted fight, so the walk only remixes the boss-free campaign trails.
export const DAILY_TRAILS = Object.freeze(LEVELS.map((level, index) => (level.boss ? -1 : index)).filter((index) => index >= 0));

// Each modifier lists the trails it may remix. The playthrough test drives every pair with real
// inputs, so only pairs proven winnable are listed. Modifiers never move critters or change how
// they behave, and ice changes when the pup meets them, which the later trails' tight squirrel
// patrols don't forgive, so Slippery Day sticks to trails 01–03.
export const MODIFIERS = Object.freeze({
  slippery: Object.freeze({ title: "Slippery Day", blurb: "Frost glazed the ground and ledges. Ease off early on the ice.", trails: Object.freeze([0, 1, 2]) }),
  snacks: Object.freeze({ title: "Snack Attack", blurb: "Extra treats are hidden all over the trail.", trails: DAILY_TRAILS }),
  moonlight: Object.freeze({ title: "Moonlight Stroll", blurb: "A starry night walk with the treats tucked in new hiding spots.", trails: DAILY_TRAILS }),
  bones: Object.freeze({ title: "Bone Bonanza", blurb: "Big bone treats along the way can top you up to five hearts.", trails: DAILY_TRAILS }),
});
export const MODIFIER_IDS = Object.freeze(Object.keys(MODIFIERS));

// Pickups and ice stay this many tiles clear of spikes and ground edges.
const SPIKE_CLEARANCE = 2;
const EDGE_CLEARANCE = 3;

// "YYYY-MM-DD" for the UTC day, so everyone shares the same walk whatever their time zone.
export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// FNV-1a: a stable 32-bit seed from the date key.
export function seedFromDate(dateKey) {
  let hash = 0x811c9dc5;
  for (const char of `pup-quest:daily:${dateKey}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// mulberry32: a tiny seeded PRNG returning floats in [0, 1).
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

function shuffle(random, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

const nearSpike = (level, x, clearance) => level.spikes.some((spike) => x > spike.x - clearance * TILE && x < spike.x + spike.w + clearance * TILE);

// Every spot a pickup can sit: one per column over solid ground (away from edges, spikes and
// the doghouse) or on a platform. Ground pickups float at 188 and platform ones 12px above the ledge,
// matching the hand-placed treats, so the pup collects them just by walking past.
export function perches(level) {
  const spots = [];
  const taken = [level.key, ...level.powerups];
  const blocked = (x, y) => nearSpike(level, x, SPIKE_CLEARANCE) || x >= level.exit.x - TILE * 2 || x < level.start.x + TILE * 2
    || taken.some((item) => Math.abs(item.x - x) < TILE && Math.abs(item.y - y) < TILE * 2);
  const add = (x, y) => { if (!blocked(x, y)) spots.push({ x, y }); };
  // Low ledges would hide a ground treat inside their tiles.
  const underLedge = (x) => level.platforms.some((platform) => x >= platform.x && x < platform.x + platform.w && platform.y + platform.h > GROUND_Y - 32);
  for (const block of level.ground) {
    for (let x = block.x + TILE; x + TILE <= block.x + block.w - TILE; x += TILE) {
      if (!underLedge(x + TILE / 2)) add(x + TILE / 2, GROUND_Y - 20);
    }
  }
  for (const platform of level.platforms) {
    for (let x = platform.x; x < platform.x + platform.w; x += TILE) add(x + TILE / 2, platform.y - 12);
  }
  return spots;
}

// Ground ice keeps EDGE_CLEARANCE grippy tiles before every gap and around every spike, so a
// slide can never carry the pup off a ledge or into danger. Platforms reuse the trail's own
// glaze rule: one grippy tile at each end.
function glaze(level) {
  const ice = [];
  for (const block of level.ground) {
    let from = block.x + EDGE_CLEARANCE * TILE;
    const end = block.x + block.w - EDGE_CLEARANCE * TILE;
    // Spikes are inset 2px in their tiles; each keeps SPIKE_CLEARANCE dry tiles on both sides.
    const stops = level.spikes
      .map((spike) => [spike.x - 2 - SPIKE_CLEARANCE * TILE, spike.x + spike.w + 2 + SPIKE_CLEARANCE * TILE])
      .filter(([left, right]) => left < end && right > from)
      .sort((a, b) => a[0] - b[0]);
    for (const [left, right] of [...stops, [end, end]]) {
      if (left - from >= TILE * 2) ice.push({ x: from, w: Math.min(left, end) - from });
      from = Math.max(from, right);
    }
  }
  level.ice = ice.filter((span) => span.w >= TILE * 2);
  for (const platform of level.platforms) {
    if (platform.w >= TILE * 3) platform.ice = { x: platform.x + TILE, w: platform.w - TILE * 2 };
  }
}

// Remixes a trail with a modifier: fresh scenery, treats moved to seeded perches, and the
// modifier's twist. The trail's ground, ledges, spikes, critters, key and doghouse never move.
export function remixTrail(base, modifier, random) {
  if (!MODIFIERS[modifier]) throw new Error(`Unknown Daily Walk modifier: ${modifier}`);
  const level = structuredClone(base);
  const themes = Object.keys(THEMES);
  level.theme = { slippery: "arctic", moonlight: "night" }[modifier] ?? pick(random, themes);
  const spots = shuffle(random, perches(level));
  const extra = { snacks: Math.ceil(level.treats.length / 2), bones: 3 }[modifier] ?? 0;
  const treatCount = level.treats.length + (modifier === "snacks" ? extra : 0);
  level.treats = spots.slice(0, treatCount).map(({ x, y }) => ({ x, y, collected: false }));
  if (modifier === "bones") level.powerups.push(...spots.slice(treatCount, treatCount + extra).map(({ x, y }) => makePowerup("bone", x, y)));
  if (modifier === "slippery") glaze(level);
  return level;
}

// Builds the day's challenge from the UTC date. `trails` is the trail list to remix.
export function dailyChallenge(dateKey = utcDateKey(), trails = LEVELS) {
  const seed = seedFromDate(dateKey);
  const random = createRandom(seed);
  const modifier = pick(random, MODIFIER_IDS);
  const trail = pick(random, MODIFIERS[modifier].trails);
  const level = remixTrail(trails[trail], modifier, random);
  const { title: modifierTitle, blurb } = MODIFIERS[modifier];
  const title = `${modifierTitle} on ${level.name}`;
  level.daily = { date: dateKey, trail, modifier, title };
  return { date: dateKey, seed, trail, modifier, title, modifierTitle, blurb, level };
}

function validMs(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIME_MS;
}

function readRecord(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === "object" && typeof data.date === "string" ? data : null;
  } catch {
    return null;
  }
}

// Today's saved best, or null when it is missing, unreadable, or from another day.
export function parseDailyBest(raw, dateKey) {
  const data = readRecord(raw);
  return data?.date === dateKey && validMs(data.ms) ? data.ms : null;
}

// Folds a cleared run into the stored record (which another tab may have updated).
// Returns the best for the day, whether this run set it, and the JSON to save (null: leave it).
// A walk started before midnight UTC never overwrites a record another tab saved for a later day.
export function commitDailyBest(ms, raw, dateKey) {
  const previous = parseDailyBest(raw, dateKey);
  const newBest = validMs(ms) && (previous === null || ms < previous);
  const best = newBest ? ms : previous;
  const stale = (readRecord(raw)?.date ?? "") > dateKey;
  return { best, previous, newBest, raw: newBest && !stale ? JSON.stringify({ date: dateKey, ms: best }) : null };
}
