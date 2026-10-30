/**
 * Draws a roster ship: drop shadow, animated engine flames (much longer and
 * brighter on boost), banking into turns, and a white hit flash. Used in races,
 * the hangar preview and the title screen.
 */
import { getSprites } from './sprites.js';
import { glow, silhouette } from './gfx.js';

/**
 * o: { x, y, heading, bank (-1..1), throttle (0..1), boost (0..1), t, flash,
 *      alpha, shadow (height in units, 0 = none), scale }
 */
export function drawShip(ctx, ship, o) {
  const spr = ship.getSprite();
  const k = ship.scale * (o.scale ?? 1);
  const w = spr.w * k;
  const h = spr.h * k;
  const rot = o.heading + Math.PI / 2;
  const alpha = o.alpha ?? 1;
  const t = o.t || 0;
  const boost = o.boost || 0;
  const throttle = o.throttle ?? 0.5;
  const bank = o.bank || 0;

  if (o.shadow) {
    ctx.save();
    ctx.globalAlpha = 0.28 * alpha;
    ctx.translate(o.x + o.shadow * 0.55, o.y + o.shadow * 0.8);
    ctx.rotate(rot);
    ctx.scale(1 - Math.abs(bank) * 0.18, 1);
    ctx.drawImage(silhouette(spr.canvas), -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(rot + bank * 0.12);
  ctx.globalAlpha = alpha;

  // engine flames (sprite space, behind the hull)
  const flame = getSprites().flames[ship.flame] || getSprites().flames.cyan;
  const flick = 0.85 + 0.15 * Math.sin(t * 41 + o.x) + 0.1 * Math.sin(t * 67);
  ctx.globalCompositeOperation = 'lighter';
  for (const [ex, ey, ew] of ship.engines) {
    const len = ew * (1.4 + throttle * 1.5 + boost * 3.6) * flick;
    const fw = ew * (1 + boost * 0.45);
    ctx.drawImage(flame, (ex - fw / 2) * k, ey * k, fw * k, len * k);
    if (boost > 0.05) {
      ctx.globalAlpha = alpha * boost;
      ctx.drawImage(flame, (ex - fw * 0.35) * k, ey * k, fw * 0.7 * k, len * 1.35 * k);
      ctx.globalAlpha = alpha;
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.scale(1 - Math.abs(bank) * 0.18, 1);
  ctx.drawImage(spr.canvas, -w / 2, -h / 2, w, h);
  if (o.flash > 0) {
    ctx.globalAlpha = Math.min(1, o.flash) * alpha;
    ctx.drawImage(spr.flash, -w / 2, -h / 2, w, h);
  }
  ctx.restore();

  if (boost > 0.05) {
    // nozzle glow in world space
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [ex, ey, ew] of ship.engines) {
      const x = o.x + (ex * c - ey * s) * k;
      const y = o.y + (ex * s + ey * c) * k;
      glow(ctx, ship.flameColor, x, y, ew * k * 7 * boost, 0.9 * alpha);
    }
  }
}

/** World positions of a ship's nozzles (for trails and exhaust particles). */
export function nozzlePositions(ship, x, y, heading, out) {
  const rot = heading + Math.PI / 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const k = ship.scale;
  out.length = 0;
  for (const [ex, ey] of ship.engines) out.push(x + (ex * c - (ey + 6) * s) * k, y + (ex * s + (ey + 6) * c) * k);
  return out;
}
