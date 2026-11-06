// Dog Kennel: collectible pup skins unlocked by paw medals. Kept free of the DOM so it runs under node tests.
// The chosen skin id is saved as plain text under `pup-quest:skin`. Missing, unknown, or still-locked ids
// fall back to Biscuit the corgi, who is always unlocked.

import { MEDALS, medalFor } from "./medals.js";

export const SKIN_KEY = "skin";
export const DEFAULT_SKIN = "corgi";
// Every skin is drawn inside this box (in sprite pixels) before being placed over the player hitbox.
export const SPRITE_WIDTH = 25;
export const SPRITE_HEIGHT = 21;
export const EAR_STYLES = Object.freeze(["pointy", "floppy", "folded"]);
export const TAIL_STYLES = Object.freeze(["stub", "plume", "curl", "whip"]);
export const PALETTE_KEYS = Object.freeze(["outline", "fur", "light", "cream", "inner", "eye", "nose", "mark"]);

// An unlock is `null` (always open) or `{ medal, count }` / `{ medal, trail }`: earn at least `medal`
// (gold also counts as silver and bronze) on `count` different trails, or on one specific trail (1-based).
// `count: "all"` means every trail.
export const SKINS = Object.freeze([
  {
    id: "corgi", name: "Biscuit", breed: "Corgi", ears: "pointy", tail: "stub", unlock: null,
    palette: { outline: "#8e633e", fur: "#dda45f", light: "#edbd77", cream: "#f7e5bd", inner: "#c58b72", eye: "#334335", nose: "#334335", mark: "#dda45f" },
    markings: [],
  },
  {
    id: "dalmatian", name: "Domino", breed: "Dalmatian", ears: "floppy", tail: "whip", unlock: { medal: "bronze", count: 1 },
    palette: { outline: "#5d5a55", fur: "#f4f1ea", light: "#ffffff", cream: "#fbf8f1", inner: "#2b2a28", eye: "#26231f", nose: "#26231f", mark: "#2b2a28" },
    markings: [[5, 10, 2, 2], [9, 13, 2, 1], [12, 10, 1, 2], [14, 7, 2, 2], [17, 5, 2, 1], [6, 14, 1, 1], [21, 7, 1, 1]],
  },
  {
    id: "pug", name: "Pickles", breed: "Pug", ears: "folded", tail: "curl", unlock: { medal: "silver", count: 3 },
    palette: { outline: "#6d5639", fur: "#e3cb9a", light: "#efdcb2", cream: "#f1e3c4", inner: "#3a2f26", eye: "#1f1a14", nose: "#1f1a14", mark: "#3a2f26" },
    markings: [[19, 10, 5, 5], [18, 12, 1, 2], [16, 6, 2, 1]],
  },
  {
    id: "beagle", name: "Bagel", breed: "Beagle", ears: "floppy", tail: "whip", unlock: { medal: "gold", count: 1 },
    palette: { outline: "#6b4426", fur: "#c98a4b", light: "#dca46a", cream: "#fbf3e2", inner: "#7a4a26", eye: "#2e2219", nose: "#2e2219", mark: "#3b2c22" },
    markings: [[5, 9, 8, 3], [7, 12, 4, 1], [17, 5, 1, 6]],
  },
  {
    id: "husky", name: "Juniper", breed: "Husky", ears: "pointy", tail: "plume", unlock: { medal: "gold", trail: 7 },
    palette: { outline: "#3e4650", fur: "#7d8794", light: "#9aa4b0", cream: "#f3f5f7", inner: "#e9b3b0", eye: "#3f8fd2", nose: "#232830", mark: "#f3f5f7" },
    markings: [[16, 8, 6, 4], [18, 7, 2, 1], [15, 12, 3, 2]],
  },
  {
    id: "golden", name: "Sunny", breed: "Golden Retriever", ears: "floppy", tail: "plume", unlock: { medal: "gold", count: "all" },
    palette: { outline: "#8a5a1c", fur: "#e6a93e", light: "#f4c766", cream: "#f8dd94", inner: "#b97a2a", eye: "#3a2a17", nose: "#3a2a17", mark: "#f4c766" },
    markings: [[4, 15, 2, 2], [14, 15, 2, 2], [6, 8, 7, 1]],
  },
]);

export function getSkin(id) {
  return SKINS.find((skin) => skin.id === id) ?? SKINS.find((skin) => skin.id === DEFAULT_SKIN);
}

// How many trails reached each medal tier or better, plus the best medal per trail.
export function medalSummary(bestTimes, levels) {
  const perTrail = levels.map((level, index) => {
    const ms = bestTimes?.[index];
    return ms === null || ms === undefined ? null : medalFor(ms, level.par);
  });
  const atLeast = (medal) => perTrail.filter((won) => won && MEDALS.indexOf(won) <= MEDALS.indexOf(medal)).length;
  return { perTrail, counts: Object.fromEntries(MEDALS.map((medal) => [medal, atLeast(medal)])) };
}

// Progress toward a skin: how many qualifying trails the player has, out of how many are needed.
export function skinProgress(skin, bestTimes, levels) {
  const rule = skin?.unlock;
  if (!rule) return { have: 0, need: 0, unlocked: true };
  const { perTrail, counts } = medalSummary(bestTimes, levels);
  if (rule.trail !== undefined) {
    const won = perTrail[rule.trail - 1];
    const have = won && MEDALS.indexOf(won) <= MEDALS.indexOf(rule.medal) ? 1 : 0;
    return { have, need: 1, unlocked: have === 1 };
  }
  const need = rule.count === "all" ? levels.length : rule.count;
  const have = Math.min(counts[rule.medal], need);
  return { have, need, unlocked: have >= need };
}

export function isSkinUnlocked(skin, bestTimes, levels) {
  return skinProgress(skin, bestTimes, levels).unlocked;
}

export function unlockedSkinIds(bestTimes, levels) {
  return SKINS.filter((skin) => isSkinUnlocked(skin, bestTimes, levels)).map((skin) => skin.id);
}

const MEDAL_WORD = { gold: "gold", silver: "silver", bronze: "bronze" };
const pad = (trail) => String(trail).padStart(2, "0");

// Plain-language requirement, e.g. "Earn silver paws or better on 3 trails".
export function requirementText(skin, levels) {
  const rule = skin?.unlock;
  if (!rule) return "Always in the kennel";
  const better = rule.medal === "gold" ? "" : " or better";
  if (rule.trail !== undefined) return `Earn a ${MEDAL_WORD[rule.medal]} paw on Trail ${pad(rule.trail)} ${levels[rule.trail - 1]?.name ?? ""}`.trim();
  if (rule.count === "all") return `Earn ${MEDAL_WORD[rule.medal]} paws on all ${levels.length} trails`;
  if (rule.count === 1) return `Earn a ${MEDAL_WORD[rule.medal]} paw${better} on any trail`;
  return `Earn ${MEDAL_WORD[rule.medal]} paws${better} on ${rule.count} trails`;
}

// The saved id if it names a skin the player has unlocked; otherwise the default. When nothing could be
// read (`raw` is null or undefined, e.g. storage is blocked), the current in-memory choice is kept if still valid.
export function resolveSkin(raw, unlockedIds, current = DEFAULT_SKIN) {
  const value = raw ?? current;
  const id = typeof value === "string" ? value.trim() : "";
  return unlockedIds.includes(id) && SKINS.some((skin) => skin.id === id) ? id : DEFAULT_SKIN;
}

// Returns the id to save, or null when the choice is unknown or still locked.
export function chooseSkin(id, unlockedIds) {
  return SKINS.some((skin) => skin.id === id) && unlockedIds.includes(id) ? id : null;
}

// Arrow keys walk every skin (locked ones too, so their requirement can be read) and stop at the ends.
const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
export function moveSkinFocus(index, key, total = SKINS.length) {
  if (key === "Home") return 0;
  if (key === "End") return total - 1;
  if (STEP[key]) return Math.min(Math.max(index + STEP[key], 0), total - 1);
  return null;
}

// Draws a skin facing right in a SPRITE_WIDTH × SPRITE_HEIGHT box using `rect(x, y, w, h, color)`.
// Shared by the gameplay sprite and the Kennel previews, so both always match.
export function drawPup(rect, skin, { tailY = 9, step = 0, airborne = false } = {}) {
  const c = skin.palette;
  const tail = {
    stub: () => { rect(0, tailY, 5, 3, c.outline); rect(0, tailY - 2, 3, 3, c.cream); },
    plume: () => { rect(0, tailY - 4, 5, 6, c.outline); rect(1, tailY - 5, 3, 5, c.fur); rect(1, tailY - 5, 2, 2, c.cream); },
    curl: () => { rect(1, tailY - 3, 4, 2, c.outline); rect(1, tailY - 3, 2, 4, c.outline); rect(2, tailY - 2, 2, 1, c.fur); },
    whip: () => { rect(1, tailY - 4, 2, 7, c.outline); rect(2, tailY - 4, 1, 4, c.fur); rect(1, tailY - 5, 2, 2, c.cream); },
  };
  (tail[skin.tail] ?? tail.stub)();
  rect(3, 9, 12, 9, c.outline);
  rect(4, 9, 12, 7, c.fur);
  rect(6, 9, 8, 2, c.light);
  rect(11, 6, 12, 11, c.outline);
  rect(12, 5, 10, 11, c.fur);
  if (skin.ears === "floppy") {
    rect(11, 4, 5, 3, c.outline);
    rect(12, 5, 3, 9, c.outline);
    rect(13, 5, 1, 7, c.inner);
  } else if (skin.ears === "folded") {
    rect(12, 3, 4, 3, c.outline);
    rect(13, 4, 2, 2, c.inner);
    rect(19, 3, 4, 3, c.outline);
    rect(20, 4, 2, 2, c.inner);
  } else {
    rect(12, 1, 4, 7, c.outline);
    rect(13, 2, 2, 5, c.fur);
    rect(14, 4, 1, 3, c.inner);
    rect(19, 0, 4, 7, c.outline);
    rect(20, 1, 2, 5, c.fur);
    rect(20, 3, 1, 3, c.inner);
  }
  rect(15, 6, 3, 8, c.light);
  rect(18, 6, 2, 8, c.cream);
  rect(18, 12, 6, 4, c.cream);
  rect(13, 14, 7, 4, c.cream);
  for (const [x, y, w, h] of skin.markings) rect(x, y, w, h, c.mark);
  rect(19, 8, 2, 3, c.eye);
  rect(19, 8, 1, 1, "#fff4d8");
  rect(22, 11, 3, 2, c.nose);
  rect(21, 15, 2, 2, "#c88878");
  rect(5 + step * 2, 16, 3, 4 - step, c.outline);
  rect(5 + step * 2, 17, 3, 2, c.cream);
  rect(15 - step * 2, 17, 3, 3 - step, c.outline);
  rect(15 - step * 2, 18, 3, 2 - step, c.cream);
  if (airborne) {
    rect(8, 16, 3, 2, c.fur);
    rect(18, 16, 3, 2, c.cream);
  }
}
