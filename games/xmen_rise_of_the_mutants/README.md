# X-Men: Rise of the Mutants

A 2D side-scrolling superhero action platformer with RPG progression. Twelve playable X-Men fight through a 20-level original story about the Mutant Nexus, a shattered alien energy source that is waking and twisting mutant powers around the world.

Everything is drawn in code with HTML5 Canvas (heroes, outfits, enemies, bosses, backgrounds, effects and menus), and all music and sound effects are synthesized with the Web Audio API. There's no build step and no external library.

> A non-commercial fan game. X-Men and its characters are trademarks of Marvel. The story, dialogue, level designs and artwork are original.

## Features

- **20 story levels**, each with its own environment, parallax background, enemy roster, hazards, a comic-book intro and a debrief.
- **12 playable X-Men** with different stats, movement and Basic, Special and Ultimate abilities. Six start on the team and six join as the story unfolds.
- **120 outfits**, 10 per hero, unlocked by levels, bosses, X symbols, hero levels and challenges. Outfits are cosmetic.
- **10 major bosses**, plus enhanced forms of Apocalypse and Mr. Sinister and Magneto's Elite Guardian. Every boss has three phases.
- **RPG progression**: XP and levels up to 30, a 10-stat upgrade tree, and six passives per hero.
- **Collectibles**: Mutant Energy Orbs, 3 hidden X symbols per level, secret rooms, Rare Upgrade Cores, health, X-Energy and Ultimate pickups.
- **Scoring** with 1–3 stars, an online top-10 leaderboard, 18 achievements, and a database of heroes, villains, enemies and concept art.
- Keyboard (rebindable), gamepad and touch controls (joystick and buttons you can move and resize).
- Autosave in the browser, plus settings for volume, quality, screen shake and full screen.
- **Main menu easter eggs**: the menu shows a fresh lineup of five unlocked heroes each time you return to it. Click or tap any of them for one of 10 silly antics per hero (120 in all), including pranks on teammates.

## Play locally

From the repository root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/> and enter through the Coming Soon card. While the game is Coming Soon, opening its URL directly sends you back to the arcade until you've entered the PIN.

The game uses plain scripts rather than ES modules, so opening `index.html` straight from disk also works once the Coming Soon guard has let you through. The leaderboard and any custom audio need http(s).

To publish the game, remove `Coming Soon - ` from the `<title>` in `index.html` and from the catalog `title` in `data/catalog.js`.

## Publish on GitHub Pages

The game is a folder of static files, so it publishes with the rest of the arcade:

1. Commit and push to `main`.
2. In the repository on GitHub, **Settings → Pages** should show **Deploy from a branch** with `main` and `/ (root)`.
3. After a minute or two the game is live at `https://<user>.github.io/GabysArcade/games/xmen_rise_of_the_mutants/`.

To host it on its own, copy this folder into any repository with Pages turned on. The only paths outside the folder are the shared font (`../../assets/fonts/`) and the Coming Soon guard script. If they're missing, the game falls back to system fonts and skips the guard.

## Set up the leaderboard

Do this once:

1. Open the Supabase project's **SQL Editor** and choose **New query**.
2. Paste all of [`leaderboard.sql`](leaderboard.sql) and choose **Run**.
3. Open **Leaderboard** from the game's main menu. It should say there are no scores yet.

Scores go in the `xmen_rise_of_the_mutants_scores` table. The project URL and publishable key are in `js/leaderboard.js`. The key is meant to be public, and the SQL only lets visitors read the board and add scores.

A **campaign score** is the best score from each cleared level (capped at 90,000 per level) plus 2,500 for every X symbol found. Players submit it from the **Game Over** screen, where the points from the run that just ended are added, or after finishing the campaign. Scores are calculated in the browser, so the SQL rejects impossible scores, but a determined cheat could still post a believable fake. To delete entries, use the commented queries at the bottom of the SQL file.

## Controls

| Action | Keyboard | Touch | Gamepad |
| --- | --- | --- | --- |
| Move | A / D or ← → | Joystick | Left stick / D-pad |
| Aim up, climb | W or ↑ | Joystick up | Up |
| Drop through ledge, climb down | S or ↓ (+ Jump) | Joystick down | Down |
| Jump (hold for gliders and Professor X) | Space | JUMP | A |
| Dodge | Shift | DODGE | B |
| Basic attack | J | ATK | X |
| Special | K | SPC | Y |
| Ultimate | L | ULT | RB / RT |
| Interact | E | USE (appears when near) | LB |
| Pause | Esc or P | ❚❚ button | Start |
| Character info | Tab | Pause → Character Info | Back |

Keys can be rebound in **Settings → Controls**. Touch buttons can be moved and resized in **Settings → Touch**.

## How to play

- **X-Energy** (blue bar) recharges over time and with hits. Specials cost X-Energy.
- **Ultimate charge** (the gold ring around the portrait) fills from orbs, hits and defeats. At 100% the ring flashes and the Ultimate is ready.
- Each level hides **3 X symbols**: some high up, some inside glowing **X-Seal crates** that only break with a Special or Ultimate, and some in **secret rooms** behind cracked walls.
- **Checkpoints** heal you and save your restart point. You have 3 lives per attempt.
- Some levels have **objectives** (free prisoners, destroy machines, disable towers, rescue students). The exit or boss arena stays locked until they're done.
- **Juggernaut** takes much more damage while he's dazed. **Blob** bounces basic shots off his belly. Only the real **Mystique** takes damage. **Magneto** raises magnetic shields that have to be broken first.

## Project structure

```text
xmen_rise_of_the_mutants/
├── index.html               Page, touch controls and script order
├── manifest.json            Full-screen web app settings
├── leaderboard.sql          Supabase table and access rules
├── css/style.css            Comic-book UI, HUD overlays, touch controls
├── audio/README.txt         How to add your own music and sound effects
├── assets/                  Reserved; the game draws everything in code
├── icon/                    Arcade thumbnails and favicons
└── js/
    ├── engine.js            Namespace, helpers, fixed-step loop, scaling canvas
    ├── saveSystem.js        localStorage save with safe defaults
    ├── audio.js             Synthesized music and effects, custom file support
    ├── input.js             Keyboard, gamepad, touch joystick and buttons
    ├── renderer.js          Shared drawing helpers
    ├── effects.js           Pooled particles, floating text, shake, flashes
    ├── camera.js            Follow camera that keeps the hero centered
    ├── physics.js           Tile collision, ledges, moving and crumbling platforms
    ├── collision.js         Hit queries
    ├── characters.js        The 12 heroes: stats, abilities, passives
    ├── characterCustomization.js  120 outfits and unlock rules
    ├── characterArt.js      Skeletal procedural hero art and animations
    ├── characterProgression.js    XP, levels, upgrades, final stats
    ├── player.js            Hero movement and meters
    ├── combat.js            Projectiles, melee, beams, damage
    ├── characterAbilities.js      All 36 Basic, Special and Ultimate abilities
    ├── collectibles.js      Orbs, X symbols and pickups
    ├── enemies.js           Enemy roster, behaviors and art
    ├── bosses.js            Boss attack patterns, phases and art
    ├── backgrounds.js       20 themes, parallax layers, weather, tile sets
    ├── levels.js            Level builder, chunk library, the 20 levels
    ├── story.js             Story text and the comic-panel player
    ├── achievements.js      Achievement rules
    ├── leaderboard.js       Supabase leaderboard client
    ├── game.js              The level in play: arenas, bosses, objectives, scoring
    ├── ui.js                In-game HUD and toasts
    ├── menus.js             Every menu screen
    ├── menuAntics.js        Silly antics when you click heroes on the main menu
    └── main.js              App flow and the main loop
```

## Debugging

Add `?debug` to the URL to draw hit boxes. Save data lives in `localStorage` under `xmenRiseOfTheMutants.save.v1`. **Settings → Data → Delete saved data** clears it, keeping settings.
