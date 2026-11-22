# Mando's Quest

A 2D platform action-adventure in HTML5 Canvas and vanilla JavaScript. A Mandalorian bounty hunter rescues Baby G and crosses ten worlds to stop Moff Gideon from using the Star Map Core.

It has no build step, dependencies, or image and audio assets apart from the icons. Characters, worlds, effects and music are generated in code.

An unofficial, non-commercial fan game, not affiliated with or endorsed by Lucasfilm or Disney.

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

The project URL and publishable key are in `js/leaderboard.js`. The key is meant to be public, and the SQL limits visitors to reading the board and adding scores. Scores are calculated in the browser, so a determined cheat could post a believable fake. Delete entries with the commented queries at the bottom of the SQL file.

Scores can be submitted on Game Over and after the credits. A finished run that wasn't submitted waits on the main menu's Leaderboard screen.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A / D or Left / Right | Arrow buttons, or slide between them |
| Jump | Space (hold for higher) | Jump |
| Jetpack | Hold Space while airborne | Hold Jump |
| Attack | J (hold for continuous fire) | Fire |
| Charged Darksaber wave | Hold J, then release | Hold Fire, then release |
| Force Push | K | Force |
| Change weapon | L | Weapon |
| Dodge | Shift, or double-tap a direction | Double-tap an arrow |
| Drop through a ledge | S or Down | Drop |
| Pause | Escape | Pause button |

On phones and tablets, starting, restarting or retrying a level switches to full screen where the browser allows it. iPhone browsers don't, so the game runs in the normal window there. **Options > Toggle fullscreen** works on any browser that supports it.

## Campaign

| Level | Title | Planet | Boss | Unlocks |
| --- | --- | --- | --- | --- |
| 1 | The Hidden Child | Arvala-7 | | Baby G, Force Push |
| 2 | The Mudhorn Valley | Arvala-7 | Mudhorn | Vibroblade, health, stronger push |
| 3 | The Nevarro Underworld | Nevarro | | Whistling Birds, faster blaster, stronger push, colors |
| 4 | The Reptavian Nest | Nevarro Wilderness | Reptavians | Pulse Rifle, health, armor |
| 5 | The Sands of Tatooine | Tatooine | | Jetpack, Heavy Blaster, wider push |
| 6 | The Mythosaur Awakens | Mandalore | Krayt Dragon | Flamethrower, fuel, push range |
| 7 | The Living Legend | Mandalore | Mythosaur | Wrist Rockets, thrusters, heavy objects |
| 8 | The Imperial Fortress | Frozen Fortress | Imperial Guardian (mini-boss) | Disruptor Rifle, plating, damage |
| 9 | The Star Map Core | Imperial Command Ship | | Twin blaster, Force Burst |
| 10 | The Darksaber | Star Map Citadel | Moff Gideon | Final Arsenal |

There are five major bosses, in Levels 2, 4, 6, 7 and 10. The Imperial Guardian is a mini-boss.

Every level hides three Bounty Pucks. Some need upgrades from later levels, so they're meant for replays. Clearing all ten levels and finding all 30 pucks unlocks the Darksaber and its nine blade colors.

## Scoring

- A level scores points for defeated enemies, bosses and objectives, plus completion, time and remaining-life bonuses.
- Difficulty multiplies the level score: Story 75%, Standard 100%, Veteran 125%. It's fixed when the level starts.
- The campaign score is the best score from each level, plus 1,500 for each Bounty Puck. A game over also counts that run's points if they beat the level's best.

If you change scoring in `js/progressionManager.js`, update the limit in `leaderboard.sql` to match. `create table if not exists` won't change a table that already exists, so alter the `score_possible` constraint in Supabase as well.

## Files

```text
mandos_quest/
├── index.html              Page, touch controls and script order
├── style.css               Menus, responsive layout and touch controls
├── leaderboard.sql         One-time Supabase setup
├── audio/README.md         How to add music and sound effects
├── icon/                   Game icons
└── js/
    ├── main.js             Starts the game
    ├── gameEngine.js       Frame loop and Canvas scaling
    ├── gameStateManager.js Menus, story flow, pause and results
    ├── world.js            One attempt at a level, and the rules joining every system
    ├── gameData.js         ★ Weapons, armor, colors, upgrades and tuning
    ├── levels/             ★ The ten levels: layout, enemies, pucks and story
    ├── levelBuilder.js     The commands available to level files
    ├── levelManager.js     Platforms, hazards, switches, triggers and encounters
    ├── player.js           The Mandalorian
    ├── babyG.js            Companion behavior
    ├── forceAbility.js     Force Push
    ├── jetpack.js          Flight and fuel
    ├── weaponManager.js    Weapons, aim assist and ammunition
    ├── projectile.js       Pooled projectiles
    ├── enemy.js            Enemy types, attacks and AI
    ├── boss.js             Boss fights
    ├── collectibleManager.js  Bounty Pucks and pickups
    ├── collisionManager.js Platform, slope and wall collision
    ├── camera.js           Follow camera and arena framing
    ├── particleSystem.js   Pooled effects
    ├── animationManager.js Procedural poses
    ├── customization.js    Armor and helmet choices
    ├── progressionManager.js  XP, unlocks and scoring
    ├── saveManager.js      localStorage
    ├── audioConfig.js      ★ Your audio file paths
    ├── audioManager.js     Playback and generated audio
    ├── inputManager.js     Keyboard and multi-touch
    ├── leaderboard.js      Supabase requests
    ├── hud.js              In-game display
    ├── cinematics.js       Story scenes
    ├── screens.js          Menu markup
    ├── uiManager.js        Menu behavior
    ├── utils.js            Shared helpers
    └── art/                All procedural drawing
```

The scripts are plain files on `window.MQ`, not modules, so the game also runs from `file://`.

## Editing a level

Levels are written with the commands in `js/levelBuilder.js`:

```js
b.ground(0, 900, 800);                    // left, right, surface height
b.ledge(950, 690, 120);                   // left, top, width
b.foe("stormtrooper", 400, 800);          // type, middle, feet
b.puck(1000, 640);
```

A jump climbs about 150px and crosses about 250px. Keep exactly three pucks in each level, and make sure each objective's `done` id is produced by something in that level.

## Saved progress

Progress saves automatically in this browser under `mandosQuest.save.v1`. **Options > Reset all progress** erases it after a confirmation and keeps the settings.

## Publishing

The game is Coming Soon while its `<title>` starts with those words. To publish it, remove them from the title in `index.html` and in `data/catalog.js`.

## TODO

- Fix text popups appearing over the character making it unable to see what your doing
- Update with new music
- Update credits to reflect new music and copyright warning
- Add ship levels?
- On main menu, easter egg clicking on baby G does different animations 
- On main menu, easter egg clicking on Mando makes him fart and do other animations
- fix spawn location of laser blast from  main character
- Make flame thrower shoot farther 