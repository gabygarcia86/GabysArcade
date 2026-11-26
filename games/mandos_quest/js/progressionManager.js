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
      const ship = this.shipStats();
      save.shipUpgrades = [...ship.upgrades];
      save.relics = D.RELICS.filter((relic) => save.cleared[relic.after - 1]).map((relic) => relic.id);
      if (!save.weapons.includes(save.weapon)) save.weapon = "blaster";

      this.stats = {
        level,
        maxHp: 100 + (done >= 2 ? 25 : 0) + (done >= 5 ? 25 : 0) + (level - 1) * 4,
        damage: (1 + (level - 1) * 0.015) * (done >= 10 ? 1.15 : 1) * (done >= 13 ? 1.15 : 1),
        armor: done >= 10 ? 0.85 : 1,
        ammo: done >= 13 ? 1.5 : 1,
        fastBlaster: done >= 3,
        twinBlaster: done >= 11,
        ship,
        jetpack: D.JETPACK_UPGRADES.filter((u) => done >= u.after).pop() || null,
        force: done >= 1 ? {
          strength: done >= 3 ? 1.6 : done >= 2 ? 1.3 : 1,
          range: done >= 7 ? 330 : done >= 6 ? 285 : 220,
          heavy: done >= 9,
          burst: done >= 11,
        } : null,
      };
    }

    // The gunship only improves by flying its missions.
    shipStats() {
      const R = D.SHIP_REWARDS;
      const S = MQ.SPACE;
      const has = (id) => this.save.cleared[id - 1];
      const upgrades = [];
      if (has(R.spreadShot)) upgrades.push("spread");
      if (has(R.laser)) upgrades.push("laser");
      return {
        upgrades,
        maxHp: R.hull.reduce((total, [id, amount]) => total + (has(id) ? amount : 0), S.SHIP.maxHp),
        speed: S.SHIP.speed + (has(R.engines[0]) ? R.engines[1] : 0),
        shield: has(R.improvedShield) ? S.ENERGY_SHIELD.improved : S.ENERGY_SHIELD.absorb,
        vanguard: has(R.vanguard),
      };
    }

    hasWeapon(id) {
      const weapon = D.weapon(id);
      return weapon.secret ? this.save.darksaber : this.save.completed >= weapon.after;
    }

    // Pucks count, as they're kept from levels that weren't finished.
    get started() {
      return this.save.completed > 0 || this.totalPucks() > 0;
    }

    isUnlocked(levelId) {
      return levelId <= Math.min(D.TOTAL_LEVELS, Math.max(this.save.completed + 1, this.save.opened));
    }

    get clearedCount() {
      return this.save.cleared.filter(Boolean).length;
    }

    get groundCleared() {
      return D.GROUND_STAGES.filter((id) => this.save.cleared[id - 1]).length;
    }

    get allCleared() {
      return this.clearedCount === D.TOTAL_LEVELS;
    }

    // The first stage not yet cleared, or the beginning again once all are.
    nextLevel() {
      return this.save.cleared.indexOf(false) + 1 || 1;
    }

    levelPucks(levelId) {
      return this.save.pucks[levelId - 1].filter(Boolean).length;
    }

    totalPucks() {
      return this.save.pucks.flat().filter(Boolean).length;
    }

    percent() {
      const levels = this.clearedCount / D.TOTAL_LEVELS;
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
      /*
       * The online table counts the ten worlds, not all 13 stages, and rejects scores over
       * a limit based on them. Space stages add score, so it's held to that limit.
       */
      const levels = this.groundCleared;
      const pucks = this.totalPucks();
      const limit = SCORE_CAP_PER_LEVEL * Math.min(levels + 1, D.TOTAL_GROUND) + D.PUCK_POINTS * pucks;
      return {
        score: Math.min(limit, this.campaignScore(levelId, runScore)),
        levels,
        pucks,
        finished: finished && levels === D.TOTAL_GROUND,
      };
    }

    completeLevel(level, run) {
      const save = this.save;
      const first = !save.cleared[level.id - 1];
      // Ground levels earn by their place among the ten, so the space stages don't inflate them.
      const rank = level.ground ?? level.tier * 2;
      const oldPlayerLevel = this.stats.level;
      const oldHp = this.stats.maxHp;
      const hadSaber = save.darksaber;

      const timeBonus = Math.round(Math.max(0, level.par - run.time) * 15);
      const bonus = 2000 + rank * 500 + timeBonus + run.lives * 500;
      const score = Math.min(SCORE_CAP_PER_LEVEL, Math.round((run.points + bonus) * run.multiplier));

      const baseXp = first ? 500 * rank + 300 : 150 * rank + 100;
      const xp = baseXp + run.kills * 10;

      const best = save.best[level.id - 1];
      const newBestTime = !best.time || run.time < best.time;
      if (newBestTime) best.time = Math.ceil(run.time);
      best.score = Math.max(best.score, score);
      best.kills = Math.max(best.kills, run.kills);

      save.xp += xp;
      save.cleared[level.id - 1] = true;
      save.completed = Math.max(save.completed, level.id);
      this.refresh();

      // Also the end for an older save that had only space missions left.
      const finale = level.id === D.TOTAL_LEVELS || (first && this.allCleared);
      if (finale) {
        save.pendingScore = this.leaderboardEntry(0, 0, true);
      }
      this.saveManager.write();

      return {
        level, first, finale, score, xp, newBestTime,
        lives: run.lives,
        capsules: run.capsules,
        upgrades: run.upgrades,
        credits: run.credits || 0,
        creditTotal: run.creditTotal || 0,
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
