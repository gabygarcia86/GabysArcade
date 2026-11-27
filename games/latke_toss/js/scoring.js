// The round's scoring rules: points, the streak, the menorah, dreidel boosts and the Final Fry.
// No browser or Three.js, so the leaderboard's Edge Function scores a round with an exact copy
// of this file (supabase/functions/latke-toss-score/game/). After changing it, copy it there.

import { ROUND, SCORING, GOLDEN, FINAL_FRY, MENORAH, DREIDEL } from './config.js';

export class RoundScore {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.streak = 0; // latkes landed in a row; any miss resets it
    this.streakMultiplier = 1;
    this.candlesLit = 0;
    this.menorahMultiplier = 1; // becomes MENORAH.multiplier once every candle is lit
    this.dreidelBoosts = []; // round time at which each active dreidel boost expires
    this.finalFry = false; // the last FINAL_FRY.seconds of the round
  }

  /** The menorah bonus x every active dreidel boost x the streak bonus x the Final Fry. */
  get multiplier() {
    return this.menorahMultiplier * DREIDEL.bonusMultiplier ** this.dreidelBoosts.length
      * this.streakMultiplier * (this.finalFry ? FINAL_FRY.multiplier : 1);
  }

  /** Drops dreidel boosts that have run out. Returns true if any did. */
  expireBoosts(now) {
    if (this.dreidelBoosts.length === 0 || this.dreidelBoosts[0] > now) return false;
    // Boosts are pushed in hit order, so expired ones are always at the front.
    while (this.dreidelBoosts.length > 0 && this.dreidelBoosts[0] <= now) this.dreidelBoosts.shift();
    return true;
  }

  /** Starts the Final Fry once the clock reaches it. Returns true the moment it starts. */
  checkFinalFry(now) {
    if (this.finalFry || ROUND.durationSeconds - now > FINAL_FRY.seconds) return false;
    this.finalFry = true;
    return true;
  }

  /**
   * A latke landed in the pot. The streak grows first, so a latke that reaches a new tier
   * scores with it. The candle it lights comes after, so the latke that lights the ninth
   * candle scores before the menorah bonus starts.
   */
  landLatke({ golden, clean }) {
    this.streak += 1;
    let tier = 1;
    for (const { count, multiplier } of SCORING.streakTiers) if (this.streak >= count) tier = multiplier;
    const newTier = tier !== this.streakMultiplier;
    this.streakMultiplier = tier;

    const multiplier = this.multiplier;
    const base = (golden ? GOLDEN.points : SCORING.pointsPerLatke) + (clean ? SCORING.cleanBonus : 0);
    const points = Math.round(base * multiplier);
    this.score += points;

    let menorahLit = false;
    if (this.candlesLit < MENORAH.candles) {
      this.candlesLit += 1;
      if (this.candlesLit === MENORAH.candles && this.menorahMultiplier === 1) {
        this.menorahMultiplier = MENORAH.multiplier;
        menorahLit = true;
      }
    }
    return { points, multiplier, newTier, menorahLit };
  }

  /** A miss ends the streak. Returns how long it was, and whether a streak bonus was lost. */
  missLatke() {
    const lost = this.streak;
    const tierLost = this.streakMultiplier !== 1;
    this.streak = 0;
    this.streakMultiplier = 1;
    return { lost, tierLost };
  }

  hitDreidel(now) {
    this.dreidelBoosts.push(now + DREIDEL.bonusSeconds);
  }

  /**
   * Knocking the menorah puts out the most recently lit candle, which ends the menorah bonus
   * until all nine are lit again. Returns whether a candle went out and whether the bonus ended.
   */
  hitMenorah() {
    if (this.candlesLit === 0) return { candleOut: false, bonusLost: false };
    this.candlesLit -= 1;
    const bonusLost = this.menorahMultiplier !== 1;
    this.menorahMultiplier = 1;
    return { candleOut: true, bonusLost };
  }
}
