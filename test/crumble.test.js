import test from "node:test";
import assert from "node:assert/strict";
import { CRUMBLE, crumbleSolid, makeCrumble, stepCrumble } from "../src/crumble.js";

// Steps a ledge for `seconds`, collecting every change it reports.
function run(crumble, seconds, input = {}) {
  const changes = [];
  for (let t = 0; t < seconds; t += 1 / 120) {
    const change = stepCrumble(crumble, 1 / 120, input);
    if (change) changes.push(change);
  }
  return changes;
}

test("a sandstone ledge holds until paws land, shakes, drops away, then re-forms", () => {
  const ledge = makeCrumble();
  assert.deepEqual(run(ledge, 5), [], "nobody on it: it never crumbles");
  assert.equal(crumbleSolid(ledge), true);
  assert.equal(stepCrumble(ledge, 1 / 120, { standing: true }), "crumble-shake");
  assert.equal(ledge.state, "shaking");
  assert.equal(crumbleSolid(ledge), true, "it still holds while shaking");
  assert.deepEqual(run(ledge, CRUMBLE.delay - 0.05), [], "a short beat to hop off");
  assert.deepEqual(run(ledge, 0.1), ["crumble"]);
  assert.equal(crumbleSolid(ledge), false);
  assert.deepEqual(run(ledge, CRUMBLE.gone - 0.1), [], "it stays gone for a moment");
  assert.deepEqual(run(ledge, 0.2), ["crumble-reform"]);
  assert.deepEqual(ledge, makeCrumble());
});

test("hopping off a shaking ledge does not save it, and it never re-forms around the pup", () => {
  const ledge = makeCrumble();
  stepCrumble(ledge, 1 / 120, { standing: true });
  assert.deepEqual(run(ledge, CRUMBLE.delay + 0.05), ["crumble"], "once it starts shaking it will fall");
  assert.deepEqual(run(ledge, CRUMBLE.gone + 1, { blocked: true }), [], "the pup is in the way");
  assert.equal(ledge.state, "fallen");
  assert.deepEqual(run(ledge, 0.05), ["crumble-reform"]);
});

test("the timings leave room to land and jump again, and plain surfaces are always solid", () => {
  assert.ok(CRUMBLE.delay >= 0.4 && CRUMBLE.delay <= 1, "long enough to react, short enough to keep the pup moving");
  assert.ok(CRUMBLE.gone > CRUMBLE.delay);
  assert.equal(crumbleSolid(undefined), true);
  assert.ok(Object.isFrozen(CRUMBLE));
});
