/*
 * ParticleSystem: a fixed pool, so nothing is allocated mid-fight. Dead particles
 * are swapped to the end of the live range, which makes both spawn and kill O(1).
 */
(function (J) {
  const { rand, pick } = J.U;
  const TAU = J.TAU;

  const CAPACITY = 900;
  const FLOATERS = 24;

  class ParticleSystem {
    constructor() {
      this.pool = Array.from({ length: CAPACITY }, () => ({
        x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0, life: 0, maxLife: 1,
        size: 2, grow: 0, color: "#fff", kind: 0, glow: false, rot: 0, spin: 0,
      }));
      this.live = 0;
      this.limit = CAPACITY;
      this.floaters = Array.from({ length: FLOATERS }, () => ({ alive: false, x: 0, y: 0, life: 0, text: "", color: "#fff", size: 14 }));
    }

    clear() {
      this.live = 0;
      for (const floater of this.floaters) floater.alive = false;
    }

    // kind: 0 round dot, 1 line streak, 2 square chip, 3 ring
    spawn(x, y, vx, vy, life, size, color, opts = {}) {
      if (this.live >= this.limit) return null;
      const p = this.pool[this.live++];
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life;
      p.size = size; p.color = color;
      p.gravity = opts.gravity || 0;
      p.drag = opts.drag || 0;
      p.grow = opts.grow || 0;
      p.kind = opts.kind || 0;
      p.glow = !!opts.glow;
      p.rot = opts.rot || 0;
      p.spin = opts.spin || 0;
      return p;
    }

    update(dt) {
      for (let i = this.live - 1; i >= 0; i--) {
        const p = this.pool[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.live--;
          this.pool[i] = this.pool[this.live];
          this.pool[this.live] = p;
          continue;
        }
        p.vy += p.gravity * dt;
        if (p.drag) {
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
        p.rot += p.spin * dt;
      }
      for (const f of this.floaters) {
        if (!f.alive) continue;
        f.life -= dt;
        f.y -= 34 * dt;
        if (f.life <= 0) f.alive = false;
      }
    }

    draw(ctx) {
      // Solid particles first, then the glowing ones added on top.
      for (const glowing of [false, true]) {
        if (glowing) ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < this.live; i++) {
          const p = this.pool[i];
          if (p.glow !== glowing) continue;
          const a = p.life / p.maxLife;
          ctx.globalAlpha = a < 0.5 ? a * 2 : 1;
          if (p.kind === 1) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
          } else if (p.kind === 2) {
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
          } else if (p.kind === 3) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(0.5, 3 * a);
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, TAU);
            ctx.stroke();
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.2, p.size), 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      ctx.textAlign = "center";
      for (const f of this.floaters) {
        if (!f.alive) continue;
        ctx.globalAlpha = Math.min(1, f.life * 2.5);
        ctx.font = `800 ${f.size}px ${J.FONT}`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,.7)";
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    }

    text(x, y, text, color = "#fff", size = 14) {
      const f = this.floaters.find((candidate) => !candidate.alive);
      if (!f) return;
      f.alive = true;
      f.x = x; f.y = y; f.text = text; f.color = color; f.size = size; f.life = 0.9;
    }

    // ---------- Ready-made effects ----------

    sparks(x, y, color, count = 10, power = 240) {
      for (let i = 0; i < count; i++) {
        const a = rand(TAU);
        const s = rand(power * 0.3, power);
        this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.4), rand(1, 2), i % 3 ? color : "#fff", { kind: 1, gravity: 500, glow: true, drag: 2 });
      }
    }

    hitFlash(x, y, color) {
      this.spawn(x, y, 0, 0, 0.14, 12, "#fff", { grow: 60, glow: true });
      this.spawn(x, y, 0, 0, 0.2, 7, color, { grow: 160, kind: 3, glow: true });
    }

    blood(x, y, dir) {
      // Stormtroopers don't bleed in this galaxy: scorch smoke and armor chips.
      for (let i = 0; i < 6; i++) {
        this.spawn(x, y, dir * rand(20, 160), rand(-140, 20), rand(0.25, 0.5), rand(2, 3.5), pick(["#ddd", "#aaa", "#444"]), { kind: 2, gravity: 620, spin: rand(-9, 9) });
      }
    }

    smoke(x, y, count = 5, color = "rgba(70,70,76,.7)") {
      for (let i = 0; i < count; i++) {
        this.spawn(x + rand(-8, 8), y + rand(-8, 8), rand(-24, 24), rand(-60, -14), rand(0.5, 1.1), rand(5, 10), color, { grow: 18 });
      }
    }

    explosion(x, y, scale = 1) {
      this.spawn(x, y, 0, 0, 0.22, 26 * scale, "#fff6d0", { grow: 240 * scale, glow: true });
      this.spawn(x, y, 0, 0, 0.42, 12 * scale, "#ffb24d", { grow: 320 * scale, kind: 3, glow: true });
      for (let i = 0; i < 26 * scale; i++) {
        const a = rand(TAU);
        const s = rand(50, 340) * scale;
        this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.75), rand(2, 6), pick(["#ffd76a", "#ff8a33", "#ff4a20", "#fff"]), { gravity: 240, drag: 2.2, glow: true });
      }
      for (let i = 0; i < 9 * scale; i++) {
        this.spawn(x, y, rand(-200, 200), rand(-300, -60), rand(0.5, 1), rand(3, 6), pick(["#3c4048", "#6a6f78", "#8c8f94"]), { kind: 2, gravity: 700, spin: rand(-11, 11) });
      }
      this.smoke(x, y, Math.ceil(7 * scale));
    }

    forceRing(x, y, color, size = 70) {
      this.spawn(x, y, 0, 0, 0.45, 12, color, { grow: size * 2, kind: 3, glow: true });
    }

    dust(x, y, color = "rgba(200,190,170,.55)", count = 5) {
      for (let i = 0; i < count; i++) {
        this.spawn(x + rand(-8, 8), y, rand(-70, 70), rand(-46, -6), rand(0.25, 0.5), rand(2, 4), color, { grow: 12 });
      }
    }
  }

  J.ParticleSystem = ParticleSystem;
})(window.JEDI);
