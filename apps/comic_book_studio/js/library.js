/* Asset library drawer: sample art, the personal library and this comic's images.
 * Click an item to place it (inside the selected panel, if any) or drag it onto the page. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clear } = CBS;
  const doc = () => CBS.doc;

  let drawer = null, grid, tabsEl, catsEl, search;
  let tab = "samples", cat = "all", target = null;

  function close() { if (drawer) { drawer.classList.remove("open"); setTimeout(() => { if (drawer && !drawer.classList.contains("open")) drawer.hidden = true; }, 200); } target = null; bus.emit("drawer:changed"); }
  const isOpen = () => drawer && !drawer.hidden && drawer.classList.contains("open");

  function open(opts = {}) {
    target = opts.panel || opts.coverArt ? opts : null;
    if (!drawer) build();
    CBS.ai && CBS.ai.close && CBS.ai.close();
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add("open"));
    if (opts.tab) tab = opts.tab;
    renderTabs();
    render();
    bus.emit("drawer:changed");
  }
  function toggle() { if (isOpen()) close(); else open(); }

  function build() {
    search = h("input", { class: "input", type: "search", placeholder: "Search art…", "aria-label": "Search assets" });
    search.addEventListener("input", CBS.debounce(render, 150));
    tabsEl = h("div", { class: "seg sm drawer-tabs" });
    catsEl = h("div", { class: "chip-row cats" });
    grid = h("div", { class: "asset-grid" });
    const upload = h("button", { class: "btn primary sm", onclick: uploadFlow }, "📁 Import art");
    drawer = h("aside", { class: "drawer library-drawer", hidden: true, "aria-label": "Asset library" },
      h("div", { class: "drawer-head" }, h("h3", null, "🗂️ Asset Library"), h("div", { class: "spacer" }), upload, h("button", { class: "icon-btn", "aria-label": "Close library", onclick: close }, "✕")),
      tabsEl, search, catsEl,
      h("p", { class: "hint drawer-hint" }, "Click to add to the page (or into the selected panel). Drag onto any panel to drop it there."),
      grid);
    document.getElementById("workspace").append(drawer);
    bus.on("library:changed", () => { if (isOpen()) render(); });
    bus.on("assets:changed", () => { if (isOpen() && tab === "project") render(); });
  }

  function renderTabs() {
    clear(tabsEl);
    for (const [k, label] of [["samples", "✨ Sample art"], ["library", "⭐ My library"], ["project", "📖 This comic"]]) {
      tabsEl.append(h("button", { class: "seg-btn" + (tab === k ? " on" : ""), onclick: () => { tab = k; renderTabs(); render(); } }, label));
    }
    clear(catsEl);
    const cats = [["all", "All"], ...Object.entries(CBS.assets.CATEGORIES)];
    for (const [k, label] of cats) catsEl.append(h("button", { class: "chip" + (cat === k ? " on" : ""), onclick: () => { cat = k; renderTabs(); render(); } }, label));
  }

  async function items() {
    if (tab === "samples") return CBS.assets.samples.map((s) => ({ ...s, source: "sample" }));
    if (tab === "library") return (await CBS.assets.library.list()).map((a) => ({ ...a, source: "library" }));
    return (doc().project ? doc().project.assets : []).map((a) => ({ ...a, source: "project" }));
  }

  let renderToken = 0;
  async function render() {
    if (!grid) return;
    const token = ++renderToken;
    clear(grid);
    const q = (search.value || "").toLowerCase().trim();
    const list = (await items()).filter((it) => (cat === "all" || it.category === cat) && (!q || (it.name || "").toLowerCase().includes(q)));
    if (token !== renderToken) return;
    if (!list.length) {
      grid.append(h("p", { class: "hint pad" }, tab === "library" ? "Your library is empty. Pictures you import are saved here so you can reuse them in any comic." : tab === "project" ? "This comic doesn't use any pictures yet." : "Nothing matches."));
      return;
    }
    for (const it of list) {
      const img = h("img", { alt: it.name, draggable: "false", loading: "lazy" });
      const card = h("div", {
        class: "asset-card", draggable: "true", tabindex: "0", role: "button", "aria-label": "Add " + it.name, tip: it.name,
        onclick: () => use(it),
        onkeydown: (e) => { if (e.key === "Enter") use(it); },
        oncontextmenu: (e) => { e.preventDefault(); itemMenu(it, { x: e.clientX, y: e.clientY }); },
      }, h("div", { class: "ac-img" }, img), h("span", { class: "ac-name" }, it.name), it.source !== "sample" ? h("button", { class: "ac-more", "aria-label": "Options", onclick: (e) => { e.stopPropagation(); itemMenu(it, e.currentTarget); } }, "⋯") : null);
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("application/x-cbs-asset", JSON.stringify({ source: it.source, id: it.id }));
        e.dataTransfer.setData("text/plain", it.name);
      });
      grid.append(card);
      if (it.source === "sample") {
        CBS.assets.sampleData(it).then((d) => { img.src = d.src; });
        await CBS.nextFrame();
        if (token !== renderToken) return;
      } else img.src = it.src;
    }
  }

  /* Resolve a library item into a project asset. */
  async function toProjectAsset(it) {
    if (it.source === "sample") return CBS.assets.addSample(it.id);
    if (it.source === "library") return CBS.assets.addToProject({ src: it.src, w: it.w, h: it.h, name: it.name, category: it.category, libId: it.id });
    return CBS.assets.find(it.id);
  }
  async function use(it, at) {
    const asset = await toProjectAsset(it);
    if (!asset) return;
    if (target && target.coverArt) { await CBS.cover.setCoverArt(asset); close(); return; }
    const sel = doc().selected();
    const panel = target && target.panel ? target.panel : sel.length === 1 && sel[0].kind === "panel" ? sel[0] : null;
    CBS.assets.placeAsset(asset, { panel, at });
    if (CBS.tools.current.id !== "select") CBS.tools.set("select");
  }
  async function dropFromData(json, docPt) {
    try {
      const d = JSON.parse(json);
      let it;
      if (d.source === "sample") it = { ...CBS.assets.samples.find((s) => s.id === d.id), source: "sample" };
      else if (d.source === "library") it = { ...(await CBS.storage.get("library", d.id)), source: "library" };
      else it = { ...CBS.assets.find(d.id), source: "project" };
      if (!it || !it.id) return;
      const asset = await toProjectAsset(it);
      if (asset) CBS.assets.placeAsset(asset, { at: docPt });
    } catch (e) { console.warn(e); }
  }

  function categoryMenu(current, onPick) {
    return Object.entries(CBS.assets.CATEGORIES).map(([k, l]) => ({ label: l, checked: k === current, action: () => onPick(k) }));
  }
  function itemMenu(it, at) {
    const lib = CBS.assets.library;
    if (it.source === "library") {
      CBS.ui.menu([
        { label: "Rename…", icon: "✏️", action: async () => { const n = await CBS.ui.prompt("Name:", it.name, { title: "Rename art" }); if (n) lib.update(it.id, { name: n.trim() }); } },
        { label: "Category", icon: "🏷️", submenu: categoryMenu(it.category, (k) => lib.update(it.id, { category: k })) },
        { sep: true },
        { label: "Remove from library", icon: "🗑", danger: true, action: async () => { if (await CBS.ui.confirm(`Remove “${it.name}” from your library? Comics that already use it keep their copy.`, { ok: "Remove", danger: true })) lib.remove(it.id); } },
      ], at);
    } else if (it.source === "project") {
      const users = [];
      for (const pg of doc().project.pages) for (const l of pg.layers) for (const o of l.objects) if (o.assetId === it.id) users.push(o);
      CBS.ui.menu([
        { label: "Rename…", icon: "✏️", action: async () => { const n = await CBS.ui.prompt("Name:", it.name, { title: "Rename art" }); if (n) { doc().edit("Rename art", () => (CBS.assets.find(it.id).name = n.trim()), "doc"); render(); } } },
        { label: "Category", icon: "🏷️", submenu: categoryMenu(it.category, (k) => { doc().edit("Art category", () => (CBS.assets.find(it.id).category = k), "doc"); render(); }) },
        { label: "Save to my library", icon: "⭐", action: async () => { await lib.add(it); CBS.ui.toast("Added to your library", { kind: "ok" }); } },
        { sep: true },
        {
          label: users.length ? `Delete (used ${users.length}×)` : "Delete from this comic", icon: "🗑", danger: true,
          action: async () => {
            if (users.length && !(await CBS.ui.confirm(`“${it.name}” is used ${users.length} time(s) in this comic. Delete it and remove those pictures? You can undo this.`, { ok: "Delete", danger: true }))) return;
            doc().edit("Delete art", () => {
              const p = doc().project;
              p.assets = p.assets.filter((a) => a.id !== it.id);
              for (const pg of p.pages) for (const l of pg.layers) l.objects = l.objects.filter((o) => o.assetId !== it.id);
            }, "doc");
            doc().selection = [];
            bus.emit("selection:changed");
            render();
          },
        },
      ], at);
    }
  }

  async function uploadFlow() {
    let category = cat !== "all" ? cat : "characters";
    const sel = CBS.ui.select(CBS.assets.CATEGORIES, category, (v) => (category = v), { label: "Category" });
    const v = await CBS.ui.dialog({
      title: "Import your art",
      body: h("div", null, h("p", { class: "dlg-msg" }, "Pick PNG, JPG, WEBP or SVG pictures. They're added to this comic and saved in your library for future comics."), CBS.ui.field("Category", sel)),
      buttons: [{ label: "Cancel", value: null }, { label: "Choose files…", kind: "primary", value: "ok" }],
    }).promise;
    if (v !== "ok") return;
    const files = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg", true);
    if (!files || !files.length) return;
    const added = await CBS.assets.importFiles(files, category);
    if (added.length) { CBS.ui.toast(`Imported ${added.length} picture${added.length > 1 ? "s" : ""}`, { kind: "ok" }); tab = "project"; renderTabs(); render(); }
  }

  CBS.library = { open, close, toggle, isOpen, dropFromData, use };
})();
