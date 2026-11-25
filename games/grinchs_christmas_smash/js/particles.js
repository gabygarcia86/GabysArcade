/*
 * Particles (shards, confetti, splinters, snow puffs, sparks), floating score text,
 * shockwave rings and the gently falling snow. Everything is in world units.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const TAU = Math.PI * 2;
  const MAX = 900;
  const BRIGHT = ["#ff4b5c", "#ffd23f", "#4be37a", "#3fb7ff", "#ff7ad9", "#9b4dff", "#ff9f1c", "#ffffff"];

  class Particles {
    constructor() {
      this.list = [];
      this.texts = [];
      this.rings = [];
      this.flakes = [];
      for (let i = 0; i < 140; i++) this.flakes.push(this.newFlake(true));
    }

    clear() {
      this.list.length = 0;
      this.texts.length = 0;
      this.rings.length = 0;
    }

    newFlake(anywhere) {
      return {
        x: G.rand(-300, G.WORLD_W + 300),
        y: anywhere ? G.rand(-300, G.GROUND_Y) : G.rand(-340, -300),
        r: G.rand(1.2, 3.6),
        vy: G.rand(26, 70),
        sway: G.rand(0, TAU),
        swaySpeed: G.rand(0.6, 1.8),
      };
    }

    add(p) {
      if (this.list.length >= MAX) this.list.shift();
      p.max = p.life;
      this.list.push(p);
    }

    // One preset burst at (x, y). `color` tints shards; `power` scales speed and count.
    burst(kind, x, y, opts = {}) {
      const power = opts.power || 1;
      const color = opts.color || "#ffffff";
      const n = Math.round((opts.count || 14) * Math.min(2, power));
      const sp = (a, b) => G.rand(a, b) * power;
      const dir = () => G.rand(0, TAU);
      const spray = (count, make) => {
        for (let i = 0; i < count; i++) {
          const a = dir();
          const s = make.speed ? make.speed() : sp(120, 420);
          this.add({
            x: x + G.rand(-8, 8),
            y: y + G.rand(-8, 8),
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s - (make.up || 160),
            rot: G.rand(0, TAU),
            vr: G.rand(-14, 14),
            life: make.life ? make.life() : G.rand(0.6, 1.2),
            size: make.size(),
            color: make.color(),
            shape: make.shape,
            g: make.g == null ? 900 : make.g,
            drag: make.drag || 0.6,
          });
        }
      };
      switch (kind) {
        case "glass":
          spray(n + 6, { size: () => G.rand(4, 10), color: () => (Math.random() < 0.3 ? "#ffffff" : color), shape: "tri" });
          spray(6, { size: () => G.rand(4, 8), color: () => "#ffffff", shape: "spark", g: 200, life: () => G.rand(0.4, 0.8) });
          break;
        case "confetti":
          spray(n + 8, { size: () => G.rand(5, 9), color: () => G.pick(BRIGHT), shape: "rect", g: 380, drag: 2.2, life: () => G.rand(1, 1.8) });
          spray(4, { size: () => G.rand(10, 16), color: () => color, shape: "ribbon", g: 420, drag: 2, life: () => G.rand(0.9, 1.4) });
          break;
        case "goldConfetti":
          spray(n + 14, { size: () => G.rand(5, 10), color: () => (Math.random() < 0.6 ? "#ffd23f" : "#fff3a8"), shape: "rect", g: 300, drag: 2, life: () => G.rand(1.2, 2) });
          spray(10, { size: () => G.rand(6, 11), color: () => "#ffe066", shape: "star", g: 200, drag: 1.5, life: () => G.rand(1, 1.6) });
          break;
        case "wood":
          spray(n, { size: () => G.rand(6, 16), color: () => G.pick(["#c98a4b", "#a8692f", "#e0b07a"]), shape: "splinter" });
          break;
        case "ice":
          spray(n + 4, { size: () => G.rand(5, 12), color: () => G.pick(["#dff7ff", "#9fdcf5", "#ffffff"]), shape: "tri" });
          break;
        case "snow":
          spray(n, { size: () => G.rand(8, 18), color: () => "#ffffff", shape: "puff", g: 220, drag: 2.6, life: () => G.rand(0.6, 1.1), speed: () => sp(60, 260) });
          spray(n, { size: () => G.rand(2, 5), color: () => "#ffffff", shape: "circle", g: 500 });
          break;
        case "needles":
          spray(n + 10, { size: () => G.rand(6, 12), color: () => G.pick(["#2fa34d", "#1c6b33", "#38b85a"]), shape: "needle" });
          spray(8, { size: () => G.rand(4, 7), color: () => G.pick(BRIGHT), shape: "circle" });
          break;
        case "crumbs":
          spray(n + 6, { size: () => G.rand(3, 8), color: () => G.pick(["#b8733b", "#9a5a2a", "#d08a4a"]), shape: "circle" });
          spray(6, { size: () => G.rand(3, 6), color: () => "#ffffff", shape: "rect" });
          break;
        case "candy":
          spray(n + 4, { size: () => G.rand(5, 10), color: () => G.pick(["#e0303a", "#ffffff", "#2fae5c"]), shape: "rect" });
          break;
        case "cloth":
          spray(n, { size: () => G.rand(5, 10), color: () => G.pick([color, "#ffffff", "#2fbf71"]), shape: "puff", g: 320, drag: 2 });
          break;
        case "gold":
          spray(n + 6, { size: () => G.rand(5, 10), color: () => G.pick(["#ffd23f", "#fff3a8", "#e09a10"]), shape: "star", g: 500 });
          break;
        case "sparks":
          spray(n, { size: () => G.rand(3, 6), color: () => G.pick(["#fff6a0", "#ffd23f", "#ff9f1c"]), shape: "spark", g: 300, life: () => G.rand(0.3, 0.6) });
          break;
        case "boom": {
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * TAU;
            const s = G.rand(260, 620) * power;
            this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: 0, vr: 0, life: G.rand(0.5, 0.9), size: G.rand(16, 30) * power, color: "#ffffff", shape: "puff", g: 120, drag: 3.2 });
          }
          spray(18, { size: () => G.rand(4, 8), color: () => G.pick(["#fff6a0", "#ffd23f", "#ff9f1c"]), shape: "spark", g: 200, life: () => G.rand(0.3, 0.7), speed: () => sp(300, 700) });
          this.ring(x, y, 10, 230 * power, "rgba(255,255,255,0.9)", 0.45, 14);
          break;
        }
        case "rainbow":
          spray(n, { size: () => G.rand(4, 8), color: () => G.pick(BRIGHT), shape: "star", g: 250, drag: 1.4 });
          break;
        default:
          spray(n, { size: () => G.rand(3, 7), color: () => color, shape: "circle" });
      }
    }

    // A trail puff behind a moving snowball.
    trail(x, y, color, size = 6) {
      this.add({ x, y, vx: G.rand(-20, 20), vy: G.rand(-20, 20), rot: 0, vr: 0, life: 0.35, size, color, shape: "puff", g: 0, drag: 1 });
    }

    // Floating text, e.g. "+150".
    text(x, y, str, opts = {}) {
      this.texts.push({
        x,
        y,
        str,
        color: opts.color || "#ffffff",
        stroke: opts.stroke || "#1d2a4a",
        size: opts.size || 30,
        life: opts.life || 1.1,
        max: opts.life || 1.1,
        vy: opts.vy == null ? -70 : opts.vy,
        pop: 0,
      });
      if (this.texts.length > 60) this.texts.shift();
    }

    ring(x, y, r0, r1, color, life, width = 8) {
      this.rings.push({ x, y, r0, r1, color, life, max: life, width });
    }

    update(dt) {
      const list = this.list;
      let w = 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        const d = 1 / (1 + p.drag * dt);
        p.vx *= d;
        p.vy = p.vy * d + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        // Bits bounce once off the ground and settle.
        if (p.y > G.GROUND_Y - 2 && p.vy > 0 && p.shape !== "puff") {
          p.y = G.GROUND_Y - 2;
          p.vy *= -0.3;
          p.vx *= 0.6;
          p.vr *= 0.5;
        }
        list[w++] = p;
      }
      list.length = w;
      for (const t of this.texts) {
        t.life -= dt;
        t.pop = Math.min(1, t.pop + dt * 6);
        t.y += t.vy * dt;
        t.vy *= 1 / (1 + dt * 1.5);
      }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const r of this.rings) r.life -= dt;
      this.rings = this.rings.filter((r) => r.life > 0);
      for (const f of this.flakes) {
        f.sway += f.swaySpeed * dt;
        f.y += f.vy * dt;
        f.x += Math.sin(f.sway) * 18 * dt;
        if (f.y > G.GROUND_Y + 10) Object.assign(f, this.newFlake(false));
      }
    }

    draw(ctx) {
      for (const r of this.rings) {
        const k = 1 - r.life / r.max;
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = r.width * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * G.easeOutCubic(k), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const p of this.list) {
        const a = Math.min(1, p.life / (p.max * 0.4));
        ctx.globalAlpha = a;
        const s = p.size;
        switch (p.shape) {
          case "puff":
            Art.circle(ctx, p.x, p.y, s * (1.2 - a * 0.4), p.color);
            break;
          case "circle":
            Art.circle(ctx, p.x, p.y, s * 0.5, p.color);
            break;
          case "spark":
            Art.sparkle(ctx, p.x, p.y, s, p.color);
            break;
          case "star":
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            Art.starPath(ctx, 0, 0, s * 0.7);
            ctx.fill();
            ctx.restore();
            break;
          default:
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            if (p.shape === "tri") {
              ctx.beginPath();
              ctx.moveTo(0, -s * 0.6);
              ctx.lineTo(s * 0.55, s * 0.45);
              ctx.lineTo(-s * 0.5, s * 0.35);
              ctx.closePath();
              ctx.fill();
            } else if (p.shape === "splinter" || p.shape === "needle") {
              ctx.fillRect(-s / 2, -s * 0.1, s, s * 0.2);
            } else if (p.shape === "ribbon") {
              ctx.strokeStyle = p.color;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(-s / 2, 0);
              ctx.bezierCurveTo(-s / 6, -s / 3, s / 6, s / 3, s / 2, 0);
              ctx.stroke();
            } else {
              ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
            }
            ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }

    drawTexts(ctx, k = 1) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const t of this.texts) {
        const a = Math.min(1, t.life / (t.max * 0.35));
        const sc = G.easeOutBack(t.pop) * k;
        ctx.globalAlpha = a;
        ctx.font = `900 ${Math.round(t.size * sc)}px Oxanium, "Trebuchet MS", sans-serif`;
        ctx.lineWidth = Math.max(3, t.size * 0.2 * k);
        ctx.strokeStyle = t.stroke;
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }

    drawSnow(ctx) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      for (const f of this.flakes) {
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, TAU);
      }
      ctx.fill();
    }
  }

  G.Particles = Particles;
})(window.GS);
