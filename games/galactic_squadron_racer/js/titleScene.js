/**
 * Animated menu backdrop: drifting starfield and nebulae, with squadron ships
 * racing across the screen in pairs and trios, flames lit.
 */
import { ROSTER } from './shipRoster.js';
import { drawShip } from './shipRender.js';
import { softGlow } from './gfx.js';
import { TAU } from './utils.js';

export class TitleScene {
  constructor() {
    this.t = 0;
    this.stars = [];
    for (let i = 0; i < 240; i++) this.stars.push({ x: Math.random(), y: Math.random(), z: Math.random() ** 2 * 0.9 + 0.1 });
    this.ships = [];
    this.timer = 0.3;
  }

  spawn(W, H) {
    const fromLeft = Math.random() < 0.5;
    const n = 1 + Math.floor(Math.random() * 3);
    const y0 = H * (0.12 + Math.random() * 0.76);
    const speed = (W + H) * (0.28 + Math.random() * 0.22);
    const tilt = (Math.random() - 0.5) * 0.5;
    const ang = (fromLeft ? 0 : Math.PI) + tilt;
    const size = Math.min(W, H) / 520;
    for (let i = 0; i < n; i++) {
      const ship = ROSTER[Math.floor(Math.random() * ROSTER.length)];
      const depth = 0.7 + Math.random() * 0.7;
      this.ships.push({
        ship,
        x: fromLeft ? -120 - i * 90 : W + 120 + i * 90,
        y: y0 + (i - (n - 1) / 2) * 70 * size,
        vx: Math.cos(ang) * speed * depth,
        vy: Math.sin(ang) * speed * depth,
        heading: ang,
        scale: size * depth * 1.25,
        wob: Math.random() * TAU,
        boost: Math.random() < 0.4,
        trail: [],
      });
    }
  }

  update(dt, W, H) {
    this.t += dt;
    this.timer -= dt;
    if (this.timer <= 0 && this.ships.length < 9) {
      this.spawn(W, H);
      this.timer = 0.9 + Math.random() * 1.4;
    }
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const s = this.ships[i];
      s.wob += dt * 2;
      s.x += s.vx * dt;
      s.y += s.vy * dt + Math.sin(s.wob) * 12 * dt;
      s.trail.push(s.x, s.y);
      if (s.trail.length > 40) s.trail.splice(0, 2);
      if (s.x < -400 || s.x > W + 400 || s.y < -300 || s.y > H + 300) this.ships.splice(i, 1);
    }
  }

  draw(ctx, W, H, dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#050a1e');
    g.addColorStop(1, '#02030a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const t = this.t;
    softGlow(ctx, '#5a2a9a', W * 0.2 + Math.sin(t * 0.05) * 60, H * 0.3, Math.max(W, H) * 0.9, 0.45);
    softGlow(ctx, '#1a4a9a', W * 0.85, H * 0.75 + Math.cos(t * 0.04) * 50, Math.max(W, H) * 0.8, 0.45);
    softGlow(ctx, '#9a2a6a', W * 0.6, H * 0.1, Math.max(W, H) * 0.5, 0.25);
    for (const s of this.stars) {
      const x = ((s.x * W - t * 40 * s.z) % W + W) % W;
      const y = s.y * H;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + s.z * 0.75})`;
      ctx.fillRect(x, y, 1 + s.z * 1.6, 1 + s.z * 1.6);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of this.ships) {
      const tr = s.trail;
      for (let i = 2; i < tr.length; i += 2) {
        const f = i / tr.length;
        ctx.strokeStyle = s.ship.flameColor;
        ctx.globalAlpha = f * 0.35;
        ctx.lineWidth = f * 8 * s.scale;
        ctx.beginPath();
        ctx.moveTo(tr[i - 2], tr[i - 1]);
        ctx.lineTo(tr[i], tr[i + 1]);
        ctx.stroke();
      }
    }
    ctx.restore();
    for (const s of this.ships) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      drawShip(ctx, s.ship, { x: 0, y: 0, heading: s.heading, bank: Math.sin(s.wob) * 0.4, throttle: 1, boost: s.boost ? 1 : 0, t });
      ctx.restore();
    }
  }
}
