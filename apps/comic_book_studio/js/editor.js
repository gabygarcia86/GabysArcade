/* Workspace editor: viewport (zoom/pan), rendering, pointer routing, selection handles,
 * transforms, smart guides, rulers & guides, in-place text editing.
 * Two stacked canvases: `content` (the page, redrawn only when the document changes) and
 * `overlay` (selection, guides, cursors; cheap to redraw on every pointer move). */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clamp, DEG, prefs } = CBS;
  const R = () => CBS.render;

  const view = { zoom: 1, panX: 40, panY: 40 };
  let stage, content, overlay, cctx, octx, rulerH, rulerV, textBox, dpr = 1;
  let contentDirty = true, overlayDirty = true, frameQueued = false;
  const pointers = new Map();
  let pan = null, pinch = null, spaceDown = false, lastHover = null;
  let editing = null; // { obj, ta }
  const smart = { lines: [] }; // smart guide lines for the overlay
  const layerOffsets = {};
  let marquee = null;
  const HANDLE = 9;

  /* ---------- setup ---------- */
  function init() {
    const ws = document.getElementById("workspace");
    rulerH = h("canvas", { class: "ruler ruler-h" });
    rulerV = h("canvas", { class: "ruler ruler-v" });
    content = h("canvas", { class: "view-content" });
    overlay = h("canvas", { class: "view-overlay", tabindex: "0", "aria-label": "Comic page canvas" });
    stage = h("div", { class: "stage", id: "stage" }, content, overlay);
    ws.append(h("div", { class: "ruler-corner", tip: "Drag from a ruler to add a guide" }), rulerH, rulerV, stage);
    cctx = content.getContext("2d");
    octx = overlay.getContext("2d");
    new ResizeObserver(() => resize()).observe(stage);
    overlay.addEventListener("pointerdown", onDown);
    overlay.addEventListener("pointermove", onMove);
    overlay.addEventListener("pointerup", onUp);
    overlay.addEventListener("pointercancel", onCancel);
    overlay.addEventListener("pointerleave", () => { lastHover = null; requestOverlay(); });
    overlay.addEventListener("dblclick", onDbl);
    overlay.addEventListener("wheel", onWheel, { passive: false });
    overlay.addEventListener("contextmenu", (e) => { e.preventDefault(); const t = CBS.tools.current; if (t.context) t.context(evt(e)); });
    for (const [el, axis] of [[rulerH, "h"], [rulerV, "v"]]) el.addEventListener("pointerdown", (e) => startGuideDrag(e, axis));
    bus.on("render", () => requestRender());
    bus.on("doc:changed", () => requestRender());
    bus.on("page:changed", () => { stopEditing(); requestRender(); });
    bus.on("selection:changed", () => requestOverlay());
    bus.on("layers:changed", () => requestRender());
    bus.on("prefs:changed", () => requestRender());
    bus.on("doc:loaded", () => { setTimeout(fit, 0); });
    window.addEventListener("keydown", (e) => { if (e.code === "Space" && !isTyping(e)) { if (!spaceDown) { spaceDown = true; updateCursor(); } } });
    window.addEventListener("keyup", (e) => { if (e.code === "Space") { spaceDown = false; updateCursor(); } });
    window.addEventListener("blur", () => { spaceDown = false; });
  }
  const isTyping = (e) => { const t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };

  let lastSize = null;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = stage.getBoundingClientRect();
    // keep the same part of the page centered when the workspace changes size
    if (lastSize && r.width > 0 && r.height > 0) { view.panX += (r.width - lastSize.w) / 2; view.panY += (r.height - lastSize.h) / 2; }
    if (r.width > 0 && r.height > 0) lastSize = { w: r.width, h: r.height };
    for (const c of [content, overlay]) {
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";
    }
    const showR = prefs.get("rulers", true);
    rulerH.width = Math.max(1, Math.round(r.width * dpr)); rulerH.height = Math.round(20 * dpr);
    rulerV.width = Math.round(20 * dpr); rulerV.height = Math.max(1, Math.round(r.height * dpr));
    rulerH.style.width = r.width + "px"; rulerV.style.height = r.height + "px";
    document.getElementById("workspace").classList.toggle("no-rulers", !showR);
    requestRender();
  }

  /* ---------- coordinates ---------- */
  function stageRect() { return stage.getBoundingClientRect(); }
  function screenToDoc(cx, cy) { const r = stageRect(); return { x: (cx - r.left - view.panX) / view.zoom, y: (cy - r.top - view.panY) / view.zoom }; }
  function docToStage(x, y) { return { x: x * view.zoom + view.panX, y: y * view.zoom + view.panY }; }
  function evt(e) {
    const p = screenToDoc(e.clientX, e.clientY);
    const r = stageRect();
    return {
      x: p.x, y: p.y, sx: e.clientX - r.left, sy: e.clientY - r.top, clientX: e.clientX, clientY: e.clientY,
      shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, button: e.button,
      pressure: e.pressure, pointerType: e.pointerType || "mouse", detail: e.detail, e,
    };
  }

  /* ---------- zoom & pan ---------- */
  const ZOOMS = [0.1, 0.17, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
  function setZoom(z, sx, sy) {
    z = clamp(z, 0.05, 12);
    const r = stageRect();
    if (sx == null) { sx = r.width / 2; sy = r.height / 2; }
    const dx = (sx - view.panX) / view.zoom, dy = (sy - view.panY) / view.zoom;
    view.zoom = z;
    view.panX = sx - dx * z;
    view.panY = sy - dy * z;
    clampPan();
    bus.emit("zoom:changed", z);
    requestRender();
  }
  function zoomStep(dir) {
    const z = view.zoom;
    const next = dir > 0 ? ZOOMS.find((v) => v > z * 1.01) || z * 1.25 : [...ZOOMS].reverse().find((v) => v < z / 1.01) || z / 1.25;
    setZoom(next);
  }
  function fit(mode = "page") {
    if (!CBS.doc.project) return;
    const r = stageRect();
    const s = CBS.doc.size;
    const pad = 36;
    const z = mode === "width" ? (r.width - pad * 2) / s.w : Math.min((r.width - pad * 2) / s.w, (r.height - pad * 2) / s.h);
    view.zoom = clamp(z, 0.05, 12);
    view.panX = (r.width - s.w * view.zoom) / 2;
    view.panY = mode === "width" ? pad : (r.height - s.h * view.zoom) / 2;
    bus.emit("zoom:changed", view.zoom);
    requestRender();
  }
  function clampPan() {
    const r = stageRect(), s = CBS.doc.size;
    const pw = s.w * view.zoom, ph = s.h * view.zoom, m = 80;
    view.panX = clamp(view.panX, Math.min(m - pw, r.width - pw - m), Math.max(r.width - m, m));
    view.panY = clamp(view.panY, Math.min(m - ph, r.height - ph - m), Math.max(r.height - m, m));
  }

  /* ---------- rendering ---------- */
  function requestRender() { contentDirty = true; overlayDirty = true; queue(); }
  function requestOverlay() { overlayDirty = true; queue(); }
  function queue() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => {
      frameQueued = false;
      if (!CBS.doc.project) return;
      if (contentDirty) { drawContent(); drawRulers(); }
      if (overlayDirty) drawOverlay();
      contentDirty = overlayDirty = false;
      if (editing) positionTextBox();
    });
  }

  function drawContent() {
    const page = CBS.doc.page;
    const s = CBS.doc.size;
    const ctx = cctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, content.width, content.height);
    if (!page) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = view.panX, py = view.panY, pw = s.w * view.zoom, ph = s.h * view.zoom;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px + 6, py + 8, pw, ph);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * px, dpr * py);
    R().drawPage(ctx, page, { scale: view.zoom * dpr, editing: true, hideText: editing ? editing.obj.id : null, layerOffsets });
    ctx.restore();
    // grid
    if (prefs.get("grid", false)) {
      const g = prefs.get("gridSize", 25);
      const step = g * view.zoom;
      if (step >= 4) {
        ctx.save();
        ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
        ctx.strokeStyle = "rgba(80,120,255,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= s.w; x += g) { const X = Math.round(px + x * view.zoom) + 0.5; ctx.moveTo(X, py); ctx.lineTo(X, py + ph); }
        for (let y = 0; y <= s.h; y += g) { const Y = Math.round(py + y * view.zoom) + 0.5; ctx.moveTo(px, Y); ctx.lineTo(px + pw, Y); }
        ctx.stroke();
        ctx.restore();
      }
    }
    // margins / safe area
    if (prefs.get("showMargins", true)) {
      const m = CBS.doc.project.settings.margin || 0;
      if (m > 0) {
        ctx.strokeStyle = "rgba(34,211,238,0.35)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(px + m * view.zoom) + 0.5, Math.round(py + m * view.zoom) + 0.5, (s.w - 2 * m) * view.zoom, (s.h - 2 * m) * view.zoom);
        ctx.setLineDash([]);
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(px) - 0.5, Math.round(py) - 0.5, Math.round(pw) + 1, Math.round(ph) + 1);
  }

  function handlePoints(o) {
    const pts = { nw: [-0.5, -0.5], n: [0, -0.5], ne: [0.5, -0.5], e: [0.5, 0], se: [0.5, 0.5], s: [0, 0.5], sw: [-0.5, 0.5], w: [-0.5, 0] };
    const out = {};
    for (const [k, [u, v]] of Object.entries(pts)) {
      const p = R().localToPage(o, u * o.w, v * o.h);
      out[k] = docToStage(p.x, p.y);
    }
    const top = R().localToPage(o, 0, -o.h / 2);
    const ang = (o.rot || 0) * DEG;
    const ts = docToStage(top.x, top.y);
    out.rot = { x: ts.x + Math.sin(ang) * 28, y: ts.y - Math.cos(ang) * 28 };
    out.rotBase = ts;
    return out;
  }

  function drawOverlay() {
    const ctx = octx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const page = CBS.doc.page;
    if (!page) return;
    const s = CBS.doc.size;
    // guides
    if (prefs.get("showGuides", true) && page.guides) {
      ctx.strokeStyle = "rgba(236,72,153,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const r = stageRect();
      for (const gx of page.guides.v || []) { const X = Math.round(docToStage(gx, 0).x) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, r.height); }
      for (const gy of page.guides.h || []) { const Y = Math.round(docToStage(0, gy).y) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(r.width, Y); }
      ctx.stroke();
    }
    const tool = CBS.tools.current;
    // hover outline
    if (lastHover && tool.hoverOutline !== false && !pointers.size) {
      const o = CBS.doc.obj(lastHover);
      if (o && !CBS.doc.selection.includes(o.id)) outlineObject(ctx, o, "rgba(34,211,238,0.6)");
    }
    // selection
    const sel = CBS.doc.selected();
    if (sel.length && tool.showSelection !== false) {
      for (const o of sel) outlineObject(ctx, o, "#22d3ee", true);
      if (sel.length === 1) drawHandles(ctx, sel[0]);
      else {
        const bb = unionBox(sel);
        const a = docToStage(bb.x, bb.y), b = docToStage(bb.x + bb.w, bb.y + bb.h);
        ctx.strokeStyle = "#a855f7"; ctx.setLineDash([5, 4]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
      }
    }
    // smart guides
    if (smart.lines.length) {
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const ln of smart.lines) {
        const a = docToStage(ln[0], ln[1]), b = docToStage(ln[2], ln[3]);
        ctx.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); ctx.lineTo(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5);
      }
      ctx.stroke();
    }
    if (marquee) {
      const a = docToStage(Math.min(marquee.x0, marquee.x1), Math.min(marquee.y0, marquee.y1));
      const b = docToStage(Math.max(marquee.x0, marquee.x1), Math.max(marquee.y0, marquee.y1));
      ctx.fillStyle = "rgba(34,211,238,0.12)"; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeStyle = "#22d3ee"; ctx.strokeRect(a.x + 0.5, a.y + 0.5, b.x - a.x, b.y - a.y);
    }
    if (tool.drawOverlay) {
      ctx.save();
      tool.drawOverlay(ctx, { docToStage, zoom: view.zoom, size: s, hover: lastPointer });
      ctx.restore();
    }
  }

  function outlineObject(ctx, o, color, solid) {
    ctx.strokeStyle = color;
    ctx.lineWidth = solid ? 1.5 : 1;
    ctx.setLineDash(solid ? [] : [4, 3]);
    ctx.beginPath();
    let pts;
    if (o.kind === "panel" && o.shape === "poly") pts = R().panelPagePoints(o).map(([x, y]) => docToStage(x, y));
    else pts = R().corners(o).map((p) => docToStage(p.x, p.y));
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHandles(ctx, o) {
    const layer = CBS.doc.layerOf(o.id);
    const locked = o.locked || (layer && layer.locked);
    const hp = handlePoints(o);
    if (locked) {
      const p = hp.ne;
      ctx.font = "14px system-ui";
      ctx.fillText("🔒", p.x + 4, p.y - 4);
      return;
    }
    const dot = (p, fill = "#fff", stroke = "#0891b2", r = HANDLE / 2, round = false) => {
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (round) ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      else ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
      ctx.fill(); ctx.stroke();
    };
    if (editPoints && editPoints.id === o.id) {
      for (const p of vertexScreenPoints(o)) dot(p, "#fde047", "#a16207", 5, true);
      return;
    }
    ctx.strokeStyle = "#0891b2"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hp.rotBase.x, hp.rotBase.y); ctx.lineTo(hp.rot.x, hp.rot.y); ctx.stroke();
    dot(hp.rot, "#22d3ee", "#0e7490", 6, true);
    const thin = Math.abs(o.w * view.zoom) < 30 || Math.abs(o.h * view.zoom) < 30;
    const crop = CBS.editor.cropMode && o.kind === "image";
    for (const k of ["nw", "ne", "se", "sw", "n", "e", "s", "w"]) {
      if (thin && k.length === 1) continue;
      dot(hp[k], crop ? "#fb923c" : "#fff", crop ? "#9a3412" : "#0891b2");
    }
    if (o.kind === "bubble" && o.tailOn) {
      const t = R().localToPage(o, o.tail.x, o.tail.y);
      const ts = docToStage(t.x, t.y);
      dot(ts, "#f472b6", "#9d174d", 7, true);
    }
  }

  function unionBox(objs) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of objs) { const b = R().aabb(o); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function drawRulers() {
    if (!prefs.get("rulers", true)) return;
    const unit = prefs.get("rulerUnit", "in");
    const perUnit = unit === "in" ? CBS.DOC_DPI : unit === "cm" ? CBS.DOC_DPI / 2.54 : 1;
    const s = CBS.doc.size;
    for (const [c, horiz] of [[rulerH, true], [rulerV, false]]) {
      const x = c.getContext("2d");
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = "#121430";
      x.fillRect(0, 0, c.width, c.height);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const len = (horiz ? c.width : c.height) / dpr;
      const pan = horiz ? view.panX : view.panY;
      // pick a tick spacing that leaves >= 50px between labels
      const pxPerUnit = perUnit * view.zoom;
      const steps = [0.125, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
      const major = steps.find((st) => st * pxPerUnit >= 50) || 1000;
      const minor = major / (major * pxPerUnit >= 100 ? 10 : 4);
      const extent = horiz ? s.w : s.h;
      x.fillStyle = "rgba(255,255,255,0.06)";
      const a = pan, b = pan + extent * view.zoom;
      if (horiz) x.fillRect(a, 0, b - a, 20); else x.fillRect(0, a, 20, b - a);
      x.strokeStyle = "#5b628f";
      x.fillStyle = "#a2a9d6";
      x.font = "9px system-ui, sans-serif";
      x.lineWidth = 1;
      x.beginPath();
      const startU = Math.floor(-pan / pxPerUnit / minor) * minor;
      for (let u = startU; u * pxPerUnit + pan < len; u += minor) {
        const pos = Math.round(pan + u * pxPerUnit) + 0.5;
        const isMajor = Math.abs(u / major - Math.round(u / major)) < 1e-6;
        const t = isMajor ? 12 : 5;
        if (horiz) { x.moveTo(pos, 20); x.lineTo(pos, 20 - t); } else { x.moveTo(20, pos); x.lineTo(20 - t, pos); }
        if (isMajor) {
          const label = String(Math.round(u * 100) / 100);
          if (horiz) x.fillText(label, pos + 2, 9);
          else { x.save(); x.translate(9, pos + 2); x.rotate(-Math.PI / 2); x.textAlign = "right"; x.fillText(label, 0, 0); x.restore(); }
        }
      }
      x.stroke();
      // cursor marker
      if (lastPointer) {
        const p = horiz ? lastPointer.sx : lastPointer.sy;
        x.strokeStyle = "#22d3ee";
        x.beginPath();
        if (horiz) { x.moveTo(p + 0.5, 0); x.lineTo(p + 0.5, 20); } else { x.moveTo(0, p + 0.5); x.lineTo(20, p + 0.5); }
        x.stroke();
      }
    }
  }

  /* ---------- guides ---------- */
  function startGuideDrag(e, axis) {
    if (!CBS.doc.project || e.button !== 0) return;
    e.preventDefault();
    const page = CBS.doc.page;
    page.guides = page.guides || { v: [], h: [] };
    const list = axis === "h" ? "h" : "v";
    CBS.history.begin("page");
    page.guides[list].push(0);
    const idx = page.guides[list].length - 1;
    guideDrag = { list, idx };
    const move = (ev) => {
      const p = screenToDoc(ev.clientX, ev.clientY);
      page.guides[list][idx] = Math.round(list === "h" ? p.y : p.x);
      lastPointer = evt(ev);
      requestRender();
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const r = stageRect();
      const inside = ev.clientX > r.left && ev.clientY > r.top;
      if (!inside) page.guides[list].splice(idx, 1);
      CBS.history.end("Add guide");
      guideDrag = null;
      if (!prefs.get("showGuides", true)) prefs.set("showGuides", true);
      CBS.doc.changed();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  let guideDrag = null;
  function guideAt(sx, sy) {
    if (!prefs.get("showGuides", true)) return null;
    const page = CBS.doc.page;
    if (!page || !page.guides) return null;
    for (let i = 0; i < (page.guides.v || []).length; i++) if (Math.abs(docToStage(page.guides.v[i], 0).x - sx) < 4) return { list: "v", idx: i };
    for (let i = 0; i < (page.guides.h || []).length; i++) if (Math.abs(docToStage(0, page.guides.h[i]).y - sy) < 4) return { list: "h", idx: i };
    return null;
  }

  /* ---------- hit testing ---------- */
  function hitObject(o, x, y, page) {
    const tol = 4 / view.zoom;
    const l = R().pageToLocal(o, x, y);
    if (o.kind === "image" && o.clip) {
      const panel = CBS.doc.obj(o.clip, page);
      if (panel && !CBS.pointInPoly(x, y, R().panelPagePoints(panel))) return false;
    }
    if (o.kind === "panel" && o.shape === "poly") return CBS.pointInPoly(l.x, l.y, R().panelLocalPoints(o)) || nearPolyEdge(l, R().panelLocalPoints(o), tol + o.borderWidth / 2);
    if (o.kind === "shape" && (o.shape === "line" || o.shape === "poly") && o.pts) {
      const pts = o.pts.map(([u, v]) => [(u - 0.5) * o.w, (v - 0.5) * o.h]);
      if (o.shape === "poly" && o.fillOn && CBS.pointInPoly(l.x, l.y, pts)) return true;
      return nearPolyEdge(l, pts, tol + Math.max(4 / view.zoom, (o.strokeWidth || 1) / 2), o.shape === "line");
    }
    if (Math.abs(l.x) <= o.w / 2 + tol && Math.abs(l.y) <= o.h / 2 + tol) {
      if (o.kind === "bubble" || (o.kind === "shape" && o.shape === "ellipse")) return (l.x * l.x) / ((o.w / 2 + tol) ** 2) + (l.y * l.y) / ((o.h / 2 + tol) ** 2) <= 1.15;
      return true;
    }
    if (o.kind === "bubble" && o.tailOn && o.tail) {
      // near the tail line
      const d = segDist(l.x, l.y, 0, 0, o.tail.x, o.tail.y);
      return d < Math.max(8 / view.zoom, Math.min(o.w, o.h) * 0.12);
    }
    return false;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function nearPolyEdge(l, pts, tol, open = false) {
    const n = pts.length;
    for (let i = 0; i < (open ? n - 1 : n); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (segDist(l.x, l.y, a[0], a[1], b[0], b[1]) <= tol) return true;
    }
    return false;
  }
  /* Topmost object under a point. opts: {includeLocked, kinds:Set, skipPanels} */
  function hitTest(x, y, opts = {}) {
    const page = CBS.doc.page;
    if (!page) return null;
    for (let li = page.layers.length - 1; li >= 0; li--) {
      const layer = page.layers[li];
      const gs = R().groupState(page, layer);
      if (!layer.visible || !gs.visible) continue;
      if (layer.locked && !opts.includeLocked) continue;
      if (opts.layerId && layer.id !== opts.layerId) continue;
      for (let i = layer.objects.length - 1; i >= 0; i--) {
        const o = layer.objects[i];
        if (opts.kinds && !opts.kinds.has(o.kind)) continue;
        if (opts.skipPanels && o.kind === "panel") continue;
        if (hitObject(o, x, y, page)) return o;
      }
    }
    return null;
  }
  function panelAt(x, y) {
    const page = CBS.doc.page;
    if (!page) return null;
    for (let li = page.layers.length - 1; li >= 0; li--) {
      const layer = page.layers[li];
      if (!layer.visible) continue;
      for (let i = layer.objects.length - 1; i >= 0; i--) {
        const o = layer.objects[i];
        if (o.kind === "panel" && CBS.pointInPoly(x, y, R().panelPagePoints(o))) return o;
      }
    }
    return null;
  }

  /* Which transform handle is under a stage point (single selection only). */
  let editPoints = null; // { id } when editing polygon vertices
  function vertexScreenPoints(o) {
    let pts;
    if (o.kind === "panel") pts = R().panelLocalPoints(o);
    else pts = (o.pts || []).map(([u, v]) => [(u - 0.5) * o.w, (v - 0.5) * o.h]);
    return pts.map(([x, y]) => { const p = R().localToPage(o, x, y); return docToStage(p.x, p.y); });
  }
  function handleAt(sx, sy) {
    const sel = CBS.doc.selected();
    if (sel.length !== 1) return null;
    const o = sel[0];
    const layer = CBS.doc.layerOf(o.id);
    if (o.locked || (layer && layer.locked)) return null;
    const near = (p, r = HANDLE) => Math.abs(p.x - sx) <= r && Math.abs(p.y - sy) <= r;
    if (editPoints && editPoints.id === o.id) {
      const vs = vertexScreenPoints(o);
      for (let i = 0; i < vs.length; i++) if (near(vs[i], 8)) return { type: "vertex", i, obj: o };
      return null;
    }
    if (o.kind === "bubble" && o.tailOn) {
      const t = R().localToPage(o, o.tail.x, o.tail.y);
      if (near(docToStage(t.x, t.y), 10)) return { type: "tail", obj: o };
    }
    const hp = handlePoints(o);
    if (near(hp.rot, 10)) return { type: "rotate", obj: o };
    const thin = Math.abs(o.w * view.zoom) < 30 || Math.abs(o.h * view.zoom) < 30;
    for (const k of ["nw", "ne", "se", "sw", "n", "e", "s", "w"]) {
      if (thin && k.length === 1) continue;
      if (near(hp[k])) return { type: "resize", dir: k, obj: o };
    }
    return null;
  }
  const RESIZE_CURSORS = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
  function cursorForHandle(hd) {
    if (!hd) return null;
    if (hd.type === "rotate") return "grab";
    if (hd.type === "tail" || hd.type === "vertex") return "move";
    const base = { n: 0, ne: 1, e: 2, se: 3, s: 0, sw: 1, w: 2, nw: 3 }[hd.dir];
    const rot = Math.round(((hd.obj.rot || 0) % 180) / 45);
    return RESIZE_CURSORS[(((base + rot) % 4) + 4) % 4];
  }

  /* ---------- snapping ---------- */
  function snapTargets(exclude) {
    const s = CBS.doc.size;
    const m = CBS.doc.project.settings.margin || 0;
    const xs = [0, s.w / 2, s.w], ys = [0, s.h / 2, s.h];
    if (m) { xs.push(m, s.w - m); ys.push(m, s.h - m); }
    const page = CBS.doc.page;
    if (page.guides) { xs.push(...(page.guides.v || [])); ys.push(...(page.guides.h || [])); }
    if (prefs.get("smartGuides", true)) {
      for (const { obj, layer } of CBS.doc.allObjects()) {
        if (exclude.has(obj.id) || !layer.visible) continue;
        const b = R().aabb(obj);
        xs.push(b.x, b.x + b.w / 2, b.x + b.w);
        ys.push(b.y, b.y + b.h / 2, b.y + b.h);
      }
    }
    return { xs, ys };
  }
  /* Snap a box being moved. Returns {dx, dy} correction and fills smart.lines. */
  function snapBox(box, exclude, opts = {}) {
    smart.lines = [];
    if (opts.disabled) return { dx: 0, dy: 0 };
    const thr = 6 / view.zoom;
    let dx = 0, dy = 0;
    if (prefs.get("snapGrid", false) && prefs.get("grid", false)) {
      const g = prefs.get("gridSize", 25);
      dx = Math.round(box.x / g) * g - box.x;
      dy = Math.round(box.y / g) * g - box.y;
      return { dx, dy };
    }
    if (!prefs.get("snap", true)) return { dx: 0, dy: 0 };
    const t = snapTargets(exclude);
    const bxs = opts.xEdges || [box.x, box.x + box.w / 2, box.x + box.w];
    const bys = opts.yEdges || [box.y, box.y + box.h / 2, box.y + box.h];
    let best = thr, bx = null;
    for (const tx of t.xs) for (const e of bxs) { const d = tx - e; if (Math.abs(d) < best) { best = Math.abs(d); dx = d; bx = tx; } }
    best = thr; let by = null;
    for (const ty of t.ys) for (const e of bys) { const d = ty - e; if (Math.abs(d) < best) { best = Math.abs(d); dy = d; by = ty; } }
    if (bx == null) dx = 0;
    if (by == null) dy = 0;
    const s = CBS.doc.size;
    if (bx != null) smart.lines.push([bx, Math.min(0, box.y), bx, Math.max(s.h, box.y + box.h)]);
    if (by != null) smart.lines.push([Math.min(0, box.x), by, Math.max(s.w, box.x + box.w), by]);
    return { dx, dy };
  }
  function clearSmart() { if (smart.lines.length) { smart.lines = []; requestOverlay(); } }

  /* ---------- pointer routing ---------- */
  let lastPointer = null;
  function onDown(e) {
    if (!CBS.doc.project) return;
    overlay.focus({ preventScroll: true });
    if (editing) { stopEditing(); }
    CBS.ui.closeMenu();
    overlay.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pointers.size === 2 && [...pointers.values()].every((p) => p.type === "touch")) {
      // two-finger pinch: abort the tool action and zoom/pan instead
      const t = CBS.tools.current;
      if (t.cancel) t.cancel();
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, zoom: view.zoom, panX: view.panX, panY: view.panY };
      pan = null;
      return;
    }
    if (pointers.size > 1) return;
    const ev = evt(e);
    lastPointer = ev;
    const tool = CBS.tools.current;
    if (e.button === 1 || spaceDown || tool.id === "hand" || (e.button === 2 && tool.id !== "select" && !tool.context)) {
      e.preventDefault();
      pan = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY };
      overlay.style.cursor = "grabbing";
      return;
    }
    if (e.button === 2) return;
    // dragging an existing guide (select tool only)
    if (tool.id === "select") {
      const g = guideAt(ev.sx, ev.sy);
      if (g && !handleAt(ev.sx, ev.sy)) {
        const page = CBS.doc.page;
        CBS.history.begin("page");
        guideDrag = g;
        return;
      }
    }
    tool.down && tool.down(ev);
    requestOverlay();
  }
  function onMove(e) {
    if (!CBS.doc.project) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const r = stageRect();
      const z = clamp(pinch.zoom * (d / (pinch.d || 1)), 0.05, 12);
      const ax = (pinch.cx - r.left - pinch.panX) / pinch.zoom, ay = (pinch.cy - r.top - pinch.panY) / pinch.zoom;
      view.zoom = z;
      view.panX = cx - r.left - ax * z;
      view.panY = cy - r.top - ay * z;
      bus.emit("zoom:changed", z);
      requestRender();
      return;
    }
    const ev = evt(e);
    lastPointer = ev;
    if (prefs.get("rulers", true)) drawRulers();
    if (pan) {
      view.panX = pan.panX + (e.clientX - pan.x);
      view.panY = pan.panY + (e.clientY - pan.y);
      clampPan();
      requestRender();
      return;
    }
    if (guideDrag) {
      const page = CBS.doc.page;
      page.guides[guideDrag.list][guideDrag.idx] = Math.round(guideDrag.list === "h" ? ev.y : ev.x);
      requestOverlay();
      return;
    }
    const tool = CBS.tools.current;
    // coalesced events give smoother strokes
    if (pointers.size && tool.move) {
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (list && list.length > 1 && tool.wantsCoalesced) for (const ce of list) tool.move(evt(ce));
      else tool.move(ev);
    } else if (tool.hover) tool.hover(ev);
    if (!pointers.size) {
      const hd = tool.id === "select" ? handleAt(ev.sx, ev.sy) : null;
      const g = tool.id === "select" && !hd ? guideAt(ev.sx, ev.sy) : null;
      const hov = tool.hoverOutline !== false && !hd ? hitTest(ev.x, ev.y) : null;
      const id = hov ? hov.id : null;
      if (id !== lastHover) { lastHover = id; }
      overlay.style.cursor = cursorForHandle(hd) || (g ? (g.list === "h" ? "ns-resize" : "ew-resize") : null) || (spaceDown ? "grab" : tool.cursorAt ? tool.cursorAt(ev, hov) : tool.cursor || "default");
    }
    requestOverlay();
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (pan) { pan = null; updateCursor(); return; }
    if (guideDrag) {
      const page = CBS.doc.page;
      const r = stageRect();
      if (e.clientX < r.left || e.clientY < r.top || e.clientX > r.right || e.clientY > r.bottom) page.guides[guideDrag.list].splice(guideDrag.idx, 1);
      guideDrag = null;
      CBS.history.end("Move guide");
      CBS.doc.changed();
      return;
    }
    const tool = CBS.tools.current;
    if (tool.up) tool.up(evt(e));
    clearSmart();
    requestOverlay();
  }
  function onCancel(e) {
    pointers.delete(e.pointerId);
    pinch = null;
    pan = null;
    const tool = CBS.tools.current;
    if (tool.cancel) tool.cancel();
  }
  function onDbl(e) {
    const tool = CBS.tools.current;
    if (tool.dblclick) tool.dblclick(evt(e));
  }
  function onWheel(e) {
    if (!CBS.doc.project) return;
    e.preventDefault();
    const r = stageRect();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
      setZoom(view.zoom * factor, e.clientX - r.left, e.clientY - r.top);
    } else {
      const k = e.deltaMode === 1 ? 20 : 1;
      view.panX -= (e.shiftKey ? e.deltaY : e.deltaX) * k;
      view.panY -= (e.shiftKey ? 0 : e.deltaY) * k;
      clampPan();
      requestRender();
    }
  }
  function updateCursor() {
    const tool = CBS.tools.current;
    overlay.style.cursor = spaceDown ? "grab" : (tool && tool.cursor) || "default";
  }

  /* ---------- text editing in place ---------- */
  function editText(o) {
    if (!o || !["bubble", "text", "sfx"].includes(o.kind)) return;
    stopEditing();
    const ta = h("textarea", { class: "text-edit", spellcheck: "true", "aria-label": "Edit text" });
    ta.value = o.text || "";
    stage.append(ta);
    editing = { obj: o, ta, original: o.text };
    CBS.history.begin("page");
    ta.addEventListener("input", () => {
      o.text = ta.value;
      if (o.kind === "bubble" && o.autoGrow) CBS.lettering.fitBubble(o);
      if (o.kind === "text") CBS.lettering.fitTextHeight(o);
      positionTextBox();
      requestRender();
      bus.emit("object:live", o);
    });
    ta.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); stopEditing(); }
    });
    ta.addEventListener("blur", () => setTimeout(() => { if (editing && editing.ta === ta) stopEditing(); }, 0));
    positionTextBox();
    requestRender();
    requestAnimationFrame(() => { ta.focus(); ta.select(); });
  }
  function positionTextBox() {
    if (!editing) return;
    const { obj: o, ta } = editing;
    const c = docToStage(o.x + o.w / 2, o.y + o.h / 2);
    let w = o.w, hh = o.h;
    if (o.kind === "bubble") { w = o.w * 0.78; hh = o.h * 0.7; }
    const size = o.kind === "sfx" ? Math.min(o.h * 0.5, 48) : o.fontSize || 18;
    ta.style.width = Math.max(60, w * view.zoom) + "px";
    ta.style.height = Math.max(30, hh * view.zoom) + "px";
    ta.style.left = c.x + "px";
    ta.style.top = c.y + "px";
    ta.style.transform = `translate(-50%, -50%) rotate(${o.rot || 0}deg)`;
    ta.style.fontFamily = CBS.fontStack(o.font || "Comic Neue");
    ta.style.fontSize = size * view.zoom + "px";
    ta.style.fontWeight = o.bold || o.kind === "sfx" ? "700" : "400";
    ta.style.fontStyle = o.italic ? "italic" : "normal";
    ta.style.textAlign = o.kind === "text" ? o.align || "left" : o.align || "center";
    ta.style.textTransform = o.uppercase || o.kind === "sfx" ? "uppercase" : "none";
    ta.style.lineHeight = String(o.lineHeight || 1.15);
    ta.style.color = o.kind === "sfx" ? o.outlineColor || "#111" : o.color || "#111";
  }
  function stopEditing() {
    if (!editing) return;
    const { obj, ta } = editing;
    editing = null;
    ta.remove();
    if (obj.kind === "bubble" && obj.autoGrow) CBS.lettering.fitBubble(obj);
    if (obj.kind === "text") CBS.lettering.fitTextHeight(obj);
    CBS.history.end("Edit text");
    CBS.doc.changed();
    bus.emit("selection:changed");
    requestRender();
  }

  CBS.editor = {
    init, view, requestRender, requestOverlay, screenToDoc, docToStage, setZoom, zoomStep, fit, ZOOMS,
    hitTest, panelAt, handleAt, unionBox, snapBox, clearSmart, smart, editText, stopEditing,
    get editing() { return editing; },
    get editPoints() { return editPoints; }, set editPoints(v) { editPoints = v; requestOverlay(); },
    cropMode: false,
    layerOffsets, setMarquee(m) { marquee = m; requestOverlay(); }, updateCursor, vertexScreenPoints,
    get canvas() { return overlay; }, get stage() { return stage; },
  };
})();
