/* Layers panel: show/hide, lock, rename, reorder (drag & drop), opacity, groups (folders), merge, clear. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clear } = CBS;
  const doc = () => CBS.doc;
  const A = () => CBS.actions;

  let root, list, footer;

  function iconBtn(icon, tip, fn, cls = "") {
    return h("button", { class: "icon-btn sm " + cls, tip, "aria-label": tip, onclick: (e) => { e.stopPropagation(); fn(e); } }, icon);
  }

  function addMenu(anchor) {
    CBS.ui.menu(Object.entries(CBS.LAYER_TYPES).map(([type, t]) => ({ label: t.label + " layer", icon: t.icon, action: () => A().addLayer(type) })), anchor);
  }

  function layerMenu(layer, at) {
    const page = doc().page;
    const i = page.layers.indexOf(layer);
    const groups = Object.entries(page.groups || {});
    const items = [
      { label: "Rename…", icon: "✏️", action: () => rename(layer) },
      { label: "Duplicate", icon: "⧉", action: () => A().duplicateLayer(layer.id) },
      { label: "Merge down", icon: "⤓", action: () => A().mergeDown(layer.id), disabled: i === 0 },
      { sep: true },
      { label: "Move up", icon: "↑", action: () => A().moveLayer(layer.id, 1), disabled: i === page.layers.length - 1 },
      { label: "Move down", icon: "↓", action: () => A().moveLayer(layer.id, -1), disabled: i === 0 },
      { sep: true },
      { label: "New group from this layer…", icon: "📁", action: () => A().groupLayer(layer.id) },
      groups.length ? { label: "Put in group", icon: "📂", submenu: groups.map(([gid, g]) => ({ label: g.name, checked: layer.group === gid, action: () => A().setLayerGroup(layer.id, gid) })) } : null,
      layer.group ? { label: "Take out of group", icon: "📤", action: () => A().setLayerGroup(layer.id, null) } : null,
    ];
    if (layer.type === "drawing") {
      items.push({ sep: true },
        { label: "Flip drawing horizontally", icon: "⇋", action: () => CBS.raster.flipLayer(layer, true) },
        { label: "Flip drawing vertically", icon: "⇵", action: () => CBS.raster.flipLayer(layer, false) },
        { label: "Clear drawing", icon: "🧽", action: async () => { if (await CBS.ui.confirm(`Erase everything drawn on “${layer.name}”? You can undo this.`, { ok: "Clear", danger: true })) CBS.raster.clearLayer(layer); } });
    } else if (layer.objects.length) {
      items.push({ sep: true }, { label: "Select everything on this layer", icon: "⬚", action: () => doc().select(layer.objects.map((o) => o.id), { keepLayer: true }) });
    }
    items.push({ sep: true }, { label: "Delete layer", icon: "🗑", danger: true, action: () => A().deleteLayer(layer.id) });
    CBS.ui.menu(items, at);
  }

  async function rename(layer) {
    const name = await CBS.ui.prompt("Layer name:", layer.name, { title: "Rename layer", ok: "Rename" });
    if (name && name.trim()) A().setLayerProp(layer.id, "name", name.trim(), "Rename layer");
  }

  let dragId = null;
  function row(layer, page) {
    const active = doc().activeLayer === layer;
    const t = CBS.LAYER_TYPES[layer.type];
    const count = layer.type === "drawing" ? (CBS.raster.isBlank(layer.rasterId) ? "empty" : "drawing") : layer.objects.length ? String(layer.objects.length) : "";
    const el = h("div", {
      class: "layer-row" + (active ? " active" : "") + (layer.visible ? "" : " hidden-layer") + (layer.group ? " in-group" : ""),
      draggable: "true", "data-id": layer.id, role: "option", "aria-selected": String(active), tabindex: "0",
      onclick: () => { doc().setActiveLayer(layer.id); },
      ondblclick: (e) => { if (e.target.closest(".ly-name")) rename(layer); },
      oncontextmenu: (e) => { e.preventDefault(); doc().setActiveLayer(layer.id); layerMenu(layer, { x: e.clientX, y: e.clientY }); },
      onkeydown: (e) => { if (e.key === "Enter") rename(layer); },
    },
    iconBtn(layer.visible ? "👁" : "◌", layer.visible ? "Hide layer" : "Show layer", () => A().setLayerProp(layer.id, "visible", !layer.visible, layer.visible ? "Hide layer" : "Show layer"), "eye"),
    iconBtn(layer.locked ? "🔒" : "🔓", layer.locked ? "Unlock layer" : "Lock layer", () => A().setLayerProp(layer.id, "locked", !layer.locked, layer.locked ? "Unlock layer" : "Lock layer"), "lock" + (layer.locked ? " on" : "")),
    h("span", { class: "ly-type", tip: t.label }, t.icon),
    h("span", { class: "ly-name" }, layer.name),
    layer.opacity < 1 ? h("span", { class: "ly-meta" }, Math.round(layer.opacity * 100) + "%") : null,
    count ? h("span", { class: "ly-count" }, count) : null,
    iconBtn("⋯", "Layer options", (e) => { doc().setActiveLayer(layer.id); layerMenu(layer, e.currentTarget); }, "more"));
    el.addEventListener("dragstart", (e) => { dragId = layer.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", layer.id); } catch (err) { /* ignore */ } el.classList.add("dragging"); });
    el.addEventListener("dragend", () => { dragId = null; el.classList.remove("dragging"); list.querySelectorAll(".drop-above,.drop-below").forEach((x) => x.classList.remove("drop-above", "drop-below")); });
    el.addEventListener("dragover", (e) => {
      if (!dragId || dragId === layer.id) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const above = e.clientY < r.top + r.height / 2;
      el.classList.toggle("drop-above", above);
      el.classList.toggle("drop-below", !above);
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop-above", "drop-below"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const above = el.classList.contains("drop-above");
      el.classList.remove("drop-above", "drop-below");
      if (!dragId || dragId === layer.id) return;
      const from = page.layers.findIndex((l) => l.id === dragId);
      let to = page.layers.indexOf(layer) + (above ? 1 : 0);
      if (from < to) to--;
      A().moveLayerTo(dragId, to);
      const moved = doc().layer(dragId);
      if (moved && moved.group !== layer.group) A().setLayerGroup(moved.id, layer.group);
    });
    return el;
  }

  function groupRow(gid, g) {
    const members = doc().page.layers.filter((l) => l.group === gid);
    const locked = members.length && members.every((l) => l.locked);
    return h("div", { class: "layer-row group-row" + (g.visible === false ? " hidden-layer" : "") },
      iconBtn(g.visible === false ? "◌" : "👁", g.visible === false ? "Show group" : "Hide group", () => A().setGroupProp(gid, "visible", g.visible === false), "eye"),
      iconBtn(locked ? "🔒" : "🔓", locked ? "Unlock group" : "Lock group", () => {
        doc().edit(locked ? "Unlock group" : "Lock group", () => members.forEach((l) => (l.locked = !locked)));
        bus.emit("layers:changed");
      }, "lock" + (locked ? " on" : "")),
      h("button", { class: "icon-btn sm", "aria-label": g.collapsed ? "Expand group" : "Collapse group", onclick: () => A().setGroupProp(gid, "collapsed", !g.collapsed) }, g.collapsed ? "▸" : "▾"),
      h("span", { class: "ly-name" }, "📁 " + g.name),
      iconBtn("⋯", "Group options", (e) => CBS.ui.menu([
        { label: "Rename group…", icon: "✏️", action: async () => { const n = await CBS.ui.prompt("Group name:", g.name, { title: "Rename group" }); if (n) A().setGroupProp(gid, "name", n.trim()); } },
        { label: "Group opacity 100%", action: () => A().setGroupProp(gid, "opacity", 1) },
        { label: "Group opacity 50%", action: () => A().setGroupProp(gid, "opacity", 0.5) },
        { label: "Ungroup", icon: "📤", action: () => A().ungroup(gid) },
      ], e.currentTarget), "more"));
  }

  function render() {
    if (!root) return;
    clear(list);
    clear(footer);
    const page = doc().page;
    if (!page) return;
    const layers = [...page.layers].reverse();
    const shownGroups = new Set();
    for (const l of layers) {
      if (l.group && page.groups && page.groups[l.group]) {
        const g = page.groups[l.group];
        if (!shownGroups.has(l.group)) { shownGroups.add(l.group); list.append(groupRow(l.group, g)); }
        if (g.collapsed) continue;
      }
      list.append(row(l, page));
    }
    const active = doc().activeLayer;
    if (active) {
      let open = false;
      const sl = CBS.ui.slider({
        label: "Opacity", min: 0, max: 100, value: Math.round(active.opacity * 100), unit: "%",
        onStart() { if (!open) { CBS.history.begin("page"); open = true; } },
        onInput(v) { this.onStart(); active.opacity = v / 100; CBS.editor.requestRender(); },
        onCommit() { if (open) { CBS.history.end("Layer opacity"); open = false; } doc().changed(); render(); },
      });
      footer.append(sl);
    }
  }
  const refresh = CBS.debounce(render, 40);

  function init() {
    root = document.getElementById("layers");
    root.append(h("div", { class: "panel-head" },
      h("h3", null, "Layers"),
      h("div", { class: "spacer" }),
      iconBtn("＋", "Add a layer", (e) => addMenu(e.currentTarget)),
      iconBtn("⧉", "Duplicate layer", () => doc().activeLayer && A().duplicateLayer(doc().activeLayer.id)),
      iconBtn("↑", "Move layer up", () => doc().activeLayer && A().moveLayer(doc().activeLayer.id, 1)),
      iconBtn("↓", "Move layer down", () => doc().activeLayer && A().moveLayer(doc().activeLayer.id, -1)),
      iconBtn("🗑", "Delete layer", () => doc().activeLayer && A().deleteLayer(doc().activeLayer.id))));
    list = h("div", { class: "layer-list", role: "listbox", "aria-label": "Layers" });
    footer = h("div", { class: "layer-foot" });
    root.append(list, footer);
    for (const ev of ["layers:changed", "layer:active", "page:changed", "doc:loaded", "history:changed"]) bus.on(ev, refresh);
    bus.on("doc:changed", refresh);
  }

  CBS.layersPanel = { init, refresh };
})();
