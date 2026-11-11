// Trail Map: level-select logic kept free of the DOM so it can be tested in node.
// Progress is stored as the number of unlocked trails (trail 01 is always open).

import { medalFor } from "./medals.js";
import { getTheme } from "./themes.js";

export const UNLOCK_KEY = "unlocked";

export function parseUnlocked(raw, total) {
  const count = Number(raw);
  if (raw === null || raw === undefined || raw === "" || !Number.isSafeInteger(count)) return 1;
  return Math.min(Math.max(count, 1), total);
}

// Another tab may have saved more progress since this one loaded; the larger count wins.
export function mergeUnlocked(current, raw, total) {
  return Math.min(Math.max(current, parseUnlocked(raw, total)), total);
}

// Clearing trail `index` opens the one after it. Never re-locks anything.
export function unlockAfterClear(unlocked, index, total) {
  return Math.min(Math.max(unlocked, index + 2), total);
}

export function isUnlocked(index, unlocked) {
  return Number.isInteger(index) && index >= 0 && index < unlocked;
}

// Beating the boss finale records its time, so a saved finale time means the campaign is won.
export function finaleCleared(bestTimes, levels) {
  const finale = bestTimes?.[levels.length - 1];
  return Number.isSafeInteger(finale) && finale > 0;
}

// The bonus Trail 08 opens once the finale is cleared. Like the secret trail it is derived from saved
// best times, so players who beat Moonlit Keep before it existed find it already open.
export function bonusTrailOpen(bestTimes, levels) {
  return finaleCleared(bestTimes, levels);
}

// The secret trail opens once the finale is cleared or any campaign trail earns a gold paw.
// It is derived from saved best times, so it never needs its own key.
export function secretTrailOpen(bestTimes, levels) {
  if (finaleCleared(bestTimes, levels)) return true;
  return levels.some((level, index) => medalFor(bestTimes?.[index], level.par) === "gold");
}

// `total` counts the campaign trails. With `bonus`, the bonus trail's stop (index `total`) joins the
// map, open only once `bonusOpen`; with `secret`, the secret trail's stop follows as the last stop.
export function createTrailMap(unlocked, total, preferred = unlocked - 1, { secret = false, bonus = false, bonusOpen = false } = {}) {
  const bonusIndex = bonus ? total : null;
  const secretIndex = secret ? total + (bonus ? 1 : 0) : null;
  const map = { unlocked, total: total + (bonus ? 1 : 0) + (secret ? 1 : 0), trails: total, secret, secretIndex, bonus, bonusOpen: bonus && bonusOpen, bonusIndex, selected: 0 };
  const extraOpen = preferred === secretIndex || (preferred === bonusIndex && map.bonusOpen);
  map.selected = extraOpen ? preferred : Math.min(Math.max(preferred, 0), Math.max(unlocked - 1, 0));
  return map;
}

export function isStopOpen(map, index) {
  if (map.secret && index === map.secretIndex) return true;
  if (map.bonus && index === map.bonusIndex) return map.bonusOpen;
  return isUnlocked(index, map.unlocked);
}

// Arrows walk every stop (locked ones too, so their padlock can be read out) and stop at the ends.
const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
export function moveSelection(map, key) {
  if (key === "Home") map.selected = 0;
  else if (key === "End") map.selected = map.total - 1;
  else if (STEP[key]) map.selected = Math.min(Math.max(map.selected + STEP[key], 0), map.total - 1);
  else return false;
  return true;
}

// Returns the trail index to start, or null when the trail is still locked.
export function chooseTrail(map, index = map.selected) {
  return isStopOpen(map, index) ? index : null;
}

// A deterministic winding path: stops zig-zag between rows with a little seeded wobble,
// joined by smooth cubic curves. Coordinates are in a width×height viewBox.
export function trailPath(count, { width = 480, height = 256, margin = 40, seed = 7 } = {}) {
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const span = width - margin * 2;
  const rows = height - margin * 2;
  const stops = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const wave = Math.sin(t * Math.PI * 2.5 + 0.4);
    return {
      x: Math.round(margin + span * t + (random() - 0.5) * span * 0.04),
      y: Math.round(margin + rows * (0.5 - wave * 0.42) + (random() - 0.5) * rows * 0.08),
    };
  });
  for (const stop of stops) {
    stop.x = Math.min(Math.max(stop.x, margin), width - margin);
    stop.y = Math.min(Math.max(stop.y, margin), height - margin);
  }
  let d = stops.length ? `M${stops[0].x} ${stops[0].y}` : "";
  for (let index = 1; index < stops.length; index += 1) {
    const a = stops[index - 1];
    const b = stops[index];
    const bend = (b.x - a.x) * 0.5;
    d += ` C${a.x + bend} ${a.y} ${b.x - bend} ${b.y} ${b.x} ${b.y}`;
  }
  return { stops, d };
}

function luminance(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

// WCAG contrast ratio between two #rrggbb colours.
export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export const MIN_ICON_CONTRAST = 3;
const DARK_INK = "#283d32";
const LIGHT_INK = "#fffdf0";

// Each stop is painted with its trail's sky. The paw uses the first theme colour that stays
// readable on that sky (3:1 for graphics), falling back to the page's dark or light ink.
export function stopColors(themeName) {
  const { palette } = getTheme(themeName);
  const dark = luminance(palette.sky) < 0.18;
  const candidates = dark ? [palette.flower, palette.waterLight, palette.cloud] : [palette.tree, palette.grassDark, palette.trunk, palette.dirtDark];
  const fallback = dark ? LIGHT_INK : DARK_INK;
  const ink = candidates.find((color) => contrastRatio(color, palette.sky) >= MIN_ICON_CONTRAST) ?? fallback;
  return { fill: palette.sky, ring: palette.grassDark, ink, dark };
}
