/*
 * Drawing helpers shared by every piece of procedural art: outlined limbs and shapes,
 * color shading, cached glow sprites, the X emblem and comic-style text.
 */
(function (XM) {
  "use strict";
  const OUTLINE = "#140d1f";
  const shadeCache = new Map();
  const glowCache = new Map();

  function hexToRgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const Art = {
    OUTLINE,
    hexToRgb,
    // amt > 0 lightens toward white, amt < 0 darkens toward black.
    shade(hex, amt) {
      const key = hex + amt;
      let out = shadeCache.get(key);
      if (out) return out;
      const [r, g, b] = hexToRgb(hex);
      const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
      out = "#" + [f(r), f(g), f(b)].map((c) => XM.U.clamp(c, 0, 255).toString(16).padStart(2, "0")).join("");
      shadeCache.set(key, out);
      return out;
    },
    rgba(hex, a) {
      const [r, g, b] = hexToRgb(hex);
      return `rgba(${r},${g},${b},${a})`;
    },
    mix(a, b, t) {
      const A = hexToRgb(a);
      const B = hexToRgb(b);
      return "#" + A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, "0")).join("");
    },

    // A capsule from (x1,y1) to (x2,y2) with a dark outline: the basic body part.
    limb(ctx, x1, y1, x2, y2, w, color, outline = true) {
      ctx.lineCap = "round";
      if (outline) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = w + 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    // Two-segment limb (thigh+shin or upper arm+forearm) with a joint.
    limb2(ctx, a, b, c, w1, w2, color, outline = true) {
      if (outline) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(w1, w2) + 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
      Art.limb(ctx, a.x, a.y, b.x, b.y, w1, color, false);
      Art.limb(ctx, b.x, b.y, c.x, c.y, w2, color, false);
    },
    circle(ctx, x, y, r, fill, outline = true, lw = 2) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (outline) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    },
    ellipse(ctx, x, y, rx, ry, rot, fill, outline = true, lw = 2) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (outline) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    },
    poly(ctx, pts, fill, outline = true, lw = 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (outline) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = lw;
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    },
    roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    box(ctx, x, y, w, h, fill, outline = true, r = 3, lw = 2) {
      Art.roundRect(ctx, x, y, w, h, r);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (outline) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    },
    // A soft radial glow, cached per color as a small sprite and stretched when drawn.
    glow(ctx, x, y, r, color, alpha = 1) {
      let spr = glowCache.get(color);
      if (!spr) {
        spr = document.createElement("canvas");
        spr.width = spr.height = 64;
        const g = spr.getContext("2d");
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, Art.rgba(color, 1));
        grad.addColorStop(0.35, Art.rgba(color, 0.5));
        grad.addColorStop(1, Art.rgba(color, 0));
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        glowCache.set(color, spr);
      }
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * alpha;
      ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = prev;
    },
    // The team emblem: a circle with a bold X through it.
    xLogo(ctx, x, y, r, fg = "#f6c22b", bg = "#c4161c", outline = true) {
      ctx.save();
      ctx.translate(x, y);
      Art.circle(ctx, 0, 0, r, bg, outline, Math.max(1.5, r * 0.12));
      ctx.strokeStyle = fg;
      ctx.lineWidth = r * 0.42;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, -r * 0.62);
      ctx.lineTo(r * 0.62, r * 0.62);
      ctx.moveTo(r * 0.62, -r * 0.62);
      ctx.lineTo(-r * 0.62, r * 0.62);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
    text(ctx, str, x, y, size, color = "#fff", align = "left", outline = true, weight = 800) {
      ctx.font = `${weight} ${size}px Oxanium, "Trebuchet MS", sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      if (outline) {
        ctx.lineJoin = "round";
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, size / 5);
        ctx.strokeText(str, x, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
    },
    // A comic "burst" shape behind sound-effect words.
    burst(ctx, x, y, r, points, fill, rot = 0) {
      const pts = [];
      for (let i = 0; i < points * 2; i++) {
        const a = rot + (i / (points * 2)) * Math.PI * 2;
        const rr = i % 2 ? r * 0.62 : r;
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      Art.poly(ctx, pts, fill, true, 3);
    },
    // Halftone dots used on comic panels and menus, cached as a pattern.
    halftone(ctx, color) {
      Art._ht = Art._ht || new Map();
      let pat = Art._ht.get(color);
      if (!pat) {
        const c = document.createElement("canvas");
        c.width = c.height = 12;
        const g = c.getContext("2d");
        g.fillStyle = color;
        g.beginPath();
        g.arc(3, 3, 1.6, 0, Math.PI * 2);
        g.arc(9, 9, 1.6, 0, Math.PI * 2);
        g.fill();
        pat = ctx.createPattern(c, "repeat");
        Art._ht.set(color, pat);
      }
      return pat;
    },
    canvas(w, h) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      return c;
    },
  };

  XM.Art = Art;
})(window.XM);
