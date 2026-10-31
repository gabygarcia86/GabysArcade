/*
 * LevelManager tracks where the run is, the level and the cycle, and turns that into the
 * tuning numbers the rest of the game reads. All the difficulty balance lives in this file.
 *
 * Fairness rule: enemies are always slower than the droid. `ENEMY_RATIO_CAP` keeps that
 * true at any cycle, so every level stays beatable however long a run lasts.
 */
(function (D) {
  const DIFFICULTY = {
    cadet: { label: "Cadet", lives: 5, power: 10, ratio: 0.78, aggression: 0.1, reaction: 0.7 },
    normal: { label: "Pilot", lives: 3, power: 8, ratio: 0.82, aggression: 0.2, reaction: 0.55 },
    master: { label: "Jedi Master", lives: 3, power: 6, ratio: 0.9, aggression: 0.5, reaction: 0.3 },
  };

  const PLAYER_SPEED_BASE = 6.8; // Tiles per second.
  const PLAYER_SPEED_CAP = 9.6;
  const ENEMY_RATIO_CAP = 0.97;
  const FRIGHT_RATIO = 0.55;
  const POWER_TIME_MIN = 3;
  const REACTION_MIN = 0.06;
  const RELEASE_MIN = 0.6;

  class LevelManager {
    constructor() {
      this.index = 0;
      this.cycle = 1;
      this.difficulty = "normal";
    }

    start(difficulty) {
      this.index = 0;
      this.cycle = 1;
      this.difficulty = difficulty;
    }

    get level() { return D.LEVELS[this.index]; }
    get number() { return this.index + 1; }
    get lastLevel() { return this.index === D.LEVELS.length - 1; }
    get lives() { return DIFFICULTY[this.difficulty].lives; }

    // Returns true when this step wrapped around into a new cycle.
    advance() {
      this.index++;
      if (this.index < D.LEVELS.length) return false;
      this.index = 0;
      this.cycle++;
      return true;
    }

    tuning() {
      const base = DIFFICULTY[this.difficulty];
      const level = this.index;
      const past = this.cycle - 1;
      const playerSpeed = Math.min(PLAYER_SPEED_CAP, PLAYER_SPEED_BASE + level * 0.05 + past * 0.3);
      const ratio = Math.min(ENEMY_RATIO_CAP, base.ratio + level * 0.008 + past * 0.03);
      return {
        playerSpeed,
        enemySpeed: playerSpeed * ratio,
        frightSpeed: playerSpeed * FRIGHT_RATIO,
        powerTime: Math.max(POWER_TIME_MIN, base.power - level * 0.12 - past * 0.6),
        aggression: D.clamp(base.aggression + level * 0.04 + past * 0.12, 0, 1),
        reaction: Math.max(REACTION_MIN, base.reaction - level * 0.02 - past * 0.06),
        release: Math.max(RELEASE_MIN, 3.5 - level * 0.15 - past * 0.4),
      };
    }
  }

  LevelManager.DIFFICULTY = DIFFICULTY;
  D.LevelManager = LevelManager;
})(window.DROID);
