/*
 * Pooled particles and floating text. Both reuse a fixed set of objects, so busy moments
 * (fireworks, sparkles, engine trails) never allocate new ones mid-game.
 */
(function (U) {
  "use strict";

  const MAX_PARTICLES = 700;
  const MAX_TEXTS = 48;

  class Particles {
    constructor() {
      this.pool = [];
      for (let i = 0; i < MAX_PARTICLES; i++) this.pool.push({ active: false });
      this.cursor = 0;
      this.count = 0;
    }

    // Reuses the next free slot, or the oldest one when the pool is full.
    emit(o) {
      let p = null;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const idx = (this.cursor + i) % MAX_PARTICLES;
        if (!this.pool[idx].active) {
          p = this.pool[idx];
          this.cursor = (idx + 1) % MAX_PARTICLES;
          break;
        }
      }
      if (!p) {
        p = this.pool[this.cursor];
        this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      }
      p.active = true;
      p.x = o.x;
      p.y = o.y;
      p.vx = o.vx || 0;
      p.vy = o.vy || 0;
      p.life = p.max = o.life || 0.6;
      p.size = o.size || 4;
      p.color = o.color || "#fff";
      p.gravity = o.gravity || 0;
      p.drag = o.drag == null ? 1 : o.drag;
      p.kind = o.kind || "circle";
      p.rot = o.rot || Math.random() * U.TAU;
      p.vr = o.vr || 0;
      p.grow = o.grow || 0;
      p.alpha = o.alpha == null ? 1 : o.alpha;
      p.screen = !!o.screen;
      return p;
    }

    burst(x, y, count, o) {
      for (let i = 0; i < count; i++) {
        const a = o.angle == null ? Math.random() * U.TAU : o.angle + U.rand(-o.spread, o.spread);
        const s = U.rand(o.speedMin || 40, o.speed || 160);
        this.emit({
          x: x + U.rand(-(o.jitter || 0), o.jitter || 0),
          y: y + U.rand(-(o.jitter || 0), o.jitter || 0),
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: U.rand(o.lifeMin || (o.life || 0.6) * 0.6, o.life || 0.6),
          size: U.rand(o.sizeMin || (o.size || 4) * 0.6, o.size || 4),
          color: Array.isArray(o.color) ? U.pick(o.color) : o.color,
          gravity: o.gravity,
          drag: o.drag,
          kind: o.kind,
          vr: o.vr ? U.rand(-o.vr, o.vr) : 0,
          grow: o.grow,
          alpha: o.alpha,
          screen: o.screen,
        });
      }
    }

    sparkle(x, y, count = 10, color = ["#fff", "#aaffee", "#ffe36b"]) {
      this.burst(x, y, count, { speed: 140, life: 0.6, size: 6, color, kind: "star", drag: 0.9, vr: 6 });
    }

    smoke(x, y, count = 6, color = "rgba(120,110,130,0.7)") {
      this.burst(x, y, count, { speed: 50, life: 0.9, size: 14, color, kind: "smoke", drag: 0.92, gravity: -40, grow: 18, jitter: 8 });
    }

    confetti(x, y, count = 30) {
      this.burst(x, y, count, {
        speed: 320, speedMin: 120, life: 1.6, size: 7, kind: "confetti", gravity: 260, drag: 0.97, vr: 10,
        color: ["#ff5fb4", "#8dff5a", "#ffd23f", "#5fd0ff", "#c08cff", "#ff8a3d"],
      });
    }

    firework(x, y, color, screen = false) {
      const colors = color ? [color, "#ffffff"] : ["#ff5fb4", "#ffd23f", "#8dff5a", "#5fd0ff", "#c08cff"];
      const n = 34;
      const main = Array.isArray(colors) ? U.pick(colors) : colors;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * U.TAU;
        const s = U.rand(160, 260);
        this.emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.9, 1.4), size: 4, color: i % 3 === 0 ? "#fff" : main, gravity: 90, drag: 0.95, kind: "spark", screen });
      }
    }

    clear() {
      for (const p of this.pool) p.active = false;
    }

    update(dt) {
      let count = 0;
      for (const p of this.pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        count++;
        const drag = Math.pow(p.drag, dt * 60);
        p.vx *= drag;
        p.vy = p.vy * drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.size = Math.max(0.1, p.size + p.grow * dt);
      }
      this.count = count;
    }

    draw(ctx, screen = false) {
      for (const p of this.pool) {
        if (!p.active || p.screen !== screen) continue;
        const t = p.life / p.max;
        ctx.globalAlpha = p.alpha * Math.min(1, t * 2.5);
        ctx.fillStyle = p.color;
        switch (p.kind) {
          case "star":
            drawStar(ctx, p.x, p.y, p.size * (0.5 + t * 0.5), p.rot);
            break;
          case "spark": {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * 0.6;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
            ctx.stroke();
            break;
          }
          case "confetti":
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 + Math.abs(Math.sin(p.rot * 2)) * p.size * 0.5);
            ctx.restore();
            break;
          case "smoke":
            ctx.globalAlpha *= 0.7;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, U.TAU);
            ctx.fill();
            break;
          case "ring":
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, U.TAU);
            ctx.stroke();
            break;
          default:
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, U.TAU);
            ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawStar(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * U.TAU;
      const rr = i % 2 === 0 ? r : r * 0.4;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  // World-space pop-up text, like "+200".
  class FloatTexts {
    constructor() {
      this.pool = [];
      for (let i = 0; i < MAX_TEXTS; i++) this.pool.push({ active: false });
    }

    add(x, y, text, o = {}) {
      let t = this.pool.find((p) => !p.active);
      if (!t) t = this.pool.reduce((a, b) => (a.life < b.life ? a : b));
      t.active = true;
      t.x = x;
      t.y = y;
      t.text = text;
      t.color = o.color || "#ffe36b";
      t.size = o.size || 26;
      t.life = t.max = o.life || 1.1;
      t.vy = o.vy == null ? -70 : o.vy;
      return t;
    }

    clear() {
      for (const t of this.pool) t.active = false;
    }

    update(dt) {
      for (const t of this.pool) {
        if (!t.active) continue;
        t.life -= dt;
        if (t.life <= 0) t.active = false;
        t.y += t.vy * dt;
        t.vy *= Math.pow(0.9, dt * 60);
      }
    }

    draw(ctx) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const t of this.pool) {
        if (!t.active) continue;
        const age = t.max - t.life;
        const pop = age < 0.15 ? U.easeOutBack(age / 0.15) : 1;
        ctx.globalAlpha = Math.min(1, t.life * 3);
        ctx.font = `800 ${Math.max(2, Math.round(t.size * pop))}px Oxanium, sans-serif`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#1d1433";
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  U.Particles = Particles;
  U.FloatTexts = FloatTexts;
  U.drawStar = drawStar;
})(window.UFO);
