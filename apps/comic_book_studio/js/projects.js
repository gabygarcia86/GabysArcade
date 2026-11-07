/* Projects: save/open (IndexedDB), autosave, recent list, New Comic wizard, My Comics, import/export files. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clear, prefs, timeAgo } = CBS;
  const doc = () => CBS.doc;
  const ui = () => CBS.ui;

  const FILE_EXT = ".comic.json";
  let saving = false;
  let status = "saved";
  function setStatus(s) { status = s; bus.emit("save:status", s); }

  /* ---------- serialization ---------- */
  function serialize(project) {
    const data = JSON.parse(JSON.stringify(project, CBS.snapReplacer));
    data.rasters = {};
    for (const pg of project.pages) for (const l of pg.layers) if (l.rasterId) {
      const url = CBS.raster.toDataURL(l.rasterId);
      if (url) data.rasters[l.rasterId] = url;
    }
    data.savedWith = "Comic Book Studio 1.0";
    return data;
  }
  function validate(data) {
    if (!data || typeof data !== "object") throw new Error("This file isn't a Comic Book Studio project.");
    if (data.format !== "comic-book-studio" || !Array.isArray(data.pages)) throw new Error("This file isn't a Comic Book Studio project.");
    if (!data.pageSize || !(data.pageSize.w > 0) || !(data.pageSize.h > 0)) throw new Error("The project's page size is missing or broken.");
    data.assets = Array.isArray(data.assets) ? data.assets : [];
    data.settings = Object.assign({ gutter: 14, margin: 30, includeCover: true }, data.settings);
    data.cover = Object.assign(CBS.createProject().cover, data.cover);
    for (const pg of data.pages) {
      pg.layers = Array.isArray(pg.layers) ? pg.layers : [];
      pg.guides = pg.guides || { v: [], h: [] };
      for (const l of pg.layers) { l.objects = Array.isArray(l.objects) ? l.objects : []; if (l.type === "drawing" && !l.rasterId) l.rasterId = CBS.uid("rs"); }
    }
    return data;
  }
  async function load(data) {
    data = validate(data);
    const rasters = data.rasters || {};
    delete data.rasters;
    CBS.editor.stopEditing();
    CBS.raster.reset();
    CBS.assets.resetCache();
    CBS.history.reset();
    // the raster registry sizes canvases from doc.size, so point doc at the project first
    doc().project = data;
    await Promise.all(Object.entries(rasters).map(([id, url]) => CBS.raster.load(id, url).catch(() => null)));
    doc().load(data);
    setStatus("saved");
    try { await CBS.storage.kvSet("lastProject", data.id); } catch (e) { /* ignore */ }
    return data;
  }

  async function thumbnail(project) {
    const pg = project.pages[0];
    if (!pg) return null;
    try {
      await CBS.assets.ensureLoaded([pg]);
      const s = project.pageSize;
      const c = CBS.render.pageCanvas(pg, 220 / s.h);
      return c.toDataURL("image/jpeg", 0.72);
    } catch (e) { return null; }
  }

  /* ---------- save / open ---------- */
  async function save(o = {}) {
    const p = doc().project;
    if (!p || saving) return false;
    if (!CBS.storage.available) {
      if (!o.quiet) ui().toast("This browser blocked local storage, so use File › Export project file to keep your work.", { kind: "error" });
      return false;
    }
    saving = true;
    setStatus("saving");
    try {
      CBS.editor.stopEditing();
      const data = serialize(p);
      await CBS.storage.put("projects", { id: p.id, data });
      const meta = (await CBS.storage.get("meta", p.id)) || {};
      await CBS.storage.put("meta", {
        id: p.id, title: p.title, author: p.author, created: p.created, modified: p.modified,
        opened: Date.now(), pageCount: p.pages.length, thumb: await thumbnail(p), sample: !!p.sample, ...{ starred: meta.starred },
      });
      await CBS.storage.kvSet("lastProject", p.id);
      doc().dirty = false;
      setStatus("saved");
      if (!o.quiet) ui().toast("Saved “" + p.title + "”", { kind: "ok" });
      bus.emit("projects:changed");
      return true;
    } catch (e) {
      console.error(e);
      setStatus("error");
      ui().toast("Couldn't save: " + (e.message || e) + ". Try Export project file to keep a copy.", { kind: "error" });
      return false;
    } finally { saving = false; }
  }

  async function saveAs() {
    const p = doc().project;
    if (!p) return;
    const title = await ui().prompt("Save a copy of this comic as:", p.title + " (copy)", { title: "Save As", ok: "Save copy" });
    if (!title) return;
    const data = serialize(p);
    data.id = CBS.uid("cb");
    data.title = title.trim() || p.title;
    data.created = data.modified = Date.now();
    delete data.sample;
    await load(data);
    await save();
  }

  async function open(id) {
    if (doc().project && doc().dirty) await save({ quiet: true });
    const busy = ui().busy("Opening comic…");
    try {
      const rec = await CBS.storage.get("projects", id);
      if (!rec) throw new Error("That comic couldn't be found.");
      await load(rec.data);
      const meta = await CBS.storage.get("meta", id);
      if (meta) { meta.opened = Date.now(); await CBS.storage.put("meta", meta); }
      bus.emit("projects:changed");
      return true;
    } catch (e) {
      ui().toast(e.message || "Couldn't open that comic.", { kind: "error" });
      return false;
    } finally { busy.done(); }
  }

  async function list() {
    try { return (await CBS.storage.all("meta")).sort((a, b) => (b.opened || b.modified || 0) - (a.opened || a.modified || 0)); } catch (e) { return []; }
  }

  async function rename(id = doc().project && doc().project.id) {
    const cur = doc().project && doc().project.id === id ? doc().project : null;
    const meta = await CBS.storage.get("meta", id).catch(() => null);
    const old = cur ? cur.title : meta ? meta.title : "";
    const title = await ui().prompt("New name for this comic:", old, { title: "Rename comic", ok: "Rename" });
    if (!title || !title.trim()) return false;
    if (cur) {
      doc().edit("Rename comic", () => { cur.title = title.trim(); }, "doc");
      bus.emit("project:renamed");
      await save({ quiet: true });
    } else {
      const rec = await CBS.storage.get("projects", id);
      if (rec) { rec.data.title = title.trim(); await CBS.storage.put("projects", rec); }
      if (meta) { meta.title = title.trim(); await CBS.storage.put("meta", meta); }
    }
    bus.emit("projects:changed");
    return true;
  }

  async function duplicate(id) {
    const rec = await CBS.storage.get("projects", id);
    if (!rec) return;
    const data = JSON.parse(JSON.stringify(rec.data));
    data.id = CBS.uid("cb");
    data.title = data.title + " (copy)";
    data.created = data.modified = Date.now();
    delete data.sample;
    await CBS.storage.put("projects", { id: data.id, data });
    const meta = await CBS.storage.get("meta", id);
    await CBS.storage.put("meta", Object.assign({}, meta, { id: data.id, title: data.title, created: data.created, modified: data.modified, opened: Date.now(), sample: false }));
    bus.emit("projects:changed");
    ui().toast("Made a copy: " + data.title, { kind: "ok" });
  }

  async function remove(id) {
    const meta = await CBS.storage.get("meta", id);
    if (!(await ui().confirm(`Delete “${meta ? meta.title : "this comic"}” forever? This can't be undone. Export a project file first if you might want it back.`, { ok: "Delete comic", danger: true, title: "Delete comic?" }))) return false;
    await CBS.storage.del("projects", id);
    await CBS.storage.del("meta", id);
    if (doc().project && doc().project.id === id) {
      doc().dirty = false;
      await CBS.storage.kvSet("lastProject", null);
      const rest = await list();
      if (rest.length) await open(rest[0].id);
      else await newBlank();
    }
    bus.emit("projects:changed");
    return true;
  }

  /* ---------- files ---------- */
  async function exportFile() {
    const p = doc().project;
    if (!p) return;
    const data = serialize(p);
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    CBS.downloadBlob(blob, CBS.safeFilename(p.title) + FILE_EXT);
    ui().toast("Project file downloaded. Open it any time with File › Import project file.", { kind: "ok" });
  }
  async function importFile(file) {
    file = file || (await CBS.pickFile(".json,.comic,application/json"));
    if (!file) return;
    const busy = ui().busy("Importing comic…");
    try {
      const text = await CBS.readFile(file, "text");
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("That file isn't a valid project file."); }
      validate(data);
      const exists = await CBS.storage.get("meta", data.id).catch(() => null);
      if (exists) { data.id = CBS.uid("cb"); data.title += " (imported)"; }
      if (doc().project && doc().dirty) await save({ quiet: true });
      await load(data);
      await save({ quiet: true });
      ui().toast("Imported “" + data.title + "”", { kind: "ok" });
    } catch (e) {
      ui().toast(e.message || "Couldn't import that file.", { kind: "error" });
    } finally { busy.done(); }
  }

  /* ---------- creating comics ---------- */
  async function createComic(opts) {
    if (doc().project && doc().dirty) await save({ quiet: true });
    const p = CBS.createProject(opts);
    p.settings.gutter = opts.gutter != null ? opts.gutter : 14;
    p.settings.margin = Math.round(Math.min(p.pageSize.w, p.pageSize.h) * 0.045);
    doc().project = p; // so layouts can read the page size
    if (opts.cover) {
      p.cover.template = opts.coverTemplate || "classic";
      p.cover.subtitle = opts.description ? opts.description.slice(0, 60) : "";
      p.pages.push(CBS.cover.createCoverPage(p, p.cover.template));
    } else p.settings.includeCover = false;
    for (let i = 0; i < opts.pages; i++) p.pages.push(CBS.actions.newPageFor(p, opts.template));
    CBS.prefs.set("defaultTemplate", opts.template);
    await load(JSON.parse(JSON.stringify(p)));
    if (opts.coverFile) {
      const [a] = await CBS.assets.importFiles([opts.coverFile], "characters");
      if (a) { await CBS.cover.setCoverArt(a); CBS.history.reset(); }
    }
    if (doc().project.pages[1] && opts.cover) doc().setPage(doc().project.pages[opts.cover ? 1 : 0].id);
    await save({ quiet: true });
    ui().toast("Your new comic is ready. Have fun!", { kind: "ok" });
  }
  async function newBlank() {
    await createComic({ title: "Untitled Comic", preset: "us_comic", orientation: "portrait", pages: 1, template: "six", cover: false });
  }

  function newComicWizard() {
    const state = { title: "", author: prefs.get("lastAuthor", ""), description: "", preset: "us_comic", orientation: "portrait", pages: 4, template: prefs.get("defaultTemplate", "six"), cover: true, coverTemplate: "classic", custom: { w: 7, h: 10 }, unit: "in", coverFile: null };
    const title = h("input", { class: "input big", placeholder: "My Amazing Comic", maxlength: 80, autofocus: true, "aria-label": "Comic title" });
    const author = h("input", { class: "input", placeholder: "Your name", value: state.author, maxlength: 60, "aria-label": "Author" });
    const desc = h("textarea", { class: "input textarea", rows: 2, placeholder: "What's your comic about? (optional)", maxlength: 400, "aria-label": "Description" });
    const sizes = h("div", { class: "size-cards" });
    const customBox = h("div", { class: "custom-size", hidden: true });
    const cw = h("input", { type: "number", class: "input num", value: 7, min: 1, max: 40, step: 0.1, "aria-label": "Custom width" });
    const chh = h("input", { type: "number", class: "input num", value: 10, min: 1, max: 40, step: 0.1, "aria-label": "Custom height" });
    const unit = CBS.ui.select([["in", "inches"], ["cm", "cm"], ["mm", "mm"]], "in", (v) => (state.unit = v));
    customBox.append(CBS.ui.field("Width", cw), CBS.ui.field("Height", chh), CBS.ui.field("Units", unit));
    const drawSizes = () => {
      clear(sizes);
      for (const [k, s] of Object.entries(CBS.PAGE_SIZES)) {
        const ar = s.w / s.h;
        const landscape = state.orientation === "landscape";
        const w = landscape === (ar < 1) ? 30 / Math.max(ar, 1 / ar) : 30, hh = landscape === (ar < 1) ? 30 : 30 / Math.max(ar, 1 / ar);
        sizes.append(h("button", { class: "size-card" + (state.preset === k ? " on" : ""), onclick: () => { state.preset = k; customBox.hidden = k !== "custom"; drawSizes(); } },
          h("span", { class: "sc-shape", style: { width: (k === "custom" ? 24 : w) + "px", height: (k === "custom" ? 30 : hh) + "px" } }),
          h("b", null, s.name), h("small", null, s.note)));
      }
    };
    drawSizes();
    const orient = CBS.ui.segmented([["portrait", "▯ Portrait"], ["landscape", "▭ Landscape"]], "portrait", (v) => { state.orientation = v; drawSizes(); });
    const pages = CBS.ui.slider({ label: "Pages", min: 1, max: 40, value: 4, onInput: (v) => (state.pages = v), onCommit: (v) => (state.pages = v) });
    const coverToggle = CBS.ui.toggle("Start with a cover page", true, (v) => { state.cover = v; coverOpts.hidden = !v; });
    const coverFileLabel = h("span", { class: "hint" }, "No cover art yet (optional)");
    const coverOpts = h("div", { class: "cover-opts" },
      CBS.ui.field("Cover design", CBS.ui.select(Object.fromEntries(Object.entries(CBS.cover.TEMPLATES).map(([k, t]) => [k, t.name])), "classic", (v) => (state.coverTemplate = v))),
      h("div", { class: "frow" }, CBS.ui.button("Cover artwork…", async () => {
        const f = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg");
        if (f) { state.coverFile = f; coverFileLabel.textContent = "🖼️ " + f.name; }
      }, { small: true }), coverFileLabel));
    const tplGrid = CBS.pagesPanel.templateGrid(state.template, (id) => (state.template = id), { allowBlank: true });
    tplGrid.classList.add("compact");

    const body = h("div", { class: "wizard" },
      h("div", { class: "wz-col" },
        h("h3", null, "1 · Name your comic"),
        CBS.ui.field("Title", title), CBS.ui.field("Author", author), CBS.ui.field("Description", desc),
        h("h3", null, "2 · Cover"), coverToggle, coverOpts,
        h("h3", null, "3 · Pages"), pages),
      h("div", { class: "wz-col" },
        h("h3", null, "4 · Page size"), sizes, customBox, CBS.ui.field("Orientation", orient),
        h("h3", null, "5 · Starting layout"), tplGrid));
    const d = CBS.ui.dialog({
      title: "✨ New Comic", wide: true, className: "wizard-dlg", body,
      buttons: [{ label: "Cancel", value: null }, { label: "Create my comic!", kind: "primary big", value: "ok" }],
    });
    return d.promise.then(async (v) => {
      if (v !== "ok") return;
      const k = state.unit === "cm" ? 1 / 2.54 : state.unit === "mm" ? 1 / 25.4 : 1;
      const custom = { w: Math.max(1, Math.min(40, (parseFloat(cw.value) || 7) * k)), h: Math.max(1, Math.min(40, (parseFloat(chh.value) || 10) * k)) };
      prefs.set("lastAuthor", author.value.trim());
      await createComic({
        title: title.value.trim() || "Untitled Comic", author: author.value.trim(), description: desc.value.trim(),
        preset: state.preset, orientation: state.orientation, custom, pages: state.pages, template: state.template,
        cover: state.cover, coverTemplate: state.coverTemplate, coverFile: state.coverFile,
      });
    });
  }

  /* ---------- My Comics ---------- */
  async function myComics() {
    const grid = h("div", { class: "project-grid" });
    // Resolves after the chosen action has finished (or when the dialog is simply closed).
    let resolveDone, acting = false;
    const done = new Promise((r) => (resolveDone = r));
    const act = async (fn) => { acting = true; d.close(); try { await fn(); } finally { resolveDone(); } };
    const d = CBS.ui.dialog({
      title: "📚 My Comics", wide: true, className: "projects-dlg",
      body: h("div", null,
        h("div", { class: "btn-row" },
          CBS.ui.button("New comic", () => act(newComicWizard), { icon: "✨", kind: "primary" }),
          CBS.ui.button("Import project file…", () => act(() => importFile()), { icon: "📥" }),
          CBS.ui.button("Open sample comic", () => act(() => CBS.sample.open()), { icon: "🦸" })),
        grid),
    });
    const draw = async () => {
      clear(grid);
      const items = await list();
      if (!items.length) { grid.append(h("p", { class: "hint pad" }, "No saved comics yet. Make a new one, or open the sample comic to explore.")); return; }
      for (const m of items) {
        const current = doc().project && doc().project.id === m.id;
        grid.append(h("div", { class: "project-card" + (current ? " current" : "") },
          h("button", { class: "pc-thumb", onclick: () => act(async () => { if (!current) await open(m.id); }), "aria-label": "Open " + m.title },
            m.thumb ? h("img", { src: m.thumb, alt: "" }) : h("span", null, "📖")),
          h("div", { class: "pc-info" },
            h("b", null, m.title || "Untitled"),
            h("small", null, `${m.pageCount || 0} page${m.pageCount === 1 ? "" : "s"} · ${timeAgo(m.modified)}${current ? " · open now" : ""}`)),
          h("div", { class: "pc-actions" },
            h("button", { class: "icon-btn sm", tip: "Rename", "aria-label": "Rename", onclick: async () => { await rename(m.id); draw(); } }, "✏️"),
            h("button", { class: "icon-btn sm", tip: "Duplicate", "aria-label": "Duplicate", onclick: async () => { await duplicate(m.id); draw(); } }, "⧉"),
            h("button", {
              class: "icon-btn sm", tip: "Download project file", "aria-label": "Download project file",
              onclick: async () => { const rec = await CBS.storage.get("projects", m.id); if (rec) CBS.downloadBlob(new Blob([JSON.stringify(rec.data)], { type: "application/json" }), CBS.safeFilename(m.title) + FILE_EXT); },
            }, "⬇️"),
            h("button", { class: "icon-btn sm danger", tip: "Delete", "aria-label": "Delete", onclick: async () => { if (await remove(m.id)) draw(); } }, "🗑"))));
      }
    };
    draw();
    d.promise.then(() => { if (!acting) resolveDone(); });
    return done;
  }

  async function recentMenuItems() {
    const items = (await list()).slice(0, 8);
    return items.length ? items.map((m) => ({ label: m.title || "Untitled", icon: "📖", checked: doc().project && doc().project.id === m.id, action: () => open(m.id) })) : [{ label: "No recent comics", disabled: true }];
  }

  /* ---------- welcome screen ---------- */
  async function welcome(o = {}) {
    const recent = (await list()).slice(0, 4);
    // After an action, come back to this screen if there's still no comic open (e.g. the user cancelled).
    const then = async (fn) => { d.close(); await fn(); if (!doc().project) setTimeout(() => welcome(), 250); };
    const card = (icon, title, text, fn, cls = "") => h("button", { class: "welcome-card " + cls, onclick: () => then(fn) }, h("span", { class: "wc-ico" }, icon), h("b", null, title), h("small", null, text));
    const body = h("div", { class: "welcome" },
      h("div", { class: "welcome-hero" },
        h("img", { src: "icon/icon-128.png", alt: "", width: 72, height: 72 }),
        h("div", null, h("h1", null, "Comic Book Studio"), h("p", null, "Create your own comic books: panels, drawings, speech bubbles, sound effects and covers. Everything stays on your computer."))),
      h("div", { class: "welcome-cards" },
        card("✨", "New comic", "Pick a size, a cover and a layout", newComicWizard, "primary"),
        card("🦸", "Sample comic", "Open a finished comic and explore", () => CBS.sample.open()),
        card("🎓", "Take the tour", "7 quick steps to your first comic", async () => { if (!doc().project) await CBS.sample.open(); CBS.tutorial.start(); }),
        card("📥", "Import a file", "Open a saved .comic.json project", () => importFile())),
      recent.length ? h("div", { class: "welcome-recent" }, h("h3", null, "Continue a comic"),
        h("div", { class: "recent-row" }, recent.map((m) => h("button", { class: "recent-item", onclick: () => then(() => open(m.id)) },
          m.thumb ? h("img", { src: m.thumb, alt: "" }) : h("span", { class: "ri-ph" }, "📖"), h("b", null, m.title), h("small", null, timeAgo(m.modified)))),
        h("button", { class: "recent-item more", onclick: () => then(myComics) }, h("span", { class: "ri-ph" }, "📚"), h("b", null, "All my comics")))) : null);
    const d = CBS.ui.dialog({ title: "", className: "welcome-dlg", body, noClose: !doc().project && !o.closable, modal: !doc().project });
    // A comic opened some other way (drag & drop, keyboard) replaces the start screen.
    const off = bus.on("doc:loaded", () => d.close());
    d.promise.then(off);
    return d.promise;
  }

  /* ---------- autosave ---------- */
  function initAutosave() {
    setInterval(() => {
      if (prefs.get("autosave", true) && doc().project && doc().dirty && !saving && !CBS.raster.stroking) save({ quiet: true });
    }, Math.max(10, prefs.get("autosaveSeconds", 30)) * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && doc().project && doc().dirty && prefs.get("autosave", true)) save({ quiet: true });
    });
    window.addEventListener("beforeunload", (e) => {
      if (doc().project && doc().dirty) {
        if (prefs.get("autosave", true)) save({ quiet: true });
        e.preventDefault();
        e.returnValue = "";
      }
    });
    bus.on("doc:changed", () => { if (status !== "unsaved") setStatus("unsaved"); });
  }

  CBS.projects = {
    serialize, load, validate, save, saveAs, open, list, rename, duplicate, remove, exportFile, importFile,
    createComic, newBlank, newComicWizard, myComics, recentMenuItems, welcome, initAutosave,
    get status() { return status; },
  };
})();
