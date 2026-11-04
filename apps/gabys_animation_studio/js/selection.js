/* Selection tool.
 * - Click a sticker, picture, text or effect to select it, then drag, resize, spin or flip it.
 * - Drag on empty canvas to draw a box around part of your drawing. Those pixels lift up as a
 *   "floating selection" you can move, resize and spin; it drops back down when you're done. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, h, ctxOf, history, Layer, clamp } = GAS;

  let gesture = null;
  let marquee = null; // {x0, y0, x1, y1} in art coords while dragging
  let hoverCursor = "";
  let clipboard = null;
  let edit = null; // pending object edit {frame, before, label, timer}
  let toolbar = null;

  /* ---------- target helpers ---------- */
  function selectedObject() {
    const sel = state.selection, f = GAS.curFrame();
    if (!sel || sel.kind !== "object" || !f) return null;
    return f.objects.find((o) => o.id === sel.id) || null;
  }
  function target() {
    if (state.float) return state.float;
    return selectedObject();
  }
  function emitSel() {
    GAS.bus.emit("selection-changed", state.selection);
    GAS.view.queueOverlay();
    updateToolbar();
  }

  function corners(t) {
    const c = Math.cos(t.rot || 0), s = Math.sin(t.rot || 0);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const lx = (sx * t.w) / 2, ly = (sy * t.h) / 2;
      return { x: t.x + lx * c - ly * s, y: t.y + lx * s + ly * c };
    });
  }
  function toLocal(t, p) {
    const c = Math.cos(-(t.rot || 0)), s = Math.sin(-(t.rot || 0));
    const dx = p.x - t.x, dy = p.y - t.y;
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }
  function localToWorld(t, lx, ly) {
    const c = Math.cos(t.rot || 0), s = Math.sin(t.rot || 0);
    return { x: t.x + lx * c - ly * s, y: t.y + lx * s + ly * c };
  }
  function hitObject(pt) {
    const f = GAS.curFrame();
    for (let i = f.objects.length - 1; i >= 0; i--) {
      const o = f.objects[i];
      const l = toLocal(o, pt);
      const pad = 4 / state.zoom;
      if (Math.abs(l.x) <= o.w / 2 + pad && Math.abs(l.y) <= o.h / 2 + pad) return o;
    }
    return null;
  }
  function hitBody(t, pt) {
    const l = toLocal(t, pt);
    return Math.abs(l.x) <= t.w / 2 && Math.abs(l.y) <= t.h / 2;
  }

  const handleRadius = (pt) => (pt && pt.isTouch ? 24 : 14);

  /* Handles in screen space. Returns [{hx, hy, x, y, rotate?}] */
  function handles(t) {
    const list = [];
    const isText = t.type === "text";
    for (const [hx, hy] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
      if (isText && (hx === 0 || hy === 0)) continue;
      const w = localToWorld(t, (hx * t.w) / 2, (hy * t.h) / 2);
      list.push({ hx, hy, ...GAS.view.toScreen(w.x, w.y) });
    }
    const rotDist = 34 / state.zoom;
    const flipY = 1;
    const r = localToWorld(t, 0, (-t.h / 2 - rotDist) * flipY);
    list.push({ rotate: true, ...GAS.view.toScreen(r.x, r.y) });
    return list;
  }
  function hitHandle(t, pt) {
    const sp = GAS.view.toScreen(pt.x, pt.y);
    const rad = handleRadius(pt);
    let best = null, bd = Infinity;
    for (const hd of handles(t)) {
      const d = Math.hypot(hd.x - sp.x, hd.y - sp.y);
      if (d < rad && d < bd) { bd = d; best = hd; }
    }
    return best;
  }

  /* ---------- object edits with undo ---------- */
  function beginObjGesture(label) {
    const f = GAS.curFrame();
    return { frame: f, before: history.cloneObjs(f.objects), label };
  }
  function endObjGesture(g) {
    history.pushObjects(g.frame, g.before, g.label);
    GAS.touchFrame(g.frame);
  }

  /* Property edits from the side panel (color, text, opacity...). Quick edits in a row become one undo step. */
  function editObject(changes, label = "Change", obj) {
    const o = obj || selectedObject();
    if (!o) return;
    const f = GAS.curFrame();
    if (!edit || edit.frame !== f || edit.label !== label) {
      flushEdit();
      edit = { frame: f, before: history.cloneObjs(f.objects), label };
    }
    Object.assign(o, changes);
    if (o.type === "text" && ("text" in changes || "size" in changes || "font" in changes || "bold" in changes || "italic" in changes || "outline" in changes || "outlineWidth" in changes)) {
      GAS.render.fitText(o);
    }
    clearTimeout(edit.timer);
    edit.timer = setTimeout(flushEdit, 800);
    GAS.view.refreshObjects();
    GAS.view.queueOverlay();
    GAS.touchFrame(f);
    updateToolbar();
  }
  function flushEdit() {
    if (!edit) return;
    clearTimeout(edit.timer);
    const e = edit;
    edit = null;
    history.pushObjects(e.frame, e.before, e.label);
  }

  /* ---------- floating pixel selection ---------- */
  function lift(rectArt) {
    const { layer, frameId, kind } = GAS.tools.activeTarget();
    const r = history.clipRect(layer, rectArt.x, rectArt.y, rectArt.w, rectArt.h);
    if (!r || r.w < 2 || r.h < 2) return false;
    const src = ctxOf(layer.canvas);
    const px = src.getImageData(r.x, r.y, r.w, r.h);
    let any = false;
    for (let i = 3; i < px.data.length; i += 4) if (px.data[i] > 0) { any = true; break; }
    if (!any) {
      GAS.ui.toast(state.activeLayer === "bg" ? "Nothing painted there on the background." : "Nothing drawn there yet. Draw something first!");
      return false;
    }
    const full = { x: 0, y: 0, w: layer.canvas.width, h: layer.canvas.height };
    const before = history.captureRaster(layer, full);
    const c = GAS.makeCanvas(r.w, r.h);
    ctxOf(c).putImageData(px, 0, 0);
    src.clearRect(r.x, r.y, r.w, r.h);
    layer.v++;
    state.float = { canvas: c, x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, h: r.h, rot: 0, flipX: false, flipY: false, layer, kind, frameId, before, full, changed: false, pasted: false };
    state.selection = { kind: "float" };
    GAS.view.refreshLayer(kind);
    emitSel();
    return true;
  }

  function drawFloat(ctx, fl) {
    const f = fl || state.float;
    if (!f) return;
    ctx.save();
    ctx.translate(f.x, f.y);
    if (f.rot) ctx.rotate(f.rot);
    if (f.flipX || f.flipY) ctx.scale(f.flipX ? -1 : 1, f.flipY ? -1 : 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h);
    ctx.restore();
  }

  function commitFloat() {
    const f = state.float;
    if (!f) return false;
    state.float = null;
    if (!f.changed && !f.pasted) {
      // Nothing moved: just put the pixels back exactly as they were.
      ctxOf(f.layer.canvas).putImageData(f.before, 0, 0);
      f.layer.v++;
      delete f.layer._wasEmpty;
    } else {
      drawFloat(ctxOf(f.layer.canvas), f);
      Layer.touch(f.layer);
      history.pushRaster(f.layer, f.full, f.before, f.frameId, f.pasted ? "Paste" : "Move selection");
      GAS.tools.afterLayerChange(f.frameId);
    }
    if (state.selection && state.selection.kind === "float") state.selection = null;
    GAS.view.refreshLayer(f.kind);
    emitSel();
    return true;
  }

  function cancelFloat() {
    flushEdit();
    const f = state.float;
    if (!f) return false;
    state.float = null;
    ctxOf(f.layer.canvas).putImageData(f.before, 0, 0);
    f.layer.v++;
    if (f.layer._wasEmpty) f.layer.empty = true;
    delete f.layer._wasEmpty;
    if (state.selection && state.selection.kind === "float") state.selection = null;
    GAS.view.refreshLayer(f.kind);
    emitSel();
    return true;
  }

  function deleteFloat() {
    const f = state.float;
    if (!f) return;
    state.float = null;
    if (f.pasted) {
      cancelFloatRaw(f);
    } else {
      Layer.touch(f.layer);
      history.pushRaster(f.layer, f.full, f.before, f.frameId, "Delete selection");
      GAS.tools.afterLayerChange(f.frameId);
    }
    state.selection = null;
    GAS.view.refreshLayer(f.kind);
    emitSel();
  }
  function cancelFloatRaw(f) {
    ctxOf(f.layer.canvas).putImageData(f.before, 0, 0);
    f.layer.v++;
    delete f.layer._wasEmpty;
  }

  /* ---------- selecting ---------- */
  function selectObject(id) {
    commitFloat();
    flushEdit();
    state.selection = id ? { kind: "object", id } : null;
    emitSel();
  }
  function deselect() {
    flushEdit();
    commitFloat();
    if (state.selection) { state.selection = null; emitSel(); }
  }

  /* ---------- pointer handling ---------- */
  function down(pt) {
    const t = target();
    if (state.tool === "text") {
      const hit = hitObject(pt);
      if (t && t.type === "text" && hitHandle(t, pt)) return startHandle(t, hitHandle(t, pt), pt);
      if (hit && hit.type === "text") {
        selectObject(hit.id);
        return startMove(hit, pt);
      }
      return addTextAt(pt);
    }
    if (t) {
      const hd = hitHandle(t, pt);
      if (hd) return startHandle(t, hd, pt);
      if (state.float && hitBody(state.float, pt)) return startMove(state.float, pt);
    }
    const hit = hitObject(pt);
    if (hit) {
      if (!t || t.id !== hit.id) selectObject(hit.id);
      return startMove(hit, pt);
    }
    deselect();
    marquee = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
    gesture = { kind: "marquee" };
  }

  function startMove(t, pt) {
    gesture = { kind: "move", t, sx: pt.x, sy: pt.y, x0: t.x, y0: t.y, obj: t === state.float ? null : beginObjGesture("Move") };
  }
  function startHandle(t, hd, pt) {
    const obj = t === state.float ? null : beginObjGesture(hd.rotate ? "Rotate" : "Resize");
    if (hd.rotate) {
      gesture = { kind: "rotate", t, rot0: t.rot || 0, a0: Math.atan2(pt.y - t.y, pt.x - t.x), obj };
    } else {
      const anchor = localToWorld(t, (-hd.hx * t.w) / 2, (-hd.hy * t.h) / 2);
      gesture = { kind: "scale", t, hx: hd.hx, hy: hd.hy, w0: t.w, h0: t.h, size0: t.size, anchor, obj };
    }
  }

  function move(pt) {
    if (!gesture) return;
    const g = gesture;
    if (g.kind === "marquee") {
      marquee.x1 = pt.x;
      marquee.y1 = pt.y;
      GAS.view.queueOverlay();
      return;
    }
    const t = g.t;
    if (g.kind === "move") {
      t.x = g.x0 + (pt.x - g.sx);
      t.y = g.y0 + (pt.y - g.sy);
    } else if (g.kind === "rotate") {
      let r = g.rot0 + Math.atan2(pt.y - t.y, pt.x - t.x) - g.a0;
      const step = Math.PI / 12;
      if (pt.shift) r = Math.round(r / step) * step;
      else {
        const snap = Math.round(r / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(r - snap) < 0.07) r = snap;
      }
      t.rot = r;
    } else if (g.kind === "scale") {
      const c = Math.cos(-t.rot), s = Math.sin(-t.rot);
      const dx = pt.x - g.anchor.x, dy = pt.y - g.anchor.y;
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      let w = g.w0, hgt = g.h0;
      const min = 6;
      const uniform = t.type === "text" || (g.hx && g.hy && !pt.shift);
      if (g.hx && g.hy && uniform) {
        let f = (lx * g.hx * g.w0 + ly * g.hy * g.h0) / (g.w0 * g.w0 + g.h0 * g.h0);
        f = Math.max(f, min / Math.min(g.w0, g.h0));
        w = g.w0 * f; hgt = g.h0 * f;
      } else {
        if (g.hx) w = Math.max(min, lx * g.hx);
        if (g.hy) hgt = Math.max(min, ly * g.hy);
      }
      if (t.type === "text") {
        t.size = clamp(g.size0 * (w / g.w0), 6, 600);
        GAS.render.fitText(t);
        w = t.w; hgt = t.h;
      } else {
        t.w = w; t.h = hgt;
      }
      const cc = Math.cos(t.rot), ss = Math.sin(t.rot);
      const ox = (g.hx * w) / 2, oy = (g.hy * hgt) / 2;
      t.x = g.anchor.x + ox * cc - oy * ss;
      t.y = g.anchor.y + ox * ss + oy * cc;
    }
    if (t === state.float) { t.changed = true; GAS.view.refreshLayer(t.kind); }
    else GAS.view.refreshObjects();
    GAS.view.queueOverlay();
    updateToolbar();
  }

  function up(pt) {
    const g = gesture;
    gesture = null;
    if (!g) return;
    if (g.kind === "marquee") {
      const r = { x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1), w: Math.abs(marquee.x1 - marquee.x0), h: Math.abs(marquee.y1 - marquee.y0) };
      marquee = null;
      if (r.w * state.zoom > 4 && r.h * state.zoom > 4) lift(r);
      GAS.view.queueOverlay();
      return;
    }
    if (g.obj) endObjGesture(g.obj);
    GAS.view.queueOverlay();
    updateToolbar();
  }

  function cancelGesture() {
    const g = gesture;
    gesture = null;
    marquee = null;
    if (g && g.obj) {
      g.obj.frame.objects = g.obj.before;
      GAS.view.refreshObjects();
    }
    GAS.view.queueOverlay();
  }

  function hover(pt) {
    const t = target();
    let cur = "";
    if (t) {
      const hd = hitHandle(t, pt);
      if (hd) cur = hd.rotate ? "grab" : "nwse-resize";
      else if (hitBody(t, pt)) cur = "move";
    }
    if (!cur && hitObject(pt)) cur = "pointer";
    if (cur !== hoverCursor) {
      hoverCursor = cur;
      GAS.view.stage.style.cursor = cur;
    }
  }

  function dblclick(pt) {
    if (state.tool !== "select" && state.tool !== "text") return;
    const hit = hitObject(pt);
    if (hit && hit.type === "text") {
      selectObject(hit.id);
      GAS.bus.emit("edit-text", hit);
    } else if (state.float && !hitBody(state.float, pt)) commitFloat();
  }

  /* ---------- text ---------- */
  function addTextAt(pt) {
    deselect();
    const f = GAS.curFrame();
    const d = state.textDefaults;
    const o = GAS.model.baseObject("text", { ...d, text: "Hello!", x: pt.x, y: pt.y });
    GAS.render.fitText(o);
    const g = beginObjGesture("Add text");
    f.objects.push(o);
    endObjGesture(g);
    state.selection = { kind: "object", id: o.id };
    GAS.view.refreshObjects();
    emitSel();
    GAS.bus.emit("edit-text", o);
  }

  /* ---------- adding objects ---------- */
  function addObject(o, label = "Add sticker") {
    commitFloat();
    flushEdit();
    const f = GAS.curFrame();
    const g = beginObjGesture(label);
    f.objects.push(o);
    endObjGesture(g);
    if (state.tool !== "select") GAS.tools.set("select");
    state.selection = { kind: "object", id: o.id };
    GAS.view.refreshObjects();
    emitSel();
  }

  /* ---------- commands ---------- */
  function deleteSelection() {
    if (state.float) { deleteFloat(); return true; }
    const o = selectedObject();
    if (!o) return false;
    flushEdit();
    const g = beginObjGesture("Delete");
    g.frame.objects = g.frame.objects.filter((x) => x.id !== o.id);
    endObjGesture(g);
    state.selection = null;
    GAS.view.refreshObjects();
    emitSel();
    return true;
  }

  function copy() {
    if (state.float) {
      const f = state.float;
      clipboard = { kind: "pixels", canvas: GAS.copyCanvas(f.canvas), x: f.x, y: f.y, w: f.w, h: f.h, rot: f.rot, flipX: f.flipX, flipY: f.flipY };
      GAS.ui.toast("Copied!");
      return true;
    }
    const o = selectedObject();
    if (o) { clipboard = { kind: "object", obj: { ...o } }; GAS.ui.toast("Copied!"); return true; }
    return false;
  }
  function cut() {
    if (!copy()) return false;
    deleteSelection();
    return true;
  }
  function paste() {
    if (!clipboard) { GAS.ui.toast("Nothing copied yet. Select something and press Copy."); return false; }
    deselect();
    if (clipboard.kind === "object") {
      const o = { ...clipboard.obj, id: GAS.uid("o") };
      // Paste on the same spot if it's another frame (great for animation!), nudged if it's this one.
      if (GAS.curFrame().objects.some((x) => x.x === o.x && x.y === o.y)) { o.x += 16; o.y += 16; }
      clipboard.obj = { ...o };
      addObject(o, "Paste");
      return true;
    }
    const { layer, frameId, kind } = GAS.tools.activeTarget();
    if (state.tool !== "select") GAS.tools.set("select");
    const full = { x: 0, y: 0, w: layer.canvas.width, h: layer.canvas.height };
    const before = history.captureRaster(layer, full);
    const c = clipboard;
    state.float = { canvas: GAS.copyCanvas(c.canvas), x: c.x, y: c.y, w: c.w, h: c.h, rot: c.rot, flipX: c.flipX, flipY: c.flipY, layer, kind, frameId, before, full, changed: true, pasted: true };
    state.selection = { kind: "float" };
    GAS.view.refreshLayer(kind);
    emitSel();
    return true;
  }
  function duplicate() {
    const o = selectedObject();
    if (o) {
      const c = { ...o, id: GAS.uid("o"), x: o.x + 20, y: o.y + 20 };
      if (c.type === "effect") c.seed = Math.floor(Math.random() * 1e9);
      addObject(c, "Duplicate");
      return;
    }
    if (state.float) {
      const f = state.float;
      clipboard = { kind: "pixels", canvas: GAS.copyCanvas(f.canvas), x: f.x + 20, y: f.y + 20, w: f.w, h: f.h, rot: f.rot, flipX: f.flipX, flipY: f.flipY };
      commitFloat();
      paste();
    }
  }
  function flip(axis) {
    const t = target();
    if (!t) return;
    const key = axis === "y" ? "flipY" : "flipX";
    if (t === state.float) {
      t[key] = !t[key];
      t.changed = true;
      GAS.view.refreshLayer(t.kind);
    } else {
      flushEdit();
      const g = beginObjGesture("Flip");
      t[key] = !t[key];
      endObjGesture(g);
      GAS.view.refreshObjects();
    }
    GAS.view.queueOverlay();
  }
  function reorder(dir) {
    const o = selectedObject();
    if (!o) return;
    const f = GAS.curFrame();
    const i = f.objects.indexOf(o);
    const j = dir === "front" ? f.objects.length - 1 : dir === "back" ? 0 : clamp(i + dir, 0, f.objects.length - 1);
    if (i === j) return;
    flushEdit();
    const g = beginObjGesture(dir === "back" || dir < 0 ? "Send back" : "Bring forward");
    f.objects.splice(i, 1);
    f.objects.splice(j, 0, o);
    endObjGesture(g);
    GAS.view.refreshObjects();
  }
  function selectAll() {
    if (state.tool !== "select") GAS.tools.set("select");
    deselect();
    const p = state.project;
    lift({ x: 0, y: 0, w: p.width, h: p.height });
  }

  /* Copy the selected thing onto the next frame too (handy for animating!). */
  function copyToNextFrame() {
    const p = state.project;
    const o = selectedObject();
    if (!o) return;
    if (state.cur >= p.frames.length - 1) { GAS.ui.toast("This is the last frame. Add a new frame first!"); return; }
    const next = p.frames[state.cur + 1];
    const before = history.cloneObjs(next.objects);
    const c = { ...o, id: GAS.uid("o") };
    next.objects.push(c);
    history.pushObjects(next, before, "Copy to next frame");
    GAS.touchFrame(next);
    GAS.ui.toast("Copied to frame " + (state.cur + 2) + "!");
  }

  /* ---------- overlay ---------- */
  function drawOverlay(ctx) {
    if (marquee) {
      const a = GAS.view.toScreen(Math.min(marquee.x0, marquee.x1), Math.min(marquee.y0, marquee.y1));
      const b = GAS.view.toScreen(Math.max(marquee.x0, marquee.x1), Math.max(marquee.y0, marquee.y1));
      ctx.save();
      ctx.fillStyle = "rgba(76,201,240,0.12)";
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1f8fff";
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.restore();
    }
    const t = target();
    if (!t) { updateToolbar(); return; }
    const pts = corners(t).map((p) => GAS.view.toScreen(p.x, p.y));
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = t === state.float ? "#1f8fff" : "#9b5de5";
    ctx.stroke();
    ctx.setLineDash([]);
    const hs = handles(t);
    const rot = hs.find((x) => x.rotate);
    const topMid = GAS.view.toScreen(...Object.values(localToWorld(t, 0, -t.h / 2)));
    ctx.strokeStyle = "#9b5de5";
    ctx.beginPath();
    ctx.moveTo(topMid.x, topMid.y);
    ctx.lineTo(rot.x, rot.y);
    ctx.stroke();
    const big = matchMedia("(pointer: coarse)").matches;
    for (const hd of hs) {
      ctx.beginPath();
      if (hd.rotate) {
        ctx.arc(hd.x, hd.y, big ? 12 : 9, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd23f";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2b2340";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hd.x, hd.y, big ? 5.5 : 4, -Math.PI * 0.9, Math.PI * 0.4);
        ctx.stroke();
      } else {
        const r = (big ? 9 : 6) * (hd.hx && hd.hy ? 1 : 0.8);
        ctx.rect(hd.x - r, hd.y - r, r * 2, r * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#9b5de5";
        ctx.stroke();
      }
    }
    ctx.restore();
    updateToolbar();
  }

  /* ---------- floating mini toolbar ---------- */
  function buildToolbar() {
    const I = GAS.icons.svg;
    const b = (icon, tip, fn, cls) => h("button", { class: "mini-btn " + (cls || ""), type: "button", tip, "aria-label": tip, onclick: (e) => { e.stopPropagation(); fn(); } }, I(icon));
    toolbar = h("div", { class: "sel-toolbar stage-ui", hidden: true },
      b("copy", "Make a copy", duplicate),
      b("flipH", "Flip sideways", () => flip("x")),
      b("flipV", "Flip upside down", () => flip("y")),
      h("span", { class: "sel-obj-only" },
        b("forward", "Bring to front", () => reorder(1)),
        b("backward", "Send to back", () => reorder(-1)),
        b("nextFrame", "Copy to next frame", copyToNextFrame)),
      b("trash", "Delete", deleteSelection, "is-danger"),
      h("span", { class: "sel-float-only" }, b("check", "Done: drop it here", commitFloat, "is-go")));
    GAS.view.stage.appendChild(toolbar);
  }
  function updateToolbar() {
    if (!toolbar) buildToolbar();
    const t = target();
    if (!t || gesture || state.playing) { toolbar.hidden = true; return; }
    toolbar.hidden = false;
    toolbar.classList.toggle("is-float", t === state.float);
    const pts = corners(t).map((p) => GAS.view.toScreen(p.x, p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const minY = Math.min(...pts.map((p) => p.y));
    const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
    const stage = GAS.view.stage;
    const tw = toolbar.offsetWidth || 260, th = toolbar.offsetHeight || 44;
    let y = maxY + 14;
    if (y + th > stage.clientHeight - 6) y = minY - th - 46;
    y = clamp(y, 6, stage.clientHeight - th - 6);
    const x = clamp(cx - tw / 2, 6, Math.max(6, stage.clientWidth - tw - 6));
    toolbar.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  GAS.selection = {
    down, move, up, hover, dblclick, cancelGesture, drawOverlay, drawFloat,
    commitFloat, cancelFloat, deselect, selectObject, selectedObject, target,
    editObject, flushEdit, addObject, deleteSelection, copy, cut, paste, duplicate, flip, reorder, selectAll, copyToNextFrame,
    get hasClipboard() { return !!clipboard; },
  };
})();
