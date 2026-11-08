// The Grumpy Yeti: Frosty Fjord's secret boss, a huge shaggy snow-dog guarding
// the golden key. Its routine is a small, readable state machine:
//
//   sleep --pup enters arena--> idle --timer--> aim --timer--> throw a snowball --> idle
//   idle (no throws left) --> crouch --timer--> leap --lands on snow--> quake --> idle
//                                                    --lands on ice---> slip --stomped--> hurt --> idle (or befriended)
//   slip --timer runs out--> idle
//   idle (away from home) --> crouch --> leap back home
//
// Every attack has a tell: it raises a growing snowball before throwing, and it
// crouches with a shadow marking its landing spot before it leaps. Snowballs
// fly to where the pup stood when the Yeti started aiming, and keep rolling
// while they're on ice. A leap that lands on snow sends a shockwave along the
// floor (hop over it); a leap that lands on ice makes the Yeti slip and fall
// flat on its back, and only then can its belly be stomped. Lure it onto the ice!
// After any leap away from home it hops back to the middle of the arena first,
// so it never pins the pup against a wall.

export const YETI = Object.freeze({
  w: 32,
  h: 40,
  // Height while it lies flat on its back after slipping.
  lyingH: 16,
  hits: 3,
  // Each stomp makes the next round a little quicker, indexed by hits taken.
  idle: [1.2, 1, 0.9],
  aim: [0.9, 0.75, 0.6],
  crouch: [1.0, 0.85, 0.7],
  throws: [2, 2, 3],
  leapTime: 0.9,
  leapHeight: 56,
  slip: 2.6,
  // A slipped Yeti skids on along the ice, slowing at this rate (px/s²).
  slideGrip: 120,
  slideCarry: 0.8,
  minSlide: 40,
  hurt: 1,
  snowball: Object.freeze({ size: 10, flight: 0.8, gravity: 420, roll: 70 }),
  wave: Object.freeze({ w: 12, h: 9, speed: 150 }),
  stompTolerance: 6,
  stompBounce: 240,
  bonkBounce: 200,
  score: 750,
});

export const YETI_MODES = Object.freeze(["sleep", "idle", "aim", "crouch", "leap", "slip", "hurt", "defeated"]);

// Modes in which touching the Yeti hurts the pup.
const DANGEROUS = new Set(["sleep", "idle", "aim", "crouch", "leap"]);
const LYING = new Set(["slip", "hurt", "defeated"]);

export function makeYeti({ name = "Grumpy Yeti", x, left, right, floor, ice = [] }) {
  if (!(left <= x && x + YETI.w <= right)) throw new Error(`${name} at ${x} starts outside its arena ${left}-${right}`);
  return {
    kind: "yeti", name, x, y: floor - YETI.h, w: YETI.w, h: YETI.h, floor,
    left, right, home: x,
    // Only the ice inside the arena matters to the Yeti.
    ice: ice.filter((span) => span.x < right && span.x + span.w > left).map(({ x: from, w }) => ({ x: from, w })),
    mode: "sleep", timer: 0, direction: -1, hits: 0,
    throwsLeft: 0, target: x, leap: null, vx: 0,
    snowballs: [], waves: [],
  };
}

export const yetiDangerous = (yeti) => DANGEROUS.has(yeti.mode);
export const yetiStompable = (yeti) => yeti.mode === "slip";
export const yetiLying = (yeti) => LYING.has(yeti.mode);
export const yetiHealth = (yeti) => YETI.hits - yeti.hits;

const center = (box) => box.x + box.w / 2;
const round = (yeti) => Math.min(yeti.hits, YETI.hits - 1);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const iceAt = (yeti, x) => yeti.ice.some((span) => x >= span.x && x < span.x + span.w);

function enter(yeti, mode, timer = 0) {
  yeti.mode = mode;
  yeti.timer = timer;
}

function pose(yeti, lying) {
  yeti.h = lying ? YETI.lyingH : YETI.h;
  yeti.y = yeti.floor - yeti.h;
}

function inArena(yeti, player) {
  return player.x + player.w > yeti.left && player.x < yeti.right;
}

function face(yeti, player) {
  if (player && center(player) !== center(yeti)) yeti.direction = center(player) < center(yeti) ? -1 : 1;
}

function rest(yeti) {
  pose(yeti, false);
  yeti.vx = 0;
  yeti.leap = null;
  enter(yeti, "idle", YETI.idle[round(yeti)]);
}

// Where the Yeti aims: the pup's centre, kept inside the arena.
function aimPoint(yeti, player) {
  const x = player ? center(player) : center(yeti);
  return clamp(x, yeti.left + YETI.snowball.size, yeti.right - YETI.snowball.size);
}

function throwSnowball(yeti) {
  const { size, flight, gravity } = YETI.snowball;
  const x = center(yeti) + yeti.direction * 10 - size / 2;
  const y = yeti.y - size;
  const landY = yeti.floor - size;
  yeti.snowballs.push({
    // `landX` lets the renderer draw a shadow where the snowball will come down.
    x, y, w: size, h: size, rolling: false, landX: yeti.target - size / 2,
    vx: (yeti.target - size / 2 - x) / flight,
    vy: (landY - y - gravity * flight * flight / 2) / flight,
  });
}

function updateSnowballs(yeti, dt, emit) {
  const { gravity, roll } = YETI.snowball;
  yeti.snowballs = yeti.snowballs.filter((ball) => {
    ball.x += ball.vx * dt;
    if (!ball.rolling) {
      ball.vy += gravity * dt;
      ball.y += ball.vy * dt;
      if (ball.y + ball.h < yeti.floor) return true;
      ball.y = yeti.floor - ball.h;
      ball.vy = 0;
      if (iceAt(yeti, center(ball))) {
        // On ice a snowball keeps skidding along instead of bursting.
        ball.rolling = true;
        ball.vx = (Math.sign(ball.vx) || yeti.direction) * Math.max(Math.abs(ball.vx), roll);
        return true;
      }
    } else if (iceAt(yeti, center(ball)) && ball.x > yeti.left && ball.x + ball.w < yeti.right) {
      return true;
    }
    emit("snowball-splat", center(ball), yeti.floor - 2);
    return false;
  });
}

function updateWaves(yeti, dt) {
  yeti.waves = yeti.waves.filter((wave) => {
    wave.x += wave.direction * YETI.wave.speed * dt;
    return wave.x + wave.w > yeti.left && wave.x < yeti.right;
  });
}

// Advances the routine by `dt` seconds. `emit(type, x, y)` reports things the
// player should notice: "yeti-wake", "yeti-aim", "yeti-throw", "yeti-crouch", "yeti-return",
// "yeti-quake", "yeti-slip" and "snowball-splat".
export function updateYeti(yeti, dt, player, emit = () => {}) {
  if (yeti.mode === "defeated") return;
  updateSnowballs(yeti, dt, emit);
  updateWaves(yeti, dt);
  const say = (type) => emit(type, center(yeti), yeti.y);
  switch (yeti.mode) {
    case "sleep":
      if (player && inArena(yeti, player)) {
        face(yeti, player);
        yeti.throwsLeft = YETI.throws[round(yeti)];
        rest(yeti);
        say("yeti-wake");
      }
      return;
    case "idle":
      face(yeti, player);
      yeti.timer -= dt;
      if (yeti.timer > 0) return;
      if (Math.abs(yeti.x - yeti.home) > 1) {
        yeti.target = yeti.home;
        enter(yeti, "crouch", YETI.crouch[round(yeti)]);
        say("yeti-return");
      } else if (yeti.throwsLeft > 0) {
        yeti.target = aimPoint(yeti, player);
        enter(yeti, "aim", YETI.aim[round(yeti)]);
        say("yeti-aim");
      } else {
        const x = player ? center(player) - YETI.w / 2 : yeti.x;
        yeti.target = clamp(x, yeti.left, yeti.right - YETI.w);
        enter(yeti, "crouch", YETI.crouch[round(yeti)]);
        say("yeti-crouch");
      }
      return;
    case "aim":
      yeti.timer -= dt;
      if (yeti.timer <= 0) {
        throwSnowball(yeti);
        yeti.throwsLeft -= 1;
        rest(yeti);
        say("yeti-throw");
      }
      return;
    case "crouch":
      yeti.timer -= dt;
      if (yeti.timer <= 0) {
        if (yeti.target !== yeti.x) yeti.direction = yeti.target < yeti.x ? -1 : 1;
        yeti.leap = { from: yeti.x, to: yeti.target, t: 0 };
        enter(yeti, "leap");
      }
      return;
    case "leap": {
      const { leap } = yeti;
      leap.t += dt;
      const s = Math.min(1, leap.t / YETI.leapTime);
      yeti.x = leap.from + (leap.to - leap.from) * s;
      yeti.y = yeti.floor - YETI.h - 4 * YETI.leapHeight * s * (1 - s);
      if (s < 1) return;
      yeti.x = leap.to;
      yeti.throwsLeft = YETI.throws[round(yeti)];
      if (iceAt(yeti, center(yeti))) {
        const carry = (leap.to - leap.from) / YETI.leapTime * YETI.slideCarry;
        yeti.leap = null;
        pose(yeti, true);
        yeti.vx = yeti.direction * Math.max(Math.abs(carry), YETI.minSlide);
        enter(yeti, "slip", YETI.slip);
        say("yeti-slip");
      } else {
        rest(yeti);
        const { w, h } = YETI.wave;
        for (const direction of [-1, 1]) {
          yeti.waves.push({ x: center(yeti) - w / 2 + direction * (YETI.w / 2), y: yeti.floor - h, w, h, direction });
        }
        say("yeti-quake");
      }
      return;
    }
    case "slip":
      if (yeti.vx !== 0) {
        yeti.x += yeti.vx * dt;
        if (yeti.x <= yeti.left || yeti.x + yeti.w >= yeti.right) {
          yeti.x = clamp(yeti.x, yeti.left, yeti.right - yeti.w);
          yeti.vx = 0;
        }
        // Back on grippy snow, the skid stops at once.
        yeti.vx = iceAt(yeti, center(yeti)) ? approach(yeti.vx, 0, YETI.slideGrip * dt) : 0;
      }
      yeti.timer -= dt;
      if (yeti.timer <= 0) rest(yeti);
      return;
    case "hurt":
      yeti.timer -= dt;
      if (yeti.timer <= 0) rest(yeti);
      return;
    default:
  }
}

// Whether a snowball or shockwave is touching the pup.
export function yetiHazardHits(yeti, player) {
  return [...yeti.snowballs, ...yeti.waves].some((hazard) => intersects(player, hazard));
}

// A stomp on a slipped Yeti's belly. Returns "yeti-hit" or "yeti-befriended".
export function stompYeti(yeti) {
  if (!yetiStompable(yeti)) return null;
  yeti.hits += 1;
  yeti.vx = 0;
  if (yeti.hits >= YETI.hits) {
    yeti.snowballs = [];
    yeti.waves = [];
    enter(yeti, "defeated");
    return "yeti-befriended";
  }
  enter(yeti, "hurt", YETI.hurt);
  return "yeti-hit";
}

// After the pup loses a heart the Yeti stomps home and dozes off, keeping its bruises.
export function resetYeti(yeti) {
  if (yeti.mode === "defeated") return;
  yeti.x = yeti.home;
  yeti.direction = -1;
  yeti.snowballs = [];
  yeti.waves = [];
  rest(yeti);
  enter(yeti, "sleep");
}
