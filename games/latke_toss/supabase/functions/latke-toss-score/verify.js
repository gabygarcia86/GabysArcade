// Replays a round's event log and checks it could have come from a real game.
// No Deno or browser APIs, so the tests run it in Node:
//   node --test games/latke_toss/tests/leaderboard-server.test.mjs
//
// game/ holds exact copies of the game's js/config.js and js/scoring.js, so the server scores
// a round with the same code the player's browser used. After changing either file, copy it
// here again (the tests fail until you do).
//
// The log is a list of [time, type, latke, detail] entries, in the order they happened.
// `time` is the round clock (seconds since "Go!") and `latke` is the throw number, 0 for the
// first latke thrown:
//   [t, 'throw', latke] or [t, 'throw', latke, 'golden']
//   [t, 'hit', latke] or [t, 'hit', latke, 'clean']   landed in the pot
//   [t, 'miss', latke]
//   [t, 'dreidel', latke, dreidelIndex]                 hit a dreidel (0 to 4)
//   [t, 'menorah', latke]                               knocked the menorah
// Only events while the clock runs are logged: nothing scores after the buzzer.

import { ROUND, LAUNCH, POT, DIFFICULTIES, GOLDEN } from './game/config.js';
import { RoundScore } from './game/scoring.js';

export const LIMITS = {
  // A full round logs a few hundred events, so this is plenty.
  maxEvents: 1500,
  // The next latke appears 0.3 s after a throw. A stalled frame can shave a little off that
  // on the round clock, so the check allows some slack.
  minThrowGapSeconds: 0.2,
  // No more than this many throws in any 10 seconds, the length of a dreidel boost. That's one
  // every 0.4 s, faster than a person can grab, drag and release, with room for a slow device
  // whose clock runs behind. Without this, a script could stack far more dreidel boosts than a player ever could.
  throwWindowSeconds: 10,
  maxThrowsPerWindow: 25,
  // Nothing reaches the pot faster than the hardest throw, so a latke can't land sooner than
  // distance / LAUNCH.maxSpeed. The margin keeps the check generous.
  targetMarginWorldUnits: 0.5,
  // The most the leaderboard table accepts (score_range in leaderboard.sql).
  maxScore: 100_000_000,
  // Wall-clock seconds the server allows for network delay when checking that a round
  // lasted as long as it should.
  clockSlackSeconds: 3,
  // Unsubmitted rounds are forgotten after this long.
  roundMaxAgeSeconds: 6 * 60 * 60,
};

// Matches game.js (LAUNCH_POSITION) and scene.js (the dreidels).
const LAUNCH_Z = 3.2;
const DREIDEL_COUNT = 5;
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

export function isDifficulty(key) {
  return typeof key === 'string' && Object.hasOwn(DIFFICULTIES, key);
}

// Shortest time a latke can take to reach the pot, from the closest the pot ever comes.
const POT_MIN_FLIGHT = Object.fromEntries(Object.entries(DIFFICULTIES).map(([key, d]) => {
  const nearestZ = (d.randomCenter ? d.randomCenter.z[1] : d.center.z) + d.amplitude.z;
  const distance = LAUNCH_Z - nearestZ - POT.outerRadius - LIMITS.targetMarginWorldUnits;
  return [key, Math.max(0, distance) / LAUNCH.maxSpeed];
}));

class Rejected extends Error {}

function reject(reason) {
  throw new Rejected(reason);
}

/**
 * Replays `events` for a difficulty and checks the result equals `claimedScore`.
 * Returns { ok: true, score, minSeconds } where minSeconds is the shortest real time the
 * round can have taken, or { ok: false, reason }.
 */
export function verifyRound(events, claimedScore, difficulty) {
  try {
    if (!isDifficulty(difficulty)) reject('the difficulty is unknown');
    const score = replay(events, difficulty);
    if (score !== claimedScore) reject('the score does not match the round');
    if (score <= 0) reject('only scores above zero go on the board');
    if (score > LIMITS.maxScore) reject('the score is higher than the board can hold');
    return { ok: true, score, minSeconds: ROUND.readySeconds + ROUND.durationSeconds };
  } catch (error) {
    if (error instanceof Rejected) return { ok: false, reason: error.message };
    throw error;
  }
}

function replay(events, difficulty) {
  if (!Array.isArray(events) || events.length === 0) reject('the round log is missing');
  if (events.length > LIMITS.maxEvents) reject('the round log is too long');

  const scoring = new RoundScore();
  const throwTimes = [];
  const latkes = [];
  let windowStart = 0;
  let lastTime = 0;
  let lastGolden = -1;

  const latkeFor = (entry) => {
    const latke = latkes[entry[2]];
    if (!Number.isInteger(entry[2]) || !latke) reject('an event names a latke that was never thrown');
    return latke;
  };
  const unresolved = (latke) => {
    if (latke.outcome) reject('a latke landed or missed twice');
  };
  // A missed latke can still bounce into a dreidel or the menorah. One in the pot can't.
  const notInPot = (latke) => {
    if (latke.outcome === 'hit') reject('a latke did something after landing in the pot');
  };

  for (const entry of events) {
    if (!Array.isArray(entry) || entry.length < 3 || entry.length > 4) reject('a round event is malformed');
    const [time, type, , detail] = entry;
    if (typeof time !== 'number' || !Number.isFinite(time) || time < lastTime) reject('round events are out of order');
    if (time > ROUND.durationSeconds) reject('something happened after the buzzer');
    lastTime = time;
    // The game does both at the start of every physics step, before anything else happens.
    scoring.expireBoosts(time);
    scoring.checkFinalFry(time);

    switch (type) {
      case 'throw': {
        if (entry[2] !== throwTimes.length) reject('throws are numbered wrong');
        if (detail !== undefined && detail !== 'golden') reject('a throw is malformed');
        const previous = throwTimes[throwTimes.length - 1];
        if (previous !== undefined && time - previous < LIMITS.minThrowGapSeconds) reject('latkes were thrown too quickly');
        throwTimes.push(time);
        while (throwTimes[windowStart] <= time - LIMITS.throwWindowSeconds) windowStart += 1;
        if (throwTimes.length - windowStart > LIMITS.maxThrowsPerWindow) reject('latkes were thrown too quickly');
        const golden = detail === 'golden';
        if (golden) {
          // At least GOLDEN.minGap regular latkes come between golden ones, and the first is never golden.
          if (entry[2] - lastGolden <= GOLDEN.minGap) reject('golden latkes came too often');
          lastGolden = entry[2];
        }
        latkes.push({ thrownAt: time, golden, outcome: null, dreidels: new Set(), menorah: false });
        break;
      }
      case 'hit': {
        const latke = latkeFor(entry);
        unresolved(latke);
        if (detail !== undefined && detail !== 'clean') reject('a landing is malformed');
        if (time - latke.thrownAt < POT_MIN_FLIGHT[difficulty]) reject('a latke reached the pot faster than a throw can');
        latke.outcome = 'hit';
        scoring.landLatke({ golden: latke.golden, clean: detail === 'clean' });
        break;
      }
      case 'miss': {
        const latke = latkeFor(entry);
        unresolved(latke);
        if (detail !== undefined) reject('a miss is malformed');
        latke.outcome = 'miss';
        scoring.missLatke();
        break;
      }
      case 'dreidel': {
        const latke = latkeFor(entry);
        notInPot(latke);
        if (!Number.isInteger(detail) || detail < 0 || detail >= DREIDEL_COUNT) reject('an unknown dreidel was hit');
        if (latke.dreidels.has(detail)) reject('a latke hit the same dreidel twice');
        latke.dreidels.add(detail);
        scoring.hitDreidel(time);
        break;
      }
      case 'menorah': {
        const latke = latkeFor(entry);
        notInPot(latke);
        if (detail !== undefined) reject('a menorah hit is malformed');
        if (latke.menorah) reject('a latke hit the menorah twice');
        latke.menorah = true;
        scoring.hitMenorah();
        break;
      }
      default:
        reject('a round event has an unknown type');
    }
  }
  return scoring.score;
}
