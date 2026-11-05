/* App shell: layout (resizable / collapsible panels, editor tabs, mobile views), shortcuts, frame loop, startup. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, $, $$, bus, store, clamp, isTyping } = GBL;
  const M = GBL.model;
  const S = M.state;

  /* ---------- layout ---------- */
  const L = Object.assign({ browserW: 270, inspW: 300, rackH: 300, collapsed: { browser: false, inspector: false, rack: false }, editor: "playlist", mobileView: "rack" }, store.get("layout", {}));
  L.collapsed = Object.assign({ browser: false, inspector: false, rack: false }, L.collapsed);
  const saveL = () => store.set("layout", L);
  const app = () => $("#app");
  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

  const layout = {
    focusArea: "rack",
    apply() {
      const a = app();
      a.style.setProperty("--browser-w", L.browserW + "px");
      a.style.setProperty("--insp-w", L.inspW + "px");
      a.style.setProperty("--rack-h", L.rackH + "px");
      for (const k of ["browser", "inspector", "rack"]) a.classList.toggle(k + "-collapsed", !!L.collapsed[k]);
      $$(".editor-tabs .tab").forEach((t) => { const on = t.dataset.view === L.editor; t.classList.toggle("on", on); t.setAttribute("aria-selected", String(on)); });
      $$("#editor .view").forEach((v) => (v.hidden = v.id !== L.editor));
      a.dataset.mview = L.mobileView;
      $$(".mobile-nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === L.mobileView));
      requestAnimationFrame(() => { GBL.pianoRoll.resize(); GBL.playlist.resize(); });
    },
    toggle(name) { L.collapsed[name] = !L.collapsed[name]; saveL(); this.apply(); },
    reveal(name) {
      if (isMobile()) { L.mobileView = name; saveL(); this.apply(); return; }
      if (L.collapsed[name]) { L.collapsed[name] = false; saveL(); this.apply(); }
    },
    showEditor(view) {
      L.editor = view;
      if (isMobile()) L.mobileView = view;
      saveL();
      this.apply();
      this.focus(view);
    },
    focus(area) { this.focusArea = area; },
    reset() { L.browserW = 270; L.inspW = 300; L.rackH = 300; L.collapsed = { browser: false, inspector: false, rack: false }; saveL(); this.apply(); },
    get editor() { return L.editor; },
  };
  GBL.layout = layout;

  function setupResizers() {
    for (const r of $$(".resizer")) {
      r.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const which = r.dataset.resize;
        const start = { browserW: L.browserW, inspW: L.inspW, rackH: L.rackH };
        r.classList.add("active");
        GBL.drag(e, (dx, dy) => {
          if (which === "browser") L.browserW = clamp(start.browserW + dx, 180, 520);
          else if (which === "inspector") L.inspW = clamp(start.inspW - dx, 230, 520);
          else L.rackH = clamp(start.rackH + dy, 120, window.innerHeight - 240);
          layout.apply();
        }, () => { r.classList.remove("active"); saveL(); });
      });
      r.addEventListener("dblclick", () => { const w = r.dataset.resize; if (w === "rack") layout.toggle("rack"); else layout.toggle(w); });
    }
  }

  function buildShell() {
    const tabs = $(".editor-tabs");
    tabs.addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) layout.showEditor(t.dataset.view); });
    const nav = $(".mobile-nav");
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      L.mobileView = b.dataset.v;
      if (["playlist", "pianoroll", "mixer"].includes(b.dataset.v)) L.editor = b.dataset.v;
      saveL();
      layout.apply();
    });
    setupResizers();
    // whole-window file drops land in the Channel Rack
    window.addEventListener("dragover", (e) => { if (e.dataTransfer && e.dataTransfer.types.includes("Files")) e.preventDefault(); });
    window.addEventListener("drop", (e) => {
      if (e.defaultPrevented || !e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (/\.beatlab$|\.json$/i.test(f.name)) GBL.projects.openFile(f);
      else GBL.recorder.importFiles(e.dataTransfer.files, "channel");
    });
    $("#rack").addEventListener("pointerdown", () => layout.focus("rack"), true);
  }

  /* ---------- beginner mode ---------- */
  function applyBeginner() {
    document.body.classList.toggle("beginner", !!GBL.settings.get("beginner"));
    requestAnimationFrame(() => { GBL.pianoRoll.resize(); GBL.playlist.resize(); });
  }

  /* ---------- keyboard ---------- */
  const NOTE_KEYS = GBL.keyboardUI.KEYMAP;
  const held = new Set();
  function onKeyDown(e) {
    if (isTyping(e)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const fun = GBL.fun.activeKeyboard;
    if (GBL.ui.anyModal() && !fun) return;
    if (k === " " && !ctrl) { e.preventDefault(); GBL.audio.transport.toggle(); return; }
    if (ctrl && !e.altKey) {
      if (k === "z" && !e.shiftKey) { e.preventDefault(); M.history.undo(); return; }
      if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); M.history.redo(); return; }
      if (k === "s") { e.preventDefault(); if (e.shiftKey) GBL.projects.saveAs(); else GBL.projects.save(); return; }
      if (k === "o") { e.preventDefault(); GBL.fun.openDialog(); return; }
    }
    if (e.altKey && !ctrl && /^Digit[1-4]$/.test(e.code)) {
      e.preventDefault();
      const v = ["playlist", "pianoroll", "mixer"][+e.code.slice(5) - 1];
      if (v) layout.showEditor(v); else { layout.reveal("rack"); layout.focus("rack"); }
      return;
    }
    if (fun) {
      if (k === "[" || k === "]") { fun.shift && fun.shift(k === "[" ? -12 : 12); e.preventDefault(); return; }
      if (!ctrl && !e.altKey && !e.repeat && fun.onKey(k, true)) { e.preventDefault(); held.add(k); }
      return;
    }
    // editor shortcuts
    const area = layout.focusArea;
    if (area === "pianoroll" && L.editor === "pianoroll" && GBL.pianoRoll.onKey(e)) { e.preventDefault(); return; }
    if (area === "playlist" && L.editor === "playlist" && GBL.playlist.onKey(e)) { e.preventDefault(); return; }
    if (ctrl || e.altKey) return;
    if (k === "[" || k === "]") { GBL.inspector.shiftOct(k === "[" ? -12 : 12); e.preventDefault(); return; }
    if (k in NOTE_KEYS) {
      e.preventDefault();
      if (e.repeat || held.has(k)) return;
      held.add(k);
      GBL.inspector.kb.keyOn(k, 0.85);
    }
  }
  function onKeyUp(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!held.has(k)) return;
    held.delete(k);
    const fun = GBL.fun.activeKeyboard;
    if (fun) fun.onKey(k, false);
    else GBL.inspector.kb.keyOff(k);
  }
  window.addEventListener("blur", () => { for (const k of held) { if (GBL.fun.activeKeyboard) GBL.fun.activeKeyboard.onKey(k, false); else GBL.inspector.kb.keyOff(k); } held.clear(); });

  /* ---------- frame loop ---------- */
  function loop() {
    requestAnimationFrame(loop);
    if (!S.project) return;
    bus.emit("frame", GBL.audio.transport.position());
  }

  /* ---------- audio unlock & suspension ---------- */
  function setupAudioUnlock() {
    const eng = GBL.audio.engine;
    const banner = $("#sound-banner");
    const unlock = () => { eng.ensure(); };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    bus.on("audio:state", (st) => { banner.hidden = st === "running" || !GBL.audio.transport.playing; });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && eng.ctx && eng.ctx.state !== "running") { const pr = eng.ctx.resume(); if (pr && pr.catch) pr.catch(() => (banner.hidden = false)); } });
    banner.addEventListener("click", () => { eng.ensure(); banner.hidden = true; });
  }

  /* ---------- feature checks ---------- */
  function checkFeatures() {
    const problems = [];
    if (!GBL.audio.engine.supported) problems.push("This browser doesn't support Web Audio, so Beat Lab can't make sound. Please use a recent Chrome, Edge, Firefox or Safari.");
    if (!GBL.audio.OAC) problems.push("Exporting songs needs OfflineAudioContext, which this browser is missing.");
    if (!window.indexedDB) problems.push("Saving inside the browser isn't available (private mode?). You can still download .beatlab files.");
    return problems;
  }

  /* ---------- startup ---------- */
  async function start() {
    GBL.ui.mount();
    const splash = $("#splash");
    const bar = $("#splash .progress-fill");
    const problems = checkFeatures();
    if (!GBL.audio.engine.supported) {
      splash.querySelector(".splash-msg").textContent = problems[0];
      return;
    }
    // render the starter drum kit first so the first beat plays instantly
    const core = ["kick", "snare", "clap", "hat_closed", "hat_open", "cymbal", "tom", "perc"];
    await GBL.samples.renderAll(core, (f) => { bar.style.width = f * 60 + "%"; });
    await GBL.projects.startup().catch((e) => { console.error(e); return GBL.projects.loadProjectObject(M.createProject(), {}); });
    bar.style.width = "100%";
    // build the studio
    GBL.toolbar.build($("#toolbar"));
    GBL.browser.build($("#browser"));
    GBL.rack.build($("#rack"));
    GBL.pianoRoll.build($("#pianoroll"));
    GBL.playlist.build($("#playlist"));
    GBL.mixerUI.build($("#mixer"));
    GBL.inspector.build($("#inspector"));
    buildShell();
    if (window.innerWidth < 1100 && !store.get("layout", null)) { L.collapsed.browser = true; }
    layout.apply();
    applyBeginner();
    bus.on("settings", (k) => { if (k === "beginner") applyBeginner(); });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", () => layout.apply());
    setupAudioUnlock();
    bus.on("project:loaded", () => { GBL.toolbar.update(); });
    bus.on("saved", () => GBL.toolbar.update());
    bus.on("dirty", () => GBL.toolbar.update());
    splash.classList.add("done");
    setTimeout(() => splash.remove(), 400);
    requestAnimationFrame(loop);
    for (const p of problems) GBL.ui.toast("⚠️ " + p, 6000);
    if (GBL.settings.get("beginner") && !store.get("guideHidden", false)) GBL.fun.guide(true);
    if (!store.get("welcomed", false)) { store.set("welcomed", true); GBL.fun.welcome(); }
    // render the rest of the library in the background
    GBL.samples.renderAll(null).then(() => bus.emit("samples:ready"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
