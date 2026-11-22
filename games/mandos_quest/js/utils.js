/*
 * Shared namespace, math and Canvas helpers. Every other file adds to window.MQ.
 * All gameplay and drawing uses a fixed 1280x720 logical view.
 */
window.MQ = window.MQ || {};

(function (MQ) {
  MQ.VW = 1280;
  MQ.VH = 720;
  MQ.TAU = Math.PI * 2;
  MQ.FONT = '"Oxanium", "Segoe UI", "Trebuchet MS", sans-serif';
  MQ.INK = "#11131b";
  MQ.STEP = 1 / 120; // The simulation always advances in steps of this length.

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const smooth = (t) => {
    const k = clamp(t, 0, 1);
    return k * k * (3 - 2 * k);
  };

  // Seeded generator, so scenery looks the same on every visit.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (a, b) => a + next() * (b - a);
    next.pick = (list) => list[Math.floor(next() * list.length)];
    return next;
  }

  /* Colors are cached, because they are looked up thousands of times per frame. */
  const rgbCache = new Map();
  const shadeCache = new Map();
  const alphaCache = new Map();

  function rgb(hex) {
    let value = rgbCache.get(hex);
    if (!value) {
      const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
      value = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
      rgbCache.set(hex, value);
    }
    return value;
  }

  // amount < 0 darkens, amount > 0 lightens.
  function shade(hex, amount) {
    let byAmount = shadeCache.get(hex);
    if (!byAmount) shadeCache.set(hex, (byAmount = new Map()));
    let value = byAmount.get(amount);
    if (!value) {
      const target = amount < 0 ? 0 : 255;
      value = "#" + rgb(hex)
        .map((c) => Math.round(lerp(c, target, Math.min(1, Math.abs(amount)))).toString(16).padStart(2, "0"))
        .join("");
      byAmount.set(amount, value);
    }
    return value;
  }

  function alpha(hex, a) {
    let byAlpha = alphaCache.get(hex);
    if (!byAlpha) alphaCache.set(hex, (byAlpha = new Map()));
    const key = Math.round(clamp(a, 0, 1) * 100);
    let value = byAlpha.get(key);
    if (!value) {
      value = `rgba(${rgb(hex).join(",")},${key / 100})`;
      byAlpha.set(key, value);
    }
    return value;
  }

  function mix(a, b, t) {
    const x = rgb(a);
    const y = rgb(b);
    return "#" + x.map((c, i) => Math.round(lerp(c, y[i], t)).toString(16).padStart(2, "0")).join("");
  }

  function makeCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(w));
    canvas.height = Math.max(1, Math.ceil(h));
    return canvas;
  }

  /*
   * A vertical "lit from above" gradient. Gradients live in the local coordinates of the
   * shape, so the same one can be reused wherever that shape is drawn.
   */
  const gradients = new WeakMap();
  function metal(ctx, color, y0, y1, contrast = 0.3) {
    let cache = gradients.get(ctx);
    if (!cache) gradients.set(ctx, (cache = new Map()));
    const key = `${color}${y0}|${y1}|${contrast}`;
    let gradient = cache.get(key);
    if (!gradient) {
      if (cache.size > 1500) cache.clear();
      gradient = ctx.createLinearGradient(0, y0, 0, y1);
      gradient.addColorStop(0, shade(color, contrast));
      gradient.addColorStop(0.38, color);
      gradient.addColorStop(0.5, shade(color, contrast * 0.45));
      gradient.addColorStop(1, shade(color, -contrast - 0.12));
      cache.set(key, gradient);
    }
    return gradient;
  }

  // Pre-rendered glow sprites are far cheaper than shadowBlur.
  const glows = new Map();
  function glow(ctx, x, y, radius, color, opacity = 1) {
    if (opacity <= 0.01 || radius <= 0) return;
    let sprite = glows.get(color);
    if (!sprite) {
      if (glows.size > 80) glows.clear();
      sprite = makeCanvas(128, 128);
      const g = sprite.getContext("2d");
      const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, alpha(color, 0.95));
      gradient.addColorStop(0.3, alpha(color, 0.38));
      gradient.addColorStop(0.65, alpha(color, 0.1));
      gradient.addColorStop(1, alpha(color, 0));
      g.fillStyle = gradient;
      g.fillRect(0, 0, 128, 128);
      glows.set(color, sprite);
    }
    const oldAlpha = ctx.globalAlpha;
    const oldMode = ctx.globalCompositeOperation;
    ctx.globalAlpha = oldAlpha * Math.min(1, opacity);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = oldAlpha;
    ctx.globalCompositeOperation = oldMode;
  }

  function path(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
  }

  function poly(ctx, points, fill, stroke, width = 1.6) {
    path(ctx, points);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }

  function oval(ctx, x, y, rx, ry, fill, stroke, width = 1.6, rotation = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, MQ.TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function roundPath(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function box(ctx, x, y, w, h, radius, fill, stroke, width = 1.6) {
    roundPath(ctx, x, y, w, h, radius);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function line(ctx, x0, y0, x1, y1, color, width = 1, cap = "round") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = cap;
    ctx.stroke();
  }

  function text(ctx, value, x, y, size, color = "#fff", align = "left", weight = 700) {
    ctx.font = `${weight} ${size}px ${MQ.FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  const wrapCache = new Map();
  function wrap(ctx, value, maxWidth) {
    const key = `${ctx.font}|${maxWidth}|${value}`;
    if (wrapCache.has(key)) return wrapCache.get(key);
    const lines = [];
    let current = "";
    for (const word of String(value).split(" ")) {
      const test = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
    if (wrapCache.size > 300) wrapCache.clear();
    wrapCache.set(key, lines);
    return lines;
  }

  function formatTime(seconds) {
    if (!seconds) return "--:--";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  const HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => HTML[c]);

  MQ.U = {
    clamp, lerp, damp, approach, rand, pick, smooth, rng, shade, alpha, mix, makeCanvas, metal,
    glow, path, poly, oval, roundPath, box, line, text, wrap, formatTime, escapeHtml,
  };
})(window.MQ);
