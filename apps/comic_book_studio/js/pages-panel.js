/* Bottom panel: page thumbnails, navigation, add/duplicate/delete/reorder pages, layout picker. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clear } = CBS;
  const doc = () => CBS.doc;
  const A = () => CBS.actions;

  let strip, countEl, root;
  const thumbs = new Map(); // pageId -> { canvas, stale }

  function label(pg) {
    const p = doc().project;
    if (pg.isCover) return "Cover";
    const pages = p.pages.filter((x) => !x.isCover);
    return String(pages.indexOf(pg) + 1);
  }

  function renderThumb(pg) {
    const s = doc().size;
    const H = 116;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = (H / s.h) * dpr;
    const c = CBS.render.pageCanvas(pg, scale);
    c.style.width = (s.w / s.h) * H + "px";
    c.style.height = H + "px";
    thumbs.set(pg.id, { canvas: c, stale: false });
    return c;
  }

  let dragFrom = -1;
  function render() {
    if (!strip) return;
    clear(strip);
    const p = doc().project;
    if (!p) return;
    const s = doc().size;
    p.pages.forEach((pg, i) => {
      const t = thumbs.get(pg.id);
      const canvas = t && !t.stale ? t.canvas : renderThumb(pg);
      const active = pg.id === doc().pageId;
      const item = h("div", {
        class: "thumb" + (active ? " active" : "") + (pg.isCover ? " cover" : ""), draggable: "true", tabindex: "0", role: "option", "aria-selected": String(active),
        "aria-label": pg.isCover ? "Cover" : "Page " + label(pg),
        style: { "--ar": String(s.w / s.h) },
        onclick: () => doc().setPage(pg.id),
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doc().setPage(pg.id); } },
        oncontextmenu: (e) => { e.preventDefault(); doc().setPage(pg.id); pageMenu(pg, { x: e.clientX, y: e.clientY }); },
      },
      h("div", { class: "thumb-img" }, canvas),
      h("div", { class: "thumb-label" }, pg.isCover ? "Cover" : (pg.name ? `${label(pg)} · ${pg.name}` : "Page " + label(pg))));
      item.addEventListener("dragstart", (e) => { dragFrom = i; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "page"); } catch (err) { /* ignore */ } item.classList.add("dragging"); });
      item.addEventListener("dragend", () => { dragFrom = -1; item.classList.remove("dragging"); strip.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after")); });
      item.addEventListener("dragover", (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        const r = item.getBoundingClientRect();
        const before = e.clientX < r.left + r.width / 2;
        item.classList.toggle("drop-before", before);
        item.classList.toggle("drop-after", !before);
      });
      item.addEventListener("dragleave", () => item.classList.remove("drop-before", "drop-after"));
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        const before = item.classList.contains("drop-before");
        item.classList.remove("drop-before", "drop-after");
        if (dragFrom < 0) return;
        let to = i + (before ? 0 : 1);
        if (dragFrom < to) to--;
        A().movePage(dragFrom, to);
      });
      strip.append(item);
    });
    strip.append(h("button", { class: "thumb add-thumb", style: { "--ar": String(s.w / s.h) }, tip: "Add a new page", onclick: () => addPageDialog() }, h("span", null, "＋"), h("small", null, "Add page")));
    updateCount();
    const act = strip.querySelector(".thumb.active");
    if (act) act.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function updateCount() {
    const p = doc().project;
    if (!p || !countEl) return;
    const i = doc().pageIndex;
    const pg = doc().page;
    const n = p.pages.filter((x) => !x.isCover).length;
    countEl.textContent = pg && pg.isCover ? `Cover · ${n} page${n === 1 ? "" : "s"}` : `Page ${label(pg)} of ${n}`;
    bus.emit("pagecount", i, p.pages.length);
  }

  function pageMenu(pg, at) {
    const p = doc().project;
    const i = p.pages.indexOf(pg);
    CBS.ui.menu([
      { label: "Add page after", icon: "➕", action: () => addPageDialog(i + 1) },
      { label: "Duplicate page", icon: "⧉", action: () => A().duplicatePage(pg.id) },
      { label: "Rename page…", icon: "✏️", action: async () => { const n = await CBS.ui.prompt("Page name (optional):", pg.name || "", { title: "Rename page" }); if (n != null) { doc().edit("Rename page", () => (pg.name = n.trim()), "doc"); render(); } } },
      { label: "Change layout…", icon: "▦", action: () => layoutPicker() },
      { sep: true },
      { label: "Move left", icon: "←", disabled: i === 0, action: () => A().movePage(i, i - 1) },
      { label: "Move right", icon: "→", disabled: i === p.pages.length - 1, action: () => A().movePage(i, i + 1) },
      { sep: true },
      { label: "Delete page", icon: "🗑", danger: true, disabled: p.pages.length <= 1, action: () => A().deletePage(pg.id) },
    ], at);
  }

  /* ---------- layout picker ---------- */
  function templateGrid(selected, onPick, o = {}) {
    const wrap = h("div", { class: "layout-picker" });
    const s = doc().project ? doc().size : { w: 663, h: 1025 };
    const pw = 54, ph = Math.round((54 * s.h) / s.w);
    const cats = {};
    if (o.allowBlank) cats.Basic = [{ id: "none", name: "Blank page (no panels)", cat: "Basic", fn: () => [] }];
    for (const t of CBS.layouts.allTemplates()) (cats[t.cat] = cats[t.cat] || []).push(t);
    for (const [cat, list] of Object.entries(cats)) {
      wrap.append(h("div", { class: "lp-cat" }, cat));
      const grid = h("div", { class: "lp-grid" });
      for (const t of list) {
        const b = h("button", { class: "lp-item" + (t.id === selected ? " on" : ""), tip: t.name, "aria-label": t.name, onclick: () => { wrap.querySelectorAll(".lp-item").forEach((x) => x.classList.remove("on")); b.classList.add("on"); onPick(t.id); } },
          CBS.layouts.previewSVG(t, pw, ph), h("span", null, t.name));
        if (t.custom) b.append(h("span", { class: "lp-del", tip: "Delete this custom layout", onclick: async (e) => { e.stopPropagation(); if (await CBS.ui.confirm(`Delete the custom layout “${t.name}”?`, { ok: "Delete", danger: true })) { CBS.layouts.deleteCustom(t.id); b.remove(); } } }, "✕"));
        grid.append(b);
      }
      wrap.append(grid);
    }
    return wrap;
  }

  function layoutPicker() {
    let pick = null;
    const page = doc().page;
    const hasPanels = doc().panels(page).length > 0;
    const d = CBS.ui.dialog({
      title: "Choose a panel layout", wide: true,
      body: h("div", null,
        h("p", { class: "hint" }, hasPanels ? "Applying a layout replaces this page's panels. Artwork inside them moves into the matching new panel. Bubbles, text and drawings stay put." : "Pick a layout. You can resize, slice and restyle every panel afterwards."),
        templateGrid(null, (id) => { pick = id; }),
      ),
      buttons: [
        { label: "Cancel", value: null },
        { label: "Apply layout", kind: "primary", onClick: () => { if (!pick) { CBS.ui.toast("Pick a layout first."); return false; } } , value: "ok" },
      ],
    });
    d.promise.then((v) => {
      if (v !== "ok" || !pick) return;
      doc().edit("Apply layout", () => CBS.layouts.applyTemplate(page, pick, doc().project));
      doc().select([]);
      bus.emit("layers:changed");
    });
  }

  function addPageDialog(index) {
    let pick = CBS.prefs.get("defaultTemplate", "six");
    const d = CBS.ui.dialog({
      title: "Add a page", wide: true,
      body: templateGrid(pick, (id) => { pick = id; }, { allowBlank: true }),
      buttons: [{ label: "Cancel", value: null }, { label: "Add page", kind: "primary", value: "ok" }],
    });
    d.promise.then((v) => { if (v === "ok") A().addPage(pick, index); });
  }

  function markStale(id) { const t = thumbs.get(id); if (t) t.stale = true; }
  const refreshCurrent = CBS.debounce(() => {
    const pg = doc().page;
    if (!pg || !strip) return;
    const t = thumbs.get(pg.id);
    if (t && !t.stale) return;
    const old = strip.querySelector(`.thumb.active .thumb-img`);
    if (!old) { render(); return; }
    clear(old).append(renderThumb(pg));
  }, 450);

  function init() {
    root = document.getElementById("pages");
    countEl = h("span", { class: "page-count" });
    strip = h("div", { class: "thumb-strip", role: "listbox", "aria-label": "Pages" });
    const tb = (icon, tip, fn) => h("button", { class: "icon-btn", tip, "aria-label": tip, onclick: fn }, icon);
    root.append(
      h("div", { class: "pages-bar" },
        h("h3", null, "Pages"),
        countEl,
        h("div", { class: "spacer" }),
        tb("➕", "Add page", () => addPageDialog()),
        tb("⧉", "Duplicate page", () => A().duplicatePage()),
        tb("◀", "Move page left", () => { const i = doc().pageIndex; A().movePage(i, i - 1); }),
        tb("▶", "Move page right", () => { const i = doc().pageIndex; A().movePage(i, i + 1); }),
        tb("🗑", "Delete page", () => A().deletePage()),
        tb("▾", "Hide or show the page thumbnails", () => CBS.app.togglePanel("bottom"))),
      strip);
    bus.on("doc:loaded", () => { thumbs.clear(); render(); });
    bus.on("pages:changed", () => { render(); });
    bus.on("page:changed", () => { render(); });
    bus.on("doc:changed", (what) => {
      if (what === "doc") { thumbs.clear(); render(); return; }
      if (what === "assets") return;
      if (doc().page) markStale(doc().page.id);
      refreshCurrent();
    });
    bus.on("assets:loaded", CBS.debounce(() => { thumbs.forEach((t) => (t.stale = true)); render(); }, 300));
    bus.on("fonts:loaded", () => { thumbs.forEach((t) => (t.stale = true)); render(); });
  }

  CBS.pagesPanel = { init, render, layoutPicker, templateGrid, addPageDialog, label };
  CBS.pages = CBS.pagesPanel;
})();
