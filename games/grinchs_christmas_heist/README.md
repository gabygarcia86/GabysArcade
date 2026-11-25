# Grinch's Christmas Heist

A silly top-down Christmas arcade game in HTML5 Canvas and vanilla JavaScript. Sneak around Whoville as the Grinch, stuff your sack with presents, dodge the Whos and their dogs, and reach your getaway before the 60-second timer runs out.

It has no build step, dependencies, or image and audio assets apart from the icons. Characters, scenery, effects and music are all generated in code.

## Play locally

From the repository root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/> and enter through the Coming Soon card. Opening the game's URL directly sends you back to the arcade until you've entered the PIN. To publish the game, remove `Coming Soon - ` from the `<title>` in `index.html`.

## Set up the leaderboard

Do this once:

1. Open the Supabase project's **SQL Editor** and choose **New query**.
2. Paste all of [`leaderboard.sql`](leaderboard.sql) and choose **Run**.
3. Open **Leaderboard** in the game. It should say that there are no scores yet.

Scores are stored in the `grinch_heist_scores` table. The project URL and publishable key are in `js/leaderboard.js`. The key is meant to be public, and the SQL limits visitors to reading the board and adding scores. Scores are calculated in the browser, so the SQL rejects impossible scores, but a determined cheat could still post a believable fake. Delete entries with the commented queries at the bottom of the SQL file.

Scores are submitted from the Game Over screen, which then shows the top 10 with your entry highlighted. The main menu's **Leaderboard** button shows the same top 10. Only full games (**New Heist**) can be submitted, not Level Select practice runs.

## How it plays

- **Campaign:** 10 levels of 60 seconds each and 3 lives. Reach the getaway with at least one piece of loot to escape and earn an escape bonus, a time bonus (5 points a second) and a 150-point bonus if you were never caught. If time runs out, you keep 75% of the loot's points and lose a life. You get an extra life every 3,000 points (5 at most).
- **Level Select:** practice any level you've escaped from before (or the next one). Practice runs aren't scored online.
- **Sack:** Light, then Heavy (10% slower) at weight 12, then Overloaded (20% slower and easier to spot) at weight 24. Big loot weighs more.
- **Whos** see in a cone, blocked by houses, trees, stalls and walls. A suspicion meter fills ("?") and then they chase ("!"). Kids and the marching band shout for help instead of chasing. Guards stand still and sweep their view. Being caught stuns the Grinch and drops about 30% of the sack.
- **Dogs** sense the Grinch nearby, bark (which sends Whos to look) and snatch an item if he gets too close.
- **Max** turns up every 15 to 20 seconds. Usually he distracts a Who, digs up presents, fetches dropped loot or doubles points for 8 seconds. Sometimes he barks, crashes into the Grinch or gets tangled in lights.
- **Power-ups:** Sneaky Slippers, Invisibility Coat, Magnetic Sack, Max Distraction, Sugar Rush and Golden Gift.
- **Random events:** Christmas Light Chaos, Snowball Attack, Max's Present Find, Who Party, Christmas Tree Collapse and Golden Present.

## Levels

| # | Level | What's new |
| --- | --- | --- |
| 1 | Whoville Main Street | Tutorial hints, few Whos |
| 2 | Christmas Tree Lane | Tree groves, dogs |
| 3 | The Mayor's Neighborhood | Fancy houses, patrol loops |
| 4 | Whoville Christmas Market | Stalls, crowds, rolling carts |
| 5 | The Christmas Factory | Conveyor belts, wrapping presses |
| 6 | Snowy Residential District | Icy roads, snowmen, more dogs |
| 7 | The Mayor's Mansion | Guards, golden bells, a far-off getaway |
| 8 | Whoville Town Square | The giant tree, big crowds |
| 9 | The Christmas Parade | Floats, marching band, spectators |
| 10 | The Ultimate Christmas Heist | Everything at once |

Each level's map is built from a seed, so it looks the same every time. The loot on it is placed fresh for every heist.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys | Joystick (left) |
| Sneak | Shift (hold) | SNEAK (hold) |
| Speed boost | Space | BOOST |
| Pause | Escape or P | Pause button |
| Full screen | F | Settings or pause menu |
| Mute | M | Title screen or Settings |

The game goes full screen when a heist starts (turn this off in **Settings**). On phones it goes back to full screen on the next tap if the browser drops out of it. iPhones don't allow web pages to go full screen; there, **Share > Add to Home Screen** opens the game without the browser bar, using `manifest.json`. In portrait, the touch controls get their own strip under the picture.

## Files

| File | What it does |
| --- | --- |
| `js/main.js` | Start-up, screen sizing, full screen, game loop |
| `js/game.js` | States, level loading, crowd, scoring, caught/escape, camera, draw order |
| `js/world.js` | Map builder, collision, line of sight, ground layer |
| `js/levels.js` | Loot, power-up and level tables |
| `js/player.js` | The Grinch: movement, sack, power-up timers |
| `js/enemies.js` | Whos (vision, suspicion, chase) and dogs |
| `js/max.js` | Max and his jobs |
| `js/collectibles.js` | Loot and power-ups on the map |
| `js/hazards.js` | Carts, floats, presses, snowballs, falling trees |
| `js/events.js` | Random events |
| `js/hud.js` | In-game HUD, banners, arrows, hints |
| `js/ui.js` | Menus and screens |
| `js/leaderboard.js` | Supabase leaderboard |
| `js/storage.js` | Saved settings and progress |
| `js/audio.js` | Synthesized sound effects and music |
| `js/input.js` | Keyboard, joystick and buttons |
| `js/particles.js` | Particles, floating text, falling snow |
| `js/art/` | Drawing code for characters, loot and scenery |

Progress is saved in the browser under `grinchHeist.save`: best score, highest level escaped, lifetime loot and presents, the best score and stars on each level, and settings. **Reset Progress** (in Settings or High Scores) clears progress but keeps settings.
