# Jedi Story

A 2D side-scrolling lightsaber platformer. Build your own Jedi and cross ten worlds, from a burning Jedi Temple to the Emperor's throne room on Exegol, with a boss fight every second level.

Built with HTML5 Canvas 2D, the Web Audio API and vanilla JavaScript. There are no libraries, no build step and no downloaded assets: every character, planet, effect, sound and music cue is generated in code, apart from the site icons in `icon/`. The menus use the arcade's Oxanium font when it's available.

This is a free, non-commercial fan project. Star Wars and its names and characters belong to Lucasfilm Ltd. and The Walt Disney Company, and this game isn't affiliated with or endorsed by them. The music is original.

## Contents

- [Run it](#run-it)
- [Controls](#controls)
- [How to play](#how-to-play)
- [The campaign](#the-campaign)
- [Add your own sounds and music](#add-your-own-sounds-and-music)
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
| Move | A / D or Left / Right | Arrow buttons |
| Jump (hold to jump higher) | Space | JUMP |
| Double jump (from level 3) | Space in midair | JUMP in midair |
| Lightsaber attack | J | SABER |
| Force Push | K | PUSH |
| Deflect (hold) | L | DEFLECT |
| Drop through a thin platform | S or Down + Space | Not available |
| Pause | Esc | II button |
| Advance a story screen | Space, J or Enter | Tap the game |
| Skip a story screen | Esc | Tap through it |

Menus also work with the arrow keys, Enter and Esc. Touch controls appear automatically on touch screens, and Options can force them on or off. On a phone the game plays best held sideways.

## How to play

**Health and lives.** You have 100 health and 3 lives per level. Falling in a pit costs 25 health and puts you back on the last safe ground. Losing all your health costs a life and returns you to the last checkpoint. In a boss fight, you and the boss both go back to your corners and the boss keeps its damage. With no lives left you can continue from the checkpoint at half score, or restart the level.

**Attacking.** Press Attack repeatedly to chain a combo. Your combo grows from two strikes to four over the campaign. A double blade has slightly less reach but also hits behind you.

**Force Push.** This spends Force energy, which refills over time. It shoves enemies, and knocking one into a pit scores 1.5× points. It also breaks guards, throws rocks back at bosses, triggers switches, slides crates, and smashes cracked walls.

**Deflect.** Hold it to raise your blade. Holding drains Force energy slowly, and you can't walk. Press it just before a hit lands for a **PERFECT**: a blaster bolt flies straight back at the shooter, and a sword strike is **PARRIED**, leaving the attacker wide open. Deflect only covers the direction you're facing, and bosses mark unblockable attacks with a red glow.

**Bosses.** A boss guards while idle, so swinging at one usually gets blocked. Wait for an attack, then punish the recovery, parry it with a timed Deflect, or break the guard with Force Push. Bosses drop bacta at set points in the fight.

**Collectibles.** Each level has kyber crystals for score and three hidden holocrons worth 500 points each. Holocrons are behind cracked walls, on ledges just inside pits, and on high platforms above the usual view.

### Upgrades

An upgrade arrives when you start its level, and upgrades are kept for replays.

| Level | Upgrade |
| --- | --- |
| 1 | Lightsaber, Jump, Force Push, Deflect |
| 2 | Three-strike combo |
| 3 | Double jump |
| 4 | Stronger, longer, cheaper Force Push |
| 5 | Wider perfect window, and perfect deflections home in on targets |
| 6 | Aerial saber spin: attack in midair, up to three times per jump |
| 7 | Force meter grows to 150 and refills faster |
| 8 | Four-strike combo with a whirling finisher |
| 9 | Force Push shatters guards and stuns longer |
| 10 | All powers |

## The campaign

| # | Level | Location | Boss |
| --- | --- | --- | --- |
| 1 | The Jedi Awakening | Jedi Temple, Coruscant | |
| 2 | The Forest of Secrets | Kashyyyk | Darth Maul |
| 3 | The Desert Trial | Tatooine | |
| 4 | The Fallen Temple | Mustafar | Count Dooku |
| 5 | The Frozen Frontier | Hoth | |
| 6 | The Shadow City | Nar Shaddaa | Asajj Ventress |
| 7 | The Imperial Stronghold | Forest Moon of Endor | |
| 8 | The Dark Side Rises | Death Star II | Darth Vader |
| 9 | The Ancient Sith World | Exegol | |
| 10 | The Final Confrontation | Emperor's Throne Room, Exegol | Emperor Palpatine |

Story Mode runs the levels in order and unlocks each one as you finish the last. Level Select replays any unlocked level. Replays keep your best score and never move your campaign backward.

### Boss guide

| Boss | Moves | How to beat them |
| --- | --- | --- |
| Darth Maul | Dash slash, advancing blade spin, thrown double blade, leap with shockwaves, Force shove | Jump the shockwaves and the throw. He's dizzy after a spin and unarmed while his blade is away |
| Count Dooku | Triple thrust, counter stance, Force Lightning, thrown rocks, lava flares | Don't strike his counter stance: Force Push breaks it. Push rocks back at him. Jump the lightning or time a Deflect to reflect it |
| Asajj Ventress | Four-hit flurry, twin thrown blades, perch and plunge, vanish and backstab, shadow copies | When she vanishes, watch for smoke behind you. One saber touch dissolves a shadow copy |
| Darth Vader | Heavy slash, slash chains, straight saber throw, Force Choke, Force Pull, hurled debris, floor surges | Hit or push him during the choke wind-up to stop it. If you're caught, hammer any action button. He ignores Force Push the rest of the time. In the surges, stand in the gap |
| Emperor Palpatine | Homing orbs, lightning strikes, teleports, lightning sweeps, orb rings, summoned guards, lightning clashes | Reflect his orbs back at him. Beat the guards to drop his shield. In a clash, hammer Attack. The killing blow starts one last clash |

## Add your own sounds and music

Every sound and music track has a generated version, so you can replace as few or as many as you like.

1. Put your file in [assets/audio/](assets/audio/). MP3 and OGG both work. MP3 is the safest choice.
2. Open [js/audio-config.js](js/audio-config.js).
3. Find the name you want to replace, and change `null` to the file's path:

   ```js
   music: {
     level1: "assets/audio/temple-theme.mp3",
     bossVader: "assets/audio/vader-duel.mp3",
   },
   sfx: {
     swing: "assets/audio/saber-swing.mp3",
   },
   ```

4. Reload the game. To go back to the generated version, set the entry back to `null`.

Paths are relative to `games/jedi_story/`, and their capitals must match the file exactly, because GitHub Pages is case-sensitive.

| Group | Names | How it plays |
| --- | --- | --- |
| `music` | `menu`, `cinematic`, `ending`, `level1` to `level10`, `boss`, `bossMaul`, `bossDooku`, `bossVentress`, `bossVader`, `bossPalpatine` | Loops until the next track |
| `sfx` | See the list in `js/audio-config.js` | Plays once each time |
| `ambient` | `temple`, `kashyyyk`, `tatooine`, `mustafar`, `hoth`, `narshaddaa`, `endor`, `deathstar`, `exegol`, `throne` | Loops under a level |

- **Music volume** follows the Music slider in Options, and sounds and ambience follow the Sound effects slider.
- **A file that won't load** is skipped, the generated version plays, and the browser console says which file failed.
- **Looping music** should end cleanly, because MP3s can leave a tiny gap at the loop point. OGG usually loops more smoothly.
- **Keep sound effects short**, because the first version of each sound is loaded when the game starts, and large files delay it.
- **Only use audio you have the right to use**, because this folder is published with the site.

## Change the game

| To change | Edit |
| --- | --- |
| Story text and level order | `js/level-data.js` |
| A level's layout | Its `build(b)` function in `js/level-data.js`, using the chunks in `js/levels.js` |
| Enemy stats, or add an enemy | The `TYPES` table in `js/enemies.js`. New looks go in `SKINS` in `js/characters.js` |
| Boss health, dialogue and moves | `DEFS` and the boss classes in `js/bosses.js` |
| Species, robes and colors | The tables at the top of `js/customization.js`, with species heads in `HEADS` in `js/characters.js` |
| Lightsaber colors | `COLORS` in `js/combat.js` |
| Jump height and run speed | `J.PHYS` in `js/combat.js`. Changing these can make levels impossible, so keep to the reach limits at the top of `js/levels.js` |
| Upgrades | `UNLOCKS` in `js/abilities.js` |
| Difficulty settings | `DIFFICULTY` in `js/game.js` |
| Planet colors and textures | `THEMES` in `js/renderer.js` and `BUILDERS` in `js/backgrounds.js` |
| Generated music | `SONGS` and `STYLES` at the top of `js/audio.js` |

Levels are written left to right, and each call adds a chunk where the last one ended:

```js
build(b) {
  b.start();
  b.run(420, ["storm", "scout"], { crystals: 5 }); // Floor with enemies and crystals
  b.pits([120, 140]);                              // Gaps with islands between them
  b.checkpoint();
  b.secretRoom();                                  // Cracked wall hiding a holocron
  b.arena(800, [["storm", "storm"], ["heavy"]]);   // Sealed fight, wave by wave
  b.exit();
}
```

Other chunks include `stairs`, `down`, `floats`, `movers`, `crumble`, `tower`, `lift`, `lasers`, `arcs`, `vents`, `crushers`, `spikeRun`, `fallers`, `door`, `bridge`, `crateWall`, `secretLedge`, `secretHigh` and `bossArena`.

If you change the campaign's save format, change `KEY` in `js/save.js` so old saves aren't misread.

## Saved data

Everything is saved in the browser's `localStorage` under `jediStory.save.v1`: your Jedi, unlocked levels, completed levels with best scores, upgrades, and options. It stays in that browser on that device, and it's lost if the player clears site data. Options has **Reset All Progress**, and starting a **New Campaign** clears progress but keeps your Jedi.

## Publish it

The game is in the Coming Soon section now. To release it, follow [Move a game from Coming Soon to the public library](../../README.md#move-a-game-from-coming-soon-to-the-public-library): remove `Coming Soon` from the `<title>` in `index.html` and from `title` in `data/catalog.js`, run `node tools/check-catalog.mjs`, and push. All paths are relative, so it works at any URL.

## Code map

```text
games/jedi_story/
├── index.html          Page, touch buttons and script order
├── style.css           Menus and touch controls
├── assets/audio/       Your own sound and music files
└── js/
    ├── utils.js        Shared namespace and helpers
    ├── save.js         SaveManager
    ├── audio-config.js ★ Your custom sounds and music
    ├── audio.js        AudioManager: synth sounds, music sequencer, file playback
    ├── input.js        Keyboard and touch actions
    ├── camera.js       Camera follow, bounds and shake
    ├── particles.js    ParticleSystem with a fixed pool
    ├── combat.js       Actor physics, Lightsaber, pooled Projectiles, hit rules
    ├── customization.js JediCustomization: species, robes and options
    ├── characters.js   The jointed rig, poses, heads, enemy and boss art
    ├── abilities.js    ForceAbility and the upgrade table
    ├── player.js       Player
    ├── enemies.js      Enemy and the TYPES table
    ├── bosses.js       Boss framework and the five bosses
    ├── renderer.js     Planet THEMES and LevelRenderer
    ├── backgrounds.js  Parallax planets, weather and starfields
    ├── levels.js       Level, LevelBuilder chunks and LevelManager
    ├── level-data.js   ★ The story and all ten level layouts
    ├── cinematics.js   Opening crawl, title cards, dialogue and ending
    ├── ui.js           HUD and menus
    ├── game.js         GameEngine, GameStateManager and campaign flow
    └── main.js         Starts the game
```
