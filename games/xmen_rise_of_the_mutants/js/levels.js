/*
 * Levels: the 20 story levels and the builder that assembles each one from a list of
 * hand-designed chunks (rooftops, gaps, elevators, towers, combat arenas, secret rooms,
 * laser gates, crumbling floors, boss arenas...). Every chunk is sized so every hero
 * can clear the main path; X symbols marked ".x" go in each chunk's hardest spot.
 *
 * Chunk codes: "type.arg.arg"  e.g. "upper.x" puts an X symbol in that chunk,
 * "flat.3" places 3 enemies, "flat.toad" places Toad, "obj.cell" adds an objective.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const T = XM.T;
  const TL = XM.TILE;

  const PAR = { start: 6, flat: 16, steps: 12, gap: 12, moving: 16, elevator: 16, tower: 16, arena: 38, hazard: 12, upper: 16, secret: 14, crates: 10, cp: 3, crumble: 12, lasers: 14, debris: 12, bridge: 12, obj: 18, boss: 95, exit: 4 };
  const BARREL_THEMES = new Set(["factory", "megacity", "desert", "prison", "cyber", "subway"]);

  class Builder {
    constructor(def, idx) {
      this.def = def;
      this.idx = idx;
      this.H = def.h || 16;
      this.g = this.H - 3;
      this.cols = [];
      this.rng = U.rng(500 + idx * 131);
      this.theme = XM.THEMES[def.theme];
      this.o = {
        pickups: [],
        spawns: [],
        platforms: [],
        checkpoints: [],
        arenas: [],
        secrets: [],
        crates: new Map(),
        interactables: [],
        lasers: [],
        debris: [],
        signs: [],
        boss: null,
        exit: null,
        spawn: null,
        xCount: 0,
        objectives: 0,
        par: 0,
      };
      this.ground = def.roster.filter((t) => !XM.ENEMY_TYPES[t].flying);
      this.flyers = def.roster.filter((t) => XM.ENEMY_TYPES[t].flying);
    }

    // ---- tile helpers ----
    ensure(x) {
      while (this.cols.length <= x) this.cols.push(new Uint8Array(this.H));
    }
    set(x, y, v) {
      if (y < 0 || y >= this.H || x < 0) return;
      this.ensure(x);
      this.cols[x][y] = v;
    }
    get(x, y) {
      return this.cols[x] ? this.cols[x][y] : 0;
    }
    fill(x0, y0, x1, y1, v) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.set(x, y, v);
    }
    floor(x0, x1, top = this.g) {
      this.fill(x0, top, x1, this.H - 1, TL.SOLID);
    }
    pit(x0, x1) {
      for (let x = x0; x <= x1; x++) this.ensure(x);
    }
    plat(x0, x1, y) {
      this.fill(x0, y, x1, y, TL.ONEWAY);
    }
    ladder(x, yTop, yBottom) {
      this.set(x, yTop, TL.ONEWAY);
      this.fill(x, yTop + 1, x, yBottom, TL.LADDER);
    }
    px(tx) {
      return (tx + 0.5) * T;
    }

    // ---- entity helpers ----
    foe(x, type, yRow = this.g) {
      const t = type || (this.ground.length ? this.ground[Math.floor(this.rng() * this.ground.length)] : "reaverGrunt");
      this.o.spawns.push({ type: t, x: this.px(x), y: yRow * T });
    }
    flyer(x, rows = 4) {
      if (!this.flyers.length) return;
      const t = this.flyers[Math.floor(this.rng() * this.flyers.length)];
      this.o.spawns.push({ type: t, x: this.px(x), y: (this.g - rows + 3) * T });
    }
    item(kind, x, yRow, opts = {}) {
      this.o.pickups.push(Object.assign({ kind, x: this.px(x), y: yRow * T + T / 2 }, opts));
    }
    orb(x, yRow) {
      this.item("orb", x, yRow);
    }
    orbs(x0, x1, yRow) {
      for (let x = x0; x <= x1; x++) this.orb(x, yRow);
    }
    orbArc(x0, x1, baseRow, height = 2) {
      for (let x = x0; x <= x1; x++) {
        const k = (x - x0) / Math.max(1, x1 - x0);
        this.o.pickups.push({ kind: "orb", x: this.px(x), y: (baseRow + 0.5) * T - Math.sin(k * Math.PI) * height * T });
      }
    }
    xsym(x, yRow) {
      this.o.pickups.push({ kind: "xsymbol", x: this.px(x), y: (yRow + 0.5) * T, index: this.o.xCount });
      this.o.xCount++;
    }
    crate(x, y, content, seal = false) {
      this.set(x, y, seal ? TL.SEAL : TL.CRATE);
      if (content) this.o.crates.set(`${x},${y}`, content);
    }
    mover(x0, y0, x1, y1, w, speed) {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      this.o.platforms.push({ x: x0, y: y0, x0, y0, x1, y1, w, h: 14, speed, len, t: 0, dx: 0, dy: 0, path: true });
    }
    crumble(x, yRow, wTiles) {
      this.o.platforms.push({ x: x * T, y: yRow * T, y0: yRow * T, w: wTiles * T, h: 14, crumble: true, state: 0, timer: 0, dx: 0, dy: 0, active: true });
    }
    checkpoint(x) {
      this.o.checkpoints.push({ x: this.px(x), y: this.g * T, active: false });
    }
    sign(x, keys, touch) {
      this.o.signs.push({ x: this.px(x), y: this.g * T, keys, touch: touch || keys });
    }

    // ---- build ----
    build() {
      // A "second act" of extra rooms before the finale, so each level runs 5-10 minutes.
      const chunks = this.def.chunks.slice();
      const pool = ["flat", "upper", "gap", "steps", "hazard", "crumble", "moving", "debris", "lasers", "bridge", "tower", "flat.3", "crates"];
      const extra = [];
      for (let i = 0; i < 6; i++) extra.push(pool[Math.floor(this.rng() * pool.length)]);
      extra.splice(3, 0, "cp", "arena.2");
      extra.push("cp");
      chunks.splice(chunks.length - 2, 0, ...extra);
      const list = chunks.map((s) => {
        const parts = s.split(".");
        const opts = { x: false };
        for (const a of parts.slice(1)) {
          if (a === "x") opts.x = true;
          else if (/^\d+$/.test(a)) opts.n = Number(a);
          else opts.kind = a;
        }
        return { type: parts[0], opts };
      });
      let x = 0;
      for (const c of list) {
        const fn = CHUNKS[c.type];
        if (!fn) throw new Error(`Unknown chunk ${c.type}`);
        const w = fn(this, x, c.opts);
        this.o.par += PAR[c.type] || 10;
        x += w;
      }
      // Close the right edge.
      this.fill(x, 0, x, this.H - 1, TL.SOLID);
      const W = this.cols.length;
      const tiles = new Uint8Array(W * this.H);
      for (let cx = 0; cx < W; cx++) for (let cy = 0; cy < this.H; cy++) tiles[cy * W + cx] = this.cols[cx][cy];
      if (this.o.xCount !== 3) console.warn(`Level ${this.idx + 1} has ${this.o.xCount} X symbols`);
      return Object.assign(this.o, { W, H: this.H, tiles, g: this.g, theme: this.theme, themeIndex: this.def.theme });
    }
  }

  // ---------------- Chunks ----------------
  // Each takes (builder, startColumn, opts) and returns its width in tiles.
  const CHUNKS = {
    start(b, x) {
      const g = b.g;
      b.floor(x, x + 11);
      b.o.spawn = { x: (x + 3) * T, y: g * T };
      b.orbs(x + 6, x + 10, g - 1);
      if (b.def.tutorial) {
        b.sign(x + 2, "A / D or ← → to move  •  SPACE to jump", "Use the joystick to move  •  JUMP to jump");
        b.sign(x + 8, "J: Basic attack  •  K: Special  •  L: Ultimate", "ATK, SPC and ULT buttons attack");
      }
      return 12;
    },

    flat(b, x, o) {
      const g = b.g;
      const w = 16;
      b.floor(x, x + w - 1);
      b.orbArc(x + 2, x + 6, g - 2, 1.5);
      if (o.kind === "toad" || o.kind === "pyro") {
        b.foe(x + 11, o.kind);
        b.foe(x + 6);
        b.item("health", x + 2, g - 1);
      } else if (o.kind === "disg") {
        b.foe(x + 6, "disguised");
        b.foe(x + 10, "disguised");
        b.foe(x + 14, "disguised");
      } else {
        const n = o.n || 2 + Math.floor(b.idx / 7);
        for (let i = 0; i < n; i++) b.foe(x + 7 + (n > 1 ? Math.floor((i * 8) / (n - 1)) : 0));
      }
      if (BARREL_THEMES.has(b.theme.key) && b.rng() < 0.7) b.o.spawns.push({ type: "barrel", x: b.px(x + 9), y: g * T });
      if (b.rng() < 0.5) b.flyer(x + 10);
      if (b.rng() < 0.3) b.item("token", x + 13, g - 3);
      return w;
    },

    steps(b, x, o) {
      const g = b.g;
      b.floor(x, x + 17);
      b.fill(x + 3, g - 1, x + 5, g - 1, TL.SOLID);
      b.fill(x + 6, g - 2, x + 8, g - 1, TL.SOLID);
      b.fill(x + 9, g - 3, x + 12, g - 1, TL.SOLID);
      b.fill(x + 13, g - 2, x + 14, g - 1, TL.SOLID);
      b.fill(x + 15, g - 1, x + 15, g - 1, TL.SOLID);
      b.orbs(x + 3, x + 5, g - 2);
      b.orbs(x + 6, x + 8, g - 3);
      b.foe(x + 11, null, g - 3);
      b.foe(x + 16);
      if (o.x) {
        b.plat(x + 9, x + 11, g - 6);
        b.xsym(x + 10, g - 7);
      } else b.orbs(x + 9, x + 12, g - 4);
      return 18;
    },

    gap(b, x, o) {
      const g = b.g;
      b.floor(x, x + 3);
      b.pit(x + 4, x + 6);
      b.floor(x + 7, x + 9);
      b.pit(x + 10, x + 12);
      b.floor(x + 13, x + 15);
      b.plat(x + 4, x + 6, g - 2);
      b.plat(x + 10, x + 12, g - 2);
      b.orbs(x + 4, x + 6, g - 3);
      b.orbs(x + 10, x + 12, g - 3);
      b.foe(x + 8);
      b.flyer(x + 11);
      if (o.x) {
        b.plat(x + 10, x + 12, g - 5);
        b.xsym(x + 11, g - 6);
      }
      return 16;
    },

    moving(b, x, o) {
      const g = b.g;
      b.floor(x, x + 3);
      b.pit(x + 4, x + 14);
      b.floor(x + 15, x + 17);
      b.mover((x + 4) * T, g * T, (x + 12) * T, g * T, 3 * T, 115);
      b.orbArc(x + 5, x + 13, g - 2, 1);
      b.flyer(x + 9, 5);
      if (o.x) b.xsym(x + 9, g - 4);
      return 18;
    },

    elevator(b, x, o) {
      const g = b.g;
      b.floor(x, x + 15);
      b.fill(x + 6, g - 7, x + 9, g - 1, TL.SOLID);
      b.mover((x + 4) * T, g * T, (x + 4) * T, (g - 7) * T, 2 * T, 95);
      b.foe(x + 8, null, g - 7);
      b.orbs(x + 6, x + 9, g - 8);
      b.foe(x + 13);
      if (o.x) {
        b.plat(x + 6, x + 8, g - 10);
        b.xsym(x + 7, g - 11);
      }
      return 16;
    },

    tower(b, x, o) {
      const g = b.g;
      b.floor(x, x + 13);
      b.fill(x + 8, g - 6, x + 11, g - 1, TL.SOLID);
      b.ladder(x + 7, g - 6, g - 1);
      b.plat(x + 3, x + 5, g - 2);
      b.plat(x + 4, x + 6, g - 4);
      b.orbs(x + 3, x + 5, g - 3);
      b.orbs(x + 4, x + 6, g - 5);
      b.foe(x + 10, null, g - 6);
      b.foe(x + 2);
      if (o.x) {
        b.plat(x + 9, x + 10, g - 9);
        b.xsym(x + 9, g - 10);
      } else b.item("energy", x + 9, g - 7);
      return 14;
    },

    arena(b, x, o) {
      const g = b.g;
      b.floor(x, x + 23);
      b.plat(x + 4, x + 7, g - 3);
      b.plat(x + 16, x + 19, g - 3);
      b.plat(x + 10, x + 13, g - 5);
      b.orbs(x + 10, x + 13, g - 6);
      const waves = [];
      const n = o.n || 2;
      const size = 3 + Math.floor(b.idx / 6);
      for (let i = 0; i < n; i++) {
        const wave = [];
        for (let k = 0; k < size; k++) {
          const useFlyer = b.flyers.length && b.rng() < 0.25;
          const pool = useFlyer ? b.flyers : b.ground;
          wave.push(pool[Math.floor(b.rng() * pool.length)]);
        }
        waves.push(wave);
      }
      b.o.arenas.push({ x0: (x + 1) * T, x1: (x + 23) * T, gates: [x + 1, x + 22], rows: [g - 7, g - 1], waves, wave: -1, trigger: (x + 6) * T, active: false, done: false, cols: [x + 3, x + 20], reward: { x: b.px(x + 12), y: (g - 1) * T } });
      return 24;
    },

    hazard(b, x, o) {
      const g = b.g;
      b.floor(x, x + 17);
      b.fill(x + 3, g - 1, x + 14, g - 1, TL.HAZARD);
      b.set(x + 6, g - 1, TL.SOLID);
      b.fill(x + 9, g - 2, x + 9, g - 1, TL.SOLID);
      b.set(x + 12, g - 1, TL.SOLID);
      b.plat(x + 6, x + 12, g - 4);
      b.orbs(x + 6, x + 12, g - 5);
      b.foe(x + 16);
      if (o.x) {
        b.plat(x + 8, x + 10, g - 7);
        b.xsym(x + 9, g - 8);
      }
      return 18;
    },

    upper(b, x, o) {
      const g = b.g;
      b.floor(x, x + 21);
      b.plat(x + 3, x + 7, g - 3);
      b.plat(x + 9, x + 13, g - 5);
      b.plat(x + 15, x + 19, g - 3);
      b.orbs(x + 3, x + 7, g - 4);
      b.orbs(x + 9, x + 13, g - 6);
      b.orbs(x + 15, x + 19, g - 4);
      b.foe(x + 8);
      b.foe(x + 16);
      b.flyer(x + 12, 6);
      if (o.x) {
        b.plat(x + 10, x + 12, g - 8);
        b.xsym(x + 11, g - 9);
      }
      return 22;
    },

    secret(b, x, o) {
      const g = b.g;
      b.floor(x, x + 15);
      b.set(x + 3, g - 1, TL.SOLID);
      b.fill(x + 4, g - 2, x + 4, g - 1, TL.SOLID);
      b.fill(x + 5, g - 4, x + 11, g - 1, TL.SOLID);
      b.fill(x + 6, g - 3, x + 10, g - 1, TL.EMPTY);
      b.fill(x + 11, g - 3, x + 11, g - 1, TL.FAKE);
      b.o.secrets.push({ x: (x + 6) * T, y: (g - 3) * T, w: 6 * T, h: 3 * T, found: false });
      if (b.def.tutorial) b.sign(x + 14, "Some walls hide secret rooms. Look for cracks!", "Some walls hide secret rooms. Look for cracks!");
      if (o.x) b.xsym(x + 8, g - 2);
      else b.item("token", x + 8, g - 1);
      b.item("rare", x + 7, g - 1);
      b.orbs(x + 9, x + 10, g - 1);
      b.item("health", x + 6, g - 1);
      b.orbs(x + 12, x + 13, g - 1);
      b.foe(x + 14);
      b.orbs(x + 6, x + 10, g - 5);
      return 16;
    },

    crates(b, x, o) {
      const g = b.g;
      b.floor(x, x + 11);
      const pick = () => ["orbs", "health", "energy", "token", "orbs", "ult"][Math.floor(b.rng() * 6)];
      b.crate(x + 3, g - 1, pick());
      b.crate(x + 4, g - 1, pick());
      b.crate(x + 4, g - 2, "orbs");
      b.crate(x + 7, g - 1, o.x ? { kind: "xsymbol", index: b.o.xCount } : "ult", true);
      b.crate(x + 9, g - 1, pick());
      b.crate(x + 9, g - 2, pick());
      if (o.x) b.o.xCount++;
      if (b.def.tutorial) b.sign(x + 1, "Glowing X-Seal crates only break with a Special (K)", "Glowing X-Seal crates only break with SPC");
      b.foe(x + 11);
      return 12;
    },

    cp(b, x) {
      b.floor(x, x + 5);
      b.checkpoint(x + 3);
      return 6;
    },

    crumble(b, x) {
      const g = b.g;
      b.floor(x, x + 1);
      b.pit(x + 2, x + 13);
      b.floor(x + 14, x + 15);
      [3, 6, 9, 12].forEach((c, i) => {
        b.crumble(x + c, i % 2 ? g - 1 : g, 2);
        b.orbs(x + c, x + c + 1, (i % 2 ? g - 1 : g) - 2);
      });
      return 16;
    },

    lasers(b, x) {
      const g = b.g;
      b.floor(x, x + 15);
      [4, 8, 12].forEach((c, i) => {
        b.set(x + c, g - 6, TL.SOLID);
        b.o.lasers.push({ x: b.px(x + c), y0: (g - 5) * T, y1: g * T, period: 2.6, offset: i * 0.85, on: 0.45 });
      });
      b.orbs(x + 5, x + 7, g - 1);
      b.orbs(x + 9, x + 11, g - 1);
      b.foe(x + 14);
      return 16;
    },

    debris(b, x) {
      const g = b.g;
      b.floor(x, x + 17);
      b.o.debris.push({ x0: (x + 2) * T, x1: (x + 16) * T, timer: 1 });
      b.orbArc(x + 3, x + 14, g - 2, 1.5);
      b.foe(x + 9);
      b.foe(x + 15);
      return 18;
    },

    bridge(b, x) {
      const g = b.g;
      b.floor(x, x + 1);
      b.pit(x + 2, x + 15);
      b.floor(x + 16, x + 17);
      b.plat(x + 2, x + 15, g);
      b.orbs(x + 4, x + 13, g - 2);
      b.flyer(x + 6, 5);
      b.flyer(x + 12, 4);
      return 18;
    },

    obj(b, x, o) {
      const g = b.g;
      b.floor(x, x + 13);
      if (o.kind === "machine" || o.kind === "node") {
        b.o.spawns.push({ type: o.kind === "machine" ? "machine" : "nexusNode", x: b.px(x + 7), y: g * T, objective: true });
      } else {
        b.o.interactables.push({ kind: o.kind, x: b.px(x + 7), y: g * T, done: false });
      }
      b.o.objectives++;
      b.foe(x + 3);
      b.foe(x + 11);
      b.orbs(x + 5, x + 9, g - 3);
      return 14;
    },

    boss(b, x) {
      const g = b.g;
      b.floor(x, x + 31);
      b.fill(x + 31, 0, x + 31, g - 1, TL.SOLID);
      b.plat(x + 5, x + 8, g - 3);
      b.plat(x + 23, x + 26, g - 3);
      b.plat(x + 13, x + 18, g - 6);
      b.o.boss = { id: b.def.boss, arena: { x0: (x + 2) * T, x1: (x + 31) * T, floor: g * T, top: Math.max(0, g - 12) * T }, trigger: (x + 7) * T, gate: x + 1, rows: [Math.max(0, g - 12), g - 1], started: false };
      return 32;
    },

    exit(b, x) {
      b.floor(x, x + 9);
      b.fill(x + 9, 0, x + 9, b.g - 1, TL.SOLID);
      b.o.exit = { x: b.px(x + 5), y: b.g * T };
      return 10;
    },
  };

  // ---------------- The 20 levels ----------------
  const LEVELS = [
    {
      name: "Mutant Emergence",
      location: "New York City",
      theme: 0,
      tutorial: true,
      roster: ["sentinel", "reaverGrunt", "reaverGunner", "drone"],
      chunks: ["start", "flat.1", "steps", "crates.x", "cp", "upper", "gap", "flat.2", "cp", "secret.x", "arena.2", "moving", "cp", "upper.x", "flat.3", "exit"],
    },
    {
      name: "The Sentinel Factory",
      location: "Abandoned Industrial Complex",
      theme: 1,
      boss: "apocalypse",
      roster: ["sentinel", "sentinelAdvanced", "reaverGrunt", "reaverGunner", "drone"],
      chunks: ["start", "flat.2", "lasers", "cp", "crates", "elevator.x", "flat.2", "cp", "moving", "secret.x", "arena.2", "cp", "hazard.x", "bridge", "cp", "boss"],
    },
    {
      name: "Underground Mutants",
      location: "Subway Tunnels Beneath Manhattan",
      theme: 2,
      roster: ["reaverGrunt", "reaverGunner", "mutantHunter", "securityBot", "rogueSoldier"],
      objective: { kind: "cell", label: "Free the captured mutants" },
      chunks: ["start", "flat.2", "tower.x", "obj.cell", "cp", "crumble", "flat.toad", "cp", "upper", "secret.x", "debris", "obj.cell", "arena.3", "cp", "crates.x", "gap", "obj.cell", "exit"],
    },
    {
      name: "Sinister Laboratories",
      location: "Secret Genetic Research Facility",
      theme: 3,
      boss: "sinister",
      roster: ["experimental", "reaverGrunt", "clone", "securityBot", "turret"],
      chunks: ["start", "flat.2", "lasers", "cp", "upper.x", "tower", "cp", "crates", "secret.x", "arena.3", "cp", "hazard", "lasers", "crates.x", "bridge", "cp", "boss"],
    },
    {
      name: "Savage Wildlands",
      location: "Remote Jungle Wilderness",
      theme: 4,
      boss: "sabretooth",
      roster: ["jungleBeast", "reaverGrunt", "reaverGunner", "securityBot", "rogueSoldier"],
      chunks: ["start", "flat.2", "steps", "cp", "gap.x", "upper", "crumble", "cp", "secret.x", "flat.3", "arena.3", "cp", "tower.x", "moving", "cp", "boss"],
    },
    {
      name: "The Crystal Mines",
      location: "Deep Underground Crystal Mines",
      theme: 5,
      boss: "juggernaut",
      roster: ["miner", "sentinelEnergy", "crystalCreature", "reaverGrunt", "reaverGunner"],
      chunks: ["start", "flat.2", "debris", "cp", "crates.x", "elevator", "crumble", "cp", "secret.x", "upper", "arena.3", "cp", "tower.x", "gap", "debris", "cp", "boss"],
    },
    {
      name: "The City of Shadows",
      location: "Abandoned European City",
      theme: 6,
      boss: "mystique",
      roster: ["reaverGrunt", "reaverElite", "reaverGunner", "disguised"],
      chunks: ["start", "flat.disg", "steps", "cp", "upper.x", "flat.toad", "cp", "secret.x", "gap", "flat.pyro", "arena.3", "cp", "tower.x", "flat.2", "cp", "boss"],
    },
    {
      name: "Phoenix Disturbance",
      location: "Orbital Research Station",
      theme: 7,
      boss: "darkphoenix",
      roster: ["securityBot", "energyCreature", "drone", "corruptedBeing", "turret"],
      chunks: ["start", "flat.2", "moving", "cp", "lasers", "upper.x", "bridge", "cp", "secret.x", "elevator", "arena.3", "cp", "gap.x", "moving", "cp", "boss"],
    },
    {
      name: "The Frozen Frontier",
      location: "Arctic Research Facility",
      theme: 8,
      boss: "omegared",
      roster: ["iceMutant", "sentinelAdvanced", "reaverGrunt", "reaverGunner", "experimental"],
      chunks: ["start", "flat.2", "steps", "cp", "crumble", "hazard.x", "upper", "cp", "secret.x", "flat.2", "arena.3", "cp", "tower", "crates.x", "cp", "boss"],
    },
    {
      name: "Mutant Prison Break",
      location: "High-Security Mutant Detention Facility",
      theme: 9,
      boss: "blob",
      roster: ["guard", "sentinel", "reaverGrunt", "securityOfficer", "turret"],
      objective: { kind: "cell", label: "Free the prisoners" },
      chunks: ["start", "flat.2", "obj.cell", "lasers", "cp", "upper.x", "obj.cell", "cp", "secret.x", "arena.3", "tower", "cp", "obj.cell", "crates.x", "cp", "boss"],
    },
    {
      name: "The Desert Outpost",
      location: "Remote Desert Military Installation",
      theme: 10,
      roster: ["militaryRobot", "reaverGrunt", "reaverGunner", "rogueSoldier", "drone"],
      objective: { kind: "machine", label: "Destroy the extraction machines" },
      chunks: ["start", "flat.2", "obj.machine", "cp", "steps", "upper.x", "obj.machine", "cp", "secret.x", "debris", "arena.3", "cp", "gap", "crates.x", "obj.machine", "cp", "flat.3", "exit"],
    },
    {
      name: "The Cybernetic War",
      location: "Underground Cybernetic Weapons Facility",
      theme: 11,
      boss: "deathstrike",
      roster: ["reaverCyber", "reaverGrunt", "sentinelAdvanced", "militaryRobot", "turret"],
      chunks: ["start", "flat.2", "lasers", "cp", "elevator.x", "flat.2", "cp", "crates", "secret.x", "arena.3", "cp", "lasers", "upper.x", "bridge", "cp", "boss"],
    },
    {
      name: "The Lost Temple",
      location: "Ancient Hidden Temple",
      theme: 12,
      roster: ["guardian", "experimental", "energyCreature", "reaverGrunt", "reaverGunner"],
      objective: { kind: "tablet", label: "Read the ancient Nexus tablets" },
      chunks: ["start", "flat.2", "steps", "obj.tablet", "cp", "debris", "crates.x", "tower", "cp", "secret.x", "hazard", "obj.tablet", "arena.3", "cp", "crumble", "upper.x", "gap", "obj.tablet", "cp", "exit"],
    },
    {
      name: "Apocalypse Rising",
      location: "Ancient Underground City",
      theme: 13,
      boss: "apocalypseEnhanced",
      roster: ["apocSoldier", "mutantWarrior", "sentinel", "energyCreature"],
      chunks: ["start", "flat.2", "steps", "cp", "hazard", "upper.x", "arena.3", "cp", "secret.x", "tower", "crumble", "cp", "moving.x", "flat.3", "cp", "boss"],
    },
    {
      name: "The Reaver Stronghold",
      location: "Abandoned Industrial Megacity",
      theme: 14,
      roster: ["reaverGrunt", "reaverGunner", "reaverHeavy", "reaverCyber", "reaverElite", "sentinelHeavy"],
      objective: { kind: "console", label: "Disable the Reaver comm towers" },
      chunks: ["start", "flat.2", "obj.console", "cp", "lasers", "upper.x", "flat.pyro", "cp", "secret.x", "obj.console", "arena.3", "cp", "tower.x", "flat.toad", "obj.console", "cp", "exit"],
    },
    {
      name: "The Nexus Dimension",
      location: "Unstable Alternate Dimension",
      theme: 15,
      boss: "sinisterNexus",
      roster: ["dimensional", "energyCreature", "sentinelCorrupt", "nexusGuardian"],
      chunks: ["start", "flat.2", "moving", "cp", "crumble", "upper.x", "cp", "secret.x", "bridge", "arena.3", "cp", "gap.x", "tower", "cp", "boss"],
    },
    {
      name: "The Fall of Xavier's Dream",
      location: "Xavier's School for Gifted Youngsters",
      theme: 16,
      roster: ["reaverGrunt", "reaverGunner", "sentinelAdvanced", "eliteHunter", "mercenary"],
      objective: { kind: "student", label: "Rescue the trapped students" },
      chunks: ["start", "flat.2", "obj.student", "cp", "steps", "upper.x", "obj.student", "cp", "secret.x", "arena.3", "cp", "crates.x", "obj.student", "tower", "cp", "arena.4", "exit"],
    },
    {
      name: "The Final Mutant War",
      location: "Magneto's Floating Fortress",
      theme: 17,
      boss: "guardian",
      roster: ["acolyte", "sentinel", "energyWarrior", "reaverElite"],
      chunks: ["start", "flat.2", "moving", "cp", "lasers", "upper.x", "elevator", "cp", "secret.x", "arena.3", "cp", "bridge", "crates.x", "cp", "boss"],
    },
    {
      name: "Rise of the Nexus",
      location: "The Mutant Nexus Energy Core",
      theme: 18,
      boss: "magneto",
      roster: ["nexusGuardian", "sentinelEnergy", "eliteHunter", "mutantWarrior", "energyCreature"],
      objective: { kind: "node", label: "Shut down the Nexus nodes" },
      chunks: ["start", "flat.2", "obj.node", "cp", "hazard", "upper.x", "obj.node", "cp", "secret.x", "arena.3", "cp", "moving.x", "obj.node", "cp", "boss"],
    },
    {
      name: "The Last Stand",
      location: "The Nexus Core — Final Battlefield",
      theme: 19,
      boss: "magnetoUltimate",
      roster: ["acolyte", "sentinelCorrupt", "energyWarrior", "nexusGuardian", "reaverElite", "dimensional"],
      chunks: ["start", "flat.3", "crumble", "cp", "arena.4", "upper.x", "hazard", "cp", "secret.x", "arena.4", "cp", "tower.x", "lasers", "cp", "boss"],
    },
  ];

  LEVELS.forEach((l, i) => {
    l.index = i;
    l.number = i + 1;
  });

  XM.LEVELS = LEVELS;
  XM.LevelBuilder = {
    build(index) {
      return new Builder(LEVELS[index], index).build();
    },
    CHUNKS,
  };
})(window.XM);
