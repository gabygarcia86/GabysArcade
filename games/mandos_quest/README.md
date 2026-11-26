# Mando's Quest

A 2D platform action-adventure in HTML5 Canvas and vanilla JavaScript. A Mandalorian bounty hunter rescues Baby G and crosses ten worlds to stop Moff Gideon from using the Star Map Core. Between the worlds are three side-scrolling space battles, for 13 levels in all.

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

### On the ground

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

### In space

| Action | Keyboard | Touch |
| --- | --- | --- |
| Fly | WASD or arrow keys | Stick |
| Fire | J or Space (hold) | Fire (hold) |
| Seeker rockets | K | Rockets |
| Install the highlighted upgrade | L | Upgrade |
| Shield | Shift | Shield |
| Pause | Escape | Pause button |

On phones and tablets, starting, restarting or retrying a level switches to full screen where the browser allows it. iPhone browsers don't, so the game runs in the normal window there. **Options > Toggle fullscreen** works on any browser that supports it.

## Campaign

| Level | Title | Planet | Boss | Unlocks |
| --- | --- | --- | --- | --- |
| 1 | The Hidden Child | Arvala-7 | | Baby G, Force Push |
| 2 | The Mudhorn Valley | Arvala-7 | Mudhorn | Vibroblade, health, stronger push |
| 3 | The Nevarro Underworld | Nevarro | | Whistling Birds, faster blaster, stronger push, colors |
| 4 | **Escape from Nevarro** | Space battle | Warden Gunship | Spread Shot, ship health, collectible |
| 5 | The Reptavian Nest | Nevarro Wilderness | Reptavians | Pulse Rifle, health, armor |
| 6 | The Sands of Tatooine | Tatooine | | Jetpack, Heavy Blaster, wider push |
| 7 | The Mythosaur Awakens | Mandalore | Krayt Dragon | Flamethrower, fuel, push range |
| 8 | **Mandalore Orbit** | Space battle | Orbital Bastion | Laser Cannon, improved shield, ship speed |
| 9 | The Living Legend | Mandalore | Mythosaur | Wrist Rockets, thrusters, heavy objects |
| 10 | The Imperial Fortress | Frozen Fortress | Imperial Guardian (mini-boss) | Disruptor Rifle, plating, damage |
| 11 | The Star Map Core | Imperial Command Ship | | Twin blaster, Force Burst |
| 12 | **Assault on Gideon's Fleet** | Space battle | Gideon's Command Ship | Vanguard loadout, ship health, collectible |
| 13 | The Darksaber | Star Map Citadel | Moff Gideon | Final Arsenal |

On the ground there are five major bosses, in Levels 2, 5, 7, 9 and 13, and the Imperial Guardian is a mini-boss. Each space battle has a mini-boss along the way and a three-phase boss at the end.

Every level is also scattered with **credit chips**, worth 25 points each before the difficulty multiplier. On the ground they sit in rows, jump arcs and stacks over every floor, ledge and slope, and some are only reachable with upgrades from later levels. The level panel shows how many you've collected out of the total. In the space battles, formations of chips stream in between the waves. `scatterCredits` in `js/levelBuilder.js` places the ground chips automatically from each level's layout, seeded by level number so the layout is the same on every attempt. Its settings are in `CREDITS` at the bottom of that file.

Each of the ten ground levels hides three Bounty Pucks. Some need upgrades from later levels, so they're meant for replays. Clearing all ten worlds and finding all 30 pucks unlocks the Darksaber and its nine blade colors.

## Space battles

The screen scrolls by itself. Shoot down the waves, dodge what you can't shoot, and collect capsules. They come from ships with a gold glow, from big targets, and now and then from anything else.

Each capsule moves the highlight one place along the upgrade bar. Install the highlighted upgrade, or keep collecting to reach a later one.

| Upgrade | Effect | Levels | Available |
| --- | --- | --- | --- |
| Speed Up | Faster flight | 3 | Always |
| Twin Blaster | Two bolts, then three | 2 | Always |
| Spread Shot | Angled bolts | 2 | After Level 4 |
| Rear Shot | Fires backward, for ships that circle behind | 2 | Always |
| Missile Launcher | Missiles that drop to different heights, then fly ahead and seek targets near their height. Some go all the way down and seek targets on the surface | 2 | Always |
| Energy Shield | Absorbs damage until it's used up | 1 | Always. Stronger after Level 8 |
| Laser Cannon | A piercing beam | 2 | After Level 8 |

The Shield button is separate: two short deflector charges that recharge over time.

Losing a life costs upgrades by difficulty. Story keeps them all, Standard keeps the first half installed, and Veteran keeps none.

## Scoring

- A level scores points for defeated enemies, bosses, objectives and credit chips, plus completion, time and remaining-life bonuses.
- Difficulty multiplies the level score: Story 75%, Standard 100%, Veteran 125%. It's fixed when the level starts.
- The campaign score is the best score from each of the 13 levels, plus 1,500 for each Bounty Puck. A game over also counts that run's points if they beat the level's best.

The online leaderboard still counts the ten worlds (0 to 10), so the Supabase table didn't need changing when the space battles were added. The game holds a submitted score to that table's limit.

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
    ├── levels/             ★ level01-10: the worlds. space01-03: the space battles
    ├── space/              The space battles, separate from the platforming
    │   ├── spaceData.js             ★ Ship, upgrades, enemies and tuning
    │   ├── spaceLevelManager.js     One attempt at a space battle
    │   ├── spaceWaveManager.js      The wave commands and timeline
    │   ├── spacePlayer.js           The gunship
    │   ├── spaceWeaponManager.js    Guns and the upgrade bar
    │   ├── spaceProjectile.js       Pooled projectiles
    │   ├── spaceEnemy.js            Pooled enemies and their flight paths
    │   ├── spaceObstacle.js         Pooled hazards and structures
    │   ├── spaceBoss.js             The three space bosses
    │   ├── spacePowerUp.js          Pooled capsules and repair kits
    │   ├── spaceCollisionManager.js Space collisions
    │   ├── spaceBackground.js       Parallax backdrops
    │   ├── spaceParticleSystem.js   Pooled effects without gravity
    │   └── spaceUIManager.js        The space HUD
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
    ├── collectibleManager.js  Bounty Pucks, credit chips and pickups
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
    ├── notices.js          Popup placement on touch and small screens
    ├── cinematics.js       Story scenes
    ├── menuAntics.js       Main menu easter eggs: click Mando or Baby G
    ├── screens.js          Menu markup
    ├── uiManager.js        Menu behavior
    ├── utils.js            Shared helpers
    └── art/                All procedural drawing
```

The scripts are plain files on `window.MQ`, not modules, so the game also runs from `file://`.

## Editing a level

The ten ground levels keep their own numbers, 1 to 10, in their file names and `id`. `GROUND_STAGES` and `SPACE_STAGES` at the top of `js/gameData.js` place them and the space battles in the 13-level campaign. Everywhere else, including `after` in `gameData.js`, a level number means its place among the 13.

Ground levels are written with the commands in `js/levelBuilder.js`:

```js
b.ground(0, 900, 800);                    // left, right, surface height
b.ledge(950, 690, 120);                   // left, top, width
b.foe("stormtrooper", 400, 800);          // type, middle, feet
b.puck(1000, 640);
```

A jump climbs about 150px and crosses about 250px. Keep exactly three pucks in each ground level, and make sure each objective's `done` id is produced by something in that level.

Space battles are a timeline in each `space` file's `script(b)`, written with the commands in `js/space/spaceWaveManager.js`:

```js
b.wave("fighter", "vee", { n: 5, y: 360, capsule: true });
b.wait(4);                                        // seconds until what follows
b.surface("bottom", 10, 80, { style: "station", turrets: [0.3, 0.7] });
b.opening(300, 220);                              // middle, size of the gap
b.boss();                                         // always last
```

## Saved progress

Progress saves automatically in this browser under `mandosQuest.save.v2`. A save from the ten-level game (`mandosQuest.save.v1`) is converted the first time and left in place as a backup. It keeps its unlocks and open levels, and the space battles start unplayed. **Reset all progress**, in the Story Mode menu and in Options, erases it after a confirmation and keeps the settings. The Story Mode menu appears once there's a cleared level or a collected puck.

## Publishing

The game is Coming Soon while its `<title>` starts with those words. To publish it, remove them from the title in `index.html` and in `data/catalog.js`.

## TODO

- Update with new music
- Update credits to reflect new music and copyright warning
