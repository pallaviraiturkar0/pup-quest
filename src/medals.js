// Time trials: per-trail best times and paw medals, kept free of the DOM so they run under node tests.
// Best times are saved as JSON under `pup-quest:best-times`, mapping trail numbers ("1", "2", …) to
// whole milliseconds, e.g. {"1":19420,"3":25110}. Trails never cleared are simply absent.

export const BEST_TIMES_KEY = "best-times";
export const MEDALS = Object.freeze(["gold", "silver", "bronze"]);
export const MEDAL_LABELS = Object.freeze({ gold: "Gold paw", silver: "Silver paw", bronze: "Bronze paw" });
// Anything slower than a day is treated as corrupt rather than a real run.
export const MAX_TIME_MS = 24 * 60 * 60 * 1000;

// The engine's levelTime only advances while a trail is being played, so pauses never count.
export function runMs(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
}

function validMs(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIME_MS;
}

// The best medal whose par time (in seconds) the run meets, or null when it beats none.
export function medalFor(ms, par) {
  if (!validMs(ms) || !par) return null;
  return MEDALS.find((medal) => ms <= par[medal] * 1000) ?? null;
}

// The next medal to chase and its par in milliseconds, or null once gold is won.
export function nextMedal(ms, par) {
  const medal = medalFor(ms, par);
  const index = medal ? MEDALS.indexOf(medal) : MEDALS.length;
  if (index === 0) return null;
  const target = MEDALS[index - 1];
  return { medal: target, ms: par[target] * 1000 };
}

// Missing, unreadable, or tampered data never throws: bad entries are dropped one by one.
export function parseBestTimes(raw, total) {
  const times = Array(total).fill(null);
  if (typeof raw !== "string" || raw === "") return times;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return times;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return times;
  for (let index = 0; index < total; index += 1) {
    const value = Object.hasOwn(data, String(index + 1)) ? data[String(index + 1)] : null;
    if (validMs(value)) times[index] = value;
  }
  return times;
}

export function serializeBestTimes(times) {
  const data = {};
  times.forEach((ms, index) => { if (validMs(ms)) data[String(index + 1)] = ms; });
  return JSON.stringify(data);
}

// Another tab may have saved faster runs since this one loaded; the faster time wins per trail.
export function mergeBestTimes(current, raw, total) {
  const saved = parseBestTimes(raw, total);
  return saved.map((ms, index) => {
    const mine = validMs(current[index]) ? current[index] : null;
    if (ms === null) return mine;
    return mine === null ? ms : Math.min(mine, ms);
  });
}

// The step that must run under the cross-tab lock: fold the stored times into this tab's, return what to write.
export function commitBestTimes(current, raw, total) {
  const times = mergeBestTimes(current, raw, total);
  return { times, raw: serializeBestTimes(times) };
}

// Runs `task` while holding a Web Lock so tabs take turns saving. Browsers without the
// Web Locks API (or that refuse the request) fall back to running it straight away.
export function withSaveLock(locks, name, task) {
  if (typeof locks?.request !== "function") return Promise.resolve().then(task);
  let ran = false;
  return Promise.resolve()
    .then(() => locks.request(name, () => { ran = true; return task(); }))
    .catch((error) => {
      if (ran) throw error;
      return task();
    });
}

// Records a cleared run. A tie is not a new best; the first clear of a trail is.
export function recordBestTime(times, index, ms) {
  const previous = validMs(times[index]) ? times[index] : null;
  const newBest = validMs(ms) && (previous === null || ms < previous);
  const next = [...times];
  if (newBest) next[index] = ms;
  return { times: next, previous, best: next[index] ?? null, newBest };
}

const pad = (value, size = 2) => String(value).padStart(size, "0");

// m:ss.cc, rounded down to the hundredth so a shown time is never faster than the real one.
export function formatTime(ms) {
  const hundredths = Math.floor(Math.max(0, ms) / 10);
  return `${Math.floor(hundredths / 6000)}:${pad(Math.floor(hundredths / 100) % 60)}.${pad(hundredths % 100)}`;
}

export function spokenTime(ms) {
  const hundredths = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = `${Math.floor(hundredths / 100) % 60}.${pad(hundredths % 100)} seconds`;
  return minutes ? `${minutes} ${minutes === 1 ? "minute" : "minutes"} ${seconds}` : seconds;
}

export const MEDAL_COLORS = Object.freeze({
  gold: { fill: "#f2c14e", ring: "#7c5a12", ink: "#3b2f17" },
  silver: { fill: "#d6dce1", ring: "#56616a", ink: "#2f3438" },
  bronze: { fill: "#e3a46a", ring: "#77441b", ink: "#3a2412" },
});

// A pixel-art paw on an octagonal medal, drawn as inline SVG (no image files).
export function medalSvg(medal, className = "medal") {
  const colors = MEDAL_COLORS[medal];
  if (!colors) return "";
  return `<svg class="${className} ${medal}" viewBox="0 0 12 12" aria-hidden="true" focusable="false" shape-rendering="crispEdges">`
    + `<path d="M4 0h4l4 4v4l-4 4H4L0 8V4Z" fill="${colors.ring}"/>`
    + `<path d="M4 1h4l3 3v4l-3 3H4L1 8V4Z" fill="${colors.fill}"/>`
    + `<path d="M3 4h1v1H3Zm2-1h2v1H5Zm3 1h1v1H8ZM5 6h2v1h1v2H4V7h1Z" fill="${colors.ink}"/>`
    + "</svg>";
}
