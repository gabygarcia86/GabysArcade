/*
 * Drawing helpers shared by all the art code, and a sprite cache: anything that doesn't
 * change frame to frame (a present, a tree, the background) is painted once onto an
 * offscreen canvas at the current screen resolution and then just stamped.
 */
(function (G) {
  "use strict";

  const TAU = Math.PI * 2;
  const Art = (G.Art = G.Art || {});

  Art.circle = (ctx, x, y, r, fill) => {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };

  Art.ellipse = (ctx, x, y, rx, ry, fill, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };

  Art.roundRect = (ctx, x, y, w, h, r) => {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  };

  Art.starPath = (ctx, x, y, r, rot = 0, points = 5, inner = 0.45) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = rot + (i * Math.PI) / points - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * inner;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  Art.poly = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  };

  // A wobbly-edged blob, used for snow caps, fur and puffs.
  Art.fluff = (ctx, cx, cy, rx, ry, bumps, jag, fill) => {
    ctx.beginPath();
    const n = bumps * 2;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const k = i % 2 === 0 ? 1 : 1 - jag;
      const px = cx + Math.cos(a) * rx * k;
      const py = cy + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };

  // A rounded bow with two loops and tails, centred at (x, y).
  Art.bow = (ctx, x, y, s, color) => {
    const dark = G.shade(color, -0.3);
    ctx.fillStyle = color;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, s * 0.08);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + side * s * 1.1, y - s * 0.9, x + side * s * 1.3, y + s * 0.15, x, y);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * s * 0.55, y + s * 0.75);
      ctx.lineTo(x + side * s * 0.25, y + s * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    Art.circle(ctx, x, y, s * 0.24, dark);
  };

  // A small four-point sparkle.
  Art.sparkle = (ctx, x, y, r, color = "#fff") => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  };

  // A tiny seeded random generator for repeatable decoration patterns.
  Art.rng = (seed) => {
    let a = (seed * 9301 + 49297) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---------------------------------------------------------------- Sprite cache

  const cache = new Map();
  let cacheScale = 1;

  // Clears the cache when the screen resolution changes enough to matter.
  Art.setSpriteScale = (s) => {
    const q = Math.max(0.5, Math.min(2.5, Math.round(s * 4) / 4));
    if (q !== cacheScale) {
      cacheScale = q;
      cache.clear();
    }
  };

  // Returns { canvas, x, y, w, h } for drawing at (x, y) with size (w, h) in world units.
  // `draw(ctx)` paints in world units with the origin where the caller expects it.
  Art.sprite = (key, x, y, w, h, draw) => {
    let s = cache.get(key);
    if (s) return s;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * cacheScale));
    c.height = Math.max(1, Math.ceil(h * cacheScale));
    const ctx = c.getContext("2d");
    ctx.scale(cacheScale, cacheScale);
    ctx.translate(-x, -y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    draw(ctx);
    s = { canvas: c, x, y, w, h };
    cache.set(key, s);
    return s;
  };

  // Repaints every sprite (e.g. once the web font has loaded).
  Art.clearSprites = () => cache.clear();

  Art.stamp = (ctx, s) => ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h);

  Art.TAU = TAU;
})(window.GS);
