/*
 * Every tunable number in the game lives here, so balancing never means
 * hunting through the code. Distances are in world pixels unless noted, and
 * speeds are world pixels per second.
 */
export const CONFIG = {
  view: {
    minWidth: 320,   // The canvas always shows at least this many game pixels...
    minHeight: 480,  // ...and this many. Less means chunkier pixels.
    maxWidth: 1100,  // Ultrawide screens get black bars past this.
  },

  world: {
    playHalf: 300,       // The player can skate from -playHalf to +playHalf.
    roadHalf: 130,       // Half the width of the road in the street biome.
    sidewalk: 40,        // Width of each sidewalk.
    segmentLength: 1800, // How long a biome lasts before the next one starts.
    pxPerMeter: 12,
  },

  player: {
    startSpeed: 150,
    cruiseMax: 290,      // Cruise speed creeps up to this...
    cruiseRamp: 1.1,     // ...at this many px/s every second.
    boost: 95,           // Extra speed while holding W / Up.
    brake: 85,           // Speed lost while holding S / Down.
    minSpeed: 70,
    speedResponse: 3,    // How quickly speed reaches its target.
    steerSpeed: 265,     // Top sideways speed.
    grip: 8,             // Higher is tighter, lower is more slippery.
    puddleGrip: 1.1,     // Grip while slipping on a puddle.
    slipTime: 1.1,
    crackSlowdown: 0.62, // Speed multiplier when rolling over a crack.
    ollieVelocity: 158,
    gravity: 560,
    rampVelocity: 262,
    ollieAirBoost: 1.1,  // Speed multiplier in the air, so jumps gain ground.
    rampAirBoost: 1.38,
    landingLag: 0.12,    // Delay before you can ollie again.
    flipTime: 0.26,      // Seconds for one flip.
    flipForgiveness: 0.7, // Land a flip at least this finished and it still counts.
    wipeoutTime: 0.75,
    recoverTime: 0.55,
    invulnerableTime: 1.2,
  },

  // Collectible effects, in seconds and px/s.
  powerups: {
    sodaTime: 4,
    sodaBoost: 65,
    rocketTime: 3,
    rocketBoost: 190,
    energyTime: 8,
    energyJump: 1.34,
  },

  spawn: {
    gapStart: 165,      // Forward distance between rows of obstacles.
    gapEnd: 88,         // Gap once the world is at its busiest.
    gapRampMeters: 1800,
    safeLaneWidth: 46,  // Half-width of the corridor always kept free of solids.
    safeLaneDrift: 0.5, // Max sideways drift of that corridor per forward px.
    collectibleChance: 0.13,
    clearStart: 340,    // Empty runway at the start of a game.
  },

  chase: {
    triggerSeconds: 60,    // The chase starts around this time...
    triggerJitter: 12,     // ...give or take this many seconds...
    triggerMeters: 1600,   // ...or at this distance, whichever is first.
    warningDelay: 1.4,     // Pause between the warning and the pursuer arriving.
    headStart: 22,         // Pursuer's speed advantage over cruise at the start.
    ramp: 3.6,             // Extra speed gained every second of the chase.
    lateralSpeed: 170,     // Sideways speed at the start of the chase...
    lateralRamp: 3.5,      // ...and how much it gains every second.
    catchRadius: 15,
    catchHeight: 30,       // Fly higher than this and they can't reach you.
    leash: 26,             // Stays this far inside the bottom edge at most.
    dialogueEvery: 3.4,
  },

  points: {
    perTenMeters: 10,
    avoid: 5,
    jump: 25,
    jumpPedestrian: 15,
    flip: 5,               // Each flip in one jump adds this much more: 5, 15, 30, 50...
    collect: 50,
    goldWheel: 150,
  },
};

export const PURSUERS = {
  cop: {
    name: "THE COP",
    lines: ["PULL OVER!", "NO SKATEBOARDING!", "STOP RIGHT THERE!"],
    gameOver: ["SKATEBOARDING IS ILLEGAL!", "YOUR SKATING LICENSE HAS BEEN REVOKED!", "YOU'VE BEEN GROUNDED!"],
  },
  karen: {
    name: "KAREN",
    lines: ["I'M CALLING THE MANAGER!", "THINK OF THE CHILDREN!", "YOU CAN'T SKATE HERE!"],
    gameOver: ["THE MANAGER WANTS TO SEE YOU!", "YOU'VE BEEN GROUNDED!", "SKATEBOARDING IS ILLEGAL!"],
  },
};
