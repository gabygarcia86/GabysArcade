/* Screens and windows: top bar, stage controls, welcome screen, templates, My Projects,
 * new project, settings, help (with animation guides and shortcuts), the first-time tutorial
 * and the big-screen preview. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, h, clamp } = GAS;
  const I = (n, c) => GAS.icons.svg(n, c);

  const SIZE_PRESETS = [
    { w: 256, h: 256, label: "Tiny square" }, { w: 320, h: 240, label: "Small" }, { w: 480, h: 360, label: "Medium" },
    { w: 512, h: 512, label: "Square" }, { w: 640, h: 480, label: "Classic" }, { w: 800, h: 600, label: "Large" },
    { w: 1280, h: 720, label: "Widescreen HD" },
  ];
  const mod = GAS.isMac ? "⌘" : "Ctrl";

  /* ---------- top bar ---------- */
  let nameBtn, saveState, undoBtn, redoBtn;
  function buildTopbar() {
    const bar = document.getElementById("topbar");
    const btn = (icon, label, tip, fn, cls, key) => {
      const b = h("button", { class: "top-btn " + (cls || ""), type: "button", tip, "aria-label": label, dataset: key ? { key } : undefined }, I(icon), h("span", { class: "top-label" }, label));
      b.addEventListener("click", fn);
      return b;
    };
    const brand = h("a", { class: "brand", href: "../../apps.html", tip: "Back to the Apps page", "aria-label": "Back to the Apps page" },
      h("img", { src: "icon/icon-128.png", alt: "", width: 40, height: 40 }),
      h("span", { class: "brand-text" }, h("b", null, "Gaby's"), " Animation Studio"));
    nameBtn = h("button", { class: "project-name", type: "button", tip: "Rename your animation", onclick: rename }, h("span", { class: "name-text" }), I("rename"));
    undoBtn = btn("undo", "Undo", "Undo", () => GAS.history.undo(), "", mod + "+Z");
    redoBtn = btn("redo", "Redo", "Redo", () => GAS.history.redo(), "", mod + "+Y");
    const saveBtn = btn("save", "Save", "Save your project to a file", () => GAS.projects.saveToFile(false), "", mod + "+S");
    const saveMore = h("button", { class: "top-btn is-narrow", type: "button", tip: "More ways to save", "aria-label": "More save options", onclick: (e) => GAS.ui.menu(e.currentTarget, [
      { label: "Save", icon: "save", key: mod + "+S", onClick: () => GAS.projects.saveToFile(false) },
      { label: "Save as…", icon: "saveAs", key: mod + "+⇧+S", onClick: () => GAS.projects.saveToFile(true) },
      { label: "Save on this device now", icon: "check", onClick: async () => { GAS.bus.emit("dirty"); await GAS.projects.autosaveNow(); GAS.ui.toast("Saved on this device!"); } },
    ]) }, I("chevronDown"));
    saveState = h("span", { class: "save-state", tip: "Your work is saved on this device automatically" });
    const more = h("button", { class: "top-btn show-sm", type: "button", "aria-label": "Menu", tip: "Menu", onclick: (e) => GAS.ui.menu(e.currentTarget, [
      { label: "New animation", icon: "new", onClick: newDialog },
      { label: "Open my projects", icon: "folder", onClick: projectsDialog },
      { label: "Open a file…", icon: "open", key: mod + "+O", onClick: () => GAS.projects.openFile() },
      { label: "Try a template", icon: "template", onClick: templatesDialog },
      "-",
      { label: "Save as…", icon: "saveAs", onClick: () => GAS.projects.saveToFile(true) },
      { label: "Canvas size", icon: "resize", onClick: canvasSizeDialog },
      { label: "Settings", icon: "settings", onClick: settingsDialog },
      { label: "Help", icon: "help", onClick: () => helpDialog() },
    ]) }, I("menu"));
    bar.append(
      brand, nameBtn,
      h("div", { class: "top-group hide-sm" },
        btn("new", "New", "Start a new animation", newDialog),
        btn("open", "Open", "Open one of your projects", projectsDialog, "", mod + "+O")),
      h("div", { class: "top-group" }, undoBtn, redoBtn),
      h("div", { class: "top-group" }, saveBtn, saveMore, saveState),
      h("div", { class: "top-spacer" }),
      h("button", { class: "export-btn", type: "button", tip: "Make a GIF, video or pictures to share", onclick: () => GAS.exporter.open() }, I("export"), h("span", null, "Export")),
      h("div", { class: "top-group hide-sm" },
        btn("settings", "Settings", "Settings", settingsDialog, "icon-only"),
        btn("help", "Help", "Help, tips and keyboard shortcuts", () => helpDialog(), "icon-only")),
      more);

    GAS.bus.on("history-changed", ({ canUndo, canRedo }) => {
      undoBtn.disabled = !canUndo;
      redoBtn.disabled = !canRedo;
      undoBtn.dataset.tip = canUndo ? "Undo " + GAS.history.nextUndoLabel.toLowerCase() : "Nothing to undo";
      redoBtn.dataset.tip = canRedo ? "Redo " + GAS.history.nextRedoLabel.toLowerCase() : "Nothing to redo";
    });
    GAS.bus.emit("history-changed", { canUndo: false, canRedo: false });
    GAS.bus.on("project-loaded", syncName);
    GAS.bus.on("project-renamed", () => { syncName(); GAS.bus.emit("dirty"); });
    GAS.bus.on("autosave-status", ({ state: s, time, enabled }) => {
      saveState.className = "save-state is-" + s;
      const label = { pending: "Saving soon…", saving: "Saving…", saved: time ? "Saved " + GAS.fmtTime(time) : "Saved", error: "Not saved!", off: "Autosave off" }[s] || "";
      saveState.textContent = label;
      saveState.dataset.tip = s === "error" ? "Couldn't save on this device. Use Save to keep a file." : enabled ? "Your work saves itself on this device" : "Autosave is turned off in Settings";
    });
    GAS.bus.emit("autosave-status", { state: "saved", time: 0, enabled: GAS.projects.autosaveEnabled });
  }
  function syncName() {
    nameBtn.querySelector(".name-text").textContent = state.project ? state.project.name : "";
    document.title = (state.project ? state.project.name + " · " : "") + "Gaby's Animation Studio";
  }
  async function rename() {
    const v = await GAS.ui.prompt({ title: "Rename your animation", label: "Name", value: state.project.name, ok: "Rename" });
    if (v) { state.project.name = v.slice(0, 60); GAS.bus.emit("project-renamed"); }
  }

  /* ---------- stage controls ---------- */
  function buildStageUI() {
    const stage = GAS.view.stage;
    const zoomLbl = h("button", { class: "zoom-label", type: "button", tip: "Fit to screen", onclick: () => GAS.view.fit() }, "100%");
    const zoom = h("div", { class: "stage-ui zoom-ctl" },
      h("button", { class: "icon-btn small", type: "button", tip: "Zoom out", "aria-label": "Zoom out", onclick: () => GAS.view.zoomBy(1 / 1.25) }, I("zoomOut")),
      zoomLbl,
      h("button", { class: "icon-btn small", type: "button", tip: "Zoom in", "aria-label": "Zoom in", onclick: () => GAS.view.zoomBy(1.25) }, I("zoomIn")),
      h("button", { class: "icon-btn small", type: "button", tip: "Canvas size", "aria-label": "Canvas size", onclick: canvasSizeDialog }, I("resize")));
    GAS.bus.on("zoom-changed", (z) => { zoomLbl.textContent = Math.round(z * 100) + "%"; });

    const layerChip = h("div", { class: "stage-ui layer-chip" });
    const syncLayer = () => {
      layerChip.innerHTML = "";
      layerChip.append(GAS.ui.segmented([
        { value: "draw", label: "✏️ Drawing", tip: "Draw on top" },
        { value: "bg", label: "🏞️ Background", tip: "Paint the scenery behind" },
      ], state.activeLayer, (v) => GAS.app.setActiveLayer(v)));
    };
    syncLayer();
    GAS.bus.on("layer-changed", syncLayer);
    GAS.bus.on("project-loaded", syncLayer);

    const panelBtn = h("button", { class: "stage-ui panel-toggle", type: "button", tip: "Show tool settings", "aria-label": "Show tool settings", onclick: () => GAS.panels.setOpen(true) }, I("tools"), h("span", null, "Options"));
    const playOverlay = h("div", { class: "stage-ui play-badge" }, I("play"), h("span", null, "Playing… tap to stop"));
    stage.append(zoom, layerChip, panelBtn, playOverlay);
  }

  /* ---------- welcome ---------- */
  let welcomeEl = null;
  async function showWelcome() {
    if (welcomeEl) return;
    const option = (cls, icon, title, text, fn) => {
      const b = h("button", { class: "welcome-option " + cls, type: "button" }, h("span", { class: "wo-icon" }, I(icon)), h("span", { class: "wo-title" }, title), h("span", { class: "wo-text" }, text));
      b.addEventListener("click", fn);
      return b;
    };
    const resume = h("div", { class: "welcome-resume" });
    welcomeEl = h("div", { class: "welcome", role: "dialog", "aria-label": "Welcome" },
      h("div", { class: "welcome-doodles", "aria-hidden": "true" }, ...["⭐", "✏️", "🎨", "🎬", "✨", "🚀", "🐱", "💫"].map((e, i) => h("span", { style: { "--i": i } }, e))),
      h("div", { class: "welcome-card" },
        h("img", { class: "welcome-logo", src: "icon/icon-256.png", alt: "", width: 128, height: 128 }),
        h("h1", null, h("span", { class: "w-gaby" }, "Gaby's"), " Animation Studio"),
        h("p", { class: "welcome-tag" }, "Draw it. Flip it. Watch it move!"),
        resume,
        h("div", { class: "welcome-options" },
          option("is-draw", "pencil", "Start Drawing", "Make a brand-new animation", async () => { closeWelcome(); await GAS.app.newProject({}); maybeTutorial(); }),
          option("is-template", "template", "Try a Template", "Start from a fun example", () => templatesDialog()),
          option("is-open", "folder", "Open My Project", "Keep working on one you made", () => projectsDialog())),
        h("p", { class: "welcome-privacy" }, "🔒 No sign-up, no ads. Your animations stay on this device unless you export them."),
        h("a", { class: "welcome-back", href: "../../apps.html" }, "← Back to Apps")));
    document.body.appendChild(welcomeEl);
    document.body.classList.add("has-welcome");
    try {
      const lastId = await GAS.storage.getMeta("lastProjectId");
      const cards = await GAS.storage.listProjects();
      const last = cards.find((c) => c.id === lastId) || cards[0];
      if (last && welcomeEl) {
        const url = last.thumb ? URL.createObjectURL(last.thumb) : null;
        resume.appendChild(h("button", { class: "resume-card", type: "button", onclick: () => openStored(last.id) },
          url ? h("img", { src: url, alt: "" }) : null,
          h("span", { class: "resume-text" }, h("span", { class: "resume-kicker" }, "Keep working on"), h("b", null, last.name), h("span", null, `${last.frames} frame${last.frames === 1 ? "" : "s"} · ${GAS.fmtDate(last.updatedAt)}`)),
          h("span", { class: "resume-go" }, I("play"))));
      }
    } catch { /* storage not available */ }
  }
  function closeWelcome() {
    if (!welcomeEl) return;
    const el = welcomeEl;
    welcomeEl = null;
    el.classList.add("is-leaving");
    document.body.classList.remove("has-welcome");
    setTimeout(() => el.remove(), 300);
    setTimeout(() => GAS.view.fit(), 20);
  }

  async function openStored(id) {
    const busy = GAS.ui.busy("Opening your animation…");
    try {
      const p = await GAS.projects.loadFromStorage(id);
      await GAS.app.loadProject(p);
      busy.close();
      closeWelcome();
      GAS.ui.closeTopModal();
      GAS.ui.toast("Welcome back! 👋");
    } catch (err) {
      busy.close();
      GAS.ui.alert({ title: "Hmm, that didn't open", text: "That project couldn't be loaded. It may have been made with a newer version." });
    }
  }

  /* ---------- templates ---------- */
  function templatesDialog() {
    const grid = h("div", { class: "template-grid" });
    const players = [];
    for (const t of GAS.templates.LIST) {
      const canvas = h("canvas", { class: "template-canvas", width: 192, height: 144 });
      const card = h("button", { class: "template-card", type: "button" }, h("div", { class: "template-preview" }, canvas), h("b", null, t.title), h("span", null, t.desc));
      card.addEventListener("click", async () => {
        m.close();
        const p = GAS.templates.build(t.id);
        p.name = t.title;
        await GAS.app.loadProject(p, { dirty: true });
        closeWelcome();
        GAS.ui.toast("Press ▶ Play to watch it, then change anything you like!", { duration: 5000 });
      });
      grid.appendChild(card);
      players.push({ t, canvas });
    }
    let raf = 0, alive = true;
    const m = GAS.ui.modal({ title: "Try a template", icon: "template", wide: true, body: h("div", null, h("p", { class: "dialog-text" }, "Pick an example to open. Everything in it can be changed: the drawings, the timing, the stickers and the sounds."), grid), onClose: () => { alive = false; cancelAnimationFrame(raf); } });
    (async () => {
      for (const pl of players) {
        if (!alive) return;
        pl.frames = await GAS.templates.preview(pl.t.id);
        pl.i = 0; pl.acc = 0;
        pl.canvas.getContext("2d").drawImage(pl.frames[0].canvas, 0, 0);
        await GAS.nextFrame();
      }
    })();
    let last = 0;
    const tick = (now) => {
      if (!alive) return;
      const dt = last ? now - last : 0;
      last = now;
      for (const pl of players) {
        if (!pl.frames) continue;
        pl.acc += dt;
        if (pl.acc >= pl.frames[pl.i].ms) {
          pl.acc = 0;
          pl.i = (pl.i + 1) % pl.frames.length;
          const c = pl.canvas.getContext("2d");
          c.clearRect(0, 0, 192, 144);
          c.drawImage(pl.frames[pl.i].canvas, 0, 0);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  /* ---------- my projects ---------- */
  async function projectsDialog() {
    const list = h("div", { class: "project-grid" });
    const urls = [];
    const m = GAS.ui.modal({
      title: "My projects", icon: "folder", wide: true,
      body: h("div", null,
        h("p", { class: "dialog-text" }, "These are saved on this device. To move a project to another computer, open it and press Save."),
        list),
      actions: [
        { label: "Open a file…", kind: "ghost", icon: "open", onClick: async () => { const ok = await GAS.projects.openFile(); if (ok) closeWelcome(); return ok; } },
        { label: "New animation", kind: "primary", icon: "plus", onClick: () => { newDialog(); return true; } },
      ],
      onClose: () => urls.forEach((u) => URL.revokeObjectURL(u)),
    });
    let cards = [];
    try { cards = await GAS.storage.listProjects(); } catch { /* ignore */ }
    const fill = () => {
      list.innerHTML = "";
      if (!cards.length) {
        list.appendChild(h("div", { class: "empty-projects" }, h("span", { class: "big-emoji" }, "🎬"), h("p", null, "No saved projects yet. Start drawing and your work saves itself here!")));
        return;
      }
      for (const c of cards) {
        const url = c.thumb ? URL.createObjectURL(c.thumb) : "";
        if (url) urls.push(url);
        const isOpen = state.project && state.project.id === c.id;
        const del = h("button", { class: "icon-btn small is-danger", type: "button", tip: "Delete this project", "aria-label": "Delete " + c.name }, I("trash"));
        del.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!(await GAS.ui.confirm({ title: "Delete “" + c.name + "”?", text: "This removes it from this device for good. Files you saved stay safe.", ok: "Delete it", danger: true, icon: "trash" }))) return;
          await GAS.storage.deleteProject(c.id);
          cards = cards.filter((x) => x.id !== c.id);
          fill();
        });
        const card = h("div", { class: "project-card" + (isOpen ? " is-open" : ""), role: "button", tabindex: "0" },
          h("div", { class: "project-thumb" }, url ? h("img", { src: url, alt: "" }) : null),
          h("div", { class: "project-meta" }, h("b", null, c.name), h("span", null, `${c.frames} frame${c.frames === 1 ? "" : "s"} · ${c.width}×${c.height}`), h("span", null, GAS.fmtDate(c.updatedAt))),
          isOpen ? h("span", { class: "open-tag" }, "Open now") : del);
        const open = () => { if (isOpen) { m.close(); closeWelcome(); } else openStored(c.id); };
        card.addEventListener("click", open);
        card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
        list.appendChild(card);
      }
    };
    fill();
  }

  /* ---------- new project ---------- */
  function sizePicker(cur, onPick) {
    const grid = h("div", { class: "size-grid" });
    const custom = h("div", { class: "custom-size" });
    const wIn = h("input", { class: "num-input", type: "number", min: 16, max: 4096, value: cur.w, "aria-label": "Width" });
    const hIn = h("input", { class: "num-input", type: "number", min: 16, max: 4096, value: cur.h, "aria-label": "Height" });
    const sync = () => grid.querySelectorAll(".size-btn").forEach((b) => b.classList.toggle("is-active", +b.dataset.w === +wIn.value && +b.dataset.h === +hIn.value));
    for (const s of SIZE_PRESETS) {
      const k = 46 / Math.max(s.w, s.h);
      const b = h("button", { class: "size-btn", type: "button", dataset: { w: s.w, h: s.h } },
        h("span", { class: "size-shape", style: { width: Math.round(s.w * k) + "px", height: Math.round(s.h * k) + "px" } }),
        h("b", null, s.label), h("span", null, `${s.w} × ${s.h}`));
      b.addEventListener("click", () => { wIn.value = s.w; hIn.value = s.h; sync(); onPick(s.w, s.h); });
      grid.appendChild(b);
    }
    const onCustom = () => { sync(); onPick(clamp(+wIn.value || 16, 16, 4096), clamp(+hIn.value || 16, 16, 4096)); };
    wIn.addEventListener("input", onCustom);
    hIn.addEventListener("input", onCustom);
    custom.append(h("span", null, "Custom:"), wIn, h("span", null, "×"), hIn, h("span", null, "pixels"));
    sync();
    return h("div", null, grid, custom);
  }

  function newDialog() {
    const opts = { name: "My Animation", w: 640, h: 480, bg: "white" };
    const nameIn = h("input", { class: "text-input", type: "text", value: opts.name, maxlength: 60 });
    const bgs = [
      { value: "white", label: "White", fill: { type: "color", color: "#ffffff" } },
      { value: "transparent", label: "See-through", fill: { type: "transparent" } },
      { value: "sky", label: "Sky", fill: GAS.render.BG_PRESETS.find((b) => b.id === "sky").fill },
      { value: "grid", label: "Grid paper", fill: GAS.render.BG_PRESETS.find((b) => b.id === "grid").fill },
    ];
    GAS.ui.modal({
      title: "New animation", icon: "new", wide: true,
      body: h("div", { class: "form-stack" },
        h("label", { class: "field" }, h("span", { class: "field-label" }, "Name"), nameIn),
        h("div", { class: "field" }, h("span", { class: "field-label" }, "Canvas size"), sizePicker({ w: opts.w, h: opts.h }, (w, hh) => { opts.w = w; opts.h = hh; })),
        h("div", { class: "field" }, h("span", { class: "field-label" }, "Background"), GAS.ui.segmented(bgs.map((b) => ({ value: b.value, label: b.label })), opts.bg, (v) => { opts.bg = v; }))),
      actions: [
        { label: "Cancel", kind: "ghost" },
        { label: "Start drawing!", kind: "primary", icon: "pencil", onClick: async () => {
          const bg = bgs.find((b) => b.value === opts.bg).fill;
          await GAS.app.newProject({ name: nameIn.value.trim() || "My Animation", width: opts.w, height: opts.h, bgFill: { ...bg } });
          closeWelcome();
          GAS.ui.toast("A fresh canvas! Draw something ✏️");
          maybeTutorial();
        } },
      ],
    });
  }

  /* ---------- canvas size ---------- */
  function canvasSizeDialog() {
    const p = state.project;
    const sel = { w: p.width, h: p.height, mode: "center" };
    GAS.ui.modal({
      title: "Canvas size", icon: "resize", wide: true,
      body: h("div", { class: "form-stack" },
        h("p", { class: "dialog-text" }, `Right now your canvas is ${p.width} × ${p.height}. Every frame changes size together.`),
        sizePicker({ w: p.width, h: p.height }, (w, hh) => { sel.w = w; sel.h = hh; }),
        h("div", { class: "field" }, h("span", { class: "field-label" }, "What happens to my drawings?"),
          GAS.ui.segmented([{ value: "center", label: "Keep them the same size" }, { value: "stretch", label: "Stretch them to fit" }], sel.mode, (v) => { sel.mode = v; }))),
      actions: [
        { label: "Cancel", kind: "ghost" },
        { label: "Change size", kind: "primary", icon: "check", onClick: () => {
          if (sel.w === p.width && sel.h === p.height) return true;
          GAS.app.resizeCanvas(sel.w, sel.h, sel.mode);
          GAS.ui.toast(`Canvas is now ${sel.w} × ${sel.h}. Press Undo to go back.`);
          return true;
        } },
      ],
    });
  }

  /* ---------- settings ---------- */
  async function settingsDialog() {
    const usage = h("span", { class: "hint" }, "Checking…");
    const status = h("span", { class: "hint" });
    const refreshStatus = () => { status.textContent = GAS.projects.lastSaved ? "Last saved on this device at " + GAS.fmtTime(GAS.projects.lastSaved) : "Saves a moment after every change."; };
    refreshStatus();
    GAS.ui.modal({
      title: "Settings", icon: "settings",
      body: h("div", { class: "form-stack" },
        h("section", { class: "settings-group" }, h("h3", null, "Canvas"),
          h("p", { class: "hint" }, `Size: ${state.project.width} × ${state.project.height}`),
          h("button", { class: "btn", type: "button", onclick: canvasSizeDialog }, I("resize"), h("span", null, "Change canvas size"))),
        h("section", { class: "settings-group" }, h("h3", null, "Saving"),
          GAS.ui.toggle("Save my work on this device automatically", GAS.projects.autosaveEnabled, (v) => GAS.projects.setAutosave(v)),
          status,
          h("button", { class: "btn", type: "button", onclick: async () => { GAS.bus.emit("dirty"); await GAS.projects.autosaveNow(); refreshStatus(); GAS.ui.toast("Saved on this device!"); } }, I("save"), h("span", null, "Save on this device now"))),
        h("section", { class: "settings-group" }, h("h3", null, "Sound"),
          GAS.ui.toggle("Play frame sounds when I press Play", !GAS.audio.muted, (v) => { GAS.audio.muted = !v; })),
        h("section", { class: "settings-group" }, h("h3", null, "Learning"),
          h("button", { class: "btn", type: "button", onclick: () => { GAS.ui.closeTopModal(); startTutorial(); } }, I("sparkle"), h("span", null, "Show me the tutorial again"))),
        h("section", { class: "settings-group" }, h("h3", null, "Storage on this device"),
          usage,
          h("button", { class: "btn btn-danger", type: "button", onclick: async () => {
            if (!(await GAS.ui.confirm({ title: "Delete every saved project?", text: "This removes all projects saved on this device (but not files you saved or exported). The animation that's open now stays open.", ok: "Delete them all", danger: true, icon: "trash" }))) return;
            const cards = await GAS.storage.listProjects();
            for (const c of cards) await GAS.storage.deleteProject(c.id);
            GAS.ui.toast("All saved projects deleted.");
            usage.textContent = "Nothing saved yet.";
          } }, I("trash"), h("span", null, "Delete all saved projects")))),
      actions: [{ label: "Done", kind: "primary" }],
    });
    const est = await GAS.storage.estimate();
    const cards = await GAS.storage.listProjects().catch(() => []);
    usage.textContent = `${cards.length} project${cards.length === 1 ? "" : "s"} saved` + (est && est.usage != null ? ` · using ${GAS.fmtBytes(est.usage)}` + (est.quota ? ` of ${GAS.fmtBytes(est.quota)}` : "") : "");
  }

  /* ---------- help ---------- */
  const SHORTCUTS = [
    [mod + " + Z", "Undo"], [mod + " + Y", "Redo"], [mod + " + S", "Save project"], [mod + " + Shift + S", "Save as"], [mod + " + O", "Open project"],
    ["Space", "Play / pause"], ["N", "New frame"], ["D", "Duplicate frame"], ["← / →", "Previous / next frame"], ["O", "Onion skin on/off"],
    ["P", "Pencil"], ["B", "Brush"], ["E", "Eraser"], ["F", "Fill bucket"], ["I", "Color picker"], ["L", "Line"], ["U", "Shapes"], ["S", "Select"], ["T", "Text"], ["H", "Move view"],
    ["Delete", "Delete the selection"], [mod + " + C / X / V", "Copy / cut / paste the selection"], [mod + " + A", "Select all drawing"], [mod + " + D", "Duplicate the selection"],
    ["[ / ]", "Smaller / bigger brush"], ["+ / − / 0", "Zoom in / out / fit"], ["Alt + click", "Pick a color while drawing"], ["Esc", "Drop the selection or close windows"],
  ];

  const GUIDES = [
    {
      id: "ball", title: "How to animate a bouncing ball", template: "ball",
      art: `<svg viewBox="0 0 220 110"><path d="M10 100 H210" stroke="#57b26a" stroke-width="4"/>${[[20, 20, 1, 1], [55, 42, 0.95, 1.05], [80, 78, 0.85, 1.2], [100, 92, 1.35, 0.65], [120, 78, 0.85, 1.2], [145, 42, 0.95, 1.05], [180, 20, 1, 1]].map(([x, y, sx, sy]) => `<ellipse cx="${x}" cy="${y}" rx="${9 * sx}" ry="${9 * sy}" fill="#ef476f" stroke="#2b2340" stroke-width="2"/>`).join("")}</svg>`,
      steps: [
        "Draw a ball near the top on frame 1.",
        "Press Copy (D) to make the next frame, then move the ball a little lower. Turn on the onion skin to see where it was!",
        "Near the top the ball moves slowly, so keep the steps close together. Near the ground it's fast, so make the steps bigger.",
        "When it hits the ground, squash it flat and wide. While it falls fast, stretch it tall and thin.",
        "Go back up the same way, then press Play!",
      ],
    },
    {
      id: "walk", title: "How to make a character walk", template: "walk",
      art: `<svg viewBox="0 0 220 110" fill="none" stroke="#2b2340" stroke-width="4" stroke-linecap="round">${[30, 80, 130, 180].map((x, i) => `<circle cx="${x}" cy="${20 - (i % 2) * 4}" r="9" fill="#fff"/><path d="M${x} ${29 - (i % 2) * 4} V${62 - (i % 2) * 4}"/>${i % 2 ? `<path d="M${x} 58 l-3 20 l3 20 M${x} 58 l4 18 l-2 22"/>` : `<path d="M${x} 62 l-16 38 M${x} 62 l16 38"/>`}`).join("")}</svg>`,
      steps: [
        "Frame 1: legs wide apart, one foot in front (the “contact” pose).",
        "Frame 2: legs come together and cross, and the body bobs up a little (the “passing” pose).",
        "Frame 3: legs apart again, but now the other foot is in front.",
        "Frame 4: passing pose again. Arms always swing the opposite way to the legs!",
        "Repeat these 4 poses and slide the character forward a bit each frame.",
      ],
    },
    {
      id: "jump", title: "How to make something jump", template: "frog",
      art: `<svg viewBox="0 0 220 110"><path d="M10 100 H210" stroke="#57b26a" stroke-width="4"/><path d="M30 92 Q110 -10 190 92" stroke="#c0c7d6" stroke-width="2" stroke-dasharray="5 5" fill="none"/>${[[30, 92, 1.3, 0.6], [55, 60, 0.8, 1.25], [110, 22, 1, 1], [165, 60, 0.85, 1.2], [190, 92, 1.35, 0.6]].map(([x, y, sx, sy]) => `<ellipse cx="${x}" cy="${y - 8 * sy}" rx="${12 * sx}" ry="${10 * sy}" fill="#70e000" stroke="#2b2340" stroke-width="2"/>`).join("")}</svg>`,
      steps: [
        "Start with a crouch: squash down before the jump. Animators call this “anticipation”.",
        "Launch: stretch tall as it leaves the ground.",
        "Follow a curved path through the air, slower at the very top.",
        "Land with a big squash, then pop back to normal.",
        "Add a Jump sound to the launch frame for extra fun!",
      ],
    },
    {
      id: "loop", title: "How to make a looping animation", template: "eyes",
      art: `<svg viewBox="0 0 220 110" fill="none" stroke-width="4" stroke-linecap="round"><path d="M60 55 a50 35 0 1 0 100 0 a50 35 0 1 0 -100 0" stroke="#9b5de5" stroke-dasharray="8 6"/><path d="m150 30 12 0 -4 12" stroke="#9b5de5"/>${[[60, 55], [110, 20], [160, 55], [110, 90]].map(([x, y], i) => `<rect x="${x - 14}" y="${y - 11}" width="28" height="22" rx="4" fill="#fff" stroke="#2b2340" stroke-width="2"/><text x="${x}" y="${y + 5}" font-size="13" text-anchor="middle" fill="#2b2340" stroke="none" font-family="sans-serif" font-weight="bold">${i + 1}</text>`).join("")}</svg>`,
      steps: [
        "A loop plays forever without a jump, so the last frame must lead smoothly back into the first one.",
        "Tip: make the last frame almost like frame 1, but not exactly the same (or it will look like it pauses).",
        "Turn on Loop (the circle arrows) and the onion skin while you check it.",
        "Use frame timing (×2, ×3) to hold a pose, like a blink, without drawing extra frames.",
        "Export as a GIF with “Loop forever” and it will play again and again!",
      ],
    },
  ];

  function helpDialog(startTab = "start") {
    const tabs = [
      { id: "start", label: "Get started", icon: "sparkle" },
      { id: "guides", label: "Animation tips", icon: "book" },
      { id: "keys", label: "Shortcuts", icon: "keyboard" },
      { id: "about", label: "About", icon: "help" },
    ];
    const body = h("div", { class: "help-body" });
    const tabRow = h("div", { class: "help-tabs" });
    const show = (id) => {
      tabRow.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.dataset.id === id));
      body.innerHTML = "";
      if (id === "start") {
        body.append(
          h("ol", { class: "steps-list" },
            h("li", null, h("b", null, "Draw something."), " Pick the pencil or brush and doodle on the canvas."),
            h("li", null, h("b", null, "Add another frame."), " Press ", h("b", null, "Copy"), " at the bottom to make a new frame with your drawing in it."),
            h("li", null, h("b", null, "Change your drawing slightly."), " Move or redraw part of it. The faint ghost (onion skin) shows the last frame."),
            h("li", null, h("b", null, "Press Play."), " The ▶ button is at the bottom."),
            h("li", null, h("b", null, "Watch your drawing move!"), " Add more frames to make it longer.")),
          h("div", { class: "btn-row" },
            h("button", { class: "btn btn-primary", type: "button", onclick: () => { m.close(); startTutorial(); } }, I("sparkle"), h("span", null, "Show me how")),
            h("button", { class: "btn", type: "button", onclick: () => { m.close(); templatesDialog(); } }, I("template"), h("span", null, "Open an example"))),
          h("p", { class: "hint" }, "Made a mistake? Undo is always there (", mod, " + Z). You can't break anything!"));
      } else if (id === "guides") {
        for (const g of GUIDES) {
          body.appendChild(h("details", { class: "guide", open: g.id === "ball" },
            h("summary", null, g.title),
            h("div", { class: "guide-inner" },
              h("div", { class: "guide-art", html: g.art }),
              h("ol", { class: "steps-list" }, g.steps.map((s) => h("li", null, s))),
              h("button", { class: "btn", type: "button", onclick: async () => {
                m.close();
                const p = GAS.templates.build(g.template);
                await GAS.app.loadProject(p, { dirty: true });
                closeWelcome();
                GAS.ui.toast("Here's an example. Step through the frames with ← and → to see how it works!", { duration: 5000 });
              } }, I("play"), h("span", null, "Open the example")))));
        }
      } else if (id === "keys") {
        body.appendChild(h("table", { class: "keys-table" }, h("tbody", null, SHORTCUTS.map(([k, v]) => h("tr", null, h("td", null, h("kbd", null, k)), h("td", null, v))))));
        body.appendChild(h("p", { class: "hint" }, "Shortcuts don't work while you're typing in a text box."));
      } else {
        body.append(
          h("p", null, h("b", null, "Gaby's Animation Studio"), " lets you make cartoons frame by frame, right in your browser."),
          h("ul", { class: "about-list" },
            h("li", null, "🔒 No accounts, no ads and no tracking."),
            h("li", null, "💾 Your projects are saved on this device only. Nothing is uploaded."),
            h("li", null, "📤 Export makes a file on your computer. You decide who sees it."),
            h("li", null, "🎨 All stickers, effects and sounds were made just for this app.")),
          h("p", { class: "hint" }, "Fonts: Fredoka, Bangers, Pacifico and Patrick Hand (SIL Open Font License) and Permanent Marker (Apache License 2.0)."));
      }
    };
    tabs.forEach((t) => {
      const b = h("button", { class: "help-tab", type: "button", dataset: { id: t.id } }, I(t.icon), h("span", null, t.label));
      b.addEventListener("click", () => show(t.id));
      tabRow.appendChild(b);
    });
    const m = GAS.ui.modal({ title: "Help", icon: "help", wide: true, body: h("div", null, tabRow, body), actions: [{ label: "Got it!", kind: "primary" }] });
    show(startTab);
  }

  /* ---------- tutorial ---------- */
  let tut = null;
  function maybeTutorial() {
    if (!GAS.prefs.get("tutorialDone", false)) setTimeout(startTutorial, 400);
  }
  function startTutorial() {
    endTutorial(true);
    closeWelcome();
    const steps = [
      { target: () => GAS.view.stage, title: "1. Draw something!", text: "Pick the pencil and doodle anything you like: a ball, a face, a cat… Draw right on the white canvas.", on: "frame-changed", before: () => GAS.tools.set("pencil") },
      { target: () => document.querySelector(".tl-btn.is-dup"), title: "2. Add another frame", text: "Press Copy to make frame 2 with a copy of your drawing.", on: "frames-changed", check: () => state.project.frames.length > 1 },
      { target: () => GAS.view.stage, title: "3. Change it a little", text: "Erase part of your drawing and draw it slightly moved. The pink ghost is frame 1 (that's the onion skin!).", on: "frame-changed", before: () => { GAS.onion.toggle(true); } },
      { target: () => document.querySelector(".tl-btn.is-play"), title: "4. Press Play!", text: "Press the big play button to see your frames flip.", on: "play-state", check: () => state.playing },
      { target: () => GAS.view.stage, title: "5. Watch it move! 🎉", text: "That's animation! Add more frames to make it longer, then press Export to share it.", final: true },
    ];
    const spot = h("div", { class: "tut-spot" });
    const bubble = h("div", { class: "tut-bubble", role: "dialog", "aria-live": "polite" });
    document.body.append(spot, bubble);
    tut = { i: 0, steps, spot, bubble, off: null };
    const place = () => {
      if (!tut) return;
      const s = tut.steps[tut.i];
      const el = s.target();
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 6;
      Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
      const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
      let x = r.left + r.width / 2 - bw / 2, y = r.bottom + 14;
      if (r.height > innerHeight * 0.4) { y = r.top + 16; }
      if (y + bh > innerHeight - 8) y = r.top - bh - 14;
      bubble.style.left = clamp(x, 8, innerWidth - bw - 8) + "px";
      bubble.style.top = clamp(y, 8, innerHeight - bh - 8) + "px";
    };
    const show = () => {
      const s = tut.steps[tut.i];
      if (s.before) s.before();
      bubble.innerHTML = "";
      bubble.append(
        h("div", { class: "tut-progress" }, steps.map((_, k) => h("span", { class: k <= tut.i ? "is-done" : "" }))),
        h("h3", null, s.title), h("p", null, s.text),
        h("div", { class: "btn-row" },
          s.final ? null : h("button", { class: "btn btn-ghost small", type: "button", onclick: () => endTutorial() }, "Skip"),
          h("button", { class: "btn btn-primary small", type: "button", onclick: next }, s.final ? "Yay, I did it!" : "Next")));
      requestAnimationFrame(place);
      if (tut.off) tut.off();
      tut.off = s.on ? GAS.bus.on(s.on, () => { if (!s.check || s.check()) setTimeout(next, s.on === "play-state" ? 1200 : 500); }) : null;
      if (s.final) GAS.ui.celebrate();
    };
    const next = () => {
      if (!tut) return;
      if (tut.i >= tut.steps.length - 1) { endTutorial(); return; }
      tut.i++;
      show();
    };
    tut.place = place;
    window.addEventListener("resize", place);
    tut.timer = setInterval(place, 500);
    show();
  }
  function endTutorial(silent) {
    if (!tut) return;
    if (tut.off) tut.off();
    clearInterval(tut.timer);
    window.removeEventListener("resize", tut.place);
    tut.spot.remove();
    tut.bubble.remove();
    tut = null;
    GAS.prefs.set("tutorialDone", true);
    if (!silent) GAS.ui.toast("You can find the tutorial again in Help.");
  }

  /* ---------- theater preview ---------- */
  function theater() {
    const p = state.project;
    if (state.playing) GAS.anim.pause();
    GAS.selection.commitFloat();
    const canvas = h("canvas", { class: "theater-canvas" });
    const maxW = Math.min(innerWidth - 80, 1100), maxH = innerHeight - 240;
    const s = Math.min(maxW / p.width, maxH / p.height, 3);
    canvas.width = Math.round(p.width * s);
    canvas.height = Math.round(p.height * s);
    const label = h("span", { class: "theater-frame" });
    const player = new GAS.anim.Player(canvas, { project: p, speed: p.speed, onFrame: (i) => { label.textContent = `Frame ${i + 1} / ${p.frames.length}`; }, onEnd: () => { playBtn.replaceChildren(I("play")); } });
    const playBtn = h("button", { class: "btn btn-primary", type: "button", onclick: () => {
      if (player.running) { player.stop(); playBtn.replaceChildren(I("play")); }
      else { player.start(player.i >= p.frames.length - 1 && !p.loop ? 0 : player.i); playBtn.replaceChildren(I("pause")); }
    } }, I("pause"));
    const restart = h("button", { class: "btn", type: "button", tip: "From the start", onclick: () => { player.start(0); playBtn.replaceChildren(I("pause")); } }, I("prev"));
    GAS.ui.modal({
      title: p.name, icon: "theater", wide: true, className: "theater",
      body: h("div", { class: "theater-body" }, h("div", { class: "theater-screen" + (p.bgFill.type === "transparent" ? " is-transparent" : "") }, canvas), h("div", { class: "theater-controls" }, restart, playBtn, label)),
      onClose: () => player.stop(),
    });
    player.start(0);
  }

  function init() {
    buildTopbar();
    buildStageUI();
  }

  GAS.screens = { init, showWelcome, closeWelcome, templatesDialog, projectsDialog, newDialog, settingsDialog, helpDialog, canvasSizeDialog, startTutorial, theater, endTutorial };
})();
