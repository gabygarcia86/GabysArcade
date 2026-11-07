/* Comic lettering: speech bubble geometry, text layout and sound-effect (SFX) rendering.
 * All drawing happens in the object's local space: origin at the box center, box is w x h. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { clamp, rng, fontStack } = CBS;

  /* ---------- bubble types ---------- */
  const BUBBLE_TYPES = {
    speech: { label: "Speech", icon: "💬", shape: "ellipse", tailStyle: "curved", dash: "solid" },
    thought: { label: "Thought", icon: "💭", shape: "cloud", tailStyle: "bubbles", dash: "solid" },
    whisper: { label: "Whisper", icon: "🤫", shape: "ellipse", tailStyle: "curved", dash: "dashed" },
    shout: { label: "Shout", icon: "📢", shape: "burst", tailStyle: "pointed", dash: "solid" },
    narration: { label: "Narration", icon: "📜", shape: "rect", tailStyle: "pointed", dash: "solid" },
    radio: { label: "Radio", icon: "📻", shape: "zigzag", tailStyle: "zigzag", dash: "solid" },
    electronic: { label: "Electronic", icon: "🤖", shape: "chamfer", tailStyle: "zigzag", dash: "solid" },
    custom: { label: "Custom", icon: "✳️" },
  };
  /* Style applied when the user switches a bubble to a type (they can change any of it after). */
  const BUBBLE_STYLES = {
    speech: { fill: "#ffffff", stroke: "#111111", font: "Comic Neue", bold: true, italic: false, uppercase: true, tailOn: true, color: "#111111", strokeWidth: 2.5 },
    thought: { fill: "#ffffff", stroke: "#111111", font: "Comic Neue", bold: true, italic: true, uppercase: true, tailOn: true, color: "#111111", strokeWidth: 2.5 },
    whisper: { fill: "#ffffff", stroke: "#555555", font: "Comic Neue", bold: false, italic: true, uppercase: false, tailOn: true, color: "#444444", strokeWidth: 2 },
    shout: { fill: "#ffffff", stroke: "#111111", font: "Bangers", bold: false, italic: false, uppercase: true, tailOn: true, color: "#111111", strokeWidth: 3.5 },
    narration: { fill: "#fff3a8", stroke: "#111111", font: "Comic Neue", bold: true, italic: false, uppercase: true, tailOn: false, color: "#111111", strokeWidth: 2, align: "left", radius: 2 },
    radio: { fill: "#ffffff", stroke: "#111111", font: "Comic Neue", bold: true, italic: true, uppercase: true, tailOn: true, color: "#111111", strokeWidth: 2.5 },
    electronic: { fill: "#d7f6ff", stroke: "#0d5b78", font: "Special Elite", bold: false, italic: false, uppercase: true, tailOn: true, color: "#0b3d52", strokeWidth: 2.5 },
    custom: { shape: "roundrect", tailStyle: "curved", dash: "solid", radius: 22 },
  };
  const BUBBLE_SHAPES = { ellipse: "Oval", roundrect: "Rounded box", rect: "Box", cloud: "Cloud", burst: "Burst", zigzag: "Jagged", chamfer: "Angled box" };
  const TAIL_STYLES = { curved: "Curved", pointed: "Pointed", bubbles: "Bubbles", zigzag: "Lightning", none: "None" };

  function resolveBubble(b) {
    const t = BUBBLE_TYPES[b.type] || BUBBLE_TYPES.speech;
    if (b.type === "custom") return { shape: b.shape || "roundrect", tailStyle: b.tailStyle || "curved", dash: b.dash || "solid" };
    return { shape: t.shape, tailStyle: b.tailStyle || t.tailStyle, dash: t.dash };
  }

  /* Switch a bubble to a type and apply that type's look (fill, font, tail). */
  function applyBubbleType(b, type) {
    const prev = b.type;
    b.type = type;
    Object.assign(b, CBS.deepClone(BUBBLE_STYLES[type] || {}));
    if (type !== "custom") b.tailStyle = BUBBLE_TYPES[type].tailStyle;
    else if (prev && BUBBLE_TYPES[prev] && BUBBLE_TYPES[prev].shape) {
      b.shape = BUBBLE_TYPES[prev].shape === "rect" ? "roundrect" : BUBBLE_TYPES[prev].shape;
      b.tailStyle = BUBBLE_TYPES[prev].tailStyle;
      b.dash = BUBBLE_TYPES[prev].dash;
    }
    if (!b.align || type !== "narration") b.align = type === "narration" ? "left" : "center";
    return b;
  }

  function roundRectPath(p, x, y, w, h, r) {
    r = clamp(r, 0, Math.min(w, h) / 2);
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.arcTo(x + w, y, x + w, y + r, r);
    p.lineTo(x + w, y + h - r);
    p.arcTo(x + w, y + h, x + w - r, y + h, r);
    p.lineTo(x + r, y + h);
    p.arcTo(x, y + h, x, y + h - r, r);
    p.lineTo(x, y + r);
    p.arcTo(x, y, x + r, y, r);
    p.closePath();
    return p;
  }
  function polyPath(pts) {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  }
  function ellipsePerimeter(rx, ry) {
    const h = ((rx - ry) * (rx - ry)) / ((rx + ry) * (rx + ry) || 1);
    return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }

  /* Body + tail parts as Path2D objects (union-outlined at draw time). */
  function bubbleGeometry(b) {
    const { shape, tailStyle, dash } = resolveBubble(b);
    const rx = Math.max(4, b.w / 2), ry = Math.max(4, b.h / 2);
    const R = rng(b.id || "bubble");
    const parts = [];
    const per = ellipsePerimeter(rx, ry);

    if (shape === "ellipse") {
      const p = new Path2D();
      p.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      parts.push(p);
    } else if (shape === "rect" || shape === "roundrect") {
      const r = shape === "rect" ? b.radius != null ? Math.min(b.radius, 8) : 2 : b.radius != null ? b.radius : 22;
      parts.push(roundRectPath(new Path2D(), -rx, -ry, rx * 2, ry * 2, r));
    } else if (shape === "chamfer") {
      const c = Math.min(rx, ry) * 0.42;
      parts.push(polyPath([[-rx + c, -ry], [rx - c, -ry], [rx, -ry + c], [rx, ry - c], [rx - c, ry], [-rx + c, ry], [-rx, ry - c], [-rx, -ry + c]]));
    } else if (shape === "cloud") {
      const n = clamp(Math.round(per / (Math.min(rx, ry) * 0.62)), 8, 24);
      const br = (per / n) * 0.56;
      const inner = new Path2D();
      inner.ellipse(0, 0, Math.max(2, rx - br * 0.7), Math.max(2, ry - br * 0.7), 0, 0, Math.PI * 2);
      parts.push(inner);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.2;
        const r = br * (0.85 + R() * 0.3);
        const cx = Math.cos(a) * (rx - r * 0.95), cy = Math.sin(a) * (ry - r * 0.95);
        const c = new Path2D();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        parts.push(c);
      }
    } else if (shape === "burst") {
      const n = clamp(Math.round(per / 34), 12, 30);
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 + (R() - 0.5) * 0.12;
        const k = i % 2 === 0 ? 1 : 0.74 + R() * 0.08;
        pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
      }
      parts.push(polyPath(pts));
    } else if (shape === "zigzag") {
      const n = clamp(Math.round(per / 13), 16, 90);
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const k = i % 2 === 0 ? 1 : 0.9;
        pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
      }
      parts.push(polyPath(pts));
    }

    // tail
    const tail = b.tail || { x: 0, y: ry * 1.6 };
    const tx = tail.x, ty = tail.y;
    const ang = Math.atan2(ty, tx);
    const edgeX = Math.cos(ang) * rx, edgeY = Math.sin(ang) * ry;
    const edgeDist = Math.hypot(edgeX, edgeY);
    const tipDist = Math.hypot(tx, ty);
    let tailParts = [];
    if (b.tailOn && tailStyle !== "none" && tipDist > edgeDist * 1.04) {
      const bw = clamp(b.tailWidth != null ? b.tailWidth : 0.28, 0.05, 0.9) * Math.min(rx, ry);
      const px = -Math.sin(ang), py = Math.cos(ang);
      const bcx = edgeX * 0.55, bcy = edgeY * 0.55;
      const b1 = [bcx + px * bw, bcy + py * bw], b2 = [bcx - px * bw, bcy - py * bw];
      const L = Math.hypot(tx - bcx, ty - bcy);
      const ux = (tx - bcx) / L, uy = (ty - bcy) / L;
      const nx = -uy, ny = ux;
      if (tailStyle === "pointed") {
        tailParts.push(polyPath([b1, [tx, ty], b2]));
      } else if (tailStyle === "curved") {
        const bend = (b.tailCurve != null ? b.tailCurve : 0.35) * L * 0.45;
        const mx = bcx + ux * L * 0.55 + nx * bend, my = bcy + uy * L * 0.55 + ny * bend;
        const p = new Path2D();
        p.moveTo(b1[0], b1[1]);
        p.quadraticCurveTo(mx + nx * bw * 0.45, my + ny * bw * 0.45, tx, ty);
        p.quadraticCurveTo(mx - nx * bw * 0.25, my - ny * bw * 0.25, b2[0], b2[1]);
        p.closePath();
        tailParts.push(p);
      } else if (tailStyle === "bubbles") {
        const sx = edgeX, sy = edgeY;
        const seg = Math.hypot(tx - sx, ty - sy);
        const base = Math.min(rx, ry) * 0.2;
        [[0.22, 1], [0.58, 0.68], [0.9, 0.42]].forEach(([t, k]) => {
          const c = new Path2D();
          c.arc(sx + (tx - sx) * t, sy + (ty - sy) * t, Math.max(2, Math.min(base * k, seg * 0.22 * k)), 0, Math.PI * 2);
          tailParts.push(c);
        });
      } else if (tailStyle === "zigzag") {
        // a tapered lightning ribbon from the body to the tip
        const C = [[0, 0, bw], [0.42, 0.55, 0.62 * bw], [0.6, -0.55, 0.5 * bw], [1, 0, 0]];
        const pts = C.map(([u, v, w]) => [bcx + ux * L * u + nx * v * bw, bcy + uy * L * u + ny * v * bw, w]);
        const left = [], right = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
          let dx = c[0] - a[0], dy = c[1] - a[1];
          const dl = Math.hypot(dx, dy) || 1;
          dx /= dl; dy /= dl;
          left.push([pts[i][0] - dy * pts[i][2], pts[i][1] + dx * pts[i][2]]);
          right.push([pts[i][0] + dy * pts[i][2], pts[i][1] - dx * pts[i][2]]);
        }
        tailParts.push(polyPath([...left, ...right.reverse()]));
      }
    }
    // bubbles-style tails are separate puffs: draw them after the body so they don't merge into it
    const separate = tailStyle === "bubbles";
    return { body: parts, tail: tailParts, separateTail: separate, dash, shape, rx, ry };
  }

  function setDash(ctx, dash, width) {
    if (dash === "dashed") ctx.setLineDash([width * 4, width * 2.6]);
    else if (dash === "dotted") ctx.setLineDash([0.1, width * 2.4]);
    else ctx.setLineDash([]);
  }

  function drawBubbleShape(ctx, b) {
    const g = bubbleGeometry(b);
    const sw = Math.max(0, b.strokeWidth || 0);
    const fill = b.fill || "transparent";
    ctx.lineJoin = "round";
    ctx.lineCap = g.dash === "dotted" ? "round" : "butt";
    const merged = g.separateTail ? g.body : g.body.concat(g.tail);
    const transparentFill = !fill || fill === "transparent";
    if (transparentFill) {
      if (sw > 0) {
        ctx.strokeStyle = b.stroke;
        ctx.lineWidth = sw;
        setDash(ctx, g.dash, sw);
        for (const p of g.body.concat(g.tail)) ctx.stroke(p);
      }
      ctx.setLineDash([]);
      return g;
    }
    if (sw > 0) {
      ctx.strokeStyle = b.stroke;
      ctx.lineWidth = sw * 2;
      setDash(ctx, g.dash, sw);
      for (const p of merged) ctx.stroke(p);
    }
    ctx.setLineDash([]);
    ctx.fillStyle = fill;
    for (const p of merged) ctx.fill(p);
    if (g.separateTail) {
      for (const p of g.tail) {
        if (sw > 0) { ctx.lineWidth = sw; setDash(ctx, g.dash, sw); ctx.stroke(p); ctx.setLineDash([]); }
        ctx.fill(p);
      }
    }
    return g;
  }

  /* ---------- text measurement & wrapping ---------- */
  const supportsLetterSpacing = (() => {
    try { return "letterSpacing" in CanvasRenderingContext2D.prototype; } catch (e) { return false; }
  })();

  function fontString(o, size) {
    return `${o.italic ? "italic " : ""}${o.bold ? "700" : "400"} ${size}px ${fontStack(o.font)}`;
  }
  function prepText(o) {
    const t = o.text == null ? "" : String(o.text);
    return o.uppercase ? t.toUpperCase() : t;
  }
  function measure(ctx, s, ls) {
    return ctx.measureText(s).width + (s.length > 1 ? ls * (s.length - 1) : 0);
  }

  /* Greedy word wrap. widthFor(i) gives the width available for line i. */
  function wrap(ctx, text, ls, widthFor) {
    const lines = [];
    for (const para of text.split("\n")) {
      const words = para.split(/(\s+)/).filter((w) => w.length && !/^\s+$/.test(w));
      if (!words.length) { lines.push(""); continue; }
      let line = "";
      for (let wi = 0; wi < words.length; wi++) {
        let word = words[wi];
        const maxW = Math.max(4, widthFor(lines.length));
        const test = line ? line + " " + word : word;
        if (measure(ctx, test, ls) <= maxW || !line) {
          if (!line && measure(ctx, word, ls) > maxW) {
            // break a very long word
            let part = "";
            for (const ch of word) {
              if (part && measure(ctx, part + ch, ls) > Math.max(4, widthFor(lines.length))) { lines.push(part); part = ""; }
              part += ch;
            }
            line = part;
          } else line = test;
        } else {
          lines.push(line);
          line = "";
          wi--;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function drawLine(ctx, s, x, y, ls, align, mode) {
    if (!ls) {
      ctx.textAlign = align;
      mode === "stroke" ? ctx.strokeText(s, x, y) : ctx.fillText(s, x, y);
      return;
    }
    if (supportsLetterSpacing) {
      ctx.letterSpacing = ls + "px";
      // letterSpacing adds trailing space after the last glyph; compensate for center/right
      const shift = align === "center" ? ls / 2 : align === "right" ? ls : 0;
      ctx.textAlign = align;
      mode === "stroke" ? ctx.strokeText(s, x + shift, y) : ctx.fillText(s, x + shift, y);
      ctx.letterSpacing = "0px";
      return;
    }
    const total = measure(ctx, s, ls);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    ctx.textAlign = "left";
    for (const ch of s) {
      mode === "stroke" ? ctx.strokeText(ch, cx, y) : ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + ls;
    }
  }

  /* Half-width available inside a bubble at vertical offset y (local coords). */
  function bubbleHalfWidth(b, g, y) {
    const pad = b.padding != null ? b.padding : 10;
    const boxy = g.shape === "rect" || g.shape === "roundrect" || g.shape === "chamfer";
    if (boxy) {
      const hy = g.ry - pad;
      if (Math.abs(y) > hy) return 0;
      let hw = g.rx - pad - (g.shape === "chamfer" ? Math.min(g.rx, g.ry) * 0.2 : 0);
      return Math.max(0, hw);
    }
    const k = g.shape === "cloud" ? 0.8 : g.shape === "burst" ? 0.74 : g.shape === "zigzag" ? 0.9 : 0.97;
    const rx = g.rx * k - pad, ry = g.ry * k - pad * 0.6;
    if (rx <= 0 || ry <= 0 || Math.abs(y) >= ry) return 0;
    return rx * Math.sqrt(1 - (y * y) / (ry * ry));
  }

  /* Lay out bubble text: returns { lines, lh, size, fits }. */
  function layoutBubble(ctx, b, g) {
    const text = prepText(b);
    const size = b.fontSize || 16;
    ctx.font = fontString(b, size);
    const lh = size * (b.lineHeight || 1.15);
    const ls = (b.letterSpacing || 0) * size;
    const boxy = g.shape === "rect" || g.shape === "roundrect" || g.shape === "chamfer";
    let lines = [""];
    let fits = true;
    for (let n = 1; n <= 60; n++) {
      const H = n * lh;
      const widthFor = (i) => {
        if (boxy) return 2 * bubbleHalfWidth(b, g, 0);
        const yTop = -H / 2 + i * lh, yBot = yTop + lh;
        const hw = Math.min(bubbleHalfWidth(b, g, yTop + lh * 0.15), bubbleHalfWidth(b, g, yBot - lh * 0.15));
        return Math.max(size * 1.2, hw * 2);
      };
      lines = wrap(ctx, text, ls, widthFor);
      if (lines.length <= n) {
        const pad = b.padding != null ? b.padding : 10;
        const availH = boxy ? g.ry * 2 - pad * 2 : (g.ry * 2 - pad * 1.2) * (g.shape === "cloud" ? 0.8 : g.shape === "burst" ? 0.74 : 0.97);
        fits = lines.length * lh <= availH + 0.5;
        for (let i = 0; i < lines.length && fits; i++) if (measure(ctx, lines[i], ls) > widthFor(i) + 0.5) fits = false;
        break;
      }
    }
    return { lines, lh, size, ls, fits };
  }

  function drawBubbleText(ctx, b, g) {
    const L = layoutBubble(ctx, b, g);
    ctx.fillStyle = b.color || "#111";
    ctx.textBaseline = "middle";
    const H = L.lines.length * L.lh;
    const align = b.align || "center";
    const boxy = g.shape === "rect" || g.shape === "roundrect" || g.shape === "chamfer";
    L.lines.forEach((line, i) => {
      const y = -H / 2 + (i + 0.5) * L.lh;
      let x = 0;
      if (align !== "center") {
        const hw = boxy ? bubbleHalfWidth(b, g, 0) : Math.min(bubbleHalfWidth(b, g, y - L.lh * 0.35), bubbleHalfWidth(b, g, y + L.lh * 0.35));
        x = align === "left" ? -hw : hw;
      }
      drawLine(ctx, line, x, y, L.ls, align, "fill");
    });
    return L;
  }

  /* Grow the bubble until its text fits (used after edits when autoGrow is on). */
  function fitBubble(b, ctx) {
    ctx = ctx || scratchCtx();
    for (let i = 0; i < 40; i++) {
      const g = bubbleGeometry(b);
      const L = layoutBubble(ctx, b, g);
      if (L.fits) return;
      const grow = Math.max(6, b.fontSize * 0.6);
      b.h += grow;
      b.y -= grow / 2;
      if (i % 3 === 2) { b.w += grow; b.x -= grow / 2; }
    }
  }
  let _scratch = null;
  function scratchCtx() {
    if (!_scratch) _scratch = CBS.makeCanvas(4, 4).getContext("2d");
    return _scratch;
  }

  /* ---------- plain text objects ---------- */
  function layoutText(ctx, o) {
    const text = prepText(o);
    const size = o.fontSize || 20;
    ctx.font = fontString(o, size);
    const lh = size * (o.lineHeight || 1.2);
    const ls = (o.letterSpacing || 0) * size;
    const pad = o.padding || 0;
    const lines = wrap(ctx, text, ls, () => Math.max(size, o.w - pad * 2));
    return { lines, lh, ls, size, pad, height: lines.length * lh + pad * 2 };
  }
  function drawText(ctx, o) {
    const L = layoutText(ctx, o);
    const left = -o.w / 2, top = -o.h / 2;
    if (o.bg && o.bg !== "transparent") {
      ctx.fillStyle = o.bg;
      ctx.fillRect(left, top, o.w, Math.max(o.h, L.height));
    }
    ctx.textBaseline = "middle";
    const align = o.align || "left";
    const x = align === "left" ? left + L.pad : align === "right" ? left + o.w - L.pad : 0;
    const passes = [];
    if (o.outlineWidth > 0) passes.push("stroke");
    passes.push("fill");
    for (const mode of passes) {
      ctx.save();
      if (mode === "stroke") {
        ctx.strokeStyle = o.outlineColor || "#fff";
        ctx.lineWidth = o.outlineWidth * 2;
        ctx.lineJoin = "round";
      } else {
        ctx.fillStyle = o.color || "#111";
        if (o.shadow) {
          ctx.shadowColor = CBS.withAlpha(o.shadowColor || "#000", 0.55);
          ctx.shadowBlur = L.size * 0.2;
          ctx.shadowOffsetX = L.size * 0.06;
          ctx.shadowOffsetY = L.size * 0.08;
        }
      }
      L.lines.forEach((line, i) => drawLine(ctx, line, x, top + L.pad + (i + 0.5) * L.lh, L.ls, align, mode));
      ctx.restore();
    }
    return L;
  }
  function fitTextHeight(o) {
    const L = layoutText(scratchCtx(), o);
    o.h = Math.max(L.size * 1.2, L.height);
  }

  /* ---------- sound effects ---------- */
  const SFX_DISTORT = {
    none: "None", arcUp: "Arc up", arcDown: "Arc down", wave: "Wave", bulge: "Bulge", pinch: "Pinch",
    grow: "Grow →", shrink: "Shrink →", shake: "Shake", staircase: "Staircase",
  };
  const SFX_PRESETS = [
    { id: "classic", label: "Classic Pow", font: "Bangers", fill: "#ffe14d", fill2: "#ff5a1f", gradient: true, outlineColor: "#111111", outlineWidth: 5, extrude: 7, extrudeAngle: 135, extrudeColor: "#b3261e", shadow: true, distort: "none", skew: -8, burst: false },
    { id: "burst", label: "Starburst", font: "Bangers", fill: "#ff3b3b", fill2: "#ffd43b", gradient: true, outlineColor: "#111111", outlineWidth: 5, extrude: 5, extrudeAngle: 120, extrudeColor: "#111111", shadow: false, distort: "bulge", distortAmount: 0.5, skew: 0, burst: true, burstColor: "#fff27a", burstStroke: "#111111" },
    { id: "electric", label: "Electric Zap", font: "Bungee", fill: "#e0fbff", fill2: "#22d3ee", gradient: true, outlineColor: "#0b2e6e", outlineWidth: 5, extrude: 6, extrudeAngle: 135, extrudeColor: "#1d4ed8", shadow: true, distort: "shake", distortAmount: 0.6, skew: -6, burst: false },
    { id: "boom", label: "Big Boom", font: "Luckiest Guy", fill: "#fff3b0", fill2: "#ff7a00", gradient: true, outlineColor: "#3b0d0d", outlineWidth: 6, extrude: 10, extrudeAngle: 150, extrudeColor: "#7c1d0f", shadow: true, distort: "arcUp", distortAmount: 0.55, skew: 0, burst: false },
    { id: "whoosh", label: "Speedy Whoosh", font: "Bangers", fill: "#ffffff", fill2: "#9ad7ff", gradient: true, outlineColor: "#0b2540", outlineWidth: 4, extrude: 4, extrudeAngle: 180, extrudeColor: "#2563eb", shadow: false, distort: "grow", distortAmount: 0.6, skew: -18, burst: false },
    { id: "spooky", label: "Spooky", font: "Creepster", fill: "#b6ff6b", fill2: "#2f9e44", gradient: true, outlineColor: "#140a24", outlineWidth: 4, extrude: 5, extrudeAngle: 90, extrudeColor: "#5b2a86", shadow: true, distort: "wave", distortAmount: 0.45, skew: 0, burst: false },
    { id: "crash", label: "Crash", font: "Luckiest Guy", fill: "#d9d9d9", fill2: "#7a7a7a", gradient: true, outlineColor: "#111111", outlineWidth: 5, extrude: 6, extrudeAngle: 120, extrudeColor: "#333333", shadow: true, distort: "staircase", distortAmount: 0.5, skew: 8, burst: false },
    { id: "pop", label: "Pop Art", font: "Bungee", fill: "#ff4fa3", fill2: "#ff4fa3", gradient: false, outlineColor: "#ffffff", outlineWidth: 4, extrude: 6, extrudeAngle: 135, extrudeColor: "#111111", shadow: false, distort: "none", skew: -4, burst: true, burstColor: "#22d3ee", burstStroke: "#111111" },
    { id: "ice", label: "Ice Blast", font: "Bangers", fill: "#ffffff", fill2: "#7dd3fc", gradient: true, outlineColor: "#0c4a6e", outlineWidth: 4, extrude: 7, extrudeAngle: 90, extrudeColor: "#38bdf8", shadow: false, distort: "pinch", distortAmount: 0.35, skew: 0, burst: false },
    { id: "marker", label: "Hand Drawn", font: "Permanent Marker", fill: "#111111", fill2: "#111111", gradient: false, outlineColor: "#ffffff", outlineWidth: 3, extrude: 0, extrudeAngle: 135, extrudeColor: "#111111", shadow: false, distort: "shake", distortAmount: 0.3, skew: 0, burst: false },
  ];
  const SFX_WORDS = ["POW!", "BAM!", "BOOM!", "CRASH!", "ZAP!", "WHAM!", "WHOOSH!", "KAPOW!", "SPLASH!", "THWACK!", "ZOOM!", "BANG!", "SMASH!", "KRAK!", "VROOM!", "ZING!", "BZZT!", "SPLAT!", "THUD!", "WOOSH!", "CLANG!", "SNAP!", "ROAR!", "BLAM!"];

  function sfxLayout(ctx, o) {
    const chars = Array.from(o.text || " ");
    const base = 100;
    ctx.font = `400 ${base}px ${fontStack(o.font)}`;
    const ls = (o.letterSpacing || 0) * base;
    const amt = o.distortAmount != null ? o.distortAmount : 0.5;
    const R = rng(o.id + (o.text || ""));
    const widths = chars.map((c) => ctx.measureText(c).width);
    const rawTotal = widths.reduce((s, w) => s + w, 0) + ls * Math.max(0, chars.length - 1);
    // per-glyph scale (depends on relative position)
    let cursor = -rawTotal / 2;
    const scales = chars.map((c, i) => {
      const t = rawTotal ? (cursor + widths[i] / 2) / (rawTotal / 2) : 0;
      cursor += widths[i] + ls;
      switch (o.distort) {
        case "bulge": return 1 + amt * 0.7 * (1 - t * t);
        case "pinch": return 1 + amt * 0.7 * (t * t) - amt * 0.25;
        case "grow": return 1 + amt * 0.55 * t;
        case "shrink": return 1 - amt * 0.55 * t;
        default: return 1;
      }
    });
    const total = widths.reduce((s, w, i) => s + w * scales[i], 0) + ls * Math.max(0, chars.length - 1);
    const maxScale = Math.max(...scales, 1);
    const extraH = { arcUp: 0.55, arcDown: 0.55, wave: 0.5, staircase: 0.6, shake: 0.25 }[o.distort] || 0;
    const outline = (o.outlineWidth || 0) / 60;
    const extrude = (o.extrude || 0) / 60;
    const padK = 2 * outline + extrude;
    const skewK = Math.abs(Math.tan(((o.skew || 0) * Math.PI) / 180)) * 0.85;
    const availW = Math.max(10, o.w * (o.burst ? 0.72 : 0.96));
    const availH = Math.max(10, o.h * (o.burst ? 0.62 : 0.94));
    // width & height (in units of the font size) that the word occupies
    const wUnits = total / base + padK + skewK;
    const hUnits = 0.82 * maxScale + amt * extraH + padK;
    const fs = Math.max(4, Math.min(availW / wUnits, availH / hUnits));
    const k = fs / base;
    const placements = [];
    let x = -(total * k) / 2;
    const half = (total * k) / 2 || 1;
    chars.forEach((ch, i) => {
      const cw = widths[i] * scales[i] * k;
      const cx = x + cw / 2;
      const t = cx / half;
      let y = 0, rot = 0;
      const A = amt * fs * 0.55;
      switch (o.distort) {
        case "arcUp": y = -A * (1 - t * t) + A / 2; rot = Math.atan((2 * A * t) / half); break;
        case "arcDown": y = A * (1 - t * t) - A / 2; rot = -Math.atan((2 * A * t) / half); break;
        case "wave": y = Math.sin(t * Math.PI * 1.5) * A * 0.6; rot = Math.atan(Math.cos(t * Math.PI * 1.5) * A * 0.6 * Math.PI * 1.5 / half); break;
        case "staircase": y = -t * A * 0.8; rot = 0; break;
        case "shake": y = (R() - 0.5) * fs * amt * 0.3; rot = (R() - 0.5) * amt * 0.7; break;
        default: break;
      }
      placements.push({ ch, x: cx, y, rot, s: scales[i] });
      x += cw + ls * k;
    });
    return { placements, fs, k };
  }

  function burstPath(w, h, seed) {
    const R = rng(seed);
    const n = 16;
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + (R() - 0.5) * 0.15;
      const k = i % 2 === 0 ? 0.98 - R() * 0.06 : 0.66 + R() * 0.08;
      pts.push([Math.cos(a) * (w / 2) * k, Math.sin(a) * (h / 2) * k]);
    }
    return polyPath(pts);
  }

  function drawSfx(ctx, o) {
    if (o.burst) {
      const p = burstPath(o.w, o.h, o.id);
      ctx.lineJoin = "miter";
      ctx.fillStyle = o.burstColor || "#fff";
      ctx.fill(p);
      if (o.burstStroke) { ctx.strokeStyle = o.burstStroke; ctx.lineWidth = Math.max(2, Math.min(o.w, o.h) * 0.018); ctx.stroke(p); }
    }
    const L = sfxLayout(ctx, o);
    const fs = L.fs;
    ctx.font = `400 ${fs}px ${fontStack(o.font)}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    const outline = ((o.outlineWidth || 0) * fs) / 60;
    const depth = ((o.extrude || 0) * fs) / 60;
    const ang = ((o.extrudeAngle != null ? o.extrudeAngle : 135) * Math.PI) / 180;
    const ex = Math.cos(ang), ey = Math.sin(ang);
    const skew = Math.tan(((o.skew || 0) * Math.PI) / 180);
    // shift so the extruded word stays centered in the box
    const ox = (-ex * depth) / 2, oy = (-ey * depth) / 2;

    const glyph = (pl, dx, dy, fn) => {
      ctx.save();
      ctx.translate(ox + dx, oy + dy);
      ctx.transform(1, 0, -skew, 1, 0, 0);
      ctx.translate(pl.x, pl.y);
      ctx.rotate(pl.rot);
      ctx.scale(pl.s, pl.s);
      fn();
      ctx.restore();
    };
    const each = (dx, dy, fn) => { for (const pl of L.placements) glyph(pl, dx, dy, () => fn(pl)); };

    // 1. drop shadow under the deepest extrusion
    if (o.shadow) {
      ctx.save();
      ctx.shadowColor = CBS.withAlpha(o.shadowColor || "#000", 0.5);
      ctx.shadowBlur = fs * 0.18;
      ctx.shadowOffsetX = fs * 0.05;
      ctx.shadowOffsetY = fs * 0.08;
      ctx.fillStyle = o.outlineColor || "#000";
      ctx.strokeStyle = o.outlineColor || "#000";
      ctx.lineWidth = outline * 2;
      each(ex * depth, ey * depth, (pl) => { if (outline > 0) ctx.strokeText(pl.ch, 0, 0); ctx.fillText(pl.ch, 0, 0); });
      ctx.restore();
    }
    // 2. extrusion
    if (depth > 0.5) {
      const steps = Math.min(48, Math.ceil(depth));
      ctx.strokeStyle = o.outlineColor || "#000";
      ctx.lineWidth = outline * 2;
      if (outline > 0) each(ex * depth, ey * depth, (pl) => ctx.strokeText(pl.ch, 0, 0));
      ctx.fillStyle = o.extrudeColor || "#333";
      ctx.strokeStyle = o.extrudeColor || "#333";
      ctx.lineWidth = Math.max(0, outline * 2 - 2);
      for (let s = steps; s >= 1; s--) {
        const d = (s / steps) * depth;
        each(ex * d, ey * d, (pl) => { if (outline > 1) ctx.strokeText(pl.ch, 0, 0); ctx.fillText(pl.ch, 0, 0); });
      }
    }
    // 3. outline
    if (outline > 0) {
      ctx.strokeStyle = o.outlineColor || "#000";
      ctx.lineWidth = outline * 2;
      each(0, 0, (pl) => ctx.strokeText(pl.ch, 0, 0));
    }
    // 4. face
    each(0, 0, (pl) => {
      if (o.gradient && o.fill2) {
        const g = ctx.createLinearGradient(0, -fs * 0.4, 0, fs * 0.4);
        g.addColorStop(0, o.fill || "#fff");
        g.addColorStop(1, o.fill2);
        ctx.fillStyle = g;
      } else ctx.fillStyle = o.fill || "#fff";
      ctx.fillText(pl.ch, 0, 0);
    });
  }

  CBS.lettering = {
    BUBBLE_TYPES, BUBBLE_STYLES, BUBBLE_SHAPES, TAIL_STYLES, SFX_DISTORT, SFX_PRESETS, SFX_WORDS,
    resolveBubble, applyBubbleType, bubbleGeometry, drawBubbleShape, drawBubbleText, layoutBubble, fitBubble,
    layoutText, drawText, fitTextHeight, drawSfx, fontString, roundRectPath, polyPath, wrap, measure,
  };
})();
