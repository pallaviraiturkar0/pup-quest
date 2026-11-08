// The Mega-Vac: Trail 07's finale boss, a giant robot vacuum guarding the
// golden key. Its routine is a small, readable state machine:
//
//   sleep --pup enters arena--> roam --timer--> windup --timer--> charge
//   charge --hits arena wall--> dizzy --stomped--> hurt --> roam (or defeated)
//   dizzy --timer runs out--> roam
//
// It only ever charges toward the side the pup was on when it revved up, and
// always stops at an arena wall, so standing on a wall ledge is a safe dodge.
// Its lid can only be dented while it's dizzy; stomping it otherwise just
// bounces the pup off. Three stomps power it down and drop the golden key.

export const BOSS = Object.freeze({
  w: 48,
  h: 24,
  hits: 3,
  // Each stomp makes the next round a little faster, indexed by hits taken.
  roamSpeed: [34, 44, 54],
  chargeSpeed: [170, 200, 230],
  windup: [0.9, 0.75, 0.6],
  roamTime: 1.6,
  dizzy: 2.4,
  hurt: 0.9,
  // How far below the lid a falling pup may be and still count as on top.
  stompTolerance: 6,
  stompBounce: 230,
  bonkBounce: 200,
  score: 500,
});

export const BOSS_MODES = Object.freeze(["sleep", "roam", "windup", "charge", "dizzy", "hurt", "defeated"]);

// Modes in which touching the Mega-Vac's sides hurts the pup.
const DANGEROUS = new Set(["sleep", "roam", "windup", "charge"]);

export function makeBoss({ name = "Mega-Vac", x, left, right, floor }) {
  if (!(left <= x && x + BOSS.w <= right)) throw new Error(`${name} at ${x} starts outside its arena ${left}-${right}`);
  return {
    kind: "megavac", name, x, y: floor - BOSS.h, w: BOSS.w, h: BOSS.h, floor,
    left, right, home: x,
    mode: "sleep", timer: 0, direction: -1, hits: 0,
  };
}

export const bossDefeated = (boss) => boss?.mode === "defeated";
export const bossDangerous = (boss) => DANGEROUS.has(boss.mode);
export const bossStompable = (boss) => boss.mode === "dizzy";
export const bossHealth = (boss) => BOSS.hits - boss.hits;

const center = (box) => box.x + box.w / 2;
const round = (boss) => Math.min(boss.hits, BOSS.hits - 1);

function enter(boss, mode, timer = 0) {
  boss.mode = mode;
  boss.timer = timer;
}

// Returns true when the Mega-Vac runs into an arena wall.
function move(boss, speed, dt) {
  boss.x += speed * boss.direction * dt;
  if (boss.x <= boss.left) { boss.x = boss.left; return true; }
  if (boss.x + boss.w >= boss.right) { boss.x = boss.right - boss.w; return true; }
  return false;
}

function inArena(boss, player) {
  return player.x + player.w > boss.left && player.x < boss.right;
}

// Advances the routine by `dt` seconds. Returns an event type when something
// the player should notice happens ("boss-wake", "boss-crash"), else null.
export function updateBoss(boss, dt, player) {
  switch (boss.mode) {
    case "sleep":
      if (player && inArena(boss, player)) {
        boss.direction = player && center(player) < center(boss) ? -1 : 1;
        enter(boss, "roam", BOSS.roamTime);
        return "boss-wake";
      }
      return null;
    case "roam":
      if (move(boss, BOSS.roamSpeed[round(boss)], dt)) boss.direction *= -1;
      boss.timer -= dt;
      if (boss.timer <= 0) {
        if (player && center(player) !== center(boss)) boss.direction = center(player) < center(boss) ? -1 : 1;
        enter(boss, "windup", BOSS.windup[round(boss)]);
      }
      return null;
    case "windup":
      boss.timer -= dt;
      if (boss.timer <= 0) enter(boss, "charge");
      return null;
    case "charge":
      if (move(boss, BOSS.chargeSpeed[round(boss)], dt)) {
        enter(boss, "dizzy", BOSS.dizzy);
        return "boss-crash";
      }
      return null;
    case "dizzy":
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.direction = center(boss) < (boss.left + boss.right) / 2 ? 1 : -1;
        enter(boss, "roam", BOSS.roamTime);
      }
      return null;
    case "hurt":
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.direction = center(boss) < (boss.left + boss.right) / 2 ? 1 : -1;
        enter(boss, "roam", BOSS.roamTime);
      }
      return null;
    default:
      return null;
  }
}

// A stomp while dizzy dents the lid. Returns "boss-hit" or "boss-defeated".
export function stompBoss(boss) {
  if (!bossStompable(boss)) return null;
  boss.hits += 1;
  if (boss.hits >= BOSS.hits) {
    enter(boss, "defeated");
    return "boss-defeated";
  }
  enter(boss, "hurt", BOSS.hurt);
  return "boss-hit";
}

// After the pup loses a heart the Mega-Vac rolls home and naps, keeping its dents.
export function resetBoss(boss) {
  if (bossDefeated(boss)) return;
  boss.x = boss.home;
  boss.direction = -1;
  enter(boss, "sleep");
}
