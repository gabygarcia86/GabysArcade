/* Turns saved progress into unlocks and stats, and awards XP and score. */
(function (MQ) {
  const D = MQ.DATA;
  const MAX_PLAYER_LEVEL = 20;
  const SCORE_CAP_PER_LEVEL = 90000;

  const playerLevelFor = (xp) => Math.min(MAX_PLAYER_LEVEL, 1 + Math.floor(Math.sqrt(xp / 300)));

  class ProgressionManager {
    constructor(saveManager) {
      this.saveManager = saveManager;
      this.refresh();
    }

    get save() {
      return this.saveManager.data;
    }

    // Recomputes everything derived from how far the player has got.
    refresh() {
      const save = this.save;
      const done = save.completed;
      const level = playerLevelFor(save.xp);
      save.playerLevel = level;
      save.darksaber = save.darksaber || (done >= D.TOTAL_LEVELS && this.totalPucks() >= D.TOTAL_PUCKS);
      save.weapons = D.WEAPONS.filter((w) => this.hasWeapon(w.id)).map((w) => w.id);
      save.armor = D.SETS.filter((s) => done >= s.after).map((s) => s.id);
      save.forceUpgrades = D.FORCE_UPGRADES.filter((u) => done >= u.after).map((u) => u.name);
      save.jetpackUpgrades = D.JETPACK_UPGRADES.filter((u) => done >= u.after).map((u) => u.name);
      if (!save.weapons.includes(save.weapon)) save.weapon = "blaster";

      this.stats = {
        level,
        maxHp: 100 + (done >= 2 ? 25 : 0) + (done >= 4 ? 25 : 0) + (level - 1) * 4,
        damage: (1 + (level - 1) * 0.015) * (done >= 8 ? 1.15 : 1) * (done >= 10 ? 1.15 : 1),
        armor: done >= 8 ? 0.85 : 1,
        ammo: done >= 10 ? 1.5 : 1,
        fastBlaster: done >= 3,
        twinBlaster: done >= 9,
        jetpack: D.JETPACK_UPGRADES.filter((u) => done >= u.after).pop() || null,
        force: done >= 1 ? {
          strength: done >= 3 ? 1.6 : done >= 2 ? 1.3 : 1,
          range: done >= 6 ? 330 : done >= 5 ? 285 : 220,
          heavy: done >= 7,
          burst: done >= 9,
        } : null,
      };
    }

    hasWeapon(id) {
      const weapon = D.weapon(id);
      return weapon.secret ? this.save.darksaber : this.save.completed >= weapon.after;
    }

    isUnlocked(levelId) {
      return levelId <= Math.min(D.TOTAL_LEVELS, this.save.completed + 1);
    }

    nextLevel() {
      return this.save.completed >= D.TOTAL_LEVELS ? 1 : this.save.completed + 1;
    }

    levelPucks(levelId) {
      return this.save.pucks[levelId - 1].filter(Boolean).length;
    }

    totalPucks() {
      return this.save.pucks.flat().filter(Boolean).length;
    }

    percent() {
      const levels = this.save.completed / D.TOTAL_LEVELS;
      const pucks = this.totalPucks() / D.TOTAL_PUCKS;
      return Math.floor(levels * 70 + pucks * 30);
    }

    // Returns true when this puck completes the Darksaber requirement.
    collectPuck(levelId, index) {
      const hadSaber = this.save.darksaber;
      this.save.pucks[levelId - 1][index] = true;
      this.refresh();
      this.saveManager.write();
      return !hadSaber && this.save.darksaber;
    }

    /*
     * The campaign score is the best score from each level, plus Bounty Pucks. A game
     * over also counts the points from the run that just ended, if they beat that best.
     */
    campaignScore(levelId = 0, runScore = 0) {
      let total = this.totalPucks() * D.PUCK_POINTS;
      this.save.best.forEach((best, i) => {
        total += i === levelId - 1 ? Math.max(best.score, runScore) : best.score;
      });
      return total;
    }

    leaderboardEntry(levelId, runScore, finished) {
      return {
        score: this.campaignScore(levelId, runScore),
        levels: this.save.completed,
        pucks: this.totalPucks(),
        finished,
      };
    }

    completeLevel(level, run) {
      const save = this.save;
      const first = level.id > save.completed;
      const oldPlayerLevel = this.stats.level;
      const oldHp = this.stats.maxHp;
      const hadSaber = save.darksaber;

      const timeBonus = Math.round(Math.max(0, level.par - run.time) * 15);
      const bonus = 2000 + level.id * 500 + timeBonus + run.lives * 500;
      const score = Math.min(SCORE_CAP_PER_LEVEL, Math.round((run.points + bonus) * run.multiplier));

      const baseXp = first ? 500 * level.id + 300 : 150 * level.id + 100;
      const xp = baseXp + run.kills * 10;

      const best = save.best[level.id - 1];
      const newBestTime = !best.time || run.time < best.time;
      if (newBestTime) best.time = Math.ceil(run.time);
      best.score = Math.max(best.score, score);
      best.kills = Math.max(best.kills, run.kills);

      save.xp += xp;
      if (first) save.completed = level.id;
      this.refresh();

      if (level.id === D.TOTAL_LEVELS) {
        save.pendingScore = this.leaderboardEntry(0, 0, true);
      }
      this.saveManager.write();

      return {
        level, first, score, xp, newBestTime,
        time: run.time,
        kills: run.kills,
        pucks: this.levelPucks(level.id),
        oldPlayerLevel,
        playerLevel: this.stats.level,
        hpGain: this.stats.maxHp - oldHp,
        rewards: first ? D.REWARDS[level.id - 1] : [],
        saberUnlocked: !hadSaber && save.darksaber,
      };
    }
  }

  MQ.ProgressionManager = ProgressionManager;
})(window.MQ);
