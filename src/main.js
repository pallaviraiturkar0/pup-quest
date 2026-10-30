import { createGame, nextLevel, pauseGame, restartGame, resumeGame, startGame, stepGame } from "./engine.js";
import { LEVELS } from "./levels.js";
import { createRenderer } from "./render.js";
import { themeOverrideFromSearch } from "./themes.js";
import { Sound } from "./audio.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game-canvas");
const renderer = createRenderer(canvas, { themeOverride: themeOverrideFromSearch(location.search) });
const sound = new Sound();
export const game = createGame();
const heldKeys = new Set();
const pointers = new Map();
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
let soundRequested = savedPreference("sound") === "on";

const heartMarkup = (empty) => `<svg class="heart${empty ? " empty" : ""}" viewBox="0 0 16 15" aria-hidden="true"><path d="M2 1h4v2h4V1h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2V8H0V3h2Z" fill="currentColor"/></svg>`;
const timeLabel = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function clearInput() {
  heldKeys.clear();
  pointers.clear();
  jumpQueued = false;
  document.querySelectorAll("[data-control]").forEach((button) => button.classList.remove("pressed"));
}

function focusGame() {
  canvas.focus({ preventScroll: true });
}

function updateSoundButton() {
  $("sound-label").textContent = soundRequested ? "Sound on" : "Sound off";
  $("sound-button").setAttribute("aria-pressed", String(soundRequested));
  $("sound-button").querySelector("path").setAttribute("d", soundRequested
    ? "M3 8v4h3l4 3V5L6 8H3Zm10-1a5 5 0 0 1 0 6m2-8a8 8 0 0 1 0 10"
    : "M3 8v4h3l4 3V5L6 8H3Zm10-1 4 6m0-6-4 6");
}

function audioFailed(error) {
  console.warn("Pup Quest audio could not start:", error);
  soundRequested = false;
  sound.enabled = false;
  savedPreference("sound", "off");
  updateSoundButton();
  toast("Sound couldn't start in this browser. The adventure still works.");
}

function unlockAudio() {
  if (soundRequested && !sound.enabled) sound.enable().catch(audioFailed);
  else sound.unlock().catch(audioFailed);
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
    $("objective").textContent = game.keyFound ? "KEY FOUND · FIND YOUR WAY HOME" : "FIND THE GOLDEN KEY. FOLLOW YOUR PAWS.";
    return;
  }
  clearInput();
  const screens = {
    ready: ["HELLO, ADVENTURER", "Ready, player woof?", "The world's a little bigger from down here. Grab some treats. Find the key. Head home.", "Let's play"],
    paused: ["TAKE A LITTLE BREATHER", "Paws for a moment.", "Your adventure will be right here. Good dogs need snack breaks, too.", "Keep exploring"],
    "level-complete": ["ONE TRAIL CLOSER TO HOME", "Look at you go!", `${game.level.name}, conquered. A fresh trail and a little extra heart are waiting.`, "Next trail"],
    "game-over": ["EVERY ADVENTURE TAKES PRACTICE", "A little tumble.", "Even the best dogs miss a jump. Shake it off, wag that tail, and give it another go.", "Try again"],
    won: ["CERTIFIED VERY GOOD DOG", "Home, sweet woof.", "Three trails. A pocket full of treats. And a well-earned nap. Welcome home, Biscuit.", "Play again"],
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
  $("overlay-hint").textContent = matchMedia("(pointer: coarse)").matches
    ? "HOLD AN ARROW + TAP JUMP TO LEAP"
    : game.status === "paused" ? "ESC TO RESUME · R TO RESTART" : "ARROWS TO MOVE · SPACE TO JUMP";
  setResultStats(["level-complete", "game-over", "won"].includes(game.status)
    ? [["TREATS", game.status === "level-complete" ? `${game.levelTreats}/${game.level.treats.length}` : String(game.totalTreats)], ["SCORE", String(game.score)], ["TIME", timeLabel(game.status === "level-complete" ? game.levelTime : game.elapsed)]]
    : []);
  if (game.status !== "ready") {
    announce(`${title} ${description}`);
    $("primary-button").focus({ preventScroll: true });
  }
}

function updateUi() {
  const signature = [game.status, game.levelIndex, game.lives, game.levelTreats, game.keyFound, game.score].join(":");
  if (signature === previousHud) return;
  previousHud = signature;
  $("level-number").textContent = String(game.levelIndex + 1).padStart(2, "0");
  $("level-name").textContent = game.level.name;
  $("treat-count").replaceChildren(document.createTextNode(`${String(game.levelTreats).padStart(2, "0")} `));
  const total = document.createElement("span");
  total.textContent = `/ ${game.level.treats.length}`;
  $("treat-count").append(total);
  $("lives").innerHTML = [0, 1, 2].map((index) => heartMarkup(index >= game.lives)).join("");
  $("lives").setAttribute("aria-label", `${game.lives} ${game.lives === 1 ? "life" : "lives"} remaining`);
  if (game.keyFound) $("objective").textContent = "KEY FOUND · FIND YOUR WAY HOME";
  if (game.score > bestScore) {
    bestScore = game.score;
    savedPreference("best", String(bestScore));
  }
  $("best-score").textContent = String(bestScore).padStart(4, "0");
  document.querySelectorAll("[data-trail]").forEach((trail, index) => {
    const done = index < game.levelIndex || game.status === "won";
    const current = index === game.levelIndex;
    trail.classList.toggle("active", current);
    if (current) trail.setAttribute("aria-current", "step");
    else trail.removeAttribute("aria-current");
    trail.querySelector(".trail-state").textContent = done ? "✓" : current ? "●" : "○";
    trail.querySelector(".trail-state").setAttribute("aria-label", done ? "Completed" : current ? "Current trail" : "Not reached");
  });
  syncOverlay();
}

function processEvents() {
  for (const event of game.events.splice(0)) {
    sound.play(event.type);
    if (["jump", "treat", "key", "stomp", "hurt", "checkpoint"].includes(event.type) && !reducedMotion.matches) {
      renderer.effect(event.type, event.x, event.y);
    }
    if (event.type === "key") toast("Golden key found! The doghouse is open.");
    if (event.type === "checkpoint") toast("Checkpoint! A safe spot for little paws.");
    if (event.type === "need-key") toast("The door is locked. Find the golden key first!");
    if (event.type === "hurt" && game.lives > 0) toast(`Whoops! ${game.lives} ${game.lives === 1 ? "heart" : "hearts"} left. You've got this.`);
    if (event.type === "start") {
      $("toast").hidden = true;
      announce(`Trail ${game.levelIndex + 1} of ${LEVELS.length}: ${game.level.name}. Find the golden key and reach the doghouse.`);
    }
  }
}

function primaryAction() {
  unlockAudio();
  clearInput();
  if (game.status === "ready") startGame(game);
  else if (game.status === "paused") resumeGame(game);
  else if (game.status === "level-complete") nextLevel(game);
  else if (["won", "game-over"].includes(game.status)) restartGame(game);
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

document.querySelectorAll("[data-control]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    if (game.status !== "playing") return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, button.dataset.control);
    if (button.dataset.control === "jump") jumpQueued = true;
    button.classList.add("pressed");
    unlockAudio();
    focusGame();
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    if (![...pointers.values()].includes(button.dataset.control)) button.classList.remove("pressed");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("click", (event) => {
    if (event.detail === 0 && button.dataset.control === "jump" && game.status === "playing") jumpQueued = true;
  });
});

function suspendGame() {
  clearInput();
  pauseGame(game);
  updateUi();
}
window.addEventListener("blur", suspendGame);
document.addEventListener("visibilitychange", () => { if (document.hidden) suspendGame(); });

$("sound-button").addEventListener("click", async () => {
  if (soundRequested) {
    sound.enabled = false;
    soundRequested = false;
    savedPreference("sound", "off");
  } else {
    try {
      await sound.enable();
      soundRequested = true;
      savedPreference("sound", "on");
      sound.play("treat");
    } catch (error) {
      audioFailed(error);
    }
  }
  updateSoundButton();
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
updateUi();

let previousTime = performance.now();
let accumulator = 0;
function frame(now) {
  const delta = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  if (game.status === "playing") {
    accumulator += delta;
    while (accumulator >= 1 / 120) {
      const active = (action) => [...heldKeys].some((key) => controlMap[key] === action) || [...pointers.values()].includes(action);
      stepGame(game, { left: active("left"), right: active("right"), jumpHeld: active("jump"), jumpPressed: jumpQueued }, 1 / 120);
      jumpQueued = false;
      accumulator -= 1 / 120;
    }
  } else accumulator = 0;
  processEvents();
  updateUi();
  renderer.render(game, now / 1000, delta, reducedMotion.matches);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
