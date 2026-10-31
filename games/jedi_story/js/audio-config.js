/*
 * ★ Your own sounds and music go here. See "Add your own sounds and music" in the README.
 *
 * Put the file in assets/audio/, then replace null with its path. Anything left
 * as null keeps its generated sound, and a file that fails to load falls back too.
 */
(function (J) {
  J.AUDIO_FILES = {
    // Music: one looping track per name.
    music: {
      menu: null, // e.g. "assets/audio/menu-theme.mp3"
      cinematic: null,
      ending: null,
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
      bossMaul: null,
      bossDooku: null,
      bossVentress: null,
      bossVader: null,
      bossPalpatine: null,
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
