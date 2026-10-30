import { GROUND_Y, VIEW_HEIGHT, VIEW_WIDTH } from "./levels.js";
import { resolveColor, THEMES, themeForLevel } from "./themes.js";

const noise = (n) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function createRenderer(canvas, { themeOverride = null } = {}) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("This browser does not support the canvas needed to play Pup Quest.");
  ctx.imageSmoothingEnabled = false;
  let particles = [];

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function polygon(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [index, [x, y]] of points.entries()) {
      if (index === 0) ctx.moveTo(Math.round(x), Math.round(y));
      else ctx.lineTo(Math.round(x), Math.round(y));
    }
    ctx.closePath();
    ctx.fill();
  }

  function cloud(x, y, scale, palette) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    ctx.scale(scale, scale);
    rect(0, 8, 46, 8, palette.cloudShade);
    rect(5, 3, 33, 11, palette.cloud);
    rect(11, 0, 16, 4, palette.cloud);
    rect(-5, 11, 10, 3, palette.cloud);
    rect(38, 7, 5, 7, palette.cloud);
    ctx.restore();
  }

  function tree(x, floor, size, palette, far = false) {
    ctx.save();
    ctx.translate(Math.round(x), floor);
    ctx.scale(size, size);
    const dark = far ? palette.treeBack : palette.tree;
    const light = far ? palette.treeBack : palette.treeLight;
    rect(-2, -41, 5, 42, palette.trunk);
    rect(-2, -19, 2, 18, palette.dirtDark);
    rect(3, -27, 8, 3, palette.trunk);
    rect(8, -36, 3, 10, palette.trunk);
    rect(-13, -62, 29, 31, dark);
    rect(-20, -56, 42, 19, dark);
    rect(-8, -69, 15, 40, dark);
    rect(-15, -62, 24, 17, light);
    rect(-7, -68, 13, 8, light);
    rect(-20, -55, 12, 10, light);
    rect(11, -50, 10, 7, light);
    if (!far) {
      rect(-10, -57, 3, 2, palette.grass);
      rect(2, -63, 3, 2, palette.grass);
      rect(15, -46, 3, 2, palette.grassDark);
    }
    ctx.restore();
  }

  function pine(x, floor, size, palette) {
    ctx.save();
    ctx.translate(Math.round(x), floor);
    ctx.scale(size, size);
    rect(-2, -46, 4, 46, palette.trunk);
    for (let row = 0; row < 4; row += 1) {
      const y = -75 + row * 13;
      const width = 6 + row * 5;
      rect(-width, y + 7, width * 2, 13, palette.tree);
      rect(-width + 5, y, width * 2 - 10, 10, palette.treeLight);
    }
    rect(-2, -82, 4, 10, palette.treeLight);
    ctx.restore();
  }

  function palm(x, floor, size, palette) {
    ctx.save();
    ctx.translate(Math.round(x), floor);
    ctx.scale(size, size);
    for (let segment = 0; segment < 8; segment += 1) {
      const lean = Math.round(segment * segment * 0.12);
      rect(-3 + lean, -8 - segment * 8, 6, 9, segment % 2 ? palette.trunk : palette.dirtDark);
    }
    const top = -70;
    const crown = 8;
    rect(crown - 14, top - 4, 28, 5, palette.tree);
    rect(crown - 22, top, 14, 4, palette.tree);
    rect(crown + 8, top, 14, 4, palette.tree);
    rect(crown - 26, top + 4, 6, 5, palette.tree);
    rect(crown + 20, top + 4, 6, 5, palette.tree);
    rect(crown - 8, top - 9, 16, 6, palette.treeLight);
    rect(crown - 15, top - 6, 8, 3, palette.treeLight);
    rect(crown + 7, top - 6, 8, 3, palette.treeLight);
    rect(crown - 4, top + 1, 4, 4, palette.trunk);
    rect(crown + 1, top + 2, 4, 4, palette.dirtDark);
    ctx.restore();
  }

  function lamp(x, floor, layer, theme, time) {
    const post = resolveColor(theme, layer.post);
    const light = resolveColor(theme, layer.light);
    if (layer.glow) {
      ctx.globalAlpha = 0.12 + Math.sin(time * 2 + x * 0.01) * 0.03;
      rect(x - 13, floor - 58, 28, 26, light);
      rect(x - 8, floor - 63, 18, 36, light);
      ctx.globalAlpha = 1;
    }
    rect(x, floor - 46, 2, 46, post);
    rect(x - 2, floor - 3, 6, 3, post);
    rect(x - 4, floor - 50, 10, 3, post);
    rect(x - 3, floor - 47, 8, 5, light);
    rect(x - 1, floor - 53, 4, 3, post);
  }

  const wrap = (value, span) => ((value % span) + span) % span;

  const LAYER_PAINTERS = {
    stars(layer, game, time, theme, reducedMotion) {
      for (let i = 0; i < layer.count; i += 1) {
        const x = (noise(i + 20) * 560 - game.cameraX * layer.parallax + 560) % 560;
        const y = noise(i + 130) * 123 + 8;
        ctx.globalAlpha = reducedMotion ? 0.7 : 0.5 + Math.sin(time * 1.6 + i) * 0.3;
        rect(x, y, 1 + (i % 7 === 0 ? 1 : 0), 1, resolveColor(theme, layer.color));
      }
      ctx.globalAlpha = 1;
    },
    sun(layer, game, time, theme) {
      const x = 376 - game.cameraX * layer.parallax;
      const halo = resolveColor(theme, layer.halo);
      const color = resolveColor(theme, layer.color);
      rect(x - 3, 25, 32, 32, halo);
      rect(x + 3, 21, 20, 40, halo);
      rect(x, 29, 26, 24, color);
      rect(x + 5, 24, 16, 34, color);
      return x;
    },
    moon(layer, game, time, theme) {
      const x = LAYER_PAINTERS.sun(layer, game, time, theme);
      rect(x + 17, 27, 9, 20, resolveColor(theme, layer.shadow));
      rect(x + 12, 24, 12, 7, resolveColor(theme, layer.shadow));
      rect(x + 5, 36, 3, 3, resolveColor(theme, layer.crater));
    },
    clouds(layer, game, time, theme, reducedMotion) {
      for (let i = -1; i < layer.count - 1; i += 1) {
        const drift = reducedMotion ? 0 : time * 1.3;
        const x = ((i * 137 + 700 - game.cameraX * layer.parallax + drift) % 700) - 100;
        cloud(x, 25 + noise(i + 7) * 56, 0.7 + noise(i + 9) * 0.65, theme.palette);
      }
    },
    birds(layer, game, time, theme) {
      const color = resolveColor(theme, layer.color);
      for (let i = 0; i < layer.count; i += 1) {
        const x = wrap(noise(i + 60) * 560 - game.cameraX * layer.parallax + time * (8 + i * 2), 560) - 40;
        const y = 34 + noise(i + 61) * 58 + Math.sin(time * 1.5 + i) * 3;
        const flap = Math.floor(time * 5 + i * 1.7) % 2;
        rect(x, y + flap, 3, 1, color);
        rect(x + 3, y + 1, 1, 1, color);
        rect(x + 4, y + flap, 3, 1, color);
      }
    },
    sea(layer, game, time, theme) {
      const water = resolveColor(theme, layer.color);
      const foam = resolveColor(theme, layer.foam);
      rect(0, layer.top, VIEW_WIDTH, 224 - layer.top, water);
      rect(0, layer.top, VIEW_WIDTH, 1, foam);
      for (let row = 0; row < 5; row += 1) {
        const y = layer.top + 5 + row * 6;
        const shift = game.cameraX * layer.parallax * (1 + row * 0.5) + time * (row % 2 ? 4 : -4);
        for (let i = 0; i < 9; i += 1) {
          const x = wrap(i * 61 + noise(row * 9 + i) * 40 - shift, 540) - 30;
          rect(x, y, 6 + row * 2, 1, foam);
        }
      }
    },
    hills(layer, game, time, theme) {
      const { spacing } = layer;
      const offset = game.cameraX * layer.parallax;
      const color = resolveColor(theme, layer.color);
      for (let i = -1; i < 6; i += 1) {
        const x = i * spacing - (offset % spacing);
        const top = layer.top + noise(i + (layer.seed ?? 0)) * 27;
        polygon([[x - 20, 224], [x - 20, top + 45], [x + 5, top + 45], [x + 5, top + 28], [x + 25, top + 28], [x + 25, top + 12], [x + 51, top + 12], [x + 51, top], [x + 83, top], [x + 83, top + 11], [x + 103, top + 11], [x + 103, top + 29], [x + 132, top + 29], [x + 132, 224]], color);
      }
    },
    dunes(layer, game, time, theme) {
      const { spacing } = layer;
      const scroll = game.cameraX * layer.parallax;
      const color = resolveColor(theme, layer.color);
      for (let i = -1; i < Math.ceil(VIEW_WIDTH / spacing) + 2; i += 1) {
        const index = i + Math.floor(scroll / spacing);
        const x = i * spacing - (scroll % spacing);
        const height = layer.height * (0.6 + noise(index + 80) * 0.8);
        const points = [[x - spacing * 0.4, 224]];
        for (let step = 0; step <= 12; step += 1) {
          const t = step / 12;
          points.push([x - spacing * 0.4 + t * spacing * 1.8, layer.top - Math.sin(t * Math.PI) * height]);
        }
        points.push([x + spacing * 1.4, 224]);
        polygon(points, color);
      }
    },
    skyline(layer, game, time, theme) {
      const { spacing } = layer;
      const scroll = game.cameraX * layer.parallax;
      const body = resolveColor(theme, layer.color);
      const glass = resolveColor(theme, layer.window);
      for (let i = -1; i < Math.ceil(VIEW_WIDTH / spacing) + 2; i += 1) {
        const index = i + Math.floor(scroll / spacing);
        const x = Math.round(i * spacing - (scroll % spacing));
        const w = Math.round(spacing * (0.7 + noise(index * 3 + 1) * 0.45));
        const h = Math.round(layer.minHeight + noise(index * 3 + 2) * (layer.maxHeight - layer.minHeight));
        const top = layer.base - h;
        rect(x, top, w, 224 - top, body);
        if (noise(index * 7 + 5) > 0.7) rect(x + Math.floor(w / 2), top - 9, 1, 9, body);
        else if (noise(index * 7 + 6) > 0.6) rect(x + 3, top - 4, w - 6, 4, body);
        for (let row = top + 5; row < layer.base - 6; row += 8) {
          for (let col = x + 3; col < x + w - 4; col += 6) {
            const on = layer.lit === 0 || noise(index * 131 + row * 7 + col) < layer.lit;
            if (on) rect(col, row, 2, 3, glass);
          }
        }
      }
    },
    trees(layer, game, time, theme) {
      const scroll = game.cameraX * layer.parallax;
      for (let i = -1; i < 9; i += 1) {
        const index = i + Math.floor(scroll / 88);
        const x = i * 88 - (scroll % 88) + noise(index) * 21;
        const size = 0.7 + noise(index + 40) * 0.65;
        if (layer.style === "round") tree(x, 199, size, theme.palette, true);
        else pine(x, 204, size, theme.palette);
      }
    },
    palms(layer, game, time, theme) {
      const { spacing } = layer;
      const scroll = game.cameraX * layer.parallax;
      for (let i = -1; i < Math.ceil(VIEW_WIDTH / spacing) + 2; i += 1) {
        const index = i + Math.floor(scroll / spacing);
        if (noise(index + 90) < 0.25) continue;
        const x = i * spacing - (scroll % spacing) + noise(index + 91) * 40;
        palm(x, 200, 0.75 + noise(index + 92) * 0.4, theme.palette);
      }
    },
    hedges(layer, game, time, theme) {
      const scroll = game.cameraX * layer.parallax;
      const color = resolveColor(theme, layer.color);
      const highlight = resolveColor(theme, layer.highlight);
      for (let i = -1; i < 14; i += 1) {
        const index = i + Math.floor(scroll / 40);
        const x = i * 40 - (scroll % 40);
        const h = 8 + Math.floor(noise(index + 70) * 7);
        rect(x, 198 - h, 42, h, color);
        rect(x + 4, 196 - h, 30, 4, color);
        rect(x + 6, 197 - h, 12, 2, highlight);
      }
    },
    lamps(layer, game, time, theme) {
      const { spacing } = layer;
      const scroll = game.cameraX * layer.parallax;
      for (let i = -1; i < Math.ceil(VIEW_WIDTH / spacing) + 2; i += 1) {
        lamp(Math.round(i * spacing - (scroll % spacing) + 30), 199, layer, theme, time);
      }
    },
  };

  function background(game, time, theme, reducedMotion) {
    const { palette } = theme;
    rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, palette.sky);
    for (let y = 0; y < 8; y += 1) {
      ctx.globalAlpha = y / 11;
      rect(0, 64 + y * 20, VIEW_WIDTH, 20, palette.horizon);
    }
    ctx.globalAlpha = 1;
    for (const layer of theme.layers) LAYER_PAINTERS[layer.kind](layer, game, time, theme, reducedMotion);
    rect(0, 198, VIEW_WIDTH, 12, palette.grassDark);
    for (let x = 0; x < VIEW_WIDTH; x += 8) {
      rect(x, 194 + noise(Math.floor(x + game.cameraX * 0.3)) * 5, 8, 8, palette.grassDark);
    }
  }

  function terrain(surface, palette, floating, camera) {
    if (surface.x > camera + VIEW_WIDTH || surface.x + surface.w < camera) return;
    rect(surface.x, surface.y + 4, surface.w, floating ? 10 : surface.h, palette.dirt);
    const first = Math.max(surface.x, Math.floor(camera / 16) * 16);
    const last = Math.min(surface.x + surface.w, camera + VIEW_WIDTH + 16);
    for (let x = first; x < last; x += 16) {
      const seed = x + surface.y * 2;
      rect(x + 1, surface.y + 6, 12, floating ? 5 : 9, palette.dirtLight);
      rect(x + 8, surface.y + 11, 3, 2, palette.dirtDark);
      if (!floating) {
        rect(x + 4, surface.y + 23, 4, 3, palette.dirtDark);
        rect(x + 10, surface.y + 32, 5, 3, palette.dirtLight);
        rect(x + 1, surface.y + 42, 3, 3, palette.dirtDark);
        if (noise(seed) > 0.5) rect(x + 9, surface.y + 19, 3, 2, palette.stone);
      } else {
        rect(x + 3, surface.y + 14, 8, 2, palette.dirtDark);
        if (noise(seed) > 0.55) {
          rect(x + 11, surface.y + 12, 1, 9, palette.grassDark);
          rect(x + 9, surface.y + 17, 2, 2, palette.grass);
        }
      }
      rect(x, surface.y + 2, 16, 3, palette.grassDark);
      rect(x, surface.y - 1, 16, 4, palette.grass);
      rect(x + 1, surface.y - 1, 6, 1, palette.grassLight);
      rect(x + 11, surface.y + 3, 3, 3, palette.grassDark);
      if (noise(seed + 4) > 0.65) {
        rect(x + 5, surface.y - 4, 1, 3, palette.grassDark);
        rect(x + 3, surface.y - 3, 1, 2, palette.grass);
      }
    }
  }

  function flower(x, y, palette, seed) {
    const height = 4 + Math.floor(noise(seed) * 3);
    rect(x, y - height, 1, height, palette.grassDark);
    rect(x + 1, y - 3, 2, 1, palette.grassDark);
    const color = seed % 3 === 0 ? "#eee9d0" : palette.flower;
    rect(x - 1, y - height - 2, 3, 3, color);
    rect(x, y - height - 1, 1, 1, "#c1985b");
  }

  function mushroom(x, y, palette) {
    rect(x - 1, y - 6, 3, 6, "#ded7b3");
    rect(x - 5, y - 7, 11, 3, "#bd7864");
    rect(x - 3, y - 10, 7, 4, "#ce9273");
    rect(x - 2, y - 9, 2, 2, palette.cloud);
    rect(x + 3, y - 6, 2, 1, palette.cloud);
  }

  function shell(x, y) {
    rect(x - 3, y - 3, 7, 3, "#f3d5c0");
    rect(x - 2, y - 5, 5, 2, "#f8e4d3");
    rect(x - 1, y - 4, 1, 3, "#d9a98f");
    rect(x + 1, y - 4, 1, 3, "#d9a98f");
  }

  function bench(x, palette) {
    rect(x - 13, GROUND_Y - 12, 28, 3, palette.trunk);
    rect(x - 13, GROUND_Y - 18, 28, 3, palette.trunk);
    rect(x - 12, GROUND_Y - 17, 26, 1, palette.dirtLight);
    rect(x - 11, GROUND_Y - 9, 2, 9, "#5d6a61");
    rect(x + 11, GROUND_Y - 9, 2, 9, "#5d6a61");
    rect(x - 11, GROUND_Y - 18, 2, 9, "#5d6a61");
    rect(x + 11, GROUND_Y - 18, 2, 9, "#5d6a61");
  }

  function hydrant(x) {
    rect(x - 4, GROUND_Y - 14, 9, 14, "#c9604f");
    rect(x - 5, GROUND_Y - 16, 11, 3, "#e07d63");
    rect(x - 2, GROUND_Y - 19, 5, 3, "#e07d63");
    rect(x - 7, GROUND_Y - 10, 3, 3, "#c9604f");
    rect(x + 5, GROUND_Y - 10, 3, 3, "#c9604f");
    rect(x - 2, GROUND_Y - 12, 1, 9, "#e9a088");
    rect(x - 5, GROUND_Y - 2, 11, 2, "#8b4a42");
  }

  function decorations(game, theme) {
    const { level, cameraX } = game;
    const { palette, decor } = theme;
    const from = Math.floor(cameraX / 24) * 24;
    for (let x = from; x < cameraX + VIEW_WIDTH + 24; x += 24) {
      if (!level.ground.some((ground) => x > ground.x + 4 && x < ground.x + ground.w - 6)) continue;
      const seed = Math.floor(x / 24);
      if (noise(seed) > 0.3) flower(x + 4, GROUND_Y - 1, palette, seed);
      if (noise(seed + 8) > 0.88) {
        if (decor.scatter === "mushroom") mushroom(x + 12, GROUND_Y, palette);
        else if (decor.scatter === "shell") shell(x + 13, GROUND_Y);
        else {
          rect(x + 10, GROUND_Y - 4, 8, 3, palette.stone);
          rect(x + 12, GROUND_Y - 6, 4, 3, palette.stone);
        }
      }
    }
    for (const x of [178, 541, 1073, 1553, 2105]) {
      if (x < cameraX - 35 || x > cameraX + VIEW_WIDTH + 35) continue;
      if (!level.ground.some((ground) => x > ground.x + 20 && x < ground.x + ground.w - 20)) continue;
      if (decor.landmark === "tree") tree(x, GROUND_Y, 0.7, palette);
      else if (decor.landmark === "palm") palm(x, GROUND_Y, 0.6, palette);
      else if (decor.landmark === "bench") bench(x, palette);
      else if (decor.landmark === "hydrant") hydrant(x);
      else if (decor.landmark === "stump") {
        rect(x - 8, GROUND_Y - 13, 18, 12, palette.trunk);
        rect(x - 10, GROUND_Y - 15, 22, 5, palette.dirtLight);
        rect(x - 5, GROUND_Y - 14, 12, 1, palette.dirtDark);
        mushroom(x + 14, GROUND_Y, palette);
      } else {
        rect(x - 4, GROUND_Y - 21, 9, 20, palette.dirtDark);
        rect(x - 6, GROUND_Y - 23, 13, 4, palette.stone);
        rect(x - 3, GROUND_Y - 20, 2, 14, palette.dirtLight);
      }
    }
  }

  function bone(x, y, time) {
    y += Math.sin(time * 3 + x) * 1.6;
    rect(x - 5, y - 2, 3, 5, "#b89254");
    rect(x + 3, y - 2, 3, 5, "#b89254");
    rect(x - 3, y - 1, 7, 3, "#b89254");
    rect(x - 5, y - 3, 3, 4, "#f5de9a");
    rect(x + 3, y - 3, 3, 4, "#f5de9a");
    rect(x - 3, y - 2, 7, 2, "#f5de9a");
    rect(x - 4, y - 3, 1, 1, "#fff4ca");
    rect(x + 4, y - 3, 1, 1, "#fff4ca");
  }

  function goldenKey(x, y, time) {
    y += Math.sin(time * 2.6) * 2;
    ctx.globalAlpha = 0.16;
    rect(x - 11, y - 10, 22, 20, "#fff1a4");
    rect(x - 7, y - 14, 14, 28, "#fff1a4");
    ctx.globalAlpha = 1;
    rect(x - 7, y - 5, 7, 9, "#ba843a");
    rect(x - 8, y - 6, 7, 7, "#f6d77a");
    rect(x - 6, y - 4, 3, 3, "#bc9b54");
    rect(x - 1, y - 3, 10, 3, "#f6d77a");
    rect(x + 5, y - 1, 2, 4, "#edbd5e");
    rect(x + 8, y - 1, 2, 3, "#edbd5e");
    const sparkleX = x + Math.round(Math.sin(time * 2) * 13);
    rect(sparkleX, y - 11, 1, 5, "#fff6cc");
    rect(sparkleX - 2, y - 9, 5, 1, "#fff6cc");
  }

  function doghouse(exit, unlocked, time) {
    const { x, y } = exit;
    rect(x - 5, y + 29, 42, 4, "#6c7950");
    rect(x, y + 8, 32, 23, "#d8b889");
    rect(x + 2, y + 13, 28, 1, "#c3a475");
    rect(x + 2, y + 23, 28, 1, "#c3a475");
    rect(x + 9, y + 13, 15, 19, unlocked ? "#695d42" : "#7e7054");
    rect(x + 12, y + 10, 9, 5, unlocked ? "#695d42" : "#7e7054");
    rect(x - 4, y + 7, 40, 5, "#a76545");
    rect(x, y + 3, 32, 5, "#c58051");
    rect(x + 5, y - 1, 22, 5, "#cc8a57");
    rect(x + 10, y - 5, 12, 5, "#d79661");
    rect(x + 14, y - 8, 4, 4, "#d79661");
    rect(x + 11, y + 4, 11, 3, "#f2dcb0");
    rect(x + 10, y + 3, 3, 5, "#f2dcb0");
    rect(x + 20, y + 3, 3, 5, "#f2dcb0");
    if (!unlocked) {
      rect(x + 14, y + 20, 5, 5, "#d4b96b");
      rect(x + 15, y + 17, 3, 4, "#d4b96b");
      rect(x + 16, y + 20, 1, 3, "#7c714a");
    } else {
      ctx.globalAlpha = 0.18 + Math.sin(time * 3) * 0.07;
      rect(x + 10, y + 14, 13, 17, "#ffe9a6");
      ctx.globalAlpha = 1;
    }
    rect(x + 39, y + 17, 10, 2, "#b19c70");
    rect(x + 40, y + 19, 8, 3, "#b19c70");
    flower(x + 43, y + 17, THEMES.meadow.palette, 5);
  }

  function checkpoint(flag, time) {
    rect(flag.x + 4, flag.y - 30, 2, 29, "#807555");
    rect(flag.x + 3, flag.y - 32, 4, 3, "#d8bd84");
    const wave = Math.floor(Math.sin(time * 4));
    rect(flag.x + 6, flag.y - 29, 13, 8, flag.active ? "#db8c52" : "#ebe0b9");
    rect(flag.x + 17, flag.y - 28 + wave, 4, 7, flag.active ? "#c57044" : "#c6c19c");
    rect(flag.x + 9, flag.y - 27, 3, 3, flag.active ? "#fff0c8" : "#a6ae84");
    rect(flag.x, flag.y - 2, 10, 2, "#8c9066");
  }

  function puppy(p, time, idle) {
    if (p.invincible > 0 && Math.floor(time * 12) % 2 === 0) return;
    const running = !idle && Math.abs(p.vx) > 15 && p.grounded;
    const step = running ? Math.floor(p.stride / 6) % 2 : 0;
    ctx.save();
    ctx.translate(Math.round(p.x - 5), Math.round(p.y - 2) + (running ? step : 0));
    if (p.facing < 0) { ctx.translate(24, 0); ctx.scale(-1, 1); }
    const outline = "#8e633e";
    const fur = "#dda45f";
    const light = "#edbd77";
    const cream = "#f7e5bd";
    const tailY = 9 + Math.round(Math.sin(time * 12) * 1.3);
    rect(0, tailY, 5, 3, outline);
    rect(0, tailY - 2, 3, 3, cream);
    rect(3, 9, 12, 9, outline);
    rect(4, 9, 12, 7, fur);
    rect(6, 9, 8, 2, light);
    rect(11, 6, 12, 11, outline);
    rect(12, 5, 10, 11, fur);
    rect(12, 1, 4, 7, outline);
    rect(13, 2, 2, 5, fur);
    rect(14, 4, 1, 3, "#c58b72");
    rect(19, 0, 4, 7, outline);
    rect(20, 1, 2, 5, fur);
    rect(20, 3, 1, 3, "#c58b72");
    rect(15, 6, 3, 8, light);
    rect(18, 6, 2, 8, cream);
    rect(18, 12, 6, 4, cream);
    rect(13, 14, 7, 4, cream);
    rect(19, 8, 2, 3, "#334335");
    rect(19, 8, 1, 1, "#fff4d8");
    rect(22, 11, 3, 2, "#334335");
    rect(21, 15, 2, 2, "#c88878");
    rect(5 + step * 2, 16, 3, 4 - step, outline);
    rect(5 + step * 2, 17, 3, 2, cream);
    rect(15 - step * 2, 17, 3, 3 - step, outline);
    rect(15 - step * 2, 18, 3, 2 - step, cream);
    if (!p.grounded && !idle) {
      rect(8, 16, 3, 2, fur);
      rect(18, 16, 3, 2, cream);
    }
    ctx.restore();
  }

  function critter(enemy, time) {
    const { x, y } = enemy;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (enemy.direction < 0) { ctx.translate(18, 0); ctx.scale(-1, 1); }
    rect(1, 4, 15, 7, "#766b56");
    rect(4, 1, 9, 8, "#968367");
    for (let i = 0; i < 4; i += 1) {
      rect(2 + i * 3, -1 + i % 2, 2, 5, "#766b56");
      rect(3 + i * 3, 2, 1, 4, "#b09b76");
    }
    rect(12, 6, 6, 5, "#c3aa81");
    rect(15, 6, 1, 2, "#334335");
    rect(17, 8, 2, 2, "#4d5244");
    const step = Math.floor(time * 9) % 2;
    rect(3 + step, 10, 3, 2, "#5d5b48");
    rect(11 - step, 10, 3, 2, "#5d5b48");
    ctx.restore();
  }

  function effect(type, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dust = type === "jump";
    const count = dust ? 4 : type === "key" ? 20 : 9;
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x, y, vx: (Math.random() - 0.5) * (dust ? 28 : 65), vy: -Math.random() * 55 - 12,
        life: dust ? 0.25 : 0.5 + Math.random() * 0.3,
        size: dust ? 2 : 1 + Math.floor(Math.random() * 2),
        color: type === "hurt" ? "#d99778" : dust ? "#d8d6a4" : i % 2 ? "#ffedb2" : "#eec571",
      });
    }
    particles = particles.slice(-150);
  }

  function render(game, time, dt, reducedMotion) {
    const theme = themeForLevel(game.level, themeOverride);
    const { palette } = theme;
    const decorativeTime = reducedMotion ? 0 : time;
    background(game, decorativeTime, theme, reducedMotion);
    ctx.save();
    ctx.translate(-Math.floor(game.cameraX), 0);
    for (const gap of game.level.gaps) {
      rect(gap.x, GROUND_Y + 13, gap.w, 50, palette.water);
      rect(gap.x, GROUND_Y + 13, gap.w, 2, palette.waterLight);
      for (let row = 0; row < 4; row += 1) {
        const shift = (Math.floor(decorativeTime * (row % 2 ? 5 : -5)) + row * 7 + 500) % gap.w;
        rect(gap.x + shift, GROUND_Y + 20 + row * 8, Math.min(9, gap.w - shift), 1, palette.waterLight);
      }
    }
    decorations(game, theme);
    for (const ground of game.level.ground) terrain(ground, palette, false, game.cameraX);
    for (const platform of game.level.platforms) terrain(platform, palette, true, game.cameraX);
    for (const spike of game.level.spikes) {
      for (let x = spike.x; x < spike.x + spike.w; x += 7) {
        rect(x, spike.y + 5, 6, 3, "#748273");
        rect(x + 1, spike.y + 2, 4, 4, "#aeb5a0");
        rect(x + 2, spike.y, 2, 6, "#d1d1b8");
      }
    }
    checkpoint(game.level.checkpoint, decorativeTime);
    doghouse(game.level.exit, game.keyFound, decorativeTime);
    rect(83, GROUND_Y - 21, 2, 21, "#9b8a62");
    rect(73, GROUND_Y - 24, 23, 11, "#d3bc8d");
    rect(74, GROUND_Y - 23, 21, 9, "#e2cda1");
    ctx.fillStyle = "#7b7f56";
    ctx.font = "6px monospace";
    ctx.fillText("GO >", 76, GROUND_Y - 16);
    for (const treat of game.level.treats) {
      if (!treat.collected && treat.x > game.cameraX - 12 && treat.x < game.cameraX + VIEW_WIDTH + 12) bone(treat.x, treat.y, decorativeTime);
    }
    if (!game.keyFound) goldenKey(game.level.key.x, game.level.key.y, decorativeTime);
    for (const enemy of game.level.enemies) if (enemy.alive) critter(enemy, decorativeTime);
    if (game.player.grounded || game.status === "ready") {
      ctx.globalAlpha = 0.15;
      rect(game.player.x - 3, game.player.y + game.player.h - 1, 21, 3, "#394c39");
      ctx.globalAlpha = 1;
    }
    puppy(game.player, time, game.status === "ready");
    if (!reducedMotion) {
      for (const particle of particles) {
        if (game.status === "playing") {
          particle.life -= dt;
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.vy += 110 * dt;
        }
        ctx.globalAlpha = Math.min(1, particle.life * 3);
        rect(particle.x, particle.y, particle.size, particle.size, particle.color);
      }
      ctx.globalAlpha = 1;
      particles = particles.filter((particle) => particle.life > 0);
    }
    ctx.restore();
  }

  return { render, effect, clearEffects: () => { particles = []; } };
}
