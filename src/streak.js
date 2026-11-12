// Daily Walk streaks: how many UTC days in a row the player has finished the Daily Walk.
// DOM-free so node tests can check it. Saved as JSON under `pup-quest:daily-streak`, e.g.
// {"current":3,"best":7,"last":"2026-11-12","days":["2026-11-01",…,"2026-11-12"]}.
// `days` keeps only the most recent STREAK_DAYS_KEPT completions; `current` and `best` carry
// longer streaks past that window.

export const DAILY_STREAK_KEY = "daily-streak";
export const STREAK_DAYS_KEPT = 60;
export const CALENDAR_DAYS = 14;
export const STREAK_BADGE_DAYS = 7;

const DAY_MS = 864e5;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A real "YYYY-MM-DD" calendar date (so "2026-02-30" is rejected).
export function validDateKey(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function shiftDateKey(dateKey, days) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const count = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);

// Length of the unbroken run of days in `set` ending at `dateKey`.
function runEndingAt(set, dateKey) {
  let length = 0;
  for (let day = dateKey; set.has(day); day = shiftDateKey(day, -1)) length += 1;
  return length;
}

export const EMPTY_STREAK = Object.freeze({ current: 0, best: 0, last: null, days: Object.freeze([]) });

// Reads a saved streak. Missing, unreadable or nonsense data becomes an empty streak; partly
// valid data keeps whatever still makes sense (bad dates are dropped, counts are re-derived).
export function parseStreak(raw) {
  if (typeof raw !== "string" || raw === "") return EMPTY_STREAK;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_STREAK;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return EMPTY_STREAK;
  const days = [...new Set(Array.isArray(data.days) ? data.days.filter(validDateKey) : [])].sort().slice(-STREAK_DAYS_KEPT);
  const last = days.at(-1) ?? null;
  if (!last) return EMPTY_STREAK;
  // The saved count can only be longer than the run we can see when that run fills the kept window.
  const run = runEndingAt(new Set(days), last);
  const current = data.last === last && run === STREAK_DAYS_KEPT ? Math.max(run, count(data.current)) : run;
  return { current, best: Math.max(current, count(data.best)), last, days };
}

// The streak still alive today: one that ended today or yesterday (so it isn't lost before the
// player has walked today). A last day after today (another tab or a clock that ran ahead) also counts.
export function activeStreak(state, today) {
  return state.last && state.last >= shiftDateKey(today, -1) ? state.current : 0;
}

// Records a finished Daily Walk for `dateKey` against the saved data (which another tab may have
// changed). Returns the new state, whether the day was new, and the JSON to save (null: leave it).
export function commitStreak(raw, dateKey) {
  const state = parseStreak(raw);
  if (!validDateKey(dateKey) || state.days.includes(dateKey)) return { state, added: false, raw: null };
  const days = [...state.days, dateKey].sort().slice(-STREAK_DAYS_KEPT);
  // A day older than the whole kept window can't change the streak.
  if (!days.includes(dateKey)) return { state, added: false, raw: null };
  const set = new Set(days);
  let { current, last } = state;
  if (!last || dateKey > last) {
    current = last === shiftDateKey(dateKey, -1) ? current + 1 : runEndingAt(set, dateKey);
    last = dateKey;
  } else {
    // A walk begun before midnight that finished after a later day was saved can fill a gap.
    current = Math.max(current, runEndingAt(set, last));
  }
  const next = { current, best: Math.max(state.best, current), last, days };
  return { state: next, added: true, raw: JSON.stringify(next) };
}

// The last `length` UTC days ending today, oldest first, each marked if the walk was finished.
export function streakCalendar(state, today, length = CALENDAR_DAYS) {
  const done = new Set(state.days);
  return Array.from({ length }, (_, index) => {
    const date = shiftDateKey(today, index - length + 1);
    return { date, done: done.has(date), today: date === today };
  });
}
