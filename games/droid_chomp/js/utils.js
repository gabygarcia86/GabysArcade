/* Shared namespace, direction tables, small helpers and the one localStorage record. */
window.DROID = {};

(function (D) {
  D.TAU = Math.PI * 2;

  // Directions are indexes, so "reverse" is (dir + 2) % 4 and -1 means standing still.
  D.UP = 0;
  D.RIGHT = 1;
  D.DOWN = 2;
  D.LEFT = 3;
  D.DX = [0, 1, 0, -1];
  D.DY = [-1, 0, 1, 0];

  D.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  D.lerp = (a, b, t) => a + (b - a) * t;
  D.ease = (t) => t * t * (3 - 2 * t);

  // Small seeded generator, so a level's decorations land in the same place every visit.
  D.seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  D.fmt = (n) => n.toLocaleString("en-US");

  const KEY = "droidChomp.save.v1";
  const defaults = () => ({
    version: 1,
    highScore: 0,
    scores: [], // Top five: { score, droid, level, cycle }
    droid: "r2d2",
    unlockedB1: false,
    options: {
      music: 0.6,
      sfx: 0.8,
      muted: false,
      musicOn: true,
      difficulty: "normal", // cadet | normal | master
      touch: "auto", // auto | on | off
    },
  });

  /*
   * Everything saved lives in one record. If storage is blocked (private windows,
   * cleared data) the game still runs, it just won't remember.
   */
  class SaveData {
    constructor() {
      this.data = defaults();
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const base = defaults();
          this.data = { ...base, ...parsed, options: { ...base.options, ...(parsed.options || {}) } };
        }
      } catch (error) {
        console.warn("Droid-Chomp: could not read the save, starting fresh.", error);
      }
    }

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (error) {
        // Storage is blocked or full. Scores last for this session only.
      }
    }

    get options() { return this.data.options; }

    setOption(key, value) {
      this.data.options[key] = value;
      this.save();
    }
  }

  D.SaveData = SaveData;
})(window.DROID);
