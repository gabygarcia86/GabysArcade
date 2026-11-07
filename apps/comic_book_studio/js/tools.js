/* Tools. Each tool: { id, label, icon, key, tip, cursor, down/move/up/hover/dblclick/context/cancel, drawOverlay, options } */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clamp, DEG, prefs } = CBS;
  const R = () => CBS.render;
  const E = () => CBS.editor;
  const doc = () => CBS.doc;

  /* ---------- persistent tool settings ---------- */
  const DEFAULT_SETTINGS = {
    brush: "pen", sizes: {}, hardness: {}, opacity: {}, smoothing: 0.35, pressure: true, clipPanel: true,
    shape: "rect", shapeFill: true, shapeStroke: 3, shapeDash: "solid", sides: 6, innerRatio: 0.45,
    fillTolerance: 40, fillSampleAll: true, fillTarget: "auto",
    bubbleType: "speech", textFont: "Comic Neue", textSize: 24, sfxPreset: "classic", sfxWord: "POW!",
    panelMode: "rect", panelBorder: 4,
  };
  const settings = Object.assign({}, DEFAULT_SETTINGS, prefs.get("toolSettings", {}));
  const saveSettings = CBS.debounce(() => prefs.set("toolSettings", settings), 300);
  function setSetting(k, v) { settings[k] = v; saveSettings(); bus.emit("tool:settings"); E().requestOverlay(); }
  function brushParam(name, brush = settings.brush) {
    const def = CBS.raster.BRUSHES[brush] || CBS.raster.BRUSHES.pen;
    const map = settings[name === "size" ? "sizes" : name];
    return map && map[brush] != null ? map[brush] : def[name];
  }
  function setBrushParam(name, v, brush = settings.brush) {
    const key = name === "size" ? "sizes" : name;
    settings[key] = Object.assign({}, settings[key], { [brush]: v });
    saveSettings();
    E().requestOverlay();
  }

  const tools = [];
  const byId = {};
  function register(t) { tools.push(t); byId[t.id] = t; }

  let current = null;
  let previous = null;
  function setTool(id) {
    const t = byId[id];
    if (!t || t === current) return;
    if (current && current.deactivate) current.deactivate();
    if (current) previous = current.id;
    E().stopEditing();
    E().editPoints = null;
    current = t;
    if (t.activate) t.activate();
    E().updateCursor();
    bus.emit("tool:changed", id);
    E().requestRender();
  }

  /* helper: the selection's movable objects */
  function movable() {
    return doc().selected().filter((o) => { const l = doc().layerOf(o.id); return !o.locked && l && !l.locked; });
  }
  function ensureDrawingLayer() {
    let layer = doc().drawingLayer();
    if (layer) return layer;
    CBS.history.begin("page");
    layer = doc().insertLayer(CBS.createLayer("drawing"), doc().page);
    CBS.history.end("Add drawing layer");
    doc().setActiveLayer(layer.id);
    bus.emit("layers:changed");
    CBS.ui.toast("Added a drawing layer for your artwork");
    return layer;
  }
  const isRasterActive = () => { const l = doc().activeLayer; return l && l.type === "drawing"; };

  /* =====================================================================
   * SELECT
   * ===================================================================== */
  let drag = null;
  const select = {
    id: "select", label: "Select", icon: "🖱️", key: "V", cursor: "default",
    tip: "Select, move, resize and rotate (V). Double-click text to edit it, or a panel to edit its corners.",
    cursorAt(ev, hov) { return hov ? "move" : "default"; },
    down(ev) {
      const d = doc();
      const hd = E().handleAt(ev.sx, ev.sy);
      if (hd) {
        CBS.history.begin("page");
        const o = hd.obj;
        drag = { type: hd.type, dir: hd.dir, i: hd.i, obj: o, start: CBS.deepClone(o), ev0: ev };
        if (hd.type === "resize") {
          const sx = hd.dir.includes("e") ? 1 : hd.dir.includes("w") ? -1 : 0;
          const sy = hd.dir.includes("s") ? 1 : hd.dir.includes("n") ? -1 : 0;
          drag.sx = sx; drag.sy = sy;
          drag.anchor = R().localToPage(o, -sx * o.w / 2, -sy * o.h / 2);
        }
        if (hd.type === "rotate") drag.center = R().center(o);
        return;
      }
      const hit = E().hitTest(ev.x, ev.y);
      if (hit) {
        if (ev.shift || ev.ctrl) { d.select(hit.id, { toggle: true }); drag = null; return; }
        if (!d.selection.includes(hit.id)) d.select(hit.id);
        CBS.history.begin("page");
        let objs = movable();
        if (ev.alt && objs.length) {
          // alt-drag duplicates
          const clones = objs.map((o) => {
            const layer = d.layerOf(o.id);
            const c = Object.assign(CBS.deepClone(o), { id: CBS.uid("ob") });
            layer.objects.splice(layer.objects.indexOf(o) + 1, 0, c);
            return c;
          });
          d.select(clones.map((c) => c.id), { keepLayer: true });
          objs = clones;
        }
        drag = { type: "move", objs, starts: objs.map((o) => ({ x: o.x, y: o.y })), ev0: ev, box: E().unionBox(objs), moved: false };
        return;
      }
      if (!ev.shift) d.select([]);
      E().editPoints = null;
      drag = { type: "marquee", x0: ev.x, y0: ev.y, add: ev.shift };
      E().setMarquee({ x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y });
    },
    move(ev) {
      if (!drag) return;
      const o = drag.obj;
      if (drag.type === "marquee") { E().setMarquee({ x0: drag.x0, y0: drag.y0, x1: ev.x, y1: ev.y }); return; }
      if (drag.type === "move") {
        if (!drag.objs.length) return;
        let dx = ev.x - drag.ev0.x, dy = ev.y - drag.ev0.y;
        if (!drag.moved && Math.hypot(dx, dy) * E().view.zoom < 3) return;
        drag.moved = true;
        if (ev.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        const b = drag.box;
        const snap = E().snapBox({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }, new Set(drag.objs.map((x) => x.id)), { disabled: ev.ctrl });
        dx += snap.dx; dy += snap.dy;
        drag.objs.forEach((obj, i) => { obj.x = drag.starts[i].x + dx; obj.y = drag.starts[i].y + dy; });
        E().requestRender();
        bus.emit("object:live");
        return;
      }
      if (drag.type === "rotate") {
        const c = drag.center;
        let a = Math.atan2(ev.y - c.y, ev.x - c.x) / DEG + 90;
        if (ev.shift) a = Math.round(a / 15) * 15;
        a = ((a + 180) % 360 + 360) % 360 - 180;
        o.rot = Math.round(a * 10) / 10;
        E().requestRender();
        bus.emit("object:live");
        return;
      }
      if (drag.type === "tail") {
        const l = R().pageToLocal(o, ev.x, ev.y);
        o.tail = { x: l.x, y: l.y };
        E().requestRender();
        return;
      }
      if (drag.type === "vertex") { moveVertex(o, drag.i, ev); return; }
      if (drag.type === "resize") resizeDrag(ev);
    },
    up(ev) {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.type === "marquee") {
        E().setMarquee(null);
        const x0 = Math.min(d.x0, ev.x), x1 = Math.max(d.x0, ev.x), y0 = Math.min(d.y0, ev.y), y1 = Math.max(d.y0, ev.y);
        if (x1 - x0 < 2 && y1 - y0 < 2) return;
        const ids = [];
        for (const { obj, layer } of doc().allObjects()) {
          if (!layer.visible || layer.locked) continue;
          const b = R().aabb(obj);
          if (b.x >= x0 && b.y >= y0 && b.x + b.w <= x1 && b.y + b.h <= y1) ids.push(obj.id);
        }
        doc().select(ids, { add: d.add });
        return;
      }
      if (d.type === "resize" && d.obj.kind === "text") CBS.lettering.fitTextHeight(d.obj);
      const labels = { move: "Move", resize: E().cropMode ? "Crop image" : "Resize", rotate: "Rotate", tail: "Move bubble tail", vertex: "Edit panel shape" };
      CBS.history.end(labels[d.type] || "Edit");
      doc().changed();
      bus.emit("selection:changed");
    },
    cancel() { if (drag && drag.type !== "marquee") CBS.history.cancel(); drag = null; E().setMarquee(null); },
    dblclick(ev) {
      const hit = E().hitTest(ev.x, ev.y);
      if (!hit) return;
      if (["bubble", "text", "sfx"].includes(hit.kind)) { doc().select(hit.id); E().editText(hit); return; }
      if (hit.kind === "panel" || (hit.kind === "shape" && (hit.shape === "poly" || hit.shape === "line"))) {
        doc().select(hit.id);
        CBS.actions.editPoints(hit);
        return;
      }
      if (hit.kind === "image") { doc().select(hit.id); CBS.actions.toggleCrop(); }
    },
    context(ev) {
      const hit = E().hitTest(ev.x, ev.y);
      if (hit && !doc().selection.includes(hit.id)) doc().select(hit.id);
      CBS.actions.contextMenu({ x: ev.clientX, y: ev.clientY }, ev);
    },
  };

  function resizeDrag(ev) {
    const d = drag, o = d.obj, s = d.start;
    const rot = (s.rot || 0) * DEG;
    const fromCenter = ev.alt;
    const anchor = fromCenter ? R().center(s) : d.anchor;
    const vx = ev.x - anchor.x, vy = ev.y - anchor.y;
    const lx = vx * Math.cos(-rot) - vy * Math.sin(-rot), ly = vx * Math.sin(-rot) + vy * Math.cos(-rot);
    const k = fromCenter ? 2 : 1;
    let w = d.sx ? Math.max(4, d.sx * lx * k) : s.w;
    let hh = d.sy ? Math.max(4, d.sy * ly * k) : s.h;
    const crop = E().cropMode && o.kind === "image";
    if (crop) {
      const c = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, s.crop);
      const ppx = s.w / Math.max(0.02, 1 - c.l - c.r), ppy = s.h / Math.max(0.02, 1 - c.t - c.b);
      const nc = Object.assign({}, c);
      if (d.sx === 1) nc.r = clamp(c.r - (w - s.w) / ppx, 0, 1 - c.l - 0.02);
      if (d.sx === -1) nc.l = clamp(c.l - (w - s.w) / ppx, 0, 1 - c.r - 0.02);
      if (d.sy === 1) nc.b = clamp(c.b - (hh - s.h) / ppy, 0, 1 - c.t - 0.02);
      if (d.sy === -1) nc.t = clamp(c.t - (hh - s.h) / ppy, 0, 1 - c.b - 0.02);
      w = (1 - nc.l - nc.r) * ppx;
      hh = (1 - nc.t - nc.b) * ppy;
      o.crop = nc;
    } else {
      const keepAspect = (d.sx && d.sy) && (ev.shift !== (o.kind === "image" || o.kind === "sfx"));
      if (keepAspect) {
        const ar = s.w / s.h;
        if (w / hh > ar) hh = w / ar; else w = hh * ar;
      }
    }
    // snapping for unrotated boxes
    if (!s.rot && !ev.ctrl && !crop) {
      const ax = fromCenter ? anchor.x - w / 2 : d.sx === 1 ? anchor.x : d.sx === -1 ? anchor.x - w : s.x;
      const ay = fromCenter ? anchor.y - hh / 2 : d.sy === 1 ? anchor.y : d.sy === -1 ? anchor.y - hh : s.y;
      const xEdges = d.sx === 1 ? [ax + w] : d.sx === -1 ? [ax] : [];
      const yEdges = d.sy === 1 ? [ay + hh] : d.sy === -1 ? [ay] : [];
      const sn = E().snapBox({ x: ax, y: ay, w, h: hh }, new Set([o.id]), { xEdges, yEdges });
      if (d.sx === 1) w += sn.dx; else if (d.sx === -1) w -= sn.dx;
      if (d.sy === 1) hh += sn.dy; else if (d.sy === -1) hh -= sn.dy;
      w = Math.max(4, w); hh = Math.max(4, hh);
    }
    // new center from the anchor
    const alx = fromCenter ? 0 : -d.sx * w / 2, aly = fromCenter ? 0 : -d.sy * hh / 2;
    const cx = anchor.x - (alx * Math.cos(rot) - aly * Math.sin(rot));
    const cy = anchor.y - (alx * Math.sin(rot) + aly * Math.cos(rot));
    o.w = w; o.h = hh; o.x = cx - w / 2; o.y = cy - hh / 2;
    if (o.kind === "bubble" && s.tail) o.tail = { x: s.tail.x * (w / s.w), y: s.tail.y * (hh / s.h) };
    if (o.kind === "text" && d.sx && !d.sy) CBS.lettering.fitTextHeight(o);
    E().requestRender();
    bus.emit("object:live", o);
  }

  function localPoints(o) {
    if (o.kind === "panel") return R().panelLocalPoints(o);
    return (o.pts || []).map(([u, v]) => [(u - 0.5) * o.w, (v - 0.5) * o.h]);
  }
  function setLocalPoints(o, pts) {
    const b = CBS.polyBounds(pts);
    const w = Math.max(1, b.w), hh = Math.max(1, b.h);
    const c = R().localToPage(o, b.x + b.w / 2, b.y + b.h / 2);
    o.w = w; o.h = hh; o.x = c.x - w / 2; o.y = c.y - hh / 2;
    o.pts = pts.map(([x, y]) => [(x - b.x) / w, (y - b.y) / hh]);
    if (o.kind === "panel") o.shape = "poly";
  }
  function moveVertex(o, i, ev) {
    const pts = localPoints(o);
    const l = R().pageToLocal(o, ev.x, ev.y);
    pts[i] = [l.x, l.y];
    setLocalPoints(o, pts);
    E().requestRender();
  }

  /* =====================================================================
   * MOVE (whole layer)
   * ===================================================================== */
  let moveState = null;
  const move = {
    id: "move", label: "Move Layer", icon: "✥", key: "M", cursor: "move", hoverOutline: false,
    tip: "Move everything on the active layer, including drawings (M)",
    down(ev) {
      const layer = doc().activeLayer;
      if (!layer) return;
      if (layer.locked) { CBS.ui.toast("This layer is locked. Unlock it in the Layers panel to move it."); return; }
      moveState = { layer, x0: ev.x, y0: ev.y, dx: 0, dy: 0 };
    },
    move(ev) {
      if (!moveState) return;
      let dx = ev.x - moveState.x0, dy = ev.y - moveState.y0;
      if (ev.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      moveState.dx = dx; moveState.dy = dy;
      E().layerOffsets[moveState.layer.id] = { dx, dy };
      E().requestRender();
    },
    up() {
      if (!moveState) return;
      const { layer, dx, dy } = moveState;
      moveState = null;
      delete E().layerOffsets[layer.id];
      if (!dx && !dy) { E().requestRender(); return; }
      if (layer.objects.length) doc().edit("Move layer", () => { for (const o of layer.objects) { o.x += dx; o.y += dy; } });
      if (layer.type === "drawing") CBS.raster.moveLayerPixels(layer, dx, dy);
      E().requestRender();
    },
    cancel() { if (moveState) { delete E().layerOffsets[moveState.layer.id]; moveState = null; E().requestRender(); } },
    options() {
      const l = doc().activeLayer;
      return h("p", { class: "hint" }, l ? `Drag to move everything on “${l.name}”. Hold Shift to move in a straight line. Choose a different layer in the Layers panel.` : "Pick a layer first.");
    },
  };

  /* =====================================================================
   * HAND (pan) - handled by the editor
   * ===================================================================== */
  const hand = { id: "hand", label: "Hand", icon: "✋", key: "H", cursor: "grab", hoverOutline: false, showSelection: false, tip: "Pan around the page (H, or hold Space)" };

  /* =====================================================================
   * DRAW & ERASE
   * ===================================================================== */
  let strokeOn = false, lastEnd = null;
  function brushSettings(brush) {
    return {
      brush, size: brushParam("size", brush), hardness: brushParam("hardness", brush), opacity: brushParam("opacity", brush),
      color: brush === "eraser" ? "#000000" : CBS.colors.primary, smoothing: brush === "airbrush" ? 0 : settings.smoothing,
      pressure: settings.pressure && CBS.raster.BRUSHES[brush].pressure,
    };
  }
  function makeBrushTool(id, label, icon, key, tip, brushOf) {
    return {
      id, label, icon, key, tip, cursor: "crosshair", hoverOutline: false, showSelection: false, wantsCoalesced: true,
      down(ev) {
        const layer = ensureDrawingLayer();
        if (layer.locked) { CBS.ui.toast("The drawing layer is locked."); return; }
        if (!layer.visible) { CBS.ui.toast("The drawing layer is hidden. Show it in the Layers panel to draw."); return; }
        const brush = brushOf();
        const s = brushSettings(brush);
        const clip = settings.clipPanel ? E().panelAt(ev.x, ev.y) : null;
        const pt = { x: ev.x, y: ev.y, pressure: ev.pressure, pointerType: ev.pointerType };
        if (ev.shift && lastEnd && lastEnd.layerId === layer.id) {
          CBS.raster.beginStroke(layer, { ...lastEnd, pointerType: ev.pointerType }, Object.assign(s, { smoothing: 0 }), clip);
          CBS.raster.strokeTo(pt);
        } else CBS.raster.beginStroke(layer, pt, s, clip);
        strokeOn = true;
        if (brush !== "eraser") CBS.colors.addRecent(CBS.colors.primary);
      },
      move(ev) { if (strokeOn) CBS.raster.strokeTo({ x: ev.x, y: ev.y, pressure: ev.pressure, pointerType: ev.pointerType }); },
      up(ev) {
        if (!strokeOn) return;
        strokeOn = false;
        CBS.raster.endStroke();
        const l = doc().drawingLayer();
        lastEnd = { x: ev.x, y: ev.y, layerId: l && l.id };
      },
      cancel() { if (strokeOn) { CBS.raster.cancelStroke(); strokeOn = false; } },
      drawOverlay(ctx, api) {
        const p = api.hover;
        if (!p) return;
        const brush = brushOf();
        const r = Math.max(1.5, (brushParam("size", brush) * api.zoom) / 2);
        ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 1, 0, Math.PI * 2); ctx.stroke();
      },
      options() { return brushOptions(id === "eraser"); },
    };
  }
  const draw = makeBrushTool("draw", "Draw", "✏️", "B", "Draw with pencil, pen, brush, marker or airbrush (B). Shift-click draws a straight line from your last stroke.", () => (settings.brush === "eraser" ? "pen" : settings.brush));
  const eraser = makeBrushTool("eraser", "Eraser", "🩹", "E", "Erase on the drawing layer (E)", () => "eraser");

  function brushOptions(isEraser) {
    const brush = isEraser ? "eraser" : settings.brush === "eraser" ? "pen" : settings.brush;
    const box = h("div", { class: "tool-opts" });
    if (!isEraser) {
      const grid = h("div", { class: "brush-grid" });
      for (const [k, b] of Object.entries(CBS.raster.BRUSHES)) {
        if (k === "eraser") continue;
        grid.append(h("button", { class: "brush-btn" + (k === brush ? " on" : ""), tip: b.tip, onclick: () => { setSetting("brush", k); bus.emit("props:refresh"); } }, h("span", { class: "bb-ico" }, b.icon), h("span", null, b.label)));
      }
      box.append(grid);
    }
    box.append(
      CBS.ui.slider({ label: "Size", min: 1, max: 200, value: brushParam("size", brush), onInput: (v) => setBrushParam("size", v, brush), tip: "Brush size ( [ and ] )" }),
      CBS.ui.slider({ label: "Hardness", min: 0, max: 100, value: Math.round(brushParam("hardness", brush) * 100), unit: "%", onInput: (v) => setBrushParam("hardness", v / 100, brush) }),
      CBS.ui.slider({ label: "Opacity", min: 1, max: 100, value: Math.round(brushParam("opacity", brush) * 100), unit: "%", onInput: (v) => setBrushParam("opacity", v / 100, brush) }));
    if (!isEraser) box.append(CBS.ui.slider({ label: "Smoothing", min: 0, max: 90, value: Math.round(settings.smoothing * 100), unit: "%", onInput: (v) => setSetting("smoothing", v / 100) }));
    box.append(
      CBS.ui.toggle("Pen pressure", settings.pressure, (v) => setSetting("pressure", v), { tip: "Use stylus pressure when your tablet and browser support it. The ink pen also thins out when you draw fast with a mouse." }),
      CBS.ui.toggle("Stay inside the panel", settings.clipPanel, (v) => setSetting("clipPanel", v), { tip: "Strokes that start inside a panel can't spill outside it" }),
      h("p", { class: "hint" }, isEraser ? "Erases pixels on the drawing layer. To remove a bubble or image, select it and press Delete." : "Tip: hold Shift and click to draw a straight line from where your last stroke ended."));
    return box;
  }

  /* =====================================================================
   * SHAPES
   * ===================================================================== */
  let shapeDrag = null, polyPts = null;
  const shapeTool = {
    id: "shape", label: "Shapes", icon: "⬟", key: "U", cursor: "crosshair", hoverOutline: false,
    tip: "Draw lines, rectangles, ellipses, polygons, stars, bursts, arrows and speed lines (U)",
    down(ev) {
      if (settings.shape === "poly") {
        if (!polyPts) polyPts = [];
        const first = polyPts[0];
        if (first && polyPts.length > 2 && Math.hypot(first[0] - ev.x, first[1] - ev.y) * E().view.zoom < 10) { finishPoly(); return; }
        polyPts.push([ev.x, ev.y]);
        E().requestOverlay();
        return;
      }
      shapeDrag = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y, shift: ev.shift, alt: ev.alt };
    },
    move(ev) { if (shapeDrag) { shapeDrag.x1 = ev.x; shapeDrag.y1 = ev.y; shapeDrag.shift = ev.shift; shapeDrag.alt = ev.alt; } },
    hover() { if (polyPts) E().requestOverlay(); },
    up() {
      if (!shapeDrag) return;
      const d = shapeDrag;
      shapeDrag = null;
      const kind = settings.shape;
      let props;
      if (kind === "line") {
        let { x0, y0, x1, y1 } = d;
        if (Math.hypot(x1 - x0, y1 - y0) < 3) { x1 = x0 + 120; y1 = y0; }
        if (d.shift) { const a = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4); const L = Math.hypot(x1 - x0, y1 - y0); x1 = x0 + Math.cos(a) * L; y1 = y0 + Math.sin(a) * L; }
        const bx = Math.min(x0, x1), by = Math.min(y0, y1), bw = Math.max(1, Math.abs(x1 - x0)), bh = Math.max(1, Math.abs(y1 - y0));
        props = { x: bx, y: by, w: bw, h: bh, pts: [[(x0 - bx) / bw, (y0 - by) / bh], [(x1 - bx) / bw, (y1 - by) / bh]] };
      } else {
        const b = dragBox(d, 140, 100);
        props = { x: b.x, y: b.y, w: b.w, h: b.h };
      }
      createShape(kind, props);
    },
    dblclick() { if (polyPts && polyPts.length > 3) { polyPts.pop(); finishPoly(); } },
    cancel() { shapeDrag = null; polyPts = null; E().requestOverlay(); },
    deactivate() { if (polyPts && polyPts.length >= 3) finishPoly(); polyPts = null; },
    key(e) { if (polyPts && e.key === "Enter") { finishPoly(); return true; } if (polyPts && e.key === "Escape") { polyPts = null; E().requestOverlay(); return true; } return false; },
    drawOverlay(ctx, api) {
      ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      if (shapeDrag) {
        const d = shapeDrag;
        if (settings.shape === "line") {
          const a = api.docToStage(d.x0, d.y0), b = api.docToStage(d.x1, d.y1);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        } else {
          const bb = dragBox(d, 0, 0);
          const a = api.docToStage(bb.x, bb.y);
          if (settings.shape === "ellipse") { ctx.beginPath(); ctx.ellipse(a.x + bb.w * api.zoom / 2, a.y + bb.h * api.zoom / 2, bb.w * api.zoom / 2, bb.h * api.zoom / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
          else ctx.strokeRect(a.x, a.y, bb.w * api.zoom, bb.h * api.zoom);
        }
      }
      if (polyPts && polyPts.length) drawPolyPreview(ctx, api, polyPts);
      ctx.setLineDash([]);
    },
    options() {
      const box = h("div", { class: "tool-opts" });
      const grid = h("div", { class: "brush-grid shapes" });
      const icons = { rect: "▭", ellipse: "◯", line: "╱", poly: "⬠", triangle: "△", ngon: "⬡", star: "★", burst: "✸", arrow: "➜", heart: "♥", focus: "✺", speed: "≡" };
      for (const [k, label] of Object.entries(R().SHAPES)) {
        grid.append(h("button", { class: "brush-btn" + (k === settings.shape ? " on" : ""), tip: label, onclick: () => { setSetting("shape", k); polyPts = null; bus.emit("props:refresh"); } }, h("span", { class: "bb-ico" }, icons[k] || "◆"), h("span", null, label)));
      }
      box.append(grid,
        CBS.ui.toggle("Fill shape", settings.shapeFill, (v) => setSetting("shapeFill", v)),
        CBS.ui.slider({ label: "Line width", min: 0, max: 40, value: settings.shapeStroke, onInput: (v) => setSetting("shapeStroke", v) }),
        CBS.ui.field("Line style", CBS.ui.segmented([["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]], settings.shapeDash, (v) => setSetting("shapeDash", v), { small: true })),
        h("p", { class: "hint" }, settings.shape === "poly" ? "Click to add corners. Click the first corner, double-click or press Enter to finish." : "Drag to draw. Shift keeps it even, Alt draws from the center. Line color = primary color, fill = secondary color."));
      return box;
    },
  };
  function dragBox(d, defW, defH) {
    let w = Math.abs(d.x1 - d.x0), hh = Math.abs(d.y1 - d.y0);
    if (w < 3 && hh < 3 && defW) { return { x: d.x0 - defW / 2, y: d.y0 - defH / 2, w: defW, h: defH }; }
    if (d.shift) { const m = Math.max(w, hh); w = m; hh = m; }
    let x = d.x1 < d.x0 ? d.x0 - w : d.x0, y = d.y1 < d.y0 ? d.y0 - hh : d.y0;
    if (d.alt) { x = d.x0 - w; y = d.y0 - hh; w *= 2; hh *= 2; }
    return { x, y, w: Math.max(4, w), h: Math.max(4, hh) };
  }
  function drawPolyPreview(ctx, api, pts) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const p = api.docToStage(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    if (api.hover) ctx.lineTo(api.hover.sx, api.hover.sy);
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach(([x, y], i) => { const p = api.docToStage(x, y); ctx.fillStyle = i === 0 ? "#fde047" : "#22d3ee"; ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 6 : 4, 0, Math.PI * 2); ctx.fill(); });
  }
  function createShape(kind, props) {
    const isFx = kind === "focus" || kind === "speed";
    const o = CBS.createObject("shape", Object.assign({
      shape: kind, fill: CBS.colors.secondary, fillOn: settings.shapeFill && kind !== "line", stroke: CBS.colors.primary,
      strokeWidth: settings.shapeStroke, dash: settings.shapeDash,
      sides: kind === "focus" ? 64 : kind === "speed" ? 26 : kind === "burst" ? 14 : kind === "star" ? 5 : settings.sides,
      innerRatio: kind === "focus" ? 0.45 : kind === "burst" ? 0.7 : settings.innerRatio,
    }, props));
    if (isFx) o.fillOn = false;
    doc().edit("Add " + (R().SHAPES[kind] || "shape").toLowerCase(), () => doc().addObject(o));
    doc().select(o.id);
    CBS.colors.addRecent(CBS.colors.primary);
    return o;
  }
  function finishPoly() {
    const pts = polyPts;
    polyPts = null;
    if (!pts || pts.length < 3) { E().requestOverlay(); return; }
    const b = CBS.polyBounds(pts);
    createShape("poly", { x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h), pts: pts.map(([x, y]) => [(x - b.x) / Math.max(1, b.w), (y - b.y) / Math.max(1, b.h)]) });
  }

  /* =====================================================================
   * FILL
   * ===================================================================== */
  const fill = {
    id: "fill", label: "Fill", icon: "🪣", key: "G", cursor: "cell", hoverOutline: true,
    tip: "Fill an area of your drawing, or recolor a panel, bubble or shape (G)",
    down(ev) {
      const color = ev.alt ? CBS.colors.secondary : CBS.colors.primary;
      const target = settings.fillTarget;
      const wantObjects = target === "objects" || (target === "auto" && !isRasterActive());
      if (wantObjects) {
        const hit = E().hitTest(ev.x, ev.y);
        if (hit && fillObject(hit, color)) return;
        if (target === "objects") { CBS.ui.toast("Click a panel, bubble, shape or text to recolor it."); return; }
      }
      const layer = ensureDrawingLayer();
      if (layer.locked) { CBS.ui.toast("The drawing layer is locked."); return; }
      const ok = CBS.raster.floodFill(layer, ev, color, { tolerance: settings.fillTolerance, sampleAll: settings.fillSampleAll });
      if (!ok) CBS.ui.toast("Nothing to fill there.");
      CBS.colors.addRecent(color);
    },
    options() {
      return h("div", { class: "tool-opts" },
        CBS.ui.field("Fill what", CBS.ui.segmented([["auto", "Auto", "Drawing layer active: fill pixels. Otherwise: recolor the object you click."], ["pixels", "Pixels"], ["objects", "Objects"]], settings.fillTarget, (v) => setSetting("fillTarget", v), { small: true })),
        CBS.ui.slider({ label: "Tolerance", min: 0, max: 200, value: settings.fillTolerance, onInput: (v) => setSetting("fillTolerance", v), tip: "How different a color can be and still get filled" }),
        CBS.ui.toggle("Use lines from all layers", settings.fillSampleAll, (v) => setSetting("fillSampleAll", v), { tip: "Panel borders and art on other layers stop the fill" }),
        h("p", { class: "hint" }, "Fills with the primary color. Alt-click fills with the secondary color. Pixel fills go on the drawing layer, so your line art stays separate."));
    },
  };
  function fillObject(o, color) {
    const l = doc().layerOf(o.id);
    if (o.locked || (l && l.locked)) return false;
    const map = { panel: "fill", bubble: "fill", sfx: "fill", text: "color", shape: o.shape === "line" || o.shape === "focus" || o.shape === "speed" ? "stroke" : "fill" };
    const key = map[o.kind];
    if (!key) return false;
    doc().edit("Fill color", () => { o[key] = color; if (o.kind === "shape" && key === "fill") o.fillOn = true; if (o.kind === "sfx") o.gradient = false; });
    doc().select(o.id);
    return true;
  }

  /* =====================================================================
   * EYEDROPPER
   * ===================================================================== */
  function sampleAt(ev) {
    const c = CBS.render.pageCanvas(doc().page, 1);
    const x = clamp(Math.floor(ev.x), 0, c.width - 1), y = clamp(Math.floor(ev.y), 0, c.height - 1);
    const d = c.getContext("2d").getImageData(x, y, 1, 1).data;
    return CBS.rgbToHex(d[0], d[1], d[2]);
  }
  const eyedropper = {
    id: "eyedropper", label: "Color Picker", icon: "💧", key: "I", cursor: "copy", hoverOutline: false,
    tip: "Pick a color from the page (I). Alt-click sets the secondary color.",
    down(ev) {
      const hex = sampleAt(ev);
      CBS.colors.set(ev.alt ? "secondary" : "primary", hex);
      CBS.ui.toast(`Picked ${hex}`, { kind: "dim", ms: 1000 });
      if (prefs.get("eyedropperReturn", true) && previous && previous !== "eyedropper") setTool(previous);
    },
    options() {
      return h("div", { class: "tool-opts" },
        CBS.ui.toggle("Go back to the last tool after picking", prefs.get("eyedropperReturn", true), (v) => prefs.set("eyedropperReturn", v)),
        h("p", { class: "hint" }, "Click anywhere on the page to pick its color as your primary color."));
    },
  };

  /* =====================================================================
   * TEXT, BUBBLES, SFX
   * ===================================================================== */
  let placeDrag = null;
  function placeDown(ev) { placeDrag = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y, shift: ev.shift, alt: ev.alt }; }
  function placeMove(ev) { if (placeDrag) { placeDrag.x1 = ev.x; placeDrag.y1 = ev.y; } }
  function placeOverlay(ctx, api) {
    if (!placeDrag) return;
    const bb = dragBox(placeDrag, 0, 0);
    const a = api.docToStage(bb.x, bb.y);
    ctx.strokeStyle = "#22d3ee"; ctx.setLineDash([5, 4]); ctx.strokeRect(a.x, a.y, bb.w * api.zoom, bb.h * api.zoom); ctx.setLineDash([]);
  }

  const textTool = {
    id: "text", label: "Text", icon: "🔤", key: "T", cursor: "text", hoverOutline: true,
    tip: "Add captions, titles and labels (T). Click existing text to edit it.",
    down(ev) {
      const hit = E().hitTest(ev.x, ev.y, { kinds: new Set(["text", "bubble", "sfx"]) });
      if (hit) { doc().select(hit.id); E().editText(hit); placeDrag = null; return; }
      placeDown(ev);
    },
    move: placeMove,
    up() {
      if (!placeDrag) return;
      const big = Math.abs(placeDrag.x1 - placeDrag.x0) > 10;
      const b = big ? dragBox(placeDrag, 0, 0) : { x: placeDrag.x0, y: placeDrag.y0, w: 240, h: 40 };
      placeDrag = null;
      const o = CBS.createObject("text", { x: b.x, y: b.y, w: Math.max(40, b.w), h: 40, font: settings.textFont, fontSize: settings.textSize, color: CBS.colors.primary, text: "" });
      CBS.lettering.fitTextHeight(o);
      doc().edit("Add text", () => doc().addObject(o));
      doc().select(o.id);
      E().editText(o);
    },
    drawOverlay: placeOverlay,
    options() {
      return h("div", { class: "tool-opts" },
        CBS.ui.field("Font", fontSelect(settings.textFont, (v) => setSetting("textFont", v))),
        CBS.ui.slider({ label: "Size", min: 6, max: 160, value: settings.textSize, onInput: (v) => setSetting("textSize", v) }),
        h("p", { class: "hint" }, "Click to type, or drag to set the width. Text color is your primary color."));
    },
  };

  const bubbleTool = {
    id: "bubble", label: "Speech Bubble", icon: "💬", key: "S", cursor: "crosshair", hoverOutline: true,
    tip: "Add speech, thought, whisper, shout, narration, radio and electronic bubbles (S)",
    down(ev) {
      const hit = E().hitTest(ev.x, ev.y, { kinds: new Set(["bubble"]) });
      if (hit && !ev.alt) { doc().select(hit.id); E().editText(hit); placeDrag = null; return; }
      placeDown(ev);
    },
    move: placeMove,
    up() {
      if (!placeDrag) return;
      const big = Math.abs(placeDrag.x1 - placeDrag.x0) > 12 && Math.abs(placeDrag.y1 - placeDrag.y0) > 12;
      const type = settings.bubbleType;
      const def = type === "narration" ? { w: 230, h: 64 } : { w: 190, h: 110 };
      const b = big ? dragBox(placeDrag, 0, 0) : { x: placeDrag.x0 - def.w / 2, y: placeDrag.y0 - def.h / 2, w: def.w, h: def.h };
      placeDrag = null;
      const o = CBS.createObject("bubble", { x: b.x, y: b.y, w: b.w, h: b.h, text: "" });
      CBS.lettering.applyBubbleType(o, type);
      // point the tail toward the page center-bottom by default
      const size = doc().size;
      const sideX = b.x + b.w / 2 > size.w / 2 ? 1 : -1;
      o.tail = { x: sideX * b.w * 0.18, y: b.h * 0.95 };
      if (type === "narration") { o.tailOn = false; o.y = Math.max(0, o.y); }
      doc().edit("Add speech bubble", () => doc().addObject(o));
      doc().select(o.id);
      E().editText(o);
    },
    drawOverlay: placeOverlay,
    options() {
      const box = h("div", { class: "tool-opts" });
      const grid = h("div", { class: "brush-grid" });
      for (const [k, t] of Object.entries(CBS.lettering.BUBBLE_TYPES)) {
        grid.append(h("button", { class: "brush-btn" + (k === settings.bubbleType ? " on" : ""), onclick: () => { setSetting("bubbleType", k); bus.emit("props:refresh"); } }, h("span", { class: "bb-ico" }, t.icon), h("span", null, t.label)));
      }
      box.append(grid, h("p", { class: "hint" }, "Click to add a bubble and start typing, or drag to set its size. Drag the pink dot to aim the tail. Click an existing bubble to edit its words."));
      return box;
    },
  };

  const sfxTool = {
    id: "sfx", label: "Sound Effect", icon: "💥", key: "X", cursor: "crosshair", hoverOutline: true,
    tip: "Add sound effect lettering like POW!, BAM! and WHOOSH! (X)",
    down(ev) {
      const hit = E().hitTest(ev.x, ev.y, { kinds: new Set(["sfx"]) });
      if (hit) { doc().select(hit.id); placeDrag = null; return; }
      placeDown(ev);
    },
    move: placeMove,
    up() {
      if (!placeDrag) return;
      const big = Math.abs(placeDrag.x1 - placeDrag.x0) > 12 && Math.abs(placeDrag.y1 - placeDrag.y0) > 12;
      const b = big ? dragBox(placeDrag, 0, 0) : { x: placeDrag.x0 - 140, y: placeDrag.y0 - 70, w: 280, h: 140 };
      placeDrag = null;
      addSfx(b, settings.sfxWord, settings.sfxPreset);
    },
    drawOverlay: placeOverlay,
    options() {
      const box = h("div", { class: "tool-opts" });
      const words = h("div", { class: "chip-row" });
      for (const w of CBS.lettering.SFX_WORDS) words.append(h("button", { class: "chip" + (w === settings.sfxWord ? " on" : ""), onclick: () => { setSetting("sfxWord", w); bus.emit("props:refresh"); } }, w));
      const presets = h("div", { class: "sfx-presets" });
      for (const p of CBS.lettering.SFX_PRESETS) {
        presets.append(h("button", { class: "sfx-preset" + (p.id === settings.sfxPreset ? " on" : ""), tip: p.label, onclick: () => { setSetting("sfxPreset", p.id); bus.emit("props:refresh"); } }, sfxPreview(p, settings.sfxWord)));
      }
      box.append(h("div", { class: "psec-title" }, "Word"), words, h("div", { class: "psec-title" }, "Lettering style"), presets,
        h("p", { class: "hint" }, "Click the page to stamp it, or drag to size it. You can change every part afterwards."));
      return box;
    },
  };
  function addSfx(b, word, presetId) {
    const p = CBS.lettering.SFX_PRESETS.find((x) => x.id === presetId) || CBS.lettering.SFX_PRESETS[0];
    const props = Object.assign({}, p, { text: word, x: b.x, y: b.y, w: b.w, h: b.h, rot: -6 });
    delete props.id; delete props.label;
    const o = CBS.createObject("sfx", props);
    doc().edit("Add sound effect", () => doc().addObject(o));
    doc().select(o.id);
    return o;
  }
  const previewCache = new Map();
  function sfxPreview(p, word) {
    const key = p.id + word;
    let url = previewCache.get(key);
    if (!url) {
      const c = CBS.makeCanvas(150, 70);
      const ctx = c.getContext("2d");
      ctx.translate(75, 35);
      const o = Object.assign(CBS.createObject("sfx", p), { id: "pv" + p.id, w: 146, h: 66, text: word });
      CBS.lettering.drawSfx(ctx, o);
      url = c.toDataURL();
      previewCache.set(key, url);
    }
    return h("img", { src: url, alt: p.label, draggable: "false" });
  }
  bus.on("fonts:loaded", () => previewCache.clear());

  function fontSelect(value, onChange) {
    const groups = {};
    for (const f of CBS.FONTS) (groups[f.group] = groups[f.group] || []).push([f.id, f.label]);
    const s = CBS.ui.select(Object.entries(groups).map(([g, items]) => ({ group: g, items })), value, onChange, { label: "Font" });
    return s;
  }

  /* =====================================================================
   * PANELS
   * ===================================================================== */
  let panelDrag = null, panelPoly = null, freePts = null, gutter = null;
  function findGutter(x, y) {
    const panels = doc().panels().filter((p) => p.shape !== "poly" && !p.rot);
    const g = (doc().project.settings.gutter || 14);
    const maxGap = Math.max(30, g * 3);
    const tol = 1.5;
    for (const a of panels) for (const b of panels) {
      if (a === b) continue;
      // vertical gutter: a on the left, b on the right
      const gapX = b.x - (a.x + a.w);
      if (gapX >= -1 && gapX <= maxGap && x >= a.x + a.w - 3 && x <= b.x + 3) {
        const top = Math.max(a.y, b.y), bot = Math.min(a.y + a.h, b.y + b.h);
        if (bot - top > 10 && y >= top && y <= bot) {
          const L = a.x + a.w, Rr = b.x;
          const band = (p) => p.y < bot + 2 && p.y + p.h > top - 2;
          return { axis: "x", left: panels.filter((p) => Math.abs(p.x + p.w - L) < tol && band(p)), right: panels.filter((p) => Math.abs(p.x - Rr) < tol && band(p)) };
        }
      }
      const gapY = b.y - (a.y + a.h);
      if (gapY >= -1 && gapY <= maxGap && y >= a.y + a.h - 3 && y <= b.y + 3) {
        const l = Math.max(a.x, b.x), r = Math.min(a.x + a.w, b.x + b.w);
        if (r - l > 10 && x >= l && x <= r) {
          const T = a.y + a.h, B = b.y;
          const band = (p) => p.x < r + 2 && p.x + p.w > l - 2;
          return { axis: "y", left: panels.filter((p) => Math.abs(p.y + p.h - T) < tol && band(p)), right: panels.filter((p) => Math.abs(p.y - B) < tol && band(p)) };
        }
      }
    }
    return null;
  }
  const panelTool = {
    id: "panel", label: "Panel", icon: "▦", key: "P", cursor: "crosshair", hoverOutline: true,
    tip: "Draw, slice and resize comic panels (P). Drag a gutter between panels to resize both.",
    cursorAt(ev) {
      if (settings.panelMode === "slice") return "crosshair";
      const g = findGutter(ev.x, ev.y);
      return g ? (g.axis === "x" ? "col-resize" : "row-resize") : "crosshair";
    },
    down(ev) {
      const mode = settings.panelMode;
      if (mode !== "slice" && mode !== "poly") {
        const g = findGutter(ev.x, ev.y);
        if (g) {
          CBS.history.begin("page");
          gutter = Object.assign(g, { x0: ev.x, y0: ev.y, startL: g.left.map((p) => ({ ...p })), startR: g.right.map((p) => ({ ...p })) });
          return;
        }
      }
      if (mode === "poly") {
        if (!panelPoly) panelPoly = [];
        const first = panelPoly[0];
        if (first && panelPoly.length > 2 && Math.hypot(first[0] - ev.x, first[1] - ev.y) * E().view.zoom < 10) { finishPanelPoly(panelPoly); panelPoly = null; return; }
        panelPoly.push([ev.x, ev.y]);
        E().requestOverlay();
        return;
      }
      if (mode === "free") { freePts = [[ev.x, ev.y]]; return; }
      panelDrag = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y, shift: ev.shift || mode === "square", alt: ev.alt };
    },
    move(ev) {
      if (gutter) {
        const d = gutter.axis === "x" ? ev.x - gutter.x0 : ev.y - gutter.y0;
        const key = gutter.axis === "x" ? ["x", "w"] : ["y", "h"];
        const minL = Math.min(...gutter.startL.map((p) => p[key[1]])), minR = Math.min(...gutter.startR.map((p) => p[key[1]]));
        const dd = clamp(d, -(minL - 30), minR - 30);
        gutter.left.forEach((p, i) => { p[key[1]] = gutter.startL[i][key[1]] + dd; });
        gutter.right.forEach((p, i) => { p[key[0]] = gutter.startR[i][key[0]] + dd; p[key[1]] = gutter.startR[i][key[1]] - dd; });
        E().requestRender();
        return;
      }
      if (freePts) { freePts.push([ev.x, ev.y]); E().requestOverlay(); return; }
      if (panelDrag) { panelDrag.x1 = ev.x; panelDrag.y1 = ev.y; if (settings.panelMode !== "square") panelDrag.shift = ev.shift; }
    },
    hover() { if (panelPoly) E().requestOverlay(); },
    up(ev) {
      if (gutter) { gutter = null; CBS.history.end("Resize panels"); doc().changed(); return; }
      if (freePts) {
        const pts = CBS.simplify(freePts, 3);
        freePts = null;
        if (pts.length >= 3 && CBS.polyBounds(pts).w > 10) finishPanelPoly(pts);
        E().requestOverlay();
        return;
      }
      if (!panelDrag) return;
      const d = panelDrag;
      panelDrag = null;
      if (settings.panelMode === "slice") {
        sliceAt({ x: d.x0, y: d.y0 }, { x: ev.x, y: ev.y });
        return;
      }
      if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) * E().view.zoom < 6) {
        const hit = E().panelAt(ev.x, ev.y);
        if (hit) doc().select(hit.id);
        return;
      }
      const b = dragBox(d, 0, 0);
      const o = CBS.createObject("panel", { x: b.x, y: b.y, w: b.w, h: b.h, borderWidth: settings.panelBorder });
      doc().edit("Add panel", () => doc().addObject(o));
      doc().select(o.id);
    },
    dblclick() { if (panelPoly && panelPoly.length > 3) { panelPoly.pop(); finishPanelPoly(panelPoly); panelPoly = null; } },
    cancel() { if (gutter) { CBS.history.cancel(); gutter = null; } panelDrag = null; panelPoly = null; freePts = null; E().requestOverlay(); },
    deactivate() { panelPoly = null; freePts = null; },
    key(e) {
      if (panelPoly && e.key === "Enter") { finishPanelPoly(panelPoly); panelPoly = null; return true; }
      if (panelPoly && e.key === "Escape") { panelPoly = null; E().requestOverlay(); return true; }
      return false;
    },
    drawOverlay(ctx, api) {
      // panel numbers in reading order
      const panels = doc().panels();
      ctx.font = "bold 12px system-ui, sans-serif";
      panels.forEach((p, i) => {
        const b = R().aabb(p);
        const s = api.docToStage(b.x, b.y);
        ctx.fillStyle = "rgba(168,85,247,0.85)";
        ctx.fillRect(s.x + 4, s.y + 4, 20, 18);
        ctx.fillStyle = "#fff";
        ctx.fillText(String(i + 1), s.x + (i + 1 >= 10 ? 7 : 10), s.y + 17);
      });
      ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      if (panelDrag) {
        if (settings.panelMode === "slice") {
          const a = api.docToStage(panelDrag.x0, panelDrag.y0), b = api.docToStage(panelDrag.x1, panelDrag.y1);
          ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        } else {
          const bb = dragBox(panelDrag, 0, 0);
          const a = api.docToStage(bb.x, bb.y);
          ctx.strokeRect(a.x, a.y, bb.w * api.zoom, bb.h * api.zoom);
        }
      }
      if (panelPoly && panelPoly.length) drawPolyPreview(ctx, api, panelPoly);
      if (freePts && freePts.length > 1) {
        ctx.beginPath();
        freePts.forEach(([x, y], i) => { const p = api.docToStage(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if (gutter) {
        ctx.fillStyle = "rgba(168,85,247,0.3)";
        for (const p of gutter.left.concat(gutter.right)) { const a = api.docToStage(p.x, p.y); ctx.fillRect(a.x, a.y, p.w * api.zoom, p.h * api.zoom); }
      }
    },
    options() {
      const box = h("div", { class: "tool-opts" });
      box.append(CBS.ui.field("Mode", CBS.ui.segmented([
        ["rect", "▭ Draw", "Drag to draw a rectangle panel"], ["square", "□ Square", "Drag to draw a square panel"],
        ["poly", "⬠ Polygon", "Click corners for a custom-shaped panel"], ["free", "✎ Freeform", "Draw any panel shape by hand"],
        ["slice", "✂ Slice", "Drag a line across a panel to cut it in two, straight or diagonal"],
      ], settings.panelMode, (v) => { setSetting("panelMode", v); panelPoly = null; bus.emit("props:refresh"); })));
      box.append(CBS.ui.slider({ label: "Border", min: 0, max: 20, value: settings.panelBorder, onInput: (v) => setSetting("panelBorder", v), tip: "Border thickness for new panels" }));
      const hints = {
        rect: "Drag to draw a panel. Drag the gap between two panels to resize them both.",
        square: "Drag to draw a square panel.",
        poly: "Click to place corners. Click the first corner, double-click or press Enter to finish.",
        free: "Draw the panel's outline in one stroke.",
        slice: "Drag a line all the way across a panel to cut it into two panels with a gutter.",
      };
      box.append(h("p", { class: "hint" }, hints[settings.panelMode]),
        CBS.ui.button("Choose a page layout…", () => CBS.pagesPanel.layoutPicker(), { icon: "▦", kind: "wide" }));
      return box;
    },
  };
  function finishPanelPoly(pts) {
    if (!pts || pts.length < 3) return;
    const o = CBS.layouts.panelFromPoly(pts, { borderWidth: settings.panelBorder });
    doc().edit("Add panel", () => doc().addObject(o));
    doc().select(o.id);
  }
  function sliceAt(a, b) {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 8) return;
    // extend the cut line well past both ends so it crosses the whole panel
    const L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, ext = 5000;
    const A = { x: a.x - ux * ext, y: a.y - uy * ext }, B = { x: b.x + ux * ext, y: b.y + uy * ext };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const panel = E().panelAt(mid.x, mid.y) || E().panelAt(a.x, a.y);
    if (!panel) { CBS.ui.toast("Drag the cut line across a panel."); return; }
    const res = CBS.layouts.slicePanel(panel, A, B, doc().project.settings.gutter || 14);
    if (!res) { CBS.ui.toast("That cut would leave a panel too small."); return; }
    doc().edit("Slice panel", () => {
      const layer = doc().layerOf(panel.id);
      const i = layer.objects.indexOf(panel);
      Object.assign(res[0], { radius: panel.radius });
      layer.objects.splice(i, 1, res[0], res[1]);
      for (const { obj } of doc().allObjects()) if (obj.clip === panel.id) {
        const c = R().center(obj);
        obj.clip = CBS.pointInPoly(c.x, c.y, R().panelPagePoints(res[1])) ? res[1].id : res[0].id;
      }
    });
    doc().select([res[0].id, res[1].id]);
  }

  /* =====================================================================
   * IMAGE
   * ===================================================================== */
  const imageTool = {
    id: "image", label: "Image", icon: "🖼️", key: "K", cursor: "copy", hoverOutline: false,
    tip: "Import a picture (PNG, JPG, WEBP, SVG). Click inside a panel to place it there (K)",
    async down(ev) {
      const files = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg", true);
      if (!files || !files.length) return;
      const assets = await CBS.assets.importFiles(files, "misc");
      assets.forEach((a, i) => CBS.assets.placeAsset(a, { at: { x: ev.x + i * 20, y: ev.y + i * 20 } }));
      if (assets.length) setTool("select");
    },
    options() {
      return h("div", { class: "tool-opts" },
        CBS.ui.button("Import images…", async () => {
          const files = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg", true);
          if (!files || !files.length) return;
          const sel = doc().selected()[0];
          const panel = sel && sel.kind === "panel" ? sel : null;
          const assets = await CBS.assets.importFiles(files, "misc");
          assets.forEach((a) => CBS.assets.placeAsset(a, { panel }));
        }, { icon: "📁", kind: "primary wide" }),
        CBS.ui.button("Open the asset library", () => CBS.library.open(), { icon: "🗂️", kind: "wide" }),
        h("p", { class: "hint" }, "Click the page to import a picture there. Inside a panel, the picture is clipped to that panel. You can also drag image files from your computer onto the page."));
    },
  };

  [select, move, hand, draw, eraser, shapeTool, fill, eyedropper, textTool, bubbleTool, sfxTool, panelTool, imageTool].forEach(register);

  CBS.tools = {
    list: tools, byId, set: setTool, settings, setSetting, brushParam, setBrushParam, fontSelect, sfxPreview, addSfx, createShape,
    setLocalPoints, localPoints, ensureDrawingLayer,
    get current() { return current; }, get previous() { return previous; },
    init() { current = select; },
  };
})();
