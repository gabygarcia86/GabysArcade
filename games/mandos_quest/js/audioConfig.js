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
      level4: null, // Space: Escape from Nevarro
      level5: null, // The Reptavian Nest
      level6: null, // The Sands of Tatooine
      level7: null, // The Mythosaur Awakens
      level8: null, // Space: Mandalore Orbit
      level9: null, // The Living Legend
      level10: null, // The Imperial Fortress
      level11: null, // The Star Map Core
      level12: null, // Space: Assault on Gideon's Fleet
      level13: null, // The Darksaber
      boss: null, // Used by any boss without its own track
      bossMudhorn: null,
      bossReptavians: null,
      bossKrayt: null,
      bossMythosaur: null,
      bossGuardian: null,
      bossGideon: null,
      bossWarden: null,
      bossBastion: null,
      bossCommand: null,
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
      credit: null,
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
      // Space stages
      shipBlaster: null,
      shipLaser: null,
      shipMissile: null,
      shipPop: null,
      shipExplosion: null,
      shipBurst: null,
      shipHit: null,
      shipDown: null,
      shipRespawn: null,
      shieldUp: null,
      shieldHit: null,
      capsule: null,
      upgrade: null,
      shipBossShot: null,
      shipBeam: null,
      bossIntroWarden: null,
      bossIntroBastion: null,
      bossIntroCommand: null,
      spaceComplete: null,
      // Main menu easter eggs
      fart: null,
      fartSqueak: null,
      fartBig: null,
      fartTiny: null,
      fartNote1: null,
      fartNote2: null,
      fartNote3: null,
      fartNote4: null,
      rumble: null,
      burp: null,
      gulp: null,
      ribbit: null,
      hiccup: null,
      sneeze: null,
      sneezeSmall: null,
      snore: null,
      pop: null,
      bubble: null,
      bonk: null,
      spin: null,
      slideUp: null,
      slideDown: null,
      flap: null,
      beep: null,
      disco: null,
      hover: null,
      click: null,
    },
  };
})(window.MQ);
