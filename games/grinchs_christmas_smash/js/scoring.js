/*
 * Points, combos and bonuses for one level.
 *
 * A "chain" is every smash that happens within CHAIN_GAP seconds of the previous one. The
 * longer the chain, the bigger the multiplier on each smash (1x, 2x at 5, 3x at 10 and 5x
 * at 20), and a chain of 5 or more pays a chain bonus when it ends.
 */
(function (G) {
  "use strict";

  const CHAIN_GAP = 1.3;
  const MESSAGES = [
    [3, "SMASHING!"],
    [5, "CHRISTMAS CHAOS!"],
    [8, "HO HO OH NO!"],
    [10, "DECORATION DISASTER!"],
    [15, "MEGA SMASH!"],
    [20, "TOTAL CHRISTMAS MELTDOWN!"],
    [30, "THE GRINCHIEST SMASH EVER!"],
  ];

  G.multiplierFor = (n) => (n >= 20 ? 5 : n >= 10 ? 3 : n >= 5 ? 2 : 1);

  class Scoring {
    constructor() {
      this.onCombo = null; // (message, count, multiplier)
      this.onChainEnd = null; // (count, bonus)
      this.reset(0, 0);
    }

    reset(totalPoints, totalCount) {
      this.score = 0;
      this.totalPoints = totalPoints; // base points of everything in the level
      this.totalCount = totalCount; // pieces counted for the destruction %
      this.smashed = 0; // every smash, including event bonus objects
      this.counted = 0; // smashes that count towards the destruction %
      this.chain = 0;
      this.chainT = 0;
      this.bestChain = 0;
      this.chains = 0; // chain reactions (3 or more) this level
      this.golden = 0;
      this.msgIndex = 0;
      this.bonuses = [];
    }

    get multiplier() {
      return G.multiplierFor(this.chain);
    }

    get percent() {
      return this.totalCount ? Math.round((this.counted / this.totalCount) * 100) : 0;
    }

    // Scores one smashed object. Returns the points awarded.
    smash(points, counted) {
      this.chain += 1;
      this.chainT = CHAIN_GAP;
      this.smashed += 1;
      if (counted) this.counted += 1;
      if (this.chain > this.bestChain) this.bestChain = this.chain;
      const mult = this.multiplier;
      const pts = Math.round(points * mult);
      this.score += pts;
      // Announce each new milestone once per chain.
      while (this.msgIndex < MESSAGES.length && this.chain >= MESSAGES[this.msgIndex][0]) {
        const [n, text] = MESSAGES[this.msgIndex];
        this.msgIndex++;
        if (this.onCombo) this.onCombo(text, n, mult);
      }
      return pts;
    }

    // A flat bonus (not multiplied).
    add(points) {
      this.score += Math.round(points);
    }

    update(dt) {
      if (this.chain <= 0) return;
      this.chainT -= dt;
      if (this.chainT <= 0) this.endChain();
    }

    endChain() {
      const n = this.chain;
      this.chain = 0;
      this.msgIndex = 0;
      if (n >= 3) this.chains += 1;
      if (n >= 5) {
        const bonus = n * n * 10;
        this.score += bonus;
        if (this.onChainEnd) this.onChainEnd(n, bonus);
      }
    }

    get chainActive() {
      return this.chain > 0;
    }
  }

  G.Scoring = Scoring;
})(window.GS);
