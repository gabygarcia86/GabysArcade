/*
 * Moving and timed hazards: market carts, parade floats, the factory's wrapping presses,
 * giant rolling snowballs and falling Christmas trees.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const FLOAT_KINDS = ["present", "candy", "snowman", "tree"];
  const FLOAT_COLORS = ["#2f6fe0", "#e0303a", "#27a35a", "#9b4dff"];

  class Hazards {
    constructor(game) {
      this.game = game;
      const w = game.world;
      const L = game.L;
      this.carts = w.cartDefs.map((d) => ({
        ...d,
        k: Math.random(),
        dir: Math.random() < 0.5 ? 1 : -1,
        len: Math.max(1, G.dist(d.ax, d.ay, d.bx, d.by)),
        x: 0,
        y: 0,
        w: 70,
        h: 34,
        vx: 0,
        vy: 0,
        sight: false,
        hazard: "cart",
      }));
      this.floats = [];
      if (w.parade) {
        const n = (L.hazards && L.hazards.floats) || 3;
        const span = w.W + 700;
        for (let i = 0; i < n; i++) {
          this.floats.push({
            x: -350 + (i * span) / n,
            y: w.parade.laneY - 40,
            w: 210,
            h: 80,
            kind: FLOAT_KINDS[i % FLOAT_KINDS.length],
            color: FLOAT_COLORS[i % FLOAT_COLORS.length],
            speed: 58,
            vx: 58,
            vy: 0,
            sight: true,
            hazard: "float",
          });
        }
        this.span = span;
      }
      this.presses = w.presses.map((p) => ({ ...p, drop: 0, warn: false, danger: false, last: 0 }));
      this.snowballs = [];
      this.logs = [];
      this.time = 0;
      this.update(0);
    }

    update(dt) {
      const g = this.game;
      const w = g.world;
      this.time += dt;

      for (const c of this.carts) {
        c.k += (c.dir * c.speed * dt) / c.len;
        if (c.k > 1) {
          c.k = 1;
          c.dir = -1;
        } else if (c.k < 0) {
          c.k = 0;
          c.dir = 1;
        }
        const cx = G.lerp(c.ax, c.bx, c.k);
        const cy = G.lerp(c.ay, c.by, c.k);
        const nx = cx - c.w / 2;
        const ny = cy - c.h / 2;
        c.vx = dt > 0 ? (nx - c.x) / dt : 0;
        c.vy = dt > 0 ? (ny - c.y) / dt : 0;
        c.x = nx;
        c.y = ny;
      }
      for (const f of this.floats) {
        f.x += f.speed * dt;
        if (f.x > w.W + 350) f.x -= this.span;
      }

      for (const p of this.presses) {
        const ph = (((this.time + p.offset) % p.period) + p.period) % p.period / p.period;
        let drop = 0;
        let warn = false;
        if (ph < 0.12) drop = 1 - ph / 0.12;
        else if (ph < 0.55) drop = 0;
        else if (ph < 0.8) {
          warn = true;
          drop = 0.05 + Math.sin(ph * 200) * 0.03;
        } else if (ph < 0.85) drop = (ph - 0.8) / 0.05;
        else drop = 1;
        if (p.drop < 0.9 && drop >= 0.9 && g.onScreen(p.zone.x, p.zone.y, 100)) {
          g.audio.play("stamp", { gap: 0.1 });
          g.particles.puff(p.zone.x + p.zone.w / 2, p.zone.y + p.zone.h, 6, 7);
          g.shake = Math.max(g.shake, 0.12);
        }
        p.drop = drop;
        p.warn = warn;
        p.danger = drop > 0.85;
        if (p.danger) {
          const pl = g.player;
          if (G.circleHitsRect(pl.x, pl.y, pl.r * 0.7, p.zone)) g.hazardHit("press");
          for (const who of g.whos) if (who.dizzyT <= 0 && G.pointInRect(who.x, who.y, p.zone)) who.knockDizzy(2);
        }
      }

      for (const b of this.snowballs) {
        b.t += dt;
        if (b.t < b.warn) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r = Math.min(b.r + dt * 4, 64);
        b.rot += (Math.hypot(b.vx, b.vy) / b.r) * dt * (b.vx < 0 ? -1 : 1);
        if (Math.random() < dt * 20) g.particles.puff(b.x - Math.sign(b.vx) * b.r, b.y, 1, 6);
        const pl = g.player;
        if (G.dist(b.x, b.y, pl.x, pl.y) < b.r * 0.85 + pl.r) g.hazardHit("snowball");
        for (const who of g.whos) {
          if (who.dizzyT <= 0 && who.role !== "march" && G.dist(b.x, b.y, who.x, who.y) < b.r + who.r) {
            who.knockDizzy(2.5);
            who.x += Math.sign(b.vx) * 10;
            who.y += Math.sign(b.vy) * 10;
          }
        }
        for (const d of g.dogs) {
          if (G.dist(b.x, b.y, d.x, d.y) < b.r + d.r && d.state !== "cool") {
            d.state = "cool";
            d.cool = 4;
          }
        }
        if (b.x < -200 || b.x > w.W + 200 || b.y < -200 || b.y > w.H + 200) b.dead = true;
      }
      this.snowballs = this.snowballs.filter((b) => !b.dead);

      for (const l of this.logs) {
        l.t += dt;
        if (l.fall < 1) {
          l.fall = Math.min(1, l.t / 1.3);
          if (l.fall >= 1) {
            g.audio.play("timber");
            g.particles.puff(l.x + l.w / 2, l.y + l.h / 2, 16, 12);
            g.shake = Math.max(g.shake, 0.3);
            const pl = g.player;
            if (G.circleHitsRect(pl.x, pl.y, pl.r, l)) g.hazardHit("tree");
            for (const who of g.whos) if (G.circleHitsRect(who.x, who.y, who.r, l)) who.knockDizzy(2.5);
            l.solid = true;
          }
        } else if (l.t > 11.3) {
          l.dead = true;
          if (l.tree) {
            l.tree.solid.off = false;
            l.tree.hiddenProp = false;
          }
          g.particles.puff(l.x + l.w / 2, l.y + l.h / 2, 12, 10);
        }
      }
      this.logs = this.logs.filter((l) => !l.dead);

      // Moving solids the world collides against.
      const dyn = w.dynamic;
      dyn.length = 0;
      for (const c of this.carts) dyn.push(c);
      for (const f of this.floats) dyn.push(f);
      for (const l of this.logs) if (l.solid) dyn.push(l);

      // Movers shove whoever is in their way. Carts and floats also knock the Grinch over.
      if (dt > 0) {
        const pl = g.player;
        for (const m of this.carts.concat(this.floats)) {
          if (G.pushOutRect(pl, m)) {
            const toward = (pl.x - (m.x + m.w / 2)) * m.vx + (pl.y - (m.y + m.h / 2)) * m.vy > 0;
            if (toward && Math.hypot(m.vx, m.vy) > 20) g.hazardHit(m.hazard);
          }
          for (const who of g.whos) G.pushOutRect(who, m);
          for (const d of g.dogs) G.pushOutRect(d, m);
        }
      }
    }

    spawnSnowball() {
      const g = this.game;
      const w = g.world;
      const p = g.player;
      const horizontal = Math.random() < 0.5;
      const fromStart = Math.random() < 0.5;
      const speed = 300 + g.L.id * 10;
      const b = { r: 40, rot: 0, t: 0, warn: 1.6, dead: false };
      if (horizontal) {
        b.y = G.clamp(p.y + G.rand(-60, 60), 60, w.H - 60);
        b.x = fromStart ? -60 : w.W + 60;
        b.vx = fromStart ? speed : -speed;
        b.vy = 0;
      } else {
        b.x = G.clamp(p.x + G.rand(-60, 60), 60, w.W - 60);
        b.y = fromStart ? -60 : w.H + 60;
        b.vy = fromStart ? speed : -speed;
        b.vx = 0;
      }
      this.snowballs.push(b);
      g.audio.play("snowball");
    }

    // Topples a tree across the way. Returns false if there's no tree near enough.
    fallTree() {
      const g = this.game;
      const p = g.player;
      const trees = g.world.trees.filter((t) => !t.big && !t.hiddenProp && t.solid && !t.solid.off && G.dist(t.x, t.y, p.x, p.y) < 520 && G.dist(t.x, t.y, p.x, p.y) > 120);
      if (!trees.length) return false;
      const t = G.pick(trees);
      const side = p.x >= t.x ? 1 : -1;
      const len = 130 * t.size;
      t.hiddenProp = true;
      t.solid.off = true;
      const l = {
        x: side > 0 ? t.x : t.x - len,
        y: t.y - 16,
        w: len,
        h: 30,
        px: t.x,
        py: t.y,
        dirSign: side,
        fall: 0,
        t: 0,
        tree: t,
        sight: false,
        solid: false,
      };
      this.logs.push(l);
      g.addMarker({ x: t.x + side * len * 0.5, y: t.y }, "TIMBER!", "#ff9f1c", 2);
      return true;
    }

    drawGround(ctx, view) {
      for (const p of this.presses) {
        if (!G.rectsOverlap(p.zone, view)) continue;
        Art.press(ctx, p.zone, p.drop, p.warn);
      }
      // Warning arrows where a snowball is about to roll in.
      for (const b of this.snowballs) {
        if (b.t >= b.warn) continue;
        const k = Math.sin(b.t * 18) > 0 ? 1 : 0.4;
        ctx.globalAlpha = k;
        ctx.fillStyle = "rgba(255, 80, 80, 0.35)";
        const lane = 90;
        if (b.vx) ctx.fillRect(view.x, b.y - lane / 2, view.w, lane);
        else ctx.fillRect(b.x - lane / 2, view.y, lane, view.h);
        ctx.globalAlpha = 1;
      }
    }

    drawables(list, view) {
      for (const c of this.carts) {
        if (!G.rectsOverlap({ x: c.x - 20, y: c.y - 40, w: c.w + 40, h: c.h + 60 }, view)) continue;
        list.push({ sortY: c.y + c.h, draw: (ctx, t) => Art.cart(ctx, c, t) });
      }
      for (const f of this.floats) {
        if (!G.rectsOverlap({ x: f.x - 20, y: f.y - 160, w: f.w + 40, h: f.h + 180 }, view)) continue;
        list.push({ sortY: f.y + f.h, draw: (ctx, t) => Art.float(ctx, f, t), fadeRect: { x: f.x, y: f.y - 150, w: f.w, h: f.h + 150 } });
      }
      for (const b of this.snowballs) {
        if (b.t < b.warn) continue;
        list.push({ sortY: b.y, draw: (ctx) => Art.snowball(ctx, b) });
      }
      for (const l of this.logs) {
        list.push({ sortY: l.fall < 1 ? l.py : l.y + l.h, draw: (ctx, t) => Art.log(ctx, l, t) });
      }
    }

    drawOverlay(ctx, view) {
      // A "!" at the screen edge where a snowball will come from.
      for (const b of this.snowballs) {
        if (b.t >= b.warn) continue;
        const x = G.clamp(b.x, view.x + 40, view.x + view.w - 40);
        const y = G.clamp(b.y, view.y + 120, view.y + view.h - 40);
        G.drawBubble(ctx, x, y, "!", "#ff4d4d", 0.5);
      }
    }
  }

  G.Hazards = Hazards;
})(window.GH);
