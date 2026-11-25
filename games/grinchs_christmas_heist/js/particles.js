/*
 * Pooled particles (snow puffs, sparkles, confetti, stars, hearts), floating text in
 * world space, and the falling snow drawn over the whole view.
 */
(function (G) {
  "use strict";

  const MAX = 500;

  class Particles {
    constructor() {
      this.list = [];
      this.texts = [];
      this.flakes = [];
      for (let i = 0; i < 140; i++) this.flakes.push(this.newFlake(true));
    }

    clear() {
      this.list.length = 0;
      this.texts.length = 0;
    }

    add(p) {
      if (this.list.length >= MAX) this.list.shift();
      p.age = 0;
      p.life = p.life || 0.8;
      p.vx = p.vx || 0;
      p.vy = p.vy || 0;
      p.size = p.size || 4;
      p.grav = p.grav || 0;
      p.drag = p.drag == null ? 1.5 : p.drag;
      p.rot = p.rot || 0;
      p.spin = p.spin || 0;
      this.list.push(p);
    }

    burst(x, y, kind, count, opts = {}) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * G.TAU;
        const sp = (opts.speed || 120) * (0.3 + Math.random() * 0.7);
        const p = {
          x: x + (opts.spread ? G.rand(-opts.spread, opts.spread) : 0),
          y: y + (opts.spread ? G.rand(-opts.spread, opts.spread) * 0.6 : 0),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.7 - (opts.up || 0),
          kind,
          life: (opts.life || 0.7) * (0.6 + Math.random() * 0.6),
          size: (opts.size || 4) * (0.6 + Math.random() * 0.7),
          color: opts.colors ? G.pick(opts.colors) : opts.color || "#ffffff",
          grav: opts.grav || 0,
          rot: Math.random() * G.TAU,
          spin: G.rand(-8, 8),
        };
        this.add(p);
      }
    }

    sparkle(x, y, color) {
      this.burst(x, y, "star", 8, { speed: 140, life: 0.6, size: 5, colors: [color || "#fff6a8", "#ffffff", "#ffd23f"] });
    }

    puff(x, y, count = 6, size = 7) {
      this.burst(x, y, "puff", count, { speed: 60, life: 0.6, size, color: "#ffffff", spread: 8 });
    }

    confetti(x, y, count = 30) {
      this.burst(x, y, "confetti", count, {
        speed: 260,
        up: 140,
        grav: 360,
        life: 1.4,
        size: 5,
        colors: ["#ff4d6d", "#ffd23f", "#4cd964", "#5fd0ff", "#ff9f1c", "#c77dff"],
      });
    }

    text(x, y, str, color = "#ffffff", size = 24, life = 1.1) {
      this.texts.push({ x, y, str, color, size, life, age: 0 });
      if (this.texts.length > 40) this.texts.shift();
    }

    update(dt) {
      const list = this.list;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
          list.splice(i, 1);
          continue;
        }
        p.vy += p.grav * dt;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        if (!p.grav) p.vy *= k;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.age += dt;
        t.y -= 45 * dt;
        if (t.age >= t.life) this.texts.splice(i, 1);
      }
    }

    draw(ctx) {
      for (const p of this.list) {
        const f = 1 - p.age / p.life;
        ctx.globalAlpha = Math.min(1, f * 1.6);
        if (p.kind === "puff") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.4 - f * 0.6), 0, G.TAU);
          ctx.fill();
        } else if (p.kind === "star") {
          ctx.fillStyle = p.color;
          G.Art.star(ctx, p.x, p.y, p.size * (0.5 + f * 0.6), p.rot);
        } else if (p.kind === "confetti") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else if (p.kind === "heart") {
          ctx.fillStyle = p.color;
          G.Art.heart(ctx, p.x, p.y, p.size);
        } else if (p.kind === "dirt") {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * f, 0, G.TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    drawTexts(ctx) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const t of this.texts) {
        const k = t.age / t.life;
        const pop = k < 0.15 ? G.easeOutBack(k / 0.15) : 1;
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.font = `800 ${Math.round(t.size * pop)}px Oxanium, "Trebuchet MS", sans-serif`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(20, 30, 50, 0.85)";
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- Falling snow (screen space)

    newFlake(anywhere) {
      return {
        x: Math.random(),
        y: anywhere ? Math.random() : -0.05,
        r: 1 + Math.random() * 2.6,
        sp: 0.04 + Math.random() * 0.08,
        drift: Math.random() * G.TAU,
      };
    }

    updateSnow(dt, windX = 0) {
      for (let i = 0; i < this.flakes.length; i++) {
        const f = this.flakes[i];
        f.y += f.sp * dt;
        f.drift += dt;
        f.x += (Math.sin(f.drift) * 0.012 + windX) * dt;
        if (f.x < -0.02) f.x += 1.04;
        if (f.x > 1.02) f.x -= 1.04;
        if (f.y > 1.05) this.flakes[i] = this.newFlake(false);
      }
    }

    drawSnow(ctx, w, h) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      for (const f of this.flakes) {
        ctx.beginPath();
        ctx.arc(f.x * w, f.y * h, f.r, 0, G.TAU);
        ctx.fill();
      }
    }
  }

  G.Particles = Particles;
})(window.GH);
