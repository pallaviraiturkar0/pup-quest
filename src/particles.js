// Lightweight, DOM-free particle effects. A fixed ring of particle objects is
// allocated once; new bursts reuse the oldest slots, so the pool never grows.

export const PARTICLE_CAP = 160;
export const GRAVITY = 110;

const DUST = ["#e6e0bd", "#d8d6a4", "#c9c08e"];
const SPARKLE = ["#fff8d6", "#ffedb2", "#eec571"];
const CONFETTI = ["#ef6f6c", "#f6c453", "#79c68f", "#6fb3e8", "#c58be6", "#fff4ca"];
const PAWS = ["#fff4ca", "#f3d39c"];
const HURT = ["#d99778", "#f0b58f"];
const SNOW = ["#ffffff", "#e6eff4", "#b9e1f2"];
const HEARTS = ["#ef6f6c", "#f29bb2"];

// Each burst describes how many particles to spawn and how they move.
// `still` bursts are the reduced-motion fallback: a few motionless sparkles.
export const BURSTS = Object.freeze({
  dust: { count: 6, shape: "square", colors: DUST, spreadX: 46, liftMin: 4, liftMax: 22, life: [0.22, 0.38], size: [1, 3], gravity: 40, reduced: 0 },
  sparkle: { count: 10, shape: "sparkle", colors: SPARKLE, spreadX: 70, liftMin: 12, liftMax: 60, life: [0.45, 0.75], size: [1, 2], gravity: 60, reduced: 3 },
  "big-sparkle": { count: 22, shape: "sparkle", colors: SPARKLE, spreadX: 110, liftMin: 20, liftMax: 90, life: [0.6, 1], size: [1, 3], gravity: 60, reduced: 5 },
  stomp: { count: 8, shape: "paw", colors: PAWS, spreadX: 80, liftMin: 30, liftMax: 70, life: [0.45, 0.7], size: [1, 1], gravity: GRAVITY, reduced: 0 },
  hurt: { count: 9, shape: "square", colors: HURT, spreadX: 65, liftMin: 12, liftMax: 67, life: [0.5, 0.8], size: [1, 2], gravity: GRAVITY, reduced: 0 },
  confetti: { count: 60, shape: "confetti", colors: CONFETTI, spreadX: 220, liftMin: 70, liftMax: 170, life: [1.2, 2], size: [2, 3], gravity: 140, reduced: 0 },
  snow: { count: 10, shape: "square", colors: SNOW, spreadX: 70, liftMin: 10, liftMax: 50, life: [0.35, 0.6], size: [1, 3], gravity: GRAVITY, reduced: 0 },
  hearts: { count: 12, shape: "heart", colors: HEARTS, spreadX: 90, liftMin: 30, liftMax: 80, life: [1, 1.6], size: [1, 1], gravity: 30, reduced: 3 },
  paws: { count: 14, shape: "paw", colors: PAWS, spreadX: 150, liftMin: 50, liftMax: 120, life: [1, 1.6], size: [1, 1], gravity: 90, reduced: 0 },
});

// Which bursts each game event triggers.
export const EVENT_BURSTS = Object.freeze({
  land: ["dust"],
  jump: ["dust"],
  treat: ["sparkle"],
  powerup: ["big-sparkle"],
  key: ["big-sparkle"],
  checkpoint: ["sparkle"],
  stomp: ["stomp"],
  hurt: ["hurt"],
  "level-complete": ["confetti", "paws"],
  won: ["confetti", "paws", "big-sparkle"],
  "boss-crash": ["dust"],
  "boss-bonk": ["dust"],
  "boss-hit": ["stomp", "big-sparkle"],
  "boss-defeated": ["confetti", "big-sparkle"],
  "yeti-quake": ["snow", "dust"],
  "yeti-slip": ["snow"],
  "snowball-splat": ["snow"],
  "yeti-hit": ["stomp", "snow", "big-sparkle"],
  "yeti-befriended": ["confetti", "hearts", "big-sparkle"],
});

function blank() {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: "#fff", shape: "square", gravity: 0, spin: 0 };
}

export function createParticles({ capacity = PARTICLE_CAP, random = Math.random } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Particle capacity must be a positive integer.");
  return { pool: Array.from({ length: capacity }, blank), cursor: 0, random };
}

const between = (random, [low, high]) => low + random() * (high - low);

export function emit(system, kind, x, y, { reducedMotion = false } = {}) {
  const burst = BURSTS[kind];
  if (!burst || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const count = Math.min(reducedMotion ? burst.reduced : burst.count, system.pool.length);
  const { random } = system;
  for (let i = 0; i < count; i += 1) {
    const particle = system.pool[system.cursor];
    system.cursor = (system.cursor + 1) % system.pool.length;
    const life = between(random, burst.life);
    Object.assign(particle, {
      alive: true,
      x: reducedMotion ? x + (random() - 0.5) * 14 : x,
      y: reducedMotion ? y + (random() - 0.5) * 10 : y,
      vx: reducedMotion ? 0 : (random() - 0.5) * burst.spreadX,
      vy: reducedMotion ? 0 : -between(random, [burst.liftMin, burst.liftMax]),
      life,
      maxLife: life,
      size: Math.round(between(random, burst.size)),
      color: burst.colors[i % burst.colors.length],
      shape: burst.shape,
      gravity: reducedMotion ? 0 : burst.gravity,
      spin: random() * Math.PI * 2,
    });
  }
  return count;
}

export function emitForEvent(system, event, options) {
  let total = 0;
  for (const kind of EVENT_BURSTS[event.type] ?? []) total += emit(system, kind, event.x, event.y, options);
  return total;
}

export function updateParticles(system, dt) {
  for (const particle of system.pool) {
    if (!particle.alive) continue;
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.alive = false;
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += particle.gravity * dt;
    if (particle.shape === "confetti") {
      particle.vx *= Math.exp(-1.5 * dt);
      particle.spin += dt * 9;
    }
  }
}

export function activeParticles(system) {
  return system.pool.filter((particle) => particle.alive);
}

// Removes particles that move, keeping still ones. Used when reduced motion is
// switched on while bursts are already in flight.
export function calmParticles(system) {
  for (const particle of system.pool) {
    if (particle.alive && (particle.vx !== 0 || particle.vy !== 0 || particle.gravity !== 0)) particle.alive = false;
  }
}

export function clearParticles(system) {
  for (const particle of system.pool) particle.alive = false;
  system.cursor = 0;
}

export function particleAlpha(particle) {
  return Math.max(0, Math.min(1, particle.life * 3, particle.life / particle.maxLife * 2));
}

// Small pixel masks used by the renderer, as [x, y] offsets.
export const SHAPE_PIXELS = Object.freeze({
  sparkle: [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]],
  heart: [[-1, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]],
  paw: [[-1, -2], [1, -2], [-2, -1], [2, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
});
