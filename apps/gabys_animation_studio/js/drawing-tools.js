/* Drawing tools: pencil, brushes, eraser, line, shapes, fill bucket and eyedropper.
 * Strokes are drawn at full strength onto a scratch canvas, previewed live, and only blended
 * into the frame (with the chosen opacity) when the stroke ends. That keeps opacity even and
 * makes each stroke one tidy undo step. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, Layer, ctxOf, clamp, history, model } = GAS;

  const TOOL_INFO = {
    pencil: { label: "Pencil", key: "P", tip: "Pencil: draw crisp lines" },
    brush: { label: "Brush", key: "B", tip: "Paintbrush: soft, crayon, spray and more" },
    eraser: { label: "Eraser", key: "E", tip: "Eraser: rub out mistakes" },
    fill: { label: "Fill", key: "F", tip: "Fill bucket: pour color into a shape" },
    eyedropper: { label: "Picker", key: "I", tip: "Color picker: grab a color from your picture" },
    line: { label: "Line", key: "L", tip: "Line: draw straight lines (hold Shift to snap)" },
    shape: { label: "Shapes", key: "U", tip: "Shapes: boxes, circles, stars and more" },
    select: { label: "Select", key: "S", tip: "Select: move, resize, spin and copy things" },
    text: { label: "Text", key: "T", tip: "Text: add words to your animation" },
    hand: { label: "Move view", key: "H", tip: "Hand: drag to move around the canvas" },
  };
  const BRUSH_STYLES = [
    { id: "soft", label: "Soft" },
    { id: "round", label: "Ink" },
    { id: "crayon", label: "Crayon" },
    { id: "spray", label: "Spray" },
    { id: "calligraphy", label: "Fancy" },
    { id: "rainbow", label: "Rainbow" },
  ];
  const SHAPES = [
    { id: "rect", label: "Rectangle" },
    { id: "roundrect", label: "Rounded box" },
    { id: "circle", label: "Circle" },
    { id: "ellipse", label: "Oval" },
    { id: "triangle", label: "Triangle" },
    { id: "star", label: "Star" },
    { id: "polygon", label: "Polygon" },
    { id: "heart", label: "Heart" },
  ];
  const PAINT_TOOLS = new Set(["pencil", "brush", "eraser", "line", "shape"]);

  let scratch = null;
  let stroke = null;
  let hoverPt = null;

  function getScratch() {
    const p = state.project;
    if (!scratch || scratch.width !== p.width || scratch.height !== p.height) scratch = GAS.makeCanvas(p.width, p.height);
    const c = ctxOf(scratch);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, scratch.width, scratch.height);
    return scratch;
  }

  /* The layer the tools paint on right now, and the frame that owns it (null = shared background). */
  function activeTarget() {
    const p = state.project, f = GAS.curFrame();
    if (state.activeLayer === "bg") {
      return f.bgLayer ? { layer: f.bgLayer, frameId: f.id, kind: "bg" } : { layer: p.bgLayer, frameId: null, kind: "bg" };
    }
    return { layer: f.draw, frameId: f.id, kind: "draw" };
  }

  /* ---------- tool switching ---------- */
  function set(tool) {
    if (!TOOL_INFO[tool]) return;
    if (tool !== "select" && tool !== "text") GAS.selection.deselect();
    else GAS.selection.commitFloat();
    if (PAINT_TOOLS.has(tool) || tool === "fill") state.lastDrawTool = tool;
    state.tool = tool;
    GAS.view.stage.dataset.tool = tool;
    GAS.bus.emit("tool-changed", tool);
    GAS.view.queueOverlay();
  }

  /* ---------- brush dabs ---------- */
  const dabCache = new Map();
  function dab(color, hardness) {
    const key = color + "|" + hardness.toFixed(2);
    let c = dabCache.get(key);
    if (c) return c;
    const R = 64;
    c = GAS.makeCanvas(R * 2, R * 2);
    const g = ctxOf(c).createRadialGradient(R, R, 0, R, R, R);
    const rgb = GAS.hexToRgb(color) || { r: 0, g: 0, b: 0 };
    const col = (a) => `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
    g.addColorStop(0, col(1));
    g.addColorStop(clamp(hardness, 0, 0.98), col(1));
    g.addColorStop(1, col(0));
    ctxOf(c).fillStyle = g;
    ctxOf(c).fillRect(0, 0, R * 2, R * 2);
    if (dabCache.size > 40) dabCache.clear();
    dabCache.set(key, c);
    return c;
  }

  /* ---------- stroke lifecycle ---------- */
  function settingsFor(tool) {
    return tool === "shape" ? state.tools.shape : state.tools[tool];
  }

  function beginStroke(pt) {
    const tool = state.tool;
    const target = activeTarget();
    const s = settingsFor(tool);
    const canvas = getScratch();
    stroke = {
      tool, target, s, canvas, ctx: ctxOf(canvas),
      color: tool === "eraser" ? "#000000" : state.primary,
      start: { x: pt.x, y: pt.y }, last: { x: pt.x, y: pt.y, p: pt.pressure }, sm: { x: pt.x, y: pt.y },
      lastMid: { x: pt.x, y: pt.y }, residual: 0, travelled: 0, width: s.size,
      bbox: { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y },
      style: tool === "brush" ? s.style : tool === "eraser" ? "eraser" : "pencil",
    };
    GAS.view.setLive(target.kind, canvas, s.opacity, tool === "eraser");
    if (tool === "line" || tool === "shape") { previewShape(pt); return; }
    stampStart(pt);
    GAS.view.refreshLayer(target.kind);
    if (stroke.style === "spray") {
      stroke.timer = setInterval(() => { if (stroke) { sprayAt(stroke.last.x, stroke.last.y, 1); GAS.view.refreshLayer(stroke.target.kind); } }, 40);
    }
  }

  function grow(x, y, r) {
    const b = stroke.bbox;
    b.x0 = Math.min(b.x0, x - r); b.y0 = Math.min(b.y0, y - r);
    b.x1 = Math.max(b.x1, x + r); b.y1 = Math.max(b.y1, y + r);
  }

  function moveStroke(pt) {
    if (!stroke) return;
    if (stroke.tool === "line" || stroke.tool === "shape") { previewShape(pt); return; }
    const k = 1 - clamp(stroke.s.smoothing || 0, 0, 0.95) * 0.85;
    const sm = stroke.sm;
    sm.x += (pt.x - sm.x) * k;
    sm.y += (pt.y - sm.y) * k;
    drawTo({ x: sm.x, y: sm.y, p: pt.pressure });
    GAS.view.refreshLayer(stroke.target.kind);
  }

  function endStroke(pt) {
    if (!stroke) return;
    clearInterval(stroke.timer);
    if (stroke.tool === "line" || stroke.tool === "shape") previewShape(pt);
    else {
      // Catch the smoothed point up to where the pen actually stopped.
      drawTo({ x: pt.x, y: pt.y, p: pt.pressure });
      finishPath();
    }
    commit();
  }

  function cancelStroke() {
    if (!stroke) return;
    clearInterval(stroke.timer);
    const kind = stroke.target.kind;
    stroke = null;
    GAS.view.clearLive();
    GAS.view.refreshLayer(kind);
  }

  function commit() {
    const st = stroke;
    stroke = null;
    const { layer, frameId, kind } = st.target;
    const b = st.bbox;
    const rect = history.clipRect(layer.canvas ? layer : layer, b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
    if (rect) {
      const before = history.captureRaster(layer, rect);
      const ctx = ctxOf(layer.canvas);
      ctx.save();
      ctx.globalAlpha = st.s.opacity;
      ctx.globalCompositeOperation = st.tool === "eraser" ? "destination-out" : "source-over";
      ctx.drawImage(st.canvas, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
      if (st.tool === "eraser") layer.v++;
      else Layer.touch(layer);
      const labels = { pencil: "Pencil line", brush: "Brush stroke", eraser: "Erase", line: "Line", shape: "Shape" };
      history.pushRaster(layer, rect, before, frameId, labels[st.tool] || "Drawing");
    }
    GAS.view.clearLive();
    afterLayerChange(frameId);
  }

  function afterLayerChange(frameId) {
    if (frameId) GAS.touchFrame(GAS.findFrame(frameId));
    else {
      // Shared background: every frame changed.
      for (const f of state.project.frames) if (!f.bgLayer) f.rev++;
      GAS.bus.emit("frames-changed");
      GAS.bus.emit("dirty");
    }
  }

  /* ---------- stroke painters ---------- */
  function widthAt(p) {
    return Math.max(0.5, stroke.s.size * (stroke.target && p != null ? 0.25 + 0.75 * p : 1));
  }

  function stampStart(pt) {
    const ctx = stroke.ctx, st = stroke;
    const w = widthAt(pt.pressure);
    switch (st.style) {
      case "pencil":
      case "round":
      case "rainbow":
        ctx.fillStyle = st.style === "rainbow" ? rainbowColor() : st.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, w / 2, 0, Math.PI * 2);
        ctx.fill();
        grow(pt.x, pt.y, w);
        break;
      case "calligraphy":
        nibSegment(pt, pt, w);
        break;
      default:
        stampAlong(pt, true);
    }
  }

  function drawTo(p) {
    const st = stroke, ctx = st.ctx;
    const last = st.last;
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 0.3) return;
    st.travelled += d;
    switch (st.style) {
      case "pencil":
      case "round":
      case "rainbow": {
        let w = widthAt((p.p + last.p) / 2);
        if (st.style === "round") {
          // Ink thins out a little when you move fast, like a real brush.
          const target = w * clamp(1.25 - d / (st.s.size * 1.6 + 6), 0.4, 1);
          st.width += (target - st.width) * 0.35;
          w = st.width;
        }
        const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = w;
        ctx.strokeStyle = st.style === "rainbow" ? rainbowColor() : st.color;
        ctx.beginPath();
        ctx.moveTo(st.lastMid.x, st.lastMid.y);
        ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
        ctx.stroke();
        st.lastMid = mid;
        grow(p.x, p.y, w);
        break;
      }
      case "calligraphy":
        nibSegment(last, p, widthAt(p.p));
        break;
      default:
        stampAlong(p, false);
    }
    st.last = { x: p.x, y: p.y, p: p.p };
  }

  function finishPath() {
    const st = stroke;
    if (st.style === "pencil" || st.style === "round" || st.style === "rainbow") {
      const ctx = st.ctx;
      ctx.lineWidth = st.style === "round" ? st.width : widthAt(st.last.p);
      ctx.strokeStyle = st.style === "rainbow" ? rainbowColor() : st.color;
      ctx.beginPath();
      ctx.moveTo(st.lastMid.x, st.lastMid.y);
      ctx.lineTo(st.last.x, st.last.y);
      ctx.stroke();
    }
  }

  function rainbowColor() {
    return `hsl(${(stroke.travelled * 0.7) % 360}, 95%, 55%)`;
  }

  function nibSegment(a, b, w) {
    const ctx = stroke.ctx;
    const nx = Math.cos(-Math.PI / 4) * w * 0.5, ny = Math.sin(-Math.PI / 4) * w * 0.5;
    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x - nx, a.y - ny);
    ctx.lineTo(a.x + nx, a.y + ny);
    ctx.lineTo(b.x + nx, b.y + ny);
    ctx.lineTo(b.x - nx, b.y - ny);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    grow(b.x, b.y, w);
    grow(a.x, a.y, w);
  }

  function stampAlong(p, first) {
    const st = stroke;
    const spacingFactor = { soft: 0.12, crayon: 0.18, spray: 0.35, eraser: 0.1 }[st.style] || 0.15;
    const one = (x, y, pr) => {
      const w = widthAt(pr);
      if (st.style === "spray") sprayAt(x, y, pr);
      else if (st.style === "crayon") crayonAt(x, y, w);
      else {
        const hard = st.style === "eraser" ? st.s.hardness : st.s.hardness ?? 0.5;
        const img = dab(st.color, hard);
        st.ctx.drawImage(img, x - w / 2, y - w / 2, w, w);
        grow(x, y, w);
      }
    };
    if (first) { one(p.x, p.y, p.pressure ?? p.p); return; }
    const last = st.last;
    const dx = p.x - last.x, dy = p.y - last.y, d = Math.hypot(dx, dy);
    const spacing = Math.max(0.6, st.s.size * spacingFactor);
    let t = st.residual || spacing;
    while (t <= d) {
      const f = t / d;
      one(last.x + dx * f, last.y + dy * f, last.p + (p.p - last.p) * f);
      t += spacing;
    }
    st.residual = t - d;
  }

  function sprayAt(x, y, pr) {
    const st = stroke, ctx = st.ctx;
    const r = widthAt(pr) * 0.9;
    const n = Math.max(4, Math.round(r * 0.5));
    ctx.fillStyle = st.color;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const s = Math.max(0.6, st.s.size * 0.035) * (0.6 + Math.random());
      ctx.fillRect(x + Math.cos(a) * d - s / 2, y + Math.sin(a) * d - s / 2, s, s);
    }
    grow(x, y, r + 2);
  }

  function crayonAt(x, y, w) {
    const ctx = stroke.ctx;
    const r = w / 2;
    const n = Math.max(6, Math.round(r * r * 0.35));
    ctx.fillStyle = stroke.color;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const s = 1 + Math.random() * Math.max(1, w * 0.06);
      ctx.globalAlpha = 0.55 + Math.random() * 0.45;
      ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, s, s);
    }
    ctx.globalAlpha = 1;
    grow(x, y, r + 2);
  }

  /* ---------- lines & shapes ---------- */
  function previewShape(pt) {
    const st = stroke, ctx = st.ctx;
    ctx.clearRect(0, 0, st.canvas.width, st.canvas.height);
    const a = st.start;
    let bx = pt.x, by = pt.y;
    const w = st.s.size;
    if (st.tool === "line") {
      if (pt.shift) {
        const ang = Math.round(Math.atan2(by - a.y, bx - a.x) / (Math.PI / 12)) * (Math.PI / 12);
        const d = Math.hypot(bx - a.x, by - a.y);
        bx = a.x + Math.cos(ang) * d;
        by = a.y + Math.sin(ang) * d;
      }
      ctx.lineCap = "round";
      ctx.strokeStyle = st.color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (Math.hypot(bx - a.x, by - a.y) < 0.5) { ctx.fillStyle = st.color; ctx.beginPath(); ctx.arc(a.x, a.y, w / 2, 0, Math.PI * 2); ctx.fill(); }
      st.bbox = { x0: Math.min(a.x, bx) - w, y0: Math.min(a.y, by) - w, x1: Math.max(a.x, bx) + w, y1: Math.max(a.y, by) + w };
    } else {
      const kind = st.s.kind;
      let dx = bx - a.x, dy = by - a.y;
      if (pt.shift || kind === "circle") {
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * m;
        dy = Math.sign(dy || 1) * m;
      }
      let x0, y0, x1, y1;
      if (pt.alt) { x0 = a.x - dx; y0 = a.y - dy; x1 = a.x + dx; y1 = a.y + dy; }
      else { x0 = a.x; y0 = a.y; x1 = a.x + dx; y1 = a.y + dy; }
      const r = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      drawShape(ctx, kind, r, st.s, state.primary, state.secondary);
      st.bbox = { x0: r.x - w, y0: r.y - w, x1: r.x + r.w + w, y1: r.y + r.h + w };
    }
    GAS.view.refreshLayer(st.target.kind);
  }

  function shapePath(ctx, kind, r, sides) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w / 2, ry = r.h / 2;
    ctx.beginPath();
    switch (kind) {
      case "rect":
        ctx.rect(r.x, r.y, r.w, r.h);
        break;
      case "roundrect": {
        const rad = Math.min(r.w, r.h) * 0.22;
        if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, rad);
        else ctx.rect(r.x, r.y, r.w, r.h);
        break;
      }
      case "circle":
      case "ellipse":
        ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
        break;
      case "triangle":
        ctx.moveTo(cx, r.y);
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.lineTo(r.x, r.y + r.h);
        ctx.closePath();
        break;
      case "star":
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? 0.45 : 1, ang = -Math.PI / 2 + (i * Math.PI) / 5;
          ctx.lineTo(cx + Math.cos(ang) * rx * rr, cy + (Math.sin(ang) * ry * rr) + ry * 0.08);
        }
        ctx.closePath();
        break;
      case "polygon": {
        const n = clamp(sides || 6, 3, 12);
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI * 2) / n;
          ctx.lineTo(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry);
        }
        ctx.closePath();
        break;
      }
      case "heart": {
        const top = r.y + r.h * 0.3;
        ctx.moveTo(cx, r.y + r.h);
        ctx.bezierCurveTo(r.x - r.w * 0.1, r.y + r.h * 0.55, r.x, r.y - r.h * 0.05, cx, top);
        ctx.bezierCurveTo(r.x + r.w, r.y - r.h * 0.05, r.x + r.w * 1.1, r.y + r.h * 0.55, cx, r.y + r.h);
        ctx.closePath();
        break;
      }
    }
  }

  function drawShape(ctx, kind, r, s, primary, secondary) {
    shapePath(ctx, kind, r, s.sides);
    ctx.lineJoin = "round";
    ctx.lineWidth = s.size;
    if (s.fillMode === "fill") { ctx.fillStyle = primary; ctx.fill(); }
    else if (s.fillMode === "both") { ctx.fillStyle = secondary; ctx.fill(); ctx.strokeStyle = primary; ctx.stroke(); }
    else { ctx.strokeStyle = primary; ctx.stroke(); }
  }

  /* ---------- fill bucket ---------- */
  function floodFill(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    const p = state.project;
    if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
    const { layer, frameId } = activeTarget();
    const s = state.tools.fill;
    const W = p.width, H = p.height;
    const ctx = ctxOf(layer.canvas);
    const img = ctx.getImageData(0, 0, W, H);
    const data = img.data;

    // Which pixels count as "the same area": this layer, or everything you can see.
    let ref = data;
    if (s.sampleAll) {
      const flat = GAS.makeCanvas(W, H, true);
      GAS.render.renderFrame(ctxOf(flat), p, GAS.curFrame());
      ref = ctxOf(flat).getImageData(0, 0, W, H).data;
    }

    const i0 = (y * W + x) * 4;
    const sr = ref[i0], sg = ref[i0 + 1], sb = ref[i0 + 2], sa = ref[i0 + 3];
    const fc = GAS.hexToRgb(state.primary);
    const tol = s.tolerance * 2.55;
    const opacity = s.opacity;

    // Don't refill an area that is already exactly this color.
    if (!s.sampleAll && sa === 255 && sr === fc.r && sg === fc.g && sb === fc.b && opacity >= 1) {
      GAS.ui.toast("That spot is already this color!");
      return;
    }

    const match = (i) => {
      const a = ref[i + 3];
      if (sa < 8 && a < 8) return true;
      return Math.abs(ref[i] - sr) <= tol && Math.abs(ref[i + 1] - sg) <= tol && Math.abs(ref[i + 2] - sb) <= tol && Math.abs(a - sa) <= tol;
    };

    const mask = new Uint8Array(W * H);
    const stack = [x, y];
    let minX = x, maxX = x, minY = y, maxY = y;
    while (stack.length) {
      const sy = stack.pop(), sx = stack.pop();
      let lx = sx;
      while (lx >= 0 && !mask[sy * W + lx] && match((sy * W + lx) * 4)) lx--;
      lx++;
      let rx = sx;
      while (rx < W && !mask[sy * W + rx] && match((sy * W + rx) * 4)) rx++;
      rx--;
      if (lx > rx) continue;
      for (let i = lx; i <= rx; i++) mask[sy * W + i] = 1;
      if (lx < minX) minX = lx;
      if (rx > maxX) maxX = rx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
      for (const ny of [sy - 1, sy + 1]) {
        if (ny < 0 || ny >= H) continue;
        let i = lx;
        while (i <= rx) {
          while (i <= rx && (mask[ny * W + i] || !match((ny * W + i) * 4))) i++;
          if (i > rx) break;
          stack.push(i, ny);
          while (i <= rx && !mask[ny * W + i] && match((ny * W + i) * 4)) i++;
        }
      }
    }

    // Anti-aliasing: also tuck color under the soft edge pixels around the filled area,
    // so no thin white halo is left between the fill and the outline.
    if (s.antialias) {
      minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1);
      maxX = Math.min(W - 1, maxX + 1); maxY = Math.min(H - 1, maxY + 1);
      for (let yy = minY; yy <= maxY; yy++) {
        for (let xx = minX; xx <= maxX; xx++) {
          const k = yy * W + xx;
          if (mask[k]) continue;
          if ((xx > 0 && mask[k - 1] === 1) || (xx < W - 1 && mask[k + 1] === 1) || (yy > 0 && mask[k - W] === 1) || (yy < H - 1 && mask[k + W] === 1)) mask[k] = 2;
        }
      }
    }

    const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    const before = history.captureRaster(layer, rect);
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const k = yy * W + xx, m = mask[k];
        if (!m) continue;
        const i = k * 4;
        const da = data[i + 3] / 255;
        if (m === 1) {
          // Fill over the pixel.
          const oa = opacity + da * (1 - opacity);
          if (oa <= 0) continue;
          data[i] = (fc.r * opacity + data[i] * da * (1 - opacity)) / oa;
          data[i + 1] = (fc.g * opacity + data[i + 1] * da * (1 - opacity)) / oa;
          data[i + 2] = (fc.b * opacity + data[i + 2] * da * (1 - opacity)) / oa;
          data[i + 3] = oa * 255;
        } else {
          // Edge pixel: keep the line on top, put the fill underneath.
          const oa = da + opacity * (1 - da);
          if (oa <= 0) continue;
          data[i] = (data[i] * da + fc.r * opacity * (1 - da)) / oa;
          data[i + 1] = (data[i + 1] * da + fc.g * opacity * (1 - da)) / oa;
          data[i + 2] = (data[i + 2] * da + fc.b * opacity * (1 - da)) / oa;
          data[i + 3] = oa * 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0, rect.x, rect.y, rect.w, rect.h);
    Layer.touch(layer);
    history.pushRaster(layer, rect, before, frameId, "Fill");
    GAS.view.refreshLayer(activeTarget().kind);
    afterLayerChange(frameId);
    GAS.colors.addRecent(state.primary);
  }

  /* ---------- eyedropper ---------- */
  let pickCanvas = null;
  function pickColor(x, y) {
    const p = state.project;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= p.width || y >= p.height) return null;
    if (!pickCanvas || pickCanvas.width !== p.width || pickCanvas.height !== p.height) pickCanvas = GAS.makeCanvas(p.width, p.height, true);
    const c = ctxOf(pickCanvas);
    c.clearRect(0, 0, p.width, p.height);
    GAS.render.renderFrame(c, p, GAS.curFrame());
    const d = c.getImageData(x, y, 1, 1).data;
    if (d[3] < 10) return null;
    return GAS.rgbToHex(d[0], d[1], d[2]);
  }

  function eyedrop(pt, returnToTool) {
    const hex = pickColor(pt.x, pt.y);
    if (!hex) { GAS.ui.toast("Nothing to pick there. Try a spot with color!"); return; }
    GAS.colors.setPrimary(hex);
    GAS.ui.toast("Picked a color!", { color: hex });
    if (returnToTool) set(state.lastDrawTool || "pencil");
  }

  /* ---------- pointer routing (called by canvas.js) ---------- */
  let pending = null; // fill / eyedropper wait for pointer-up so a pinch can cancel them

  function down(pt) {
    const tool = state.tool;
    hoverPt = pt.isTouch ? null : pt; // fingers cover the cursor anyway
    if (state.float && tool !== "select" && tool !== "text") GAS.selection.commitFloat();
    if (tool === "select" || tool === "text") { GAS.selection.down(pt); return; }
    if (PAINT_TOOLS.has(tool) && pt.alt && tool !== "shape") { pending = { kind: "pick" }; return; }
    if (tool === "fill") { pending = { kind: "fill" }; return; }
    if (tool === "eyedropper") { pending = { kind: "pick", ret: true }; return; }
    if (PAINT_TOOLS.has(tool)) {
      if (!checkLayerVisible()) return;
      beginStroke(pt);
    }
  }
  function move(pt) {
    hoverPt = pt.isTouch ? null : pt;
    if (state.tool === "select" || state.tool === "text") { GAS.selection.move(pt); return; }
    if (stroke) moveStroke(pt);
    GAS.view.queueOverlay();
  }
  function up(pt) {
    hoverPt = pt.isTouch ? null : pt;
    if (state.tool === "select" || state.tool === "text") { GAS.selection.up(pt); return; }
    if (pending) {
      const job = pending;
      pending = null;
      if (job.kind === "fill") { if (checkLayerVisible()) floodFill(pt.x, pt.y); }
      else eyedrop(pt, job.ret);
      return;
    }
    if (stroke) endStroke(pt);
    GAS.view.queueOverlay();
  }
  function cancel() {
    pending = null;
    hoverPt = null;
    cancelStroke();
    GAS.selection.cancelGesture();
  }
  function hover(pt) {
    hoverPt = pt;
    if (pt && (state.tool === "select" || state.tool === "text")) GAS.selection.hover(pt);
  }

  let warnedHidden = false;
  function checkLayerVisible() {
    if (state.activeLayer === "bg" && !warnedHidden) {
      warnedHidden = true;
      GAS.ui.toast("You're painting the background. Switch to “Drawing” to paint on top.");
    }
    return true;
  }

  /* ---------- cursor on the overlay ---------- */
  function drawCursor(ctx) {
    if (!hoverPt || GAS.view.toolActive && state.tool !== "eraser" && state.tool !== "brush" && state.tool !== "pencil") return;
    const tool = state.tool;
    if (!["pencil", "brush", "eraser"].includes(tool)) return;
    const s = state.tools[tool];
    const sp = GAS.view.toScreen(hoverPt.x, hoverPt.y);
    const r = Math.max(1.5, (s.size * state.zoom) / 2);
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = tool === "eraser" ? "#ef476f" : "rgba(29,26,58,0.9)";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  GAS.tools = {
    TOOL_INFO, BRUSH_STYLES, SHAPES, PAINT_TOOLS, set, down, move, up, cancel, hover, drawCursor,
    activeTarget, afterLayerChange, pickColor, drawShape,
    get stroking() { return !!stroke; },
  };
})();
