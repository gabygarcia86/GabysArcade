# Droid-Chomp

A maze-chase arcade game. Pick a droid, collect every gear in the maze and dodge four evil droids across ten worlds, from Tatooine to Exegol. Clear a level and everyone stops to dance, enemies included. Clear all ten and it starts again, faster.

Built with HTML5 Canvas 2D, the Web Audio API and vanilla JavaScript. There are no libraries, no build step and no downloaded assets: every droid, planet, effect, sound and tune is generated in code, apart from the site icons in `icon/`. The menus use the arcade's Oxanium font when it's available.

This is a free, non-commercial fan project. Star Wars and its names and characters belong to Lucasfilm Ltd. and The Walt Disney Company, and the maze-chase idea comes from Pac-Man by Bandai Namco. This game isn't affiliated with or endorsed by any of them. All the music and sound is original.

## Contents

- [Run it](#run-it)
- [Controls](#controls)
- [How to play](#how-to-play)
- [The droids](#the-droids)
- [The ten levels](#the-ten-levels)
- [Difficulty](#difficulty)
- [Change the game](#change-the-game)
- [Saved data](#saved-data)
- [Publish it](#publish-it)
- [Code map](#code-map)

## Run it

The game uses plain scripts, not ES modules, so it runs from a web server or by opening `index.html` directly.

**While the game is Coming Soon**, `coming-soon-guard.js` sends visitors without a pass back to the arcade, and that includes double-clicking `index.html`. To test it, start a server from the root of the GabysArcade repository:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>, select the game in the Coming Soon section, and enter the PIN.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys or WASD | Direction pad, or swipe on the maze |
| Pause | Esc | Pause button |
| Start or confirm | Enter | Tap the button |
| Back out of a menu | Esc | Back button |

Menus also work with the arrow keys. The pad appears automatically on touch screens, and Options can force it on or off. The game fits portrait and landscape.

Movement is grid-based, and a direction press is buffered for half a second. Press early and your droid takes the next turn that way.

## How to play

Collect every gear to clear the level. Enemies hunt you the whole time, and one touch costs a life. Rebel insignias turn the tables for about 8 seconds: enemies turn blue, slow down and can be defeated. Blue enemies flash white just before the effect ends. Tunnels at the maze edges wrap to the other side and slow enemies down, but Exegol has none.

| Item | Points |
| --- | --- |
| Gear | 10 |
| Rebel insignia | 50 |
| Enemies on one insignia | 200, 400, 800, 1,600 |
| Level complete | 1,000 |
| All ten levels | 5,000 |

Leftover insignias don't block a level from ending. Only gears count.

## The droids

**Playable:** R2-D2, C-3PO, BB-8, K-2SO, Chopper, BD-1 and IG-11. The B1 Battle Droid unlocks when you clear Level 5, and stays unlocked. All eight play exactly the same, and each has its own animations, dance and voice. Until a player picks the B1, two of them appear as backup dancers.

**Enemies:**

| Enemy | Behavior |
| --- | --- |
| Imperial Probe Droid | Hunts you directly |
| Droideka | Aims four tiles ahead of you |
| KX Security Droid | Patrols the corners, then breaks off for bursts of pursuit |
| IG Assassin Droid | Mixes random turns with pincers set up off the Probe Droid |

## The ten levels

| # | World | Maze idea |
| --- | --- | --- |
| 1 | Tatooine | Classic layout with wide side blocks |
| 2 | Death Star | Concentric rings |
| 3 | Hoth | Long ice trenches, two tunnels |
| 4 | Endor | Winding trails, house at the top |
| 5 | Cloud City | Stair-step corridors, you start at the bottom |
| 6 | Mustafar | Long factory lines, you start at the top and the house is low |
| 7 | Geonosis | Corner rooms and two long tunnel rows |
| 8 | Coruscant | City blocks with three tunnels |
| 9 | Kamino | Serpentine lab corridors |
| 10 | Exegol | A symmetrical rune with no tunnels |

After Level 10 comes the galaxy celebration, then Level 1 again on the next cycle.

## Difficulty

Options has three settings, which apply from the next new game.

| Setting | Lives | Enemy speed | Insignia time |
| --- | --- | --- | --- |
| Cadet | 5 | 78% of yours | 10 s |
| Pilot | 3 | 82% of yours | 8 s |
| Jedi Master | 3 | 90% of yours | 6 s |

Each level and each cycle then adds speed for both sides, makes enemies react faster and chase harder, and shortens insignias. Insignias never drop below 3 seconds, and enemies never go above 97% of your speed, so the game gets very hard but stays beatable at any cycle. All these numbers are at the top of `js/LevelManager.js`.

## Change the game

**Edit or redraw a maze:** open `js/LevelData.js`. The comment at the top explains the symbols. Each maze is the left half of the board, and the game mirrors it. Then run the checker from the repository root:

```bash
node games/droid_chomp/tools/check-mazes.mjs
```

It reports dead ends, open rooms, unreachable tiles, the wrong number of insignias, unfair enemy starts and mazes that are too similar. All ten mazes pass it.

**Adjust difficulty:** `js/LevelManager.js`.

**Change points:** `js/ScoreManager.js`.

**Change a planet's colors, props or weather:** the `THEMES` table in `js/ThemeArt.js`.

**Change a dance:** the `DANCES` table in `js/AnimationManager.js`.

**Change the music:** the song tables at the top of `js/AudioManager.js`. Melodies are written as scale degrees.

## Saved data

Everything lives in one localStorage record, `droidChomp.save.v1`: the top five scores, the high score, your chosen droid, the B1 unlock and your options. If storage is blocked the game still runs, but it won't remember anything.

## Publish it

The game is in the Coming Soon section now. To release it, follow [Move a game from Coming Soon to the public library](../../README.md#move-a-game-from-coming-soon-to-the-public-library): remove `Coming Soon` from the `<title>` in `index.html` and from `title` in `data/catalog.js`, run `node tools/check-catalog.mjs`, and push. All paths are relative, so it works at any URL.

## Code map

```text
games/droid_chomp/
├── index.html              Page and script order
├── css/style.css           Menus, HUD and touch pad
├── tools/check-mazes.mjs   Validates all ten mazes
└── js/
    ├── utils.js            Shared namespace, helpers and SaveData
    ├── LevelData.js        ★ The ten mazes and enemy starts
    ├── Maze.js             Maze: walls, items and distance fields
    ├── Actor.js            Grid movement shared by every character
    ├── Player.js           Player and buffered turns
    ├── EnemyAI.js          Scatter and chase waves, the four personalities
    ├── Enemy.js            Enemy state machine
    ├── CollisionManager.js Touches and collecting
    ├── LevelManager.js     ★ Level, cycle and all difficulty numbers
    ├── ScoreManager.js     Score, lives and the high-score table
    ├── AudioManager.js     Sound effects, droid voices and the music sequencer
    ├── InputManager.js     Keyboard, touch pad and swipes
    ├── DroidArt.js         All twelve droids, and the baked Sprites cache
    ├── ThemeArt.js         The ten planets
    ├── AnimationManager.js Particles, popups, idles and dances
    ├── GameRenderer.js     Draws each frame
    ├── UIManager.js        Screens, HUD and banners
    ├── GameManager.js      Main loop and game flow
    └── main.js             Starts the game
```
