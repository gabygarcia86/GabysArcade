/* Scene renderer. One code path draws pages for the editor, thumbnails, the reader and exports.
 * drawPage(ctx, page, opts) expects ctx to be scaled so 1 unit = 1 doc unit.
 * opts: { scale, transparent, hideText:objId, layerOffsets:{layerId:{dx,dy}}, editing:bool } */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { clamp, rng, DEG } = CBS;
  const L = () => CBS.lettering;

  /* ---------- transforms ---------- */
  function center(o) { return { x: o.x + o.w / 2, y: o.y + o.h / 2 }; }
  function applyTransform(ctx, o, withFlip = true) {
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    if (o.rot) ctx.rotate(o.rot * DEG);
    if (withFlip && (o.flipX || o.flipY)) ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
  }
  function localToPage(o, lx, ly) {
    const c = center(o);
    const a = (o.rot || 0) * DEG;
    const cs = Math.cos(a), sn = Math.sin(a);
    return { x: c.x + lx * cs - ly * sn, y: c.y + lx * sn + ly * cs };
  }
  function pageToLocal(o, px, py) {
    const c = center(o);
    const a = -(o.rot || 0) * DEG;
    const dx = px - c.x, dy = py - c.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  function corners(o) {
    return [[-o.w / 2, -o.h / 2], [o.w / 2, -o.h / 2], [o.w / 2, o.h / 2], [-o.w / 2, o.h / 2]].map(([x, y]) => localToPage(o, x, y));
  }
  function aabb(o) {
    const pts = corners(o);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    if (o.kind === "bubble" && o.tailOn && o.tail) {
      const t = localToPage(o, o.tail.x, o.tail.y);
      x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------- panels ---------- */
  function panelLocalPoints(o) {
    if (o.shape === "poly" && o.pts && o.pts.length >= 3) return o.pts.map(([u, v]) => [(u - 0.5) * o.w, (v - 0.5) * o.h]);
    return [[-o.w / 2, -o.h / 2], [o.w / 2, -o.h / 2], [o.w / 2, o.h / 2], [-o.w / 2, o.h / 2]];
  }
  function panelPagePoints(o) { return panelLocalPoints(o).map(([x, y]) => { const p = localToPage(o, x, y); return [p.x, p.y]; }); }

  /* Offset a polygon inward by d (works well for convex shapes, acceptable for mild concavity). */
  function insetPolygon(pts, d) {
    if (!d) return pts;
    const n = pts.length;
    let area = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sgn = area > 0 ? 1 : -1;
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const nx = -dy * sgn, ny = dx * sgn;
      lines.push({ px: a[0] + nx * d, py: a[1] + ny * d, dx, dy });
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const l1 = lines[(i - 1 + n) % n], l2 = lines[i];
      const den = l1.dx * l2.dy - l1.dy * l2.dx;
      if (Math.abs(den) < 1e-9) { out.push([l2.px, l2.py]); continue; }
      const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
      out.push([l1.px + l1.dx * t, l1.py + l1.dy * t]);
    }
    return out;
  }

  function panelPath(o, inset = 0) {
    const p = new Path2D();
    if (o.shape !== "poly") {
      const w = Math.max(1, o.w - inset * 2), h = Math.max(1, o.h - inset * 2);
      L().roundRectPath(p, -w / 2, -h / 2, w, h, Math.max(0, (o.radius || 0) - inset));
      return p;
    }
    const pts = insetPolygon(panelLocalPoints(o), inset);
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  }

  /* Clip ctx to a panel's interior. The clip survives the transform reset. */
  function clipToPanel(ctx, panel) {
    const m = ctx.getTransform();
    applyTransform(ctx, panel, false);
    ctx.clip(panelPath(panel, (panel.borderWidth || 0) / 2));
    ctx.setTransform(m);
  }

  function drawPanel(ctx, o) {
    const path = panelPath(o);
    if (o.fill && o.fill !== "transparent") { ctx.fillStyle = o.fill; ctx.fill(path); }
    if (o.borderWidth > 0) {
      ctx.strokeStyle = o.borderColor || "#111";
      ctx.lineWidth = o.borderWidth;
      ctx.lineJoin = o.radius > 0 ? "round" : "miter";
      ctx.miterLimit = 6;
      ctx.stroke(path);
    }
  }

  /* ---------- shapes ---------- */
  const SHAPES = {
    rect: "Rectangle", ellipse: "Ellipse", triangle: "Triangle", ngon: "Polygon", star: "Star", burst: "Burst",
    arrow: "Arrow", heart: "Heart", line: "Line", poly: "Custom polygon", focus: "Focus lines", speed: "Speed lines",
  };
  function shapePath(o) {
    const w = o.w, h = o.h, p = new Path2D();
    const rx = w / 2, ry = h / 2;
    switch (o.shape) {
      case "ellipse": p.ellipse(0, 0, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); break;
      case "triangle": return L().polyPath([[0, -ry], [rx, ry], [-rx, ry]]);
      case "ngon": {
        const n = clamp(o.sides || 6, 3, 24), pts = [];
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; pts.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
        return L().polyPath(pts);
      }
      case "star": {
        const n = clamp(o.sides || 5, 3, 24), k = clamp(o.innerRatio || 0.45, 0.1, 0.95), pts = [];
        for (let i = 0; i < n * 2; i++) {
          const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
          const r = i % 2 ? k : 1;
          pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
        }
        return L().polyPath(pts);
      }
      case "burst": {
        const n = clamp(o.sides || 14, 6, 40), k = clamp(o.innerRatio || 0.7, 0.2, 0.95), R = rng(o.id), pts = [];
        for (let i = 0; i < n * 2; i++) {
          const a = (i / (n * 2)) * Math.PI * 2 + (R() - 0.5) * 0.18;
          const r = i % 2 ? k * (0.92 + R() * 0.16) : 0.9 + R() * 0.1;
          pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
        }
        return L().polyPath(pts);
      }
      case "arrow": {
        const sh = ry * 0.45, hx = rx - Math.min(w * 0.42, h * 0.9);
        return L().polyPath([[-rx, -sh], [hx, -sh], [hx, -ry], [rx, 0], [hx, ry], [hx, sh], [-rx, sh]]);
      }
      case "heart": {
        p.moveTo(0, ry);
        p.bezierCurveTo(-rx * 1.25, ry * 0.15, -rx * 0.9, -ry * 1.1, 0, -ry * 0.45);
        p.bezierCurveTo(rx * 0.9, -ry * 1.1, rx * 1.25, ry * 0.15, 0, ry);
        p.closePath();
        break;
      }
      case "line":
      case "poly": {
        const pts = (o.pts || [[0, 0], [1, 1]]).map(([u, v]) => [(u - 0.5) * w, (v - 0.5) * h]);
        pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        if (o.shape === "poly") p.closePath();
        break;
      }
      default: L().roundRectPath(p, -rx, -ry, w, h, o.radius || 0);
    }
    return p;
  }

  function drawFocusLines(ctx, o) {
    const R = rng(o.id);
    const n = clamp(o.sides || 60, 8, 240);
    const k = clamp(o.innerRatio || 0.45, 0.05, 0.95);
    const rx = o.w / 2, ry = o.h / 2;
    const far = Math.hypot(rx, ry) * 1.05;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-rx, -ry, o.w, o.h);
    ctx.clip();
    ctx.fillStyle = o.stroke || "#111";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.05;
      const spread = ((Math.PI * 2) / n) * (0.18 + R() * 0.32);
      const inner = k * (0.85 + R() * 0.35);
      const ix = Math.cos(a) * rx * inner, iy = Math.sin(a) * ry * inner;
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(Math.cos(a - spread) * far, Math.sin(a - spread) * far);
      ctx.lineTo(Math.cos(a + spread) * far, Math.sin(a + spread) * far);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function drawSpeedLines(ctx, o) {
    const R = rng(o.id);
    const n = clamp(o.sides || 28, 3, 200);
    const rx = o.w / 2, ry = o.h / 2;
    ctx.fillStyle = o.stroke || "#111";
    for (let i = 0; i < n; i++) {
      const y = -ry + (o.h * (i + 0.5)) / n + (R() - 0.5) * (o.h / n) * 0.8;
      const len = o.w * (0.35 + R() * 0.65);
      const x0 = rx - len;
      const th = Math.max(0.6, (o.strokeWidth || 3) * (0.4 + R() * 0.9));
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(rx, y - th / 2);
      ctx.lineTo(rx, y + th / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  function setDash(ctx, dash, w) {
    if (dash === "dashed") ctx.setLineDash([w * 3, w * 2]);
    else if (dash === "dotted") ctx.setLineDash([0.1, w * 2]);
    else ctx.setLineDash([]);
  }

  function drawShape(ctx, o) {
    if (o.shape === "focus") return drawFocusLines(ctx, o);
    if (o.shape === "speed") return drawSpeedLines(ctx, o);
    const p = shapePath(o);
    const isLine = o.shape === "line";
    if (!isLine && o.fillOn && o.fill) { ctx.fillStyle = o.fill; ctx.fill(p); }
    if (o.strokeWidth > 0 && o.stroke) {
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      setDash(ctx, o.dash, o.strokeWidth);
      ctx.stroke(p);
      ctx.setLineDash([]);
      if (isLine && o.arrowEnd && o.pts && o.pts.length >= 2) {
        const pts = o.pts.map(([u, v]) => [(u - 0.5) * o.w, (v - 0.5) * o.h]);
        const a = pts[pts.length - 2], b = pts[pts.length - 1];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const s = Math.max(10, o.strokeWidth * 4);
        ctx.fillStyle = o.stroke;
        ctx.beginPath();
        ctx.moveTo(b[0] + Math.cos(ang) * s * 0.3, b[1] + Math.sin(ang) * s * 0.3);
        ctx.lineTo(b[0] + Math.cos(ang + 2.6) * s, b[1] + Math.sin(ang + 2.6) * s);
        ctx.lineTo(b[0] + Math.cos(ang - 2.6) * s, b[1] + Math.sin(ang - 2.6) * s);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /* ---------- images, filters & comic effects ---------- */
  const FILTER_DEFAULTS = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0, invert: 0 };
  const IMAGE_EFFECTS = { none: "None", posterize: "Posterize", halftone: "Halftone dots", comic: "Comic ink", noir: "Noir" };
  const FILTER_PRESETS = {
    none: { label: "Original", f: {} },
    noir: { label: "Noir", f: { grayscale: 100, contrast: 140, brightness: 95 } },
    vintage: { label: "Vintage", f: { sepia: 70, contrast: 110, saturate: 80 } },
    pop: { label: "Pop", f: { saturate: 180, contrast: 125 } },
    cool: { label: "Cool night", f: { hue: 190, saturate: 110, brightness: 85 } },
    dream: { label: "Dreamy", f: { blur: 1.5, brightness: 115, saturate: 120 } },
    faded: { label: "Faded", f: { contrast: 75, brightness: 115, saturate: 70 } },
  };

  const canvasFilterSupported = (() => {
    try {
      const c = CBS.makeCanvas(1, 1);
      const x = c.getContext("2d");
      if (typeof x.filter !== "string") return false;
      x.filter = "invert(1)";
      x.fillStyle = "#000";
      x.fillRect(0, 0, 1, 1);
      return x.getImageData(0, 0, 1, 1).data[0] > 200;
    } catch (e) { return false; }
  })();

  function filterKey(f) {
    if (!f) return "";
    let k = "";
    for (const n in FILTER_DEFAULTS) if ((f[n] ?? FILTER_DEFAULTS[n]) !== FILTER_DEFAULTS[n]) k += n + f[n] + ";";
    return k;
  }
  function cssFilter(f, scale) {
    const v = (n) => (f[n] ?? FILTER_DEFAULTS[n]);
    const parts = [];
    if (v("brightness") !== 100) parts.push(`brightness(${v("brightness")}%)`);
    if (v("contrast") !== 100) parts.push(`contrast(${v("contrast")}%)`);
    if (v("saturate") !== 100) parts.push(`saturate(${v("saturate")}%)`);
    if (v("grayscale")) parts.push(`grayscale(${v("grayscale")}%)`);
    if (v("sepia")) parts.push(`sepia(${v("sepia")}%)`);
    if (v("hue")) parts.push(`hue-rotate(${v("hue")}deg)`);
    if (v("invert")) parts.push(`invert(${v("invert")}%)`);
    if (v("blur")) parts.push(`blur(${(v("blur") * (scale || 1)).toFixed(2)}px)`);
    return parts.join(" ") || "none";
  }

  /* Pixel-level fallback for browsers without ctx.filter (color matrix + cheap blur). */
  function manualFilter(src, f) {
    const maxD = 1600;
    const k = Math.min(1, maxD / Math.max(src.width, src.height));
    const c = CBS.makeCanvas(src.width * k, src.height * k);
    const x = c.getContext("2d");
    x.drawImage(src, 0, 0, c.width, c.height);
    const id = x.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const v = (n) => (f[n] ?? FILTER_DEFAULTS[n]);
    const br = v("brightness") / 100, ct = v("contrast") / 100, sat = v("saturate") / 100;
    const gs = v("grayscale") / 100, sp = v("sepia") / 100, inv = v("invert") / 100;
    const hue = v("hue") * DEG, ch = Math.cos(hue), sh = Math.sin(hue);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      r *= br; g *= br; b *= br;
      r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; b = (b - 128) * ct + 128;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const s2 = sat * (1 - gs);
      r = l + (r - l) * s2; g = l + (g - l) * s2; b = l + (b - l) * s2;
      if (sp) {
        const sr = r * 0.393 + g * 0.769 + b * 0.189, sg = r * 0.349 + g * 0.686 + b * 0.168, sb = r * 0.272 + g * 0.534 + b * 0.131;
        r += (sr - r) * sp; g += (sg - g) * sp; b += (sb - b) * sp;
      }
      if (hue) {
        const nr = r * (0.213 + ch * 0.787 - sh * 0.213) + g * (0.715 - ch * 0.715 - sh * 0.715) + b * (0.072 - ch * 0.072 + sh * 0.928);
        const ng = r * (0.213 - ch * 0.213 + sh * 0.143) + g * (0.715 + ch * 0.285 + sh * 0.14) + b * (0.072 - ch * 0.072 - sh * 0.283);
        const nb = r * (0.213 - ch * 0.213 - sh * 0.787) + g * (0.715 - ch * 0.715 + sh * 0.715) + b * (0.072 + ch * 0.928 + sh * 0.072);
        r = nr; g = ng; b = nb;
      }
      if (inv) { r += (255 - 2 * r) * inv; g += (255 - 2 * g) * inv; b += (255 - 2 * b) * inv; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    x.putImageData(id, 0, 0);
    if (v("blur") > 0) {
      const q = Math.max(1, Math.round(v("blur") * 2));
      const small = CBS.makeCanvas(c.width / (q + 1), c.height / (q + 1));
      small.getContext("2d").drawImage(c, 0, 0, small.width, small.height);
      x.clearRect(0, 0, c.width, c.height);
      x.imageSmoothingQuality = "high";
      x.drawImage(small, 0, 0, c.width, c.height);
    }
    return c;
  }

  function applyEffect(src, effect) {
    const maxD = 1400;
    const k = Math.min(1, maxD / Math.max(src.width || 1, src.height || 1));
    const W = Math.max(1, Math.round((src.width || 1) * k)), H = Math.max(1, Math.round((src.height || 1) * k));
    const c = CBS.makeCanvas(W, H);
    const x = c.getContext("2d");
    x.drawImage(src, 0, 0, W, H);
    const id = x.getImageData(0, 0, W, H);
    const d = id.data;
    if (effect === "posterize" || effect === "comic" || effect === "noir") {
      const levels = effect === "noir" ? 3 : 4;
      const step = 255 / (levels - 1);
      const lum = new Float32Array(W * H);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        lum[p] = l;
        if (effect === "noir") { const q = Math.round(((l - 128) * 1.4 + 128) / step) * step; r = g = b = q; }
        else {
          // boost saturation a bit, then quantize each channel
          r = l + (r - l) * 1.35; g = l + (g - l) * 1.35; b = l + (b - l) * 1.35;
          r = Math.round(r / step) * step; g = Math.round(g / step) * step; b = Math.round(b / step) * step;
        }
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
      if (effect === "comic" || effect === "noir") {
        // Sobel edges painted as ink lines
        const thr = effect === "noir" ? 120 : 90;
        for (let y = 1; y < H - 1; y++) {
          for (let xx = 1; xx < W - 1; xx++) {
            const p = y * W + xx;
            const gx = -lum[p - W - 1] - 2 * lum[p - 1] - lum[p + W - 1] + lum[p - W + 1] + 2 * lum[p + 1] + lum[p + W + 1];
            const gy = -lum[p - W - 1] - 2 * lum[p - W] - lum[p - W + 1] + lum[p + W - 1] + 2 * lum[p + W] + lum[p + W + 1];
            if (Math.hypot(gx, gy) > thr) { const i = p * 4; d[i] = d[i + 1] = d[i + 2] = 15; }
          }
        }
      }
      x.putImageData(id, 0, 0);
      return c;
    }
    if (effect === "halftone") {
      const cell = Math.max(4, Math.round(Math.max(W, H) / 110));
      x.fillStyle = "#fffdf5";
      x.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += cell) {
        for (let xx = 0; xx < W; xx += cell) {
          let r = 0, g = 0, b = 0, a = 0, n = 0;
          for (let yy = y; yy < Math.min(H, y + cell); yy += 2) for (let x2 = xx; x2 < Math.min(W, xx + cell); x2 += 2) {
            const i = (yy * W + x2) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; n++;
          }
          if (!n || a / n < 10) continue;
          r /= n; g /= n; b /= n;
          const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          const rad = (cell / 2) * Math.sqrt(1 - l) * 1.35;
          if (rad < 0.3) continue;
          const m = Math.max(r, g, b) || 1, boost = Math.min(1.6, 255 / m);
          x.fillStyle = `rgb(${r * boost * 0.85},${g * boost * 0.85},${b * boost * 0.85})`;
          x.beginPath();
          x.arc(xx + cell / 2, y + cell / 2, rad, 0, Math.PI * 2);
          x.fill();
        }
      }
      return c;
    }
    return c;
  }

  const sourceCache = new Map(); // key -> canvas (LRU)
  function cachedSource(key, make) {
    if (sourceCache.has(key)) {
      const v = sourceCache.get(key);
      sourceCache.delete(key);
      sourceCache.set(key, v);
      return v;
    }
    const v = make();
    sourceCache.set(key, v);
    while (sourceCache.size > 24) sourceCache.delete(sourceCache.keys().next().value);
    return v;
  }

  function imageSource(o, img) {
    let src = img;
    if (o.effect && o.effect !== "none") src = cachedSource("fx:" + o.assetId + ":" + o.effect, () => applyEffect(img, o.effect));
    const fk = filterKey(o.filters);
    if (fk && !canvasFilterSupported) {
      const base = src;
      src = cachedSource("mf:" + o.assetId + ":" + (o.effect || "") + ":" + fk, () => manualFilter(base, o.filters));
    }
    return src;
  }

  function drawImageObj(ctx, o, opts) {
    const img = CBS.assets.image(o.assetId);
    if (!img) {
      if (opts.editing) {
        ctx.fillStyle = "rgba(120,130,200,0.18)";
        ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
        ctx.strokeStyle = "rgba(120,130,200,0.6)";
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
        ctx.setLineDash([]);
      }
      return;
    }
    const src = imageSource(o, img);
    const iw = src.width || src.naturalWidth || 1, ih = src.height || src.naturalHeight || 1;
    const c = o.crop || { l: 0, t: 0, r: 0, b: 0 };
    const sx = c.l * iw, sy = c.t * ih;
    const sw = Math.max(1, (1 - c.l - c.r) * iw), sh = Math.max(1, (1 - c.t - c.b) * ih);
    const fk = filterKey(o.filters);
    if (fk && canvasFilterSupported) ctx.filter = cssFilter(o.filters, opts.scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, sx, sy, sw, sh, -o.w / 2, -o.h / 2, o.w, o.h);
    if (fk && canvasFilterSupported) ctx.filter = "none";
  }

  /* ---------- objects & pages ---------- */
  function drawObject(ctx, o, page, opts = {}) {
    ctx.save();
    ctx.globalAlpha *= o.opacity == null ? 1 : o.opacity;
    if (o.kind === "image" && o.clip) {
      const panel = CBS.doc.obj(o.clip, page);
      if (panel) clipToPanel(ctx, panel);
    }
    const flips = o.kind === "image" || o.kind === "shape" || o.kind === "panel";
    applyTransform(ctx, o, flips);
    try {
      switch (o.kind) {
        case "panel": drawPanel(ctx, o); break;
        case "image": drawImageObj(ctx, o, opts); break;
        case "shape": drawShape(ctx, o); break;
        case "bubble": {
          const g = L().drawBubbleShape(ctx, o);
          if (opts.hideText !== o.id) L().drawBubbleText(ctx, o, g);
          break;
        }
        case "text": if (opts.hideText !== o.id) L().drawText(ctx, o); break;
        case "sfx": if (opts.hideText !== o.id) L().drawSfx(ctx, o); break;
        default: break;
      }
    } catch (e) { console.warn("draw failed", o.kind, e); }
    ctx.restore();
  }

  /* Effective visibility/opacity, honoring layer groups (folders). */
  function groupState(page, layer) {
    if (!layer.group || !page.groups) return { visible: true, opacity: 1 };
    const g = page.groups[layer.group];
    return g ? { visible: g.visible !== false, opacity: g.opacity == null ? 1 : g.opacity } : { visible: true, opacity: 1 };
  }

  function drawPage(ctx, page, opts = {}) {
    const size = CBS.doc.size;
    if (!opts.transparent) {
      ctx.fillStyle = page.background || "#ffffff";
      ctx.fillRect(0, 0, size.w, size.h);
    }
    for (const layer of page.layers) {
      const gs = groupState(page, layer);
      if (!layer.visible || !gs.visible) continue;
      if (layer.noExport && !opts.editing) continue;
      if (opts.onlyLayer && opts.onlyLayer !== layer.id) continue;
      ctx.save();
      ctx.globalAlpha = (layer.opacity == null ? 1 : layer.opacity) * gs.opacity;
      const off = opts.layerOffsets && opts.layerOffsets[layer.id];
      if (off) ctx.translate(off.dx, off.dy);
      if (layer.type === "drawing") {
        const c = CBS.raster.canvasFor(layer);
        if (c) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(c, 0, 0, size.w, size.h);
        }
      }
      for (const o of layer.objects) {
        if (opts.skip && opts.skip.has(o.id)) continue;
        drawObject(ctx, o, page, opts);
      }
      ctx.restore();
    }
  }

  /* Render a page to a fresh canvas at `scale` pixels per doc unit. */
  function pageCanvas(page, scale, opts = {}) {
    const size = CBS.doc.size;
    const c = CBS.makeCanvas(size.w * scale, size.h * scale);
    const ctx = c.getContext("2d");
    ctx.scale(c.width / size.w, c.height / size.h);
    drawPage(ctx, page, Object.assign({ scale }, opts));
    return c;
  }

  CBS.render = {
    SHAPES, FILTER_DEFAULTS, FILTER_PRESETS, IMAGE_EFFECTS, canvasFilterSupported,
    center, applyTransform, localToPage, pageToLocal, corners, aabb,
    panelLocalPoints, panelPagePoints, panelPath, insetPolygon, clipToPanel, shapePath,
    drawObject, drawPage, pageCanvas, groupState, applyEffect,
  };
})();
