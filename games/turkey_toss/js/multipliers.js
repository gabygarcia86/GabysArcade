import { BOWLS, TABLE_COMPLETE, GIANT_TURKEY, CORNUCOPIA } from './config.js';

// Largest whole number JavaScript and the leaderboard both store exactly.
export const MAX_VALUE = Number.MAX_SAFE_INTEGER;

// The bonuses that run on a timer, and where each one's settings live.
const TIMED = { cranberry: BOWLS.cranberry, gravy: BOWLS.gravy, cornucopia: CORNUCOPIA };

/**
 * The round's multipliers, which combine by multiplying, so two cranberry hits and a gravy
 * hit give 2 x 2 x 3 = 12x. Cranberry, gravy and cornucopia hits each run on their own timer,
 * so they stack only while the timers overlap. The table bonus is permanent. The giant
 * turkey's 10x isn't here: it belongs to one landing, so scoring.js adds it per landing.
 */
export class Multipliers {
  constructor() {
    this.reset();
  }

  reset() {
    this.cranberryHits = 0;
    this.gravyHits = 0;
    this.cornucopiaHits = 0;
    this.tableComplete = false;
    // Round time each running boost ends, soonest first.
    this.boosts = { cranberry: [], gravy: [], cornucopia: [] };
  }

  addBowlHit(kind, now) {
    if (kind === 'cranberry') this.cranberryHits += 1;
    else if (kind === 'gravy') this.gravyHits += 1;
    else throw new Error(`Unknown bowl: ${kind}`);
    this.boosts[kind].push(now + TIMED[kind].seconds);
  }

  addCornucopiaHit(now) {
    this.cornucopiaHits += 1;
    this.boosts.cornucopia.push(now + CORNUCOPIA.seconds);
  }

  /** Drops boosts that have run out. Returns true if any did. */
  expireBoosts(now) {
    let expired = false;
    for (const ends of Object.values(this.boosts)) {
      while (ends.length > 0 && ends[0] <= now) {
        ends.shift();
        expired = true;
      }
    }
    return expired;
  }

  /** Seconds until a bonus's last running boost ends, or 0 if none is running. */
  secondsLeft(kind, now) {
    const ends = this.boosts[kind];
    return ends.length > 0 ? Math.max(0, ends[ends.length - 1] - now) : 0;
  }

  /** What a timed bonus is multiplying scores by right now. */
  factor(kind) {
    return TIMED[kind].multiplier ** this.boosts[kind].length;
  }

  /** Returns true the first time, so the announcement only plays once. */
  completeTable() {
    if (this.tableComplete) return false;
    this.tableComplete = true;
    return true;
  }

  get tableFactor() {
    return this.tableComplete ? TABLE_COMPLETE.multiplier : 1;
  }

  /** The combined multiplier right now, capped so it stays an exact whole number. */
  get total() {
    const timed = Object.keys(TIMED).reduce((product, kind) => product * this.factor(kind), 1);
    return Math.min(MAX_VALUE, timed * this.tableFactor);
  }

  /** The total for one landing, including the bounce bonus if it earned one. */
  totalFor({ bounced = false } = {}) {
    return Math.min(MAX_VALUE, this.total * (bounced ? GIANT_TURKEY.bounceMultiplier : 1));
  }
}
