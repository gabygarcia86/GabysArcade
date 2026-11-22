/* Loads, validates and saves all progress in localStorage. */
(function (MQ) {
  const KEY = "mandosQuest.save.v1";
  const { clamp } = MQ.U;

  const whole = (value, min, max) => clamp(Math.floor(Number(value) || 0), min, max);
  const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

  function defaults() {
    const n = MQ.DATA.TOTAL_LEVELS;
    return {
      completed: 0,
      xp: 0,
      playerLevel: 1,
      weapon: "blaster",
      weapons: ["blaster"],
      armor: ["classic", "worn"],
      forceUpgrades: [],
      jetpackUpgrades: [],
      pucks: Array.from({ length: n }, () => [false, false, false]),
      best: Array.from({ length: n }, () => ({ time: 0, score: 0, kills: 0 })),
      darksaber: false,
      saberColor: "classic",
      look: null,
      pendingScore: null,
      settings: {
        master: 0.8,
        music: 0.5,
        sfx: 0.8,
        muted: false,
        difficulty: "standard",
        aimAssist: true,
        shake: true,
        hints: true,
        effects: "high",
        touch: "auto",
      },
    };
  }

  // Rebuilds a save from scratch so a damaged or hand-edited one can't break the game.
  function sanitize(raw) {
    const save = defaults();
    if (!raw || typeof raw !== "object") return save;
    const D = MQ.DATA;

    save.completed = whole(raw.completed, 0, D.TOTAL_LEVELS);
    save.xp = whole(raw.xp, 0, 1e7);
    save.weapon = oneOf(raw.weapon, D.WEAPONS.map((w) => w.id), save.weapon);
    save.saberColor = oneOf(raw.saberColor, D.SABERS.map((s) => s.id), save.saberColor);
    save.look = raw.look && typeof raw.look === "object" ? raw.look : null;

    save.pucks.forEach((list, level) => {
      list.forEach((_, i) => (list[i] = raw.pucks?.[level]?.[i] === true));
    });
    save.best.forEach((best, level) => {
      best.time = whole(raw.best?.[level]?.time, 0, 1e6);
      best.score = whole(raw.best?.[level]?.score, 0, 1e5);
      best.kills = whole(raw.best?.[level]?.kills, 0, 1e4);
    });
    const collected = save.pucks.flat().filter(Boolean).length;
    save.darksaber = save.completed === D.TOTAL_LEVELS && collected === D.TOTAL_PUCKS;

    const s = save.settings;
    const from = raw.settings || {};
    for (const key of ["master", "music", "sfx"]) {
      if (Number.isFinite(from[key])) s[key] = clamp(from[key], 0, 1);
    }
    for (const key of ["muted", "aimAssist", "shake", "hints"]) {
      if (typeof from[key] === "boolean") s[key] = from[key];
    }
    s.difficulty = oneOf(from.difficulty, Object.keys(D.DIFFICULTY), s.difficulty);
    s.effects = oneOf(from.effects, ["high", "low"], s.effects);
    s.touch = oneOf(from.touch, ["auto", "on", "off"], s.touch);

    const pending = raw.pendingScore;
    if (pending && Number(pending.score) > 0) {
      save.pendingScore = {
        score: whole(pending.score, 1, 1e6),
        levels: whole(pending.levels, 0, D.TOTAL_LEVELS),
        pucks: whole(pending.pucks, 0, D.TOTAL_PUCKS),
        finished: pending.finished === true,
      };
    }
    return save;
  }

  class SaveManager {
    constructor() {
      this.available = true;
      let raw = null;
      try {
        raw = JSON.parse(localStorage.getItem(KEY));
      } catch (error) {
        // Blocked storage or a corrupt save: start fresh.
      }
      this.data = sanitize(raw);
      this.write(); // Finds out straight away whether storage works.
    }

    write() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        this.available = true;
      } catch (error) {
        this.available = false;
      }
    }

    // Keeps audio and gameplay settings, clears everything else.
    reset() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings;
      this.write();
    }
  }

  MQ.SaveManager = SaveManager;
})(window.MQ);
