// Data-driven backdrops. Each level picks one by its `theme` name. Layers are
// painted in order (back to front); `parallax` is the fraction of camera
// movement a layer follows (0 = fixed to the sky, 1 = moves with the world).
// Colors may be a palette key or a literal hex color.

export const DEFAULT_THEME = "meadow";

export const PALETTE_KEYS = [
  "sky", "horizon", "cloud", "cloudShade", "far", "hill", "treeBack", "tree",
  "treeLight", "trunk", "grass", "grassLight", "grassDark", "dirt", "dirtLight",
  "dirtDark", "stone", "water", "waterLight", "flower",
];

export const LAYER_KINDS = ["stars", "sun", "moon", "clouds", "birds", "sea", "hills", "dunes", "skyline", "trees", "palms", "hedges", "lamps"];
export const SCATTER_KINDS = ["rock", "mushroom", "shell"];
export const LANDMARK_KINDS = ["tree", "stump", "pillar", "palm", "bench", "hydrant"];

const DAY_SUN = { kind: "sun", parallax: 0.025, color: "#f5e8aa", halo: "#dce5c2" };
const NIGHT_MOON = { kind: "moon", parallax: 0.025, color: "#ede9c8", halo: "#626687", shadow: "#68718d", crater: "#d2d4b6" };
const STARS = { kind: "stars", parallax: 0.05, count: 42, color: "#f7eac7" };
const CLOUDS = { kind: "clouds", parallax: 0.11, count: 7 };
const FAR_HILLS = { kind: "hills", parallax: 0.1, color: "far", spacing: 161, top: 109 };
const NEAR_HILLS = { kind: "hills", parallax: 0.18, color: "hill", spacing: 124, top: 131, seed: 30 };

export const THEMES = {
  meadow: {
    label: "Sunny meadow",
    palette: {
      sky: "#cde3d3", horizon: "#e8edcb", cloud: "#f5f3db", cloudShade: "#e1e9ce",
      far: "#b2cdac", hill: "#99bd98", treeBack: "#8db18b", tree: "#719862",
      treeLight: "#87ad71", trunk: "#938260", grass: "#a6bc75", grassLight: "#c8d493",
      grassDark: "#6f9458", dirt: "#ad8a62", dirtLight: "#bc9b71", dirtDark: "#977754",
      stone: "#8e9c79", water: "#82b7ac", waterLight: "#b3d7c4", flower: "#efce7c",
    },
    layers: [DAY_SUN, CLOUDS, FAR_HILLS, NEAR_HILLS, { kind: "trees", parallax: 0.32, style: "round" }],
    decor: { scatter: "rock", landmark: "tree" },
  },
  forest: {
    label: "Mossy forest",
    palette: {
      sky: "#bad3c7", horizon: "#d8e4c2", cloud: "#e9edcf", cloudShade: "#cbdcc5",
      far: "#a1beb0", hill: "#81a99a", treeBack: "#6f9680", tree: "#4e7960",
      treeLight: "#648d64", trunk: "#80765c", grass: "#8da869", grassLight: "#b3c782",
      grassDark: "#587d4f", dirt: "#968362", dirtLight: "#aa9771", dirtDark: "#7d7056",
      stone: "#738d79", water: "#6b9f9b", waterLight: "#99c6b2", flower: "#e2ad83",
    },
    layers: [DAY_SUN, CLOUDS, FAR_HILLS, NEAR_HILLS, { kind: "trees", parallax: 0.32, style: "pine" }],
    decor: { scatter: "mushroom", landmark: "stump" },
  },
  night: {
    label: "Starlit mountains",
    palette: {
      sky: "#343f63", horizon: "#75748c", cloud: "#81849f", cloudShade: "#626e91",
      far: "#677b91", hill: "#586f82", treeBack: "#4f687a", tree: "#405b6a",
      treeLight: "#577878", trunk: "#666679", grass: "#8eaa98", grassLight: "#b7c8a8",
      grassDark: "#667f80", dirt: "#7b7b83", dirtLight: "#92908c", dirtDark: "#676977",
      stone: "#a0a69b", water: "#556d98", waterLight: "#849bb6", flower: "#e9d593",
    },
    layers: [STARS, NIGHT_MOON, CLOUDS, FAR_HILLS, NEAR_HILLS, { kind: "trees", parallax: 0.32, style: "pine" }],
    decor: { scatter: "rock", landmark: "pillar" },
  },
  park: {
    label: "City park",
    palette: {
      sky: "#c4def0", horizon: "#eef0d4", cloud: "#fbf8e6", cloudShade: "#dfe9e6",
      far: "#a9c4c7", hill: "#9cc39a", treeBack: "#86b384", tree: "#5f9a5c",
      treeLight: "#7fb46d", trunk: "#8d7357", grass: "#a3c86f", grassLight: "#cde296",
      grassDark: "#6a9a52", dirt: "#b08d66", dirtLight: "#c3a278", dirtDark: "#957452",
      stone: "#a3a597", water: "#7fb9c9", waterLight: "#b9dfe3", flower: "#f0a7a0",
    },
    layers: [
      DAY_SUN, CLOUDS,
      { kind: "skyline", parallax: 0.06, color: "far", window: "#c7dbe0", spacing: 38, minHeight: 34, maxHeight: 78, base: 196, lit: 0 },
      NEAR_HILLS,
      { kind: "trees", parallax: 0.28, style: "round" },
      { kind: "hedges", parallax: 0.36, color: "tree", highlight: "treeLight" },
      { kind: "lamps", parallax: 0.42, post: "#5d6a61", light: "#f6edc4", spacing: 150, glow: false },
    ],
    decor: { scatter: "rock", landmark: "bench" },
  },
  beach: {
    label: "Sunset beach",
    palette: {
      sky: "#f2c7a5", horizon: "#f8e3b0", cloud: "#fbe7cf", cloudShade: "#efc9b4",
      far: "#c7a6a8", hill: "#e3c991", treeBack: "#7fa877", tree: "#5f9160",
      treeLight: "#7cac6c", trunk: "#a3805b", grass: "#b7c27a", grassLight: "#d8dc9c",
      grassDark: "#8a9a5c", dirt: "#e0c48e", dirtLight: "#ecd6a4", dirtDark: "#c7a876",
      stone: "#b9a593", water: "#6fb3c2", waterLight: "#b3e0de", flower: "#f29b85",
    },
    layers: [
      { kind: "sun", parallax: 0.02, color: "#fbe1a0", halo: "#f6cfa4" },
      CLOUDS,
      { kind: "birds", parallax: 0.14, count: 5, color: "#8a7a80" },
      { kind: "sea", parallax: 0.04, top: 150, color: "water", foam: "waterLight" },
      { kind: "dunes", parallax: 0.2, color: "hill", spacing: 170, top: 194, height: 12 },
      { kind: "palms", parallax: 0.34, spacing: 132 },
    ],
    decor: { scatter: "shell", landmark: "palm" },
  },
  city: {
    label: "Night city",
    palette: {
      sky: "#262c4d", horizon: "#5b5577", cloud: "#6c6b8c", cloudShade: "#4f5478",
      far: "#3d4566", hill: "#33395a", treeBack: "#3e5466", tree: "#36505a",
      treeLight: "#4b6a6a", trunk: "#5e5a6b", grass: "#7f9d8e", grassLight: "#a9c0a2",
      grassDark: "#566f72", dirt: "#6d6b78", dirtLight: "#878592", dirtDark: "#5a596a",
      stone: "#9a9ca6", water: "#4b5f8c", waterLight: "#7f95bd", flower: "#f0d68c",
    },
    layers: [
      { ...STARS, count: 28 },
      NIGHT_MOON,
      { ...CLOUDS, count: 5 },
      { kind: "skyline", parallax: 0.08, color: "far", window: "#8b8aa4", spacing: 34, minHeight: 50, maxHeight: 120, base: 200, lit: 0.18 },
      { kind: "skyline", parallax: 0.2, color: "hill", window: "#f3d98b", spacing: 46, minHeight: 30, maxHeight: 92, base: 200, lit: 0.38 },
      { kind: "lamps", parallax: 0.4, post: "#2b3048", light: "#ffe7a3", spacing: 120, glow: true },
    ],
    decor: { scatter: "rock", landmark: "hydrant" },
  },
};

export function getTheme(name) {
  return Object.hasOwn(THEMES, name) ? THEMES[name] : THEMES[DEFAULT_THEME];
}

// Picks the backdrop for a level; a valid preview override (e.g. ?theme=beach) wins.
export function themeForLevel(level, override = null) {
  if (override && Object.hasOwn(THEMES, override)) return THEMES[override];
  return getTheme(level?.theme);
}

export function themeOverrideFromSearch(search) {
  const name = new URLSearchParams(search ?? "").get("theme");
  return name && Object.hasOwn(THEMES, name) ? name : null;
}

export function resolveColor(theme, value) {
  return Object.hasOwn(theme.palette, value) ? theme.palette[value] : value;
}
