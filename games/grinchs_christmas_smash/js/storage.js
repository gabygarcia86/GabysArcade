/*
 * Saved data in localStorage: settings, best score, highest level completed, stars and best
 * score on each level, lifetime totals and unlocked snowball types. Damaged or missing data
 * falls back to the defaults.
 */
(function (G) {
  "use strict";

  const KEY = "grinchSmash.save";
  const LEVELS = 20;
  const TYPES = ["normal", "mega", "bouncy", "explosive", "split", "rainbow"];

  function defaults() {
    return {
      version: 1,
      settings: { music: 0.5, sfx: 0.85, muted: false, fullscreen: true, aimGuide: true },
      bestScore: 0,
      highestLevel: 0, // highest level completed
      levels: {}, // "3": { score, stars }
      totalSmashed: 0,
      totalChains: 0,
      bestCombo: 0,
      goldenSmashed: 0,
      gamesPlayed: 0,
      unlocked: ["normal"],
    };
  }

  function num(value, fallback, lo, hi) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  function clean(raw) {
    const d = defaults();
    if (!raw || typeof raw !== "object") return d;
    const s = raw.settings || {};
    d.settings.music = num(s.music, d.settings.music, 0, 1);
    d.settings.sfx = num(s.sfx, d.settings.sfx, 0, 1);
    d.settings.muted = s.muted === true;
    d.settings.fullscreen = s.fullscreen !== false;
    d.settings.aimGuide = s.aimGuide !== false;
    d.bestScore = Math.floor(num(raw.bestScore, 0, 0, 1e9));
    d.highestLevel = Math.floor(num(raw.highestLevel, 0, 0, LEVELS));
    d.totalSmashed = Math.floor(num(raw.totalSmashed, 0, 0, 1e9));
    d.totalChains = Math.floor(num(raw.totalChains, 0, 0, 1e9));
    d.bestCombo = Math.floor(num(raw.bestCombo, 0, 0, 1e6));
    d.goldenSmashed = Math.floor(num(raw.goldenSmashed, 0, 0, 1e9));
    d.gamesPlayed = Math.floor(num(raw.gamesPlayed, 0, 0, 1e9));
    if (raw.levels && typeof raw.levels === "object") {
      for (let i = 1; i <= LEVELS; i++) {
        const l = raw.levels[i];
        if (l && typeof l === "object") d.levels[i] = { score: Math.floor(num(l.score, 0, 0, 1e8)), stars: Math.floor(num(l.stars, 0, 0, 3)) };
      }
    }
    if (Array.isArray(raw.unlocked)) d.unlocked = TYPES.filter((t) => t === "normal" || raw.unlocked.includes(t));
    return d;
  }

  G.Storage = {
    data: defaults(),
    TYPES,

    load() {
      try {
        const text = localStorage.getItem(KEY);
        this.data = clean(text ? JSON.parse(text) : null);
      } catch (error) {
        this.data = defaults();
      }
      return this.data;
    },

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (error) {
        // Storage is full or blocked; progress just isn't kept.
      }
    },

    isUnlocked(type) {
      return this.data.unlocked.includes(type);
    },

    // Unlocks a snowball type. Returns true if it was new.
    unlock(type) {
      if (this.isUnlocked(type)) return false;
      this.data.unlocked.push(type);
      this.data.unlocked = TYPES.filter((t) => this.data.unlocked.includes(t));
      this.save();
      return true;
    },

    starsTotal() {
      let n = 0;
      for (const k in this.data.levels) n += this.data.levels[k].stars;
      return n;
    },

    threeStarCount() {
      let n = 0;
      for (const k in this.data.levels) if (this.data.levels[k].stars === 3) n++;
      return n;
    },

    // Records a completed level. Returns the snowball types this unlocked.
    recordLevel(level, score, stars) {
      const prev = this.data.levels[level];
      if (!prev || score > prev.score) this.data.levels[level] = { score, stars: Math.max(stars, prev ? prev.stars : 0) };
      else if (stars > prev.stars) prev.stars = stars;
      if (level > this.data.highestLevel) this.data.highestLevel = level;
      const fresh = [];
      for (const type in G.UNLOCKS) if (level >= G.UNLOCKS[type] && this.unlock(type)) fresh.push(type);
      // Special reward: three stars on five levels unlocks the rainbow snowball early.
      if (this.threeStarCount() >= 5 && this.unlock("rainbow")) fresh.push("rainbow");
      this.save();
      return fresh;
    },

    addStats(smashed, chains, combo, golden) {
      this.data.totalSmashed += smashed;
      this.data.totalChains += chains;
      this.data.goldenSmashed += golden;
      if (combo > this.data.bestCombo) this.data.bestCombo = combo;
      this.save();
    },

    recordGame(score) {
      this.data.gamesPlayed += 1;
      const best = score > this.data.bestScore;
      if (best) this.data.bestScore = score;
      this.save();
      return best;
    },

    resetProgress() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings;
      this.save();
    },
  };
})(window.GS);
