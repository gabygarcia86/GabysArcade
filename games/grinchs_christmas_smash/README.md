# Grinch's Christmas Smash!

A silly physics arcade game in HTML5 Canvas and vanilla JavaScript. The Grinch has had enough of Christmas decorations: fling giant snowballs from his Snow-Slinger at towers of presents, ornaments, candy canes, snowmen and Christmas trees, knock everything over and chain the smashes into huge combos.

It has no build step, libraries or image and audio files apart from the icons. The physics engine, characters, decorations, scenery, sound effects and music are all made in code.

## Play locally

From the repository root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/> and enter through the Coming Soon card. Opening the game's URL directly sends you back to the arcade until you've entered the PIN. To publish the game, remove `Coming Soon - ` from the `<title>` in `index.html` and from its entry in `data/catalog.js`.

## Set up the leaderboard

Do this once:

1. Open the Supabase project's **SQL Editor** and choose **New query**.
2. Paste all of [`leaderboard.sql`](leaderboard.sql) and choose **Run**.
3. Open **Leaderboard** in the game. It should say that there are no scores yet.

Scores are stored in the `grinch_smash_scores` table. The project URL and publishable key are in `js/leaderboard.js`. The key is meant to be public, and the SQL limits visitors to reading the board and adding scores. Scores are calculated in the browser, so the SQL rejects impossible scores, but a determined cheat could still post a believable fake. Delete entries with the commented queries at the bottom of the SQL file.

Scores are submitted from the Game Over screen, which then shows the top 10 with your entry highlighted. The main menu's **Leaderboard** button (and **High Scores > Online Leaderboard**) shows the same top 10. Only full runs (**Play**) can be submitted, not Level Select practice games.

## How it plays

- **Aim:** press anywhere and drag back, then let go. The further you pull, the harder the throw. A dotted line shows the path and a meter shows the power (green, yellow, red).
- **Win a level:** reach the goal score before the snowballs run out. 1 star for the goal, 2 and 3 stars for more. Once the goal is reached a **Finish Level** button appears; each unused snowball is worth 750 points.
- **Runs:** **Play** starts at level 1 with 3 lives. Failing a level costs a life and you try it again. The run ends when the lives run out, after level 20, or when you choose **End Run**. Then you can submit your score.
- **Damage:** every bump damages things by how much it changes their speed, so light things break easily and heavy ones mostly break by falling. Snowmen, trees and gingerbread men count as smashed once they're knocked over, and anything knocked off the edge counts too.
- **Combos:** smashes within 1.3 seconds of each other form a chain: x2 points at 5, x3 at 10 and x5 at 20, plus a chain bonus (10 x length squared) for chains of 5 or more. Big chains get announcements ("SMASHING!", "HO HO OH NO!", "TOTAL CHRISTMAS MELTDOWN!"), slow motion and Grinch reactions.
- **Bonuses:** unused snowballs, Total Destruction (+2,000 for smashing everything), the Mega Tree (+2,500), golden presents (+500 and a bonus snowball) and the rainbow snowball's multi-hit bonus.
- **Random events** (between shots, at most two a level): Snowball Frenzy, Ornament Storm, Max's Accident, Christmas Tree Collapse and Golden Present Bonus.

### Snowballs

| Snowball | What it does | Unlocked |
| --- | --- | --- |
| Snowball | Standard | From the start |
| Mega | Bigger and much heavier | Beat level 1 |
| Bouncy | Bounces all over | Beat level 2 |
| Explosive | Blasts on impact; tap in flight to set it off early | Beat level 4 |
| Split | Splits into three at the top of its arc, or when you tap | Beat level 6 |
| Rainbow | Each different thing it hits adds a growing bonus | Beat level 9, or 3 stars on 5 levels |

Each level gives a set of snowballs. Types you haven't unlocked yet become normal snowballs. Pick which to throw next from the tray at the bottom left (or keys 1-9).

## Levels

| # | Level | What's new |
| --- | --- | --- |
| 1 | The Christmas Tree | Aiming and launching |
| 2 | Present Tower | Tall stacks that collapse |
| 3 | Candy Cane Chaos | Candy cane shelves, bouncy snowballs |
| 4 | Snowman Attack | Snowman dominoes on snowy terraces |
| 5 | Ornament Overload | Shelves of fragile glass, a giant ornament |
| 6 | The Gingerbread Village | Gingerbread houses, giant gingerbread men, explosive snowballs |
| 7 | Christmas Light Nightmare | Hanging decorations and light strings that tangle |
| 8 | The Giant Present | Huge heavy presents with an explosive one inside |
| 9 | Bells and Whistles | Heavy bells and the golden bell |
| 10 | The Mega Christmas Tree | One enormous tree between two scaffolds |
| 11 | The Ice Palace | Slippery ice blocks |
| 12 | The Floating Workshop | Floating islands at every height |
| 13 | Domino Derby | A long domino run into a giant tree |
| 14 | Stocking Stuffers' Mantel | A packed fireplace mantel |
| 15 | Giant Ornament Alley | Giant ornaments waiting at the top of a hill |
| 16 | The Explosive Workshop | Explosive presents that set each other off |
| 17 | Gingerbread Castle | Towers, walls and gingerbread guards |
| 18 | Snowman Army on Ice | Rows of snowmen on slippery ice |
| 19 | The North Pole Express | A present train on a bridge, a dangling giant ornament |
| 20 | Total Christmas Meltdown | Everything at once |

## Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Aim and throw | Drag back and release | Drag back and release |
| Split / detonate | Click or Space while it flies | Tap while it flies |
| Pick snowball | Click the tray, or 1-9 | Tap the tray |
| Pause | Escape or P, or the pause button | Pause button |
| Restart level | R | Pause > Restart Level |
| Mute | M | Title screen or Settings |
| Full screen | F | Title screen or Settings |

The game asks for full screen on the first tap ("Tap to Play") and again when a game starts (turn this off in **Settings**). On phones it goes back to full screen on the next tap if the browser drops out of it, and asks for landscape. iPhones don't allow web pages to go full screen; there, **Share > Add to Home Screen** opens the game without the browser bar, using `manifest.json`.

The whole 1920 x 1080 stage is always in view at the same proportions, so the physics behaves the same on every screen. Wider or taller screens show more sky and snow around it.

## Files

| File | What it does |
| --- | --- |
| `js/main.js` | Start-up, screen sizing, full screen, mouse/touch/keyboard, game loop |
| `js/game.js` | States, level loading, damage and smashing, snowballs, explosions, bells, light strings, level end, runs, drawing |
| `js/physics.js` | The physics engine: circles and convex polygons, stacking contacts, friction, sleeping, ropes |
| `js/objects.js` | Every decoration: shape, material, points and toughness |
| `js/levels.js` | The level builder, the 20 levels and the snowball unlock table |
| `js/scoring.js` | Points, chains, multipliers and combo messages |
| `js/player.js` | The Grinch's animations, reactions and lines |
| `js/events.js` | Random events and Max |
| `js/particles.js` | Particles, floating text, shockwaves and falling snow |
| `js/hud.js` | In-game score, goal bar, combo meter and banners |
| `js/ui.js` | Menus and screens, the snowball tray |
| `js/leaderboard.js` | Supabase leaderboard |
| `js/storage.js` | Saved settings and progress |
| `js/audio.js` | Synthesized sound effects and music |
| `js/art/` | Drawing code for the Grinch, launcher, snowballs, Max, decorations and scenery |

Progress is saved in the browser under `grinchSmash.save`: settings (music and sound volume, mute, full screen, aim guide), best score, highest level completed, the best score and stars on each level, lifetime smashes, chain reactions, best combo, golden presents and unlocked snowballs. **Reset Progress** (in High Scores) clears progress but keeps settings.
