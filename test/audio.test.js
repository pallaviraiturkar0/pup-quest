import test from "node:test";
import assert from "node:assert/strict";
import { MASTER_VOLUME, RESUME_GRACE_MS, recipeDuration, scheduleRecipe, Sound, SOUND_KEY, SOUND_RECIPES, soundRecipe } from "../src/audio.js";

const param = (log, name) => ({
  value: 1,
  setValueAtTime: (value, at) => log.push([name, "set", value, at]),
  linearRampToValueAtTime: (value, at) => log.push([name, "linear", value, at]),
  exponentialRampToValueAtTime: (value, at) => log.push([name, "exp", value, at]),
});

// Records what would be sent to Web Audio without making any noise.
function fakeContext({ state = "suspended" } = {}) {
  const log = [];
  const node = (kind, extra = {}) => ({
    kind, connect: (target) => log.push(["connect", kind, target?.kind ?? "destination"]), disconnect() {},
    start: (at) => log.push(["start", kind, at]), stop: (at) => log.push(["stop", kind, at]), ...extra,
  });
  const context = {
    log, state, currentTime: 2, sampleRate: 8000, destination: { kind: "destination" }, resumed: 0,
    createGain: () => node("gain", { gain: param(log, "gain") }),
    createOscillator: () => { const osc = node("osc", { frequency: param(log, "freq") }); log.push(["osc"]); return osc; },
    createBufferSource: () => { log.push(["noise"]); return node("noise"); },
    createBuffer: (channels, length) => { const data = new Float32Array(length); return { getChannelData: () => data, data }; },
    resume() { this.resumed += 1; this.state = "running"; return Promise.resolve(); },
  };
  return context;
}

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { data, get: (key) => data[key] ?? null, set: (key, value) => { data[key] = value; } };
};

test("every effect the game asks for has a short, valid recipe", () => {
  for (const type of ["jump", "land", "treat", "key", "checkpoint", "stomp", "powerup", "hurt", "start", "level-complete", "game-over", "won"]) {
    const recipe = soundRecipe(type);
    assert.ok(recipe?.length > 0, `${type} has a sound`);
    assert.ok(recipeDuration(recipe) > 0 && recipeDuration(recipe) < 1.5, `${type} is short`);
    for (const part of recipe) {
      assert.ok(["sine", "square", "sawtooth", "triangle", "noise"].includes(part.wave));
      assert.ok(part.from > 0 && part.to > 0, "exponential ramps need positive frequencies");
      assert.ok(part.gain > 0 && part.gain <= 0.1, "voices stay quiet");
      assert.ok(part.at >= 0 && part.duration > 0);
    }
  }
  assert.equal(soundRecipe("need-key"), null);
});

test("stomping a critter plays a playful falling-pitch bark", () => {
  const barks = SOUND_RECIPES.stomp.filter((part) => part.wave === "sawtooth");
  assert.ok(barks.length >= 2, "woof-woof");
  for (const part of barks) assert.ok(part.to < part.from, "barks drop in pitch");
  assert.ok(SOUND_RECIPES.stomp.some((part) => part.wave === "noise"), "a little breathy texture");
  assert.ok(SOUND_RECIPES.jump[0].to > SOUND_RECIPES.jump[0].from, "jumps rise");
});

test("scheduling a recipe creates one source per voice, offset from the current time", () => {
  const context = fakeContext();
  const count = scheduleRecipe(context, SOUND_RECIPES.stomp, context.destination, () => 0.5);
  assert.equal(count, SOUND_RECIPES.stomp.length);
  const starts = context.log.filter((entry) => entry[0] === "start");
  assert.equal(starts.length, SOUND_RECIPES.stomp.length);
  assert.ok(starts.every(([, , at]) => at >= context.currentTime));
  assert.equal(context.log.filter((entry) => entry[0] === "noise").length, SOUND_RECIPES.stomp.filter((part) => part.wave === "noise").length);
  assert.ok(context.log.some((entry) => entry[0] === "freq" && entry[1] === "exp"), "pitch sweeps");
});

test("audio stays off until a user gesture unlocks it", () => {
  let created = 0;
  const context = fakeContext();
  const sound = new Sound({ createContext: () => { created += 1; return context; }, storage: memoryStorage() });
  assert.equal(sound.muted, false, "sound is on by default");
  assert.equal(sound.play("jump"), false, "nothing plays before a gesture");
  assert.equal(created, 0);
  assert.equal(sound.unlock(), true);
  assert.equal(created, 1);
  assert.equal(context.resumed, 1, "a suspended context is resumed on the gesture");
  assert.equal(sound.play("jump"), true);
  sound.unlock();
  assert.equal(created, 1, "the context is created once");
  assert.ok(context.log.some((entry) => entry[0] === "connect" && entry[1] === "osc" && entry[2] === "gain"));
});

test("muting is remembered and silences playback", () => {
  const storage = memoryStorage();
  const context = fakeContext();
  const sound = new Sound({ createContext: () => context, storage });
  sound.unlock();
  assert.equal(sound.master.gain.value, MASTER_VOLUME);
  assert.equal(sound.toggleMute(), true);
  assert.equal(storage.data[SOUND_KEY], "off");
  assert.equal(sound.master.gain.value, 0);
  assert.equal(sound.play("treat"), false);
  assert.equal(sound.toggleMute(), false);
  assert.equal(storage.data[SOUND_KEY], "on");
  assert.equal(sound.play("treat"), true);

  let created = 0;
  const reloaded = new Sound({ createContext: () => { created += 1; return fakeContext(); }, storage: memoryStorage({ [SOUND_KEY]: "off" }) });
  assert.equal(reloaded.muted, true);
  assert.equal(reloaded.unlock(), false, "a muted game never starts audio");
  assert.equal(created, 0);
});

test("missing or broken Web Audio fails silently", () => {
  const none = new Sound({ createContext: () => null, storage: memoryStorage() });
  assert.equal(none.unlock(), false);
  assert.equal(none.unavailable, true);
  assert.equal(none.play("jump"), false);
  assert.doesNotThrow(() => none.toggleMute());

  const throwing = new Sound({ createContext: () => { throw new Error("blocked"); } });
  assert.doesNotThrow(() => throwing.unlock());
  assert.equal(throwing.play("stomp"), false);


  const broken = fakeContext({ state: "running" });
  broken.createOscillator = () => { throw new Error("nope"); };
  const fragile = new Sound({ createContext: () => broken });
  fragile.unlock();
  assert.equal(fragile.play("jump"), false);

  const badStorage = { get() { throw new Error("denied"); }, set() { throw new Error("denied"); } };
  const unsaved = new Sound({ createContext: () => fakeContext(), storage: badStorage });
  assert.equal(unsaved.muted, false);
  assert.doesNotThrow(() => unsaved.toggleMute());

  const original = globalThis.AudioContext;
  delete globalThis.AudioContext;
  try {
    const defaults = new Sound();
    assert.equal(defaults.unlock(), false, "node has no AudioContext");
  } finally {
    if (original) globalThis.AudioContext = original;
  }
});

test("a context that stays suspended drops sounds instead of queuing them", async () => {
  const context = fakeContext();
  context.resume = () => Promise.reject(new Error("not allowed"));
  const sound = new Sound({ createContext: () => context });
  assert.equal(sound.unlock(), true);
  assert.equal(sound.play("start"), true, "the gesture's own sound is scheduled while resume is pending");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sound.resuming, false);
  assert.equal(context.state, "suspended");
  const scheduled = context.log.filter((entry) => entry[0] === "start").length;
  for (const type of ["jump", "treat", "stomp", "hurt"]) assert.equal(sound.play(type), false, `${type} is dropped`);
  assert.equal(context.log.filter((entry) => entry[0] === "start").length, scheduled, "nothing piles up on the stopped clock");

  context.resume = function resume() { this.state = "running"; return Promise.resolve(); };
  sound.unlock();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sound.play("jump"), true, "a later gesture that resumes audio brings sound back");
});

test("a closed context never plays", () => {
  const context = fakeContext({ state: "closed" });
  const sound = new Sound({ createContext: () => context });
  sound.unlock();
  assert.equal(sound.play("jump"), false);
});

test("a resume that never settles is retried on the next gesture and cannot queue sounds forever", async () => {
  let clock = 1000;
  const context = fakeContext();
  let calls = 0;
  context.resume = () => { calls += 1; return new Promise(() => {}); };
  const sound = new Sound({ createContext: () => context, now: () => clock });
  sound.unlock();
  assert.equal(sound.play("start"), true, "the gesture's sound is scheduled during the grace window");
  clock += RESUME_GRACE_MS + 1;
  assert.equal(sound.resuming, false);
  assert.equal(sound.play("jump"), false, "a stuck resume stops scheduling after the grace window");

  context.resume = function resume() { calls += 1; this.state = "running"; return Promise.resolve(); };
  sound.unlock();
  assert.equal(calls, 2, "the next gesture retries even though the first resume is still pending");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sound.running, true);
  assert.equal(sound.pendingResume, 0);
  assert.equal(sound.play("jump"), true);
});

test("an older resume settling does not clear a newer pending attempt", async () => {
  let settleFirst;
  const context = fakeContext();
  const pending = [new Promise((resolve) => { settleFirst = resolve; }), new Promise(() => {})];
  context.resume = () => pending.shift();
  const sound = new Sound({ createContext: () => context, now: () => 0 });
  sound.unlock();
  sound.unlock();
  settleFirst();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sound.pendingResume, 2);
  assert.equal(sound.resuming, true);
});

test("repeated gestures during a stuck resume do not extend the grace window", () => {
  let clock = 0;
  const context = fakeContext();
  let calls = 0;
  context.resume = () => { calls += 1; return new Promise(() => {}); };
  const sound = new Sound({ createContext: () => context, now: () => clock });
  sound.unlock();
  for (let i = 0; i < 10; i += 1) {
    clock += RESUME_GRACE_MS / 2;
    sound.unlock();
  }
  assert.equal(calls, 11, "each gesture still retries");
  assert.equal(sound.resuming, false);
  const scheduled = context.log.filter((entry) => entry[0] === "start").length;
  assert.equal(sound.play("jump"), false);
  assert.equal(context.log.filter((entry) => entry[0] === "start").length, scheduled, "nothing accumulates on the stopped clock");
});
