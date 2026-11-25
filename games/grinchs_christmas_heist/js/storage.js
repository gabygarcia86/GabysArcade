/*
 * Saved data in localStorage: settings, best score, highest level, lifetime loot and the
 * best result on each level. Damaged or missing data falls back to the defaults.
 */
(function (G) {
  "use strict";

  const KEY = "grinchHeist.save";
  const LEVELS = 10;

  function defaults() {
    return {
      version: 1,
      settings: {
        music: 0.55,
        sfx: 0.8,
        muted: false,
        fullscreen: true,
        touch: "auto", // auto | on | off
        hints: true,
      },
      bestScore: 0,
      highestLevel: 0, // highest level completed with a getaway
      totalLoot: 0, // every item ever stolen
      totalPresents: 0,
      gamesPlayed: 0,
      levels: {}, // "3": { score, stars }
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
    d.settings.touch = ["auto", "on", "off"].includes(s.touch) ? s.touch : "auto";
    d.settings.hints = s.hints !== false;
    d.bestScore = Math.floor(num(raw.bestScore, 0, 0, 1e9));
    d.highestLevel = Math.floor(num(raw.highestLevel, 0, 0, LEVELS));
    d.totalLoot = Math.floor(num(raw.totalLoot, 0, 0, 1e9));
    d.totalPresents = Math.floor(num(raw.totalPresents, 0, 0, 1e9));
    d.gamesPlayed = Math.floor(num(raw.gamesPlayed, 0, 0, 1e9));
    if (raw.levels && typeof raw.levels === "object") {
      for (let i = 1; i <= LEVELS; i++) {
        const l = raw.levels[i];
        if (l && typeof l === "object") {
          d.levels[i] = {
            score: Math.floor(num(l.score, 0, 0, 1e8)),
            stars: Math.floor(num(l.stars, 0, 0, 3)),
            loot: Math.floor(num(l.loot, 0, 0, 1e5)),
          };
        }
      }
    }
    return d;
  }

  G.Storage = {
    data: defaults(),

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

    // Records one level's result. Returns true when it beat the previous best.
    recordLevel(level, score, stars, loot, escaped) {
      const prev = this.data.levels[level];
      let better = false;
      if (!prev || score > prev.score) {
        this.data.levels[level] = { score, stars: Math.max(stars, prev ? prev.stars : 0), loot };
        better = true;
      } else if (stars > prev.stars) {
        prev.stars = stars;
      }
      if (escaped && level > this.data.highestLevel) this.data.highestLevel = level;
      this.save();
      return better;
    },

    addLoot(items, presents) {
      this.data.totalLoot += items;
      this.data.totalPresents += presents;
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
})(window.GH);
