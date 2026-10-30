/**
 * Collision responses: walls (at track edge + run-off), racer vs racer, and the
 * shared "hit by a hazard" reaction. Ships are never destroyed — they bounce,
 * lose speed, wobble for a moment and carry on.
 */
import { CONFIG } from './config.js';

const C = CONFIG.collision;

/** Keeps a racer inside the walls. Uses the projection from racer.trackUpdate(). */
export function collideWall(r, race) {
  const limit = r.hw + r.ro - r.r * 0.85;
  const a = Math.abs(r.lat);
  if (a <= limit) return false;
  const side = Math.sign(r.lat);
  // outward wall normal = right-hand normal (-ty, tx) times side
  const nx = -r.ty * side;
  const ny = r.tx * side;
  const pen = a - limit;
  r.x -= nx * pen;
  r.y -= ny * pen;
  r.lat -= side * pen;

  const vn = r.vx * nx + r.vy * ny;
  if (vn <= 0) return false;
  const severity = Math.min(1, vn / 420);
  // bounce off, scrub some speed along the wall
  r.vx -= nx * vn * (1 + C.wallRestitution);
  r.vy -= ny * vn * (1 + C.wallRestitution);
  const keep = 1 - (1 - C.wallFriction) * (0.4 + severity);
  r.vx *= keep;
  r.vy *= keep;

  // turn the nose along the wall so glancing hits slide instead of sticking
  const along = r.vx * r.tx + r.vy * r.ty >= 0 ? Math.atan2(r.ty, r.tx) : Math.atan2(-r.ty, -r.tx);
  let d = along - r.heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) < 1.3) r.heading += d * C.wallAlign * (0.3 + severity);
  r.angVel *= 0.5;
  r.wallTouch = 0.25;

  if (vn > 70) {
    r.wallHits++;
    if (r.boosting && severity > 0.5) r.boosting = false;
    r.cancelDrift();
    race.emit('wallHit', { racer: r, x: r.x + nx * r.r, y: r.y + ny * r.r, impact: vn });
  }
  return true;
}

/** Circle-vs-circle bump between two racers, weighted by ship mass. */
export function collideRacers(a, b, race) {
  if (a.ghost > 0 || b.ghost > 0) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 < 1e-6) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const ma = a.h.mass;
  const mb = b.h.mass;
  const pen = rr - d;
  a.x -= nx * pen * (mb / (ma + mb));
  a.y -= ny * pen * (mb / (ma + mb));
  b.x += nx * pen * (ma / (ma + mb));
  b.y += ny * pen * (ma / (ma + mb));

  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv >= 0) return;
  const j = (-(1 + C.racerRestitution) * rv) / (1 / ma + 1 / mb);
  a.vx -= (nx * j) / ma;
  a.vy -= (ny * j) / ma;
  b.vx += (nx * j) / mb;
  b.vy += (ny * j) / mb;
  // a little spin from glancing contact
  const tang = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
  a.spinVel += (tang * 0.0016) / ma;
  b.spinVel -= (tang * 0.0016) / mb;
  if (-rv > 80) race.emit('racerHit', { a, b, x: a.x + nx * a.r, y: a.y + ny * a.r, impact: -rv });
}

/**
 * Standard reaction to a hazard: speed loss, knockback away from (x, y), a
 * spin and a short loss of grip. Heavier ships shrug off more of it.
 */
export function hazardHit(r, race, { x, y, power = 1, kind = 'hazard' }) {
  if (r.ghost > 0 || r.hitCooldown > 0) return false;
  const stab = r.h.stability;
  const resist = 1.25 - stab * 0.5;
  r.stun = Math.max(r.stun, C.hazardStun * power * resist);
  const keep = Math.min(0.9, 0.5 + 0.22 * stab);
  r.vx *= keep;
  r.vy *= keep;
  let nx = r.x - x;
  let ny = r.y - y;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l;
  ny /= l;
  const push = 230 * power * (1.25 - stab * 0.45);
  r.vx += nx * push;
  r.vy += ny * push;
  r.spinVel += (Math.random() < 0.5 ? -1 : 1) * (2.2 + power * 1.4) * resist;
  r.hitCooldown = 0.9;
  r.flash = 0.35;
  r.boosting = false;
  r.cancelDrift();
  r.hazardHits++;
  race.emit('hazardHit', { racer: r, x, y, kind });
  return true;
}
