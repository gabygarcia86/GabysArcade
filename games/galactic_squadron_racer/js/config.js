/**
 * Every tuning value in one place: race rules, vehicle physics, boost, drift,
 * surfaces, collisions, camera, AI difficulty, championship points and cups.
 * Ship stats live in shipRoster.js; track layouts live in tracks.js.
 */

export const CONFIG = {
  laps: 3,
  racerCount: 4,
  stepDt: 1 / 120,        // physics substep (frames are split into steps no longer than this)
  maxFrameDt: 1 / 20,     // longer frames (tab hiccups) are clamped so nothing tunnels

  /* -------------------------------------------------------------- physics */
  physics: {
    racerRadius: 24,
    reverseSpeed: 0.3,         // of top speed
    reverseAccel: 520,
    brakeDecel: 1500,
    coastDrag: 0.42,           // exponential decay per second with no throttle
    rollDrag: 0.05,            // always applied
    overSpeedDrag: 2.4,        // pulls speed back to the limit after a boost or on rough ground
    accelFalloff: 0.92,        // thrust fades as speed approaches the limit (1 = fully)
    gripHighSpeedLoss: 0.32,   // share of lateral grip lost at top speed (more slide when fast)
    slideRetention: 0.32,      // share of scrubbed sideways speed fed back into forward speed
    steerResponse: 15,         // how quickly turning follows the stick (1/s)
    turnLowSpeed: 0.5,         // turn rate at a standstill, as a share of the peak
    turnPeakAt: 0.24,          // share of top speed where turning is sharpest
    turnHighSpeed: 0.66,       // turn rate at top speed (wider radius when fast)
    reverseSteerFlip: true,
    keyboardSteerRise: 7.5,    // digital steering ramps in so taps make small corrections
    keyboardSteerFall: 13,
    powerSlide: {
      minSpeed: 0.42,          // share of top speed needed to power-slide (brake + steer)
      grip: 0.36,              // lateral grip multiplier while sliding
      turnBoost: 1.2,
      brakeFactor: 0.18,       // braking is mostly converted into the slide
    },
  },

  /* ---------------------------------------------------------------- boost */
  boost: {
    minToStart: 0.12,          // energy needed to light the boost
    rechargeDelay: 0.7,        // seconds after release before recharging
    rechargeRate: 0.105,       // energy per second (tank is 0..1)
    kick: 45,                  // instant speed added when boost lights
  },

  /* ---------------------------------------------------------------- drift */
  drift: {
    minSlip: 0.2,              // radians between heading and travel direction
    minSpeed: 0.38,
    tiers: [0.55, 1.15, 1.9],  // seconds of drifting for each spark color
    reward: [0.09, 0.18, 0.3], // boost energy granted on release
    turbo: [70, 120, 175],     // mini-turbo speed kick on release
    colors: ['#6fc8ff', '#ffb43a', '#d07bff'],
  },

  /* ------------------------------------------------------------- surfaces */
  // grip: lateral grip multiplier · speed: top speed multiplier
  // drag: extra slowdown above that speed · accel: thrust multiplier
  surfaces: {
    track: { grip: 1, speed: 1, drag: 0, accel: 1 },
    ice: { grip: 0.42, speed: 1, drag: 0, accel: 0.86 },
    slick: { grip: 0.2, speed: 1, drag: 0, accel: 0.7 },
    dust: { grip: 0.8, speed: 0.82, drag: 0.6, accel: 0.9 },
    sand: { grip: 0.8, speed: 0.58, drag: 1.1, accel: 0.75 },
    snow: { grip: 0.62, speed: 0.55, drag: 1.2, accel: 0.75 },
    moss: { grip: 0.85, speed: 0.58, drag: 1.0, accel: 0.8 },
    grating: { grip: 0.9, speed: 0.62, drag: 0.9, accel: 0.8 },
    field: { grip: 0.65, speed: 0.55, drag: 1.2, accel: 0.75 },
    lava: { grip: 0.6, speed: 0.32, drag: 2.6, accel: 0.55, hot: true },
    scrap: { grip: 0.75, speed: 0.56, drag: 1.1, accel: 0.75 },
    hover: { grip: 0.8, speed: 0.6, drag: 1.0, accel: 0.8 },
  },
  boostPad: { speed: 1.25, kick: 140, energy: 0.08 },
  lavaRescueTime: 1.4,         // seconds in lava before the recovery drone lifts you out

  /* ----------------------------------------------------------- collisions */
  collision: {
    wallRestitution: 0.28,
    wallFriction: 0.9,         // tangential speed kept per impact
    wallAlign: 0.35,           // how much a glancing hit turns the nose along the wall
    racerRestitution: 0.45,
    hazardStun: 0.75,          // seconds of instability after a hazard hit
    ghostAfterRespawn: 1.6,    // seconds a respawned racer can't be hit
  },

  /* ------------------------------------------------------------- recovery */
  recovery: {
    stuckSpeed: 45,
    stuckTime: 3.2,            // seconds stuck before AI backs out
    respawnTime: 6,            // seconds without progress before AI respawns
    playerRespawnHint: 3,      // seconds stuck before the player sees the reset hint
    wrongWayTime: 1.1,
  },

  /* --------------------------------------------------------------- camera */
  camera: {
    viewShort: 780,            // world units across the shorter screen side at rest
    viewZoomOut: 0.18,         // extra view at top speed
    lookAhead: 0.3,            // seconds of velocity the camera leads by
    maxLookAhead: 240,
    follow: 7,                 // position smoothing (1/s)
    zoomFollow: 2.2,
    boostShake: 2.2,
  },

  /* ----------------------------------------------------------------- race */
  race: {
    countdown: 3,              // 3-2-1, then GO
    finishWait: 14,            // seconds AI may keep racing after the player finishes
    gridSpacing: 105,
    gridLateral: 0.42,         // share of half-width between grid columns
    checkpointSpacing: 1400,
  },

  /* ------------------------------------------------------------------- AI */
  ai: {
    lineMargin: 46,            // racing line stays this far from the track edge
    names: ['VEX', 'NOVA', 'KESTREL', 'ROOK', 'JINX', 'TALON', 'ECHO', 'SABLE', 'ORION', 'BLAZE', 'ZARA', 'PIKE', 'COMET', 'RIVET', 'MAVERA', 'DUSK'],
    colors: ['#ff5a6a', '#ffc94a', '#7dff8a', '#c58bff'],
    difficulty: {
      easy: { cornerSpeed: 0.84, straightCap: 0.9, line: 0.55, boost: 0.35, react: 0.55, mistakes: 0.22, aggression: 0.2, avoidMiss: 0.35 },
      normal: { cornerSpeed: 0.94, straightCap: 0.98, line: 0.85, boost: 0.7, react: 0.8, mistakes: 0.06, aggression: 0.55, avoidMiss: 0.12 },
      hard: { cornerSpeed: 1.0, straightCap: 1.0, line: 1.0, boost: 1.0, react: 1.0, mistakes: 0, aggression: 0.9, avoidMiss: 0.02 },
    },
  },

  /* ---------------------------------------------------------- championship */
  points: [15, 12, 10, 8],
  cups: [
    { id: 'imperial', name: 'Imperial Cup', desc: 'Four fast, forgiving circuits to learn the ropes.', tracks: ['imperial', 'desert', 'forest', 'city'] },
    { id: 'outer-rim', name: 'Outer Rim Cup', desc: 'Ice, rocks and wreckage. Grip is a luxury.', tracks: ['ice', 'asteroid', 'graveyard'] },
    { id: 'inferno', name: 'Inferno Cup', desc: 'Industrial hazards, lava and the stadium final.', tracks: ['station', 'lava', 'grandprix'] },
    { id: 'galactic', name: 'Galactic Championship', desc: 'All ten tracks back to back.', tracks: ['imperial', 'desert', 'ice', 'forest', 'station', 'asteroid', 'lava', 'city', 'graveyard', 'grandprix'] },
    { id: 'random', name: 'Wildcard Cup', desc: 'Four tracks drawn at random every time.', tracks: null, randomCount: 4 },
  ],

  /* -------------------------------------------------------------- effects */
  effects: {
    maxParticles: 900,
    maxParticlesLow: 260,
    trailLength: 22,
  },
};

export const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.5,
  sfx: 0.85,
  muted: false,
  steering: 1,              // steering sensitivity multiplier (0.6 – 1.4)
  screenShake: true,
  effects: true,
  keyboard: 'both',         // 'both' | 'wasd' | 'arrows'
  touchSteer: 'stick',      // 'stick' | 'buttons'
  autoAccel: false,         // touch: hold throttle automatically
  difficulty: 'normal',
  ship: 'x-ship',
  track: 'imperial',
};

export const DIFFICULTIES = ['easy', 'normal', 'hard'];
