/*
 * Combat: pooled projectiles for heroes and enemies, melee hit boxes, beams and
 * area attacks, damage numbers, knockback, status effects (stun, freeze, slow, confuse),
 * and breaking crates and X-Seals.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const A = XM.Art;
  const T = XM.T;

  class Combat {
    constructor(world) {
      this.w = world;
      this.proj = [];
      for (let i = 0; i < 180; i++) this.proj.push({ alive: false, hit: new Set() });
    }

    clear() {
      for (const p of this.proj) p.alive = false;
    }

    // ---------- Damage ----------
    // Damage from the hero to one enemy. Returns true if it landed.
    hitEnemy(e, dmg, opts = {}, srcX) {
      const w = this.w;
      if (e.dead || e.invulnerable) return false;
      const pl = w.player;
      const dm = opts.noMult ? { m: 1, crit: false } : pl.damageMult();
      const final = Math.max(1, Math.round(dmg * dm.m));
      const sx = srcX !== undefined ? srcX : pl.cx;
      const res = e.takeDamage(final, opts, sx);
      if (!res) return false;
      const dealt = res.dealt;
      const killed = res.killed;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h * 0.4;
      if (!e.prop) {
        XM.FX.text(cx + U.rand(-8, 8), e.y - 4, dm.crit ? `${dealt}!` : String(dealt), dm.crit ? "#ffe14a" : res.blocked ? "#9aa4b8" : "#ffffff", dm.crit ? 20 : 15, 0.7);
        pl.onHit(dealt, killed);
      }
      XM.FX.burst(cx, cy, { count: opts.power ? 10 : 6, color: opts.color || "#fff3c4", speed: 220, life: 0.25, size: 2.5 });
      if (opts.hitstop !== 0) XM.FX.stop(opts.hitstop || (opts.power ? 0.05 : 0.025));
      XM.Audio.sfx(opts.heavy || opts.power ? "hitHeavy" : "hit");
      if (killed) w.onEnemyKilled(e, opts);
      return true;
    }

    // Hits every enemy overlapping a rectangle once. Also breaks crates (and X-Seals with power).
    melee(rect, dmg, opts = {}) {
      const w = this.w;
      let hits = 0;
      for (const e of w.enemies) {
        if (e.dead || !U.overlap(rect, e)) continue;
        if (this.hitEnemy(e, dmg, opts, rect.x + rect.w / 2 - (opts.dir || 0) * rect.w)) hits++;
      }
      this.breakTiles(rect, opts.power);
      if (XM.DEBUG) w.debugRects.push({ ...rect, t: 0.1 });
      return hits;
    }

    breakTiles(rect, power) {
      const w = this.w;
      XM.Collide.breakablesIn(w.level, rect, (tx, ty, code) => {
        if (code === XM.TILE.SEAL && !power) {
          if (!w.sealHintT) {
            w.sealHintT = 2.5;
            XM.FX.text(tx * T + T / 2, ty * T - 6, "Use a Special or Ultimate!", "#8fd0ff", 14, 1.2);
          }
          return;
        }
        w.breakTile(tx, ty, code);
      });
    }

    aoe(x, y, r, dmg, opts = {}) {
      let hits = 0;
      for (const e of this.w.enemies) {
        if (e.dead) continue;
        if (XM.Collide.circleRect(x, y, r, e) && this.hitEnemy(e, dmg, opts, x)) hits++;
      }
      this.breakTiles({ x: x - r * 0.7, y: y - r * 0.7, w: r * 1.4, h: r * 1.4 }, opts.power);
      return hits;
    }

    // Every enemy on screen (used by screen-wide Ultimates).
    onScreen() {
      const cam = this.w.cam;
      return this.w.enemies.filter((e) => !e.dead && !e.untargetable && cam.visible(e.x, e.y, e.w, e.h, 20));
    }

    // ---------- Projectiles ----------
    spawn(o) {
      const p = this.proj.find((q) => !q.alive);
      if (!p) return null;
      p.hit.clear();
      Object.assign(p, {
        alive: true,
        owner: "player",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 6,
        dmg: 10,
        kind: "psy",
        color: "#ffffff",
        life: 1.5,
        age: 0,
        pierce: false,
        homing: 0,
        grav: 0,
        explode: 0,
        kb: 120,
        stun: 0,
        freeze: 0,
        slow: 0,
        confuse: 0,
        power: false,
        ghost: false,
        reflected: false,
        spin: 0,
        trail: 0,
        delay: 0,
        target: null,
      }, o);
      return p;
    }

    shoot(o) {
      return this.spawn(Object.assign({ owner: "player" }, o));
    }

    enemyShoot(o) {
      return this.spawn(Object.assign({ owner: "enemy", kb: 200 }, o));
    }

    // A beam that lasts dur seconds and damages every tick. o.follow keeps it on the hero's eyes/hands.
    beam(o) {
      const w = this.w;
      const b = Object.assign({ t: 0, dur: 0.4, tick: 0.08, tickT: 0, len: 400, h: 30, dmg: 5, color: "#ff3b3b", core: "#fff4f0", dir: 1, offY: -0.62, offX: 10 }, o);
      w.addAction({
        update: (dt) => {
          b.t += dt;
          if (b.follow) {
            const p = b.follow;
            b.dir = p.facing;
            b.x = p.cx + p.facing * b.offX;
            b.y = p.y + p.h * (1 + b.offY);
          }
          b.tickT -= dt;
          if (b.tickT <= 0) {
            b.tickT = b.tick;
            const rect = { x: b.dir > 0 ? b.x : b.x - b.len, y: b.y - b.h / 2, w: b.len, h: b.h };
            for (const e of w.enemies) {
              if (!e.dead && U.overlap(rect, e)) this.hitEnemy(e, b.dmg, { kb: b.kb || 60, power: true, color: b.color, hitstop: 0, dir: b.dir }, b.x);
            }
            this.breakTiles(rect, true);
          }
          return b.t < b.dur;
        },
        draw: (ctx) => {
          const k = b.t / b.dur;
          const fade = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
          const h = b.h * (0.6 + 0.4 * fade) * (1 + Math.sin(b.t * 60) * 0.06);
          const x0 = b.x;
          const x1 = b.x + b.dir * b.len;
          ctx.globalAlpha = 0.45 * fade;
          ctx.fillStyle = b.color;
          ctx.fillRect(Math.min(x0, x1), b.y - h * 0.75, b.len, h * 1.5);
          ctx.globalAlpha = 0.9 * fade;
          ctx.fillRect(Math.min(x0, x1), b.y - h / 2, b.len, h);
          ctx.fillStyle = b.core;
          ctx.fillRect(Math.min(x0, x1), b.y - h * 0.18, b.len, h * 0.36);
          ctx.globalAlpha = 1;
          A.glow(ctx, x0, b.y, h * 1.4, b.color, fade);
          if (Math.random() < 0.7) XM.FX.spawn(XM.FX.T.SPARK, x0 + b.dir * Math.random() * b.len, b.y + U.rand(-h / 2, h / 2), b.dir * 300, U.rand(-80, 80), 0.25, 2, b.core);
        },
      });
      return b;
    }

    update(dt) {
      const w = this.w;
      const lv = w.level;
      const pl = w.player;
      for (const p of this.proj) {
        if (!p.alive) continue;
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        p.age += dt;
        if (p.age >= p.life) {
          this.expire(p);
          continue;
        }
        if (p.homing && p.owner === "player") {
          if (!p.target || p.target.dead) p.target = this.nearest(p.x, p.y, 420);
          if (p.target) {
            const tx = p.target.x + p.target.w / 2;
            const ty = p.target.y + p.target.h / 2;
            const sp = Math.hypot(p.vx, p.vy);
            const ang = Math.atan2(p.vy, p.vx);
            const want = Math.atan2(ty - p.y, tx - p.x);
            let d = want - ang;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const na = ang + U.clamp(d, -p.homing * dt, p.homing * dt);
            p.vx = Math.cos(na) * sp;
            p.vy = Math.sin(na) * sp;
          }
        }
        if (p.homing && p.owner === "enemy" && pl && !pl.dead) {
          const ang = Math.atan2(p.vy, p.vx);
          const want = Math.atan2(pl.cy - p.y, pl.cx - p.x);
          let d = want - ang;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const sp = Math.hypot(p.vx, p.vy);
          const na = ang + U.clamp(d, -p.homing * dt, p.homing * dt);
          p.vx = Math.cos(na) * sp;
          p.vy = Math.sin(na) * sp;
        }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.trail && Math.random() < p.trail) XM.FX.spawn(XM.FX.T.GLOW, p.x, p.y, 0, 0, 0.25, p.r * 1.6, p.color);
        // Walls
        if (!p.ghost && XM.Physics.solidAt(lv, p.x, p.y)) {
          if (p.owner === "player") this.breakTiles({ x: p.x - 6, y: p.y - 6, w: 12, h: 12 }, p.power);
          this.expire(p);
          continue;
        }
        if (p.y > lv.H * T + 100 || p.x < -100 || p.x > lv.W * T + 100) {
          p.alive = false;
          continue;
        }
        if (p.owner === "player") {
          for (const e of w.enemies) {
            if (e.dead || p.hit.has(e)) continue;
            if (!XM.Collide.circleRect(p.x, p.y, p.r, e)) continue;
            // Some bosses reflect projectiles while guarding.
            if (e.reflects && e.reflects(p)) {
              p.owner = "enemy";
              p.vx = -p.vx * 0.9;
              p.vy = -Math.abs(p.vy) - 60;
              p.reflected = true;
              XM.Audio.sfx("hit");
              break;
            }
            p.hit.add(e);
            this.hitEnemy(e, p.dmg, { kb: p.kb, stun: p.stun, freeze: p.freeze, slow: p.slow, confuse: p.confuse, power: p.power, color: p.color, dir: Math.sign(p.vx) || 1 }, p.x - Math.sign(p.vx || 1) * 20);
            if (!p.pierce) {
              this.expire(p);
              break;
            }
          }
        } else if (pl && !pl.dead && XM.Collide.circleRect(p.x, p.y, p.r, pl)) {
          if (pl.hurt(p.dmg, p.x - p.vx * 0.1)) {
            if (p.slow) w.slowPlayer(p.slow);
          }
          if (!p.pierce) this.expire(p);
        }
      }
    }

    nearest(x, y, range) {
      let best = null;
      let bd = range;
      for (const e of this.w.enemies) {
        if (e.dead || e.untargetable || e.prop) continue;
        const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      return best;
    }

    expire(p) {
      if (!p.alive) return;
      p.alive = false;
      if (p.explode) {
        if (p.owner === "player") this.aoe(p.x, p.y, p.explode, p.dmg * 0.6, { kb: 160, power: p.power, color: p.color });
        else if (this.w.player && XM.Collide.circleRect(p.x, p.y, p.explode, this.w.player)) this.w.player.hurt(p.dmg * 0.7, p.x);
        XM.FX.burst(p.x, p.y, { count: 14, colors: [p.color, "#ffffff", "#ffd27a"], speed: 240, life: 0.4 });
        XM.FX.ring(p.x, p.y, p.explode, p.color);
        XM.Audio.sfx(p.kind === "firework" ? "firework" : "explosion");
      } else {
        XM.FX.burst(p.x, p.y, { count: 5, color: p.color, speed: 120, life: 0.25 });
      }
    }

    draw(ctx) {
      const cam = this.w.cam;
      for (const p of this.proj) {
        if (!p.alive || p.delay > 0) continue;
        if (!cam.visible(p.x - 20, p.y - 20, 40, 40)) continue;
        DRAW[p.kind] ? DRAW[p.kind](ctx, p) : DRAW.orb(ctx, p);
      }
    }
  }

  const DRAW = {
    orb(ctx, p) {
      A.glow(ctx, p.x, p.y, p.r * 3, p.color, 0.8);
      A.circle(ctx, p.x, p.y, p.r, "#ffffff", false);
    },
    psy(ctx, p) {
      A.glow(ctx, p.x, p.y, p.r * 3.2, p.color, 0.9);
      A.circle(ctx, p.x, p.y, p.r * 0.9, "#fff0fb", false);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.6 + Math.sin(p.age * 30) * 2, 0, Math.PI * 2);
      ctx.stroke();
    },
    optic(ctx, p) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      A.glow(ctx, 0, 0, 22, "#ff3b3b", 0.9);
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(-26, -5, 34, 10);
      ctx.fillStyle = "#fff0e8";
      ctx.fillRect(-22, -2, 30, 4);
      ctx.restore();
    },
    wind(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(Math.sign(p.vx) || 1, 1);
      ctx.strokeStyle = "rgba(235,248,255,0.9)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-i * 7, 0, p.r + i * 3, -1.1, 1.1);
        ctx.stroke();
      }
      ctx.restore();
      A.glow(ctx, p.x, p.y, p.r * 2.5, "#dff4ff", 0.5);
    },
    card(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.age * 18);
      A.glow(ctx, 0, 0, 16, p.color, 0.9);
      A.box(ctx, -4, -6, 8, 12, "#fff5fb", true, 1.5, 1);
      ctx.fillStyle = "#c4161c";
      ctx.fillRect(-1.5, -2, 3, 4);
      ctx.restore();
    },
    ice(ctx, p) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      A.glow(ctx, 0, 0, 16, "#9fe6ff", 0.7);
      A.poly(ctx, [12, 0, 0, -5, -12, 0, 0, 5], "#dff7ff", true, 1.5);
      ctx.restore();
    },
    psyknife(ctx, p) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      A.glow(ctx, 0, 0, 24, p.color, 0.9);
      A.poly(ctx, [18, 0, -4, -7, -12, 0, -4, 7], "#ffd9fb", true, 1.5);
      ctx.restore();
    },
    firework(ctx, p) {
      A.glow(ctx, p.x, p.y, p.r * 3.4, p.color, 0.9);
      A.circle(ctx, p.x, p.y, p.r * 0.8, "#ffffff", false);
      if (Math.random() < 0.8) XM.FX.spawn(XM.FX.T.STAR, p.x, p.y, U.rand(-40, 40), U.rand(-40, 40), 0.35, 4, U.pick(["#ff5ad9", "#ffe14a", "#5ad9ff", "#ffffff"]));
    },
    xbolt(ctx, p) {
      A.glow(ctx, p.x, p.y, p.r * 3.4, p.color, 0.9);
      A.circle(ctx, p.x, p.y, p.r * 0.8, "#eaf8ff", false);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      ctx.stroke();
    },
    // ---- Enemy projectiles ----
    bullet(ctx, p) {
      A.glow(ctx, p.x, p.y, 10, "#ffcf5a", 0.7);
      ctx.fillStyle = "#fff1b0";
      ctx.fillRect(p.x - 4, p.y - 2, 8, 4);
    },
    laser(ctx, p) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      A.glow(ctx, 0, 0, 14, p.color, 0.8);
      ctx.fillStyle = p.color;
      ctx.fillRect(-14, -2.5, 22, 5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-12, -1, 18, 2);
      ctx.restore();
    },
    plasma(ctx, p) {
      A.glow(ctx, p.x, p.y, p.r * 3, p.color, 0.9);
      A.circle(ctx, p.x, p.y, p.r, A.shade(p.color, 0.6), true, 1.5);
    },
    fire(ctx, p) {
      const k = p.age / p.life;
      A.glow(ctx, p.x, p.y, p.r * (2 + k * 2), "#ff7a1a", 0.9 - k * 0.5);
      A.glow(ctx, p.x, p.y, p.r * 1.2, "#ffe07a", 0.9 - k * 0.6);
    },
    rock(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.age * 6);
      A.poly(ctx, [-p.r, -p.r * 0.4, -p.r * 0.3, -p.r, p.r * 0.7, -p.r * 0.7, p.r, p.r * 0.3, p.r * 0.2, p.r, -p.r * 0.8, p.r * 0.6], p.color || "#8a7a68", true, 2);
      ctx.restore();
    },
    crystal(ctx, p) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      A.glow(ctx, 0, 0, 14, p.color, 0.7);
      A.poly(ctx, [10, 0, 0, -5, -8, 0, 0, 5], p.color, true, 1.5);
      ctx.restore();
    },
    metal(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.age * 9);
      A.glow(ctx, 0, 0, 16, "#c08aff", 0.5);
      A.box(ctx, -p.r, -p.r * 0.35, p.r * 2, p.r * 0.7, "#9aa3b2", true, 1, 1.5);
      ctx.restore();
    },
    spore(ctx, p) {
      A.glow(ctx, p.x, p.y, p.r * 3, "#9aff5a", 0.6);
      A.circle(ctx, p.x, p.y, p.r * 0.7, "#d8ffb0", true, 1);
    },
    feather(ctx, p) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      A.glow(ctx, 0, 0, 18, "#ff6a1a", 0.9);
      A.poly(ctx, [12, 0, -4, -6, -12, 0, -4, 6], "#ffd23f", true, 1.5);
      ctx.restore();
    },
  };

  XM.Combat = Combat;
})(window.XM);
