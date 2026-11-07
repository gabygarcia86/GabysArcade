/* Drawing layers: pixel storage, brushes, flood fill and pixel moves.
 * Each drawing layer owns a raster (canvas) at RASTER_SCALE x the page size (200 DPI).
 * While a stroke is in progress it is painted into `buffer`, and the editor shows
 * `working` = backup (+/-) buffer, so stroke opacity doesn't stack and the eraser previews live.
 * Undo stores only the changed rectangle. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { clamp, makeCanvas, hexToRgb, bus } = CBS;
  const RS = CBS.RASTER_SCALE;

  const rasters = new Map(); // id -> { canvas, ctx, blank, url }

  function dims() {
    const s = CBS.doc.size;
    return { W: Math.round(s.w * RS), H: Math.round(s.h * RS) };
  }

  function get(id, create = true) {
    let r = rasters.get(id);
    if (!r && create) {
      const { W, H } = dims();
      const canvas = makeCanvas(W, H);
      r = { canvas, ctx: canvas.getContext("2d", { willReadFrequently: false }), blank: true, url: null };
      rasters.set(id, r);
    }
    return r || null;
  }
  function touched(r) { r.blank = false; r.url = null; }

  const BRUSHES = {
    pencil: { label: "Pencil", icon: "✏️", size: 3, hardness: 1, opacity: 0.9, pressure: true, tip: "Thin, grainy sketch lines" },
    pen: { label: "Ink Pen", icon: "🖋️", size: 5, hardness: 1, opacity: 1, pressure: true, tip: "Smooth inking that tapers with pressure or speed" },
    brush: { label: "Brush", icon: "🖌️", size: 14, hardness: 0.7, opacity: 1, pressure: true, tip: "Soft or hard painting brush" },
    marker: { label: "Marker", icon: "🖍️", size: 18, hardness: 0.95, opacity: 0.6, pressure: false, tip: "Flat see-through color that doesn't darken while you scribble" },
    airbrush: { label: "Airbrush", icon: "💨", size: 40, hardness: 0, opacity: 0.8, pressure: true, tip: "Builds up soft color while you hold it" },
    eraser: { label: "Eraser", icon: "🩹", size: 24, hardness: 0.9, opacity: 1, pressure: false, tip: "Erase pixels on drawing layers" },
  };

  /* shared stroke buffers */
  let buffer = null, working = null, backup = null;
  function ensureBuffers() {
    const { W, H } = dims();
    for (const name of ["buffer", "working", "backup"]) {
      const cur = name === "buffer" ? buffer : name === "working" ? working : backup;
      if (!cur || cur.width !== W || cur.height !== H) {
        const c = makeCanvas(W, H);
        if (name === "buffer") buffer = c; else if (name === "working") working = c; else backup = c;
      }
    }
  }

  const spriteCache = new Map();
  function dabSprite(diam, hardness, color) {
    const d = Math.max(1, Math.round(diam));
    const key = d + "|" + hardness.toFixed(2) + "|" + color;
    let s = spriteCache.get(key);
    if (s) return s;
    const size = d + 2;
    s = makeCanvas(size, size);
    const x = s.getContext("2d");
    const { r, g, b } = hexToRgb(color);
    const rad = d / 2;
    if (hardness >= 0.99) {
      x.fillStyle = color;
      x.beginPath();
      x.arc(size / 2, size / 2, rad, 0, Math.PI * 2);
      x.fill();
    } else {
      const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, rad);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gr.addColorStop(clamp(hardness, 0, 0.98), `rgba(${r},${g},${b},1)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr;
      x.fillRect(0, 0, size, size);
    }
    spriteCache.set(key, s);
    if (spriteCache.size > 300) spriteCache.delete(spriteCache.keys().next().value);
    return s;
  }
  const grainCache = new Map();
  function pencilPattern(ctx, color) {
    let c = grainCache.get(color);
    if (!c) {
      c = makeCanvas(64, 64);
      const x = c.getContext("2d");
      const id = x.createImageData(64, 64);
      const { r, g, b } = hexToRgb(color);
      for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = r; id.data[i + 1] = g; id.data[i + 2] = b;
        id.data[i + 3] = Math.random() < 0.82 ? 150 + Math.random() * 105 : Math.random() * 60;
      }
      x.putImageData(id, 0, 0);
      grainCache.set(color, c);
    }
    return ctx.createPattern(c, "repeat");
  }

  /* ---------- stroke engine ---------- */
  let active = null;

  function beginStroke(layer, pt, settings, clipPanel) {
    if (active) endStroke();
    ensureBuffers();
    const r = get(layer.rasterId);
    const { W, H } = dims();
    const bx = backup.getContext("2d");
    bx.globalCompositeOperation = "copy";
    bx.drawImage(r.canvas, 0, 0);
    bx.globalCompositeOperation = "source-over";
    const wx = working.getContext("2d");
    wx.globalCompositeOperation = "copy";
    wx.drawImage(r.canvas, 0, 0);
    wx.globalCompositeOperation = "source-over";
    const bctx = buffer.getContext("2d");
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, W, H);
    bctx.save();
    if (clipPanel) {
      bctx.setTransform(RS, 0, 0, RS, 0, 0);
      CBS.render.clipToPanel(bctx, clipPanel);
      bctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    const brush = settings.brush;
    active = {
      layerId: layer.id, rasterId: layer.rasterId, s: settings, brush, bctx,
      last: null, smooth: null, dirty: null, bbox: null, residue: 0, lastTime: performance.now(),
      airTimer: 0, current: null,
    };
    if (brush === "pencil") active.pattern = pencilPattern(bctx, settings.color);
    strokeTo(pt);
    if (brush === "airbrush") {
      active.airTimer = setInterval(() => { if (active && active.current) { spray(active.current, 0.6); flush(); } }, 30);
    }
  }

  function pressureOf(pt) {
    const s = active.s;
    if (!s.pressure) return 1;
    if (pt.pointerType === "pen" && pt.pressure > 0) return clamp(pt.pressure, 0.05, 1);
    return 1;
  }

  function addDirty(x, y, rad) {
    const x0 = Math.floor(x - rad - 2), y0 = Math.floor(y - rad - 2), x1 = Math.ceil(x + rad + 2), y1 = Math.ceil(y + rad + 2);
    const grow = (r) => r ? { x0: Math.min(r.x0, x0), y0: Math.min(r.y0, y0), x1: Math.max(r.x1, x1), y1: Math.max(r.y1, y1) } : { x0, y0, x1, y1 };
    active.dirty = grow(active.dirty);
    active.bbox = grow(active.bbox);
  }

  function spray(p, k) {
    const s = active.s;
    const pr = pressureOf(p);
    const diam = s.size * RS * (0.6 + 0.4 * pr);
    const ctx = active.bctx;
    ctx.globalAlpha = 0.07 * k * pr;
    const sp = dabSprite(diam, 0, s.color);
    ctx.drawImage(sp, p.x * RS - sp.width / 2, p.y * RS - sp.height / 2);
    ctx.globalAlpha = 1;
    addDirty(p.x * RS, p.y * RS, diam / 2);
  }

  function strokeTo(rawPt) {
    if (!active) return;
    const s = active.s;
    const ctx = active.bctx;
    const sm = clamp(s.smoothing || 0, 0, 0.92);
    const pt = active.smooth
      ? { x: active.smooth.x + (rawPt.x - active.smooth.x) * (1 - sm), y: active.smooth.y + (rawPt.y - active.smooth.y) * (1 - sm), pressure: rawPt.pressure, pointerType: rawPt.pointerType }
      : { ...rawPt };
    active.smooth = pt;
    active.current = pt;
    const last = active.last;
    const X = pt.x * RS, Y = pt.y * RS;
    const pr = pressureOf(pt);
    const brush = active.brush;

    if (brush === "airbrush") {
      if (last) {
        const dd = Math.hypot(X - last.X, Y - last.Y);
        const step = Math.max(1, s.size * RS * 0.15);
        for (let t = step; t <= dd; t += step) spray({ x: (last.X + ((X - last.X) * t) / dd) / RS, y: (last.Y + ((Y - last.Y) * t) / dd) / RS, pressure: pt.pressure, pointerType: pt.pointerType }, 1);
      } else spray(pt, 1);
    } else if (brush === "brush" || brush === "eraser") {
      const diam = Math.max(1, s.size * RS * (brush === "brush" ? 0.25 + 0.75 * pr : 1));
      const sp = dabSprite(diam, s.hardness, brush === "eraser" ? "#000000" : s.color);
      const step = Math.max(0.6, diam * 0.12);
      if (!last) {
        ctx.drawImage(sp, X - sp.width / 2, Y - sp.height / 2);
      } else {
        const dd = Math.hypot(X - last.X, Y - last.Y);
        let t = step - active.residue;
        while (t <= dd) {
          const k = t / dd;
          const dm = Math.max(1, last.diam + (diam - last.diam) * k);
          const sp2 = Math.abs(dm - diam) < 1 ? sp : dabSprite(dm, s.hardness, brush === "eraser" ? "#000000" : s.color);
          ctx.drawImage(sp2, last.X + (X - last.X) * k - sp2.width / 2, last.Y + (Y - last.Y) * k - sp2.height / 2);
          t += step;
        }
        active.residue = dd - (t - step);
      }
      addDirty(X, Y, diam / 2);
      active.last = { X, Y, diam };
      flush();
      return;
    } else {
      // line-based brushes: pen, pencil, marker
      let width;
      const now = performance.now();
      if (brush === "pen") {
        let k = pr;
        if (!(pt.pointerType === "pen" && pt.pressure > 0) && s.pressure && last) {
          // simulate pressure from speed for mouse/touch: faster = thinner
          const v = Math.hypot(X - last.X, Y - last.Y) / Math.max(1, now - active.lastTime);
          const target = clamp(1.15 - v * 0.18, 0.35, 1);
          k = last.k != null ? last.k + (target - last.k) * 0.3 : target;
        }
        width = Math.max(0.6, s.size * RS * (0.2 + 0.8 * k));
        active.k = k;
      } else if (brush === "pencil") width = Math.max(0.8, s.size * RS * (0.45 + 0.55 * pr) * 0.6);
      else width = Math.max(1, s.size * RS);
      ctx.lineCap = brush === "marker" ? "square" : "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = brush === "pencil" ? active.pattern : s.color;
      ctx.fillStyle = ctx.strokeStyle;
      if (!last) {
        ctx.beginPath();
        if (brush === "marker") ctx.rect(X - width / 2, Y - width / 2, width, width);
        else ctx.arc(X, Y, width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = (width + last.width) / 2;
        ctx.beginPath();
        if (last.mx != null) {
          // quadratic smoothing through midpoints
          const mx = (last.X + X) / 2, my = (last.Y + Y) / 2;
          ctx.moveTo(last.mx, last.my);
          ctx.quadraticCurveTo(last.X, last.Y, mx, my);
          active.lastMid = { mx, my };
        } else {
          ctx.moveTo(last.X, last.Y);
          ctx.lineTo((last.X + X) / 2, (last.Y + Y) / 2);
        }
        ctx.stroke();
      }
      addDirty(X, Y, width / 2 + 2);
      const mid = last ? { mx: (last.X + X) / 2, my: (last.Y + Y) / 2 } : { mx: null, my: null };
      active.last = { X, Y, width, k: active.k, mx: mid.mx, my: mid.my };
      active.lastTime = now;
      flush();
      return;
    }
    active.last = { X, Y };
    flush();
  }

  /* Recompose the working canvas within the dirty rectangle. */
  let flushQueued = false;
  function flush() {
    if (flushQueued) return;
    flushQueued = true;
    requestAnimationFrame(() => {
      flushQueued = false;
      if (!active || !active.dirty) return;
      composeRect(active.dirty);
      active.dirty = null;
      bus.emit("render");
    });
  }
  function composeRect(d) {
    const { W, H } = dims();
    const x0 = clamp(d.x0, 0, W), y0 = clamp(d.y0, 0, H), x1 = clamp(d.x1, 0, W), y1 = clamp(d.y1, 0, H);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const wx = working.getContext("2d");
    wx.clearRect(x0, y0, w, h);
    wx.drawImage(backup, x0, y0, w, h, x0, y0, w, h);
    wx.globalAlpha = clamp(active.s.opacity == null ? 1 : active.s.opacity, 0, 1);
    wx.globalCompositeOperation = active.brush === "eraser" ? "destination-out" : "source-over";
    wx.drawImage(buffer, x0, y0, w, h, x0, y0, w, h);
    wx.globalAlpha = 1;
    wx.globalCompositeOperation = "source-over";
  }

  function endStroke() {
    if (!active) return false;
    const a = active;
    clearInterval(a.airTimer);
    if (a.dirty) composeRect(a.dirty);
    a.bctx.restore();
    const r = get(a.rasterId);
    const { W, H } = dims();
    let changed = false;
    if (a.bbox) {
      const x0 = clamp(a.bbox.x0, 0, W), y0 = clamp(a.bbox.y0, 0, H), x1 = clamp(a.bbox.x1, 0, W), y1 = clamp(a.bbox.y1, 0, H);
      const w = x1 - x0, h = y1 - y0;
      if (w > 0 && h > 0) {
        const before = backup.getContext("2d").getImageData(x0, y0, w, h);
        const after = working.getContext("2d").getImageData(x0, y0, w, h);
        r.ctx.putImageData(after, x0, y0);
        touched(r);
        CBS.history.pushRaster({ label: BRUSHES[a.brush] ? BRUSHES[a.brush].label + " stroke" : "Draw", rasterId: a.rasterId, x: x0, y: y0, before, after });
        changed = true;
      }
    }
    active = null;
    if (changed) CBS.doc.changed("raster");
    bus.emit("render");
    return changed;
  }
  function cancelStroke() {
    if (!active) return;
    clearInterval(active.airTimer);
    active.bctx.restore();
    active = null;
    bus.emit("render");
  }

  function canvasFor(layer) {
    if (active && active.layerId === layer.id) return working;
    const r = rasters.get(layer.rasterId);
    return r && !r.blank ? r.canvas : null;
  }

  /* ---------- pixel operations ---------- */
  function putPixels(id, img, x, y) {
    const r = get(id);
    r.ctx.putImageData(img, x, y);
    touched(r);
  }

  function snapshotAll(id) {
    const r = get(id);
    const { W, H } = dims();
    return r.ctx.getImageData(0, 0, W, H);
  }

  function recordWhole(id, label, fn) {
    const r = get(id);
    const { W, H } = dims();
    const before = r.ctx.getImageData(0, 0, W, H);
    fn(r);
    touched(r);
    const after = r.ctx.getImageData(0, 0, W, H);
    CBS.history.pushRaster({ label, rasterId: id, x: 0, y: 0, before, after });
    CBS.doc.changed("raster");
  }

  function clearLayer(layer) {
    const r = get(layer.rasterId, false);
    if (!r || r.blank) return;
    recordWhole(layer.rasterId, "Clear drawing layer", (rr) => rr.ctx.clearRect(0, 0, rr.canvas.width, rr.canvas.height));
  }

  function moveLayerPixels(layer, dx, dy) {
    if (!dx && !dy) return;
    const r = get(layer.rasterId, false);
    if (!r || r.blank) return;
    recordWhole(layer.rasterId, "Move drawing", (rr) => {
      const tmp = makeCanvas(rr.canvas.width, rr.canvas.height);
      tmp.getContext("2d").drawImage(rr.canvas, 0, 0);
      rr.ctx.clearRect(0, 0, rr.canvas.width, rr.canvas.height);
      rr.ctx.drawImage(tmp, Math.round(dx * RS), Math.round(dy * RS));
    });
  }

  function flipLayer(layer, horizontal) {
    const r = get(layer.rasterId, false);
    if (!r || r.blank) return;
    recordWhole(layer.rasterId, horizontal ? "Flip drawing" : "Flip drawing vertically", (rr) => {
      const tmp = makeCanvas(rr.canvas.width, rr.canvas.height);
      tmp.getContext("2d").drawImage(rr.canvas, 0, 0);
      rr.ctx.clearRect(0, 0, rr.canvas.width, rr.canvas.height);
      rr.ctx.save();
      if (horizontal) { rr.ctx.translate(rr.canvas.width, 0); rr.ctx.scale(-1, 1); }
      else { rr.ctx.translate(0, rr.canvas.height); rr.ctx.scale(1, -1); }
      rr.ctx.drawImage(tmp, 0, 0);
      rr.ctx.restore();
    });
  }

  /* Paint a canvas (e.g. a merged layer) into a raster with history. */
  function drawInto(layer, src, label, replace = false) {
    recordWhole(layer.rasterId, label || "Merge", (rr) => {
      if (replace) rr.ctx.clearRect(0, 0, rr.canvas.width, rr.canvas.height);
      rr.ctx.drawImage(src, 0, 0, rr.canvas.width, rr.canvas.height);
    });
  }

  function floodFill(layer, docPt, color, opts = {}) {
    const r = get(layer.rasterId);
    const { W, H } = dims();
    const sx = Math.floor(docPt.x * RS), sy = Math.floor(docPt.y * RS);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return false;
    let src;
    if (opts.sampleAll) {
      const c = CBS.render.pageCanvas(CBS.doc.page, RS);
      src = c.getContext("2d").getImageData(0, 0, W, H).data;
    } else src = r.ctx.getImageData(0, 0, W, H).data;
    const si = (sy * W + sx) * 4;
    const tr = src[si], tg = src[si + 1], tb = src[si + 2], ta = src[si + 3];
    const tol = clamp(opts.tolerance == null ? 32 : opts.tolerance, 0, 255);
    const match = (i) => {
      const p = i * 4;
      return Math.abs(src[p] - tr) <= tol && Math.abs(src[p + 1] - tg) <= tol && Math.abs(src[p + 2] - tb) <= tol && Math.abs(src[p + 3] - ta) <= tol;
    };
    const mask = new Uint8Array(W * H);
    const stack = [sx, sy];
    let minX = sx, maxX = sx, minY = sy, maxY = sy, count = 0;
    while (stack.length) {
      const y = stack.pop(), x0 = stack.pop();
      let x = x0;
      let i = y * W + x;
      while (x >= 0 && !mask[i] && match(i)) { x--; i--; }
      x++; i++;
      let up = false, down = false;
      while (x < W && !mask[i] && match(i)) {
        mask[i] = 1;
        count++;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (y > 0) { const u = i - W; if (!mask[u] && match(u)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
        if (y < H - 1) { const d = i + W; if (!mask[d] && match(d)) { if (!down) { stack.push(x, y + 1); down = true; } } else down = false; }
        x++; i++;
      }
    }
    if (!count) return false;
    // grow the fill under anti-aliased line edges
    const grow = clamp(opts.expand == null ? 2 : opts.expand, 0, 6);
    minX = Math.max(0, minX - grow); minY = Math.max(0, minY - grow); maxX = Math.min(W - 1, maxX + grow); maxY = Math.min(H - 1, maxY + grow);
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const out = new ImageData(bw, bh);
    const { r: cr, g: cg, b: cb } = hexToRgb(color);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let on = mask[y * W + x];
        if (!on && grow) {
          for (let dy = -grow; dy <= grow && !on; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -grow; dx <= grow; dx++) {
              const xx = x + dx;
              if (xx >= 0 && xx < W && mask[yy * W + xx] && dx * dx + dy * dy <= grow * grow) { on = 1; break; }
            }
          }
        }
        if (on) {
          const o = ((y - minY) * bw + (x - minX)) * 4;
          out.data[o] = cr; out.data[o + 1] = cg; out.data[o + 2] = cb; out.data[o + 3] = 255;
        }
      }
    }
    const before = r.ctx.getImageData(minX, minY, bw, bh);
    const tmp = makeCanvas(bw, bh);
    tmp.getContext("2d").putImageData(out, 0, 0);
    r.ctx.save();
    r.ctx.globalAlpha = clamp(opts.opacity == null ? 1 : opts.opacity, 0, 1);
    if (opts.clipPanel) {
      r.ctx.setTransform(RS, 0, 0, RS, 0, 0);
      CBS.render.clipToPanel(r.ctx, opts.clipPanel);
      r.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    r.ctx.drawImage(tmp, minX, minY);
    r.ctx.restore();
    touched(r);
    const after = r.ctx.getImageData(minX, minY, bw, bh);
    CBS.history.pushRaster({ label: "Fill", rasterId: layer.rasterId, x: minX, y: minY, before, after });
    CBS.doc.changed("raster");
    return true;
  }

  /* ---------- persistence ---------- */
  function toDataURL(id) {
    const r = rasters.get(id);
    if (!r || r.blank) return null;
    if (!r.url) r.url = r.canvas.toDataURL("image/png");
    return r.url;
  }
  async function load(id, dataURL) {
    if (!dataURL) return;
    const img = await CBS.loadImage(dataURL);
    const r = get(id);
    r.ctx.clearRect(0, 0, r.canvas.width, r.canvas.height);
    r.ctx.drawImage(img, 0, 0, r.canvas.width, r.canvas.height);
    r.blank = false;
    r.url = dataURL;
  }
  function clone(fromId, toId) {
    const src = rasters.get(fromId);
    if (!src || src.blank) return;
    const r = get(toId);
    r.ctx.drawImage(src.canvas, 0, 0);
    touched(r);
  }
  function isBlank(id) { const r = rasters.get(id); return !r || r.blank; }
  function reset() { rasters.clear(); active = null; buffer = working = backup = null; }
  function raw(id) { return get(id); }

  CBS.raster = {
    BRUSHES, dims, get: raw, canvasFor, beginStroke, strokeTo, endStroke, cancelStroke,
    get stroking() { return !!active; },
    putPixels, snapshotAll, clearLayer, moveLayerPixels, flipLayer, drawInto, floodFill,
    toDataURL, load, clone, isBlank, reset,
  };
})();
