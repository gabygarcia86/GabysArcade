/*
 * Shared constants and small helpers. Everything in the game hangs off window.GS.
 *
 * World space: every level is the same 1920 x 1080 stage, seen side-on, with y pointing
 * down. The ground's top edge is at GROUND_Y. main.js scales the stage to fit the screen
 * without stretching it, so the physics always runs in the same units.
 */
window.GS = window.GS || {};

(function (G) {
  "use strict";

  G.WORLD_W = 1920;
  G.WORLD_H = 1080;
  G.GROUND_Y = 1000;
  G.GRAVITY = 1300;
  G.TAU = Math.PI * 2;

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (list) => list[Math.floor(Math.random() * list.length)];
  G.chance = (p) => Math.random() < p;
  G.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  G.damp = (v, target, rate, dt) => target + (v - target) * Math.exp(-rate * dt);
  G.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  G.easeOutBack = (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };
  G.easeOutElastic = (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  };

  G.shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  };

  G.escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  G.fmt = (n) => Math.round(n).toLocaleString("en-US");

  // Distance from point (px, py) to the segment from (ax, ay) to (bx, by).
  G.segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = G.clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    return Math.hypot(ax + dx * t - px, ay + dy * t - py);
  };

  // Shortest distance between two segments (used to see if a snowball crossed a light string).
  G.segSegDist = (a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) => {
    const cross = (ox, oy, ax, ay, bx, by) => (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
    const d1 = cross(b1x, b1y, b2x, b2y, a1x, a1y);
    const d2 = cross(b1x, b1y, b2x, b2y, a2x, a2y);
    const d3 = cross(a1x, a1y, a2x, a2y, b1x, b1y);
    const d4 = cross(a1x, a1y, a2x, a2y, b2x, b2y);
    if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
    return Math.min(
      G.segDist(a1x, a1y, b1x, b1y, b2x, b2y),
      G.segDist(a2x, a2y, b1x, b1y, b2x, b2y),
      G.segDist(b1x, b1y, a1x, a1y, a2x, a2y),
      G.segDist(b2x, b2y, a1x, a1y, a2x, a2y),
    );
  };

  // Colour helpers for the art code.
  G.shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    if (amt >= 0) {
      r += (255 - r) * amt;
      g += (255 - g) * amt;
      b += (255 - b) * amt;
    } else {
      r *= 1 + amt;
      g *= 1 + amt;
      b *= 1 + amt;
    }
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  };
})(window.GS);
