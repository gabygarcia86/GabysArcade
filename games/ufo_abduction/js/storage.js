/*
 * Saved data: settings, local high scores, the family album and lifetime totals.
 * Everything lives in one LocalStorage entry. Missing, old or damaged data is replaced
 * field by field with defaults, so a bad value never stops the game from starting.
 */
(function (U) {
  "use strict";

  const KEY = "ufoAbduction.save";
  const VERSION = 1;
  const HIGH_SCORES_KEPT = 5;
  const FAMILY_IDS = ["mom", "dad", "baby", "grandma", "grandpa", "bestie", "cousin"];

  function defaults() {
    return {
      version: VERSION,
      settings: {
        master: 0.8,
        music: 0.55,
        sfx: 0.8,
        muted: false,
        beamMode: "hold", // "hold" or "toggle"
        stick: "floating", // "floating" or "fixed"
        touch: "auto", // "auto", "on" or "off"
        leftHanded: false,
        shake: true,
      },
      high: { classic: [], endless: [] },
      album: {}, // id -> number of times rescued
      reunions: 0,
      totals: { abductions: 0, rescues: 0, games: 0 },
    };
  }

  const num = (value, fallback, min, max) =>
    typeof value === "number" && Number.isFinite(value) ? U.clamp(value, min, max) : fallback;
  const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);
  const bool = (value, fallback) => (typeof value === "boolean" ? value : fallback);

  function cleanScores(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((row) => row && typeof row.score === "number" && Number.isFinite(row.score) && row.score > 0)
      .map((row) => ({
        score: Math.floor(row.score),
        level: num(row.level, 1, 1, 9999),
        rescues: num(row.rescues, 0, 0, 99999),
        abductions: num(row.abductions, 0, 0, 999999),
        seconds: num(row.seconds, 0, 0, 999999),
        date: typeof row.date === "string" ? row.date.slice(0, 10) : "",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, HIGH_SCORES_KEPT);
  }

  function clean(raw) {
    const base = defaults();
    if (!raw || typeof raw !== "object") return base;
    const s = raw.settings || {};
    base.settings = {
      master: num(s.master, base.settings.master, 0, 1),
      music: num(s.music, base.settings.music, 0, 1),
      sfx: num(s.sfx, base.settings.sfx, 0, 1),
      muted: bool(s.muted, false),
      beamMode: oneOf(s.beamMode, ["hold", "toggle"], "hold"),
      stick: oneOf(s.stick, ["floating", "fixed"], "floating"),
      touch: oneOf(s.touch, ["auto", "on", "off"], "auto"),
      leftHanded: bool(s.leftHanded, false),
      shake: bool(s.shake, true),
    };
    const high = raw.high || {};
    base.high = { classic: cleanScores(high.classic), endless: cleanScores(high.endless) };
    const album = raw.album || {};
    for (const id of FAMILY_IDS) {
      const count = num(album[id], 0, 0, 1e6);
      if (count > 0) base.album[id] = Math.floor(count);
    }
    base.reunions = Math.floor(num(raw.reunions, 0, 0, 1e6));
    const totals = raw.totals || {};
    base.totals = {
      abductions: Math.floor(num(totals.abductions, 0, 0, 1e9)),
      rescues: Math.floor(num(totals.rescues, 0, 0, 1e9)),
      games: Math.floor(num(totals.games, 0, 0, 1e9)),
    };
    return base;
  }

  U.Storage = {
    data: defaults(),
    available: true,
    saveTimer: 0,

    load() {
      try {
        const text = localStorage.getItem(KEY);
        this.data = clean(text ? JSON.parse(text) : null);
      } catch (error) {
        // Blocked storage or damaged JSON: start fresh, and keep playing without saving if needed.
        this.data = defaults();
        try {
          localStorage.getItem("probe");
        } catch (blocked) {
          this.available = false;
        }
      }
      return this.data;
    },

    save() {
      if (!this.available) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (error) {
        // Full or blocked storage. The game carries on; progress just isn't kept.
      }
    },

    // Settings change in bursts (dragging a slider), so they're written a moment later.
    saveSoon() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.save(), 250);
    },

    best(mode) {
      const list = this.data.high[mode] || [];
      return list.length ? list[0].score : 0;
    },

    // Returns true when the score beats the previous best for that mode.
    addHighScore(mode, entry) {
      if (!this.data.high[mode] || entry.score <= 0) return false;
      const previousBest = this.best(mode);
      this.data.high[mode] = cleanScores([
        ...this.data.high[mode],
        { ...entry, date: new Date().toISOString().slice(0, 10) },
      ]);
      this.save();
      return entry.score > previousBest;
    },

    rescue(id) {
      this.data.album[id] = (this.data.album[id] || 0) + 1;
      this.data.totals.rescues += 1;
    },

    isUnlocked(id) {
      return (this.data.album[id] || 0) > 0;
    },

    resetProgress() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings;
      this.save();
    },
  };

  U.FAMILY_IDS = FAMILY_IDS;
})(window.UFO);
