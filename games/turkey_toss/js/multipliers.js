import { BOWLS, TABLE_COMPLETE, GIANT_TURKEY } from './config.js';

// Largest whole number JavaScript and the leaderboard both store exactly.
export const MAX_VALUE = Number.MAX_SAFE_INTEGER;

/**
 * The round's permanent multipliers. They only ever grow and combine by multiplying, so two
 * cranberry hits and a gravy hit give 2 x 2 x 3 = 12x. The giant turkey's 10x isn't here:
 * it belongs to one landing, not the round, so scoring.js adds it per landing.
 */
export class Multipliers {
  constructor() {
    this.reset();
  }

  reset() {
    this.cranberryHits = 0;
    this.gravyHits = 0;
    this.tableComplete = false;
  }

  addBowlHit(kind) {
    if (kind === 'cranberry') this.cranberryHits += 1;
    else if (kind === 'gravy') this.gravyHits += 1;
    else throw new Error(`Unknown bowl: ${kind}`);
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

  /** The combined permanent multiplier, capped so it stays an exact whole number. */
  get total() {
    return Math.min(MAX_VALUE, this.cranberryFactor * this.gravyFactor * this.tableFactor);
  }

  /** The total for one landing, including the bounce bonus if it earned one. */
  totalFor({ bounced = false } = {}) {
    return Math.min(MAX_VALUE, this.total * (bounced ? GIANT_TURKEY.bounceMultiplier : 1));
  }
}
