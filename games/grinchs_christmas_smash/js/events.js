/*
 * Silly random events. They only start between shots (never while the player is aiming)
 * and at most twice a level, so they spice things up without getting in the way.
 *
 *  - Snowball Frenzy: the next two snowballs are super bouncy.
 *  - Ornament Storm: ornaments float down onto the structures (extra targets).
 *  - Max's Accident: Max runs in and bumps into a structure.
 *  - Christmas Tree Collapse: a tree wobbles... and topples.
 *  - Golden Present Bonus: a golden present parachutes in.
 */
(function (G) {
  "use strict";

  const EVENTS = {
    frenzy: { title: "SNOWBALL FRENZY!", sub: "Your next 2 snowballs are SUPER bouncy!" },
    storm: { title: "ORNAMENT STORM!", sub: "Ornaments are floating down. Smash 'em!" },
    max: { title: "MAX'S ACCIDENT!", sub: "Uh oh. Here comes Max!" },
    tree: { title: "CHRISTMAS TREE COLLAPSE!", sub: "That tree is looking wobbly..." },
    golden: { title: "GOLDEN PRESENT BONUS!", sub: "Smash it for 500 points and a bonus snowball!" },
  };

  class Events {
    constructor(game) {
      this.game = game;
      this.reset(0);
    }

    reset(levelIndex) {
      this.levelIndex = levelIndex;
      this.count = 0;
      this.max = levelIndex === 0 ? 0 : levelIndex < 4 ? 1 : 2;
      this.used = new Set();
      this.frenzyShots = 0;
      this.maxDog = null;
      this.wobbleTree = null;
      this.shotsSince = 0;
    }

    // Called each time a new shot becomes ready. Maybe starts an event.
    onShotReady() {
      this.shotsSince++;
      if (this.count >= this.max || this.shotsSince < 1) return;
      const g = this.game;
      if (g.ammo.length < 1 || g.levelEnding) return;
      if (Math.random() > 0.3) return;
      const options = ["frenzy", "storm", "max", "tree", "golden"].filter((k) => !this.used.has(k) && this.eligible(k));
      if (!options.length) return;
      this.start(G.pick(options));
    }

    eligible(kind) {
      const g = this.game;
      if (kind === "tree") return g.things.some((t) => t.alive && t.def.kind === "tree" && !t.def.mega && t.body.sleeping);
      if (kind === "max") return !!this.maxTarget();
      return true;
    }

    // Max runs in from the right, so he bumps into the rightmost thing standing on the ground.
    maxTarget() {
      let best = null;
      for (const t of this.game.things) {
        if (!t.alive || t.body.isStatic) continue;
        const b = t.body;
        if (b.maxY < G.GROUND_Y - 4 || b.x < 760 || b.x > 1860) continue;
        if (!best || b.x > best.body.x) best = t;
      }
      return best;
    }

    start(kind) {
      const g = this.game;
      this.count++;
      this.used.add(kind);
      this.shotsSince = 0;
      const info = EVENTS[kind];
      g.banner(info.title, info.sub, "#ffd23f");
      g.audio.play("event");
      g.grinch.play("surprised");
      if (kind === "frenzy") {
        this.frenzyShots = 2;
      } else if (kind === "storm") {
        const n = G.randInt(6, 9);
        for (let i = 0; i < n; i++) {
          const key = Math.random() < 0.35 ? "ornamentL" : "ornamentS";
          const t = g.spawnThing(key, G.rand(820, 1840), G.rand(-260, -40), { bonus: true, awake: true });
          t.body.gravityScale = 0.25;
          t.body.linDamp = 1.2;
          t.floaty = true;
          t.body.vx = G.rand(-40, 40);
        }
      } else if (kind === "max") {
        const target = this.maxTarget();
        this.maxDog = { x: G.WORLD_W + 120, y: G.GROUND_Y, dir: -1, state: "run", target, t: 0, bumped: false };
        g.audio.play("woof");
      } else if (kind === "tree") {
        const trees = g.things.filter((t) => t.alive && t.def.kind === "tree" && !t.def.mega);
        this.wobbleTree = { t: 0, tree: G.pick(trees) };
      } else if (kind === "golden") {
        // Drop it above something standing, so it lands on a structure.
        const standing = g.things.filter((t) => t.alive && !t.body.isStatic && t.body.x > 800);
        const x = standing.length ? G.pick(standing).body.x : G.rand(900, 1700);
        const t = g.spawnThing("presentGold", x, -80, { bonus: true, awake: true });
        t.body.gravityScale = 0.18;
        t.body.linDamp = 1.5;
        t.parachute = true;
        t.floaty = true;
      }
    }

    // The current shot uses up one frenzy shot. Returns true if it should be super bouncy.
    useFrenzy() {
      if (this.frenzyShots <= 0) return false;
      this.frenzyShots--;
      return true;
    }

    update(dt) {
      const g = this.game;
      // Floating things (storm ornaments, parachute presents) drop normally once they land.
      for (const t of g.things) {
        if (!t.floaty || !t.alive) continue;
        if (t.body.contacts > 0 || t.body.y > G.GROUND_Y - 40) {
          t.floaty = false;
          t.parachute = false;
          t.body.gravityScale = 1;
          t.body.linDamp = 0.02;
        }
      }
      // Max runs in, bumps the structure, yelps and runs off.
      const m = this.maxDog;
      if (m) {
        m.t += dt;
        const targetX = m.target && m.target.alive ? m.target.body.maxX + 40 : 1500;
        if (m.state === "run") {
          m.x -= 620 * dt;
          if (m.x <= targetX) {
            m.state = "bump";
            m.t = 0;
            this.bump(m.x);
          }
        } else if (m.state === "bump") {
          if (m.t > 0.5) {
            m.state = "leave";
            m.dir = 1;
          }
        } else if (m.state === "leave") {
          m.x += 700 * dt;
          if (m.x > G.WORLD_W + 160) this.maxDog = null;
        }
      }
      // The wobbling tree.
      const w = this.wobbleTree;
      if (w) {
        w.t += dt;
        if (!w.tree.alive) {
          this.wobbleTree = null;
        } else if (w.t < 2) {
          w.tree.wobble = Math.min(1, w.t / 1.6);
        } else {
          w.tree.wobble = 0;
          const b = w.tree.body;
          b.wake();
          const dir = Math.random() < 0.5 ? -1 : 1;
          b.w += dir * 1.6;
          b.vx += dir * 120;
          g.audio.play("timber");
          g.particles.text(b.x, b.y + b.top - 30, "TIMBER!", { color: "#ffd23f", size: 40 });
          this.wobbleTree = null;
        }
      }
    }

    bump(x) {
      const g = this.game;
      let hit = 0;
      for (const t of g.things) {
        if (!t.alive) continue;
        const b = t.body;
        if (b.minX < x + 10 && b.maxX > x - 160 && b.maxY > G.GROUND_Y - 160) {
          b.wake();
          b.vx -= 520 / Math.max(1, Math.sqrt(b.mass) * 0.6);
          b.vy -= 160;
          b.w -= 2;
          hit++;
        }
      }
      g.audio.play("woof");
      g.audio.play("impact", 1.5);
      g.particles.burst("snow", x - 20, G.GROUND_Y - 30, { count: 14 });
      g.particles.text(x, G.GROUND_Y - 140, "WOOF!", { color: "#ffffff", size: 38 });
      g.shake(10);
      g.grinch.quip("max", 1);
      return hit;
    }

    draw(ctx, time) {
      const m = this.maxDog;
      if (m) G.Art.drawMax(ctx, m.x, m.y, time, m.dir, m.state);
    }
  }

  G.Events = Events;
})(window.GS);
