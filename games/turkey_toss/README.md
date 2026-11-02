# Turkey Toss

A 60-second 3D Thanksgiving arcade game. Toss turkey slices across the dinner table, land them on plates, stack multipliers and bounce off the giant roast.

Built with plain HTML, CSS, JavaScript ES modules, [Three.js](https://threejs.org/) (r186) and [cannon-es](https://github.com/pmndrs/cannon-es) (0.20.0). Every model, texture, particle, sound effect and music note is generated in code, so the only asset files are the Fredoka font in `assets/fonts/` and the icons in `icon/`.

## How to play

1. Press **Start Game**. After a short "Ready? Go!" the 60-second clock starts.
2. Press (or touch) the slice on the platter, **drag upward** to aim, and **release** to toss.
   - The drag direction sets where the slice heads. The drag length sets how far it flies.
   - A dotted arc shows where it will land.
   - A tiny drag, or a drag pointing back toward you, cancels the throw.
3. A slice scores only if it **stops on a plate**. It then stays there for the rest of the round.
4. The round ends when the clock or the 60 slices run out. Slices already in the air can still land.
5. **Pause** with the ⏸ button, `Esc` or `P`. ↻ restarts the round and 🔊 mutes. Sound and music have their own volume sliders on the menu and pause screens.

### Scoring

| Target | Reward |
| --- | --- |
| Row 1 plates (closest) | 1 point |
| Row 2 plates | 2 points |
| Row 3 plates | 3 points |
| Row 4 plates | 5 points |
| Center back plate | 10 points |
| All nine plates filled | Permanent **4X**, once |
| Cranberry bowl | Permanent **2X**, adds another level on every hit |
| Gravy bowl | Permanent **3X**, adds another level on every hit |
| Bounce off the giant turkey, then land on a plate | **10X** on that landing only |
| Cornucopia | **2X** for 10 seconds, plus a shower of fruit. Overlapping hits stack |
| Flying turkey | Flat **+100**, unaffected by multipliers |
| Slice lands on the floor | Flat **-10**. The score never drops below zero |

Multipliers combine by multiplying. Two cranberry hits, one gravy hit and a bounce make 2 × 2 × 3 × 10 = 120X, so a bounce onto the 10-point plate would be worth 1,200.

The bonuses apply to landings after they're earned. The landing that fills the ninth plate scores before the 4X begins.

The flying turkey crosses once per round, at a random time between 12 and 42 seconds. The HUD warns you just before it appears.

Your best score is saved in `localStorage`. If storage is blocked, it lasts for the current session only.

## Online leaderboard

There is one top 10, stored in Supabase. Open it from **Leaderboard** on the main menu or **View Leaderboard** on the game-over screen. There's no difficulty or song tab, because the game has one difficulty and no song choice.

After a round with a score above zero, the game-over screen lets the player enter a name and submit. Each round can be submitted once.

**Setup:** run `leaderboard.sql` once in the Supabase SQL Editor. It creates the `turkey_toss_scores` table and its access rules, and upgrades the table if an older version already exists. It's safe to run again. The project address and publishable key are at the top of `js/leaderboard.js`.

The publishable key is public by design. Visitors can read the board and add scores, but can't edit or delete them. Scores are sent from the browser, so someone determined could still post a fake one. `leaderboard.sql` ends with commented examples for reviewing and removing entries.

If Supabase can't be reached, the game still plays and the leaderboard screens show an error.

## Running locally

ES modules and import maps don't load from `file://` URLs, so double-clicking `index.html` won't work. Serve the repository over HTTP instead:

```bash
# From the repository root
python -m http.server 8000
# then open http://localhost:8000/games/turkey_toss/
```

**The game is Coming Soon**, so `assets/js/coming-soon-guard.js` sends direct visitors back to the arcade. To see it locally, use the arcade's Coming Soon PIN first, or follow "Move a game from Coming Soon to the public library" in the root README to publish it.

**Internet access is required.** Three.js and cannon-es load from pinned CDN builds through the import map in `index.html`.

## Tests

The scoring rules run in Node with no browser:

```bash
node --test games/turkey_toss/tests/scoring.test.mjs
```

## Tuning

All gameplay numbers live in [`js/config.js`](js/config.js).

| What | Where | Notes |
| --- | --- | --- |
| Round length and slice supply | `ROUND.durationSeconds`, `slices` | Defaults `60` and `60`. |
| Lead-in / respawn / buzzer grace | `ROUND.readySeconds`, `respawnDelaySeconds`, `windDownSeconds` | Seconds. Respawn matches Latke Toss. |
| Gravity | `PHYSICS.gravity` | The aiming preview uses the same value, so it stays accurate. |
| How well slices stick | `PHYSICS.impactGrip`, `contactGrip` | Lower values stop slices sooner. |
| Bounciness | `PHYSICS.tableRestitution`, `plateRestitution`, `bowlRestitution` | |
| Launch power and angle | `LAUNCH.minSpeed`, `maxSpeed`, `elevationDegrees` | |
| Sideways aim limit | `LAUNCH.maxYawDegrees` | Must stay wide enough to reach row 1. |
| Plate positions and points | `PLATES` | |
| Landing strictness | `PLATE.scoringFraction`, `settleSeconds`, `settleSpeed` | |
| Slices kept per plate | `PLATE.maxStack` | `SLICE.poolSize` must exceed `maxStack` × 9 plus a few in flight. |
| Bowl size, position and multiplier | `BOWLS.cranberry`, `BOWLS.gravy` | |
| Table bonus | `TABLE_COMPLETE.multiplier` | |
| Bounce strength | `GIANT_TURKEY.minUpSpeed`, `maxUpSpeed` | |
| Bounce aim help | `GIANT_TURKEY.plateAssist`, `assistScatter` | Set for roughly 2 in 3 bounces reaching a plate. |
| Bounce bonus | `GIANT_TURKEY.bounceMultiplier` | |
| Cornucopia bonus | `CORNUCOPIA.multiplier`, `seconds` | |
| Fruit shower | `CORNUCOPIA.fruitPerHit`, `spreadSeconds`, `fruitPoolSize`, `lingerSeconds` | The fruit is only decoration and can't affect a throw. |
| Floor penalty | `FLOOR.penalty` | |
| Flying turkey bonus | `FLYING_TURKEY.bonusPoints` | |
| Flying turkey timing and route | `FLYING_TURKEY.earliestSeconds`, `latestSeconds`, `flightSeconds`, `height`, `z` | |
| Flying turkey fairness | `FLYING_TURKEY.hitRadius` | Larger than the model on purpose. |

Scores are capped at 9,007,199,254,740,991, the largest whole number a browser stores exactly. `leaderboard.sql` uses the same limit.

## Music and sound

Everything plays through the Web Audio API from [`js/audio.js`](js/audio.js). The background music is an original 6/8 jig stored as note numbers in `MELODY` and `CHORDS`. The menu plays it slowly and sparsely, and rounds play it at full tempo. Because of browser autoplay rules, audio starts on your first click or tap.

## Project structure

```
turkey_toss/
├── index.html         Page, HUD, menus, import map
├── leaderboard.sql    Supabase table and access rules
├── css/style.css      Layout, HUD and responsive rules
├── assets/fonts/      Fredoka, and its license
├── tests/             Scoring tests
└── js/
    ├── main.js        Bootstraps renderer, scene, game; animation loop
    ├── config.js      Every tunable number
    ├── game.js        State machine (MENU/READY/PLAYING/WIND_DOWN/PAUSED/GAME_OVER), slice lifecycle, round flow
    ├── scene.js       Renderer, camera framing, lights, room, table, decorations
    ├── props.js       Plates, sauce bowls, giant turkey, flying turkey, serving platter
    ├── slices.js      Procedural slice geometry, bend morph and mesh pool
    ├── physics.js     cannon-es world, grip, trajectory preview, bowl and bounce logic
    ├── throwing.js    Pointer Events drag-to-aim and the aiming preview
    ├── scoring.js     Landing score, number formatting, results messages
    ├── multipliers.js The round's permanent multipliers
    ├── effects.js     Pooled particles: splashes, sparkles, feathers, leaf confetti
    ├── fruit.js       The pooled fruit shower from cornucopia hits
    ├── ui.js          DOM overlay helpers
    ├── leaderboard.js Online top 10 (Supabase REST API)
    └── audio.js       Synthesized effects and music, volumes, mute
```

### How a throw scores

Physics runs at a fixed 120 Hz. Each slice is a flat ring of spheres, which stays stable on the plates, bowls and roast. Slices never collide with each other.

Real friction would let a fast throw skid straight across a plate, so touching the table or a plate bleeds off most of the slice's speed and eases it flat (`_applyGrip` in `physics.js`).

Each throw can only pay out once. A slice stays in the `FLYING` state until exactly one of these happens, and every outcome moves it out of that state for good:

- **Plate:** its center has stayed inside the plate, nearly still, for `settleSeconds`. It leaves the physics world and stays on the plate, so it can't score again.
- **Bowl:** its center dropped through the opening. The test sits slightly above the rim and checks the whole step's path, so fast throws can't skip it.
- **Flying turkey:** its path passed within `hitRadius`. It then falls away and can't score anything else.
- **Floor:** it reached the floor, which costs 10 points. This also applies to a slice that has already missed, but only once per slice.
- **Miss:** it lay still somewhere else, left the play area or ran out of time.

Bouncing off the giant turkey doesn't end the throw. It marks the slice so that a plate landing earns the 10X. Hitting the cornucopia doesn't end it either, so a slice can start the fruit shower and still land.

## Browser support

Works in current versions of Chrome, Edge, Firefox and Safari on desktop, Android and iOS, in landscape and portrait. If WebGL is unavailable, or the scripts can't load, the page shows a message explaining why instead of a blank screen.

## TODO

- Update music to match theme