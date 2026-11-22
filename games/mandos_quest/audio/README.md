# Adding your own audio

Mando's Quest ships without audio files. The music and sound effects are generated live with the Web Audio API. You can replace any of them, one at a time, and everything you don't replace keeps its generated sound.

Only use audio you made or have permission to use.

## Quick start

1. Put the file in this folder, for example `audio/music-menu.mp3`.
2. Open `js/audioConfig.js` and replace that sound's `null` with the path:

   ```js
   menu: "audio/music-menu.mp3",
   ```

3. Preview the game through a web server (see [Testing](#testing)), then push.

## Supported formats

| Format | Best for | Notes |
| --- | --- | --- |
| MP3 | Music and effects | Plays in every modern browser. The safest choice |
| OGG | Looping music | Loops without a gap, but older Safari and iOS versions can't play it |
| WAV | Short effects | Plays everywhere and starts instantly. Too large for music |

## Recommended file names

Use lowercase letters and hyphens, with no spaces. GitHub Pages treats capitals as different letters, so the path in the config must match exactly.

```text
audio/
├── music-menu.mp3
├── music-level-01.mp3
├── music-level-02.mp3
├── music-boss.mp3
├── music-boss-gideon.mp3
├── sfx-blaster.wav
└── sfx-force-push.wav
```

## Menu music

In the `music` section of `js/audioConfig.js`:

```js
menu: "audio/music-menu.mp3",
```

These work the same way:

| Name | Plays during |
| --- | --- |
| `cinematic` | Story introductions and conclusions |
| `ending` | The ending cinematic and final completion screen |
| `credits` | The credits after the story |

## Level music

Each level has its own entry, from `level1` to `level10`:

```js
level1: "audio/music-level-01.mp3",
level2: "audio/music-level-02.mp3",
```

## Boss music

`boss` covers every boss that doesn't have its own track:

```js
boss: "audio/music-boss.mp3",
bossGideon: "audio/music-boss-gideon.mp3", // Overrides "boss" for this fight
```

| Name | Fight |
| --- | --- |
| `bossMudhorn` | Level 2: Mudhorn |
| `bossReptavians` | Level 4: Nevarro Reptavians |
| `bossKrayt` | Level 6: Krayt Dragon |
| `bossMythosaur` | Level 7: Mythosaur |
| `bossGuardian` | Level 8: Imperial Guardian |
| `bossGideon` | Level 10: Moff Gideon |

## Sound effects

Effects go in the `sfx` section:

```js
blaster: "audio/sfx-blaster.wav",
forcePush: "audio/sfx-force-push.wav",
```

| Group | Names |
| --- | --- |
| Weapons | `blaster`, `pulse`, `heavy`, `disruptor`, `birds`, `rocket`, `flame`, `swing`, `hit`, `weaponSwitch`, `empty` |
| Darksaber | `saberOn`, `saberSwing`, `saberWave` |
| Movement | `jump`, `land`, `dodge`, `jetStart`, `jetpack`, `jetStop` |
| Baby G | `forcePush`, `forceFail`, `babyHappy`, `babyWorry` |
| Enemies | `enemyWarn`, `enemyShot`, `enemyMelee`, `enemyHit`, `enemyDown`, `droidDown`, `creature` |
| World | `hurt`, `explosion`, `crumble`, `door`, `mechanism`, `puck`, `pickup`, `checkpoint`, `transmission` |
| Boss introductions | `bossIntroMudhorn`, `bossIntroReptavians`, `bossIntroKrayt`, `bossIntroMythosaur`, `bossIntroGuardian`, `bossIntroGideon` |
| Boss attacks | `bossAttackMudhorn`, `bossAttackReptavians`, `bossAttackKrayt`, `bossAttackMythosaur`, `bossAttackGuardian`, `bossAttackGideon` |
| Results | `bossDown`, `levelComplete`, `gameOver`, `unlock` |
| Menus | `hover`, `click` |

Keep effects short, with no silence at the start. `jetpack` repeats about ten times a second and `flame` about eleven, so give those two very short clips.

## Volume

Players control Master, Music, Sound effects and Mute in **Options**.

To balance one file against the others, use the long form of its entry. `1` is normal volume.

```js
menu: { file: "audio/music-menu.mp3", volume: 0.8 },
blaster: { file: "audio/sfx-blaster.wav", volume: 1.4 },
```

Music loops by default. To play a track once, add `loop: false`:

```js
ending: { file: "audio/music-ending.mp3", loop: false },
```

A music track can't go louder than full volume, so above `1` it only makes up for lower slider settings. iPhones ignore volume settings for music files, so export music at a comfortable level.

The default slider positions are in `defaults()` in `js/saveManager.js`. They only affect players without a save.

## How the AudioManager works

`js/audioManager.js` handles all audio:

1. **It waits for the first tap, click or key press**, because browsers block sound until then.
2. **It loads effects at that moment.** Each configured effect is fetched and decoded once, then played from memory.
3. **It streams music** through an audio element when the track is needed, so long songs don't delay the game.
4. **It falls back automatically.** A `null` entry, a missing file or an unreadable file uses the generated sound.
5. **It never requests unconfigured files**, so the empty setup causes no 404 errors.
6. **It limits repeats and voices**, so busy fights don't distort or slow down.
7. **It lowers music while paused** and stops audio while the tab is hidden.

Game code plays sounds by name, with `audio.sfx("blaster")` and `audio.music("level3")`.

## Testing

From the repository root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/>, then enter through the game's Coming Soon card. Custom effects can't load when you open `index.html` directly from disk, because browsers block `fetch` there.
