/*
 * Your own music and sound effects go here. See audio/README.md.
 *
 * Put a file in audio/, then replace null with its path, or with
 * { file: "audio/name.mp3", volume: 1, loop: true }.
 * Anything left as null uses the built-in generated sound, as does any file that fails to load.
 */
(function (MQ) {
  MQ.AUDIO_FILES = {
    music: {
      menu: null,
      cinematic: null,
      ending: null,
      credits: null,
      level1: null, // The Hidden Child
      level2: null, // The Mudhorn Valley
      level3: null, // The Nevarro Underworld
      level4: null, // The Reptavian Nest
      level5: null, // The Sands of Tatooine
      level6: null, // The Mythosaur Awakens
      level7: null, // The Living Legend
      level8: null, // The Imperial Fortress
      level9: null, // The Star Map Core
      level10: null, // The Darksaber
      boss: null, // Used by any boss without its own track
      bossMudhorn: null,
      bossReptavians: null,
      bossKrayt: null,
      bossMythosaur: null,
      bossGuardian: null,
      bossGideon: null,
    },

    sfx: {
      blaster: null,
      pulse: null,
      heavy: null,
      disruptor: null,
      birds: null,
      rocket: null,
      flame: null,
      swing: null,
      hit: null,
      saberOn: null,
      saberSwing: null,
      saberWave: null,
      weaponSwitch: null,
      empty: null,
      jump: null,
      land: null,
      dodge: null,
      jetStart: null,
      jetStop: null,
      jetpack: null,
      forcePush: null,
      forceFail: null,
      babyHappy: null,
      babyWorry: null,
      enemyShot: null,
      enemyMelee: null,
      enemyWarn: null,
      enemyHit: null,
      enemyDown: null,
      droidDown: null,
      creature: null,
      hurt: null,
      explosion: null,
      crumble: null,
      door: null,
      mechanism: null,
      puck: null,
      pickup: null,
      checkpoint: null,
      bossIntroMudhorn: null,
      bossIntroReptavians: null,
      bossIntroKrayt: null,
      bossIntroMythosaur: null,
      bossIntroGuardian: null,
      bossIntroGideon: null,
      bossAttackMudhorn: null,
      bossAttackReptavians: null,
      bossAttackKrayt: null,
      bossAttackMythosaur: null,
      bossAttackGuardian: null,
      bossAttackGideon: null,
      bossDown: null,
      levelComplete: null,
      gameOver: null,
      unlock: null,
      transmission: null,
      hover: null,
      click: null,
    },
  };
})(window.MQ);
