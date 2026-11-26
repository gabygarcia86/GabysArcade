/*
 * Progress and settings in localStorage. Missing or damaged data falls back to
 * defaults field by field, so a bad value can never stop the game from loading.
 */
(function (XM) {
  "use strict";
  const KEY = "xmenRiseOfTheMutants.save.v1";
  const LEVEL_COUNT = 20;

  const UPGRADE_KEYS = ["health", "attack", "special", "energy", "recharge", "ultimate", "charge", "speed", "defense", "dodge"];

  function defaultKeys() {
    return {
      left: ["KeyA", "ArrowLeft"],
      right: ["KeyD", "ArrowRight"],
      up: ["KeyW", "ArrowUp"],
      down: ["KeyS", "ArrowDown"],
      jump: ["Space", ""],
      dodge: ["ShiftLeft", "ShiftRight"],
      attack: ["KeyJ", ""],
      special: ["KeyK", ""],
      ultimate: ["KeyL", ""],
      interact: ["KeyE", ""],
      pause: ["Escape", "KeyP"],
      info: ["Tab", ""],
    };
  }

  function defaultChar(id, unlocked) {
    const upgrades = {};
    UPGRADE_KEYS.forEach((k) => (upgrades[k] = 0));
    return { unlocked, level: 1, xp: 0, points: 0, upgrades, outfit: 0, outfits: [0], played: 0, newOutfits: [] };
  }

  function defaults() {
    const chars = {};
    (XM.CHARS || []).forEach((c) => (chars[c.id] = defaultChar(c.id, !c.joinsAfter)));
    const levels = [];
    for (let i = 0; i < LEVEL_COUNT; i++) {
      levels.push({ cleared: false, best: 0, stars: 0, x: [false, false, false], orbs: 0, orbsTotal: 0, secrets: 0, secretsTotal: 0, bestTime: 0, rare: false });
    }
    return {
      v: 1,
      campaign: { unlocked: 1, started: false, finished: false, introSeen: false },
      levels,
      chars,
      selected: "cyclops",
      stats: {
        kills: 0,
        sentinelKills: 0,
        bosses: [],
        orbs: 0,
        maxCombo: 0,
        noDamageClears: 0,
        fastClears: 0,
        ultMultiKill: 0,
        deaths: 0,
        played: [],
        playTime: 0,
      },
      achievements: {},
      art: [],
      seen: { enemies: [], bosses: [] },
      pendingScore: null,
      settings: {
        master: 0.8,
        music: 0.55,
        sfx: 0.8,
        shake: true,
        quality: "high",
        pauseOnBlur: true,
        showFps: false,
        keys: defaultKeys(),
        touch: { size: 1, opacity: 0.6, layout: {}, forceShow: false },
      },
    };
  }

  // Copies values from saved into a fresh default, keeping only fields of the right type.
  function merge(base, saved) {
    if (saved === null || saved === undefined) return base;
    if (Array.isArray(base)) {
      if (!Array.isArray(saved)) return base;
      // Arrays of objects keep their default length (levels); others take the saved list.
      if (base.length && typeof base[0] === "object" && base[0] !== null && !Array.isArray(base[0])) {
        return base.map((item, i) => merge(item, saved[i]));
      }
      if (base.length && typeof base[0] === "boolean") return base.map((item, i) => (typeof saved[i] === "boolean" ? saved[i] : item));
      return saved.filter((v) => typeof v !== "object" || v === null);
    }
    if (typeof base === "object" && base !== null) {
      if (typeof saved !== "object" || Array.isArray(saved)) return base;
      const out = {};
      for (const key of Object.keys(base)) out[key] = merge(base[key], saved[key]);
      // Open-ended maps (achievements, touch layout, pending score) keep extra keys.
      if (Object.keys(base).length === 0) for (const key of Object.keys(saved)) out[key] = saved[key];
      return out;
    }
    if (base === null) return saved;
    if (typeof base === typeof saved && !(typeof saved === "number" && !Number.isFinite(saved))) return saved;
    return base;
  }

  const Save = {
    KEY,
    UPGRADE_KEYS,
    LEVEL_COUNT,
    data: null,
    defaultKeys,
    load() {
      let parsed = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) parsed = JSON.parse(raw);
      } catch (error) {
        console.warn("Save data could not be read, starting fresh.", error);
      }
      this.data = merge(defaults(), parsed);
      this.sanitize();
      return this.data;
    },
    sanitize() {
      const d = this.data;
      d.campaign.unlocked = XM.U.clamp(Math.floor(d.campaign.unlocked) || 1, 1, LEVEL_COUNT);
      for (const c of XM.CHARS || []) {
        const s = d.chars[c.id];
        s.level = XM.U.clamp(Math.floor(s.level) || 1, 1, 30);
        s.xp = Math.max(0, Math.floor(s.xp) || 0);
        s.points = Math.max(0, Math.floor(s.points) || 0);
        s.outfits = Array.from(new Set(s.outfits.filter((n) => Number.isInteger(n) && n >= 0 && n < 10).concat([0])));
        if (!s.outfits.includes(s.outfit)) s.outfit = 0;
        for (const k of UPGRADE_KEYS) s.upgrades[k] = XM.U.clamp(Math.floor(s.upgrades[k]) || 0, 0, 5);
        s.newOutfits = s.newOutfits.filter((n) => Number.isInteger(n));
      }
      if (!d.chars[d.selected] || !d.chars[d.selected].unlocked) d.selected = "cyclops";
      const k = d.settings.keys;
      const def = defaultKeys();
      for (const action of Object.keys(def)) {
        if (!Array.isArray(k[action]) || k[action].length !== 2) k[action] = def[action];
        k[action] = k[action].map((code) => (typeof code === "string" ? code : ""));
      }
      if (!["low", "medium", "high"].includes(d.settings.quality)) d.settings.quality = "high";
      for (const v of ["master", "music", "sfx"]) d.settings[v] = XM.U.clamp(Number(d.settings[v]) || 0, 0, 1);
      d.settings.touch.size = XM.U.clamp(Number(d.settings.touch.size) || 1, 0.7, 1.4);
      d.settings.touch.opacity = XM.U.clamp(Number(d.settings.touch.opacity) || 0.6, 0.25, 1);
    },
    write() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        return true;
      } catch (error) {
        console.warn("Progress could not be saved.", error);
        return false;
      }
    },
    // Erases progress. Settings are kept so controls and volume survive a reset.
    reset() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings;
      this.write();
    },
    char(id) {
      return this.data.chars[id];
    },
  };

  XM.Save = Save;
})(window.XM);
