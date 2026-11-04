// Trail Map: level-select logic kept free of the DOM so it can be tested in node.
// Progress is stored as the number of unlocked trails (trail 01 is always open).

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

export function createTrailMap(unlocked, total, preferred = unlocked - 1) {
  const selected = Math.min(Math.max(preferred, 0), Math.max(unlocked - 1, 0));
  return { unlocked, total, selected };
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
  return isUnlocked(index, map.unlocked) ? index : null;
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
  const channel = (shift) => ((value >> shift) & 255) / 255;
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

// Each stop is painted with its trail's sky, with an ink that stays readable on light and dark skies.
export function stopColors(themeName) {
  const { palette } = getTheme(themeName);
  const dark = luminance(palette.sky) < 0.4;
  return { fill: palette.sky, ring: palette.grassDark, ink: dark ? palette.flower : palette.tree, dark };
}
