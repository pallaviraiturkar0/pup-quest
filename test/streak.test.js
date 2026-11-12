import test from "node:test";
import assert from "node:assert/strict";
import {
  activeStreak, CALENDAR_DAYS, commitStreak, EMPTY_STREAK, parseStreak, shiftDateKey, STREAK_DAYS_KEPT, streakCalendar, validDateKey, walkedOn,
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
  assert.deepEqual(walk(range("2026-11-01", 3)).state, { current: 3, best: 3, last: "2026-11-03", runs: [["2026-11-01", "2026-11-03"]] });
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
  assert.equal(walk(["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-02"]).state.best, 3, "a filled gap behind the latest day can set the best");
});

test("only recent runs are kept, and long streaks count in full past the window", () => {
  const { saved, state } = walk(range("2026-01-01", 100));
  assert.deepEqual(state.runs, [["2026-01-01", "2026-04-10"]]);
  assert.equal(state.current, 100);
  assert.equal(state.best, 100);
  assert.equal(walk(["2026-04-11"], saved).state.current, 101);
  // A late walk that joins a long run to a newer one restores the whole streak.
  const joined = walk(["2026-04-12", "2026-04-11"], saved).state;
  assert.equal(joined.current, 102);
  assert.equal(joined.best, 102);
  // Walking the window's oldest day late still joins the run that ended just before it.
  const boundary = walk([...range("2026-04-12", 59), "2026-04-11"], saved).state;
  assert.equal(boundary.current, 160);
  assert.equal(boundary.best, 160);
  const later = walk(["2026-07-01", "2026-07-02"], saved);
  assert.deepEqual(later.state.runs, [["2026-07-01", "2026-07-02"]], "runs that ended before the window are dropped");
  assert.equal(later.state.best, 100, "the best survives");
  assert.equal(commitStreak(later.saved, shiftDateKey("2026-07-02", -STREAK_DAYS_KEPT)).added, false, "a day older than the window is ignored");
  assert.equal(commitStreak(later.saved, shiftDateKey("2026-07-02", 1 - STREAK_DAYS_KEPT)).added, true);
});

test("missing, blocked or corrupt saves become an empty or repaired streak", () => {
  for (const raw of [null, "", "{", "null", "[]", "42", '"x"', "{}", '{"runs":"2026-11-01"}', '{"runs":[["nope","2026-11-01"],["2026-02-30","2026-03-01"],["2026-11-05","2026-11-01"],["2026-11-01"]]}']) {
    assert.deepEqual(parseStreak(raw), EMPTY_STREAK, String(raw));
  }
  assert.equal(commitStreak("{", "2026-11-12").state.current, 1);
  // Inflated, missing or mismatched counts are re-derived from the runs; overlapping runs are joined.
  const repaired = parseStreak('{"current":999,"best":-3,"last":"2027-01-01","runs":[["2026-11-11","2026-11-12"],["2026-11-01","2026-11-04"],["2026-11-12","2026-11-12"],"bad",7]}');
  assert.deepEqual(repaired, { current: 2, best: 4, last: "2026-11-12", runs: [["2026-11-01", "2026-11-04"], ["2026-11-11", "2026-11-12"]] });
  assert.equal(parseStreak('{"best":9,"runs":[["2026-11-12","2026-11-12"]]}').best, 9);
  assert.equal(commitStreak(null, "not-a-date").raw, null);
});

test("the calendar shows the last two weeks ending today, with walked days marked", () => {
  const { state } = walk(["2026-12-20", "2026-12-31", "2027-01-02"]);
  const days = streakCalendar(state, "2027-01-02");
  assert.equal(days.length, CALENDAR_DAYS);
  assert.equal(days[0].date, "2026-12-20");
  assert.deepEqual(days.filter((day) => day.done).map((day) => day.date), ["2026-12-20", "2026-12-31", "2027-01-02"]);
  assert.deepEqual(days.filter((day) => day.today).map((day) => day.date), ["2027-01-02"]);
  assert.ok(walkedOn(state, "2026-12-31") && !walkedOn(state, "2027-01-01"));
});

test("date keys must be real calendar days", () => {
  assert.ok(validDateKey("2028-02-29"));
  for (const value of ["2027-02-29", "2026-11-1", "2026-11-12T00:00", 20261112, null]) assert.ok(!validDateKey(value), String(value));
});
