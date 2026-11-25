# UFO Abduction

A silly retro arcade game in HTML5 Canvas and vanilla JavaScript. Fly a flying saucer over Earth, beam up cows, chickens, farmers and tourists before the clock runs out, dodge angry bulls, police helicopters and lightning clouds, and rescue your stranded alien family.

It has no build step, dependencies, or image and audio assets apart from the icons. Characters, scenery, effects and music are all generated in code.

## Play locally

From the repository root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/> and enter through the Coming Soon card. Opening the game's URL directly sends you back to the arcade until you've entered the PIN.

## Set up the leaderboard

Do this once:

1. Open the Supabase project's **SQL Editor** and choose **New query**.
2. Paste all of [`leaderboard.sql`](leaderboard.sql) and choose **Run**.
3. Open **Leaderboard** in the game. It should say that there are no scores yet.

Classic and Endless each have their own top 10, stored in one table (`ufo_abduction_scores`) and split by its `mode` column. The project URL and publishable key are in `js/leaderboard.js`. The key is meant to be public, and the SQL limits visitors to reading the boards and adding scores. Scores are calculated in the browser, so the SQL rejects impossible scores but a determined cheat could still post a believable fake. Delete entries with the commented queries at the bottom of the SQL file.

Scores are submitted from the Game Over screen, which then shows the top 10 with your entry highlighted. The main menu's **Leaderboard** button shows both boards.

## Modes

- **Classic Arcade:** five levels (Country Farm, Suburbia, Desert Town, Big City, Tropical Island), 60 seconds for the first, then 10 seconds longer each level (100 seconds for the last), three hull points. A repair crew patches one hull point between levels.
- **Endless Abduction:** no clock. The world changes every 60 seconds and gets tougher each zone. Zones visit all five places, each by day or night at random, in a shuffled order, and every place comes up once before any of them repeats. Play until the saucer goes down.

## Customize UFO

**Customize UFO** on the main menu changes how your saucer looks. Every ship is the same size and flies the same, so the choice is only for looks. The preview animates as you choose, and **Surprise Me!** picks a random look.

- **Ship:** Classic Saucer, Mothership, Diamond, Ring Runner, Bubble Pod, Retro Bell, Space Jelly, Star Cruiser, Teacup or Burger Bomber.
- **Colors:** hull (10 colors), trim (9) and dome glass (6).
- **Lights:** the rim light pattern (Rainbow, Chase, Steady, Twinkle, Siren, Disco or Off) and the color that Chase, Steady and Twinkle use.
- **Accessories:** Antenna, Nothing, Party Hat, Crown, Propeller, Cowboy Hat, Big Bow, Flower, Flag, Radar Dish, Horns or Halo.
- **Driver:** Zib, Blorp, Trix, Grey, Gloop, Fuzz, Mew or Robo.

The look is saved with your settings and kept by **Reset progress**.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Fly | WASD or arrow keys | Joystick (left) |
| Tractor beam | Space (hold) | BEAM button (right, hold) |
| Pause | Escape or P | Pause button |

Settings can switch the beam to tap-to-toggle, fix the joystick in place, swap the controls for left-handed play, and show or hide the touch controls. In portrait, the controls get their own strip under the picture.

Phones and tablets switch to full screen on the first tap, and again on the next tap if the browser drops out of it. Browsers only allow full screen after a tap, so the title screen shows first. Turning full screen off in **Settings** stops it switching back on. iPhones don't allow web pages to go full screen; there, **Share > Add to Home Screen** opens the game without the browser bar, using `manifest.json`.

## How it plays

- The beam only reaches so far, so fly low to grab things. Targets float up in about one to two seconds; move too fast or let go and they drop.
- Hazards have angry eyebrows and a red ring under them. Beaming one turns the beam red; keep holding and the saucer takes damage.
- Abducting quickly builds a combo: x2 at 4 in a row, up to x5. Damage or a 4-second gap resets it. Streaks of 5 and 10 pay bonuses.
- Seven alien relatives hide on rooftops, towers and in bushes. They pop up and wave when you fly close. Rescue all seven in one game for the Family Reunion (+10,000). Rescued relatives unlock portraits in the Family Album.
- Power-ups: Super Beam, Energy Shield, Speed Boost, Repair Kit, Double Points and Alien Beacon (arrows to stranded aliens).

## Files

| File | What it does |
| --- | --- |
| `js/main.js` | Start-up, screen sizing, game loop, auto-pause, full screen |
| `js/game.js` | State machine, stages, spawning, events, camera, draw order |
| `js/player.js` | Saucer movement, health, power-up timers, crash |
| `js/tractorBeam.js` | Beam range, shape and visuals |
| `js/targets.js` | People and animals: points, behaviours, lifting |
| `js/hazards.js` | Hazards and pooled projectiles |
| `js/alienRescue.js` | The alien family, rescues and the reunion celebration |
| `js/powerups.js` | Power-ups |
| `js/levels.js` | Level settings and Endless zones |
| `js/scoring.js` | Score, combo and bonuses |
| `js/hud.js` | In-game HUD, banners and indicators |
| `js/ui.js` | Menus and screens |
| `js/leaderboard.js` | Supabase leaderboard |
| `js/storage.js` | Saved settings, high scores and album |
| `js/audio.js` | Synthesized sound effects and music |
| `js/input.js` | Keyboard, joystick and beam button |
| `js/particles.js` | Pooled particles and floating text |
| `js/collision.js`, `js/utils.js` | Helpers |
| `js/art/` | Drawing code for the saucer, characters, hazards and scenery. `ufoArt.js` also lists every Customize UFO option |

Progress is saved in the browser under `ufoAbduction.save`. Damaged or missing data is replaced with defaults. **Settings > Reset progress** clears high scores and the album but keeps settings.
