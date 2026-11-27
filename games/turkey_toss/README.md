# Turkey Toss

A 60-second 3D Thanksgiving arcade game. Toss turkey legs across the dinner table, land them on plates, stack multipliers and bounce off the giant roast.

Built with plain HTML, CSS, JavaScript ES modules, [Three.js](https://threejs.org/) (r186) and [cannon-es](https://github.com/pmndrs/cannon-es) (0.20.0). Every model, texture, particle, sound effect and music note is generated in code, so the only asset files are the Fredoka font in `assets/fonts/` and the icons in `icon/`.

## How to play

1. Press **Start Game**. After a short "Ready? Go!" the 60-second clock starts.
2. Press (or touch) the turkey leg on the platter, **drag upward** to aim, and **release** to toss.
   - The drag direction sets where the leg heads. The drag length sets how far it flies.
   - A dotted arc shows where it will land.
   - A tiny drag, or a drag pointing back toward you, cancels the throw.
3. A leg scores only if it **stops on a plate**. It then stays there for the rest of the round.
4. The round ends when the clock or the 60 legs run out. Legs already in the air can still land.
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
| Cranberry bowl | **2X** for 10 seconds. Overlapping hits stack |
| Gravy bowl | **3X** for 10 seconds. Overlapping hits stack |
| Bounce off the giant turkey, then land on a plate | **10X** on that landing only |
| Cornucopia | **2X** for 10 seconds, plus a shower of fruit. Overlapping hits stack |
| Flying turkey | Flat **+100**, unaffected by multipliers |
| Leg lands on the floor | Flat **-10**. The score never drops below zero |

Multipliers combine by multiplying. Two cranberry hits and one gravy hit inside the same 10 seconds, plus a bounce, make 2 × 2 × 3 × 10 = 120X, so a bounce onto the 10-point plate would be worth 1,200.

The bonuses apply to landings after they're earned. The landing that fills the ninth plate scores before the 4X begins.

The flying turkey crosses once per round, at a random time between 12 and 42 seconds. The HUD warns you just before it appears.

Your best score is saved in `localStorage`. If storage is blocked, it lasts for the current session only.

## Online leaderboard

There is one top 10, stored in Supabase. Open it from **Leaderboard** on the main menu or **View Leaderboard** on the game-over screen. There's no difficulty or song tab, because the game has one difficulty and no song choice.

After a round with a score above zero, the game-over screen lets the player enter a name and submit. Each round can be submitted once.

### How scores are checked

Visitors can read the board but can't write to it. Scores only arrive through the `turkey-toss-score` Edge Function in [`supabase/functions/`](supabase/functions/turkey-toss-score/):

1. When a round starts, the game asks the function for a single-use ticket.
2. During the round, the game logs every throw, bowl hit, cornucopia hit, bounce, landing, floor drop and flying turkey hit, with the round clock time.
3. On submit, the function replays the log with exact copies of the game's own `config.js`, `multipliers.js` and `scoring.js`. It rejects the round if the replayed score doesn't match, or the log breaks the game's rules. For example, more than 60 legs, a leg reaching a target faster than the hardest throw could, or more than 22 throws inside 10 seconds.
4. It also rejects the round if the ticket is used, expired or younger than the round's own length, then saves the score.

This stops anyone from posting a number by hand or replaying a request. Someone who studies the code could still script a believable fake round, but they'd have to play by the game's rules and wait out a full round each time. The limits are in `LIMITS` at the top of [`verify.js`](supabase/functions/turkey-toss-score/verify.js).

**Changing the scoring rules:** after editing `js/config.js`, `js/multipliers.js` or `js/scoring.js`, copy them into `supabase/functions/turkey-toss-score/game/` and deploy the function again. Otherwise the server scores rounds differently and rejects real ones. The tests fail until the copies match.

### Setup

1. Run `leaderboard.sql` in the Supabase SQL Editor. It creates the `turkey_toss_scores` and `turkey_toss_rounds` tables and their access rules, and upgrades older versions. It's safe to run again.
2. Deploy the function with JWT verification off, because players aren't signed in. With the [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx` downloads it if needed), from this folder:

   ```bash
   cd games/turkey_toss
   npx supabase login
   npx supabase functions deploy turkey-toss-score --remote=rhlwushiprnnivtksvlu --no-verify-jwt --use-api
   ```

   In Windows PowerShell, type `npx.cmd` instead of `npx` if you get a "running scripts is disabled" error. If the browser login doesn't work, create an access token under **Account > Access Tokens** in the Supabase dashboard and run `npx supabase login --token <your token>` instead.

   Or in the dashboard: **Edge Functions > Deploy a new function > Via Editor**, name it `turkey-toss-score`, add `index.ts`, `verify.js` and the three files in `game/` with the same folder layout, deploy, then turn off **Enforce JWT verification** in the function's settings.

Supabase gives the function its own secret key, so nothing secret is stored in this repository. The project address and publishable key are at the top of `js/leaderboard.js`. `leaderboard.sql` ends with commented examples for reviewing and removing entries.

If Supabase can't be reached, the game still plays and the leaderboard screens show an error. A round that couldn't get a ticket when it started can't be submitted.

## Running locally

ES modules and import maps don't load from `file://` URLs, so double-clicking `index.html` won't work. Serve the repository over HTTP instead:

```bash
# From the repository root
python -m http.server 8000
# then open http://localhost:8000/games/turkey_toss/
```

**Internet access is required.** Three.js and cannon-es load from pinned CDN builds through the import map in `index.html`.

## Tests

The scoring rules and the leaderboard's round checks run in Node with no browser:

```bash
node --test games/turkey_toss/tests/scoring.test.mjs games/turkey_toss/tests/leaderboard-server.test.mjs
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
| Bowl size, position and bonus | `BOWLS.cranberry`, `BOWLS.gravy` | `multiplier` and `seconds` set the bonus. |
| Table bonus | `TABLE_COMPLETE.multiplier` | |
| Bounce strength | `GIANT_TURKEY.minUpSpeed`, `maxUpSpeed` | |
| Bounce aim help | `GIANT_TURKEY.plateAssist`, `assistScatter` | Set for roughly 3 in 4 bounces reaching a plate. |
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
├── leaderboard.sql    Supabase tables and access rules
├── supabase/          Edge Function that checks and saves scores (verify.js has the checks)
├── css/style.css      Layout, HUD and responsive rules
├── assets/fonts/      Fredoka, and its license
├── tests/             Scoring and leaderboard tests
└── js/
    ├── main.js        Bootstraps renderer, scene, game; animation loop
    ├── config.js      Every tunable number
    ├── game.js        State machine (MENU/READY/PLAYING/WIND_DOWN/PAUSED/GAME_OVER), slice lifecycle, round flow
    ├── scene.js       Renderer, camera framing, lights, room, table, decorations
    ├── props.js       Plates, sauce bowls, giant turkey, flying turkey, serving platter
    ├── slices.js      Procedural turkey-leg geometry and mesh pool
    ├── physics.js     cannon-es world, grip, trajectory preview, bowl and bounce logic
    ├── throwing.js    Pointer Events drag-to-aim and the aiming preview
    ├── scoring.js     Landing score, number formatting, results messages
    ├── multipliers.js The round's multipliers and their timers
    ├── effects.js     Pooled particles: splashes, sparkles, feathers, leaf confetti
    ├── fruit.js       The pooled fruit shower from cornucopia hits
    ├── ui.js          DOM overlay helpers
    ├── leaderboard.js Online top 10: reads from Supabase, submits through the Edge Function
    └── audio.js       Synthesized effects and music, volumes, mute
```

### How a throw scores

Physics runs at a fixed 120 Hz. Each turkey leg's physics body is a flat ring of spheres (the leg is only the mesh drawn over it), which stays stable on the plates, bowls and roast. Slices never collide with each other.

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