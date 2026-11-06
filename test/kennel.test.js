import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseSkin, DEFAULT_SKIN, drawPup, EAR_STYLES, getSkin, isSkinUnlocked, medalSummary, moveSkinFocus, PALETTE_KEYS, requirementText,
  resolveSkin, SKIN_KEY, SKINS, skinProgress, SPRITE_HEIGHT, SPRITE_WIDTH, TAIL_STYLES, unlockedSkinIds,
} from "../src/kennel.js";
import { MEDALS } from "../src/medals.js";
import { LEVELS } from "../src/levels.js";
import { contrastRatio } from "../src/trailmap.js";

const TOTAL = LEVELS.length;
// A best time (ms) that earns exactly `medal` on trail `index`.
const timeFor = (index, medal) => LEVELS[index].par[medal] * 1000;
const times = (entries = {}) => Array.from({ length: TOTAL }, (_, index) => (entries[index] ? timeFor(index, entries[index]) : null));
const ids = (best) => unlockedSkinIds(best, LEVELS);

test("skin data is valid: unique ids, known styles, full hex palettes, and in-bounds markings", () => {
  assert.ok(SKINS.length >= 4 && SKINS.length <= 6);
  assert.equal(new Set(SKINS.map((skin) => skin.id)).size, SKINS.length);
  assert.equal(SKINS.filter((skin) => skin.unlock === null).map((skin) => skin.id).join(), DEFAULT_SKIN, "only the default is always open");
  for (const skin of SKINS) {
    assert.match(skin.id, /^[a-z]+$/);
    assert.ok(skin.name && skin.breed, `${skin.id} has a name and breed`);
    assert.ok(EAR_STYLES.includes(skin.ears), `${skin.id} ears`);
    assert.ok(TAIL_STYLES.includes(skin.tail), `${skin.id} tail`);
    assert.deepEqual(Object.keys(skin.palette).sort(), [...PALETTE_KEYS].sort(), `${skin.id} palette keys`);
    for (const color of Object.values(skin.palette)) assert.match(color, /^#[0-9a-f]{6}$/);
    assert.ok(contrastRatio(skin.palette.outline, skin.palette.fur) >= 1.8, `${skin.id} outline stands out from its fur`);
    for (const [x, y, w, h] of skin.markings) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= SPRITE_WIDTH && y + h <= SPRITE_HEIGHT, `${skin.id} marking in bounds`);
    }
    if (skin.unlock) {
      assert.ok(MEDALS.includes(skin.unlock.medal), `${skin.id} medal`);
      const { count, trail } = skin.unlock;
      assert.ok((count === undefined) !== (trail === undefined), `${skin.id} needs exactly one of count or trail`);
      if (trail !== undefined) assert.ok(Number.isInteger(trail) && trail >= 1 && trail <= TOTAL);
      if (count !== undefined) assert.ok(count === "all" || (Number.isInteger(count) && count >= 1 && count <= TOTAL));
    }
  }
  assert.equal(new Set(SKINS.map((skin) => skin.palette.fur)).size, SKINS.length, "every coat has its own fur colour");
});

test("every skin draws inside the sprite box and looks different from the others", () => {
  const signatures = new Set();
  for (const skin of SKINS) {
    for (const options of [{ tailY: 8 }, { tailY: 10, step: 1 }, { tailY: 9, airborne: true }]) {
      const calls = [];
      drawPup((x, y, w, h, color) => calls.push([x, y, w, h, color]), skin, options);
      for (const [x, y, w, h, color] of calls) {
        assert.ok(x >= 0 && y >= 0 && x + w <= SPRITE_WIDTH && y + h <= SPRITE_HEIGHT, `${skin.id} draws in bounds: ${[x, y, w, h]}`);
        assert.match(color, /^#[0-9a-f]{6}$/);
      }
      if (options.tailY === 8) signatures.add(JSON.stringify(calls));
    }
  }
  assert.equal(signatures.size, SKINS.length);
});

test("medals count toward lower tiers: gold is also silver and bronze", () => {
  const { perTrail, counts } = medalSummary(times({ 0: "gold", 1: "silver", 2: "bronze" }), LEVELS);
  assert.deepEqual(perTrail.slice(0, 4), ["gold", "silver", "bronze", null]);
  assert.deepEqual(counts, { gold: 1, silver: 2, bronze: 3 });
  const slow = times();
  slow[0] = timeFor(0, "bronze") + 1;
  assert.deepEqual(medalSummary(slow, LEVELS).counts, { gold: 0, silver: 0, bronze: 0 }, "a clear without a medal earns nothing");
});

test("unlock rules follow earned medals", () => {
  assert.deepEqual(ids(times()), [DEFAULT_SKIN], "a fresh save only has the default pup");
  assert.deepEqual(ids(undefined), [DEFAULT_SKIN]);
  assert.deepEqual(ids(times({ 3: "bronze" })), ["corgi", "dalmatian"]);
  assert.deepEqual(ids(times({ 0: "silver", 1: "silver" })), ["corgi", "dalmatian"], "two silvers are not three");
  assert.deepEqual(ids(times({ 0: "silver", 1: "gold", 2: "silver" })), ["corgi", "dalmatian", "pug", "beagle"]);
  assert.ok(!isSkinUnlocked(getSkin("husky"), times({ 0: "gold", 1: "gold", 2: "gold", 3: "gold", 4: "gold", 5: "gold" }), LEVELS), "husky needs Trail 07");
  assert.ok(!isSkinUnlocked(getSkin("husky"), times({ 6: "silver" }), LEVELS));
  assert.ok(isSkinUnlocked(getSkin("husky"), times({ 6: "gold" }), LEVELS));
  const allGold = times(Object.fromEntries(LEVELS.map((_, index) => [index, "gold"])));
  assert.deepEqual(ids(allGold), SKINS.map((skin) => skin.id), "all golds unlock every pup");
  const almost = [...allGold];
  almost[2] = timeFor(2, "silver");
  assert.ok(!ids(almost).includes("golden"));
  assert.deepEqual(skinProgress(getSkin("golden"), almost, LEVELS), { have: TOTAL - 1, need: TOTAL, unlocked: false });
  assert.deepEqual(skinProgress(getSkin("pug"), times({ 0: "gold" }), LEVELS), { have: 1, need: 3, unlocked: false });
});

test("requirements are spelled out for locked pups", () => {
  assert.equal(requirementText(getSkin("corgi"), LEVELS), "Always in the kennel");
  assert.equal(requirementText(getSkin("dalmatian"), LEVELS), "Earn a bronze paw or better on any trail");
  assert.equal(requirementText(getSkin("pug"), LEVELS), "Earn silver paws or better on 3 trails");
  assert.equal(requirementText(getSkin("husky"), LEVELS), `Earn a gold paw on Trail 07 ${LEVELS[6].name}`);
  assert.equal(requirementText(getSkin("golden"), LEVELS), `Earn gold paws on all ${TOTAL} trails`);
});

test("the saved skin falls back to the default when missing, corrupt, unknown, or locked", () => {
  assert.equal(SKIN_KEY, "skin");
  const open = ["corgi", "dalmatian"];
  assert.equal(resolveSkin("dalmatian", open), "dalmatian");
  assert.equal(resolveSkin(" dalmatian\n", open), "dalmatian");
  for (const raw of [null, undefined, "", "{]", "poodle", "__proto__", "golden", 42, {}]) assert.equal(resolveSkin(raw, open), DEFAULT_SKIN, String(raw));
  assert.equal(getSkin("poodle").id, DEFAULT_SKIN);
});

test("an unreadable save keeps the current in-memory pup, but only while it is unlocked", () => {
  const open = ["corgi", "dalmatian"];
  assert.equal(resolveSkin(null, open, "dalmatian"), "dalmatian", "blocked storage keeps this session's pick");
  assert.equal(resolveSkin(undefined, open, "dalmatian"), "dalmatian");
  assert.equal(resolveSkin(null, open, "husky"), DEFAULT_SKIN, "a locked in-memory pick still falls back");
  assert.equal(resolveSkin("corgi", open, "dalmatian"), "corgi", "a readable save wins over memory");
  assert.equal(resolveSkin("junk", open, "dalmatian"), DEFAULT_SKIN);
});

test("picking a pup only accepts unlocked skins, and arrows walk every pup", () => {
  const open = ["corgi", "pug"];
  assert.equal(chooseSkin("pug", open), "pug");
  assert.equal(chooseSkin("husky", open), null);
  assert.equal(chooseSkin("poodle", ["poodle"]), null);
  assert.equal(moveSkinFocus(0, "ArrowRight"), 1);
  assert.equal(moveSkinFocus(0, "ArrowLeft"), 0);
  assert.equal(moveSkinFocus(SKINS.length - 1, "ArrowDown"), SKINS.length - 1);
  assert.equal(moveSkinFocus(3, "Home"), 0);
  assert.equal(moveSkinFocus(0, "End"), SKINS.length - 1);
  assert.equal(moveSkinFocus(2, "x"), null);
});
