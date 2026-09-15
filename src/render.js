import { GROUND_Y, VIEW_HEIGHT, VIEW_WIDTH } from "./levels.js";

const PALETTES = {
  meadow: {
    sky: "#cde3d3", horizon: "#e8edcb", cloud: "#f5f3db", cloudShade: "#e1e9ce",
    far: "#b2cdac", hill: "#99bd98", treeBack: "#8db18b", tree: "#719862",
    treeLight: "#87ad71", trunk: "#938260", grass: "#a6bc75", grassLight: "#c8d493",
    grassDark: "#6f9458", dirt: "#ad8a62", dirtLight: "#bc9b71", dirtDark: "#977754",
    stone: "#8e9c79", water: "#82b7ac", waterLight: "#b3d7c4", flower: "#efce7c",
  },
  forest: {
    sky: "#bad3c7", horizon: "#d8e4c2", cloud: "#e9edcf", cloudShade: "#cbdcc5",
    far: "#a1beb0", hill: "#81a99a", treeBack: "#6f9680", tree: "#4e7960",
    treeLight: "#648d64", trunk: "#80765c", grass: "#8da869", grassLight: "#b3c782",
    grassDark: "#587d4f", dirt: "#968362", dirtLight: "#aa9771", dirtDark: "#7d7056",
    stone: "#738d79", water: "#6b9f9b", waterLight: "#99c6b2", flower: "#e2ad83",
  },
  night: {
    sky: "#343f63", horizon: "#75748c", cloud: "#81849f", cloudShade: "#626e91",
    far: "#677b91", hill: "#586f82", treeBack: "#4f687a", tree: "#405b6a",
    treeLight: "#577878", trunk: "#666679", grass: "#8eaa98", grassLight: "#b7c8a8",
    grassDark: "#667f80", dirt: "#7b7b83", dirtLight: "#92908c", dirtDark: "#676977",
    stone: "#a0a69b", water: "#556d98", waterLight: "#849bb6", flower: "#e9d593",
  },
};

const noise = (n) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function createRenderer(canvas) {
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

  function background(game, time, palette, reducedMotion) {
    rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, palette.sky);
    for (let y = 0; y < 8; y += 1) {
      ctx.globalAlpha = y / 11;
      rect(0, 64 + y * 20, VIEW_WIDTH, 20, palette.horizon);
    }
    ctx.globalAlpha = 1;
    const night = game.level.theme === "night";
    if (night) {
      for (let i = 0; i < 42; i += 1) {
        const x = (noise(i + 20) * 560 - game.cameraX * 0.05 + 560) % 560;
        const y = noise(i + 130) * 123 + 8;
        ctx.globalAlpha = reducedMotion ? 0.7 : 0.5 + Math.sin(time * 1.6 + i) * 0.3;
        rect(x, y, 1 + (i % 7 === 0 ? 1 : 0), 1, "#f7eac7");
      }
      ctx.globalAlpha = 1;
    }
    const sunX = 376 - game.cameraX * 0.025;
    const sunColor = night ? "#ede9c8" : "#f5e8aa";
    rect(sunX - 3, 25, 32, 32, night ? "#626687" : "#dce5c2");
    rect(sunX + 3, 21, 20, 40, night ? "#626687" : "#dce5c2");
    rect(sunX, 29, 26, 24, sunColor);
    rect(sunX + 5, 24, 16, 34, sunColor);
    if (night) {
      rect(sunX + 17, 27, 9, 20, "#68718d");
      rect(sunX + 12, 24, 12, 7, "#68718d");
      rect(sunX + 5, 36, 3, 3, "#d2d4b6");
    }
    for (let i = -1; i < 6; i += 1) {
      const drift = reducedMotion ? 0 : time * 1.3;
      const x = ((i * 137 + 700 - game.cameraX * 0.11 + drift) % 700) - 100;
      cloud(x, 25 + noise(i + 7) * 56, 0.7 + noise(i + 9) * 0.65, palette);
    }
    for (let layer = 0; layer < 2; layer += 1) {
      const spacing = layer ? 124 : 161;
      const offset = game.cameraX * (layer ? 0.18 : 0.1);
      for (let i = -1; i < 6; i += 1) {
        const x = i * spacing - (offset % spacing);
        const top = (layer ? 131 : 109) + noise(i + layer * 30) * 27;
        polygon([[x - 20, 224], [x - 20, top + 45], [x + 5, top + 45], [x + 5, top + 28], [x + 25, top + 28], [x + 25, top + 12], [x + 51, top + 12], [x + 51, top], [x + 83, top], [x + 83, top + 11], [x + 103, top + 11], [x + 103, top + 29], [x + 132, top + 29], [x + 132, 224]], layer ? palette.hill : palette.far);
      }
    }
    for (let i = -1; i < 9; i += 1) {
      const index = i + Math.floor(game.cameraX * 0.32 / 88);
      const x = i * 88 - (game.cameraX * 0.32 % 88) + noise(index) * 21;
      const size = 0.7 + noise(index + 40) * 0.65;
      if (game.level.theme === "meadow") tree(x, 199, size, palette, true);
      else pine(x, 204, size, palette);
    }
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

  function decorations(game, palette) {
    const { level, cameraX } = game;
    const from = Math.floor(cameraX / 24) * 24;
    for (let x = from; x < cameraX + VIEW_WIDTH + 24; x += 24) {
      if (!level.ground.some((ground) => x > ground.x + 4 && x < ground.x + ground.w - 6)) continue;
      const seed = Math.floor(x / 24);
      if (noise(seed) > 0.3) flower(x + 4, GROUND_Y - 1, palette, seed);
      if (noise(seed + 8) > 0.88) {
        if (level.theme === "forest") mushroom(x + 12, GROUND_Y, palette);
        else {
          rect(x + 10, GROUND_Y - 4, 8, 3, palette.stone);
          rect(x + 12, GROUND_Y - 6, 4, 3, palette.stone);
        }
      }
    }
    for (const x of [178, 541, 1073, 1553, 2105]) {
      if (x < cameraX - 35 || x > cameraX + VIEW_WIDTH + 35) continue;
      if (!level.ground.some((ground) => x > ground.x + 20 && x < ground.x + ground.w - 20)) continue;
      if (level.theme === "meadow") tree(x, GROUND_Y, 0.7, palette);
      else if (level.theme === "forest") {
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
    flower(x + 43, y + 17, PALETTES.meadow, 5);
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
    const palette = PALETTES[game.level.theme];
    const decorativeTime = reducedMotion ? 0 : time;
    background(game, decorativeTime, palette, reducedMotion);
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
    decorations(game, palette);
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
