// Replays a round's event log and checks it could have come from a real game.
// No Deno or browser APIs, so the tests run it in Node:
//   node --test games/turkey_toss/tests/leaderboard-server.test.mjs
//
// game/ holds exact copies of the game's js/config.js, js/multipliers.js and js/scoring.js,
// so the server scores a round with the same code the player's browser used. After changing
// any of those three files, copy them here again (the tests fail until you do).
//
// The log is a list of [time, type, slice, detail] entries, in the order they happened.
// `time` is the round clock (seconds since "Go!", stopping at the buzzer) and `slice` is
// the throw number, 0 for the first leg thrown:
//   [t, 'throw', slice]
//   [t, 'bowl', slice, 'cranberry' | 'gravy']
//   [t, 'cornucopia', slice]
//   [t, 'bounce', slice]                 a bounce off the giant turkey
//   [t, 'plate', slice, plateId]         a scoring landing
//   [t, 'floor', slice]                  only logged when the penalty applied
//   [t, 'flyer', slice]                  hit the flying turkey
//   [t, 'end', 'time' | 'slices']        the buzzer

import {
  ROUND, LAUNCH, SERVING, TABLE, PLATE, PLATES, BOWLS, GIANT_TURKEY, FLYING_TURKEY, FLOOR,
} from './game/config.js';
import { Multipliers } from './game/multipliers.js';
import { scoreLanding, addScore } from './game/scoring.js';

export const LIMITS = {
  // A full round logs about 130 events, so this is plenty.
  maxEvents: 600,
  // The next leg appears 0.3 s after a throw. A stalled frame can shave a little off that
  // on the round clock, so the check allows some slack.
  minThrowGapSeconds: 0.2,
  // No more than this many throws in any 10 seconds, the length of a bowl bonus. That's one
  // every 0.4 s, faster than a person can grab, drag and release, with room for a slow device
  // whose clock runs behind. Without this, a script could stack every bowl hit in the round into one 10 second window.
  throwWindowSeconds: 10,
  maxThrowsPerWindow: 25,
  // Nothing moves faster across the table than the hardest throw, so a leg can't reach a
  // target sooner than distance / LAUNCH.maxSpeed. The margin keeps the check generous.
  targetMarginWorldUnits: 0.5,
  // Wall-clock seconds the server allows for network delay when checking that a round
  // lasted as long as its log says.
  clockSlackSeconds: 3,
  // Unsubmitted rounds are forgotten after this long.
  roundMaxAgeSeconds: 6 * 60 * 60,
};

const NAME_MAX = 16;

/** Same rules as cleanName() in js/leaderboard.js. */
export function cleanName(raw) {
  return String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

// Shortest time a leg can take to reach something centered at (x, z) with this radius.
function minFlight(x, z, radius) {
  const distance = Math.hypot(x - SERVING.x, z - SERVING.z) - radius - LIMITS.targetMarginWorldUnits;
  return Math.max(0, distance) / LAUNCH.maxSpeed;
}

const PLATE_INFO = new Map(PLATES.map((plate) => [plate.id, {
  points: plate.points,
  minFlight: minFlight(plate.x, plate.z, PLATE.radius),
}]));
const BOWL_MIN_FLIGHT = Object.fromEntries(Object.entries(BOWLS).map(([kind, bowl]) => [
  kind, minFlight(bowl.x, bowl.z, bowl.outerRadius),
]));
// The cornucopia sits in the back-left corner (see scene.js). 2.5 covers its whole horn.
const CORNUCOPIA_MIN_FLIGHT = minFlight(-2.55, TABLE.backZ + 1.2, 2.5);
const TURKEY_MIN_FLIGHT = minFlight(GIANT_TURKEY.x, GIANT_TURKEY.z, GIANT_TURKEY.platterRadius + 0.5);
// The flying turkey takes off between these round times and is gone a flight later.
const FLYER_EARLIEST = FLYING_TURKEY.earliestSeconds;
const FLYER_LATEST = FLYING_TURKEY.latestSeconds + FLYING_TURKEY.flightSeconds + 0.5;

class Rejected extends Error {}

function reject(reason) {
  throw new Rejected(reason);
}

/**
 * Replays `events` and checks the result equals `claimedScore`.
 * Returns { ok: true, score, minSeconds } where minSeconds is the shortest real time the
 * round can have taken, or { ok: false, reason }.
 */
export function verifyRound(events, claimedScore) {
  try {
    const result = replay(events);
    if (result.score !== claimedScore) reject('the score does not match the round');
    if (result.score <= 0) reject('only scores above zero go on the board');
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof Rejected) return { ok: false, reason: error.message };
    throw error;
  }
}

function replay(events) {
  if (!Array.isArray(events) || events.length === 0) reject('the round log is missing');
  if (events.length > LIMITS.maxEvents) reject('the round log is too long');

  const multipliers = new Multipliers();
  const throwTimes = [];
  const slices = [];
  const occupied = new Set();
  let score = 0;
  let windowStart = 0;
  let lastTime = 0;
  let endTime = null;
  let flyerHit = false;

  const sliceFor = (entry) => {
    const slice = slices[entry[2]];
    if (!Number.isInteger(entry[2]) || !slice) reject('an event names a leg that was never thrown');
    return slice;
  };
  const stillFlying = (slice) => {
    if (slice.outcome || slice.floored) reject('a leg did something after it had already finished');
  };
  // Only checked while the clock runs: after the buzzer it stops, so later events share its time.
  const checkFlight = (slice, time, shortest) => {
    if (endTime === null && time - slice.thrownAt < shortest) reject('a leg got somewhere faster than a throw can');
  };

  for (const entry of events) {
    if (!Array.isArray(entry) || entry.length < 2 || entry.length > 4) reject('a round event is malformed');
    const [time, type] = entry;
    if (typeof time !== 'number' || !Number.isFinite(time) || time < lastTime) reject('round events are out of order');
    if (endTime !== null && time !== endTime) reject('the clock kept running after the buzzer');
    lastTime = time;
    multipliers.expireBoosts(time);

    switch (type) {
      case 'throw': {
        if (endTime !== null) reject('a leg was thrown after the buzzer');
        if (entry[2] !== throwTimes.length) reject('throws are numbered wrong');
        if (throwTimes.length >= ROUND.slices) reject(`more than ${ROUND.slices} legs were thrown`);
        if (time > ROUND.durationSeconds) reject('a leg was thrown after time ran out');
        const previous = throwTimes[throwTimes.length - 1];
        if (previous !== undefined && time - previous < LIMITS.minThrowGapSeconds) reject('legs were thrown too quickly');
        throwTimes.push(time);
        while (throwTimes[windowStart] <= time - LIMITS.throwWindowSeconds) windowStart += 1;
        if (throwTimes.length - windowStart > LIMITS.maxThrowsPerWindow) reject('legs were thrown too quickly');
        slices.push({ thrownAt: time, bounces: 0, cornucopia: false, floored: false, outcome: null });
        break;
      }
      case 'bowl': {
        const slice = sliceFor(entry);
        stillFlying(slice);
        const kind = entry[3];
        if (!Object.hasOwn(BOWL_MIN_FLIGHT, kind)) reject('an unknown bowl was hit');
        checkFlight(slice, time, BOWL_MIN_FLIGHT[kind]);
        slice.outcome = 'bowl';
        multipliers.addBowlHit(kind, time);
        break;
      }
      case 'cornucopia': {
        const slice = sliceFor(entry);
        stillFlying(slice);
        if (slice.cornucopia) reject('a leg hit the cornucopia twice');
        checkFlight(slice, time, CORNUCOPIA_MIN_FLIGHT);
        slice.cornucopia = true;
        multipliers.addCornucopiaHit(time);
        break;
      }
      case 'bounce': {
        const slice = sliceFor(entry);
        stillFlying(slice);
        if (slice.bounces >= GIANT_TURKEY.maxBounces) reject('a leg bounced too many times');
        checkFlight(slice, time, TURKEY_MIN_FLIGHT);
        slice.bounces += 1;
        break;
      }
      case 'plate': {
        const slice = sliceFor(entry);
        stillFlying(slice);
        const plate = PLATE_INFO.get(entry[3]);
        if (!plate) reject('a leg landed on an unknown plate');
        checkFlight(slice, time, plate.minFlight);
        slice.outcome = 'plate';
        const result = scoreLanding(plate.points, multipliers, { bounced: slice.bounces > 0 });
        score = addScore(score, result.points);
        // As in the game, the landing that fills the last plate scores before the bonus starts.
        occupied.add(entry[3]);
        if (occupied.size === PLATES.length) multipliers.completeTable();
        break;
      }
      case 'floor': {
        const slice = sliceFor(entry);
        if (slice.floored || slice.outcome === 'bowl' || slice.outcome === 'plate') {
          reject('a leg reached the floor after it had already finished');
        }
        slice.floored = true;
        score = addScore(score, -FLOOR.penalty);
        break;
      }
      case 'flyer': {
        const slice = sliceFor(entry);
        stillFlying(slice);
        if (flyerHit) reject('the flying turkey was hit twice');
        if (time < FLYER_EARLIEST || time > FLYER_LATEST) reject('the flying turkey was hit while it was away');
        flyerHit = true;
        slice.outcome = 'flyer';
        score = addScore(score, FLYING_TURKEY.bonusPoints);
        break;
      }
      case 'end': {
        if (endTime !== null) reject('the round ended twice');
        if (entry[2] === 'time') {
          if (time < ROUND.durationSeconds) reject('the round ended before time ran out');
        } else if (entry[2] === 'slices') {
          if (throwTimes.length !== ROUND.slices) reject('the round ended with legs still on the platter');
        } else {
          reject('the round ended for an unknown reason');
        }
        endTime = time;
        break;
      }
      default:
        reject('a round event has an unknown type');
    }
  }

  if (endTime === null) reject('the round never ended');
  return { score, minSeconds: ROUND.readySeconds + endTime };
}
