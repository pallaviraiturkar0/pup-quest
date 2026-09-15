export const TILE = 16;
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 256;
export const GROUND_Y = 208;

function trail({ name, theme, columns, gaps, platforms, treats, key, checkpoint, spikes, enemies }) {
  const ground = [];
  let from = 0;
  for (const [column, width] of [...gaps, [columns, 0]]) {
    ground.push({ x: from * TILE, y: GROUND_Y, w: (column - from) * TILE, h: 80 });
    from = column + width;
  }
  return {
    name,
    theme,
    width: columns * TILE,
    start: { x: 48, y: GROUND_Y - 18 },
    ground,
    gaps: gaps.map(([x, w]) => ({ x: x * TILE, w: w * TILE })),
    platforms: platforms.map(([x, y, w]) => ({ x: x * TILE, y: y * TILE, w: w * TILE, h: TILE })),
    treats: treats.map(([x, y]) => ({ x: x * TILE + 8, y, collected: false })),
    key: { x: key[0] * TILE + 8, y: key[1] },
    checkpoint: { x: checkpoint * TILE, y: GROUND_Y, active: false },
    spikes: spikes.map(([x, w]) => ({ x: x * TILE + 2, y: GROUND_Y - 8, w: w * TILE - 4, h: 8 })),
    enemies: enemies.map(([x, left, right, speed]) => ({
      x: x * TILE, y: GROUND_Y - 12, w: 18, h: 12,
      left: left * TILE, right: right * TILE, speed, direction: 1, alive: true,
    })),
    exit: { x: (columns - 6) * TILE, y: GROUND_Y - 32, w: 32, h: 32 },
  };
}

export const LEVELS = [
  trail({
    name: "Sunny Meadow", theme: "meadow", columns: 126,
    gaps: [[28, 3], [61, 3], [93, 4]],
    platforms: [[10, 11, 4], [17, 9, 3], [25, 11, 4], [36, 11, 4], [43, 11, 4], [49, 9, 4], [59, 11, 6], [71, 11, 4], [78, 9, 4], [89, 11, 4], [98, 11, 4], [108, 10, 4]],
    treats: [[7, 188], [8, 188], [11, 164], [12, 164], [18, 132], [27, 164], [29, 148], [36, 164], [37, 164], [44, 164], [45, 164], [49, 132], [50, 132], [63, 164], [72, 164], [79, 132], [80, 132], [90, 164], [95, 156], [99, 164], [100, 164], [110, 148], [111, 148], [116, 188]],
    key: [51, 126], checkpoint: 65,
    spikes: [[41, 1], [85, 2], [115, 1]],
    enemies: [[55, 54, 58, 17], [103, 102, 106, 20]],
  }),
  trail({
    name: "Mossy Hollow", theme: "forest", columns: 138,
    gaps: [[24, 4], [55, 4], [83, 4], [113, 3]],
    platforms: [[9, 11, 4], [16, 9, 4], [22, 11, 7], [33, 11, 4], [41, 9, 4], [50, 11, 5], [60, 11, 5], [68, 9, 4], [74, 7, 4], [82, 11, 6], [93, 11, 4], [101, 9, 4], [111, 11, 6], [121, 11, 3], [128, 10, 4]],
    treats: [[6, 188], [7, 188], [10, 164], [17, 132], [18, 132], [25, 164], [26, 164], [34, 164], [35, 164], [42, 132], [43, 132], [52, 164], [57, 147], [61, 164], [63, 164], [69, 132], [70, 132], [75, 100], [77, 100], [84, 164], [86, 164], [94, 164], [102, 132], [103, 132], [114, 164], [122, 164], [129, 148], [130, 148]],
    key: [76, 94], checkpoint: 63,
    spikes: [[30, 1], [46, 2], [89, 1], [108, 2]],
    enemies: [[37, 37, 40, 22], [97, 97, 100, 25], [124, 124, 127, 20]],
  }),
  trail({
    name: "Starlit Summit", theme: "night", columns: 148,
    gaps: [[22, 4], [47, 4], [77, 4], [103, 4], [125, 4]],
    platforms: [[9, 11, 3], [16, 9, 4], [21, 11, 6], [31, 11, 3], [38, 9, 4], [46, 11, 6], [57, 11, 4], [64, 9, 3], [71, 7, 4], [76, 11, 6], [87, 11, 3], [94, 9, 4], [103, 11, 6], [111, 9, 4], [117, 7, 4], [124, 11, 6], [135, 11, 4]],
    treats: [[6, 188], [10, 164], [17, 132], [18, 132], [23, 164], [25, 164], [32, 164], [39, 132], [40, 132], [48, 164], [50, 164], [58, 164], [59, 164], [65, 132], [72, 100], [73, 100], [78, 164], [80, 164], [88, 164], [95, 132], [96, 132], [105, 164], [108, 164], [112, 132], [114, 132], [118, 100], [120, 100], [126, 164], [128, 164], [136, 164], [137, 164], [140, 188]],
    key: [119, 94], checkpoint: 84,
    spikes: [[34, 2], [62, 1], [90, 2], [132, 2]],
    enemies: [[28, 27, 30, 25], [68, 67, 70, 26], [99, 99, 102, 28]],
  }),
];
