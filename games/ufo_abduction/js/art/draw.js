/*
 * Cartoon drawing primitives: thick dark outlines, googly eyes and speech bubbles.
 * All characters, hazards and scenery are drawn with these, so there are no image files.
 */
(function (U) {
  "use strict";

  const OUT = "#1d1433";

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function finish(ctx, fill, lw) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (lw) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = OUT;
      ctx.stroke();
    }
  }

  const D = (U.Draw = {
    OUT,
    roundRectPath,

    ell(ctx, x, y, rx, ry, fill, lw = 3, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, U.TAU);
      finish(ctx, fill, lw);
    },

    circ(ctx, x, y, r, fill, lw = 3) {
      ctx.beginPath();
      ctx.arc(x, y, Math.abs(r), 0, U.TAU);
      finish(ctx, fill, lw);
    },

    rect(ctx, x, y, w, h, fill, lw = 3, r = 0) {
      if (r) roundRectPath(ctx, x, y, w, h, r);
      else {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
      }
      finish(ctx, fill, lw);
    },

    poly(ctx, pts, fill, lw = 3) {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      finish(ctx, fill, lw);
    },

    // A rounded limb with an outline: a thick dark stroke under a thinner coloured one.
    limb(ctx, x1, y1, x2, y2, w, color, outline = 3) {
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (outline) {
        ctx.strokeStyle = OUT;
        ctx.lineWidth = w + outline * 2;
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    },

    // A bent limb through a middle point (knees, elbows, bird necks).
    limb3(ctx, x1, y1, x2, y2, x3, y3, w, color, outline = 3) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x2, y2, x3, y3);
      if (outline) {
        ctx.strokeStyle = OUT;
        ctx.lineWidth = w + outline * 2;
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    },

    line(ctx, x1, y1, x2, y2, color = OUT, w = 3) {
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },

    // One eye. mood: normal, panic, angry, happy, dizzy, closed, sad.
    eye(ctx, x, y, r, lx, ly, mood, t = 0, side = 1) {
      if (mood === "happy") {
        ctx.strokeStyle = OUT;
        ctx.lineWidth = Math.max(2, r * 0.45);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(x, y + r * 0.3, r * 0.75, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        return;
      }
      if (mood === "closed") {
        D.line(ctx, x - r * 0.8, y, x + r * 0.8, y, OUT, Math.max(2, r * 0.4));
        return;
      }
      if (mood === "dizzy") {
        ctx.strokeStyle = OUT;
        ctx.lineWidth = Math.max(1.5, r * 0.3);
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = t * 10 + i * 0.7;
          const rr = (i / 14) * r;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.stroke();
        return;
      }
      const big = mood === "panic" ? 1.22 : 1;
      D.circ(ctx, x, y, r * big, "#fff", Math.max(1.5, r * 0.32));
      const pr = mood === "panic" ? r * 0.28 : r * 0.5;
      const k = r * big - pr - 1;
      ctx.fillStyle = OUT;
      ctx.beginPath();
      ctx.arc(x + lx * k * 0.8, y + ly * k * 0.8, pr, 0, U.TAU);
      ctx.fill();
      if (r > 4) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x + lx * k * 0.8 - pr * 0.35, y + ly * k * 0.8 - pr * 0.35, pr * 0.35, 0, U.TAU);
        ctx.fill();
      }
      if (mood === "angry") {
        D.line(ctx, x - r * 1.1 * side, y - r * 1.5, x + r * 1.0 * side, y - r * 0.8, OUT, Math.max(2.5, r * 0.5));
      } else if (mood === "sad") {
        D.line(ctx, x - r * 1.0 * side, y - r * 0.9, x + r * 1.0 * side, y - r * 1.5, OUT, Math.max(2, r * 0.4));
      }
    },

    eyes(ctx, x, y, gap, r, lx, ly, mood, t, blink) {
      const m = blink && mood !== "panic" && mood !== "dizzy" ? "closed" : mood;
      D.eye(ctx, x - gap / 2, y, r, lx, ly, m, t, 1);
      D.eye(ctx, x + gap / 2, y, r, lx, ly, m, t, -1);
    },

    // mood: smile, open, frown, wavy, grin, flat
    mouth(ctx, x, y, w, mood, t = 0) {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = Math.max(2, w * 0.22);
      ctx.lineCap = "round";
      ctx.beginPath();
      switch (mood) {
        case "open": {
          const h = w * (0.6 + Math.sin(t * 20) * 0.15);
          ctx.ellipse(x, y + h * 0.4, w * 0.45, h * 0.6, 0, 0, U.TAU);
          ctx.fillStyle = "#5a1730";
          ctx.fill();
          ctx.stroke();
          return;
        }
        case "frown":
          ctx.arc(x, y + w * 0.6, w * 0.5, Math.PI * 1.2, Math.PI * 1.8);
          break;
        case "wavy":
          ctx.moveTo(x - w / 2, y);
          for (let i = 1; i <= 6; i++) ctx.lineTo(x - w / 2 + (i / 6) * w, y + (i % 2 ? -1 : 1) * w * 0.15);
          break;
        case "grin":
          ctx.arc(x, y - w * 0.2, w * 0.5, Math.PI * 0.15, Math.PI * 0.85);
          ctx.closePath();
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.stroke();
          return;
        case "flat":
          ctx.moveTo(x - w / 2, y);
          ctx.lineTo(x + w / 2, y);
          break;
        default:
          ctx.arc(x, y - w * 0.25, w * 0.5, Math.PI * 0.2, Math.PI * 0.8);
      }
      ctx.stroke();
    },

    shadow(ctx, x, y, rx, alpha = 0.25) {
      ctx.fillStyle = `rgba(20, 10, 40, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.28, 0, 0, U.TAU);
      ctx.fill();
    },

    sweat(ctx, x, y, s, t) {
      const drop = (t * 2) % 1;
      ctx.globalAlpha = 1 - drop;
      ctx.fillStyle = "#8fd8ff";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const yy = y + drop * 10;
      ctx.moveTo(x, yy - s);
      ctx.quadraticCurveTo(x + s * 0.8, yy + s * 0.3, x, yy + s * 0.6);
      ctx.quadraticCurveTo(x - s * 0.8, yy + s * 0.3, x, yy - s);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    dizzyStars(ctx, x, y, r, t) {
      ctx.fillStyle = "#ffe36b";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i / 3) * U.TAU;
        const sx = x + Math.cos(a) * r;
        const sy = y + Math.sin(a) * r * 0.35;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const aa = (k / 10) * U.TAU - Math.PI / 2;
          const rr = k % 2 === 0 ? 6 : 2.6;
          ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },

    // A speech bubble whose tail points down at (x, y).
    bubble(ctx, x, y, text, o = {}) {
      const size = o.size || 16;
      ctx.font = `800 ${size}px Oxanium, sans-serif`;
      const w = Math.max(size * 1.4, ctx.measureText(text).width + size * 0.9);
      const h = size * 1.6;
      const bx = x - w / 2;
      const by = y - h - 10;
      ctx.fillStyle = o.fill || "#fff";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.5;
      roundRectPath(ctx, bx, by, w, h, h * 0.4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 6, by + h - 1);
      ctx.lineTo(x, y - 1);
      ctx.lineTo(x + 6, by + h - 1);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 6, by + h);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 6, by + h);
      ctx.stroke();
      ctx.fillStyle = o.color || OUT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, by + h / 2 + 1);
    },

    // A pulsing red "!" warning sign.
    warning(ctx, x, y, t, scale = 1) {
      const s = scale * (1 + Math.sin(t * 14) * 0.12);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      D.poly(ctx, [0, -20, 18, 12, -18, 12], "#ff3b3b", 3);
      ctx.fillStyle = "#fff";
      ctx.font = "900 20px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 0, 3);
      ctx.restore();
    },

    star(ctx, x, y, r, fill, lw = 2, points = 5, inner = 0.45, rot = -Math.PI / 2) {
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = rot + (i / (points * 2)) * U.TAU;
        const rr = i % 2 === 0 ? r : r * inner;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      finish(ctx, fill, lw);
    },
  });
})(window.UFO);
