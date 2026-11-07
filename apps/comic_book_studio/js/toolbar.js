/* Top toolbar (menus, quick actions, zoom, page navigation, save status) and the left toolbox. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clear, prefs, modKey: K } = CBS;
  const doc = () => CBS.doc;
  const A = () => CBS.actions;
  const P = () => CBS.projects;

  let undoBtn, redoBtn, zoomBtn, pageLabel, titleBtn, statusEl;

  const tb = (id, icon, label, tip, fn, cls = "") =>
    h("button", { id, class: "tb-btn " + cls, tip, "aria-label": tip, onclick: fn }, h("span", { class: "tb-ico" }, icon), label ? h("span", { class: "tb-label" }, label) : null);

  /* ---------- menus ---------- */
  async function fileMenu(anchor) {
    const recent = await P().recentMenuItems();
    CBS.ui.menu([
      { label: "New comic…", icon: "✨", shortcut: "Ctrl+Alt+N", action: () => P().newComicWizard() },
      { label: "My comics…", icon: "📚", shortcut: K + "+O", action: () => P().myComics() },
      { label: "Recent comics", icon: "🕘", submenu: recent },
      { sep: true },
      { label: "Save", icon: "💾", shortcut: K + "+S", action: () => P().save() },
      { label: "Save as…", icon: "📄", shortcut: K + "+Shift+S", action: () => P().saveAs() },
      { label: "Rename comic…", icon: "✏️", action: () => P().rename() },
      { label: "Duplicate comic", icon: "⧉", action: async () => { await P().save({ quiet: true }); await P().duplicate(doc().project.id); } },
      { label: "Delete comic…", icon: "🗑", danger: true, action: () => P().remove(doc().project.id) },
      { sep: true },
      { label: "Import project file…", icon: "📥", action: () => P().importFile() },
      { label: "Export project file", icon: "📤", action: () => P().exportFile() },
      { label: "Export comic…", icon: "⬇️", shortcut: K + "+E", action: () => CBS.exporter.open() },
      { sep: true },
      { label: "Comic details…", icon: "ℹ️", action: comicDetails },
    ], anchor);
  }
  function editMenu(anchor) {
    const sel = doc().selection.length > 0;
    const H = CBS.history;
    CBS.ui.menu([
      { label: "Undo " + (H.undoLabel || ""), icon: "↶", shortcut: K + "+Z", disabled: !H.canUndo, action: () => H.undo() },
      { label: "Redo " + (H.redoLabel || ""), icon: "↷", shortcut: K + "+Shift+Z", disabled: !H.canRedo, action: () => H.redo() },
      { sep: true },
      { label: "Cut", shortcut: K + "+X", disabled: !sel, action: A().cut },
      { label: "Copy", shortcut: K + "+C", disabled: !sel, action: A().copy },
      { label: "Paste", shortcut: K + "+V", disabled: !A().hasClipboard, action: A().paste },
      { label: "Duplicate", shortcut: K + "+D", disabled: !sel, action: A().duplicate },
      { label: "Delete", shortcut: "Del", disabled: !sel, action: () => A().del() },
      { sep: true },
      { label: "Select all", shortcut: K + "+A", action: A().selectAll },
      { label: "Deselect", shortcut: "Esc", disabled: !sel, action: () => doc().select([]) },
      { sep: true },
      { label: "Bring to front", disabled: !sel, action: () => A().arrange("front") },
      { label: "Send to back", disabled: !sel, action: () => A().arrange("back") },
      { label: "Flip horizontally", disabled: !sel, action: () => A().flip("x") },
      { label: "Lock / unlock", disabled: !sel, action: A().toggleLock },
    ], anchor);
  }
  function viewMenu(anchor) {
    const t = (key, def) => prefs.get(key, def);
    const flip = (key, def) => () => { prefs.set(key, !t(key, def)); if (key === "rulers") window.dispatchEvent(new Event("resize")); CBS.editor.requestRender(); };
    CBS.ui.menu([
      { label: "Zoom in", shortcut: K + "+=", action: () => CBS.editor.zoomStep(1) },
      { label: "Zoom out", shortcut: K + "+-", action: () => CBS.editor.zoomStep(-1) },
      { label: "Fit page", shortcut: K + "+0", action: () => CBS.editor.fit() },
      { label: "Fit width", action: () => CBS.editor.fit("width") },
      { label: "Actual size (100%)", shortcut: K + "+1", action: () => CBS.editor.setZoom(1) },
      { sep: true },
      { label: "Rulers", checked: t("rulers", true), action: flip("rulers", true) },
      { label: "Guides", checked: t("showGuides", true), action: flip("showGuides", true) },
      { label: "Margins", checked: t("showMargins", true), action: flip("showMargins", true) },
      { label: "Grid", checked: t("grid", false), shortcut: K + "+'", action: flip("grid", false) },
      { label: "Snap to grid", checked: t("snapGrid", false), action: flip("snapGrid", false) },
      { label: "Snap to guides & objects", checked: t("snap", true), action: flip("snap", true) },
      { label: "Clear guides on this page", action: () => doc().edit("Clear guides", () => (doc().page.guides = { v: [], h: [] })) },
      { sep: true },
      { label: "Toolbox", checked: !document.body.classList.contains("hide-left"), action: () => CBS.app.togglePanel("left") },
      { label: "Properties & layers", checked: !document.body.classList.contains("hide-right"), action: () => CBS.app.togglePanel("right") },
      { label: "Pages strip", checked: !document.body.classList.contains("hide-bottom"), action: () => CBS.app.togglePanel("bottom") },
      { sep: true },
      { label: "Preview comic", icon: "📖", shortcut: K + "+Shift+P", action: () => CBS.reader.open() },
    ], anchor);
  }
  function insertMenu(anchor) {
    const hasCover = !!CBS.cover.coverPage();
    CBS.ui.menu([
      { label: "Page…", icon: "📄", action: () => CBS.pagesPanel.addPageDialog() },
      { label: hasCover ? "Go to the cover" : "Cover page", icon: "📕", action: () => CBS.cover.addCover() },
      { label: "Panel layout…", icon: "▦", action: () => CBS.pagesPanel.layoutPicker() },
      { sep: true },
      { label: "Speech bubble", icon: "💬", action: () => CBS.tools.set("bubble") },
      { label: "Sound effect", icon: "💥", action: () => CBS.tools.set("sfx") },
      { label: "Text", icon: "🔤", action: () => CBS.tools.set("text") },
      { label: "Shape", icon: "⬟", action: () => CBS.tools.set("shape") },
      { label: "Picture from your computer…", icon: "🖼️", action: async () => { const f = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg", true); if (f && f.length) (await CBS.assets.importFiles(f)).forEach((a) => CBS.assets.placeAsset(a, {})); } },
      { label: "Art from the library…", icon: "🗂️", action: () => CBS.library.open() },
      { sep: true },
      { label: "Layer", icon: "🗂", submenu: Object.entries(CBS.LAYER_TYPES).map(([k, v]) => ({ label: v.label, icon: v.icon, action: () => A().addLayer(k) })) },
    ], anchor);
  }
  function helpMenu(anchor) {
    CBS.ui.menu([
      { label: "Take the tour", icon: "🎓", action: () => CBS.tutorial.start() },
      { label: "Keyboard shortcuts", icon: "⌨️", shortcut: "?", action: shortcuts },
      { label: "Open sample comic", icon: "🦸", action: () => CBS.sample.open() },
      { label: "Reset sample comic", icon: "♻️", action: async () => { if (await CBS.ui.confirm("Rebuild the sample comic from scratch? Changes you made to it will be lost.", { ok: "Reset" })) CBS.sample.open({ fresh: true }); } },
      { label: "Start screen", icon: "🏠", action: () => P().welcome({ closable: true }) },
      { sep: true },
      { label: "About Comic Book Studio", icon: "ℹ️", action: about },
    ], anchor);
  }

  function shortcuts() {
    const rows = [
      ["Tools", [["V", "Select"], ["M", "Move layer"], ["H / hold Space", "Pan"], ["B", "Draw"], ["E", "Eraser"], ["U", "Shapes"], ["G", "Fill"], ["I", "Color picker"], ["T", "Text"], ["S", "Speech bubble"], ["X", "Sound effect"], ["P", "Panel"], ["K", "Image"], ["L", "Asset library"], ["A", "Creative assistant"]]],
      ["Editing", [[K + "+Z", "Undo"], [K + "+Shift+Z / " + K + "+Y", "Redo"], [K + "+C / X / V", "Copy / cut / paste"], [K + "+D", "Duplicate"], ["Delete", "Delete"], ["Arrows", "Nudge (Shift = 10×)"], ["[ and ]", "Brush size, or send backward / forward"], ["Shift+[ / ]", "Send to back / bring to front"], ["Enter", "Edit the selected text"], ["Esc", "Deselect / finish"], ["Alt+drag", "Duplicate while dragging"], ["Shift+drag", "Keep proportions / straight lines"], [K + "+drag", "Move without snapping"]]],
      ["View & pages", [[K + "+wheel", "Zoom"], [K + "+= / -", "Zoom in / out"], [K + "+0", "Fit page"], [K + "+1", "100%"], ["Page Up / Down", "Previous / next page"], [K + "+'", "Grid"], [K + "+Shift+P", "Preview comic"]]],
      ["Files", [[K + "+S", "Save"], [K + "+Shift+S", "Save as"], [K + "+O", "My comics"], ["Ctrl+Alt+N", "New comic"], [K + "+E", "Export"]]],
    ];
    CBS.ui.dialog({
      title: "⌨️ Keyboard shortcuts", wide: true,
      body: h("div", { class: "shortcut-cols" }, rows.map(([title, list]) => h("div", null, h("h3", null, title), h("table", { class: "kbd-table" }, list.map(([k, v]) => h("tr", null, h("td", null, h("kbd", null, k)), h("td", null, v))))))),
      buttons: [{ label: "Close", kind: "primary", value: true }],
    });
  }
  function about() {
    CBS.ui.dialog({
      title: "About Comic Book Studio",
      body: h("div", { class: "about" },
        h("p", null, "Comic Book Studio is a free comic maker from Gaby's Arcade. Plan pages, draw, letter and export comics right in your browser."),
        h("p", null, "Your comics are saved in this browser only (no account, no ads, no uploads). Use File › Export project file to back them up or move them to another computer."),
        h("p", { class: "hint" }, "Fonts: Bangers, Comic Neue, Luckiest Guy, Permanent Marker, Creepster, Special Elite, Patrick Hand, Bungee, Kalam and Fredoka, used under the SIL Open Font License or Apache License 2.0 (see assets/fonts).")),
      buttons: [{ label: "OK", kind: "primary", value: true }],
    });
  }
  function comicDetails() {
    const p = doc().project;
    const title = h("input", { class: "input", value: p.title, maxlength: 80 });
    const author = h("input", { class: "input", value: p.author || "", maxlength: 60 });
    const desc = h("textarea", { class: "input textarea", rows: 3, maxlength: 400 });
    desc.value = p.description || "";
    const s = p.pageSize;
    const info = `${CBS.PAGE_SIZES[s.preset] ? CBS.PAGE_SIZES[s.preset].name : "Custom"} · ${(s.w / 100).toFixed(2)} × ${(s.h / 100).toFixed(2)} in · ${s.orientation} · ${p.pages.length} page${p.pages.length === 1 ? "" : "s"} · ${p.assets.length} picture${p.assets.length === 1 ? "" : "s"}`;
    CBS.ui.dialog({
      title: "Comic details",
      body: h("div", null, CBS.ui.field("Title", title), CBS.ui.field("Author", author), CBS.ui.field("Description", desc), h("p", { class: "hint" }, info),
        h("p", { class: "hint" }, `Created ${new Date(p.created).toLocaleString()} · last changed ${new Date(p.modified).toLocaleString()}`)),
      buttons: [{ label: "Cancel", value: null }, { label: "Save", kind: "primary", value: "ok" }],
    }).promise.then((v) => {
      if (v !== "ok") return;
      doc().edit("Comic details", () => { p.title = title.value.trim() || "Untitled Comic"; p.author = author.value.trim(); p.description = desc.value.trim(); }, "doc");
      bus.emit("project:renamed");
    });
  }

  /* ---------- top bar ---------- */
  function initTop() {
    const bar = document.getElementById("topbar");
    const menuBtn = (label, fn) => h("button", { class: "menu-btn", onclick: (e) => fn(e.currentTarget) }, label);
    undoBtn = tb("tb-undo", "↶", "", "Undo (" + K + "+Z)", () => CBS.history.undo());
    redoBtn = tb("tb-redo", "↷", "", "Redo (" + K + "+Shift+Z)", () => CBS.history.redo());
    zoomBtn = h("button", { class: "tb-btn zoom-val", tip: "Zoom level", onclick: (e) => CBS.ui.menu([
      ...[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map((z) => ({ label: Math.round(z * 100) + "%", action: () => CBS.editor.setZoom(z) })),
      { sep: true }, { label: "Fit page", action: () => CBS.editor.fit() }, { label: "Fit width", action: () => CBS.editor.fit("width") },
    ], e.currentTarget) }, "100%");
    pageLabel = h("button", { class: "tb-btn page-val", tip: "Go to page", onclick: (e) => {
      const p = doc().project;
      CBS.ui.menu(p.pages.map((pg, i) => ({ label: pg.isCover ? "Cover" : "Page " + CBS.pagesPanel.label(pg) + (pg.name ? " · " + pg.name : ""), checked: pg.id === doc().pageId, action: () => doc().gotoIndex(i) })), e.currentTarget);
    } }, "1 / 1");
    titleBtn = h("button", { class: "project-title", tip: "Rename this comic", onclick: () => P().rename() }, "");
    statusEl = h("span", { class: "save-status", role: "status" });
    bar.append(
      h("a", { class: "brand", href: "../../apps.html", tip: "Back to Gaby's Arcade apps", "aria-label": "Back to Gaby's Arcade apps" }, h("img", { src: "icon/icon-32.png", alt: "", width: 24, height: 24 }), h("span", null, "Comic Book Studio")),
      h("nav", { class: "menus", "aria-label": "Main menu" }, menuBtn("File", fileMenu), menuBtn("Edit", editMenu), menuBtn("View", viewMenu), menuBtn("Insert", insertMenu), menuBtn("Help", helpMenu)),
      h("div", { class: "tb-group" },
        tb("tb-new", "✨", "New", "New comic", () => P().newComicWizard()),
        tb("tb-open", "📚", "Open", "My comics (" + K + "+O)", () => P().myComics()),
        tb("tb-save", "💾", "Save", "Save (" + K + "+S)", () => P().save())),
      h("div", { class: "tb-group" }, undoBtn, redoBtn),
      h("div", { class: "tb-group zoom-group" },
        tb("tb-zoom-out", "−", "", "Zoom out", () => CBS.editor.zoomStep(-1)), zoomBtn,
        tb("tb-zoom-in", "＋", "", "Zoom in", () => CBS.editor.zoomStep(1)),
        tb("tb-fit", "⤢", "", "Fit page (" + K + "+0)", () => CBS.editor.fit())),
      h("div", { class: "tb-group page-group" },
        tb("tb-prev", "◀", "", "Previous page (Page Up)", () => doc().gotoIndex(doc().pageIndex - 1)), pageLabel,
        tb("tb-next", "▶", "", "Next page (Page Down)", () => doc().gotoIndex(doc().pageIndex + 1))),
      h("div", { class: "title-wrap" }, titleBtn, statusEl),
      h("div", { class: "spacer" }),
      tb("tb-ai", "🪄", "Assistant", "Creative assistant: story, character and background ideas (A)", () => CBS.ai.toggle(), "accent"),
      tb("tb-preview", "📖", "Preview", "Read your comic like a real book (" + K + "+Shift+P)", () => CBS.reader.open()),
      tb("tb-export", "⬇️", "Export", "Export PDF, images or a project file (" + K + "+E)", () => CBS.exporter.open(), "primary"),
      tb("tb-settings", "⚙️", "", "Settings", () => CBS.app.settings()));

    bus.on("history:changed", updateHistory);
    bus.on("zoom:changed", (z) => { zoomBtn.textContent = Math.round(z * 100) + "%"; });
    bus.on("page:changed", updatePage);
    bus.on("pages:changed", updatePage);
    bus.on("doc:loaded", () => { updatePage(); updateTitle(); updateHistory(); });
    bus.on("project:renamed", updateTitle);
    bus.on("save:status", (s) => {
      statusEl.className = "save-status " + s;
      statusEl.textContent = { saved: "✓ Saved", saving: "Saving…", unsaved: "● Unsaved changes", error: "⚠ Not saved" }[s] || "";
      statusEl.setAttribute("data-tip", s === "unsaved" ? (prefs.get("autosave", true) ? "Your work saves itself every few seconds" : "Autosave is off. Press " + K + "+S to save") : s === "error" ? "Saving failed. Use File › Export project file to keep a copy" : "Saved in this browser");
    });
    updateHistory();
  }
  function updateHistory() {
    const H = CBS.history;
    undoBtn.disabled = !H.canUndo;
    redoBtn.disabled = !H.canRedo;
    undoBtn.setAttribute("data-tip", H.canUndo ? `Undo ${H.undoLabel} (${K}+Z)` : "Nothing to undo");
    redoBtn.setAttribute("data-tip", H.canRedo ? `Redo ${H.redoLabel} (${K}+Shift+Z)` : "Nothing to redo");
  }
  function updatePage() {
    const p = doc().project;
    if (!p) return;
    const pg = doc().page;
    const n = p.pages.length;
    const story = p.pages.filter((x) => !x.isCover).length;
    pageLabel.textContent = pg && pg.isCover ? "Cover" : `${CBS.pagesPanel.label(pg)} / ${story}`;
    document.getElementById("tb-prev").disabled = doc().pageIndex <= 0;
    document.getElementById("tb-next").disabled = doc().pageIndex >= n - 1;
  }
  function updateTitle() {
    const p = doc().project;
    titleBtn.textContent = p ? p.title : "";
    document.title = p ? `${p.title} · Comic Book Studio` : "Comic Book Studio";
  }

  /* ---------- left toolbox ---------- */
  function initToolbox() {
    const box = document.getElementById("toolbox");
    const list = h("div", { class: "tool-list", role: "toolbar", "aria-label": "Tools", "aria-orientation": "vertical" });
    const order = ["select", "move", "hand", null, "draw", "eraser", "fill", "eyedropper", "shape", null, "panel", "bubble", "sfx", "text", "image"];
    for (const id of order) {
      if (!id) { list.append(h("div", { class: "tool-sep" })); continue; }
      const t = CBS.tools.byId[id];
      list.append(h("button", { class: "tool-btn", "data-tool": id, "aria-label": `${t.label} (${t.key})`, tip: `${t.label} (${t.key}): ${t.tip.replace(/\s*\([A-Z]\)\.?$/, "").replace(/\s*\([A-Z]\)/, "")}`, onclick: () => CBS.tools.set(id) },
        h("span", { class: "tool-ico" }, t.icon), h("span", { class: "tool-name" }, t.label.replace("Speech ", "").replace("Sound Effect", "SFX").replace("Color Picker", "Picker").replace("Move Layer", "Move"))));
    }
    list.append(h("div", { class: "tool-sep" }),
      h("button", { class: "tool-btn special", "data-tool": "ai", tip: "AI Image Generator & Creative Assistant (A): stories, characters, backgrounds and panel art", "aria-label": "Creative assistant", onclick: () => CBS.ai.toggle() }, h("span", { class: "tool-ico" }, "🪄"), h("span", { class: "tool-name" }, "AI")),
      h("button", { class: "tool-btn special", "data-tool": "library", tip: "Asset Library (L): sample art and your own pictures", "aria-label": "Asset library", onclick: () => CBS.library.toggle() }, h("span", { class: "tool-ico" }, "🗂️"), h("span", { class: "tool-name" }, "Library")));
    // colors
    const prim = h("button", { class: "swatch primary", tip: "Primary color: lines, brush, text (click to change)", "aria-label": "Primary color" });
    const sec = h("button", { class: "swatch secondary", tip: "Secondary color: shape fills, Alt-click fill (click to change)", "aria-label": "Secondary color" });
    const paint = () => { prim.style.background = CBS.colors.primary; sec.style.background = CBS.colors.secondary; };
    prim.addEventListener("click", () => CBS.ui.colorPopover(prim, CBS.colors.primary, (c, final) => { CBS.colors.primary = c; paint(); if (final) CBS.colors.set("primary", c); }, { title: "Primary color" }));
    sec.addEventListener("click", () => CBS.ui.colorPopover(sec, CBS.colors.secondary, (c, final) => { CBS.colors.secondary = c; paint(); if (final) CBS.colors.set("secondary", c); }, { title: "Secondary color" }));
    const colors = h("div", { class: "color-well" }, prim, sec, h("button", { class: "swap", tip: "Swap colors", "aria-label": "Swap colors", onclick: () => CBS.colors.swap() }, "⇄"));
    const quick = h("div", { class: "quick-colors" }, ["#111111", "#ffffff", "#e63946", "#f97316", "#facc15", "#16a34a", "#3b82f6", "#8b5cf6"].map((c) => h("button", { class: "qc", style: { background: c }, "aria-label": c, tip: c + " (click: primary, right-click: secondary)", onclick: () => CBS.colors.set("primary", c), oncontextmenu: (e) => { e.preventDefault(); CBS.colors.set("secondary", c); } })));
    box.append(list, colors, quick, h("button", { class: "collapse-btn", tip: "Show or hide tool names", "aria-label": "Toggle tool names", onclick: () => { document.body.classList.toggle("toolbox-wide"); prefs.set("toolboxWide", document.body.classList.contains("toolbox-wide")); } }, "⇔"));
    if (prefs.get("toolboxWide", false)) document.body.classList.add("toolbox-wide");
    paint();
    bus.on("colors:changed", paint);
    const mark = () => {
      const cur = CBS.tools.current && CBS.tools.current.id;
      box.querySelectorAll(".tool-btn").forEach((b) => b.classList.toggle("on", b.dataset.tool === cur || (b.dataset.tool === "ai" && CBS.ai.isOpen()) || (b.dataset.tool === "library" && CBS.library.isOpen())));
    };
    bus.on("tool:changed", mark);
    bus.on("drawer:changed", mark);
    mark();
  }

  CBS.toolbar = { init() { initTop(); initToolbox(); }, shortcuts, comicDetails };
})();
