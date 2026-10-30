/**
 * Small drawing helpers shared by the scenery, track and ship renderers.
 */
import { TAU, mulberry32 } from './utils.js';
export { getGlow } from '../../galactic_squadron/js/sprites.js';
import { getGlow } from '../../galactic_squadron/js/sprites.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return { c, g: c.getContext('2d') };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rngFor = (seed) => mulberry32(typeof seed === 'string' ? hash(seed) : seed);

/** Additive soft glow. */
export function glow(ctx, color, x, y, size, alpha = 1) {
  if (alpha <= 0.01) return;
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, alpha);
  ctx.drawImage(getGlow(color), x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

/** Irregular blob outline (rocks, lakes, dunes, bushes). */
export function blob(g, x, y, r, rng, n = 10, rough = 0.3, squash = 1) {
  g.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 - rough / 2 + rng() * rough);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash]);
  }
  // smooth closed curve through midpoints
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    if (i === 0) g.moveTo(mx, my);
    else g.quadraticCurveTo(p[0], p[1], mx, my);
  }
  const p = pts[0];
  const q = pts[1];
  g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  g.closePath();
}

export function radial(g, x, y, r0, r1, stops) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

export function linearG(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/** Scatter of small marks over a tile, wrapping at the edges so patterns tile seamlessly. */
export function speckle(g, S, rng, count, colors, rMin, rMax, shape = 'circle') {
  for (let i = 0; i < count; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = rMin + rng() * (rMax - rMin);
    g.fillStyle = colors[Math.floor(rng() * colors.length)];
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const px = x + ox;
        const py = y + oy;
        if (px < -r || py < -r || px > S + r || py > S + r) continue;
        if (shape === 'rect') g.fillRect(px - r, py - r * 0.5, r * 2, r);
        else {
          g.beginPath();
          g.arc(px, py, r, 0, TAU);
          g.fill();
        }
      }
    }
  }
}

/** Draws fn at the 9 wrapped offsets so a stroke crossing the tile edge tiles cleanly. */
export function wrapDraw(S, fn) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
}

/** A repeating pattern from a tile painter; `unit` world units per tile pixel. */
export function makePattern(ctx, size, paint, seed, unit = 1) {
  const { c, g } = makeCanvas(size, size);
  paint(g, size, rngFor(seed));
  const p = ctx.createPattern(c, 'repeat');
  if (unit !== 1 && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(unit));
  return { pattern: p, canvas: c };
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const silhouettes = new WeakMap();

/** Black silhouette of a sprite canvas (cached), used for drop shadows. */
export function silhouette(canvas) {
  let c = silhouettes.get(canvas);
  if (c) return c;
  ({ c } = makeCanvas(canvas.width, canvas.height));
  const g = c.getContext('2d');
  g.drawImage(canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  silhouettes.set(canvas, c);
  return c;
}

const softCache = new Map();

/** Soft colored glow without a white core (nebulae, haze, big ambient light). */
export function softGlow(ctx, color, x, y, size, alpha = 1) {
  let c = softCache.get(color);
  if (!c) {
    ({ c } = makeCanvas(128, 128));
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color);
    gr.addColorStop(0.45, color.length === 7 ? color + '88' : color);
    gr.addColorStop(1, color.length === 7 ? color + '00' : 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    softCache.set(color, c);
  }
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, alpha);
  ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}
