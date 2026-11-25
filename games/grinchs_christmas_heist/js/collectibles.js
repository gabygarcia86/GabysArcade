/*
 * Loot on the map and power-ups. Loot sits on spots the map builder picked (some hidden
 * behind houses and trees), rides conveyor belts, flies to a magnetic sack, and scatters
 * when the Grinch is caught. Dropped loot can be picked up again (or fetched by Max).
 */
(function (G) {
  "use strict";

  const PICK_R = 20;

  class Loot {
    constructor(game) {
      this.game = game;
      this.items = [];
      this.powers = [];
      const L = game.L;
      this.powerT = L.id === 1 ? 8 : G.rand(L.powerEvery[0] * 0.6, L.powerEvery[1] * 0.6);
      this.potential = 0;
    }

    spawnLevel() {
      const g = this.game;
      const w = g.world;
      const L = g.L;
      const spots = G.shuffle(
        w.spots.filter((s) => G.dist(s.x, s.y, w.start.x, w.start.y) > 140 && G.dist(s.x, s.y, w.getaway.x, w.getaway.y) > 120),
      );
      // Bonus spots first so the valuable loot is always there.
      spots.sort((a, b) => (b.bonus ? 1 : 0) - (a.bonus ? 1 : 0));
      const n = Math.min(L.items, spots.length);
      for (let i = 0; i < n; i++) {
        const s = spots[i];
        let type;
        if (s.bonus === "gold") type = G.weighted({ bell: 4, giant: 1.2, tree: 1, wreath: 0.6 });
        else if (s.bonus === "bonus") type = G.weighted({ giant: 2, tree: 2, bell: 1.6, wreath: 1, large: 1 });
        else if (s.hidden) type = G.weighted({ ...L.mix, large: (L.mix.large || 1) * 1.5, bell: (L.mix.bell || 0.3) * 1.6, giant: (L.mix.giant || 0.3) * 1.3 });
        else type = G.weighted(L.mix);
        if (s.belt && (type === "tree" || type === "giant")) type = "large";
        this.add(type, s.x, s.y, { hidden: s.hidden, belt: s.belt });
        this.potential += G.ITEMS[type].pts;
      }
    }

    add(type, x, y, o = {}) {
      const it = {
        type,
        v: G.randInt(0, 5),
        x,
        y,
        t: Math.random() * 10,
        hidden: !!o.hidden,
        belt: o.belt || null,
        dropped: !!o.dropped,
        delay: o.delay || 0,
        vx: o.vx || 0,
        vy: o.vy || 0,
        z: o.z || 0,
        vz: o.vz || 0,
        r: 10,
        life: o.life || 0,
        collected: false,
        carriedBy: null,
        pop: o.pop ? 0 : 1,
        sparkT: Math.random() * 2,
      };
      this.items.push(it);
      return it;
    }

    // Loot falling out of the sack. Each entry keeps the points it was worth.
    scatter(entries, x, y) {
      for (const e of entries) {
        const a = Math.random() * G.TAU;
        const sp = G.rand(90, 190);
        const it = this.add(e.type, x, y, { dropped: true, delay: 0.9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, z: 10, vz: G.rand(200, 300) });
        it.pts = e.pts;
      }
    }

    spawnPower() {
      const g = this.game;
      const p = g.player;
      const w = g.world;
      const type = G.weighted({ slippers: 3, coat: 2.2, magnet: 3, maxdog: g.max.active ? 0 : 2, sugar: 2.2, golden: 1.6 });
      for (let k = 0; k < 30; k++) {
        const a = Math.random() * G.TAU;
        const d = G.rand(240, 640);
        const x = p.x + Math.cos(a) * d;
        const y = p.y + Math.sin(a) * d;
        if (w.isFree(x, y, 22, 8) && !w.zoneAt(w.belts, x, y)) {
          this.powers.push({ type, x, y, t: 0, life: 14 });
          return;
        }
      }
    }

    update(dt) {
      const g = this.game;
      const p = g.player;
      const w = g.world;
      const magnet = p.powers.magnet > 0;
      const canPick = p.stun <= 0 && !p.escaping && g.state === "play";

      for (const it of this.items) {
        if (it.collected) continue;
        it.t += dt;
        if (it.pop < 1) it.pop = Math.min(1, it.pop + dt * 3);
        if (it.delay > 0) it.delay -= dt;
        if (it.carriedBy) {
          it.x = it.carriedBy.x;
          it.y = it.carriedBy.y;
          continue;
        }
        if (it.life > 0) {
          it.life -= dt;
          if (it.life <= 0) {
            it.collected = true;
            g.particles.sparkle(it.x, it.y - 20, "#ffd23f");
            continue;
          }
        }
        // Thrown loot arcs and slides to a stop.
        if (it.z > 0 || it.vz !== 0 || Math.abs(it.vx) + Math.abs(it.vy) > 1) {
          it.vz -= 800 * dt;
          it.z += it.vz * dt;
          if (it.z <= 0) {
            it.z = 0;
            it.vz = Math.abs(it.vz) > 120 ? -it.vz * 0.35 : 0;
          }
          w.move(it, it.vx * dt, it.vy * dt);
          const k = Math.exp(-3 * dt);
          it.vx *= k;
          it.vy *= k;
          if (Math.abs(it.vx) + Math.abs(it.vy) < 2) it.vx = it.vy = 0;
        }
        if (it.belt) {
          const b = it.belt;
          it.x += b.dir * b.speed * dt;
          if (it.x > b.x + b.w - 8) it.x = b.x + 12;
          if (it.x < b.x + 8) it.x = b.x + b.w - 12;
        }
        const d = G.dist(it.x, it.y, p.x, p.y);
        if (magnet && d < 340 && it.delay <= 0) {
          const pull = 420 * dt;
          it.belt = null;
          it.x += ((p.x - it.x) / d) * Math.min(pull, d);
          it.y += ((p.y - it.y) / d) * Math.min(pull, d);
          if (Math.random() < dt * 8) g.particles.add({ x: it.x, y: it.y - 10, kind: "star", size: 3, life: 0.3, color: "#ff8080" });
        }
        if (canPick && it.delay <= 0 && d < p.r + PICK_R + (it.type === "giant" ? 10 : 0)) g.collect(it);
        // Hidden loot twinkles now and then, so sharp eyes can spot it behind roofs.
        if (it.hidden) {
          it.sparkT -= dt;
          if (it.sparkT <= 0) {
            it.sparkT = G.rand(1.2, 2.4);
            if (g.onScreen(it.x, it.y)) g.particles.add({ x: it.x + G.rand(-8, 8), y: it.y - 30 - G.rand(0, 30), kind: "star", size: 6, life: 0.7, color: "#fff6a8", vy: -20 });
          }
        }
      }
      this.items = this.items.filter((i) => !i.collected || i.carriedBy);

      if (g.state === "play") {
        this.powerT -= dt;
        if (this.powerT <= 0) {
          this.powerT = G.rand(g.L.powerEvery[0], g.L.powerEvery[1]);
          if (this.powers.length < 2) this.spawnPower();
        }
      }
      for (const pw of this.powers) {
        pw.t += dt;
        pw.life -= dt;
        if (canPick && G.dist(pw.x, pw.y, p.x, p.y) < p.r + 24) {
          pw.life = -1;
          g.activatePower(pw.type, pw.x, pw.y);
        } else if (pw.life <= 0) {
          g.particles.puff(pw.x, pw.y - 20, 6, 6);
        }
      }
      this.powers = this.powers.filter((pw) => pw.life > 0);
    }

    drawables(list, view) {
      for (const it of this.items) {
        if (it.collected || it.carriedBy) continue;
        if (it.x < view.x - 60 || it.x > view.x + view.w + 60 || it.y < view.y - 60 || it.y > view.y + view.h + 100) continue;
        list.push({
          sortY: it.y,
          draw: (ctx) => {
            ctx.save();
            ctx.translate(it.x, it.y - it.z);
            const s = G.easeOutBack(it.pop);
            ctx.scale(s, s);
            if (it.life > 0 && it.life < 4 && Math.sin(it.t * 18) < 0) ctx.globalAlpha = 0.4;
            G.Art.item(ctx, it.type, it.v, it.t, it.z > 2);
            ctx.restore();
          },
        });
      }
      for (const pw of this.powers) {
        if (pw.x < view.x - 60 || pw.x > view.x + view.w + 60 || pw.y < view.y - 60 || pw.y > view.y + view.h + 100) continue;
        list.push({
          sortY: pw.y,
          draw: (ctx) => {
            ctx.save();
            ctx.translate(pw.x, pw.y);
            const fade = pw.life < 3 ? (Math.sin(pw.t * 16) > 0 ? 1 : 0.35) : 1;
            G.Art.powerup(ctx, pw.type, pw.t, fade);
            ctx.restore();
          },
        });
      }
    }
  }

  G.Loot = Loot;
})(window.GH);
