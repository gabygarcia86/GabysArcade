import { BOWLS, TABLE_COMPLETE, GIANT_TURKEY, CORNUCOPIA } from './config.js';

// Largest whole number JavaScript and the leaderboard both store exactly.
export const MAX_VALUE = Number.MAX_SAFE_INTEGER;

/**
 * The round's multipliers, which combine by multiplying, so two cranberry hits and a gravy
 * hit give 2 x 2 x 3 = 12x. Those and the table bonus are permanent. Cornucopia boosts run
 * on a timer. The giant turkey's 10x isn't here: it belongs to one landing, not the round,
 * so scoring.js adds it per landing.
 */
export class Multipliers {
  constructor() {
    this.reset();
  }

  reset() {
    this.cranberryHits = 0;
    this.gravyHits = 0;
    this.tableComplete = false;
    this.cornucopiaHits = 0;
    this.boosts = []; // round time each cornucopia boost ends, soonest first
  }

  addBowlHit(kind) {
    if (kind === 'cranberry') this.cranberryHits += 1;
    else if (kind === 'gravy') this.gravyHits += 1;
    else throw new Error(`Unknown bowl: ${kind}`);
  }

  addCornucopiaHit(now) {
    this.cornucopiaHits += 1;
    this.boosts.push(now + CORNUCOPIA.seconds);
  }

  /** Drops boosts that have run out. Returns true if any did. */
  expireBoosts(now) {
    const before = this.boosts.length;
    while (this.boosts.length > 0 && this.boosts[0] <= now) this.boosts.shift();
    return this.boosts.length !== before;
  }

  /** Seconds until the last running boost ends, or 0 if none is running. */
  boostSecondsLeft(now) {
    return this.boosts.length > 0 ? Math.max(0, this.boosts[this.boosts.length - 1] - now) : 0;
  }

  /** Returns true the first time, so the announcement only plays once. */
  completeTable() {
    if (this.tableComplete) return false;
    this.tableComplete = true;
    return true;
  }

  get cranberryFactor() {
    return BOWLS.cranberry.multiplier ** this.cranberryHits;
  }

  get gravyFactor() {
    return BOWLS.gravy.multiplier ** this.gravyHits;
  }

  get tableFactor() {
    return this.tableComplete ? TABLE_COMPLETE.multiplier : 1;
  }

  get cornucopiaFactor() {
    return CORNUCOPIA.multiplier ** this.boosts.length;
  }

  /** The combined multiplier right now, capped so it stays an exact whole number. */
  get total() {
    return Math.min(MAX_VALUE, this.cranberryFactor * this.gravyFactor * this.tableFactor * this.cornucopiaFactor);
  }

  /** The total for one landing, including the bounce bonus if it earned one. */
  totalFor({ bounced = false } = {}) {
    return Math.min(MAX_VALUE, this.total * (bounced ? GIANT_TURKEY.bounceMultiplier : 1));
  }
}
