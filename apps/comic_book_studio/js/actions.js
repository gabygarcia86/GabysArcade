/* Commands used by menus, keyboard shortcuts, panels and the context menu. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { bus, uid, deepClone } = CBS;
  const doc = () => CBS.doc;
  const R = () => CBS.render;
  const E = () => CBS.editor;

  /* ---------- clipboard ---------- */
  let clipboard = null;
  function copy() {
    const sel = doc().selected();
    if (!sel.length) return false;
    const assets = {};
    for (const o of sel) if (o.kind === "image") { const a = CBS.assets.find(o.assetId); if (a) assets[a.id] = a; }
    clipboard = { items: sel.map((o) => ({ obj: deepClone(o), layerType: doc().layerOf(o.id).type })), assets, pageId: doc().page.id, pastes: 0 };
    CBS.ui.toast(`Copied ${sel.length} item${sel.length > 1 ? "s" : ""}`, { kind: "dim", ms: 1000 });
    return true;
  }
  function cut() { if (copy()) del("Cut"); }
  function paste() {
    if (!clipboard) return false;
    const d = doc();
    const p = d.project;
    clipboard.pastes++;
    const off = clipboard.pageId === d.page.id ? 16 * clipboard.pastes : 0;
    const ids = [];
    d.edit("Paste", () => {
      for (const a of Object.values(clipboard.assets)) if (!p.assets.some((x) => x.id === a.id)) p.assets.push(deepClone(a));
      const idMap = {};
      for (const it of clipboard.items) {
        const o = deepClone(it.obj);
        idMap[o.id] = o.id = uid("ob");
        o.x += off; o.y += off;
        const layer = d.page.layers.find((l) => l.type === it.layerType && !l.locked) || d.targetLayerFor(o.kind);
        layer.objects.push(o);
        ids.push(o.id);
      }
      // keep clipping to pasted panels; drop clips to panels that don't exist here
      for (const id of ids) { const o = d.obj(id); if (o.clip) o.clip = idMap[o.clip] || (d.obj(o.clip) ? o.clip : null); }
    });
    d.select(ids, { keepLayer: true });
    return true;
  }
  function duplicate() {
    const sel = doc().selected();
    if (!sel.length) return;
    const ids = [];
    doc().edit("Duplicate", () => {
      const idMap = {};
      for (const o of sel) {
        const layer = doc().layerOf(o.id);
        const c = deepClone(o);
        idMap[o.id] = c.id = uid("ob");
        c.x += 16; c.y += 16;
        layer.objects.splice(layer.objects.indexOf(o) + 1, 0, c);
        ids.push(c.id);
      }
      for (const id of ids) { const o = doc().obj(id); if (o.clip && idMap[o.clip]) o.clip = idMap[o.clip]; }
    });
    doc().select(ids, { keepLayer: true });
  }
  function del(label = "Delete") {
    const sel = doc().selected().filter((o) => { const l = doc().layerOf(o.id); return !(l && l.locked); });
    if (!sel.length) return;
    doc().edit(label, () => doc().removeObjects(sel.map((o) => o.id)));
    bus.emit("selection:changed");
  }
  function selectAll() {
    const ids = doc().allObjects().filter(({ layer }) => layer.visible && !layer.locked).map(({ obj }) => obj.id);
    doc().select(ids, { keepLayer: true });
  }

  /* ---------- arrange ---------- */
  function nudge(dx, dy) {
    const objs = doc().selected().filter((o) => !o.locked && !doc().layerOf(o.id).locked);
    if (!objs.length) return;
    doc().edit("Nudge", () => objs.forEach((o) => { o.x += dx; o.y += dy; }));
    nudgeMerge();
  }
  // merge consecutive nudges into one undo step
  let lastNudge = 0;
  function nudgeMerge() {
    const H = CBS.history;
    const now = Date.now();
    if (now - lastNudge < 800 && H.undoStack.length >= 2) {
      const a = H.undoStack[H.undoStack.length - 2], b = H.undoStack[H.undoStack.length - 1];
      if (a.label === "Nudge" && b.label === "Nudge" && a.pageId === b.pageId && a.type === "page" && b.type === "page") {
        a.after = b.after; a.selAfter = b.selAfter;
        H.undoStack.pop();
      }
    }
    lastNudge = now;
  }
  function arrange(where) {
    const sel = doc().selected();
    if (!sel.length) return;
    doc().edit("Arrange", () => {
      const byLayer = new Map();
      for (const o of sel) { const l = doc().layerOf(o.id); if (!byLayer.has(l)) byLayer.set(l, []); byLayer.get(l).push(o); }
      for (const [layer, objs] of byLayer) {
        const set = new Set(objs);
        const arr = layer.objects;
        if (where === "front") layer.objects = arr.filter((o) => !set.has(o)).concat(arr.filter((o) => set.has(o)));
        else if (where === "back") layer.objects = arr.filter((o) => set.has(o)).concat(arr.filter((o) => !set.has(o)));
        else if (where === "forward") { for (let i = arr.length - 2; i >= 0; i--) if (set.has(arr[i]) && !set.has(arr[i + 1])) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; }
        else if (where === "backward") { for (let i = 1; i < arr.length; i++) if (set.has(arr[i]) && !set.has(arr[i - 1])) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; }
      }
    });
  }
  function flip(axis) {
    const objs = doc().selected().filter((o) => ["image", "shape", "panel"].includes(o.kind));
    if (!objs.length) { CBS.ui.toast("Flip works on images, shapes and panels. Bubbles have a Flip tail option instead."); return; }
    doc().edit("Flip", () => objs.forEach((o) => { if (axis === "x") o.flipX = !o.flipX; else o.flipY = !o.flipY; }));
  }
  function toggleLock() {
    const sel = doc().selected();
    if (!sel.length) return;
    const lock = !sel.every((o) => o.locked);
    doc().edit(lock ? "Lock" : "Unlock", () => sel.forEach((o) => (o.locked = lock)));
    bus.emit("selection:changed");
  }
  function align(kind, to = "auto") {
    const sel = doc().selected().filter((o) => !o.locked);
    if (!sel.length) return;
    let ref;
    if (to === "page" || (to === "auto" && sel.length === 1)) {
      const panel = sel.length === 1 && sel[0].clip ? doc().obj(sel[0].clip) : null;
      const s = doc().size;
      ref = panel && to === "auto" ? R().aabb(panel) : { x: 0, y: 0, w: s.w, h: s.h };
    } else ref = E().unionBox(sel);
    doc().edit("Align", () => {
      for (const o of sel) {
        const b = R().aabb(o);
        let dx = 0, dy = 0;
        if (kind === "left") dx = ref.x - b.x;
        if (kind === "centerX") dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
        if (kind === "right") dx = ref.x + ref.w - (b.x + b.w);
        if (kind === "top") dy = ref.y - b.y;
        if (kind === "centerY") dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
        if (kind === "bottom") dy = ref.y + ref.h - (b.y + b.h);
        o.x += dx; o.y += dy;
      }
    });
  }
  function distribute(axis) {
    const sel = doc().selected().filter((o) => !o.locked);
    if (sel.length < 3) { CBS.ui.toast("Select three or more items to distribute them."); return; }
    const boxes = sel.map((o) => ({ o, b: R().aabb(o) })).sort((a, b) => (axis === "h" ? a.b.x - b.b.x : a.b.y - b.b.y));
    const first = boxes[0].b, last = boxes[boxes.length - 1].b;
    const total = boxes.reduce((s, x) => s + (axis === "h" ? x.b.w : x.b.h), 0);
    const span = axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
    const gap = (span - total) / (boxes.length - 1);
    doc().edit("Distribute", () => {
      let pos = axis === "h" ? first.x : first.y;
      for (const { o, b } of boxes) {
        if (axis === "h") { o.x += pos - b.x; pos += b.w + gap; } else { o.y += pos - b.y; pos += b.h + gap; }
      }
    });
  }
  function moveToLayer(layerId) {
    const sel = doc().selected();
    const target = doc().layer(layerId);
    if (!target || !sel.length) return;
    if (target.type === "drawing") { CBS.ui.toast("Drawing layers hold pixels only. Pick another layer."); return; }
    doc().edit("Move to layer", () => {
      doc().removeObjects(sel.map((o) => o.id));
      sel.forEach((o) => target.objects.push(o));
    });
    doc().select(sel.map((o) => o.id));
  }

  /* ---------- object helpers ---------- */
  function editPoints(o) {
    if (!o) return;
    if (o.kind === "panel" && o.shape !== "poly") {
      doc().edit("Edit panel corners", () => { o.shape = "poly"; o.pts = [[0, 0], [1, 0], [1, 1], [0, 1]]; });
      CBS.ui.toast("Drag the yellow corners to reshape the panel. Press Esc or double-click empty space when done.");
    }
    E().editPoints = { id: o.id };
    bus.emit("selection:changed");
  }
  function toggleCrop(on) {
    const o = doc().selected()[0];
    if (!o || o.kind !== "image") return;
    E().cropMode = on == null ? !E().cropMode : on;
    if (E().cropMode) CBS.ui.toast("Crop mode: drag the orange handles to trim the picture. Press Esc when done.");
    E().requestOverlay();
    bus.emit("props:refresh");
  }
  bus.on("selection:changed", () => {
    const sel = doc().selected();
    if (E() && E().cropMode && !(sel.length === 1 && sel[0].kind === "image")) E().cropMode = false;
    if (E() && E().editPoints && !(sel.length === 1 && sel[0].id === E().editPoints.id)) E().editPoints = null;
  });
  function fitImageToPanel(img, panel, mode = "cover") {
    panel = panel || (img.clip && doc().obj(img.clip));
    if (!panel) return;
    const b = R().aabb(panel);
    const a = CBS.assets.find(img.assetId);
    const c = img.crop || { l: 0, t: 0, r: 0, b: 0 };
    const iw = (a ? a.w : img.w) * (1 - c.l - c.r), ih = (a ? a.h : img.h) * (1 - c.t - c.b);
    const k = mode === "cover" ? Math.max(b.w / iw, b.h / ih) : Math.min(b.w / iw, b.h / ih);
    doc().edit("Fit to panel", () => {
      img.w = iw * k; img.h = ih * k; img.rot = 0;
      img.x = b.x + b.w / 2 - img.w / 2; img.y = b.y + b.h / 2 - img.h / 2;
      img.clip = panel.id;
    });
  }
  function resetImageSize(img) {
    const a = CBS.assets.find(img.assetId);
    if (!a) return;
    const c = img.crop || { l: 0, t: 0, r: 0, b: 0 };
    const ar = (a.w * (1 - c.l - c.r)) / (a.h * (1 - c.t - c.b));
    doc().edit("Reset proportions", () => { const cx = img.x + img.w / 2; img.w = img.h * ar; img.x = cx - img.w / 2; });
  }
  function splitPanel(panel, dir) {
    const b = R().aabb(panel);
    const c = R().center(panel);
    const a = dir === "h" ? { x: b.x - 10, y: c.y } : { x: c.x, y: b.y - 10 };
    const z = dir === "h" ? { x: b.x + b.w + 10, y: c.y } : { x: c.x, y: b.y + b.h + 10 };
    const res = CBS.layouts.slicePanel(panel, { x: a.x - (z.x - a.x) * 50, y: a.y - (z.y - a.y) * 50 }, { x: z.x + (z.x - a.x) * 50, y: z.y + (z.y - a.y) * 50 }, doc().project.settings.gutter || 14);
    if (!res) { CBS.ui.toast("This panel is too small to split."); return; }
    doc().edit("Split panel", () => {
      const layer = doc().layerOf(panel.id);
      res.forEach((p) => { p.radius = panel.radius; });
      layer.objects.splice(layer.objects.indexOf(panel), 1, res[0], res[1]);
      for (const { obj } of doc().allObjects()) if (obj.clip === panel.id) obj.clip = res[0].id;
    });
    doc().select(res.map((p) => p.id));
  }
  function panelToRect(panel) {
    const b = R().aabb(panel);
    doc().edit("Make rectangle", () => { panel.shape = "rect"; panel.pts = null; panel.rot = 0; Object.assign(panel, { x: b.x, y: b.y, w: b.w, h: b.h }); });
    E().editPoints = null;
  }

  /* ---------- pages ---------- */
  function newPageFor(project, templateId) {
    const page = CBS.createPage();
    if (templateId && templateId !== "none") {
      const panels = CBS.layouts.buildPanels(templateId, project);
      page.layers.find((l) => l.type === "panel").objects.push(...panels);
    }
    return page;
  }
  function addPage(templateId, index) {
    const p = doc().project;
    const tpl = templateId || CBS.prefs.get("defaultTemplate", "six");
    const page = newPageFor(p, tpl);
    const at = index != null ? index : doc().pageIndex + 1;
    doc().edit("Add page", () => p.pages.splice(at, 0, page), "doc");
    doc().setPage(page.id);
    bus.emit("pages:changed");
    return page;
  }
  function clonePage(src) {
    const page = deepClone(src);
    page.id = uid("pg");
    page.isCover = false;
    const idMap = {};
    for (const l of page.layers) {
      l.id = uid("ly");
      if (l.rasterId) { const nid = uid("rs"); CBS.raster.clone(l.rasterId, nid); l.rasterId = nid; }
      for (const o of l.objects) { idMap[o.id] = uid("ob"); o.id = idMap[o.id]; }
    }
    for (const l of page.layers) for (const o of l.objects) if (o.clip) o.clip = idMap[o.clip] || null;
    if (page.groups) {
      const gm = {};
      const ng = {};
      for (const [k, v] of Object.entries(page.groups)) { gm[k] = uid("gr"); ng[gm[k]] = v; }
      page.groups = ng;
      for (const l of page.layers) if (l.group) l.group = gm[l.group] || null;
    }
    return page;
  }
  function duplicatePage(id = doc().pageId) {
    const p = doc().project;
    const i = p.pages.findIndex((pg) => pg.id === id);
    if (i < 0) return;
    const page = clonePage(p.pages[i]);
    if (p.pages[i].name) page.name = p.pages[i].name + " copy";
    doc().edit("Duplicate page", () => p.pages.splice(i + 1, 0, page), "doc");
    doc().setPage(page.id);
    bus.emit("pages:changed");
  }
  async function deletePage(id = doc().pageId) {
    const p = doc().project;
    if (p.pages.length <= 1) { CBS.ui.toast("A comic needs at least one page."); return; }
    const i = p.pages.findIndex((pg) => pg.id === id);
    if (i < 0) return;
    const pg = p.pages[i];
    const hasContent = pg.layers.some((l) => l.objects.length || (l.rasterId && !CBS.raster.isBlank(l.rasterId)));
    if (hasContent && CBS.prefs.get("confirmDelete", true) && !(await CBS.ui.confirm(`Delete ${pg.isCover ? "the cover" : "page " + CBS.pages.label(pg)}? You can undo this.`, { ok: "Delete page", danger: true }))) return;
    doc().edit("Delete page", () => p.pages.splice(i, 1), "doc");
    doc().gotoIndex(Math.min(i, p.pages.length - 1));
    bus.emit("pages:changed");
  }
  function movePage(from, to) {
    const p = doc().project;
    if (from === to || from < 0 || to < 0 || from >= p.pages.length || to >= p.pages.length) return;
    doc().edit("Reorder pages", () => { const [pg] = p.pages.splice(from, 1); p.pages.splice(to, 0, pg); }, "doc");
    bus.emit("pages:changed");
  }

  /* ---------- layers ---------- */
  function addLayer(type = "drawing") {
    const page = doc().page;
    const layer = CBS.createLayer(type);
    const n = page.layers.filter((l) => l.type === type).length;
    if (n) layer.name += " " + (n + 1);
    doc().edit("Add layer", () => doc().insertLayer(layer, page, doc().activeLayer));
    doc().setActiveLayer(layer.id);
    bus.emit("layers:changed");
  }
  function duplicateLayer(id) {
    const page = doc().page;
    const l = doc().layer(id);
    if (!l) return;
    const c = deepClone(l);
    c.id = uid("ly");
    c.name = l.name + " copy";
    const idMap = {};
    c.objects.forEach((o) => { idMap[o.id] = uid("ob"); o.id = idMap[o.id]; });
    c.objects.forEach((o) => { if (o.clip && idMap[o.clip]) o.clip = idMap[o.clip]; });
    if (l.rasterId) { c.rasterId = uid("rs"); CBS.raster.clone(l.rasterId, c.rasterId); }
    doc().edit("Duplicate layer", () => page.layers.splice(page.layers.indexOf(l) + 1, 0, c));
    doc().setActiveLayer(c.id);
    bus.emit("layers:changed");
  }
  async function deleteLayer(id) {
    const page = doc().page;
    const l = doc().layer(id);
    if (!l) return;
    if (page.layers.length <= 1) { CBS.ui.toast("A page needs at least one layer."); return; }
    const hasContent = l.objects.length || (l.rasterId && !CBS.raster.isBlank(l.rasterId));
    if (hasContent && CBS.prefs.get("confirmDelete", true) && !(await CBS.ui.confirm(`Delete the layer “${l.name}” and everything on it? You can undo this.`, { ok: "Delete layer", danger: true }))) return;
    doc().edit("Delete layer", () => {
      const ids = l.objects.map((o) => o.id);
      page.layers.splice(page.layers.indexOf(l), 1);
      for (const ly of page.layers) for (const o of ly.objects) if (o.clip && ids.includes(o.clip)) o.clip = null;
      doc().selection = doc().selection.filter((x) => !ids.includes(x));
    });
    bus.emit("layers:changed");
    bus.emit("selection:changed");
  }
  function moveLayer(id, dir) {
    const page = doc().page;
    const i = page.layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= page.layers.length) return;
    doc().edit("Reorder layers", () => { [page.layers[i], page.layers[j]] = [page.layers[j], page.layers[i]]; });
    bus.emit("layers:changed");
  }
  function moveLayerTo(id, toIndex) {
    const page = doc().page;
    const i = page.layers.findIndex((l) => l.id === id);
    if (i < 0 || toIndex === i) return;
    doc().edit("Reorder layers", () => { const [l] = page.layers.splice(i, 1); page.layers.splice(Math.min(toIndex, page.layers.length), 0, l); });
    bus.emit("layers:changed");
  }
  function mergeDown(id) {
    const page = doc().page;
    const i = page.layers.findIndex((l) => l.id === id);
    const upper = page.layers[i], lower = page.layers[i - 1];
    if (!upper || !lower) return;
    if (upper.type === "drawing" && lower.type === "drawing") {
      const src = CBS.raster.get(upper.rasterId).canvas;
      const tmp = CBS.makeCanvas(src.width, src.height);
      const x = tmp.getContext("2d");
      const lr = CBS.raster.get(lower.rasterId).canvas;
      x.drawImage(lr, 0, 0);
      x.globalAlpha = upper.opacity;
      x.drawImage(src, 0, 0);
      CBS.raster.drawInto(lower, tmp, "Merge layers", true);
    } else if (upper.type !== "drawing" && lower.type !== "drawing") {
      doc().edit("Merge layers", () => { lower.objects.push(...upper.objects); });
    } else {
      CBS.ui.toast("Merge works between two drawing layers or two object layers.");
      return;
    }
    doc().edit("Merge layers", () => page.layers.splice(page.layers.indexOf(upper), 1));
    doc().setActiveLayer(lower.id);
    bus.emit("layers:changed");
  }
  function setLayerProp(id, key, value, label) {
    const l = doc().layer(id);
    if (!l) return;
    doc().edit(label || "Layer change", () => { l[key] = value; });
    bus.emit("layers:changed");
  }
  async function groupLayer(id) {
    const page = doc().page;
    const l = doc().layer(id);
    if (!l) return;
    const name = await CBS.ui.prompt("Name for the new layer group:", "Group", { title: "New layer group", ok: "Create group" });
    if (!name) return;
    doc().edit("Group layer", () => {
      page.groups = page.groups || {};
      const gid = uid("gr");
      page.groups[gid] = { name, visible: true, opacity: 1, collapsed: false };
      l.group = gid;
    });
    bus.emit("layers:changed");
  }
  function setLayerGroup(id, gid) {
    const page = doc().page;
    const l = doc().layer(id);
    if (!l) return;
    doc().edit("Change layer group", () => {
      l.group = gid || null;
      // keep group members next to each other
      if (gid) {
        const members = page.layers.filter((x) => x.group === gid && x !== l);
        if (members.length) {
          page.layers.splice(page.layers.indexOf(l), 1);
          const top = page.layers.indexOf(members[members.length - 1]);
          page.layers.splice(top + 1, 0, l);
        }
      }
      // forget empty groups
      for (const g of Object.keys(page.groups || {})) if (!page.layers.some((x) => x.group === g)) delete page.groups[g];
    });
    bus.emit("layers:changed");
  }
  function setGroupProp(gid, key, value) {
    const page = doc().page;
    if (!page.groups || !page.groups[gid]) return;
    doc().edit("Layer group", () => { page.groups[gid][key] = value; });
    bus.emit("layers:changed");
  }
  function ungroup(gid) {
    const page = doc().page;
    doc().edit("Ungroup layers", () => { for (const l of page.layers) if (l.group === gid) l.group = null; delete page.groups[gid]; });
    bus.emit("layers:changed");
  }

  /* ---------- context menu ---------- */
  function contextMenu(at) {
    const sel = doc().selected();
    const one = sel.length === 1 ? sel[0] : null;
    const k = CBS.modKey;
    const items = [];
    if (sel.length) {
      if (one && ["bubble", "text", "sfx"].includes(one.kind)) items.push({ label: "Edit text", icon: "✏️", action: () => E().editText(one) });
      if (one && one.kind === "panel") {
        items.push({ label: "Add a picture to this panel…", icon: "🖼️", action: () => importIntoPanel(one) });
        items.push({ label: "Split side by side", icon: "◫", action: () => splitPanel(one, "v") });
        items.push({ label: "Split top and bottom", icon: "⊟", action: () => splitPanel(one, "h") });
        items.push({ label: "Edit corners", icon: "⬠", action: () => editPoints(one) });
      }
      if (one && one.kind === "image") {
        items.push({ label: E().cropMode ? "Finish cropping" : "Crop", icon: "✂️", action: () => toggleCrop() });
        if (one.clip) items.push({ label: "Fill the panel", icon: "⤢", action: () => fitImageToPanel(one) });
      }
      if (items.length) items.push({ sep: true });
      items.push(
        { label: "Cut", icon: "✂", shortcut: k + "+X", action: cut },
        { label: "Copy", icon: "⧉", shortcut: k + "+C", action: copy },
        { label: "Paste", icon: "📋", shortcut: k + "+V", action: paste, disabled: !clipboard },
        { label: "Duplicate", icon: "⧉", shortcut: k + "+D", action: duplicate },
        { sep: true },
        { label: "Bring to front", shortcut: "Shift+]", action: () => arrange("front") },
        { label: "Bring forward", shortcut: "]", action: () => arrange("forward") },
        { label: "Send backward", shortcut: "[", action: () => arrange("backward") },
        { label: "Send to back", shortcut: "Shift+[", action: () => arrange("back") },
        { sep: true },
        { label: "Flip horizontally", icon: "⇋", action: () => flip("x"), disabled: !sel.some((o) => ["image", "shape", "panel"].includes(o.kind)) },
        { label: "Flip vertically", icon: "⇵", action: () => flip("y"), disabled: !sel.some((o) => ["image", "shape", "panel"].includes(o.kind)) },
        { label: sel.every((o) => o.locked) ? "Unlock" : "Lock", icon: "🔒", action: toggleLock },
        { sep: true },
        { label: "Delete", icon: "🗑", shortcut: "Del", action: () => del(), danger: true });
    } else {
      items.push(
        { label: "Paste", icon: "📋", shortcut: k + "+V", action: paste, disabled: !clipboard },
        { label: "Select all", shortcut: k + "+A", action: selectAll },
        { sep: true },
        { label: "Page layout…", icon: "▦", action: () => CBS.pagesPanel.layoutPicker() },
        { label: "Page color…", icon: "🎨", action: () => CBS.props.pageColorPicker(at) },
        { label: "Add page after this one", icon: "➕", action: () => addPage() });
    }
    CBS.ui.menu(items, at);
  }
  async function importIntoPanel(panel) {
    const files = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg", true);
    if (!files || !files.length) return;
    const assets = await CBS.assets.importFiles(files, "misc");
    assets.forEach((a) => CBS.assets.placeAsset(a, { panel, cover: true }));
  }

  CBS.actions = {
    copy, cut, paste, duplicate, del, selectAll, nudge, arrange, flip, toggleLock, align, distribute, moveToLayer,
    editPoints, toggleCrop, fitImageToPanel, resetImageSize, splitPanel, panelToRect, importIntoPanel,
    addPage, duplicatePage, deletePage, movePage, clonePage, newPageFor,
    addLayer, duplicateLayer, deleteLayer, moveLayer, moveLayerTo, mergeDown, setLayerProp, groupLayer, setLayerGroup, setGroupProp, ungroup,
    contextMenu, get hasClipboard() { return !!clipboard; },
  };
})();
