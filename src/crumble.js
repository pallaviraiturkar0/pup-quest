// Crumbling sandstone ledges (Trail 09, Canyon Caper). A ledge holds while the pup stands on it,
// but shakes the moment paws touch down and drops away a beat later. After a short rest it
// re-forms, so a fall never strands the pup. Kept DOM-free so the timing is easy to test.

// `delay`: seconds of shaking before the ledge drops; `gone`: seconds before it re-forms.
export const CRUMBLE = Object.freeze({ delay: 0.6, gone: 2.2 });

export function makeCrumble() {
  return { state: "solid", timer: 0 };
}

// Whether the ledge can be stood on (it still holds while shaking).
export function crumbleSolid(crumble) {
  return !crumble || crumble.state !== "fallen";
}

// Advances one ledge. `standing`: the pup is standing on it; `blocked`: the pup overlaps the
// spot it would re-form in. Returns "crumble-shake", "crumble" or "crumble-reform" on a change.
export function stepCrumble(crumble, dt, { standing = false, blocked = false } = {}) {
  if (crumble.state === "solid") {
    if (!standing) return null;
    crumble.state = "shaking";
    crumble.timer = CRUMBLE.delay;
    return "crumble-shake";
  }
  crumble.timer = Math.max(0, crumble.timer - dt);
  if (crumble.timer > 0) return null;
  if (crumble.state === "shaking") {
    crumble.state = "fallen";
    crumble.timer = CRUMBLE.gone;
    return "crumble";
  }
  // Never re-form around the pup.
  if (blocked) return null;
  crumble.state = "solid";
  return "crumble-reform";
}
