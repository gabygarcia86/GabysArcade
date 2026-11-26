/*
 * Effects: pooled particles and floating text, screen shake, flashes and hit-stop.
 * Pools are allocated once, so busy fights create no garbage.
 */
(function (XM) {
  "use strict";
  const Art = () => XM.Art;

  const P_DOT = 0;
  const P_SPARK = 1;
  const P_SMOKE = 2;
  const P_RING = 3;
  const P_SHARD = 4;
  const P_STAR = 5;
  const P_GLOW = 6;

  class Particle {
    constructor() {
      this.alive = false;
    }
  }

  const FX = {
    T: { DOT: P_DOT, SPARK: P_SPARK, SMOKE: P_SMOKE, RING: P_RING, SHARD: P_SHARD, STAR: P_STAR, GLOW: P_GLOW },
    pool: [],
    texts: [],
    max: 700,
    shakeAmt: 0,
    shakeTime: 0,
    shakeX: 0,
    shakeY: 0,
    flashColor: "#fff",
    flashAlpha: 0,
    flashDecay: 2,
    hitstop: 0,
    shakeEnabled: true,

    init() {
      for (let i = 0; i < this.max; i++) this.pool.push(new Particle());
      for (let i = 0; i < 60; i++) this.texts.push({ alive: false });
    },

    setQuality(q) {
      this.limit = q === "low" ? 220 : q === "medium" ? 450 : this.max;
    },

    clear() {
      for (const p of this.pool) p.alive = false;
      for (const t of this.texts) t.alive = false;
      this.shakeAmt = this.flashAlpha = this.hitstop = 0;
    },

    spawn(type, x, y, vx, vy, life, size, color, grav = 0, drag = 0) {
      const limit = this.limit || this.max;
      let p = null;
      for (let i = 0; i < limit; i++) {
        const c = this.pool[(this.cursor = ((this.cursor || 0) + 1) % limit)];
        if (!c.alive) {
          p = c;
          break;
        }
      }
      if (!p) return null;
      p.alive = true;
      p.type = type;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = p.max = life;
      p.size = size;
      p.color = color;
      p.grav = grav;
      p.drag = drag;
      p.rot = Math.random() * 6.28;
      p.spin = (Math.random() - 0.5) * 10;
      return p;
    },

    // A spray of particles. o: {count, color, colors, speed, life, size, type, grav, spread, angle}
    burst(x, y, o = {}) {
      const n = o.count || 12;
      for (let i = 0; i < n; i++) {
        const ang = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2;
        const sp = (o.speed || 200) * (0.35 + Math.random() * 0.65);
        const col = o.colors ? o.colors[i % o.colors.length] : o.color || "#fff";
        this.spawn(o.type !== undefined ? o.type : P_SPARK, x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, (o.life || 0.5) * (0.6 + Math.random() * 0.6), (o.size || 3) * (0.6 + Math.random() * 0.8), col, o.grav || 0, o.drag || 2);
      }
    },
    ring(x, y, radius, color, life = 0.35, width = 4) {
      const p = this.spawn(P_RING, x, y, 0, 0, life, radius, color);
      if (p) p.width = width;
    },
    smoke(x, y, count = 6, color = "#77777a") {
      for (let i = 0; i < count; i++) this.spawn(P_SMOKE, x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 60, -30 - Math.random() * 60, 0.8 + Math.random() * 0.5, 8 + Math.random() * 10, color, -20, 1);
    },
    glowPuff(x, y, color, size = 30, life = 0.3) {
      this.spawn(P_GLOW, x, y, 0, 0, life, size, color);
    },
    text(x, y, str, color = "#fff", size = 18, life = 0.9, vy = -70) {
      const t = this.texts.find((tt) => !tt.alive);
      if (!t) return;
      Object.assign(t, { alive: true, x, y, str, color, size, life, max: life, vy });
    },
    shake(amount, time = 0.25) {
      if (!this.shakeEnabled) return;
      this.shakeAmt = Math.max(this.shakeAmt, Math.min(amount, 14));
      this.shakeTime = Math.max(this.shakeTime, time);
    },
    flash(color, alpha = 0.5, decay = 2.5) {
      this.flashColor = color;
      this.flashAlpha = Math.max(this.flashAlpha, alpha);
      this.flashDecay = decay;
    },
    stop(time) {
      this.hitstop = Math.max(this.hitstop, time);
    },

    update(dt) {
      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        const a = this.shakeAmt * Math.min(1, this.shakeTime * 4);
        this.shakeX = (Math.random() - 0.5) * 2 * a;
        this.shakeY = (Math.random() - 0.5) * 2 * a;
        if (this.shakeTime <= 0) this.shakeAmt = this.shakeX = this.shakeY = 0;
      }
      if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * this.flashDecay);
      const limit = this.limit || this.max;
      for (let i = 0; i < limit; i++) {
        const p = this.pool[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          continue;
        }
        p.vy += p.grav * dt;
        if (p.drag) {
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
      for (const t of this.texts) {
        if (!t.alive) continue;
        t.life -= dt;
        t.y += t.vy * dt;
        t.vy *= 1 - 2 * dt;
        if (t.life <= 0) t.alive = false;
      }
    },

    draw(ctx, cam) {
      const A = Art();
      const limit = this.limit || this.max;
      const vx0 = cam.x - 60;
      const vx1 = cam.x + XM.VIEW.w + 60;
      for (let i = 0; i < limit; i++) {
        const p = this.pool[i];
        if (!p.alive || p.x < vx0 || p.x > vx1) continue;
        const k = p.life / p.max;
        switch (p.type) {
          case P_DOT:
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            break;
          case P_SPARK: {
            ctx.globalAlpha = Math.min(1, k * 1.5);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * k + 0.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
            break;
          }
          case P_SMOKE:
            ctx.globalAlpha = k * 0.45;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, 6.283);
            ctx.fill();
            break;
          case P_RING:
            ctx.globalAlpha = k;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = (p.width || 4) * k + 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1.15 - k * 0.85) + 2, 0, 6.283);
            ctx.stroke();
            break;
          case P_SHARD:
            ctx.globalAlpha = Math.min(1, k * 2);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
            ctx.restore();
            break;
          case P_STAR: {
            ctx.globalAlpha = Math.min(1, k * 2);
            const s = p.size * (0.5 + k * 0.5);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s * 0.3, p.y - s * 0.3);
            ctx.lineTo(p.x + s, p.y);
            ctx.lineTo(p.x + s * 0.3, p.y + s * 0.3);
            ctx.lineTo(p.x, p.y + s);
            ctx.lineTo(p.x - s * 0.3, p.y + s * 0.3);
            ctx.lineTo(p.x - s, p.y);
            ctx.lineTo(p.x - s * 0.3, p.y - s * 0.3);
            ctx.fill();
            break;
          }
          case P_GLOW:
            A.glow(ctx, p.x, p.y, p.size * (1.4 - k * 0.4), p.color, k);
            break;
        }
      }
      ctx.globalAlpha = 1;
      for (const t of this.texts) {
        if (!t.alive) continue;
        const k = t.life / t.max;
        ctx.globalAlpha = Math.min(1, k * 3);
        const pop = 1 + Math.max(0, (k - 0.8) * 2.5);
        A.text(ctx, t.str, t.x, t.y, t.size * pop, t.color, "center");
      }
      ctx.globalAlpha = 1;
    },

    drawScreen(ctx) {
      if (this.flashAlpha > 0) {
        ctx.globalAlpha = this.flashAlpha;
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, XM.VIEW.w, XM.VIEW.h);
        ctx.globalAlpha = 1;
      }
    },
  };

  XM.FX = FX;
})(window.XM);
