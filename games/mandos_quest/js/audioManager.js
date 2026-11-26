/*
 * AudioManager: plays files from audioConfig.js when they exist, and otherwise
 * synthesizes original sound effects and music with the Web Audio API.
 */
(function (MQ) {
  const { clamp, rng } = MQ.U;
  const LOOKAHEAD = 0.2;
  const MAX_VOICES = 70;

  // Minimum seconds between two plays of the same effect.
  const GAP = { hit: 0.04, enemyHit: 0.05, flame: 0.09, jetpack: 0.1, hover: 0.05, enemyWarn: 0.15, explosion: 0.06, enemyShot: 0.04, crumble: 0.1, shipBlaster: 0.09, shipPop: 0.05, shipExplosion: 0.08, shipBurst: 0.1, shieldHit: 0.07, shipBossShot: 0.12 };

  /* Recipes use t(type, from Hz, to Hz, seconds, volume, delay) and n(filter, from Hz, to Hz, seconds, volume, delay). */
  const SFX = {
    blaster: (a) => { a.t("square", 1300, 190, 0.13, 0.12); a.n("bandpass", 2400, 500, 0.08, 0.15); },
    pulse: (a) => { a.t("sawtooth", 1900, 420, 0.11, 0.09); a.t("sine", 880, 220, 0.1, 0.14); },
    heavy: (a) => { a.t("sawtooth", 420, 50, 0.3, 0.24); a.n("lowpass", 2400, 180, 0.25, 0.35); },
    disruptor: (a) => { a.t("sawtooth", 180, 2800, 0.1, 0.14); a.t("square", 2600, 90, 0.4, 0.16, 0.07); a.n("highpass", 3000, 700, 0.3, 0.14, 0.07); },
    birds: (a) => { for (let i = 0; i < 4; i++) a.t("sine", 2600 + i * 230, 1500, 0.28, 0.11, i * 0.05); },
    rocket: (a) => { a.n("bandpass", 350, 2600, 0.5, 0.4); a.t("sawtooth", 120, 60, 0.35, 0.12); },
    flame: (a) => a.n("lowpass", 1300, 500, 0.2, 0.22),
    swing: (a) => { a.n("bandpass", 700, 3400, 0.14, 0.3); a.t("sine", 1500, 2100, 0.08, 0.05); },
    hit: (a) => { a.n("bandpass", 1800, 600, 0.07, 0.35); a.t("triangle", 300, 90, 0.08, 0.15); },
    saberOn: (a) => { a.t("sawtooth", 50, 190, 0.5, 0.14); a.n("bandpass", 400, 4500, 0.45, 0.2); a.t("square", 93, 98, 0.8, 0.05); },
    saberSwing: (a) => { a.t("sawtooth", 260, 88, 0.26, 0.17); a.t("square", 97, 142, 0.24, 0.09); a.n("highpass", 3200, 900, 0.18, 0.12); },
    saberWave: (a) => { a.t("sawtooth", 90, 720, 0.18, 0.18); a.t("sine", 900, 120, 0.5, 0.2, 0.1); a.n("bandpass", 4000, 500, 0.45, 0.3); },
    weaponSwitch: (a) => { a.t("square", 520, 500, 0.05, 0.08); a.t("square", 820, 800, 0.06, 0.08, 0.07); },
    empty: (a) => a.t("square", 170, 120, 0.06, 0.1),
    jump: (a) => a.t("sine", 260, 520, 0.12, 0.12),
    land: (a) => { a.n("lowpass", 520, 120, 0.1, 0.3); a.t("sine", 120, 55, 0.09, 0.14); },
    dodge: (a) => a.n("bandpass", 500, 2200, 0.2, 0.3),
    jetStart: (a) => { a.n("bandpass", 300, 1700, 0.25, 0.4); a.t("sawtooth", 80, 190, 0.2, 0.08); },
    jetStop: (a) => a.n("bandpass", 1300, 250, 0.2, 0.22),
    jetpack: (a) => a.n("lowpass", 1000, 800, 0.17, 0.17),
    forcePush: (a) => { a.t("sine", 95, 480, 0.18, 0.3); a.t("sine", 420, 55, 0.55, 0.32, 0.12); a.n("lowpass", 2600, 120, 0.6, 0.3, 0.1); },
    forceFail: (a) => a.t("sine", 300, 180, 0.2, 0.12),
    babyHappy: (a) => { a.t("sine", 620, 880, 0.14, 0.11); a.t("sine", 760, 1150, 0.18, 0.11, 0.16); },
    babyWorry: (a) => { a.t("sine", 720, 520, 0.22, 0.1); a.t("sine", 600, 420, 0.2, 0.07, 0.2); },
    enemyShot: (a) => { a.t("square", 780, 130, 0.14, 0.08); a.n("bandpass", 1500, 400, 0.06, 0.1); },
    enemyMelee: (a) => a.n("bandpass", 400, 1900, 0.16, 0.25),
    enemyWarn: (a) => { a.t("triangle", 990, 990, 0.07, 0.12); a.t("triangle", 1250, 1250, 0.07, 0.1, 0.09); },
    enemyHit: (a) => a.t("triangle", 240, 110, 0.08, 0.16),
    enemyDown: (a) => { a.n("lowpass", 900, 100, 0.25, 0.3); a.t("triangle", 330, 70, 0.28, 0.14); },
    droidDown: (a) => { a.t("square", 1500, 110, 0.35, 0.09); a.n("highpass", 3000, 600, 0.3, 0.22); },
    creature: (a) => { a.t("sawtooth", 230, 85, 0.35, 0.15); a.n("bandpass", 600, 250, 0.3, 0.15); },
    hurt: (a) => { a.t("sawtooth", 190, 65, 0.24, 0.22); a.n("lowpass", 1400, 200, 0.16, 0.3); },
    explosion: (a) => { a.n("lowpass", 2400, 60, 0.75, 0.65); a.t("sine", 130, 30, 0.5, 0.4); },
    crumble: (a) => { a.n("lowpass", 700, 90, 0.5, 0.45); a.n("bandpass", 1300, 300, 0.2, 0.15, 0.1); },
    door: (a) => { a.t("sawtooth", 75, 150, 0.55, 0.1); a.n("bandpass", 350, 900, 0.5, 0.15); },
    mechanism: (a) => { [330, 415, 494, 659].forEach((f, i) => a.t("triangle", f, f, 0.45, 0.12, i * 0.08)); },
    puck: (a) => { [784, 988, 1175, 1568, 1976].forEach((f, i) => a.t("sine", f, f, 0.3, 0.16, i * 0.065)); },
    credit: (a) => { a.t("triangle", 1568, 1568, 0.05, 0.08); a.t("triangle", 2093, 2093, 0.08, 0.07, 0.04); },
    pickup: (a) => { a.t("sine", 520, 780, 0.12, 0.14); a.t("sine", 780, 1040, 0.12, 0.1, 0.08); },
    checkpoint: (a) => { [523, 659, 784].forEach((f, i) => a.t("triangle", f, f, 0.22, 0.13, i * 0.09)); },
    bossIntroMudhorn: (a) => { a.t("sawtooth", 70, 160, 0.5, 0.3); a.t("sawtooth", 160, 45, 1.2, 0.3, 0.45); a.n("lowpass", 900, 120, 1.4, 0.5, 0.3); },
    bossIntroReptavians: (a) => { for (let i = 0; i < 3; i++) { a.t("sawtooth", 1500 + i * 260, 380, 0.65, 0.13, i * 0.3); a.n("bandpass", 2600, 900, 0.5, 0.14, i * 0.3); } },
    bossIntroKrayt: (a) => { a.n("lowpass", 200, 1300, 1.1, 0.5); a.t("sawtooth", 300, 55, 1.4, 0.3, 0.5); a.t("square", 440, 82, 1, 0.08, 0.6); },
    bossIntroMythosaur: (a) => { a.t("sawtooth", 48, 98, 1.8, 0.35); a.t("sine", 196, 73, 2, 0.35, 0.3); a.n("lowpass", 420, 70, 2, 0.5); },
    bossIntroGuardian: (a) => { for (let i = 0; i < 4; i++) a.t("square", 160, 150, 0.25, 0.14, i * 0.32); a.n("bandpass", 300, 2400, 1.5, 0.2); },
    bossIntroGideon: (a) => { a.t("sawtooth", 50, 200, 0.6, 0.18); a.n("highpass", 800, 5000, 0.7, 0.25); [147, 139, 110].forEach((f, i) => a.t("triangle", f, f, 0.8, 0.2, 0.5 + i * 0.35)); },
    bossAttackMudhorn: (a) => { a.t("sawtooth", 130, 55, 0.4, 0.28); a.n("lowpass", 800, 150, 0.35, 0.35); },
    bossAttackReptavians: (a) => { a.t("sawtooth", 1700, 520, 0.35, 0.14); a.n("bandpass", 2300, 800, 0.3, 0.14); },
    bossAttackKrayt: (a) => { a.t("sawtooth", 260, 70, 0.5, 0.22); a.n("lowpass", 1200, 100, 0.5, 0.4); },
    bossAttackMythosaur: (a) => { a.t("sine", 150, 38, 0.7, 0.45); a.n("lowpass", 500, 60, 0.7, 0.45); },
    bossAttackGuardian: (a) => { a.t("square", 220, 110, 0.18, 0.15); a.t("sawtooth", 600, 90, 0.3, 0.12, 0.12); },
    bossAttackGideon: (a) => { a.t("sawtooth", 100, 340, 0.15, 0.17); a.t("square", 340, 90, 0.2, 0.08, 0.12); },
    bossDown: (a) => { a.n("lowpass", 3000, 50, 1.6, 0.6); a.t("sawtooth", 220, 28, 1.4, 0.25); [262, 330, 392, 523].forEach((f, i) => a.t("triangle", f, f, 0.8, 0.18, 1 + i * 0.16)); },
    levelComplete: (a) => { [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => a.t("triangle", f, f, i === 6 ? 0.9 : 0.22, 0.2, i * 0.14)); },
    gameOver: (a) => { [330, 311, 247, 165].forEach((f, i) => a.t("triangle", f, f, 0.7, 0.2, i * 0.3)); },
    unlock: (a) => { [440, 554, 659, 880, 1109, 1319].forEach((f, i) => a.t("sine", f, f, 0.5, 0.15, i * 0.1)); },
    transmission: (a) => { for (let i = 0; i < 4; i++) a.t("sine", 900 + (i % 2) * 420, 900 + (i % 2) * 420, 0.06, 0.07, i * 0.07); },
    shipBlaster: (a) => { a.t("square", 1500, 420, 0.07, 0.055); a.t("sine", 700, 240, 0.06, 0.06); },
    shipLaser: (a) => { a.t("sawtooth", 1300, 2100, 0.18, 0.1); a.t("sine", 330, 310, 0.22, 0.16); a.n("highpass", 4000, 2500, 0.15, 0.07); },
    shipMissile: (a) => { a.n("bandpass", 500, 2600, 0.26, 0.18); a.t("sawtooth", 190, 90, 0.2, 0.05); },
    shipPop: (a) => { a.n("lowpass", 1800, 120, 0.22, 0.3); a.t("triangle", 260, 60, 0.18, 0.12); },
    shipExplosion: (a) => { a.n("lowpass", 2200, 50, 0.8, 0.55); a.t("sine", 120, 28, 0.6, 0.35); a.n("bandpass", 900, 200, 0.3, 0.2, 0.12); },
    shipBurst: (a) => { a.n("bandpass", 2400, 300, 0.3, 0.3); a.t("square", 440, 90, 0.16, 0.07); },
    shipHit: (a) => { a.t("sawtooth", 160, 50, 0.3, 0.25); a.n("lowpass", 1100, 150, 0.25, 0.35); a.t("square", 880, 660, 0.12, 0.05, 0.1); },
    shipDown: (a) => { a.n("lowpass", 2600, 40, 1.3, 0.6); a.t("sawtooth", 520, 40, 1.1, 0.16); },
    shipRespawn: (a) => { a.t("sine", 160, 880, 0.55, 0.16); a.n("bandpass", 300, 3400, 0.5, 0.15); },
    shieldUp: (a) => { a.t("sine", 260, 1040, 0.3, 0.18); a.t("triangle", 520, 780, 0.35, 0.08, 0.08); },
    shieldHit: (a) => { a.t("sine", 1250, 820, 0.09, 0.07); a.n("highpass", 3500, 2500, 0.06, 0.06); },
    capsule: (a) => { [880, 1175, 1480].forEach((f, i) => a.t("triangle", f, f, 0.12, 0.12, i * 0.045)); },
    upgrade: (a) => { [392, 523, 784, 1047].forEach((f, i) => a.t("square", f, f * 1.01, 0.2, 0.07, i * 0.07)); a.n("bandpass", 600, 3000, 0.35, 0.12); },
    shipBossShot: (a) => { a.t("square", 300, 80, 0.2, 0.1); a.n("bandpass", 1100, 250, 0.15, 0.15); },
    shipBeam: (a) => { a.t("sawtooth", 90, 70, 0.8, 0.22); a.t("square", 1800, 1500, 0.7, 0.05); a.n("lowpass", 3000, 400, 0.8, 0.3); },
    bossIntroWarden: (a) => { for (let i = 0; i < 3; i++) a.t("square", 440, 330, 0.3, 0.12, i * 0.4); a.n("bandpass", 200, 1800, 1.4, 0.3); a.t("sawtooth", 55, 110, 1.4, 0.2); },
    bossIntroBastion: (a) => { [196, 185, 147, 98].forEach((f, i) => a.t("triangle", f, f, 0.9, 0.22, i * 0.3)); a.n("lowpass", 300, 2000, 1.6, 0.3); },
    bossIntroCommand: (a) => { for (let i = 0; i < 4; i++) a.t("sawtooth", 73, 69, 0.45, 0.22, i * 0.38); [587, 554, 440].forEach((f, i) => a.t("square", f, f, 0.6, 0.06, 0.4 + i * 0.4)); },
    spaceComplete: (a) => { [523, 659, 880, 784, 1047, 1319].forEach((f, i) => a.t("triangle", f, f, i === 5 ? 1.1 : 0.2, 0.19, i * 0.13)); a.n("bandpass", 300, 4000, 1, 0.12); },
    fart: (a) => { a.toot(125, 62, 0.75, 0.45, 27); a.n("lowpass", 600, 120, 0.6, 0.12); },
    fartSqueak: (a) => a.toot(260, 640, 0.65, 0.2, 38, 0, 2400),
    fartBig: (a) => { a.toot(98, 36, 1.5, 0.5, 19); a.toot(150, 58, 0.9, 0.2, 31, 0.15); a.n("lowpass", 900, 70, 1.3, 0.2); },
    fartTiny: (a) => a.toot(300, 210, 0.22, 0.28, 34, 0, 1600),
    fartNote1: (a) => a.toot(131, 124, 0.3, 0.42, 30),
    fartNote2: (a) => a.toot(165, 158, 0.26, 0.4, 33),
    fartNote3: (a) => a.toot(196, 190, 0.26, 0.4, 36),
    fartNote4: (a) => a.toot(262, 92, 0.55, 0.45, 28),
    rumble: (a) => { a.toot(45, 80, 0.95, 0.3, 11, 0, 300); a.n("lowpass", 90, 300, 0.95, 0.2); },
    burp: (a) => { a.toot(170, 88, 0.7, 0.45, 46, 0, 1100); a.toot(84, 70, 0.4, 0.2, 24, 0.15); },
    gulp: (a) => { a.t("sine", 420, 130, 0.16, 0.25); a.t("sine", 190, 320, 0.1, 0.15, 0.17); },
    ribbit: (a) => { a.toot(230, 330, 0.16, 0.2, 60, 0, 1800); a.toot(250, 380, 0.22, 0.2, 60, 0.22, 1800); },
    hiccup: (a) => { a.t("sine", 520, 1150, 0.09, 0.2); a.t("triangle", 900, 700, 0.05, 0.08, 0.09); },
    sneeze: (a) => { a.n("bandpass", 3000, 600, 0.35, 0.6); a.t("triangle", 480, 120, 0.22, 0.2); },
    sneezeSmall: (a) => { a.n("highpass", 4500, 1800, 0.22, 0.35); a.t("sine", 1100, 620, 0.16, 0.15); },
    snore: (a) => { a.toot(62, 88, 0.5, 0.2, 22, 0, 400); a.t("sine", 900, 600, 0.35, 0.05, 0.55); },
    pop: (a) => { a.n("highpass", 2500, 1200, 0.06, 0.3); a.t("sine", 700, 1500, 0.06, 0.15); },
    bubble: (a) => { for (let i = 0; i < 3; i++) a.t("sine", 420 + i * 170, 900 + i * 200, 0.07, 0.12, i * 0.06); },
    bonk: (a) => { a.t("sine", 190, 55, 0.2, 0.4); a.t("triangle", 820, 640, 0.12, 0.12); a.n("lowpass", 800, 120, 0.15, 0.25); },
    spin: (a) => { for (let i = 0; i < 12; i++) a.t("triangle", 1200 - i * 55, 900 - i * 40, 0.06, 0.1, i * 0.07 + i * i * 0.003); },
    slideUp: (a) => a.t("sine", 350, 1300, 0.4, 0.14),
    slideDown: (a) => a.t("sine", 1400, 220, 0.8, 0.13),
    flap: (a) => a.n("bandpass", 700, 260, 0.11, 0.25),
    beep: (a) => a.t("square", 1050, 1050, 0.07, 0.06),
    disco: (a) => {
      [110, 110, 220, 110, 131, 131, 262, 147].forEach((f, i) => {
        a.t("square", f, f, 0.16, 0.07, i * 0.23);
        a.n("highpass", 7000, 6000, 0.05, 0.12, i * 0.23 + 0.115);
        if (i % 2 === 0) a.t("sine", 150, 42, 0.18, 0.3, i * 0.23);
      });
    },
    hover: (a) => a.t("sine", 660, 700, 0.04, 0.04),
    click: (a) => { a.t("sine", 600, 900, 0.07, 0.11); },
  };

  /* Original generated score: each track has its own key, scale, tempo and kit. */
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    desert: [0, 1, 4, 5, 7, 8, 10],
  };
  const TRACKS = {
    menu: { root: 50, scale: "dorian", bpm: 84, lead: "sine", drums: 1, chords: [0, 5, 3, 4] },
    cinematic: { root: 48, scale: "minor", bpm: 66, lead: "sine", drums: 0, chords: [0, 3, 5, 4] },
    ending: { root: 53, scale: "lydian", bpm: 80, lead: "triangle", drums: 1, chords: [0, 4, 5, 1] },
    credits: { root: 55, scale: "dorian", bpm: 96, lead: "triangle", drums: 1, chords: [0, 3, 6, 4] },
    level1: { root: 50, scale: "desert", bpm: 92, lead: "triangle", drums: 1, chords: [0, 1, 0, 6] },
    level2: { root: 45, scale: "dorian", bpm: 100, lead: "square", drums: 2, chords: [0, 3, 0, 4] },
    level3: { root: 47, scale: "phrygian", bpm: 108, lead: "sawtooth", drums: 2, chords: [0, 1, 5, 1] },
    // A seed keeps the melody a level had before the space stages moved it along.
    level4: { root: 47, scale: "harmonic", bpm: 138, lead: "square", drums: 3, chords: [0, 5, 6, 4], arp: "triangle" },
    level5: { seed: "level4", root: 52, scale: "minor", bpm: 96, lead: "sine", drums: 1, chords: [0, 5, 2, 6] },
    level6: { seed: "level5", root: 52, scale: "desert", bpm: 112, lead: "square", drums: 2, chords: [0, 1, 3, 1] },
    level7: { seed: "level6", root: 43, scale: "harmonic", bpm: 90, lead: "triangle", drums: 2, chords: [0, 5, 3, 4] },
    level8: { root: 50, scale: "lydian", bpm: 128, lead: "triangle", drums: 2, chords: [0, 1, 4, 5], arp: "sine" },
    level9: { seed: "level7", root: 48, scale: "dorian", bpm: 78, lead: "sine", drums: 1, chords: [0, 6, 3, 4] },
    level10: { seed: "level8", root: 49, scale: "minor", bpm: 120, lead: "square", drums: 3, chords: [0, 0, 5, 6] },
    level11: { seed: "level9", root: 46, scale: "phrygian", bpm: 116, lead: "sawtooth", drums: 2, chords: [0, 1, 6, 4] },
    level12: { root: 44, scale: "phrygian", bpm: 156, lead: "sawtooth", drums: 3, chords: [0, 1, 5, 6], arp: "square" },
    level13: { seed: "level10", root: 45, scale: "harmonic", bpm: 124, lead: "sawtooth", drums: 3, chords: [0, 5, 1, 4] },
    boss: { root: 43, scale: "harmonic", bpm: 140, lead: "sawtooth", drums: 3, chords: [0, 1, 0, 4] },
    bossMudhorn: { root: 40, scale: "phrygian", bpm: 132, lead: "square", drums: 3, chords: [0, 1, 0, 3] },
    bossReptavians: { root: 47, scale: "minor", bpm: 148, lead: "triangle", drums: 3, chords: [0, 5, 6, 4] },
    bossKrayt: { root: 42, scale: "desert", bpm: 138, lead: "sawtooth", drums: 3, chords: [0, 1, 4, 1] },
    bossMythosaur: { root: 38, scale: "dorian", bpm: 120, lead: "triangle", drums: 3, chords: [0, 3, 6, 4] },
    bossGuardian: { root: 41, scale: "phrygian", bpm: 144, lead: "square", drums: 3, chords: [0, 0, 1, 5] },
    bossWarden: { root: 46, scale: "minor", bpm: 150, lead: "square", drums: 3, chords: [0, 6, 5, 4], arp: "triangle" },
    bossBastion: { root: 41, scale: "dorian", bpm: 142, lead: "triangle", drums: 3, chords: [0, 0, 3, 1], arp: "sine" },
    bossCommand: { root: 43, scale: "harmonic", bpm: 162, lead: "sawtooth", drums: 3, chords: [0, 5, 1, 4], arp: "square" },
    bossGideon: { root: 45, scale: "harmonic", bpm: 152, lead: "sawtooth", drums: 3, chords: [0, 5, 3, 4] },
  };

  function hash(value) {
    let h = 2166136261;
    for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }

  class AudioManager {
    constructor(settings) {
      this.settings = settings;
      this.ctx = null;
      this.lastPlayed = new Map();
      this.buffers = new Map();
      this.voices = 0;
      this.track = null;
      this.element = null;
      this.song = null;
      this.ducked = false;
      this.timer = 0;
      this.files = MQ.AUDIO_FILES;

      const unlock = () => this.unlock();
      for (const type of ["pointerdown", "pointerup", "touchend", "keydown"]) {
        window.addEventListener(type, unlock, { capture: true, passive: true });
      }
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.element?.audio.pause();
          this.ctx?.suspend().catch(() => {});
        } else if (this.ctx) {
          this.unlock();
        }
      });
    }

    // Browsers only allow sound after the first tap or key press.
    unlock() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.ctx && AudioContextClass) {
        const ctx = (this.ctx = new AudioContextClass());
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.connect(ctx.destination);
        this.masterGain = ctx.createGain();
        this.masterGain.connect(limiter);
        this.musicGain = ctx.createGain();
        this.musicGain.connect(this.masterGain);
        this.sfxGain = ctx.createGain();
        this.sfxGain.connect(this.masterGain);

        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

        this.applyVolume();
        this.loadEffects();
        this.timer = setInterval(() => this.schedule(), 50);
        if (this.track) this.startTrack(this.track);
      }
      if (!this.ctx) return;
      if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
      if (this.element?.audio.paused && !this.element.audio.ended) {
        this.element.audio.play().catch(() => {});
      }
    }

    applyVolume() {
      const s = this.settings();
      const duck = this.ducked ? 0.35 : 1;
      if (this.ctx) {
        this.masterGain.gain.value = s.muted ? 0 : s.master;
        this.musicGain.gain.value = s.music * duck;
        this.sfxGain.gain.value = s.sfx;
      }
      if (this.element) {
        this.element.audio.volume = s.muted ? 0 : clamp(s.master * s.music * duck * this.element.volume, 0, 1);
      }
    }

    duck(on) {
      this.ducked = on;
      this.applyVolume();
    }

    entry(group, name) {
      const value = this.files[group][name];
      if (!value) return null;
      return typeof value === "string" ? { file: value, volume: 1 } : { volume: 1, ...value };
    }

    loadEffects() {
      for (const name of Object.keys(this.files.sfx)) {
        const entry = this.entry("sfx", name);
        if (!entry) continue;
        fetch(entry.file)
          .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.status))))
          .then((bytes) => this.ctx.decodeAudioData(bytes))
          .then((buffer) => this.buffers.set(name, { buffer, volume: entry.volume }))
          .catch(() => console.info(`Sound "${name}" could not load, so the generated sound is used.`));
      }
    }

    sfx(name) {
      if (!this.ctx || this.ctx.state !== "running") return;
      const now = this.ctx.currentTime;
      if (now - (this.lastPlayed.get(name) ?? -1) < (GAP[name] ?? 0.02)) return;
      this.lastPlayed.set(name, now);

      const custom = this.buffers.get(name);
      if (custom) {
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        source.buffer = custom.buffer;
        gain.gain.value = custom.volume;
        source.connect(gain).connect(this.sfxGain);
        source.start();
      } else if (SFX[name] && this.voices < MAX_VOICES) {
        SFX[name](this);
      }
    }

    voice(node, gain) {
      this.voices++;
      node.onended = () => {
        this.voices--;
        node.disconnect();
        gain.disconnect();
      };
    }

    envelope(gain, start, seconds, volume) {
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.012, seconds / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    }

    t(type, from, to, seconds, volume, delay = 0, bus = this.sfxGain, at = this.ctx.currentTime) {
      const start = at + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
      this.envelope(gain, start, seconds, volume);
      osc.connect(gain).connect(bus);
      this.voice(osc, gain);
      osc.start(start);
      osc.stop(start + seconds + 0.02);
    }

    n(type, from, to, seconds, volume, delay = 0, bus = this.sfxGain, at = this.ctx.currentTime) {
      const start = at + delay;
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = this.noise;
      filter.type = type;
      filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + seconds);
      this.envelope(gain, start, seconds, volume);
      source.connect(filter).connect(gain).connect(bus);
      this.voice(source, gain);
      source.start(start, Math.random());
      source.stop(start + seconds + 0.02);
    }

    // A buzz that flutters in pitch and volume: the sound of every fart, burp and snore.
    toot(from, to, seconds, volume, flutter, delay = 0, brightness = 900) {
      const { ctx } = this;
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const wobble = ctx.createOscillator();
      const bend = ctx.createGain();
      const pulse = ctx.createGain();
      const chop = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, start + seconds);
      wobble.type = "square";
      wobble.frequency.setValueAtTime(flutter, start);
      wobble.frequency.linearRampToValueAtTime(flutter * 0.6, start + seconds);
      bend.gain.value = from * 0.18;
      pulse.gain.value = 0.4;
      chop.gain.value = 0.6;
      wobble.connect(bend).connect(osc.frequency);
      wobble.connect(pulse).connect(chop.gain);
      filter.type = "lowpass";
      filter.frequency.value = brightness;
      filter.Q.value = 4;
      // Held nearly to the end, as envelope() would fade it away too soon.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(volume * 0.6, start + seconds * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      osc.connect(filter).connect(chop).connect(gain).connect(this.sfxGain);
      this.voice(osc, gain);
      const end = start + seconds + 0.02;
      osc.start(start);
      osc.stop(end);
      wobble.start(start);
      wobble.stop(end);
    }

    music(name) {
      const resolved = this.entry("music", name) || !name.startsWith("boss") || !this.entry("music", "boss") ? name : "boss";
      if (resolved === this.track) return;
      this.track = resolved;
      this.startTrack(resolved);
    }

    startTrack(name) {
      if (this.element) {
        this.element.audio.pause();
        this.element = null;
      }
      this.song = null;
      if (!this.ctx) return;

      const entry = this.entry("music", name);
      if (!entry) {
        this.song = this.compose(name);
        return;
      }
      const audio = new Audio(entry.file);
      audio.loop = entry.loop !== false;
      const element = (this.element = { audio, volume: entry.volume });
      const fallback = () => {
        if (this.element !== element) return;
        this.element = null;
        this.song = this.compose(name);
      };
      audio.addEventListener("error", fallback, { once: true });
      this.applyVolume();
      audio.play().catch((error) => {
        if (error.name === "NotSupportedError") fallback();
      });
    }

    compose(name) {
      const spec = TRACKS[name] || TRACKS.menu;
      const random = rng(hash(spec.seed || name));
      const phrase = () => {
        let note = 4;
        return Array.from({ length: 16 }, (_, i) => {
          if (random() > (i % 4 === 0 ? 0.92 : i % 2 === 0 ? 0.5 : 0.16)) return null;
          note = clamp(note + random.pick([-2, -1, -1, 1, 1, 2, 3]), 0, 10);
          return note;
        });
      };
      return { spec, a: phrase(), b: phrase(), step: 0, next: this.ctx.currentTime + 0.08 };
    }

    schedule() {
      const song = this.song;
      if (!song || this.ctx.state !== "running") return;
      const stepLength = 15 / song.spec.bpm;
      if (song.next < this.ctx.currentTime - 0.3) song.next = this.ctx.currentTime;
      while (song.next < this.ctx.currentTime + LOOKAHEAD) {
        this.playStep(song, song.next, stepLength);
        song.next += stepLength;
        song.step++;
      }
    }

    playStep(song, at, length) {
      const { spec } = song;
      const scale = SCALES[spec.scale];
      const freq = (degree, octave = 0) => {
        const semis = spec.root + octave * 12 + scale[degree % 7] + Math.floor(degree / 7) * 12;
        return 440 * 2 ** ((semis - 69) / 12);
      };
      const step = song.step % 16;
      const bar = Math.floor(song.step / 16);
      const chord = spec.chords[bar % spec.chords.length];
      const bus = this.musicGain;

      if (step === 0) {
        for (const degree of [chord, chord + 2, chord + 4]) {
          const f = freq(degree, 1);
          this.t("sine", f, f, length * 16, 0.055, 0, bus, at);
        }
      }

      const bassOn = spec.drums >= 2 ? step % 2 === 0 : step === 0 || step === 6 || step === 10;
      if (bassOn) {
        const f = freq(chord + (step === 10 ? 4 : 0));
        this.t("triangle", f, f, length * (spec.drums >= 2 ? 1.6 : 4), 0.2, 0, bus, at);
      }

      // The melody rests for four bars in every twelve.
      if (bar % 12 < 8) {
        const note = (bar % 4 < 2 ? song.a : song.b)[step];
        if (note !== null) {
          const f = freq(chord + note, 2);
          const volume = spec.lead === "sine" ? 0.12 : spec.lead === "triangle" ? 0.1 : 0.035;
          this.t(spec.lead, f, f, length * 3, volume, 0, bus, at);
        }
      }

      // The space tracks run a quick arpeggio under everything.
      if (spec.arp && bar % 8 >= 2) {
        const f = freq(chord + [0, 2, 4, 7][step % 4], 2);
        this.t(spec.arp, f, f, length * 0.8, spec.arp === "square" ? 0.018 : 0.04, 0, bus, at);
      }

      if (spec.drums) {
        if (step === 0 || step === 8 || (spec.drums === 3 && step === 11)) this.t("sine", 150, 42, 0.2, 0.4, 0, bus, at);
        if (spec.drums >= 2 && (step === 4 || step === 12)) this.n("bandpass", 1700, 600, 0.14, 0.18, 0, bus, at);
        const hat = spec.drums === 3 ? step % 2 === 0 : step % 4 === 2;
        if (hat) this.n("highpass", 7000, 6000, 0.04, 0.07, 0, bus, at);
      }
    }
  }

  MQ.AudioManager = AudioManager;
})(window.MQ);
