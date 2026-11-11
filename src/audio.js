// Procedural sound effects. Every sound is a small "recipe" of voices built
// from plain data, so recipes can be tested in node. The Web Audio API is only
// touched through the adapter in `scheduleRecipe` and the Sound class below.

export const SOUND_KEY = "sound";
export const MASTER_VOLUME = 0.5;
// How long after a gesture's resume() call sounds may still be scheduled while
// the context finishes waking up.
export const RESUME_GRACE_MS = 300;

// A voice is one oscillator (or noise burst) with a pitch sweep and a quick
// attack/decay envelope. Times are seconds from the start of the sound.
const voice = (wave, from, to, at, duration, gain = 0.05) => ({ wave, from, to, at, duration, gain });
const notes = (wave, frequencies, step, gain) => frequencies.map((frequency, index) => voice(wave, frequency, frequency, index * step, step + 0.02, gain));

// "Woof": a sawtooth that drops in pitch, roughened with a little breath noise.
const bark = (at, pitch = 1, gain = 0.07) => [
  voice("sawtooth", 560 * pitch, 190 * pitch, at, 0.1, gain),
  voice("square", 280 * pitch, 120 * pitch, at + 0.005, 0.09, gain * 0.5),
  voice("noise", 1, 1, at, 0.05, gain * 0.35),
];

export const SOUND_RECIPES = Object.freeze({
  jump: [voice("square", 300, 640, 0, 0.12, 0.04)],
  // A springy "boing" off a hay bale: a jump sound that wobbles up twice as far.
  "hay-jump": [voice("sine", 180, 720, 0, 0.18, 0.06), voice("square", 300, 900, 0.03, 0.14, 0.025)],
  land: [voice("sine", 140, 60, 0, 0.07, 0.05), voice("noise", 1, 1, 0, 0.03, 0.012)],
  treat: [voice("triangle", 988, 988, 0, 0.06, 0.06), voice("triangle", 1480, 1480, 0.055, 0.12, 0.06)],
  key: notes("square", [523, 659, 784, 1046], 0.07, 0.035),
  checkpoint: notes("triangle", [392, 523, 659], 0.08, 0.06),
  stomp: [voice("sine", 180, 60, 0, 0.08, 0.06), ...bark(0.02), ...bark(0.15, 0.85, 0.055)],
  powerup: [...notes("square", [523, 659, 784, 1046, 1318], 0.05, 0.03), voice("sine", 400, 1600, 0, 0.3, 0.03)],
  hurt: [voice("sawtooth", 360, 90, 0, 0.3, 0.05), voice("triangle", 240, 70, 0.04, 0.28, 0.05)],
  start: notes("square", [330, 440, 554, 660], 0.08, 0.03),
  "level-complete": [...notes("square", [523, 659, 784, 1046, 1318], 0.09, 0.035), ...bark(0.5, 1.15, 0.06)],
  "game-over": notes("triangle", [330, 294, 247, 196], 0.14, 0.06),
  won: [...notes("square", [523, 659, 784, 1046, 784, 1046, 1318], 0.1, 0.035), ...bark(0.75, 1.2, 0.06), ...bark(0.9, 1.25, 0.06)],
  // The Mega-Vac whirs up, clangs into walls, and powers down with a falling whine.
  "boss-wake": [voice("sawtooth", 70, 220, 0, 0.6, 0.035), voice("noise", 1, 1, 0.1, 0.4, 0.015)],
  "boss-crash": [voice("square", 120, 45, 0, 0.18, 0.06), voice("noise", 1, 1, 0, 0.12, 0.04)],
  "boss-bonk": [voice("triangle", 880, 620, 0, 0.08, 0.04)],
  "boss-hit": [voice("square", 220, 90, 0, 0.16, 0.05), ...bark(0.06, 1.1), voice("triangle", 1046, 1318, 0.18, 0.1, 0.04)],
  "boss-defeated": [voice("sawtooth", 440, 50, 0, 0.9, 0.04), ...notes("square", [784, 988, 1175, 1568], 0.08, 0.03).map((part) => ({ ...part, at: part.at + 0.6 })), ...bark(1, 1.2, 0.06)],
  // The Grumpy Yeti growls, whooshes snowballs, thuds the ice, slips with a slide whistle,
  // and turns friendly with a deep, happy "WOOF".
  "yeti-wake": [voice("sawtooth", 110, 70, 0, 0.5, 0.04), voice("noise", 1, 1, 0.05, 0.4, 0.02)],
  "yeti-aim": [voice("sawtooth", 90, 130, 0, 0.25, 0.03)],
  "yeti-throw": [voice("noise", 1, 1, 0, 0.14, 0.03), voice("sine", 500, 260, 0, 0.14, 0.03)],
  "yeti-crouch": [voice("square", 330, 330, 0, 0.1, 0.03), voice("square", 247, 247, 0.14, 0.12, 0.03)],
  "yeti-return": [voice("square", 247, 247, 0, 0.1, 0.03), voice("square", 330, 330, 0.14, 0.12, 0.03)],
  "yeti-quake": [voice("sine", 90, 30, 0, 0.35, 0.08), voice("noise", 1, 1, 0, 0.25, 0.04)],
  "yeti-slip": [voice("triangle", 1100, 220, 0, 0.45, 0.05), voice("noise", 1, 1, 0.4, 0.12, 0.04)],
  "snowball-splat": [voice("noise", 1, 1, 0, 0.08, 0.03)],
  "yeti-hit": [voice("sine", 200, 80, 0, 0.14, 0.06), ...bark(0.06, 1.1), voice("triangle", 1046, 1318, 0.18, 0.1, 0.04)],
  "yeti-befriended": [...bark(0, 0.55, 0.08), ...notes("square", [523, 659, 784, 1046, 1318], 0.08, 0.03).map((part) => ({ ...part, at: part.at + 0.2 })), ...bark(0.7, 1.2, 0.06)],
});

export function soundRecipe(type) {
  return SOUND_RECIPES[type] ?? null;
}

export function recipeDuration(recipe) {
  return recipe.reduce((end, part) => Math.max(end, part.at + part.duration), 0);
}

let noiseBuffer = null;
function whiteNoise(context, random) {
  if (noiseBuffer?.context === context) return noiseBuffer.buffer;
  const length = Math.max(1, Math.floor(context.sampleRate * 0.2));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = random() * 2 - 1;
  noiseBuffer = { context, buffer };
  return buffer;
}

// Schedules a recipe on an AudioContext-like object. Returns the number of voices scheduled.
export function scheduleRecipe(context, recipe, destination = context.destination, random = Math.random) {
  const now = context.currentTime;
  for (const part of recipe) {
    const at = now + part.at;
    const end = at + part.duration;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(part.gain, at + Math.min(0.008, part.duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    let source;
    if (part.wave === "noise") {
      source = context.createBufferSource();
      source.buffer = whiteNoise(context, random);
    } else {
      source = context.createOscillator();
      source.type = part.wave;
      source.frequency.setValueAtTime(part.from, at);
      if (part.to !== part.from) source.frequency.exponentialRampToValueAtTime(part.to, end);
    }
    source.connect(gain);
    gain.connect(destination);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(at);
    source.stop(end + 0.02);
  }
  return recipe.length;
}

function defaultContextFactory() {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  return Context ? new Context() : null;
}

// Owns the mute preference and a lazily created AudioContext. Audio only
// starts from `unlock()`, which callers invoke from a user gesture. Every
// failure (no Web Audio, blocked context, storage errors) is swallowed so the
// game keeps running silently.
export class Sound {
  constructor({ createContext = defaultContextFactory, storage = null, now = () => Date.now() } = {}) {
    this.now = now;
    this.createContext = createContext;
    this.storage = storage;
    this.context = null;
    this.master = null;
    this.unavailable = false;
    this.resumeAttempt = 0;
    this.pendingResume = 0;
    this.resumeStartedAt = -Infinity;
    this.muted = this.#read() === "off";
  }

  #read() {
    try { return this.storage?.get(SOUND_KEY) ?? null; } catch { return null; }
  }

  #write(value) {
    try { this.storage?.set(SOUND_KEY, value); } catch { /* preferences are optional */ }
  }

  get running() {
    return this.context?.state === "running";
  }

  get resuming() {
    return this.pendingResume !== 0 && this.now() - this.resumeStartedAt < RESUME_GRACE_MS;
  }

  unlock() {
    if (this.muted || this.unavailable) return false;
    try {
      if (!this.context) {
        this.context = this.createContext();
        if (!this.context) {
          this.unavailable = true;
          return false;
        }
        this.master = this.context.createGain();
        this.master.gain.value = MASTER_VOLUME;
        this.master.connect(this.context.destination);
      }
      // Retry on every gesture while suspended; an earlier attempt may never settle.
      if (this.context.state === "suspended") {
        const attempt = ++this.resumeAttempt;
        const resumed = this.context.resume();
        // The grace window opens once per stretch of pending resumes, so a
        // stream of retries (like held keys) cannot keep extending it.
        if (this.pendingResume === 0) this.resumeStartedAt = this.now();
        this.pendingResume = attempt;
        Promise.resolve(resumed).catch(() => {}).finally(() => {
          if (this.pendingResume === attempt) this.pendingResume = 0;
        });
      }
      return true;
    } catch {
      this.unavailable = true;
      this.context = null;
      this.master = null;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.#write(this.muted ? "off" : "on");
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    if (!this.muted) this.unlock();
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  play(type) {
    const recipe = soundRecipe(type);
    // Just after a gesture's resume() the clock starts moments later, so those
    // sounds still play. A context left suspended (rejected or stuck resume)
    // drops sounds instead of queuing them for a burst on the next gesture.
    if (!recipe || this.muted || !(this.running || this.resuming)) return false;
    try {
      scheduleRecipe(this.context, recipe, this.master);
      return true;
    } catch {
      return false;
    }
  }
}
