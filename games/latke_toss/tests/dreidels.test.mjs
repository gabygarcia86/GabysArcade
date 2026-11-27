// Checks that the dreidels always land in the play area. From the repository root:
//   node --test games/latke_toss/tests/dreidels.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DREIDEL } from '../js/config.js';
import { inPlayArea, spotIsFree, chooseDreidelSpots, FALLBACK_SPOTS, THROW_REACH } from '../js/dreidels.js';

// The five dreidels' hit radii, from dreidelSpecs in scene.js: three at scale 1, two at 1.25.
const RADII = [1, 1, 1, 1.25, 1.25].map((scale) => DREIDEL.radius * scale);

/** A repeatable stand-in for Math.random. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function assertGoodLayout(spots) {
  assert.equal(spots.length, RADII.length);
  spots.forEach((spot, i) => {
    assert.equal(spot.radius, RADII[i]);
    assert.ok(inPlayArea(spot.x, spot.z, spot.radius), `dreidel ${i} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) is outside the play area`);
    assert.ok(spotIsFree(spot.x, spot.z, spot.radius, spots.slice(0, i)), `dreidel ${i} overlaps the pot, menorah or another dreidel`);
  });
}

test('every random layout puts all five dreidels in the play area, apart from each other', () => {
  for (let seed = 1; seed <= 3000; seed++) assertGoodLayout(chooseDreidelSpots(RADII, seeded(seed)));
});

test('the fallback spots are in the play area too', () => {
  const spots = FALLBACK_SPOTS.map((spot, i) => ({ ...spot, radius: RADII[i] }));
  assertGoodLayout(spots);
  // A random source that never finds a spot forces the fallback.
  assert.deepEqual(chooseDreidelSpots(RADII, () => 0.5), spots);
});

test('the play area matches the throw', () => {
  // Straight ahead, within reach.
  assert.ok(inPlayArea(0, -6.6, 0.36));
  // Past the 32 degree aim limit, where the old layout often put dreidels.
  assert.equal(inPlayArea(5.6, -1.6, 0.36), false);
  assert.equal(inPlayArea(-5.4, 0.6, 0.36), false);
  // Off the edge of a narrow portrait screen, though a throw could reach it.
  assert.equal(inPlayArea(5.9, -7, 0.36), false);
  // In front of the plate's shortest throw.
  assert.ok(THROW_REACH.min > 2.5 && THROW_REACH.max > 12);
  assert.equal(inPlayArea(0, 1.5, 0.36), false);
});
