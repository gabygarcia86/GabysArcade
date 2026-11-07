/* App startup, keyboard shortcuts, drag & drop, paste, panel layout and settings. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, prefs, clamp } = CBS;
  const doc = () => CBS.doc;
  const A = () => CBS.actions;

  /* ---------- fonts ---------- */
  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const jobs = [];
    for (const f of CBS.FONTS) {
      if (f.group === "System") continue;
      jobs.push(document.fonts.load(`400 24px "${f.id}"`), document.fonts.load(`700 24px "${f.id}"`));
    }
    jobs.push(document.fonts.load(`italic 400 24px "Comic Neue"`), document.fonts.load(`italic 700 24px "Comic Neue"`));
    await Promise.race([Promise.allSettled(jobs), CBS.wait(4000)]);
    bus.emit("fonts:loaded");
    CBS.editor.requestRender();
  }

  /* ---------- keyboard ---------- */
  const isTyping = (e) => { const t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };
  function onKey(e) {
    if (!doc().project || CBS.reader.isOpen || CBS.tutorial.active) return;
    if (CBS.ui.anyDialogOpen()) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const typing = isTyping(e);
    // shortcuts that work even while typing in a field
    if (mod && !e.altKey && k.toLowerCase() === "s") { e.preventDefault(); if (e.shiftKey) CBS.projects.saveAs(); else CBS.projects.save(); return; }
    if (typing) return;
    const tool = CBS.tools.current;
    if (tool && tool.key && typeof tool.key === "function" && tool.key(e)) { e.preventDefault(); return; }
    const E = CBS.editor;
    if (mod) {
      const lk = k.toLowerCase();
      if (lk === "z" && !e.shiftKey) { e.preventDefault(); CBS.history.undo(); }
      else if ((lk === "z" && e.shiftKey) || lk === "y") { e.preventDefault(); CBS.history.redo(); }
      else if (lk === "c") { if (doc().selection.length) { e.preventDefault(); A().copy(); } }
      else if (lk === "x") { if (doc().selection.length) { e.preventDefault(); A().cut(); } }
      else if (lk === "d") { e.preventDefault(); A().duplicate(); }
      else if (lk === "a") { e.preventDefault(); A().selectAll(); }
      else if (lk === "o") { e.preventDefault(); CBS.projects.myComics(); }
      else if (lk === "e") { e.preventDefault(); CBS.exporter.open(); }
      else if (lk === "n" && e.altKey) { e.preventDefault(); CBS.projects.newComicWizard(); }
      else if (lk === "p" && e.shiftKey) { e.preventDefault(); CBS.reader.open(); }
      else if (k === "=" || k === "+") { e.preventDefault(); E.zoomStep(1); }
      else if (k === "-") { e.preventDefault(); E.zoomStep(-1); }
      else if (k === "0") { e.preventDefault(); E.fit(); }
      else if (k === "1") { e.preventDefault(); E.setZoom(1); }
      else if (k === "'") { e.preventDefault(); prefs.set("grid", !prefs.get("grid", false)); }
      return;
    }
    if (e.altKey) return;
    const sel = doc().selection.length;
    const step = e.shiftKey ? 10 : 1;
    switch (k) {
      case "Delete": case "Backspace": if (sel) { e.preventDefault(); A().del(); } return;
      case "Escape":
        if (E.editPoints) { E.editPoints = null; CBS.props.refresh(); return; }
        if (E.cropMode) { A().toggleCrop(false); return; }
        if (CBS.library.isOpen()) { CBS.library.close(); return; }
        if (CBS.ai.isOpen()) { CBS.ai.close(); return; }
        if (sel) doc().select([]);
        else if (tool.id !== "select") CBS.tools.set("select");
        return;
      case "ArrowLeft": if (sel) { e.preventDefault(); A().nudge(-step, 0); } return;
      case "ArrowRight": if (sel) { e.preventDefault(); A().nudge(step, 0); } return;
      case "ArrowUp": if (sel) { e.preventDefault(); A().nudge(0, -step); } return;
      case "ArrowDown": if (sel) { e.preventDefault(); A().nudge(0, step); } return;
      case "PageUp": e.preventDefault(); doc().gotoIndex(doc().pageIndex - 1); return;
      case "PageDown": e.preventDefault(); doc().gotoIndex(doc().pageIndex + 1); return;
      case "Enter": {
        const o = doc().selected()[0];
        if (o && ["bubble", "text", "sfx"].includes(o.kind)) { e.preventDefault(); E.editText(o); }
        return;
      }
      case "[": case "]": case "{": case "}": {
        const up = k === "]" || k === "}";
        if (tool.id === "draw" || tool.id === "eraser") {
          const brush = tool.id === "eraser" ? "eraser" : CBS.tools.settings.brush;
          const s = CBS.tools.brushParam("size", brush);
          CBS.tools.setBrushParam("size", clamp(Math.round(up ? s * 1.2 + 1 : s / 1.2 - 1), 1, 200), brush);
          CBS.props.refresh();
        } else if (sel) A().arrange(e.shiftKey ? (up ? "front" : "back") : up ? "forward" : "backward");
        return;
      }
      case "?": CBS.toolbar.shortcuts(); return;
      default: break;
    }
    const lk = k.toLowerCase();
    if (lk === "l") { CBS.library.toggle(); return; }
    if (lk === "a") { CBS.ai.toggle(); return; }
    const t = CBS.tools.list.find((x) => x.key && x.key.toLowerCase() === lk);
    if (t) CBS.tools.set(t.id);
  }

  /* ---------- drag & drop / paste ---------- */
  function initDrop() {
    const ws = document.getElementById("workspace");
    ws.addEventListener("dragover", (e) => {
      const types = Array.from(e.dataTransfer.types || []);
      if (types.includes("Files") || types.includes("application/x-cbs-asset")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; ws.classList.add("drop-hover"); }
    });
    ws.addEventListener("dragleave", (e) => { if (e.target === ws || !ws.contains(e.relatedTarget)) ws.classList.remove("drop-hover"); });
    ws.addEventListener("drop", async (e) => {
      ws.classList.remove("drop-hover");
      if (!doc().project) return;
      const pt = CBS.editor.screenToDoc(e.clientX, e.clientY);
      const assetData = e.dataTransfer.getData("application/x-cbs-asset");
      if (assetData) { e.preventDefault(); CBS.library.dropFromData(assetData, pt); return; }
      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;
      e.preventDefault();
      const project = files.find((f) => /\.json$/i.test(f.name));
      if (project) { CBS.projects.importFile(project); return; }
      const imgs = files.filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|svg|gif)$/i.test(f.name));
      if (!imgs.length) { CBS.ui.toast("Drop PNG, JPG, WEBP or SVG pictures, or a .comic.json project file."); return; }
      const assets = await CBS.assets.importFiles(imgs, "misc");
      assets.forEach((a, i) => CBS.assets.placeAsset(a, { at: { x: pt.x + i * 20, y: pt.y + i * 20 } }));
    });
    // stop the browser from opening files dropped outside the workspace
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());
    document.addEventListener("paste", async (e) => {
      if (!doc().project || isTyping(e) || CBS.ui.anyDialogOpen()) return;
      const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter((f) => /^image\//.test(f.type));
      if (files.length) {
        e.preventDefault();
        const named = files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `Pasted image ${i + 1}.png`, { type: f.type })));
        const assets = await CBS.assets.importFiles(named, "misc");
        const sel = doc().selected()[0];
        assets.forEach((a) => CBS.assets.placeAsset(a, { panel: sel && sel.kind === "panel" ? sel : null }));
        return;
      }
      if (A().hasClipboard) { e.preventDefault(); A().paste(); }
    });
  }

  /* ---------- panels: collapse & resize ---------- */
  function togglePanel(which, force) {
    const cls = "hide-" + which;
    const on = force != null ? force : !document.body.classList.contains(cls);
    document.body.classList.toggle(cls, on);
    prefs.set("panel-" + which, on);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 220);
  }
  function initResizers() {
    for (const w of ["left", "right", "bottom"]) if (prefs.get("panel-" + w, false)) document.body.classList.add("hide-" + w);
    const root = document.documentElement;
    const rw = prefs.get("rightWidth", 300), bh = prefs.get("bottomHeight", 176), lh = prefs.get("layersHeight", 260);
    root.style.setProperty("--right-w", rw + "px");
    root.style.setProperty("--bottom-h", bh + "px");
    root.style.setProperty("--layers-h", lh + "px");
    const drag = (el, onMove, onEnd) => {
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add("active");
        const move = (ev) => onMove(ev);
        const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.classList.remove("active"); onEnd(); window.dispatchEvent(new Event("resize")); };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      });
    };
    drag(document.getElementById("resize-right"), (e) => {
      const w = clamp(innerWidth - e.clientX, 240, 520);
      root.style.setProperty("--right-w", w + "px");
    }, () => prefs.set("rightWidth", parseInt(getComputedStyle(root).getPropertyValue("--right-w"), 10)));
    drag(document.getElementById("resize-bottom"), (e) => {
      const hh = clamp(innerHeight - e.clientY, 110, 360);
      root.style.setProperty("--bottom-h", hh + "px");
    }, () => prefs.set("bottomHeight", parseInt(getComputedStyle(root).getPropertyValue("--bottom-h"), 10)));
    drag(document.getElementById("resize-layers"), (e) => {
      const side = document.getElementById("rightbar").getBoundingClientRect();
      const hh = clamp(side.bottom - e.clientY, 120, side.height - 160);
      root.style.setProperty("--layers-h", hh + "px");
    }, () => prefs.set("layersHeight", parseInt(getComputedStyle(root).getPropertyValue("--layers-h"), 10)));
    document.getElementById("toggle-right").addEventListener("click", () => {
      if (innerWidth <= 1024) document.body.classList.toggle("show-right-overlay");
      else togglePanel("right");
    });
    document.getElementById("toggle-left").addEventListener("click", () => togglePanel("left"));
  }

  /* ---------- settings ---------- */
  async function settings(focus) {
    const t = (label, key, def, tip, after) => CBS.ui.toggle(label, prefs.get(key, def), (v) => { prefs.set(key, v); if (after) after(v); CBS.editor.requestRender(); }, { tip });
    const endpoint = h("input", { class: "input", value: prefs.get("aiEndpoint", ""), placeholder: "https://your-proxy.example.com", spellcheck: "false", "aria-label": "AI service address" });
    const aiStatus = h("span", { class: "hint" });
    const test = CBS.ui.button("Test connection", async () => {
      prefs.set("aiEndpoint", endpoint.value.trim());
      aiStatus.textContent = "Checking…";
      const ok = await CBS.ai.service.health();
      aiStatus.textContent = ok ? "🟢 Connected! Switch the assistant to “AI service” to use it." : "🔴 Couldn't reach it. Check the address and that the proxy allows this site.";
    }, { small: true });
    endpoint.addEventListener("change", () => { prefs.set("aiEndpoint", endpoint.value.trim().replace(/\/+$/, "")); CBS.ai.service.status = "unknown"; bus.emit("ai:status"); });
    const storageInfo = h("p", { class: "hint" }, "Checking storage…");
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(async (est) => {
        const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        storageInfo.textContent = `Using ${(est.usage / 1048576).toFixed(1)} MB of about ${(est.quota / 1073741824).toFixed(1)} GB available. ${persisted ? "Protected storage is on." : "The browser may clear storage if your disk gets full."}`;
      });
    } else storageInfo.textContent = "";
    const sec = (id, title, ...kids) => h("section", { class: "set-sec", id: "set-" + id }, h("h3", null, title), ...kids);
    const body = h("div", { class: "settings" },
      sec("general", "General",
        t("Autosave my work", "autosave", true, "Saves to this browser every 30 seconds and when you leave the page"),
        t("Reopen my last comic on start", "reopenLast", true),
        t("Ask before deleting pages and layers", "confirmDelete", true),
        t("Show tooltips", "tooltips", true),
        t("Large buttons (easier to tap)", "bigUI", false, null, (v) => document.body.classList.toggle("big-ui", v))),
      sec("canvas", "Page & guides",
        t("Rulers", "rulers", true, null, () => window.dispatchEvent(new Event("resize"))),
        CBS.ui.field("Ruler units", CBS.ui.select({ in: "Inches", cm: "Centimeters", px: "Page units (100 per inch)" }, prefs.get("rulerUnit", "in"), (v) => { prefs.set("rulerUnit", v); CBS.editor.requestRender(); })),
        t("Grid", "grid", false), t("Snap to grid", "snapGrid", false),
        CBS.ui.slider({ label: "Grid size", min: 5, max: 100, value: prefs.get("gridSize", 25), onInput: (v) => { prefs.set("gridSize", v); CBS.editor.requestRender(); } }),
        t("Smart guides (snap to other objects)", "smartGuides", true), t("Snap to page, margins and guides", "snap", true),
        t("Show page margins", "showMargins", true), t("Show guides", "showGuides", true)),
      sec("drawing", "Drawing",
        CBS.ui.toggle("Use pen pressure", CBS.tools.settings.pressure, (v) => CBS.tools.setSetting("pressure", v), { tip: "Works with drawing tablets and styluses that report pressure" }),
        CBS.ui.toggle("Keep strokes inside panels", CBS.tools.settings.clipPanel, (v) => CBS.tools.setSetting("clipPanel", v))),
      sec("ai", "AI service (optional)",
        h("p", { class: "hint" }, "Comic Book Studio works fully without AI, using its built-in generators. To use an AI model, run the small proxy in the app's server folder. It keeps your API key on the server, never in the browser. Then paste its address here."),
        CBS.ui.field("Proxy address", endpoint), h("div", { class: "btn-row" }, test, aiStatus)),
      sec("data", "Storage",
        storageInfo,
        h("div", { class: "btn-row" },
          navigator.storage && navigator.storage.persist ? CBS.ui.button("Protect my comics from cleanup", async () => { const ok = await navigator.storage.persist(); CBS.ui.toast(ok ? "Storage protected 👍" : "The browser didn't allow it. Export project files as backups.", { kind: ok ? "ok" : "info" }); }, { small: true }) : null,
          CBS.ui.button("Replay the tour", () => { d.close(); CBS.tutorial.start(); }, { small: true }))));
    const d = CBS.ui.dialog({ title: "⚙️ Settings", wide: true, body, buttons: [{ label: "Done", kind: "primary", value: true }] });
    if (focus) requestAnimationFrame(() => { const el = body.querySelector("#set-" + focus); if (el) el.scrollIntoView({ block: "start" }); });
  }

  /* ---------- startup ---------- */
  async function start() {
    CBS.ui.initTooltips();
    if (prefs.get("bigUI", false)) document.body.classList.add("big-ui");
    CBS.tools.init();
    CBS.editor.init();
    CBS.toolbar.init();
    CBS.props.init();
    CBS.layersPanel.init();
    CBS.pagesPanel.init();
    initResizers();
    initDrop();
    document.addEventListener("keydown", onKey);
    CBS.projects.initAutosave();
    const storageOk = await CBS.storage.check();
    await loadFonts();
    document.body.classList.remove("loading");
    if (!storageOk) {
      await CBS.projects.newBlank();
      CBS.ui.toast("This browser is blocking local storage (private mode?). Your comic can't be saved here, so use File › Export project file to keep it.", { kind: "error", ms: 9000 });
      return;
    }
    let opened = false;
    if (prefs.get("reopenLast", true)) {
      const last = await CBS.storage.kvGet("lastProject").catch(() => null);
      if (last) opened = await CBS.projects.open(last);
    }
    if (!opened) CBS.projects.welcome();
  }

  CBS.app = { start, settings, togglePanel };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
