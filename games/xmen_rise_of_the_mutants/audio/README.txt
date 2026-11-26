ADDING YOUR OWN MUSIC AND SOUND EFFECTS
=======================================

X-Men: Rise of the Mutants ships with no audio files. All music and sound effects
are generated live with the Web Audio API, so the game works without anything in
this folder. You can replace any track or effect, one at a time. Anything you don't
replace keeps its built-in sound.

Only use audio you made yourself or have permission to use.


QUICK START
-----------
1. Put your file in this folder, for example:
     audio/music/menu.mp3
     audio/sfx/jump.wav

2. Open js/audio.js. Near the top is XM.AUDIO_FILES. Add a line for each file:

     XM.AUDIO_FILES = {
       music: {
         menu: "audio/music/menu.mp3",
         boss: "audio/music/boss.ogg",
       },
       sfx: {
         jump: "audio/sfx/jump.wav",
       },
     };

3. Reload the game. If a file is missing or can't be played, the game logs a note
   in the browser console and uses the built-in sound instead.


SUPPORTED FORMATS
-----------------
  MP3  Music and effects. Plays in every modern browser. The safest choice.
  OGG  Looping music. Loops cleanly, but older Safari/iOS versions can't play it.
  WAV  Short effects. Starts instantly, but too large for music.

Use lowercase file names with hyphens and no spaces. GitHub Pages treats capital
letters as different, so the path you type must match the file name exactly.


MUSIC TRACK NAMES
-----------------
  menu        Main menu and other menu screens
  story       Story scenes before and after levels
  city        Level 1 (New York City)
  industrial  Factory, desert outpost, cyber facility and Reaver megacity levels
  tense       Subway, laboratory, city of shadows, prison and Xavier's School
  mystic      Jungle, crystal mines, lost temple and ancient city
  cosmic      Orbital station, Nexus Dimension, floating fortress and Nexus core
  ice         Arctic research facility
  boss        Boss battles
  finalboss   Levels 19 and 20 boss battles, and the Last Stand level
  victory     Level complete (plays once)
  defeat      Losing a life or game over (plays once)
  credits     Ending, credits and campaign finale

Music loops automatically, except "victory" and "defeat", which play once.


SOUND EFFECT NAMES
------------------
  Movement:  jump, land, step, dodge
  Hero hits: punch, slash, hit, hitHeavy, beam, blast, psychic, wind, lightning,
             ice, fire, card, teleport, firework, explosion, stomp, charge, ultimate
  Pickups:   orb, xsymbol, pickup, heal, unlock, secret, checkpoint
  Hero:      hurt, ultReady, levelup, denied
  Enemies:   enemyHurt, enemyDie, shoot, laser, roar, magnet, bossDie, break, alarm
  Menus:     ui, uiBack, confirm, type, achievement


VOLUME
------
Players control Master, Music and Sound Effects volume separately in Settings.
Aim for normalized files (around -14 LUFS for music) so they sit well with the
built-in effects.


TESTING
-------
Browsers block loading audio files from file:// pages, so custom sound effects
only load when the game is served over http(s). From the repository root run:

    python -m http.server 8000

then open http://localhost:8000/games/xmen_rise_of_the_mutants/
