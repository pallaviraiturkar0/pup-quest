import { bossDefeated } from "./boss.js";
import { createGame, nextLevel, pauseGame, restartGame, resumeGame, startGame, stepGame } from "./engine.js";
import { LEVELS, SECRET_INDEX, SECRET_TRAIL, TRAILS } from "./levels.js";
import { createRenderer } from "./render.js";
import { themeOverrideFromSearch } from "./themes.js";
import { Sound } from "./audio.js";
import { commitDailyBest, DAILY_BEST_KEY, dailyChallenge, parseDailyBest, utcDateKey } from "./daily.js";
import {
  BEST_TIMES_KEY, commitBestTimes, formatTime, MEDAL_LABELS, medalFor, medalSvg, mergeBestTimes, nextMedal, parseBestTimes, recordBestTime, recordKeys,
  runMs, spokenTime, withSaveLock,
} from "./medals.js";
import {
  chooseTrail, createTrailMap, isStopOpen, mergeUnlocked, moveSelection, parseUnlocked, secretTrailOpen, stopColors, trailPath, UNLOCK_KEY,
  unlockAfterClear,
} from "./trailmap.js";
import {
  chooseSkin, DEFAULT_SKIN, drawPup, getSkin, moveSkinFocus, requirementText, resolveSkin, SKIN_KEY, SKINS, skinProgress, SPRITE_HEIGHT,
  SPRITE_WIDTH, unlockedSkinIds,
} from "./kennel.js";
import {
  actionAt, clearTouches, createTouchState, pawPrintSvg, pointerDown, pointerMove, pointerUp,
  shouldShowTouchControls, touchInput,
} from "./touch.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game-canvas");
const renderer = createRenderer(canvas, { themeOverride: themeOverrideFromSearch(location.search) });
export const game = createGame();
const heldKeys = new Set();
const touch = createTouchState();
const touchControls = document.querySelector(".touch-controls");
const touchButtons = [...touchControls.querySelectorAll("[data-control]")];
const coarsePointer = matchMedia("(pointer: coarse)");
let touchSeen = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const controlMap = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "jump", ArrowUp: "jump", KeyW: "jump" };
let jumpQueued = false;
let previousStatus = "";
let previousHud = "";
let toastTimer;
let storageAvailable = true;
let helpWasPlaying = false;

function announce(message) {
  $("announcer").textContent = message;
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3500);
}

function savedPreference(key, value) {
  if (!storageAvailable) return null;
  try {
    if (value !== undefined) {
      localStorage.setItem(`pup-quest:${key}`, value);
      return value;
    }
    return localStorage.getItem(`pup-quest:${key}`);
  } catch (error) {
    if (!(error instanceof DOMException) || !["SecurityError", "QuotaExceededError"].includes(error.name)) throw error;
    storageAvailable = false;
    console.warn("Pup Quest cannot save preferences in this browser:", error);
    toast("Saving is unavailable. You can still play this adventure.");
    return null;
  }
}

const savedBest = savedPreference("best");
let bestScore = Number(savedBest ?? 0);
if (!Number.isSafeInteger(bestScore) || bestScore < 0) {
  console.warn("Ignoring an invalid saved Pup Quest score.");
  toast("Your saved score couldn't be read. Starting a fresh score.");
  bestScore = 0;
}
let unlockedTrails = parseUnlocked(savedPreference(UNLOCK_KEY), LEVELS.length);
let trailMap = null;
const RECORD_KEYS = recordKeys(TRAILS);
let bestTimes = parseBestTimes(savedPreference(BEST_TIMES_KEY), RECORD_KEYS);
let shownTimer = "";
let kennel = null;
let skinId = DEFAULT_SKIN;
let daily = dailyChallenge();
const sound = new Sound({ storage: { get: (key) => savedPreference(key), set: (key, value) => savedPreference(key, value) } });

const heartMarkup = (empty) => `<svg class="heart${empty ? " empty" : ""}" viewBox="0 0 16 15" aria-hidden="true"><path d="M2 1h4v2h4V1h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2V8H0V3h2Z" fill="currentColor"/></svg>`;
const timeLabel = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function clearInput() {
  heldKeys.clear();
  clearTouches(touch);
  jumpQueued = false;
  syncTouchButtons();
}

function syncTouchButtons() {
  const held = touchInput(touch);
  for (const button of touchButtons) {
    const action = button.dataset.control;
    button.classList.toggle("pressed", action === "jump" ? held.jumpHeld : held[action]);
  }
}

function usingTouch() {
  return shouldShowTouchControls({ coarsePointer: coarsePointer.matches, maxTouchPoints: navigator.maxTouchPoints, touchSeen });
}

function updateTouchVisibility() {
  const show = usingTouch();
  if (document.documentElement.classList.contains("touch-ui") === show) return;
  document.documentElement.classList.toggle("touch-ui", show);
  $("overlay-hint").textContent = overlayHint();
}

function overlayHint() {
  if (usingTouch()) return "HOLD A PAW + TAP JUMP TO LEAP";
  return game.status === "paused" ? "ESC TO RESUME · R TO RESTART" : "ARROWS TO MOVE · SPACE TO JUMP";
}

function focusGame() {
  canvas.focus({ preventScroll: true });
}

function updateSoundButton() {
  const on = !sound.muted;
  $("sound-label").textContent = on ? "Sound on" : "Muted";
  $("sound-button").setAttribute("aria-pressed", String(on));
  $("sound-button").querySelector("path").setAttribute("d", on
    ? "M3 8v4h3l4 3V5L6 8H3Zm10-1a5 5 0 0 1 0 6m2-8a8 8 0 0 1 0 10"
    : "M3 8v4h3l4 3V5L6 8H3Zm10-1 4 6m0-6-4 6");
}

function toggleSound() {
  sound.toggleMute();
  sound.play("treat");
  updateSoundButton();
  announce(sound.muted ? "Sound muted." : "Sound on.");
}

function unlockAudio() {
  sound.unlock();
}

function objective() {
  if (game.keyFound) return "KEY FOUND · FIND YOUR WAY HOME";
  if (game.level.daily) return `DAILY WALK · ${game.level.daily.title.toUpperCase()}`;
  const { boss } = game.level;
  if (boss && !bossDefeated(boss)) {
    if (boss.kind === "yeti") return boss.mode === "sleep" ? "THE GRUMPY YETI GUARDS THE GOLDEN KEY" : "LURE THE YETI ONTO THE ICE, THEN STOMP ITS BELLY";
    return boss.mode === "sleep" ? "THE MEGA-VAC GUARDS THE GOLDEN KEY" : "STOMP THE MEGA-VAC WHILE IT'S DIZZY";
  }
  return "FIND THE GOLDEN KEY. FOLLOW YOUR PAWS.";
}

function bossPhase() {
  const { boss } = game.level;
  if (!boss) return "";
  return bossDefeated(boss) ? "defeated" : boss.mode === "sleep" ? "sleep" : "awake";
}

function setResultStats(items) {
  $("result-stats").replaceChildren();
  for (const [label, value] of items) {
    const column = document.createElement("div");
    const number = document.createElement("strong");
    number.textContent = value;
    column.append(number, document.createTextNode(label));
    $("result-stats").append(column);
  }
  $("result-stats").hidden = items.length === 0;
}

function syncOverlay() {
  if (previousStatus === game.status) return;
  previousStatus = game.status;
  canvas.dataset.state = game.status;
  $("overlay").hidden = game.status === "playing";
  $("overlay").className = `overlay ${game.status}`;
  $("pause-button").disabled = !["playing", "paused"].includes(game.status);
  $("pause-button").setAttribute("aria-label", game.status === "paused" ? "Resume game" : "Pause game");
  $("pause-button").querySelector("path").setAttribute("d", game.status === "paused" ? "M6 3v14l11-7Z" : "M5 4h3v12H5zm7 0h3v12h-3z");
  if (game.status === "playing") {
    $("objective").textContent = objective();
    return;
  }
  clearInput();
  const walk = game.level.daily;
  const run = ["level-complete", "won"].includes(game.status) ? walk ? recordDailyClear() : recordClear(game.levelIndex) : null;
  const secret = Boolean(game.level.secret);
  const finaleNext = game.status === "level-complete" && Boolean(LEVELS[game.levelIndex + 1]?.boss);
  const screens = {
    ready: ["HELLO, ADVENTURER", "Ready, player woof?", "The world's a little bigger from down here. Grab some treats. Find the key. Head home.", "Let's play"],
    paused: ["TAKE A LITTLE BREATHER", "Paws for a moment.", "Your adventure will be right here. Good dogs need snack breaks, too.", "Keep exploring"],
    "level-complete": finaleNext
      ? ["THE FINAL TRAIL AWAITS", "Look at you go!", `${game.level.name}, conquered. One last trail: the Mega-Vac guards the golden key in ${LEVELS[game.levelIndex + 1].name}.`, "Face the Mega-Vac"]
      : ["ONE TRAIL CLOSER TO HOME", "Look at you go!", `${game.level.name}, conquered. A fresh trail and a little extra heart are waiting.`, "Next trail"],
    "game-over": ["EVERY ADVENTURE TAKES PRACTICE", "A little tumble.", "Even the best dogs miss a jump. Shake it off, wag that tail, and give it another go.", "Try again"],
    won: walk
      ? ["DAILY WALK COMPLETE", "Walkies done, good dog!", `${walk.title}, conquered! ${run?.newBest ? "That's your best time today." : run?.best ? `Today's best is ${formatTime(run.best)}.` : ""} A brand-new walk arrives at midnight UTC.`, "Walk again"]
      : secret
      ? ["SECRET TRAIL CONQUERED", "Brrr-avo, good dog!", `${game.level.name}, conquered! The Grumpy Yeti just needed a belly rub, and now it's your fluffiest friend. Race it again to chase a shinier paw medal.`, "Slide again"]
      : ["CHAMPION OF MOONLIT KEEP", "Victory, very good dog!", "The Mega-Vac is out of power and the golden key is home. Seven trails, a pocket full of treats, and the comfiest nap in the kingdom. Well done, Biscuit.", "Play again"],
  };
  const [kicker, title, description, action] = screens[game.status];
  $("overlay-kicker").textContent = `✦ ${kicker}`;
  $("overlay-title").textContent = title;
  $("overlay-description").textContent = description;
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  $("primary-button").replaceChildren(document.createTextNode(action), arrow);
  $("secondary-button").hidden = game.status !== "paused";
  $("map-button").hidden = !mapAvailable();
  $("kennel-button").hidden = !mapAvailable();
  $("victory-badge").hidden = game.status !== "won" || secret || Boolean(walk);
  syncDailyButton();
  $("overlay-hint").textContent = overlayHint();
  // A single cleared trail (including the secret one) shows that trail's treats and time.
  const single = game.status === "level-complete" || (game.status === "won" && (secret || Boolean(walk)));
  const stats = ["level-complete", "game-over", "won"].includes(game.status)
    ? [["TREATS", single ? `${game.levelTreats}/${game.level.treats.length}` : String(game.totalTreats)], ["SCORE", String(game.score)], ["TIME", single ? formatTime(run.ms) : timeLabel(game.elapsed)]]
    : [];
  if (game.status === "won") stats.push(walk ? ["BEST TODAY", formatTime(run.best ?? run.ms)] : ["TUMBLES", String(game.deaths)]);
  setResultStats(stats);
  // Daily Walks race today's best instead of a trail's paw medals.
  showMedalResult(walk ? null : run);
  if (run?.secretRevealed) toast(`A chilly breeze… a secret trail appeared on the Trail Map: ${SECRET_TRAIL.name}!`);
  if (game.status !== "ready") {
    announce(`${title} ${description}${run ? ` ${walk ? `Walk time ${spokenTime(run.ms)}.` : medalSpeech(run)}` : ""}${run?.secretRevealed ? ` A secret trail, ${SECRET_TRAIL.name}, appeared on the Trail Map.` : ""}`);
    $("primary-button").focus({ preventScroll: true });
  }
}

function updateUi() {
  // A title or results screen left open past midnight UTC switches to the new day's walk.
  if (daily.date !== utcDateKey()) syncDailyButton();
  const signature = [game.status, game.levelIndex, game.lives, game.levelTreats, game.keyFound, game.score, bossPhase()].join(":");
  if (signature === previousHud) return;
  previousHud = signature;
  $("level-number").textContent = game.level.daily ? "☀" : stopNumber(game.levelIndex);
  $("level-name").textContent = game.level.name;
  $("treat-count").replaceChildren(document.createTextNode(`${String(game.levelTreats).padStart(2, "0")} `));
  const total = document.createElement("span");
  total.textContent = `/ ${game.level.treats.length}`;
  $("treat-count").append(total);
  $("lives").innerHTML = Array.from({ length: Math.max(3, game.lives) }, (_, index) => heartMarkup(index >= game.lives)).join("");
  $("lives").setAttribute("aria-label", `${game.lives} ${game.lives === 1 ? "life" : "lives"} remaining`);
  if (game.status === "playing") $("objective").textContent = objective();
  if (game.score > bestScore) {
    bestScore = game.score;
    savedPreference("best", String(bestScore));
  }
  $("best-score").textContent = String(bestScore).padStart(4, "0");
  document.querySelectorAll("[data-trail]").forEach((trail, index) => {
    // A secret run or Daily Walk is not campaign progress, so show the trails actually cleared on this device.
    const done = game.level.secret || game.level.daily ? index < unlockedTrails - 1 || bestTimes[index] !== null : index < game.levelIndex || game.status === "won";
    const current = index === game.levelIndex;
    trail.classList.toggle("active", current);
    if (current) trail.setAttribute("aria-current", "step");
    else trail.removeAttribute("aria-current");
    trail.querySelector(".trail-state").textContent = done ? "✓" : current ? "●" : "○";
    trail.querySelector(".trail-state").setAttribute("aria-label", done ? "Completed" : current ? "Current trail" : "Not reached");
  });
  syncOverlay();
}

const POWERUP_MESSAGES = {
  bone: () => `Bone treat! ${game.lives} ${game.lives === 1 ? "heart" : "hearts"} now.`,
  zoomies: () => "ZOOMIES! Super speed for a few seconds.",
  squeaky: ({ scared }) => scared ? "SQUEAK! Nearby critters freeze in fright." : "SQUEAK! Nobody around to scare.",
};

function processEvents() {
  for (const event of game.events.splice(0)) {
    sound.play(event.type);
    renderer.effect(event, reducedMotion.matches);
    if (event.type === "key") toast("Golden key found! The doghouse is open.");
    if (event.type === "powerup") toast(POWERUP_MESSAGES[event.powerup](event));
    if (event.type === "checkpoint") toast("Checkpoint! A safe spot for little paws.");
    if (event.type === "need-key") toast(game.level.boss && !bossDefeated(game.level.boss) ? `The door is locked. ${game.level.boss.kind === "yeti" ? "Befriend the Grumpy Yeti" : "Beat the Mega-Vac"} to win the golden key!` : "The door is locked. Find the golden key first!");
    if (event.type === "boss-wake") toast("The Mega-Vac whirs awake! Dodge its charge from a ledge, then stomp its lid while it's dizzy.");
    if (event.type === "boss-crash") toast("CRASH! It's dizzy. Stomp the lid!");
    if (event.type === "boss-bonk") toast(game.level.boss?.kind === "yeti" ? "Boing! Trip it up on the ice first." : "Clang! Its lid only dents while it's dizzy.");
    if (event.type === "boss-hit") toast(`BONK! ${event.health} more ${event.health === 1 ? "stomp" : "stomps"}!`);
    if (event.type === "boss-defeated") toast("The Mega-Vac powers down! It dropped the golden key.");
    if (event.type === "yeti-wake") toast("The Grumpy Yeti wakes up! Dodge its snowballs, stand on the ice when it crouches, then run before it lands.");
    if (event.type === "yeti-return") toast("It's hopping back to the middle. Jump the shockwaves!");
    if (event.type === "yeti-slip") toast("WHOOPS! It slipped on the ice. Stomp its belly!");
    if (event.type === "yeti-quake" && game.level.boss.x !== game.level.boss.home) toast("THUD! It landed on snow. Lure it onto the ice instead.");
    if (event.type === "yeti-hit") toast(`Belly bop! ${event.health} more ${event.health === 1 ? "stomp" : "stomps"}!`);
    if (event.type === "yeti-befriended") toast("The Yeti rolls over for belly rubs. It's a friend now! It dropped the golden key.");
    if (event.type === "hurt" && game.lives > 0) toast(`Whoops! ${game.lives} ${game.lives === 1 ? "heart" : "hearts"} left. You've got this.`);
    if (event.type === "start") {
      $("toast").hidden = true;
      announce(game.level.daily
        ? `Daily Walk for ${game.level.daily.date}: ${game.level.daily.title}. ${daily.date === game.level.daily.date ? daily.blurb : ""} Find the golden key and reach the doghouse.`
        : game.level.secret
        ? `Secret trail: ${game.level.name}. Watch your paws on the shiny blue ice. Find the golden key and reach the doghouse.`
        : `Trail ${game.levelIndex + 1} of ${LEVELS.length}: ${game.level.name}. Find the golden key and reach the doghouse.`);
    }
  }
}

function primaryAction() {
  unlockAudio();
  clearInput();
  if (game.status === "ready") startGame(game);
  else if (game.status === "paused") resumeGame(game);
  else if (game.status === "level-complete") nextLevel(game);
  else if (game.status === "won" && game.level.daily) {
    // Walking again after midnight UTC starts the new day's walk.
    startDailyWalk();
    return;
  } else if (game.status === "won") restartGame(game, game.level.secret ? SECRET_INDEX : 0);
  else if (game.status === "game-over") restartGame(game);
  renderer.clearEffects();
  processEvents();
  updateUi();
  focusGame();
}

function togglePause() {
  clearInput();
  if (game.status === "playing") pauseGame(game);
  else if (game.status === "paused") { resumeGame(game); focusGame(); }
  updateUi();
}

function latestUnlocked() {
  unlockedTrails = mergeUnlocked(unlockedTrails, savedPreference(UNLOCK_KEY), LEVELS.length);
  return unlockedTrails;
}

function latestBestTimes() {
  bestTimes = mergeBestTimes(bestTimes, savedPreference(BEST_TIMES_KEY), RECORD_KEYS);
  return bestTimes;
}

// Saves the unlock and, when it is a personal best, the trail time. Returns the run's medal result.
function recordClear(index) {
  const saved = latestUnlocked();
  // The secret trail sits outside the campaign, so clearing it never opens campaign trails.
  const next = index < LEVELS.length ? unlockAfterClear(saved, index, LEVELS.length) : saved;
  if (next !== saved) {
    unlockedTrails = next;
    savedPreference(UNLOCK_KEY, String(unlockedTrails));
  }
  const ms = runMs(game.levelTime);
  const { par } = TRAILS[index];
  const wasSecretOpen = secretTrailOpen(latestBestTimes(), LEVELS);
  const result = recordBestTime(bestTimes, index, ms);
  bestTimes = result.times;
  if (result.newBest) saveBestTimes();
  const secretRevealed = !wasSecretOpen && secretTrailOpen(bestTimes, LEVELS);
  return { index, ms, best: result.best, newBest: result.newBest, medal: medalFor(ms, par), next: nextMedal(ms, par), secretRevealed };
}

// Daily Walk: one remixed trail per UTC day. Its best time is kept apart from the trail medals.
function todaysWalk() {
  if (daily.date !== utcDateKey()) daily = dailyChallenge();
  return daily;
}

function syncDailyButton() {
  const walk = todaysWalk();
  const best = parseDailyBest(savedPreference(DAILY_BEST_KEY), walk.date);
  $("daily-button").textContent = `Daily walk: ${walk.title}`;
  $("daily-button").setAttribute("aria-label", `Daily walk for today: ${walk.title}. ${walk.blurb}${best === null ? "" : ` Your best today is ${spokenTime(best)}.`}`);
  $("daily-best").textContent = best === null ? `☀ ${walk.blurb}` : `☀ BEST TODAY ${formatTime(best)}`;
  $("daily-button").hidden = !mapAvailable();
  $("daily-best").hidden = !mapAvailable();
}

function startDailyWalk() {
  if (!mapAvailable()) return;
  unlockAudio();
  clearInput();
  const walk = todaysWalk();
  Object.assign(game, createGame(walk.trail, { level: walk.level }));
  startGame(game);
  renderer.clearEffects();
  processEvents();
  updateUi();
  focusGame();
}

// Saves the walk's time when it beats today's best, re-reading under the lock so tabs never drop a faster run.
function recordDailyClear() {
  const ms = runMs(game.levelTime);
  const { date } = game.level.daily;
  const result = commitDailyBest(ms, savedPreference(DAILY_BEST_KEY), date);
  if (result.raw) {
    withSaveLock(navigator.locks, `pup-quest:${DAILY_BEST_KEY}`, () => {
      const commit = commitDailyBest(ms, savedPreference(DAILY_BEST_KEY), date);
      if (commit.raw) savedPreference(DAILY_BEST_KEY, commit.raw);
    }).then(syncDailyButton).catch((error) => console.warn("Pup Quest could not save a Daily Walk time:", error));
  }
  return { ms, best: result.best, newBest: result.newBest };
}

// Re-read and merge under a cross-tab lock so two tabs saving at once can't drop each other's records.
function saveBestTimes() {
  withSaveLock(navigator.locks, `pup-quest:${BEST_TIMES_KEY}`, () => {
    const commit = commitBestTimes(bestTimes, savedPreference(BEST_TIMES_KEY), RECORD_KEYS);
    bestTimes = commit.times;
    savedPreference(BEST_TIMES_KEY, commit.raw);
  }).catch((error) => console.warn("Pup Quest could not save a best time:", error));
}

window.addEventListener("storage", (event) => {
  // A null key means another tab cleared all of storage.
  if (event.key !== null && ![`pup-quest:${BEST_TIMES_KEY}`, `pup-quest:${SKIN_KEY}`].includes(event.key)) return;
  latestBestTimes();
  applySavedSkin();
  if (trailMap) refreshTrailMap();
  if (kennel) syncKennel();
});

function medalSpeech({ ms, best, newBest, medal, next }) {
  return [
    `Trail time ${spokenTime(ms)}.`,
    newBest ? "New best!" : "",
    medal ? `${MEDAL_LABELS[medal]} medal.` : "No medal this time.",
    !newBest && best !== null ? `Best time ${spokenTime(best)}.` : "",
    next ? `${MEDAL_LABELS[next.medal]} is under ${spokenTime(next.ms)}.` : "",
  ].filter(Boolean).join(" ");
}

function showMedalResult(run) {
  $("medal-result").hidden = !run;
  if (!run) return;
  const { index, ms, best, newBest, medal, next } = run;
  $("medal-result").className = `medal-result ${medal ?? "none"}${newBest ? " new-best" : ""}`;
  $("medal-icon").innerHTML = medal ? medalSvg(medal) : "";
  $("medal-name").textContent = medal ? MEDAL_LABELS[medal].toUpperCase() : "NO MEDAL YET";
  const lead = game.status === "won" && !game.level.secret ? `${TRAILS[index].name} ${formatTime(ms)} · ` : "";
  const goal = next ? `${MEDAL_LABELS[next.medal]} under ${formatTime(next.ms)}` : "Top dog time!";
  $("medal-detail").textContent = `${lead}Best ${formatTime(best ?? ms)} · ${goal}`;
  $("new-best").hidden = !newBest;
}

function mapAvailable() {
  return ["ready", "game-over", "won"].includes(game.status);
}

const pawMarkup = pawPrintSvg("jump");
const padlockMarkup = '<svg class="padlock" viewBox="0 0 12 14" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M3 6V3h1V2h1V1h2v1h1v1h1v3h1v7H2V6Zm2 0h2V3H5Zm0 3v2h2V9Z" fill="currentColor" fill-rule="evenodd"/></svg>';
let trailLayout = null;

const stopNumber = (index) => index === SECRET_INDEX ? "★" : String(index + 1).padStart(2, "0");
const stopName = (index) => index === SECRET_INDEX ? `Secret trail, ${TRAILS[index].name}` : `Trail ${stopNumber(index)}, ${TRAILS[index].name}`;

// The map shows the campaign, plus the secret trail's stop once it has been found.
function buildTrailMap(count = LEVELS.length) {
  if (trailLayout?.stops.length === count) return;
  trailLayout = trailPath(count);
  const svgNs = "http://www.w3.org/2000/svg";
  const path = (className) => {
    const element = document.createElementNS(svgNs, "path");
    element.setAttribute("d", trailLayout.d);
    element.setAttribute("class", className);
    element.setAttribute("vector-effect", "non-scaling-stroke");
    return element;
  };
  $("trail-map-path").replaceChildren(path("trail-map-road"), path("trail-map-dash"));
  $("trail-map-stops").replaceChildren(...TRAILS.slice(0, count).map((level, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const { fill, ring, ink } = stopColors(level.theme);
    const { x, y } = trailLayout.stops[index];
    item.style.left = `${(x / 480) * 100}%`;
    item.style.top = `${(y / 256) * 100}%`;
    button.type = "button";
    button.className = level.secret ? "trail-stop secret" : "trail-stop";
    button.dataset.stop = String(index);
    button.style.setProperty("--stop-fill", fill);
    button.style.setProperty("--stop-ring", ring);
    button.style.setProperty("--stop-ink", ink);
    const label = document.createElement("span");
    label.className = "trail-stop-label";
    const title = document.createElement("span");
    title.textContent = `${stopNumber(index)} ${level.name}`;
    const best = document.createElement("span");
    best.className = "trail-stop-best";
    label.append(title, best);
    const medal = document.createElement("span");
    medal.className = "trail-stop-medal";
    button.append(label, medal);
    button.addEventListener("click", () => pickTrail(index));
    button.addEventListener("focus", () => {
      if (!trailMap || trailMap.selected === index) return;
      trailMap.selected = index;
      syncTrailMap();
    });
    item.append(button);
    return item;
  }));
}

function syncTrailMap() {
  for (const button of $("trail-map-stops").querySelectorAll(".trail-stop")) {
    const index = Number(button.dataset.stop);
    const open = isStopOpen(trailMap, index);
    const best = bestTimes[index];
    const medal = best === null ? null : medalFor(best, TRAILS[index].par);
    const cleared = index < trailMap.unlocked - 1 || best !== null;
    const selected = index === trailMap.selected;
    button.classList.toggle("locked", !open);
    button.classList.toggle("selected", selected);
    button.tabIndex = selected ? 0 : -1;
    button.setAttribute("aria-disabled", String(!open));
    const name = stopName(index);
    const record = best === null ? "" : `, best time ${spokenTime(best)}, ${medal ? `${MEDAL_LABELS[medal]} medal` : "no medal yet"}`;
    button.setAttribute("aria-label", `${name}${open ? cleared ? ", cleared" : "" : ", locked"}${record}`);
    button.querySelector(".trail-stop-best").textContent = best === null ? "" : `${formatTime(best)}${medal ? ` · ${medal.toUpperCase()}` : ""}`;
    button.querySelector(".trail-stop-medal").innerHTML = medal ? medalSvg(medal) : "";
    const icon = button.querySelector(":scope > svg");
    const wanted = open ? "paw" : "padlock";
    if (!icon?.classList.contains(wanted)) {
      icon?.remove();
      button.insertAdjacentHTML("afterbegin", open ? pawMarkup : padlockMarkup);
    }
  }
  const selected = trailMap.selected;
  const best = bestTimes[selected];
  const state = !isStopOpen(trailMap, selected) ? "LOCKED" : selected < trailMap.unlocked - 1 || best !== null ? "CLEARED" : "OPEN";
  const medal = best === null ? null : medalFor(best, TRAILS[selected].par);
  const record = best === null ? "" : ` · BEST ${formatTime(best)} · ${medal ? MEDAL_LABELS[medal].toUpperCase() : "NO MEDAL YET"}`;
  const heading = selected === SECRET_INDEX ? "SECRET TRAIL" : `TRAIL ${stopNumber(selected)}`;
  $("trail-map-status").textContent = `${heading} · ${TRAILS[selected].name.toUpperCase()} · ${state}${record}`;
}

// While the map is open everything else on the page is inert, except the live regions that announce map messages.
let inertedElements = [];
function setBackgroundInert(on, dialog = $("trail-map")) {
  if (!on) {
    for (const element of inertedElements) element.inert = false;
    inertedElements = [];
    return;
  }
  const keep = [dialog, $("toast"), $("announcer")];
  for (let node = dialog; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.inert || keep.some((element) => sibling.contains(element))) continue;
      sibling.inert = true;
      inertedElements.push(sibling);
    }
  }
}

function focusSelectedStop() {
  $("trail-map-stops").querySelector(`[data-stop="${trailMap.selected}"]`)?.focus({ preventScroll: true });
}

// Adds (or removes) the secret stop when another tab changes the saved times, keeping the selection and focus.
function refreshTrailMap() {
  const secret = secretTrailOpen(bestTimes, LEVELS);
  if (secret !== trailMap.secret) {
    const focused = $("trail-map-stops").contains(document.activeElement);
    buildTrailMap(LEVELS.length + (secret ? 1 : 0));
    const { selected } = trailMap;
    trailMap = createTrailMap(trailMap.unlocked, LEVELS.length, selected, { secret });
    // Keep the selected stop (even a locked one) if it is still on the map; only a removed secret stop falls back.
    if (selected < trailMap.total) trailMap.selected = selected;
    if (focused) focusSelectedStop();
    if (secret) announce(`A secret trail appeared on the Trail Map: ${SECRET_TRAIL.name}!`);
  }
  syncTrailMap();
}

function openTrailMap() {
  if (!mapAvailable()) return;
  clearInput();
  latestUnlocked();
  latestBestTimes();
  const secret = secretTrailOpen(bestTimes, LEVELS);
  buildTrailMap(LEVELS.length + (secret ? 1 : 0));
  trailMap = createTrailMap(unlockedTrails, LEVELS.length, game.status === "ready" ? unlockedTrails - 1 : game.startIndex, { secret });
  syncTrailMap();
  $("trail-map").hidden = false;
  setBackgroundInert(true);
  focusSelectedStop();
  announce(`Trail map. ${unlockedTrails} of ${LEVELS.length} trails open${secret ? `, plus the secret trail ${SECRET_TRAIL.name}` : ""}. Use the arrow keys to choose a trail.`);
}

function closeTrailMap({ restoreFocus = true } = {}) {
  if (!trailMap) return;
  trailMap = null;
  $("trail-map").hidden = true;
  setBackgroundInert(false);
  if (restoreFocus) $("map-button").focus({ preventScroll: true });
}

function pickTrail(index) {
  if (!trailMap) return;
  trailMap.selected = index;
  syncTrailMap();
  const choice = chooseTrail(trailMap, index);
  if (choice === null) {
    const message = `Trail ${String(index + 1).padStart(2, "0")} is locked. Clear Trail ${String(index).padStart(2, "0")} to open it.`;
    toast(message);
    announce(message);
    focusSelectedStop();
    return;
  }
  unlockAudio();
  closeTrailMap({ restoreFocus: false });
  Object.assign(game, createGame(choice));
  startGame(game);
  renderer.clearEffects();
  processEvents();
  updateUi();
  focusGame();
}

window.addEventListener("keydown", (event) => {
  if (!trailMap || $("help-dialog").open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeTrailMap();
    return;
  }
  if (event.key === "Tab") {
    // Three tab stops: the selected trail, Kennel, and Back. Tab and Shift+Tab cycle through them.
    event.preventDefault();
    const stops = ["stop", "trail-map-kennel", "trail-map-back"];
    const onStop = event.target instanceof Element && event.target.closest(".trail-stop");
    const current = onStop ? 0 : Math.max(stops.indexOf(event.target?.id), 0);
    const next = stops[(current + (event.shiftKey ? stops.length - 1 : 1)) % stops.length];
    if (next === "stop") focusSelectedStop();
    else $(next).focus({ preventScroll: true });
    return;
  }
  if (moveSelection(trailMap, event.key)) {
    event.preventDefault();
    syncTrailMap();
    focusSelectedStop();
  }
});
$("map-button").addEventListener("click", openTrailMap);
$("daily-button").addEventListener("click", startDailyWalk);
$("trail-map-back").addEventListener("click", () => closeTrailMap());
$("trail-map-kennel").addEventListener("click", () => {
  closeTrailMap({ restoreFocus: false });
  openKennel("map");
});
buildTrailMap();

// Dog Kennel: pick a pup skin earned with paw medals.
function currentUnlockedSkins() {
  return unlockedSkinIds(bestTimes, LEVELS);
}

function applySavedSkin() {
  const raw = savedPreference(SKIN_KEY);
  // A missing key that was read successfully means Biscuit; only blocked storage keeps this session's pick.
  skinId = resolveSkin(raw, currentUnlockedSkins(), storageAvailable ? DEFAULT_SKIN : skinId);
  renderer.setSkin(skinId);
}

function drawSkinPreview(preview, skin, tailY = 9) {
  const context = preview.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, preview.width, preview.height);
  drawPup((x, y, w, h, color) => {
    context.fillStyle = color;
    context.fillRect(x + 1, y + 1, w, h);
  }, skin, { tailY });
}

function buildKennel() {
  $("kennel-skins").replaceChildren(...SKINS.map((skin, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kennel-skin";
    button.dataset.skin = skin.id;
    button.setAttribute("role", "radio");
    const preview = document.createElement("canvas");
    preview.className = "kennel-preview";
    preview.width = SPRITE_WIDTH + 2;
    preview.height = SPRITE_HEIGHT + 2;
    preview.setAttribute("aria-hidden", "true");
    drawSkinPreview(preview, skin);
    const name = document.createElement("span");
    name.className = "kennel-name";
    name.textContent = skin.name;
    const breed = document.createElement("span");
    breed.className = "kennel-breed";
    breed.textContent = skin.breed;
    const need = document.createElement("span");
    need.className = "kennel-need";
    button.append(preview, name, breed, need);
    button.addEventListener("click", () => pickSkin(index));
    button.addEventListener("focus", () => {
      if (!kennel || kennel.focus === index) return;
      kennel.focus = index;
      syncKennel();
    });
    return button;
  }));
}

function syncKennel() {
  const unlocked = currentUnlockedSkins();
  const buttons = [...$("kennel-skins").querySelectorAll(".kennel-skin")];
  buttons.forEach((button, index) => {
    const skin = SKINS[index];
    const open = unlocked.includes(skin.id);
    const chosen = skin.id === skinId;
    const progress = skinProgress(skin, bestTimes, LEVELS);
    const requirement = requirementText(skin, LEVELS);
    button.classList.toggle("locked", !open);
    button.classList.toggle("chosen", chosen);
    button.classList.toggle("focused", index === kennel.focus);
    button.tabIndex = index === kennel.focus ? 0 : -1;
    button.setAttribute("aria-checked", String(chosen));
    button.setAttribute("aria-disabled", String(!open));
    const count = progress.need > 1 ? ` (${progress.have} of ${progress.need})` : "";
    button.querySelector(".kennel-need").textContent = open ? chosen ? "PICKED" : "UNLOCKED" : `🔒 ${requirement}${count}`;
    button.setAttribute("aria-label", `${skin.name} the ${skin.breed}${open ? chosen ? ", picked" : ", unlocked" : `, locked. ${requirement}${count}`}`);
  });
  const total = SKINS.length;
  $("kennel-status").textContent = `${unlocked.length} OF ${total} PUPS UNLOCKED · PLAYING AS ${getSkin(skinId).name.toUpperCase()}`;
}

function focusKennelSkin() {
  $("kennel-skins").querySelectorAll(".kennel-skin")[kennel.focus]?.focus({ preventScroll: true });
}

let wagFrame = 0;
function wagChosenPreview(now) {
  if (!kennel) return;
  const index = SKINS.findIndex((skin) => skin.id === skinId);
  const preview = $("kennel-skins").querySelectorAll(".kennel-preview")[index];
  if (preview) drawSkinPreview(preview, SKINS[index], reducedMotion.matches ? 9 : 9 + Math.round(Math.sin(now / 1000 * 12) * 1.3));
  wagFrame = requestAnimationFrame(wagChosenPreview);
}

function openKennel(returnTo = "overlay") {
  if (!mapAvailable()) return;
  clearInput();
  latestBestTimes();
  applySavedSkin();
  kennel = { focus: Math.max(SKINS.findIndex((skin) => skin.id === skinId), 0), returnTo };
  SKINS.forEach((skin, index) => drawSkinPreview($("kennel-skins").querySelectorAll(".kennel-preview")[index], skin));
  syncKennel();
  $("kennel").hidden = false;
  setBackgroundInert(true, $("kennel"));
  focusKennelSkin();
  wagFrame = requestAnimationFrame(wagChosenPreview);
  announce(`Dog kennel. ${currentUnlockedSkins().length} of ${SKINS.length} pups unlocked. Playing as ${getSkin(skinId).name} the ${getSkin(skinId).breed}. Use the arrow keys to browse pups.`);
}

function closeKennel() {
  if (!kennel) return;
  const { returnTo } = kennel;
  kennel = null;
  cancelAnimationFrame(wagFrame);
  $("kennel").hidden = true;
  setBackgroundInert(false);
  if (returnTo === "map") {
    openTrailMap();
    $("trail-map-kennel").focus({ preventScroll: true });
  } else $("kennel-button").focus({ preventScroll: true });
}

function pickSkin(index) {
  if (!kennel) return;
  kennel.focus = index;
  const skin = SKINS[index];
  latestBestTimes();
  const choice = chooseSkin(skin.id, currentUnlockedSkins());
  if (choice === null) {
    const message = `${skin.name} the ${skin.breed} is locked. ${requirementText(skin, LEVELS)} to unlock.`;
    toast(message);
    announce(message);
  } else {
    skinId = choice;
    savedPreference(SKIN_KEY, choice);
    renderer.setSkin(choice);
    SKINS.forEach((other, otherIndex) => drawSkinPreview($("kennel-skins").querySelectorAll(".kennel-preview")[otherIndex], other));
    announce(`Playing as ${skin.name} the ${skin.breed}.`);
  }
  syncKennel();
  focusKennelSkin();
}

window.addEventListener("keydown", (event) => {
  if (!kennel || $("help-dialog").open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeKennel();
    return;
  }
  if (event.key === "Tab") {
    // Two tab stops: the focused pup and Back.
    event.preventDefault();
    const onSkin = event.target instanceof Element && event.target.closest(".kennel-skin");
    if (onSkin) $("kennel-back").focus({ preventScroll: true });
    else focusKennelSkin();
    return;
  }
  const next = moveSkinFocus(kennel.focus, event.key);
  if (next !== null) {
    event.preventDefault();
    kennel.focus = next;
    syncKennel();
    focusKennelSkin();
  }
});
$("kennel-button").addEventListener("click", () => openKennel("overlay"));
$("kennel-back").addEventListener("click", () => closeKennel());
buildKennel();
applySavedSkin();

$("primary-button").addEventListener("click", primaryAction);
$("pause-button").addEventListener("click", togglePause);
$("secondary-button").addEventListener("click", () => {
  restartGame(game);
  renderer.clearEffects();
  processEvents();
  updateUi();
  focusGame();
});
canvas.addEventListener("pointerdown", () => { if (game.status === "playing") focusGame(); });

window.addEventListener("keydown", (event) => {
  if ($("help-dialog").open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === "KeyM") {
    if (!event.repeat) toggleSound();
    return;
  }
  if (!event.repeat) unlockAudio();
  if (trailMap || kennel) return;
  if (["Escape", "KeyP"].includes(event.code) && ["playing", "paused"].includes(game.status)) {
    event.preventDefault();
    if (!event.repeat) togglePause();
    return;
  }
  if (event.code === "KeyR" && game.status === "paused" && !event.repeat) {
    event.preventDefault();
    $("secondary-button").click();
    return;
  }
  const action = controlMap[event.code];
  if (!action || game.status !== "playing") return;
  if (event.code === "Space" && event.target instanceof HTMLElement && event.target.closest("button, a")) return;
  event.preventDefault();
  if (action === "jump" && !heldKeys.has(event.code)) jumpQueued = true;
  heldKeys.add(event.code);
});
window.addEventListener("keyup", (event) => {
  heldKeys.delete(event.code);
  if (controlMap[event.code] && game.status === "playing" && !$("help-dialog").open) event.preventDefault();
});

for (const button of touchButtons) {
  button.insertAdjacentHTML("afterbegin", pawPrintSvg(button.dataset.control));
  button.addEventListener("click", (event) => {
    if (event.detail === 0 && button.dataset.control === "jump" && game.status === "playing") jumpQueued = true;
  });
}

const touchZones = () => touchButtons.map((button) => {
  const { left, top, right, bottom } = button.getBoundingClientRect();
  return { action: button.dataset.control, left, top, right, bottom };
});

touchControls.addEventListener("pointerdown", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-control]") : null;
  if (!button || game.status !== "playing") return;
  event.preventDefault();
  // Capture keeps this finger's moves and release coming here even after it slides off a paw.
  button.setPointerCapture(event.pointerId);
  if (pointerDown(touch, event.pointerId, button.dataset.control)) jumpQueued = true;
  syncTouchButtons();
  unlockAudio();
  focusGame();
});
touchControls.addEventListener("pointermove", (event) => {
  if (!touch.pointers.has(event.pointerId)) return;
  if (pointerMove(touch, event.pointerId, actionAt(touchZones(), event.clientX, event.clientY))) jumpQueued = true;
  syncTouchButtons();
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  touchControls.addEventListener(type, (event) => {
    pointerUp(touch, event.pointerId);
    syncTouchButtons();
  });
}
touchControls.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("pointerdown", (event) => {
  unlockAudio();
  if (event.pointerType !== "touch" || touchSeen) return;
  touchSeen = true;
  updateTouchVisibility();
}, { capture: true, passive: true });
coarsePointer.addEventListener("change", updateTouchVisibility);

function suspendGame() {
  clearInput();
  pauseGame(game);
  updateUi();
}
window.addEventListener("blur", suspendGame);
document.addEventListener("visibilitychange", () => { if (document.hidden) suspendGame(); });

$("sound-button").addEventListener("click", () => {
  toggleSound();
  if (game.status === "playing") focusGame();
});

$("help-button").addEventListener("click", () => {
  helpWasPlaying = game.status === "playing";
  suspendGame();
  $("help-dialog").showModal();
});
for (const id of ["close-help", "got-it-button"]) $(id).addEventListener("click", () => $("help-dialog").close());
$("help-dialog").addEventListener("close", () => {
  clearInput();
  if (helpWasPlaying && game.status === "paused") {
    resumeGame(game);
    updateUi();
    focusGame();
  }
  helpWasPlaying = false;
});

if (!document.fullscreenEnabled) {
  $("fullscreen-button").hidden = true;
  document.querySelector(".toolbar-divider").hidden = true;
}
$("fullscreen-button").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("game").requestFullscreen();
  } catch (error) {
    console.warn("Fullscreen request was not available:", error);
    toast("Fullscreen isn't available here. You can keep playing in this window.");
  }
});
document.addEventListener("fullscreenchange", () => {
  $("fullscreen-button").setAttribute("aria-label", document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen");
});
updateSoundButton();
updateTouchVisibility();
updateUi();

function updateTimer() {
  const text = formatTime(runMs(game.levelTime));
  if (text === shownTimer) return;
  shownTimer = text;
  $("run-timer").textContent = text;
}

let previousTime = performance.now();
let accumulator = 0;
function frame(now) {
  const delta = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  if (game.status === "playing") {
    accumulator += delta;
    while (accumulator >= 1 / 120) {
      const held = touchInput(touch);
      const key = (action) => [...heldKeys].some((code) => controlMap[code] === action);
      stepGame(game, { left: key("left") || held.left, right: key("right") || held.right, jumpHeld: key("jump") || held.jumpHeld, jumpPressed: jumpQueued }, 1 / 120);
      jumpQueued = false;
      accumulator -= 1 / 120;
    }
  } else accumulator = 0;
  processEvents();
  updateUi();
  updateTimer();
  renderer.render(game, now / 1000, delta, reducedMotion.matches);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
