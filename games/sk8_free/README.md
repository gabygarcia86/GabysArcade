# Sk8 Free

SkiFree, but on a skateboard. Skate down an endless neighborhood, dodge whatever's in the way, and enjoy it while you can. After about a minute, a very angry Cop or Karen comes after you, and they don't stop.

All the art is drawn with Canvas 2D and all the sound is generated with the Web Audio API. There are no images, audio files, libraries or build steps, apart from the site icons in `icon/`.

## Run it

The game uses ES modules, so it needs a web server. Double-clicking `index.html` won't work.

From the root of the GabysArcade repository:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>, select the game in the Coming Soon section, and enter the PIN. While the game's title starts with `Coming Soon`, `coming-soon-guard.js` sends anyone without that 12-hour pass back to the arcade.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | A / D or Left / Right | Drag anywhere on the game |
| Go faster | Hold W or Up | Tap FAST |
| Slow down | Hold S or Down | Tap SLOW |
| Ollie | Space | OLLIE button |
| Flip in the air | F, or hold for more | FLIP button, or hold for more |
| Pause | P or Esc | PAUSE button |
| Restart | R | R button |

On touch screens, each tap moves one step between slow, normal and fast, and the speed stays until the next tap. The button lights up while it's set. Tap the other button to return to normal speed.

## Scoring

| Event | Points |
| --- | --- |
| Every 10 meters | 10 |
| Avoiding an obstacle | 5 |
| Jumping an obstacle or hitting a ramp | 25 |
| Jumping a pedestrian or jogger | 15 |
| Flips in one jump | 5 for one, 15 for two, 30 for three, 50 for four, and so on |
| Collecting an item | 50 |
| Collecting a gold wheel | 150 |

The high score and best distance are saved in the browser's `localStorage` under `sk8Free.v1`, along with the sound, music and pursuer settings. Your leaderboard name is saved under `sk8Free.playerName`.

A flip that's at least 70% finished when you land still counts. Land earlier in the flip and you bail, which is a normal wipeout, and a helmet will save you from it. A normal ollie fits up to two flips, and a ramp fits up to four.

## Leaderboard

The online leaderboard uses the arcade's Supabase project, with its own `sk8_free_scores` table.

**Set it up once:** in the Supabase dashboard, open **SQL Editor → New query**, paste in all of `leaderboard.sql`, and click **Run**. Until then, the leaderboard says it's unavailable and submitting a score fails, but the rest of the game works normally.

- Open it with **LEADERBOARD** on the main menu or the game-over window.
- The ALL, COP and KAREN tabs each show a top 10. A run counts on the board for whoever actually caught you, so a Random run goes on the Cop's or Karen's.
- After a game over, enter a name and select **SUBMIT**. A score of 0 can't be submitted.
- `leaderboard.sql` also has commented-out examples for removing an entry or wiping the boards.

Scores are checked for a valid format, but they're sent from the player's browser, so a determined cheater could still post a fake one. Delete those by hand.

## Collectibles

| Item | Effect |
| --- | --- |
| Soda can | Speed boost for 4 seconds |
| Gold wheel | Bonus points |
| Helmet | Blocks your next wipeout |
| Rocket shoes | Super speed for 3 seconds |
| Energy drink | Higher jumps for 8 seconds |

## Customize

Almost every number is in `js/config.js`, with a comment on each.

| To change | Edit |
| --- | --- |
| When the chase starts | `chase.triggerSeconds`, `chase.triggerJitter` and `chase.triggerMeters` |
| How fast the pursuer closes in | `chase.headStart` and `chase.ramp` |
| Skating speed and steering | The `player` section |
| Jump height | `player.ollieVelocity` and `player.rampVelocity` |
| Flip speed and how forgiving landings are | `player.flipTime` and `player.flipForgiveness` |
| Points per flip | `points.flip` |
| How busy the world gets | `spawn.gapStart` and `spawn.gapEnd` |
| Width of the guaranteed clear path | `spawn.safeLaneWidth` |
| Points | The `points` section |
| Pursuer dialogue and game-over lines | `PURSUERS`, at the bottom of the file |

To change which obstacles appear where, edit `TABLES` at the top of `js/world.js`. Each entry is a kind and a weight.

To add an obstacle, add an entry to `KINDS` in `js/obstacles.js` with a hitbox, a `height`, and a draw function, then add it to a table in `js/world.js`. A `height` above the top of a ramp jump means it can only be steered around.

## Code layout

```text
sk8_free/
├── index.html         Page, HUD and menu windows
├── style.css          Windows 3.1 styling for the menus and HUD
├── leaderboard.sql    Supabase setup for the online leaderboard
├── js/
│   ├── main.js        Startup, saving, canvas scaling, frame loop
│   ├── config.js      Every tunable number, plus pursuer dialogue
│   ├── game.js        States, collisions, scoring, chase and catch sequence
│   ├── player.js      Skater movement, jumping, wipeouts and drawing
│   ├── world.js       Biomes, ground drawing and obstacle spawning
│   ├── obstacles.js   Obstacle definitions, the entity pool, movement and art
│   ├── pursuer.js     Cop and Karen behavior and drawing
│   ├── collision.js   Circle and rectangle tests
│   ├── particles.js   Pooled particles and floating score text
│   ├── audio.js       Synthesized sound effects and optional music
│   ├── font.js        5x7 bitmap font for canvas text
│   ├── leaderboard.js Reads and submits online scores
│   └── ui.js          Keyboard and touch input, HUD, menus and leaderboard window
└── icon/              Site icons
```

## How fairness works

Each row of obstacles moves a hidden "safe lane" a little to one side. The lane never drifts faster than the player can steer, and nothing stationary is placed inside it, so there is always a way through. Moving obstacles can wander into the lane, but all of them can be jumped.

## Deploy to GitHub Pages

This game ships with the GabysArcade site, so pushing to `main` publishes it. All its paths are relative.

To release it publicly:

1. Change the `<title>` in `index.html` to `Sk8 Free`.
2. Change `title` for `sk8_free` in `data/catalog.js` to `Sk8 Free`.
3. Replace the `In development.` description in the same entry.
4. Run `node tools/check-catalog.mjs`, then push.

To host it on its own instead, copy this folder into a new repository, delete the `coming-soon-guard.js` line and the `Back to the arcade` link from `index.html`, and turn on **Settings → Pages → Deploy from a branch** for `main` and `/ (root)`.
