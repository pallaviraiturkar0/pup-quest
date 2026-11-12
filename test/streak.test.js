import test from "node:test";
import assert from "node:assert/strict";
import {
  activeStreak, CALENDAR_DAYS, commitStreak, EMPTY_STREAK, parseStreak, shiftDateKey, STREAK_DAYS_KEPT, streakCalendar, validDateKey,
} from "../src/streak.js";

// Plays the Daily Walk on each date in order, saving between walks like the game does.
function walk(dates, raw = null) {
  let saved = raw;
  for (const date of dates) {
    const commit = commitStreak(saved, date);
    if (commit.raw) saved = commit.raw;
  }
  return { saved, state: parseStreak(saved) };
}

const range = (from, length) => Array.from({ length }, (_, index) => shiftDateKey(from, index));

test("consecutive days build a streak and a gap starts a new one but keeps the best", () => {
  assert.deepEqual(walk(range("2026-11-01", 3)).state, { current: 3, best: 3, last: "2026-11-03", days: ["2026-11-01", "2026-11-02", "2026-11-03"] });
  const { state } = walk([...range("2026-11-01", 4), "2026-11-07", "2026-11-08"]);
  assert.equal(state.current, 2);
  assert.equal(state.best, 4);
});

test("replaying the same day doesn't count twice or rewrite the save", () => {
  const { saved } = walk(["2026-11-10", "2026-11-11"]);
  const replay = commitStreak(saved, "2026-11-11");
  assert.equal(replay.added, false);
  assert.equal(replay.raw, null);
  assert.equal(replay.state.current, 2);
});

test("streaks run across month, leap-day and year boundaries", () => {
  assert.equal(walk(["2026-10-30", "2026-10-31", "2026-11-01"]).state.current, 3);
  assert.equal(walk(["2028-02-28", "2028-02-29", "2028-03-01"]).state.current, 3);
  assert.equal(walk(["2027-02-28", "2027-03-01"]).state.current, 2);
  assert.equal(walk(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]).state.current, 4);
});

test("a streak stays alive until a whole UTC day is missed", () => {
  const { state } = walk(["2026-11-10", "2026-11-11"]);
  assert.equal(activeStreak(state, "2026-11-11"), 2);
  assert.equal(activeStreak(state, "2026-11-12"), 2, "not walked yet today");
  assert.equal(activeStreak(state, "2026-11-13"), 0);
  assert.equal(activeStreak(state, "2026-11-09"), 2, "a clock that runs behind keeps the streak");
  assert.equal(activeStreak(EMPTY_STREAK, "2026-11-12"), 0);
});

test("a walk begun before midnight that finishes after a later day was saved fills the gap", () => {
  const { state } = walk(["2026-11-10", "2026-11-12", "2026-11-11"]);
  assert.equal(state.last, "2026-11-12");
  assert.equal(state.current, 3);
  assert.equal(state.best, 3);
});

test("only the most recent days are kept, and longer streaks still count past the window", () => {
  const { saved, state } = walk(range("2026-01-01", 100));
  assert.equal(state.days.length, STREAK_DAYS_KEPT);
  assert.equal(state.days[0], shiftDateKey("2026-01-01", 100 - STREAK_DAYS_KEPT));
  assert.equal(state.current, 100);
  assert.equal(state.best, 100);
  assert.equal(commitStreak(saved, "2026-01-01").added, false, "a day older than the window is ignored");
  assert.equal(walk(["2026-04-11"], saved).state.current, 101);
});

test("missing, blocked or corrupt saves become an empty or repaired streak", () => {
  for (const raw of [null, "", "{", "null", "[]", "42", '"x"', "{}", '{"days":"2026-11-01"}', '{"days":["nope","2026-02-30","2026-13-01"]}']) {
    assert.deepEqual(parseStreak(raw), EMPTY_STREAK, String(raw));
  }
  assert.equal(commitStreak("{", "2026-11-12").state.current, 1);
  // Inflated or mismatched counts are re-derived from the days that can be seen.
  const repaired = parseStreak('{"current":999,"best":-3,"last":"2026-11-12","days":["2026-11-12","2026-11-11","2026-11-11","bad",7]}');
  assert.deepEqual(repaired, { current: 2, best: 2, last: "2026-11-12", days: ["2026-11-11", "2026-11-12"] });
  assert.equal(parseStreak('{"current":2,"best":9,"last":"2026-11-01","days":["2026-11-12"]}').current, 1);
  assert.equal(parseStreak('{"current":1,"best":9,"days":["2026-11-12"]}').best, 9);
  assert.equal(commitStreak(null, "not-a-date").raw, null);
});

test("the calendar shows the last two weeks ending today, with walked days marked", () => {
  const { state } = walk(["2026-12-20", "2026-12-31", "2027-01-02"]);
  const days = streakCalendar(state, "2027-01-02");
  assert.equal(days.length, CALENDAR_DAYS);
  assert.equal(days[0].date, "2026-12-20");
  assert.deepEqual(days.filter((day) => day.done).map((day) => day.date), ["2026-12-20", "2026-12-31", "2027-01-02"]);
  assert.deepEqual(days.filter((day) => day.today).map((day) => day.date), ["2027-01-02"]);
});

test("date keys must be real calendar days", () => {
  assert.ok(validDateKey("2028-02-29"));
  for (const value of ["2027-02-29", "2026-11-1", "2026-11-12T00:00", 20261112, null]) assert.ok(!validDateKey(value), String(value));
});
