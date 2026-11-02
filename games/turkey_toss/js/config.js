// Central tuning values for Turkey Toss.
// Everything gameplay-related that you might want to tweak lives here so the rest of the
// code can stay focused on behaviour. Units are "world units" (roughly meters) and seconds.
// The table top is y = 0, -Z runs away from the player, and +X is to the player's right.

export const ROUND = {
  // Length of a round in seconds.
  durationSeconds: 60,
  // Slices on the serving platter. The round ends when these or the clock run out.
  slices: 60,
  // Short "Ready... Go!" lead-in before the clock starts.
  readySeconds: 1.4,
  // Slices already in the air at the buzzer may still land for this long.
  windDownSeconds: 2.6,
  // Delay after a throw before the next slice appears. Same as Latke Toss.
  respawnDelaySeconds: 0.3,
};

export const PHYSICS = {
  // Downward acceleration (world units / s^2). The aiming preview uses the same value.
  gravity: 14,
  // Fixed physics timestep. 120 Hz keeps fast throws from tunnelling through thin shapes.
  fixedTimestep: 1 / 120,
  // Upper bound on simulated time per rendered frame (prevents a "spiral of death" after
  // the tab was in the background).
  maxFrameTime: 0.25,
  solverIterations: 6,
  // Fraction of horizontal speed kept on the first touch of the table or a plate, and per
  // physics step while touching. Low values are what let a thrown slice stop on a plate.
  impactGrip: 0.22,
  contactGrip: 0.8,
  tableRestitution: 0.16,
  plateRestitution: 0.12,
  bowlRestitution: 0.35,
  decorRestitution: 0.3,
  // Slices that wander outside this box are removed.
  bounds: { minX: -20, maxX: 20, minY: -6, minZ: -16, maxZ: 12 },
  // Safety net: any throw still unresolved after this many seconds is a miss.
  maxFlightSeconds: 5,
};

export const LAUNCH = {
  // Launch speed range (world units / s). Drag length maps linearly between these.
  minSpeed: 6,
  maxSpeed: 14,
  // Fixed launch elevation above the horizontal, in degrees. Drag length controls distance.
  elevationDegrees: 55,
  // Maximum sideways aim, in degrees either side of straight ahead. Wide enough to reach
  // the closest plates, which sit well off to the sides.
  maxYawDegrees: 54,
  // Drag distance (as a fraction of the viewport height) that gives full power.
  fullPowerDragFraction: 0.4,
  // Drag distance (fraction of viewport height) below which a release cancels the throw.
  cancelDragFraction: 0.05,
  // Grab radius around the slice, in CSS pixels (in addition to the 3D raycast hit box).
  grabRadiusPx: 70,
  // Tumbling rate range (radians / s) around the slice's horizontal axis.
  minFlipSpeed: 7,
  maxFlipSpeed: 12,
};

export const TABLE = {
  halfWidth: 3.95,
  frontZ: 5.3,
  backZ: -9.7,
};

export const FLOOR = {
  // Height of the dining room floor. The table top is y = 0.
  y: -3.2,
  // Points lost when a slice lands on it. The score never drops below zero.
  penalty: 10,
};

// The player's serving platter, and where throws start.
export const SERVING = {
  x: 0,
  z: 3.75,
  restHeight: 0.13,
  launchHeight: 0.45,
};

export const SLICE = {
  radiusX: 0.37,
  radiusZ: 0.26,
  thickness: 0.07,
  // Spheres that make up the slice's collision shape.
  colliderRadius: 0.05,
  // Distinct procedural shapes generated at start-up.
  variantCount: 3,
  // Largest number of slices alive at once. Must exceed PLATE.maxStack * 9 plus a few in flight.
  poolSize: 64,
};

export const PLATE = {
  radius: 0.74,
  // Height of the physics surface above the table.
  surfaceY: 0.05,
  // A slice's center must be this far inside the plate's radius to count.
  scoringFraction: 0.97,
  // A slice must stay on the plate, nearly still, for this long to score.
  settleSeconds: 0.2,
  settleSpeed: 1.2,
  // Slices kept on one plate. The bottom one is removed when another lands.
  maxStack: 5,
};

// The nine plates. Farther plates are worth more.
export const PLATES = [
  { id: 'left-1', x: -2.6, z: 1.3, points: 1 },
  { id: 'right-1', x: 2.6, z: 1.3, points: 1 },
  { id: 'left-2', x: -2.6, z: -0.9, points: 2 },
  { id: 'right-2', x: 2.6, z: -0.9, points: 2 },
  { id: 'left-3', x: -2.6, z: -3.1, points: 3 },
  { id: 'right-3', x: 2.6, z: -3.1, points: 3 },
  { id: 'left-4', x: -2.6, z: -5.3, points: 5 },
  { id: 'right-4', x: 2.6, z: -5.3, points: 5 },
  { id: 'center-back', x: 0, z: -8.0, points: 10 },
];

// Permanent 4x once every plate holds a slice.
export const TABLE_COMPLETE = {
  multiplier: 4,
};

// Each hit multiplies scores by `multiplier` again for the rest of the round.
export const BOWLS = {
  cranberry: {
    label: 'Cranberry',
    x: 0,
    z: 1.05,
    outerRadius: 0.8,
    openingRadius: 0.68,
    rimHeight: 0.44,
    fillHeight: 0.33,
    multiplier: 2,
  },
  gravy: {
    label: 'Gravy',
    x: 0,
    z: -5.35,
    outerRadius: 0.86,
    openingRadius: 0.74,
    rimHeight: 0.48,
    fillHeight: 0.36,
    multiplier: 3,
  },
};

// Each hit adds its own timed multiplier, so hits stack while their timers overlap.
export const CORNUCOPIA = {
  multiplier: 2,
  seconds: 10,
  // Fruit dropped by one hit, and how long the drop lasts.
  fruitPerHit: 44,
  spreadSeconds: 1.6,
  // Fruit on screen at once; the oldest is recycled when a new shower needs room.
  fruitPoolSize: 90,
  // How long a landed fruit stays before shrinking away.
  lingerSeconds: 5,
};

export const GIANT_TURKEY = {
  x: 0,
  z: -2.05,
  platterRadius: 1.72,
  restitution: 0.8,
  // Landing on a plate after a bounce multiplies that one landing's points.
  bounceMultiplier: 10,
  // Upward speed range given by a bounce.
  minUpSpeed: 10,
  maxUpSpeed: 11.5,
  // Sideways speed before aim help.
  horizontalSpeed: 3.2,
  // 0 = the bounce follows the hit angle, 1 = it heads straight for the nearest plate in
  // that direction. The rest is what keeps a bounce from being a guaranteed plate.
  plateAssist: 0.88,
  // Only plates within this angle of the bounce direction are considered.
  assistConeDegrees: 80,
  // Random miss, as a fraction of the plate radius.
  assistScatter: 0.75,
  // Tumbling speed after a bounce (radians / s).
  spinSpeed: 15,
  // A slice can bounce this many times, with this long between bounces.
  maxBounces: 3,
  bounceCooldownSeconds: 0.2,
};

export const FLYING_TURKEY = {
  bonusPoints: 100,
  // It takes off at a random time between these two round times.
  earliestSeconds: 12,
  latestSeconds: 42,
  // Warning shown before it appears.
  warningSeconds: 1.2,
  // Seconds to cross the screen, whatever the screen's shape.
  flightSeconds: 6.5,
  height: 3.3,
  z: -1.4,
  // Bows of the flight path.
  curveHeight: 0.55,
  curveDepth: 1.1,
  // Hit distance from the turkey's center. Bigger than the model to keep the event fair.
  hitRadius: 1.2,
};

export const PARTICLES = {
  splashDroplets: 34,
  splashSparkles: 14,
  dropletPoolSize: 200,
  sparklePoolSize: 120,
  featherPoolSize: 60,
  confettiPoolSize: 140,
};
