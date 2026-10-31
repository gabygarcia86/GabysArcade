/* ScoreManager keeps the score, lives and high-score table. */
(function (D) {
  const POINTS = {
    gear: 10,
    power: 50,
    level: 1000,
    galaxy: 5000,
  };
  const FIRST_DEFEAT = 200;
  const TABLE_SIZE = 5;

  class ScoreManager {
    constructor(save) {
      this.save = save;
      this.score = 0;
      this.lives = 0;
      this.chain = 0; // Enemies defeated on the current power-up.
      this.newHigh = false;
    }

    start(lives) {
      this.score = 0;
      this.lives = lives;
      this.chain = 0;
      this.newHigh = false;
    }

    get high() { return Math.max(this.save.data.highScore, this.score); }

    add(points) {
      this.score += points;
    }

    // 200, 400, 800, 1600. A fresh power-up restarts the chain.
    defeatBonus() {
      const points = FIRST_DEFEAT * Math.pow(2, Math.min(this.chain, 3));
      this.chain++;
      this.add(points);
      return points;
    }

    // Files the finished run. Returns its place in the table, or -1 if it didn't make it.
    record(droid, level, cycle) {
      const { data } = this.save;
      this.newHigh = this.score > data.highScore;
      if (this.newHigh) data.highScore = this.score;
      let place = -1;
      if (this.score > 0) {
        const entry = { score: this.score, droid, level, cycle };
        data.scores.push(entry);
        data.scores.sort((a, b) => b.score - a.score);
        data.scores.length = Math.min(data.scores.length, TABLE_SIZE);
        place = data.scores.indexOf(entry);
      }
      this.save.save();
      return place;
    }
  }

  ScoreManager.POINTS = POINTS;
  D.ScoreManager = ScoreManager;
})(window.DROID);
