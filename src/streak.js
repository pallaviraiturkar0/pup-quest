// Daily Walk streaks: how many UTC days in a row the player has finished the Daily Walk.
// DOM-free so node tests can check it. Saved as JSON under `pup-quest:daily-streak`, e.g.
// {"current":3,"best":7,"last":"2026-11-12","runs":[["2026-10-20","2026-10-26"],["2026-11-10","2026-11-12"]]}.
// `runs` lists walked days as inclusive ranges of consecutive days. Only runs that end within the
// last STREAK_DAYS_KEPT days are kept, but a kept run remembers where it began, so long streaks
// (and a late walk that joins two of them) still count in full.

export const DAILY_STREAK_KEY = "daily-streak";
export const STREAK_DAYS_KEPT = 60;
export const CALENDAR_DAYS = 14;
export const STREAK_BADGE_DAYS = 7;

const DAY_MS = 864e5;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (dateKey) => Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS;

// A real "YYYY-MM-DD" calendar date (so "2026-02-30" is rejected).
export function validDateKey(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function shiftDateKey(dateKey, days) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const runLength = ([from, to]) => dayNumber(to) - dayNumber(from) + 1;
const count = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);

// Sorts runs, joins overlapping or back-to-back ones, and drops runs that ended before the kept window.
// The run ending the day before the window stays, so a late walk on the window's oldest day can still join it.
function tidyRuns(runs) {
  const merged = [];
  for (const [from, to] of [...runs].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const previous = merged.at(-1);
    if (previous && from <= shiftDateKey(previous[1], 1)) {
      if (to > previous[1]) previous[1] = to;
    } else merged.push([from, to]);
  }
  const oldest = merged.length ? shiftDateKey(merged.at(-1)[1], -STREAK_DAYS_KEPT) : "";
  return merged.filter(([, to]) => to >= oldest);
}

function stateFrom(runs, savedBest) {
  if (!runs.length) return EMPTY_STREAK;
  const current = runLength(runs.at(-1));
  return { current, best: Math.max(count(savedBest), ...runs.map(runLength)), last: runs.at(-1)[1], runs };
}

export const EMPTY_STREAK = Object.freeze({ current: 0, best: 0, last: null, runs: Object.freeze([]) });

// Reads a saved streak. Missing, unreadable or nonsense data becomes an empty streak; partly valid
// data keeps whatever still makes sense. Counts are always re-derived from the saved runs.
export function parseStreak(raw) {
  if (typeof raw !== "string" || raw === "") return EMPTY_STREAK;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_STREAK;
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.runs)) return EMPTY_STREAK;
  const runs = data.runs.filter((run) => Array.isArray(run) && run.length === 2 && run.every(validDateKey) && run[0] <= run[1]);
  return stateFrom(tidyRuns(runs.map(([from, to]) => [from, to])), data.best);
}

// The streak still alive today: one that ended today or yesterday (so it isn't lost before the
// player has walked today). A last day after today (another tab or a clock that ran ahead) also counts.
export function activeStreak(state, today) {
  return state.last && state.last >= shiftDateKey(today, -1) ? state.current : 0;
}

export function walkedOn(state, dateKey) {
  return state.runs.some(([from, to]) => dateKey >= from && dateKey <= to);
}

// Records a finished Daily Walk for `dateKey` against the saved data (which another tab may have
// changed). Returns the new and previous state, whether the day was new, and the JSON to save (null: leave it).
// A walk begun before midnight that finished after a later day was saved can still join two runs.
export function commitStreak(raw, dateKey) {
  const state = parseStreak(raw);
  const tooOld = state.last && dateKey < shiftDateKey(state.last, 1 - STREAK_DAYS_KEPT);
  if (!validDateKey(dateKey) || tooOld || walkedOn(state, dateKey)) return { state, previous: state, added: false, raw: null };
  const next = stateFrom(tidyRuns([...state.runs.map(([from, to]) => [from, to]), [dateKey, dateKey]]), state.best);
  return { state: next, previous: state, added: true, raw: JSON.stringify(next) };
}

// The last `length` UTC days ending today, oldest first, each marked if the walk was finished.
export function streakCalendar(state, today, length = CALENDAR_DAYS) {
  return Array.from({ length }, (_, index) => {
    const date = shiftDateKey(today, index - length + 1);
    return { date, done: walkedOn(state, date), today: date === today };
  });
}
