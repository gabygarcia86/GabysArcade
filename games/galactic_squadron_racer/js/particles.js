/**
 * Pooled world-space particles: glows, smoke, sparks, debris chunks and
 * shockwave rings. Nothing is allocated after start-up.
 */
import { Pool, TAU } from './utils.js';
import { getGlow } from './gfx.js';

let smokeSprite = null;
function getSmoke() {
  if (smokeSprite) return smokeSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  smokeSprite = c;
  return c;
}

const tinted = new Map();
/** Smoke puff tinted to a color (cached). */
function smokeOf(color) {
  let c = tinted.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.drawImage(getSmoke(), 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  tinted.set(color, c);
  return c;
}

export class Particles {
  constructor(max) {
    this.max = max;
    this.pool = new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, size1: 1, color: '#fff', kind: 'glow', drag: 0, grav: 0, rot: 0, vrot: 0, alpha: 1, top: false }), max);
  }

  setLimit(max) {
    this.limit = Math.min(this.max, max);
  }

  spawn(kind, x, y, vx, vy, life, size, size1, color, o) {
    if (this.pool.count >= (this.limit || this.max)) return null;
    const p = this.pool.obtain();
    if (!p) return null;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = p.max = life;
    p.size = size;
    p.size1 = size1;
    p.color = color;
    p.drag = o?.drag ?? 1.5;
    p.grav = o?.grav ?? 0;
    p.rot = o?.rot ?? Math.random() * TAU;
    p.vrot = o?.vrot ?? 0;
    p.alpha = o?.alpha ?? 1;
    p.top = o?.top ?? kind !== 'smoke';
    return p;
  }

  burst(kind, x, y, n, speed, life, size, size1, color, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.spawn(kind, x, y, Math.cos(a) * v + (o?.vx || 0), Math.sin(a) * v + (o?.vy || 0), life * (0.6 + Math.random() * 0.6), size, size1, color, o);
    }
  }

  update(dt) {
    const a = this.pool.active;
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.releaseAt(i);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  clear() {
    this.pool.clear();
  }

  draw(ctx, top, view) {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      if (p.top !== top) continue;
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const t = 1 - p.life / p.max;
      const s = p.size + (p.size1 - p.size) * t;
      const al = p.alpha * (1 - t);
      switch (p.kind) {
        case 'glow':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = al;
          ctx.drawImage(getGlow(p.color), p.x - s / 2, p.y - s / 2, s, s);
          break;
        case 'smoke':
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = al * 0.6;
          ctx.drawImage(smokeOf(p.color), p.x - s / 2, p.y - s / 2, s, s);
          break;
        case 'spark': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = al;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = s;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          break;
        }
        case 'chunk':
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, al * 2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-s / 2, -s / 3, s, (s * 2) / 3);
          ctx.restore();
          break;
        case 'ring':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = al;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * (1 - t) + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, TAU);
          ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
