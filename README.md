# Pup Quest

**Small paws. Big adventure.** An original, pixel-art browser platformer starring Biscuit the corgi.

**[Play Pup Quest](https://pallaviraiturkar0.github.io/pup-quest/)**

Run, jump, collect treats, and find the golden key to open the doghouse. Explore seven handcrafted trails: Sunny Meadow, Mossy Hollow, Starlit Summit, Puppy Park, Seashell Shore, Neon Nightwalk, and the finale, Moonlit Keep, where a boss guards the last golden key. Inspired by the approachable platforming of DOS-era games like Dangerous Dave, with entirely original code, levels, artwork, and synthesized sound effects.

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

### Power-ups

Every trail hides three dog-themed power-ups, all drawn procedurally:

- **Bone treat** (a big bone with a heart): one extra heart, up to five. Extra hearts carry over to the next trail.
- **Zoomies** (a blue lightning badge): 1.5x running speed for 5 seconds. Losing a heart ends the zoomies.
- **Squeaky toy** (a pink squeaky ball): critters within about 200 pixels freeze in fright for 4 seconds. Frozen critters can't hurt you, but you can still stomp them.

### Sound and particles

Every sound is synthesized on the fly with the Web Audio API; there are no audio files. Biscuit's jumps chirp upward, treats twinkle, stomping a critter earns a playful "woof-woof" bark, power-ups sweep up a scale, getting hurt slides down, and finishing a trail plays a fanfare with a happy bark. Audio only starts after your first click, tap, or key press. Press **M** or use the sound button to mute; the choice is remembered. Browsers without Web Audio simply play silently.

Small pixel particles add bounce: dust puffs when Biscuit lands hard or jumps, sparkles on treats, keys, checkpoints, and power-ups, paw prints when a critter is stomped, and confetti plus paw-print bursts at the doghouse. Particles live in a fixed pool (160 at most) so they never pile up. With **prefers-reduced-motion** turned on, moving particles are turned off and pickups show only a few still sparkles.

### Trail Map

Pick **Trail map** on the title screen (or after a game over or victory) to see all seven trails as paw-print stops along a winding, procedurally drawn path, each tinted with its trail's theme colours. Trail 01 is always open; clearing a trail unlocks the next one, and unlocked trails stay open on that device. Locked trails show a padlock.

- **Keyboard:** arrow keys (or Home/End) move between stops, Enter or Space starts the selected trail, and Esc goes back.
- **Mouse and touch:** click or tap an unlocked stop to start it; the Back button closes the map.
- Starting from the map plays from that trail to the finale with three fresh hearts. Trying again after a game over restarts from the trail you picked; playing again after a victory starts over from Trail 01.
- With **prefers-reduced-motion**, the marching trail and hopping paw animations are turned off.

Your personal best, unlocked trails, and sound preference are saved on your device using local storage, when available. A reload starts a new adventure; checkpoints only last for the current run.

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

The built-in Node test runner covers movement, variable jumps, coyote time, jump buffering, collisions, pickups, checkpoints, lives, pause/restart, and campaign state transitions, plus each critter's movement, tells, collisions, and drawing, and each power-up's pickup, effect, timeout, and drawing. Touch tests cover paw hit-testing, multi-touch, sliding between paws, jump-press queuing, touch-device detection, driving the engine from touch input, and the procedural paw art. Audio tests drive a fake AudioContext to check every sound recipe, gesture-only start, mute persistence, and silent failure; particle tests cover the capped pool, recycling, event bursts, reduced motion, landing events, and drawing. Boss tests cover the Mega-Vac's state machine (nap, roam, wind-up, charge, dizzy, hurt, defeated), stomp rules, respawn reset, arena fairness, the locked key and doghouse, and drawing every mode. A full-campaign input replay also checks that all seven trails, including the boss fight, can be completed without losing a heart, using ordinary movement and jumps. Trail Map tests cover unlock parsing and persistence rules, keyboard selection, refusing locked trails, starting (and restarting) a game at a chosen trail, the path staying in bounds, and readable stop colours. Level-data tests check every trail's bounds, themes, spawn point, hazard placement, and run a static jump-reachability check from the start to every platform, power-up, the golden key, and the doghouse.

## How it works

- `src/engine.js`: deterministic game rules and fixed-step physics.
- `src/levels.js`: seven handcrafted trails and their collectible/platform layouts. A trail can add `boss: { x, left, right }` (in columns) to place a boss arena.
- `src/boss.js`: the Mega-Vac boss state machine, stomp rules, and arena reset.
- `src/enemies.js`: data-driven critters (squirrels, robot vacuums, seagulls, alley cats) with their movement rules. Levels place them with objects such as `{ type: "cat", x, left, right, speed, row }`; plain `[x, left, right, speed]` tuples are ground squirrels.
- `src/powerups.js`: bone treat, zoomies, and squeaky toy rules (pickup, effects, and timers). Levels place them as `[type, column, y]` tuples.
- `src/themes.js`: data-driven backdrops (palette, parallax layers, and ground decor) picked by each level's `theme`.
- `src/render.js`: original pixel artwork drawn at 480 x 256 and scaled without smoothing.
- `src/audio.js`: procedural sound recipes (pure data) plus a small Web Audio adapter that handles gesture unlock, mute, and saved preference.
- `src/particles.js`: capped, DOM-free particle pool with dust, sparkle, paw-print, and confetti bursts, and reduced-motion fallbacks.
- `src/trailmap.js`: DOM-free Trail Map logic: reading and advancing unlock progress, keyboard selection, locked-trail rules, the seeded winding path, and per-theme stop colours.
- `src/touch.js`: touch-to-action logic (pointer tracking, paw hit-testing, touch-device detection) and the procedural paw-print button art, kept DOM-free so it runs under node tests.
- `src/main.js`: keyboard controls, wiring for the touch paws, menus and the Trail Map, accessibility announcements, and saved scores.
- `styles.css`: responsive game page and touch layouts, with reduced-motion and fullscreen support.

No frameworks, downloaded assets, trackers, analytics, external fonts, backend, or paid services.

## Themed backgrounds

Every backdrop is drawn procedurally from data in `src/themes.js`: a palette plus an ordered list of parallax layers (sun or moon, stars, clouds, birds, sea, hills, dunes, city skylines, castle towers, trees, palms, hedges, and street lamps). A level picks its backdrop with its `theme` field; unknown names fall back to the meadow. The first three trails use the meadow, forest, and starlit night; Puppy Park, Seashell Shore, Neon Nightwalk, and Moonlit Keep use the **park**, **beach**, **city** (night city), and **castle** (moonlit castle) themes. Preview any theme on any trail with a query string, for example `?theme=beach` or `?theme=castle`.

## Free hosting

The public repository uses **GitHub Pages**' built-in static publishing, with no custom workflow or build step. In repository **Settings > Pages**, **Deploy from a branch** is set to **main** and **/ (root)**, so GitHub publishes the site whenever `main` changes. The `.nojekyll` file tells Pages to serve the game directly without Jekyll processing.

Run `npm test` locally before publishing changes.

All URLs are relative, so the game works at the repository's `github.io/pup-quest/` address or another static host. Keeping the repository public allows GitHub Pages hosting on GitHub Free.

## License

MIT. All game artwork and sound effects are generated by the code in this repository. No Dangerous Dave assets, levels, or source code are used.
