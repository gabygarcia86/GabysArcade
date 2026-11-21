/*
 * ★ Your own sounds and music go here. See "Add your own sounds and music" in the README.
 *
 * Put the file in assets/audio/, then replace null with its path. Anything left
 * as null keeps its generated sound, and a file that fails to load falls back too.
 */
(function (J) {
  J.AUDIO_FILES = {
    // Music: one looping track per name. To play a track once instead of looping,
    // write { file: "assets/audio/song.mp3", loop: false }. Add volume: 1.5 to make
    // a quiet track louder (1 is normal).
    music: {
      menu: { file: "assets/audio/Music - Menu.mp3", volume: 1.6 },
      crawl: { file: "assets/audio/Music - Opening Crawl.mp3", loop: false }, // Opening crawl
      cinematic: null, // Level title cards
      ending: "assets/audio/Music - Ending.mp3",
      level1: null, // Jedi Temple
      level2: null, // Kashyyyk
      level3: null, // Tatooine
      level4: null, // Mustafar
      level5: null, // Hoth
      level6: null, // Nar Shaddaa
      level7: null, // Endor
      level8: null, // Death Star II
      level9: null, // Exegol
      level10: null, // Throne Room
      boss: null, // Used by any boss without its own track
      bossMaul: "assets/audio/Music - Boss Fight - Maul.mp3",
      bossDooku: "assets/audio/Music - Boss Fight - Dooku.mp3",
      bossVentress: "assets/audio/Music - Boss Fight - Ventress.mp3",
      bossVader: "assets/audio/Music - Boss Fight - Vader.mp3",
      bossPalpatine: "assets/audio/Music - Boss Fight - Palpatine.mp3",
    },

    // Sound effects: played once each time they happen.
    sfx: {
      saberOn: null,
      saberOff: null,
      swing: null,
      saberHit: null,
      clash: null,
      blaster: null,
      deflect: null,
      perfect: null,
      push: null,
      jump: null,
      land: null,
      hurt: null,
      enemyHit: null,
      droidHit: null,
      explosion: null,
      crystal: null,
      holocron: null,
      heal: null,
      checkpoint: null,
      switch: null,
      door: null,
      lightning: null,
      choke: null,
      bossIntro: null,
      bossDown: null,
      victory: null,
      defeat: null,
      click: null,
      hover: null,
    },

    // Looping background ambience, per level theme.
    ambient: {
      temple: null,
      kashyyyk: null,
      tatooine: null,
      mustafar: null,
      hoth: null,
      narshaddaa: null,
      endor: null,
      deathstar: null,
      exegol: null,
      throne: null,
    },
  };
})(window.JEDI);
