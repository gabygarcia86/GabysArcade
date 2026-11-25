/*
 * Shared constants and small helpers. Everything in the game hangs off window.GH.
 *
 * World space: the view is always 720 units tall and its width follows the screen's
 * shape (see main.js). Maps are seen from above at a slight angle, so tall things
 * (houses, trees, characters) are drawn upward from the point where they touch the ground,
 * and everything is drawn in order of that point's y.
 */
window.GH = window.GH || {};

(function (G) {
  "use strict";

  G.VH = 720;
  G.TAU = Math.PI * 2;
  G.ROUND_TIME = 60;

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (list) => list[Math.floor(Math.random() * list.length)];
  G.chance = (p) => Math.random() < p;
  G.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  G.approach = (v, target, delta) => (v < target ? Math.min(v + delta, target) : Math.max(v - delta, target));
  G.damp = (v, target, rate, dt) => target + (v - target) * Math.exp(-rate * dt);
  G.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  G.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  G.easeOutBack = (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  G.angleDiff = (a, b) => {
    let d = (b - a) % G.TAU;
    if (d > Math.PI) d -= G.TAU;
    if (d < -Math.PI) d += G.TAU;
    return d;
  };

  // Turns an angle into the four facing directions the characters are drawn in.
  G.dirFromAngle = (a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    if (Math.abs(c) >= Math.abs(s)) return c >= 0 ? "right" : "left";
    return s >= 0 ? "down" : "up";
  };

  // Small seeded random generator, so each level's streets are laid out the same way every time.
  G.rng = (seed) => {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + next() * (hi - lo);
    next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
    next.pick = (list) => list[Math.floor(next() * list.length)];
    next.chance = (p) => next() < p;
    return next;
  };

  G.shuffle = (list, rnd = Math.random) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  };

  G.weighted = (weights, rnd = Math.random) => {
    let total = 0;
    for (const key in weights) total += Math.max(0, weights[key]);
    if (total <= 0) return null;
    let roll = rnd() * total;
    for (const key in weights) {
      roll -= Math.max(0, weights[key]);
      if (roll <= 0) return key;
    }
    return Object.keys(weights)[0];
  };

  G.escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  G.fmt = (n) => Math.round(n).toLocaleString("en-US");

  // ---------------------------------------------------------------- Geometry

  G.pointInRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  G.rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  G.circleHitsRect = (cx, cy, r, rect) => {
    const px = G.clamp(cx, rect.x, rect.x + rect.w);
    const py = G.clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - px;
    const dy = cy - py;
    return dx * dx + dy * dy < r * r;
  };

  // Moves a circle ({x, y, r}) out of a rectangle. Returns true when they overlapped.
  G.pushOutRect = (e, rect) => {
    const px = G.clamp(e.x, rect.x, rect.x + rect.w);
    const py = G.clamp(e.y, rect.y, rect.y + rect.h);
    let dx = e.x - px;
    let dy = e.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 >= e.r * e.r) return false;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = e.r - d;
      e.x += (dx / d) * push;
      e.y += (dy / d) * push;
      return true;
    }
    // The centre is inside the rectangle: leave by the nearest side.
    const left = e.x - rect.x;
    const right = rect.x + rect.w - e.x;
    const top = e.y - rect.y;
    const bottom = rect.y + rect.h - e.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) e.x = rect.x - e.r;
    else if (m === right) e.x = rect.x + rect.w + e.r;
    else if (m === top) e.y = rect.y - e.r;
    else e.y = rect.y + rect.h + e.r;
    return true;
  };

  G.pushOutCircle = (e, c) => {
    const dx = e.x - c.x;
    const dy = e.y - c.y;
    const min = e.r + c.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return false;
    const d = Math.sqrt(d2) || 0.001;
    const push = min - d;
    e.x += (dx / d) * push;
    e.y += (dy / d) * push;
    return true;
  };

  // Does the segment from (x1, y1) to (x2, y2) cross the rectangle?
  G.segHitsRect = (x1, y1, x2, y2, r) => {
    let t0 = 0;
    let t1 = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > t1) return false;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return false;
          if (t < t1) t1 = t;
        }
      }
    }
    return t0 <= t1;
  };

  G.segHitsCircle = (x1, y1, x2, y2, cx, cy, r) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = G.clamp(((cx - x1) * dx + (cy - y1) * dy) / len2, 0, 1);
    const px = x1 + dx * t - cx;
    const py = y1 + dy * t - cy;
    return px * px + py * py < r * r;
  };
})(window.GH);
