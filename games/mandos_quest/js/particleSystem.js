/* Fixed-size particle pool. Nothing is allocated while the game is running. */
(function (MQ) {
  const { rand, glow, lerp } = MQ.U;
  const TAU = MQ.TAU;
  const MAX = { high: 700, low: 260 };
  const MAX_LABELS = 24;

  const DOT = 0;
  const SPARK = 1;
  const SMOKE = 2;
  const CHUNK = 3;
  const RING = 4;
  const FLAME = 5;
  const GLOW = 6;

  class ParticleSystem {
    constructor(quality = "high") {
      this.items = Array.from({ length: MAX.high }, () => ({
        life: 0, max: 1, kind: DOT, x: 0, y: 0, vx: 0, vy: 0, size: 1, end: 1, color: "#ffffff", gravity: 0, drag: 0, angle: 0, spin: 0,
      }));
      this.labels = Array.from({ length: MAX_LABELS }, () => ({ life: 0, x: 0, y: 0, text: "", color: "#fff", size: 18 }));
      this.next = 0;
      this.nextLabel = 0;
      this.setQuality(quality);
    }

    setQuality(quality) {
      this.limit = MAX[quality] || MAX.high;
      this.density = quality === "low" ? 0.45 : 1;
      this.next = 0;
    }

    emit(kind, x, y, vx, vy, life, size, color, gravity = 0, drag = 0, end = 0) {
      const p = this.items[this.next];
      this.next = (this.next + 1) % this.limit;
      p.kind = kind;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = p.max = life;
      p.size = size;
      p.end = end;
      p.color = color;
      p.gravity = gravity;
      p.drag = drag;
      p.angle = Math.random() * TAU;
      p.spin = rand(-7, 7);
    }

    count(n) {
      return Math.max(1, Math.round(n * this.density));
    }

    sparks(x, y, color, amount = 8, speed = 320) {
      for (let i = this.count(amount); i--;) {
        const a = Math.random() * TAU;
        const v = rand(speed * 0.3, speed);
        this.emit(SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.4), rand(1.4, 3), color, 420, 3);
      }
    }

    dust(x, y, color = "#b59c7c", amount = 6, spread = 110) {
      for (let i = this.count(amount); i--;) {
        this.emit(SMOKE, x + rand(-10, 10), y - 3, rand(-spread, spread), rand(-55, -8), rand(0.3, 0.6), rand(4, 8), color, 0, 3, rand(12, 20));
      }
    }

    smoke(x, y, color = "#4b4b55", amount = 1, size = 10) {
      for (let i = this.count(amount); i--;) {
        this.emit(SMOKE, x, y, rand(-25, 25), rand(-70, -25), rand(0.5, 1), size, color, -30, 1, size * 2.6);
      }
    }

    chunks(x, y, color, amount = 10, speed = 330) {
      for (let i = this.count(amount); i--;) {
        this.emit(CHUNK, x + rand(-12, 12), y + rand(-12, 12), rand(-speed, speed), rand(-speed * 1.2, speed * 0.2), rand(0.5, 1), rand(4, 11), color, 1250, 0.5);
      }
    }

    ring(x, y, radius, color, life = 0.4, start = 4) {
      this.emit(RING, x, y, 0, 0, life, start, color, 0, 0, radius);
    }

    flash(x, y, radius, color, life = 0.15) {
      this.emit(GLOW, x, y, 0, 0, life, radius, color, 0, 0, radius * 0.3);
    }

    flame(x, y, vx, vy, size = 11, life = 0.3) {
      this.emit(FLAME, x, y, vx, vy, life, size, "#ff9a30", -120, 1.5, size * 0.3);
    }

    mote(x, y, vx, vy, color, life = 0.7, size = 3) {
      this.emit(DOT, x, y, vx, vy, life, size, color, 0, 1.2);
    }

    explosion(x, y, size = 1) {
      this.flash(x, y, 150 * size, "#ffb04d", 0.3);
      this.ring(x, y, 110 * size, "#ffd79a", 0.35);
      for (let i = this.count(16 * size); i--;) {
        const a = Math.random() * TAU;
        const v = rand(60, 330) * size;
        this.flame(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(10, 24) * size, rand(0.25, 0.55));
      }
      this.sparks(x, y, "#ffd36b", 14 * size, 520);
      this.smoke(x, y, "#3c383c", 5 * size, 18 * size);
      this.chunks(x, y, "#45454d", 7 * size);
    }

    label(x, y, text, color = "#ffffff", size = 18) {
      const l = this.labels[this.nextLabel];
      this.nextLabel = (this.nextLabel + 1) % MAX_LABELS;
      l.life = 0.9;
      l.x = x;
      l.y = y;
      l.text = text;
      l.color = color;
      l.size = size;
    }

    update(dt) {
      for (let i = 0; i < this.items.length; i++) {
        const p = this.items[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vy += p.gravity * dt;
        if (p.drag) {
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
      }
      for (let i = 0; i < MAX_LABELS; i++) {
        const l = this.labels[i];
        if (l.life > 0) {
          l.life -= dt;
          l.y -= dt * 48;
        }
      }
    }

    draw(ctx, camera) {
      ctx.save();
      for (let i = 0; i < this.items.length; i++) {
        const p = this.items[i];
        if (p.life <= 0 || !camera.sees(p.x, p.y, 200)) continue;
        const remaining = p.life / p.max;
        const t = 1 - remaining;
        const size = Math.max(0.2, lerp(p.size, p.end, p.kind === RING ? 1 - remaining * remaining : t));
        ctx.globalAlpha = Math.min(1, remaining * 1.7);
        switch (p.kind) {
          case DOT:
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * remaining + 0.3, 0, TAU);
            ctx.fill();
            break;
          case SPARK:
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
            break;
          case SMOKE:
            ctx.globalAlpha = remaining * 0.4;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, TAU);
            ctx.fill();
            break;
          case CHUNK: {
            const c = Math.cos(p.angle) * p.size * 0.6;
            const s = Math.sin(p.angle) * p.size * 0.6;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x + c, p.y + s);
            ctx.lineTo(p.x - s * 0.8, p.y + c * 0.8);
            ctx.lineTo(p.x - c, p.y - s * 0.5);
            ctx.lineTo(p.x + s, p.y - c);
            ctx.fill();
            break;
          }
          case RING:
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1 + remaining * 5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, TAU);
            ctx.stroke();
            break;
          case FLAME:
            glow(ctx, p.x, p.y, size * 2.3, t < 0.3 ? "#ffd36b" : t < 0.65 ? "#ff7a22" : "#b8331c", 0.85);
            ctx.fillStyle = t < 0.25 ? "#fff3bd" : t < 0.6 ? "#ffab3c" : "#d9481f";
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 0.55, 0, TAU);
            ctx.fill();
            break;
          case GLOW:
            glow(ctx, p.x, p.y, size, p.color, 1);
            break;
        }
      }
      ctx.restore();
    }

    drawLabels(ctx) {
      for (let i = 0; i < MAX_LABELS; i++) {
        const l = this.labels[i];
        if (l.life <= 0) continue;
        ctx.globalAlpha = Math.min(1, l.life * 2.5);
        MQ.U.text(ctx, l.text, l.x, l.y, l.size, l.color, "center", 800);
      }
      ctx.globalAlpha = 1;
    }
  }

  ParticleSystem.KIND = { DOT, SPARK, SMOKE, CHUNK };
  MQ.ParticleSystem = ParticleSystem;
})(window.MQ);
