/*
 * Score, combo multiplier and bonuses.
 *
 * Each abduction within COMBO_WINDOW seconds of the last one adds to the combo.
 * The multiplier goes up by one every four in a row, to a maximum of x5.
 * Taking damage, or waiting too long, resets it.
 * Streak bonuses: 5 in a row +500, 10 in a row +1,500, then +3,000 at 20, 30, 40...
 */
(function (U) {
  "use strict";

  const COMBO_WINDOW = 4;
  const MAX_MULT = 5;

  const BONUS = {
    noDamage: 2500,
    twentyAbductions: 2000,
    levelClearPer: 1000,
    reunion: 10000,
  };

  class Scoring {
    constructor() {
      this.reset();
    }

    reset() {
      this.score = 0;
      this.abductions = 0;
      this.rescues = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.comboTimer = 0;
      this.startStage();
    }

    startStage() {
      this.stageScore = 0;
      this.stageAbductions = 0;
      this.stageRescues = 0;
      this.stageDamage = 0;
    }

    multiplier() {
      return Math.min(MAX_MULT, 1 + Math.floor(this.combo / 4));
    }

    // Returns what was earned, and any streak bonus reached.
    abduct(base, doubled) {
      this.combo++;
      this.comboTimer = COMBO_WINDOW;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = this.multiplier();
      const gained = base * mult * (doubled ? 2 : 1);
      this.add(gained);
      this.abductions++;
      this.stageAbductions++;
      let streak = 0;
      let label = "";
      if (this.combo === 5) {
        streak = 500;
        label = "5 IN A ROW!";
      } else if (this.combo === 10) {
        streak = 1500;
        label = "10 IN A ROW!";
      } else if (this.combo >= 20 && this.combo % 10 === 0) {
        streak = 3000;
        label = `${this.combo} IN A ROW! UNSTOPPABLE!`;
      }
      if (streak) this.add(streak);
      // The multiplier steps up at 4, 8, 12 and 16 in a row.
      const multUp = this.combo % 4 === 0 && this.combo <= (MAX_MULT - 1) * 4;
      return { gained, mult, streak, label, multUp };
    }

    // Rescues keep the combo alive but aren't multiplied.
    rescue(points) {
      this.comboTimer = COMBO_WINDOW;
      this.rescues++;
      this.stageRescues++;
      this.add(points);
    }

    addBonus(points) {
      this.add(points);
      return points;
    }

    add(points) {
      this.score += points;
      this.stageScore += points;
    }

    breakCombo() {
      this.combo = 0;
      this.comboTimer = 0;
    }

    tookDamage() {
      this.stageDamage++;
      this.breakCombo();
    }

    update(dt) {
      if (this.combo > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.breakCombo();
      }
    }

    // The bonuses earned at the end of a classic level.
    levelBonuses(levelNumber) {
      const list = [{ label: `Level ${levelNumber} clear`, points: BONUS.levelClearPer * levelNumber }];
      if (this.stageDamage === 0) list.push({ label: "No damage taken", points: BONUS.noDamage });
      if (this.stageAbductions >= 20) list.push({ label: "20+ abductions", points: BONUS.twentyAbductions });
      return list;
    }
  }

  U.Scoring = Scoring;
  U.COMBO_WINDOW = COMBO_WINDOW;
  U.BONUS = BONUS;
})(window.UFO);
