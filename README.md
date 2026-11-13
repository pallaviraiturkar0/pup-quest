# Pup Quest

**Small paws. Big adventure.** An original, pixel-art browser platformer starring Biscuit the corgi.

**[Play Pup Quest](https://pallaviraiturkar0.github.io/pup-quest/)**

Run, jump, collect treats, and find the golden key to open the doghouse. Explore seven handcrafted trails: Sunny Meadow, Mossy Hollow, Starlit Summit, Puppy Park, Seashell Shore, Neon Nightwalk, and the finale, Moonlit Keep, where a boss guards the last golden key. Beating the finale opens a bonus Trail 08, Harvest Hollow, with springy hay bales, and clearing that opens bonus Trail 09, Canyon Caper, with crumbling sandstone ledges. Skilled pups can also uncover a secret eighth trail, Frosty Fjord, guarded by the Grumpy Yeti. Inspired by the approachable platforming of DOS-era games like Dangerous Dave, with entirely original code, levels, artwork, and synthesized sound effects.

## Controls

| Action | Keyboard | Phone / tablet |
| --- | --- | --- |
| Move | Left / Right or A / D | Hold the left / right paw |
| Jump | Space, Up, or W | Hold the JUMP paw |
| Pause / resume | Escape or P | Pause button |
| Restart adventure | R while paused | Restart adventure in the pause menu |
| Mute / unmute | M | Sound button in the toolbar |

### Touch controls

On phones and tablets, three paw-print buttons appear under the game (or beside it on short landscape screens). They only show on touch devices: a coarse pointer, a touchscreen, or the first real touch on a hybrid laptop. Keyboard play is unchanged.

- **Multi-touch:** hold a direction paw with one thumb and tap JUMP with the other to run and jump at the same time.
- **Slide between paws:** roll a thumb from left to right (or onto JUMP) without lifting it. A thumb that drifts a little off a paw keeps its action until it lands on another paw or lifts.
- The paws are pixel art drawn procedurally as inline SVG by `src/touch.js`; there are no image files. With reduced motion turned on, pressed paws change colour instead of squishing.
- On small screens the canvas scales to the page width. On short landscape phones, the paws move to either side of the canvas and the canvas shrinks so the HUD, game, and controls fit on one screen.

Hold jump for a higher leap; tap for a short hop. Jump on critters to bounce off them, and avoid spikes and water. Each new trail adds a critter with its own tell: Puppy Park's **robot vacuums** flash red and rev up before dashing at a pup ahead of them, Seashell Shore's **seagulls** glide overhead and swoop down to puppy height (watch their shadow), and Neon Nightwalk's **alley cats** prowl rooftops, crouch, then pounce. Orange checkpoint flags save your position for the current trail. You start with three hearts and recover one on each new trail. Treats are optional; the golden key is required.

### Finale: Moonlit Keep and the Mega-Vac

Trail 07 unlocks after Neon Nightwalk. Moonlit Keep is a long castle-moat run under a big moon, with distant towers, glowing windows, and waving pennants, and it brings back every critter from the earlier trails. A checkpoint flag and a bone treat wait just before the boss arena.

The **Mega-Vac**, a giant robot vacuum, naps in the arena until Biscuit steps in. Its visor shows what it's about to do:

1. **Green**: it rolls around the arena.
2. **Flashing red, shaking**: it revs up, facing the pup.
3. **Charge**: it dashes toward where the pup was, all the way to the arena wall. Wait on the ledge above either wall and it can't reach you.
4. **Yellow, stars, lid open**: it crashed into the wall and is dizzy for a couple of seconds. Hop onto its lid to dent it. Stomping it at any other time just bounces you off.

Three stomps power it down (each round it gets a little quicker). It drops the golden key, and reaching the doghouse brings up the victory screen. Its sides hurt while it's awake; if you lose a heart, it rolls back home for a nap but keeps its dents.

### Bonus Trail 08: Harvest Hollow

Beat the Mega-Vac on Trail 07 and **Trail 08 · Harvest Hollow** opens on the Trail Map, with a toast and a screen-reader announcement. Until then its stop shows a padlock and "Beat Moonlit Keep to open". It is worked out from your saved Moonlit Keep best time, so players who beat the finale before Trail 08 existed find it already open, and no new save data is needed. It sits outside the seven-trail campaign: clearing it shows its own victory screen, **Hop again** replays it, and it never changes campaign unlocks, Kennel rules, or the Daily Walk.

- A warm autumn sunset run past orange and red trees, drifting leaves, a scarecrow, pumpkin patches, and hay-bale stacks, with squirrels, a prowling cat, a seagull over the duck pond, and all three power-ups.
- **Hay bales:** golden bale carts are springy. Jumping from one launches a much higher leap (about five tiles instead of three) with a boing and a puff of straw. Tapping jump still makes a short hop. The golden key sits in a hayloft that only a bale bounce can reach, and more lofts hide treats.

### Bonus Trail 09: Canyon Caper

Clear Harvest Hollow and **Trail 09 · Canyon Caper** opens on the Trail Map the same way, with a toast and a screen-reader announcement. Until then its stop shows a padlock and "Beat Harvest Hollow to open". Like Trail 08, it is worked out from your saved best times (a Harvest Hollow time), so players who already cleared Trail 08 find it open, and no new save data is needed. Clearing it shows its own victory screen, **Scamper again** replays it, and it never changes campaign unlocks, Kennel rules, or the Daily Walk.

- A sunset desert run past layered red mesas, distant buttes, saguaro cacti, and bouncing tumbleweeds, with squirrels, circling **vultures** (they glide, warn, and swoop just like seagulls; watch their shadow), and all three power-ups.
- **Crumbling ledges:** three canyons are too wide to jump, so you cross on cracked sandstone ledges. A ledge holds when you land, shakes for a moment (0.6 seconds) with a creak, then drops away with a rumble and a puff of sand. Keep hopping! It re-forms about two seconds later (never around the pup), and losing a heart puts every ledge back. The golden key hangs over the widest canyon: grab it mid-hop across the crumbling steps.

### Power-ups

Every trail hides three dog-themed power-ups, all drawn procedurally:

- **Bone treat** (a big bone with a heart): one extra heart, up to five. Extra hearts carry over to the next trail.
- **Zoomies** (a blue lightning badge): 1.5x running speed for 5 seconds. Losing a heart ends the zoomies.
- **Squeaky toy** (a pink squeaky ball): critters within about 200 pixels freeze in fright for 4 seconds. Frozen critters can't hurt you, but you can still stomp them.

### Sound and particles

Every sound is synthesized on the fly with the Web Audio API; there are no audio files. Biscuit's jumps chirp upward, treats twinkle, stomping a critter earns a playful "woof-woof" bark, power-ups sweep up a scale, getting hurt slides down, and finishing a trail plays a fanfare with a happy bark. Audio only starts after your first click, tap, or key press. Press **M** or use the sound button to mute; the choice is remembered. Browsers without Web Audio simply play silently.

Small pixel particles add bounce: dust puffs when Biscuit lands hard or jumps, sparkles on treats, keys, checkpoints, and power-ups, paw prints when a critter is stomped, and confetti plus paw-print bursts at the doghouse. Particles live in a fixed pool (160 at most) so they never pile up. With **prefers-reduced-motion** turned on, moving particles are turned off and pickups show only a few still sparkles.

### Trail Map

Pick **Trail map** on the title screen (or after a game over or victory) to see all seven trails and the bonus Trails 08 and 09 as paw-print stops along a winding, procedurally drawn path, each tinted with its trail's theme colours. Trail 01 is always open; clearing a trail unlocks the next one, and unlocked trails stay open on that device. Locked trails show a padlock. Trail 08 opens once Trail 07 is beaten, and Trail 09 once Trail 08 is cleared.

- **Keyboard:** arrow keys (or Home/End) move between stops, Enter or Space starts the selected trail, and Esc goes back.
- **Mouse and touch:** click or tap an unlocked stop to start it; the Back button closes the map.
- Starting from the map plays from that trail to the finale with three fresh hearts. Trying again after a game over restarts from the trail you picked; playing again after a victory starts over from Trail 01.
- With **prefers-reduced-motion**, the marching trail and hopping paw animations are turned off.

### Daily Walk

Every day brings one remixed trail, the same for every player. Pick **Daily walk** on the title screen (or after a game over or victory). The button names today's challenge, for example *Snack Attack on Neon Nightwalk*, and the line under it shows today's twist or your best time today. The Daily Walk is open from the start, even before the trail it remixes is unlocked.

- The walk is built from the **UTC date** with a seeded random number generator (mulberry32), so everyone gets the same walk whatever their time zone, and a new one arrives at midnight UTC.
- It remixes one of the boss-free Trails 01–06 with fresh scenery and treats moved to new perches. Ground, ledges, spikes, critters, the golden key and the doghouse stay where they are. Each day adds one twist:
  - **Snack Attack**: half as many treats again, hidden all over the trail.
  - **Bone Bonanza**: three extra big bone treats that can top you up to five hearts.
  - **Moonlight Stroll**: a starry night walk.
  - **Slippery Day**: frosty scenery, ice on the ground and ledges (never next to a gap edge or spike). It only remixes Trails 01–03.
- Reaching the doghouse ends the walk with your time and **best today**. **Walk again** replays it (or starts the new day's walk after midnight UTC). Daily times don't count toward trail medals, unlocks, or the Kennel.
- Today's best is saved under its own key, `pup-quest:daily-best`, as `{"date":"YYYY-MM-DD","ms":…}`. A new day starts a fresh record, and a walk begun before midnight never overwrites the next day's record.
- **Streaks**: finishing the Daily Walk on consecutive UTC days builds a streak. The line under the **Daily walk** button and the results screen show your current streak and your best one (for example *🐾 3-DAY STREAK · BEST 7*), and a strip of the last 14 days puts a paw on every day you walked, with today outlined. Replays on the same day don't count twice, and a streak stays alive until a whole UTC day passes without a walk. Reaching **7 days in a row** earns the 🏅 **Week Walker** badge.
- Streaks are saved under `pup-quest:daily-streak` as `{"current":…,"best":…,"last":"YYYY-MM-DD","runs":[["YYYY-MM-DD","YYYY-MM-DD"],…]}`, where each run is a range of consecutive walked days. Only runs that ended in the last 60 days are kept, but each remembers where it began, so longer streaks still count in full. Counts are re-derived from the runs, so unreadable or tampered data is repaired; saving goes through the same cross-tab lock as best times, and other tabs update when it changes.
- Tests drive a real-input playthrough of every trail and twist pair the remixer can choose, plus every walk for a full year, and check that every treat sits on solid footing away from spikes and gaps.

### Secret trail: Frosty Fjord

A hidden bonus trail appears on the Trail Map as a glowing ★ stop after you either **earn a gold paw medal on any trail** or **beat the Mega-Vac on Trail 07**. A toast and screen-reader announcement mark the moment it appears. It is worked out from your saved best times, so no extra save data is needed, and it stays open on that device. Finding it never unlocks campaign trails.

- Frosty Fjord is a single-trail challenge under an aurora with falling snow and icy parallax peaks. Clearing it shows its own victory screen, and **Slide again** replays it.
- Glossy blue **ice** covers some ground patches and ledges. On ice Biscuit has 30% of his usual grip, so he speeds up and stops more slowly (a full-speed slide carries about a tile and a half). Top speed, jumping, and air control are unchanged, and icy ledges keep a grippy tile at each end, and ground ice is never placed next to a cliff edge, a spike, a critter's patrol, or a start, checkpoint, or exit.
- It is timed like every trail, with its own par times and paw medal, saved under the key `8-yeti` in `pup-quest:best-times`. Times from before the Yeti arrived (saved as `8`) came from a shorter course, so they no longer count toward its medal.

#### Secret boss: the Grumpy Yeti

At the end of Frosty Fjord, past a checkpoint flag, a huge shaggy snow-dog with floppy ears and a red collar naps in an arena with a glossy **ice patch on each side** of it. It holds the golden key. It wakes when Biscuit steps in, and every attack has a tell:

1. **Snowball**: an arm goes up and a snowball grows in its paw, then it's thrown at the spot where Biscuit stood when the Yeti started aiming. A shadow on the floor marks where it will land, so keep moving. A snowball that lands on snow bursts; one that lands on **ice keeps rolling** until it reaches snow, so hop over it.
2. **Leap**: after its throws it crouches, shakes, and shows a **!**, and a blinking shadow marks its landing spot under Biscuit. Then it leaps. If it lands on snow, the floor quakes and a **shockwave** runs along the ground both ways (jump it). If it lands on **ice, it slips** and skids onto its back with dizzy stars.
3. **Belly stomp**: hop on its pink belly while it's down. Jumping on it while it's standing just bounces you off.

So the trick is to **stand on the ice when it crouches**, then run (carefully, with only 30% grip) before it lands. After any leap away from the middle it hops back home first, sending out another shockwave, so it can never pin Biscuit against a wall. Each stomp makes the next round a little quicker (and the third round throws three snowballs). Touching it while it's standing, a snowball, or a shockwave costs a heart; if that happens it returns home for a nap but keeps its bruises.

After three belly stomps the Yeti rolls over for belly rubs, wagging its tail under a shower of hearts and confetti. The golden key appears in the middle of the arena, and the doghouse waits just past it. Its tells, snowballs, and shadows are all drawn procedurally; with **prefers-reduced-motion**, the shaking, blinking, and bobbing hold still and only a few still hearts appear.

### Time trials and paw medals

Every trail run is timed. The clock in the top-right corner of the game starts when the trail starts, keeps running after a lost heart, and stops whenever the game is paused (including when the window loses focus or the help dialog is open). Restarting a trail resets it.

Clear a trail to see your run time, your best time, and a paw medal on the level-clear screen. Beating your best time (or clearing a trail for the first time) adds a **New best!** badge, and the screen tells you the target for the next medal. Each trail has its own par times, stored as `par: [gold, silver, bronze]` seconds in `src/levels.js`:

| Trail | Gold | Silver | Bronze |
| --- | --- | --- | --- |
| 01 Sunny Meadow | 0:21 | 0:28 | 0:42 |
| 02 Mossy Hollow | 0:24 | 0:32 | 0:48 |
| 03 Starlit Summit | 0:26 | 0:36 | 0:54 |
| 04 Puppy Park | 0:36 | 0:48 | 1:12 |
| 05 Seashell Shore | 0:35 | 0:48 | 1:12 |
| 06 Neon Nightwalk | 0:34 | 0:46 | 1:10 |
| 07 Moonlit Keep | 0:48 | 1:06 | 1:40 |
| 08 Harvest Hollow (bonus) | 0:32 | 0:44 | 1:06 |
| 09 Canyon Caper (bonus) | 0:34 | 0:46 | 1:10 |
| ★ Frosty Fjord (secret) | 1:06 | 1:28 | 2:10 |

Gold is about 10% slower than the full-campaign input replay used in the tests (which checks that it earns gold on every trail), so it rewards a clean, confident run without needing frame-perfect play. Slower clears still count; they just don't earn a medal yet.

The Trail Map shows each cleared trail's best time and a medal badge on its stop, and the selected stop's details appear under the map title. Screen readers hear run times, best times, and medals in words, both on the level-clear screen and on each map stop. Medals are drawn as inline pixel-art SVG, and with **prefers-reduced-motion** the New best! pop animation is turned off.

Best times are saved per trail on your device under `pup-quest:best-times`, keyed by trail number (a level can set its own `record` key when its course changes; Harvest Hollow uses `8-harvest`, Canyon Caper `9-canyon`, and Frosty Fjord `8-yeti`). Unreadable or tampered entries are ignored. Saves re-read the stored times under a cross-tab [Web Lock](https://developer.mozilla.org/docs/Web/API/Web_Locks_API) (when the browser supports it), so if another tab saved a faster time, the faster time is kept.

### Dog Kennel

Paw medals unlock new pups to play as. Pick **Dog kennel** on the title screen (or after a game over or victory), or the **Kennel** button on the Trail Map, to see every pup:

| Pup | Breed | How to unlock |
| --- | --- | --- |
| Biscuit | Corgi | Always in the kennel |
| Domino | Dalmatian | A bronze paw or better on any trail |
| Pickles | Pug | Silver paws or better on 3 trails |
| Bagel | Beagle | A gold paw on any trail |
| Juniper | Husky | A gold paw on Trail 07 Moonlit Keep |
| Sunny | Golden Retriever | Gold paws on all 7 trails |

A better medal counts for the lower ones (a gold also counts as a silver and a bronze). Unlocks come straight from your saved best times, so every medal you already have counts. Locked pups appear greyed out with their requirement and your progress (for example "2 of 3"); pick an unlocked pup and it runs the trails in your next game. Each coat is drawn procedurally on canvas with its own palette, ears, tail, and markings, using the same sprite code as gameplay.

- **Keyboard:** arrow keys (or Home/End) move between pups, Enter or Space picks one, Tab moves between the pups and Back, and Esc goes back (to the Trail Map if you came from there).
- **Mouse and touch:** click or tap a pup to pick it.
- Screen readers hear each pup's name, breed, and whether it is picked, unlocked, or locked with its requirement. With **prefers-reduced-motion**, the picked pup's tail stops wagging and cards don't lift.

The chosen pup is saved under `pup-quest:skin`. A missing, unknown, or still-locked choice falls back to Biscuit.

### Trail Builder and share codes

Build your own trail and send it to a friend. Pick **Trail builder: make & share** on the title screen (or after a game over or victory) to open a 40 x 9 tile grid. The bottom row is the ground and the eight rows above it are open sky.

| Tool | Key | What it places |
| --- | --- | --- |
| Ground | 1 | Solid ground (bottom row) |
| Ledge | 2 | A platform tile (rows above the ground) |
| Spikes | 3 | A spike pit (bottom row only) |
| Treat | 4 | A treat to collect (rows above the ground) |
| Doghouse | 5 | Moves the goal to that column and lays plain ground under it |
| Erase | 6 | Clears a tile; on the bottom row it digs a gap to jump over |

The first six columns (the start) and the ground under the doghouse always stay plain ground; the builder explains why if you try to change them.

- **Keyboard:** the arrow keys (or Home/End) move the cursor, Enter or Space places the current tool, Delete or Backspace erases, 1–6 pick a tool, Tab reaches the buttons, and Esc goes back. Screen readers hear each tile's position and contents.
- **Mouse and touch:** pick a tool, then click or tap tiles. With a mouse or pen you can also drag to paint; on touch screens dragging scrolls the grid instead. On phones the builder fills the screen.
- **Play-test** runs your trail straight away in the chosen theme (any of the ten game themes, including autumn and canyon). Reach the doghouse to clear it; your pup starts with the doghouse open, there is no key to find, and no checkpoint.
- **Share code** shows a link such as `https://pallaviraiturkar0.github.io/pup-quest/?trail=<code>` with a **Copy** button. Opening that link shows "Someone built you a trail!" and plays it; the title-screen button then reads **Trail builder: remix this trail**, which opens that trail for editing.
- **Example** loads a ready-made trail to remix, and **Clear** starts over with plain ground. Your work in progress is kept on this device under `pup-quest:builder-draft`.
- Built and shared trails are just for fun: they never change your unlocks, best times, medals, Daily Walk record, or Kennel progress.

Try the built-in example: [play the example trail](https://pallaviraiturkar0.github.io/pup-quest/?trail=AQQoIwAAQAAQAAQAAQAAQAAQAAQACQACQAAQAQQCQACQAAQQAAQAAQAAQAAQAIgAAQAAQAAQAAQAEQAkAAkAAkAAEQAAQACQAAQAAQAIgAAQACQAAQAAQAAQAAQAAW7u).

**Share-code format (version 1).** A code is unpadded base64url (only `A–Z a–z 0–9 - _`, so it is safe in a URL) of these bytes: format version, theme index, trail length in columns (30–80), doghouse column, then 2 bits per tile column by column from the top row down, and finally a Fletcher-16 checksum. Codes are checked strictly before anything is loaded: the length, characters, version, theme, size, every tile value, zeroed padding bits, and the checksum must all be valid, the first six columns must be plain ground, the doghouse must sit on plain ground, and a trail can hold at most 60 treats. If a code is broken or tampered with, the game never crashes. It shows a friendly message (for example "That trail code has a typo somewhere") and starts the regular adventure instead.

Your personal best, unlocked trails, best trail times, chosen pup, and sound preference are saved on your device using local storage, when available. A reload starts a new adventure; checkpoints only last for the current run.

## Run locally

Requires **Node.js 20 or newer**. There are no dependencies to install.

```sh
npm start
```

Open `http://localhost:4173`. Use `PORT=8080 npm start` to choose another port. Serve the game over HTTP rather than opening `index.html` directly, since it uses JavaScript modules.

```sh
npm test
```

To lint, install the development tooling once with `npm ci` (the game itself has no runtime dependencies), then run:

```sh
npm run lint
```

The built-in Node test runner covers movement, variable jumps, coyote time, jump buffering, collisions, pickups, checkpoints, lives, pause/restart, and campaign state transitions, plus each critter's movement, tells, collisions, and drawing, and each power-up's pickup, effect, timeout, and drawing. Touch tests cover paw hit-testing, multi-touch, sliding between paws, jump-press queuing, touch-device detection, driving the engine from touch input, and the procedural paw art. Audio tests drive a fake AudioContext to check every sound recipe, gesture-only start, mute persistence, and silent failure; particle tests cover the capped pool, recycling, event bursts, reduced motion, landing events, and drawing. Boss tests cover the Mega-Vac's state machine (nap, roam, wind-up, charge, dizzy, hurt, defeated), stomp rules, respawn reset, arena fairness, the locked key and doghouse, and drawing every mode. A full-campaign input replay also checks that all seven trails, including the boss fight, can be completed without losing a heart, using ordinary movement and jumps. Trail Map tests cover unlock parsing and persistence rules, keyboard selection, refusing locked trails, starting (and restarting) a game at a chosen trail, the path staying in bounds, and readable stop colours. Time-trial tests cover the pause-aware trail timer, medal thresholds, best-time parsing and saving, keeping the faster time from another tab (including overlapping saves under the lock), time formatting, and medal art contrast. Kennel tests cover skin data validity (palettes, ears, tails, markings, and unlock rules), every coat drawing inside the sprite box, medal-based unlock rules and progress, requirement wording, picking only unlocked pups, and falling back to Biscuit for missing, corrupt, unknown, or locked saves. Trail 08 tests cover its unlock rule (a Moonlit Keep clear, including older saves), its map stop and padlock, its separate best-time key, the hay-bale jump (higher bounce, short taps, ordinary ledges unchanged), a reachability check proving the key and lofts need a bale bounce, the autumn theme and its reduced-motion leaves, and a real-input run that wins it with gold. Trail 09 tests cover its unlock rule (a Harvest Hollow clear, including older saves), its map stop and padlock, its `9-canyon` best-time key, the crumbling-ledge timing (shake, drop, re-form, never around the pup, reset on respawn), a reachability check proving the canyons and the key need the ledges, the vulture's swoop, the canyon theme with its reduced-motion tumbleweeds and ledge shake, and a real-input run that wins it with gold. Secret-trail tests cover its unlock rules (gold paw or boss clear only), the extra map stop, ice traction, slide length and air control, ice fairness, the arctic theme's aurora, snow, and ice drawing, and a real-input run that wins it with gold. Trail Builder tests cover share-code round-trips for random trails and for every theme at the shortest and longest sizes, rejecting malformed, truncated, oversized, tampered, and fuzzed codes (and hand-built codes with bad versions, themes, sizes, tiles, padding, starts, doghouses, or too many treats) without throwing, `?trail=` parsing and share links, the tool placement rules, and loading a code into a level that a real-input run clears without losing a heart. Level-data tests check every trail's bounds, themes, spawn point, hazard placement, and run a static jump-reachability check (aware of hay-bale bounces and crumbling ledges) from the start to every platform, power-up, the golden key, and the doghouse.

## How it works

- `src/engine.js`: deterministic game rules and fixed-step physics.
- `src/levels.js`: seven handcrafted trails plus the bonus Harvest Hollow and Canyon Caper and the secret Frosty Fjord (`TRAILS` lists all ten) and their collectible/platform layouts. A trail can add `boss: { x, left, right }` (in columns) to place a Mega-Vac arena, or `boss: { kind: "yeti", x, left, right }` for the Grumpy Yeti, which uses the trail's ground ice inside its arena. Icy ground spans are `ice: [[column, width]]`, and a platform tuple can end with `"ice"`, or with `"hay"` for a springy hay bale, or `"crumble"` for a crumbling sandstone ledge (its timing lives in `src/crumble.js`).
- `src/boss.js`: the Mega-Vac boss state machine, stomp rules, and arena reset.
- `src/yeti.js`: the Grumpy Yeti boss state machine: snowballs (which roll on ice), leaps, shockwaves, slipping on ice, belly stomps, and arena reset.
- `src/enemies.js`: data-driven critters (squirrels, robot vacuums, seagulls, alley cats, and canyon vultures that reuse the seagull swoop) with their movement rules. Levels place them with objects such as `{ type: "cat", x, left, right, speed, row }`; plain `[x, left, right, speed]` tuples are ground squirrels.
- `src/powerups.js`: bone treat, zoomies, and squeaky toy rules (pickup, effects, and timers). Levels place them as `[type, column, y]` tuples.
- `src/themes.js`: data-driven backdrops (palette, parallax layers, and ground decor) picked by each level's `theme`.
- `src/render.js`: original pixel artwork drawn at 480 x 256 and scaled without smoothing.
- `src/audio.js`: procedural sound recipes (pure data) plus a small Web Audio adapter that handles gesture unlock, mute, and saved preference.
- `src/particles.js`: capped, DOM-free particle pool with dust, sparkle, paw-print, snow, heart, and confetti bursts, and reduced-motion fallbacks.
- `src/medals.js`: DOM-free time-trial logic: medals from par times, best-time storage and merging, time formatting, and the medal art.
- `src/trailmap.js`: DOM-free Trail Map logic: reading and advancing unlock progress, keyboard selection, locked-trail rules, the bonus and secret-trail unlocks, the seeded winding path, and per-theme stop colours.
- `src/kennel.js`: DOM-free Dog Kennel logic: pup skin data, medal-based unlock rules, saved-skin fallback, and the shared procedural pup sprite used by gameplay and the Kennel previews.
- `src/trailcode.js`: DOM-free Trail Builder logic: the versioned share-code format (encode, strict decode and validation), builder tool rules, `?trail=` parsing and share links, the example trail, and turning a built trail into a playable level.
- `src/touch.js`: touch-to-action logic (pointer tracking, paw hit-testing, touch-device detection) and the procedural paw-print button art, kept DOM-free so it runs under node tests.
- `src/main.js`: keyboard controls, wiring for the touch paws, menus, the Trail Map, Dog Kennel, and Trail Builder, accessibility announcements, and saved scores.
- `styles.css`: responsive game page and touch layouts, with reduced-motion and fullscreen support.

No frameworks, downloaded assets, trackers, analytics, external fonts, backend, or paid services.

## Themed backgrounds

Every backdrop is drawn procedurally from data in `src/themes.js`: a palette plus an ordered list of parallax layers (sun or moon, stars, clouds, birds, sea, hills, dunes, city skylines, castle towers, trees, palms, hedges, street lamps, auroras, glaciers, falling snow, hay bales and pumpkins, falling leaves, mesas and buttes, saguaro cacti, and tumbleweeds). A level picks its backdrop with its `theme` field; unknown names fall back to the meadow. The first three trails use the meadow, forest, and starlit night; Puppy Park, Seashell Shore, Neon Nightwalk, and Moonlit Keep use the **park**, **beach**, **city** (night city), and **castle** (moonlit castle) themes, Harvest Hollow uses **autumn** (a low sunset sun, migrating geese, orange and red trees, hay bales, pumpkin patches, a scarecrow, and drifting leaves), Canyon Caper uses **canyon** (a big setting sun, striped red mesas in front of paler distant buttes, saguaros, pebbles, and rolling tumbleweeds), and the secret Frosty Fjord uses **arctic** (aurora, glaciers, snowdrifts, and a snowman). Preview any theme on any trail with a query string, for example `?theme=beach`, `?theme=castle`, `?theme=arctic`, `?theme=autumn`, or `?theme=canyon`. Falling snow, falling leaves, tumbleweeds, the aurora, and shaking ledges hold still with **prefers-reduced-motion**.

## Free hosting

The public repository uses **GitHub Pages**' built-in static publishing, with no custom workflow or build step. In repository **Settings > Pages**, **Deploy from a branch** is set to **main** and **/ (root)**, so GitHub publishes the site whenever `main` changes. The `.nojekyll` file tells Pages to serve the game directly without Jekyll processing.

Run `npm test` locally before publishing changes.

All URLs are relative, so the game works at the repository's `github.io/pup-quest/` address or another static host. Keeping the repository public allows GitHub Pages hosting on GitHub Free.

## License

MIT. All game artwork and sound effects are generated by the code in this repository. No Dangerous Dave assets, levels, or source code are used.
