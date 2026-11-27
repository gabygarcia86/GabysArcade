// Where the dreidels may stand. Each game scatters them to random spots inside the play area:
// places a throw can reach and the screen always shows, clear of the pot, the menorah and each
// other. No Three.js here, so the tests can check the rules in Node. scene.js takes its camera,
// plate and menorah positions from here, so the rules can't drift from the scene.

import { LAUNCH, PHYSICS, LATKE } from './config.js';

// The camera sits behind the plate. However narrow the screen, it keeps at least
// VISIBLE_HALF_WIDTH visible either side at VISIBLE_DEPTH in front of it (see resize() in scene.js).
export const CAMERA_Z = 7.6;
export const VISIBLE_HALF_WIDTH = 3.7;
export const VISIBLE_DEPTH = 10.4;

// Where the latke rests and is thrown from (REST_POSITION and LAUNCH_POSITION in game.js).
export const PLATE_Z = 3.2;
const LAUNCH_HEIGHT = 0.06 + LATKE.thickness * 0.5 + 0.015 + 0.3;

export const MENORAH_SPOT = { x: -2.9, z: -6.0 };

export const DREIDEL_AREA = {
  zBack: -7.0, // far enough forward to stay below the HUD
  zFront: 0.6, // stays behind the plate and the decorative gelt
  gap: 0.7, // space kept between neighboring dreidels
};
// Everywhere the pot can be on any difficulty, padded for its rim and floating halo.
const POT_KEEP_OUT = { x: 3.4, zMin: -5.9, zMax: -0.1 };
// The menorah's footprint (its arms spread along x).
const MENORAH_KEEP_OUT = { halfX: 1.5, halfZ: 0.5 };

// How far a throw lands on the table at the weakest and strongest drag.
function throwRange(speed) {
  const angle = (LAUNCH.elevationDegrees * Math.PI) / 180;
  const up = speed * Math.sin(angle);
  return (speed * Math.cos(angle) * (up + Math.sqrt(up * up + 2 * PHYSICS.gravity * LAUNCH_HEIGHT))) / PHYSICS.gravity;
}
export const THROW_REACH = { min: throwRange(LAUNCH.minSpeed), max: throwRange(LAUNCH.maxSpeed) };
const MAX_AIM_TAN = Math.tan((LAUNCH.maxYawDegrees * Math.PI) / 180);
const VISIBLE_TAN = VISIBLE_HALF_WIDTH / VISIBLE_DEPTH;

/**
 * Whether a dreidel of this radius at (x, z) is in the play area: within the depth range,
 * inside the sideways aim limit and the throw's reach, and wholly on screen.
 */
export function inPlayArea(x, z, radius) {
  if (z < DREIDEL_AREA.zBack || z > DREIDEL_AREA.zFront) return false;
  const ahead = PLATE_Z - z;
  if (Math.abs(x) > MAX_AIM_TAN * ahead) return false;
  // A latke clips a dreidel up to its radius before reaching the dreidel's center.
  const distance = Math.hypot(x, ahead);
  if (distance < THROW_REACH.min - radius || distance > THROW_REACH.max) return false;
  // Horizontal distance from the camera is a little less than the view depth, so this is
  // on the safe side.
  return Math.abs(x) + radius <= VISIBLE_TAN * (CAMERA_Z - z);
}

/** Whether a spot keeps clear of the pot's path, the menorah and the dreidels already placed. */
export function spotIsFree(x, z, radius, placed) {
  if (Math.abs(x) < POT_KEEP_OUT.x + radius && z > POT_KEEP_OUT.zMin - radius && z < POT_KEEP_OUT.zMax + radius) return false;
  if (Math.abs(x - MENORAH_SPOT.x) < MENORAH_KEEP_OUT.halfX + radius
    && Math.abs(z - MENORAH_SPOT.z) < MENORAH_KEEP_OUT.halfZ + radius) return false;
  return placed.every((other) => Math.hypot(x - other.x, z - other.z) >= radius + other.radius + DREIDEL_AREA.gap);
}

// Spots used if random placement ever fails. They're all in the play area (the tests check),
// with the two bigger dreidels (radius ~0.45) last, matching dreidelSpecs in scene.js.
export const FALLBACK_SPOTS = [
  { x: 2.0, z: -6.6 },
  { x: 3.8, z: -6.6 },
  { x: -1.0, z: 0.45 },
  { x: 0.2, z: -6.7 },
  { x: 1.1, z: 0.4 },
];

const ATTEMPTS_PER_SPOT = 400;
const LAYOUT_TRIES = 50;

/**
 * Random spots for dreidels with these radii, in order, as [{ x, z, radius }]. If a dreidel
 * can't be fitted, the whole layout starts over, and after many tries the fallback spots are
 * used, so every dreidel always ends up in the play area.
 */
export function chooseDreidelSpots(radii, random = Math.random) {
  const between = (min, max) => min + random() * (max - min);
  for (let attempt = 0; attempt < LAYOUT_TRIES; attempt++) {
    const placed = [];
    for (const radius of radii) {
      let spot = null;
      for (let i = 0; i < ATTEMPTS_PER_SPOT && !spot; i++) {
        const z = between(DREIDEL_AREA.zBack, DREIDEL_AREA.zFront);
        // Only pick x where the aim limit and the screen edge both allow it.
        const halfWidth = Math.min(MAX_AIM_TAN * (PLATE_Z - z), VISIBLE_TAN * (CAMERA_Z - z) - radius);
        const x = between(-halfWidth, halfWidth);
        if (inPlayArea(x, z, radius) && spotIsFree(x, z, radius, placed)) spot = { x, z, radius };
      }
      if (!spot) break;
      placed.push(spot);
    }
    if (placed.length === radii.length) return placed;
  }
  return radii.map((radius, i) => ({ ...FALLBACK_SPOTS[i % FALLBACK_SPOTS.length], radius }));
}
