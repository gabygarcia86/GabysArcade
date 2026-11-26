/* Loads, validates and saves all progress in localStorage. */
(function (MQ) {
  const KEY = "mandosQuest.save.v2";
  // Saves from the ten-level campaign. Read once, then left alone as a backup.
  const TEN_LEVEL_KEY = "mandosQuest.save.v1";
  const { clamp } = MQ.U;

  const whole = (value, min, max) => clamp(Math.floor(Number(value) || 0), min, max);
  const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

  function defaults() {
    const n = MQ.DATA.TOTAL_LEVELS;
    return {
      completed: 0, // The furthest level cleared, which is what unlocks go by.
      cleared: Array.from({ length: n }, () => false),
      opened: 1, // Levels up to this one stay open, for saves from the ten-level campaign.
      shipUpgrades: [],
      relics: [],
      xp: 0,
      playerLevel: 1,
      weapon: "blaster",
      weapons: ["blaster"],
      armor: ["classic", "worn"],
      forceUpgrades: [],
      jetpackUpgrades: [],
      // Pucks are only on the ground.
      pucks: Array.from({ length: n }, (_, i) => (MQ.DATA.SPACE_STAGES.includes(i + 1) ? [] : [false, false, false])),
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
        touchSize: "normal",
        touchLayout: {}, // Control id: [x, y] offset as a share of the screen.
      },
    };
  }

  /*
   * Moves a ten-level save into the 13-stage campaign. Everything earned and every open
   * level is kept, and the space missions start out unplayed.
   */
  function fromTenLevels(raw) {
    if (!raw || typeof raw !== "object") return null;
    const { GROUND_STAGES, TOTAL_LEVELS } = MQ.DATA;
    const done = whole(raw.completed, 0, GROUND_STAGES.length);
    const cleared = Array.from({ length: TOTAL_LEVELS }, () => false);
    const pucks = [];
    const best = [];
    GROUND_STAGES.forEach((id, i) => {
      cleared[id - 1] = i < done;
      pucks[id - 1] = raw.pucks?.[i];
      best[id - 1] = raw.best?.[i];
    });
    return { ...raw, cleared, pucks, best, opened: GROUND_STAGES[Math.min(done, GROUND_STAGES.length - 1)] };
  }

  // Rebuilds a save from scratch so a damaged or hand-edited one can't break the game.
  function sanitize(raw) {
    const save = defaults();
    if (!raw || typeof raw !== "object") return save;
    const D = MQ.DATA;

    save.cleared.forEach((_, i) => (save.cleared[i] = raw.cleared?.[i] === true));
    save.completed = save.cleared.lastIndexOf(true) + 1;
    save.opened = whole(raw.opened, 1, D.TOTAL_LEVELS);
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
    s.touchSize = oneOf(from.touchSize, ["normal", "large", "huge"], s.touchSize);
    const layout = from.touchLayout;
    if (layout && typeof layout === "object") {
      for (const id of ["move", "weapon", "force", "fire", "jump", "stick", "upgrade", "shield", "rockets", "spaceFire"]) {
        const at = layout[id];
        if (Array.isArray(at) && at.length === 2 && at.every(Number.isFinite)) s.touchLayout[id] = [clamp(at[0], -1, 1), clamp(at[1], -1, 1)];
      }
    }

    const pending = raw.pendingScore;
    if (pending && Number(pending.score) > 0) {
      save.pendingScore = {
        score: whole(pending.score, 1, 1e6),
        levels: whole(pending.levels, 0, D.TOTAL_GROUND),
        pucks: whole(pending.pucks, 0, D.TOTAL_PUCKS),
        finished: pending.finished === true,
      };
    }
    return save;
  }

  class SaveManager {
    constructor() {
      this.available = true;
      const read = (key) => {
        try {
          return JSON.parse(localStorage.getItem(key));
        } catch (error) {
          return null; // Blocked storage or a corrupt save.
        }
      };
      this.data = sanitize(read(KEY) || fromTenLevels(read(TEN_LEVEL_KEY)));
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
      try {
        localStorage.removeItem(TEN_LEVEL_KEY); // Or it could bring the old progress back.
      } catch (error) {
        // Storage is blocked, so there's nothing saved to bring back.
      }
    }
  }

  MQ.SaveManager = SaveManager;
})(window.MQ);
