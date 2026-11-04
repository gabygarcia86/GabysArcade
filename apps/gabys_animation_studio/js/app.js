/* App core: loading projects, frame operations, canvas size, backgrounds and picture import.
 * Every change here goes through the undo history. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, model, history, Layer, ctxOf, clamp } = GAS;

  /* ---------- projects ---------- */
  async function loadProject(p, opts = {}) {
    if (state.playing) GAS.anim.pause();
    GAS.tools.cancel();
    state.float = null;
    state.selection = null;
    history.clear();
    GAS.audio.forgetAssets();
    GAS.projects.forgetFileHandle();
    state.project = p;
    state.cur = 0;
    state.activeLayer = "draw";
    GAS.view.setup(p);
    GAS.view.refreshAll();
    GAS.bus.emit("project-loaded", p);
    GAS.bus.emit("selection-changed", null);
    await GAS.render.whenReady(p);
    GAS.view.refreshAll();
    GAS.bus.emit("frames-changed");
    if (opts.dirty) GAS.bus.emit("dirty");
    else GAS.projects.clearDirty();
    GAS.storage.setMeta("lastProjectId", p.id).catch(() => {});
  }

  function newProject(opts = {}) {
    const p = model.newProject(opts);
    return loadProject(p, { dirty: false });
  }

  /* ---------- frames ---------- */
  function goToFrame(i) {
    const p = state.project;
    if (!p) return;
    GAS.selection.commitFloat();
    GAS.selection.flushEdit();
    i = clamp(i, 0, p.frames.length - 1);
    const changed = i !== state.cur;
    state.cur = i;
    if (changed && state.selection) { state.selection = null; GAS.bus.emit("selection-changed", null); }
    GAS.view.refreshAll();
    GAS.bus.emit("frame-selected", i);
  }

  function structural(label, fn) {
    if (state.playing) GAS.anim.pause();
    GAS.selection.commitFloat();
    GAS.selection.flushEdit();
    const before = state.project.frames.slice();
    const beforeCur = state.cur;
    fn(state.project.frames);
    history.pushFrames(before, beforeCur, label);
    state.selection = null;
    GAS.view.refreshAll();
    GAS.bus.emit("frames-changed");
    GAS.bus.emit("frame-selected", state.cur);
    GAS.bus.emit("selection-changed", null);
  }

  function addFrame(mode = "blank") {
    const p = state.project;
    structural(mode === "copy" ? "Copy frame" : "New frame", (frames) => {
      const f = mode === "copy" ? model.cloneFrame(p, frames[state.cur]) : model.newFrame(p);
      frames.splice(state.cur + 1, 0, f);
      state.cur++;
    });
    GAS.ui.pulseFrame && GAS.ui.pulseFrame(state.cur);
    sizeWarnings();
  }
  const duplicateFrame = () => addFrame("copy");

  async function deleteFrame(i = state.cur) {
    const p = state.project;
    if (p.frames.length <= 1) {
      const ok = await GAS.ui.confirm({ title: "This is your only frame", text: "An animation needs at least one frame. Do you want to clear this one instead?", ok: "Clear it", icon: "clear" });
      if (ok) clearFrame();
      return;
    }
    structural("Delete frame", (frames) => {
      frames.splice(i, 1);
      state.cur = clamp(i >= frames.length ? frames.length - 1 : i, 0, frames.length - 1);
    });
    GAS.ui.toast("Frame deleted. Oops? Press Undo to bring it back.");
  }

  function moveFrame(from, to) {
    const p = state.project;
    to = clamp(to, 0, p.frames.length - 1);
    if (from === to) return;
    structural("Move frame", (frames) => {
      const [f] = frames.splice(from, 1);
      frames.splice(to, 0, f);
      state.cur = to;
    });
  }

  let frameClipboard = null;
  function copyFrame() {
    const p = state.project;
    GAS.selection.commitFloat();
    frameClipboard = model.cloneFrame(p, GAS.curFrame());
    GAS.ui.toast("Frame copied! Use Paste Frame to add it somewhere.");
    GAS.bus.emit("frame-clipboard", true);
  }
  function pasteFrame() {
    if (!frameClipboard) { GAS.ui.toast("Copy a frame first, then paste it."); return; }
    const p = state.project;
    if (frameClipboard.draw.canvas.width !== p.width || frameClipboard.draw.canvas.height !== p.height) {
      GAS.ui.toast("That frame was a different size, so it can't be pasted here.");
      return;
    }
    structural("Paste frame", (frames) => {
      frames.splice(state.cur + 1, 0, model.cloneFrame(p, frameClipboard));
      state.cur++;
    });
    sizeWarnings();
  }

  function clearFrame() {
    const f = GAS.curFrame();
    GAS.selection.deselect();
    const full = { x: 0, y: 0, w: f.draw.canvas.width, h: f.draw.canvas.height };
    const before = history.captureRaster(f.draw, full);
    const beforeObjs = history.cloneObjs(f.objects);
    const wasEmpty = f.draw.empty;
    Layer.clear(f.draw);
    const after = ctxOf(f.draw.canvas).getImageData(0, 0, full.w, full.h);
    f.objects = [];
    delete f.draw._wasEmpty;
    history.pushChange("Clear frame", () => {
      ctxOf(f.draw.canvas).putImageData(before, 0, 0);
      f.draw.v++;
      f.draw.empty = wasEmpty;
      f.objects = history.cloneObjs(beforeObjs);
    }, () => {
      ctxOf(f.draw.canvas).putImageData(after, 0, 0);
      Layer.clear(f.draw);
      f.objects = [];
    }, f.id, { bytes: before.data.length * 2 });
    GAS.view.refreshAll();
    GAS.touchFrame(f);
  }

  function setHold(frame, n) {
    n = clamp(Math.round(n), 1, 12);
    const old = frame.hold || 1;
    if (old === n) return;
    frame.hold = n;
    history.pushChange("Frame timing", () => { frame.hold = old; }, () => { frame.hold = n; }, frame.id);
    GAS.touchFrame(frame);
  }

  function setSound(frame, sound) {
    const old = frame.sound ? { ...frame.sound } : null;
    frame.sound = sound ? { ...sound } : null;
    const now = frame.sound ? { ...frame.sound } : null;
    history.pushChange(sound ? "Add sound" : "Remove sound", () => { frame.sound = old && { ...old }; }, () => { frame.sound = now && { ...now }; }, frame.id);
    GAS.touchFrame(frame);
    GAS.bus.emit("sound-changed", frame);
  }

  let warned = {};
  function sizeWarnings() {
    const p = state.project;
    const bytes = model.estimateBytes(p);
    if (p.frames.length >= 150 && !warned.frames) {
      warned.frames = true;
      GAS.ui.toast("Wow, " + p.frames.length + " frames! Big projects can get slow. Saving often is a good idea.", { kind: "warn", duration: 6000 });
    } else if (bytes > 700 * 1024 * 1024 && !warned.bytes) {
      warned.bytes = true;
      GAS.ui.toast("This project is getting really big for your browser. Try a smaller canvas or fewer frames.", { kind: "warn", duration: 7000 });
    }
  }

  /* ---------- canvas size ---------- */
  function resizeCanvas(w, hgt, mode = "center") {
    const p = state.project;
    w = clamp(Math.round(w), 16, 4096);
    hgt = clamp(Math.round(hgt), 16, 4096);
    if (w === p.width && hgt === p.height) return;
    GAS.selection.deselect();
    const ow = p.width, oh = p.height;
    const sx = w / ow, sy = hgt / oh;
    const dx = (w - ow) / 2, dy = (hgt - oh) / 2;
    const remap = (layer) => {
      const n = Layer.create(w, hgt);
      if (!layer.empty) {
        const c = ctxOf(n.canvas);
        c.imageSmoothingQuality = "high";
        if (mode === "stretch") c.drawImage(layer.canvas, 0, 0, w, hgt);
        else c.drawImage(layer.canvas, Math.round(dx), Math.round(dy));
        n.empty = false;
      }
      return n;
    };
    const old = { bg: p.bgLayer, frames: p.frames.map((f) => ({ f, draw: f.draw, bgLayer: f.bgLayer, objects: history.cloneObjs(f.objects) })) };
    const neu = {
      bg: remap(p.bgLayer),
      frames: p.frames.map((f) => ({
        f, draw: remap(f.draw), bgLayer: f.bgLayer ? remap(f.bgLayer) : null,
        objects: f.objects.map((o) => {
          if (mode !== "stretch") return { ...o, x: o.x + dx, y: o.y + dy };
          const n = { ...o, x: o.x * sx, y: o.y * sy, w: o.w * sx, h: o.h * sy };
          if (o.type === "text") { n.size = o.size * Math.min(sx, sy); GAS.render.fitText(n); }
          return n;
        }),
      })),
    };
    const apply = (s, W, Hh) => {
      p.width = W; p.height = Hh;
      p.bgLayer = s.bg;
      for (const e of s.frames) { e.f.draw = e.draw; e.f.bgLayer = e.bgLayer; e.f.objects = history.cloneObjs(e.objects); e.f.rev++; }
      GAS.view.setup(p);
      GAS.view.refreshAll();
      GAS.bus.emit("canvas-resized");
      GAS.bus.emit("frames-changed");
    };
    apply(neu, w, hgt);
    history.pushChange("Canvas size", () => apply(old, ow, oh), () => apply(neu, w, hgt), null, { bytes: 4 * w * hgt * (p.frames.length + 1), structural: true });
    sizeWarnings();
  }

  /* ---------- backgrounds ---------- */
  function setBackground(fill, scope = "all") {
    const p = state.project, f = GAS.curFrame();
    fill = { ...fill };
    if (scope === "frame") {
      const old = f.bgFill;
      f.bgFill = fill;
      history.pushChange("Background", () => { f.bgFill = old; }, () => { f.bgFill = fill; }, f.id);
      GAS.touchFrame(f);
    } else {
      const old = p.bgFill;
      const overrides = p.frames.map((fr) => [fr, fr.bgFill]);
      const apply = (v, keepOverrides) => {
        p.bgFill = v;
        for (const [fr, o] of overrides) { fr.bgFill = keepOverrides ? o : null; fr.rev++; }
      };
      apply(fill, false);
      history.pushChange("Background", () => apply(old, true), () => apply(fill, false), null);
      GAS.bus.emit("frames-changed");
      GAS.bus.emit("dirty");
    }
    GAS.view.refreshBgFill();
    GAS.view.refreshOnion();
    GAS.bus.emit("background-changed");
  }

  /* Give this frame its own background painting (copied from the shared one), or go back to shared. */
  function setOwnBgLayer(on) {
    const p = state.project, f = GAS.curFrame();
    if (!!f.bgLayer === on) return;
    const old = f.bgLayer;
    const neu = on ? Layer.copy(p.bgLayer) : null;
    f.bgLayer = neu;
    history.pushChange(on ? "Own background" : "Shared background", () => { f.bgLayer = old; }, () => { f.bgLayer = neu; }, f.id);
    GAS.view.refreshAll();
    GAS.touchFrame(f);
    GAS.bus.emit("background-changed");
  }

  function clearBgLayer() {
    const { layer, frameId } = (() => {
      const f = GAS.curFrame();
      return f.bgLayer ? { layer: f.bgLayer, frameId: f.id } : { layer: state.project.bgLayer, frameId: null };
    })();
    if (layer.empty) { GAS.ui.toast("The background painting is already empty."); return; }
    const full = { x: 0, y: 0, w: layer.canvas.width, h: layer.canvas.height };
    const before = history.captureRaster(layer, full);
    ctxOf(layer.canvas).clearRect(0, 0, full.w, full.h);
    layer.v++;
    history.pushRaster(layer, full, before, frameId, "Clear background");
    layer.empty = true;
    GAS.view.refreshLayer("bg");
    GAS.tools.afterLayerChange(frameId);
  }

  function setActiveLayer(kind) {
    if (state.activeLayer === kind) return;
    GAS.selection.commitFloat();
    state.activeLayer = kind;
    GAS.view.updateLayerFocus();
    GAS.bus.emit("layer-changed", kind);
    GAS.ui.toast(kind === "bg" ? "Now painting the background 🏞️ (behind everything)" : "Now drawing on top ✏️");
  }

  /* ---------- pictures ---------- */
  async function readImageFile(file) {
    if (!/^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(file.type) && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      GAS.ui.toast("Please pick a picture file (PNG, JPG or WebP).");
      return null;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await GAS.loadImage(url);
      const max = 2048;
      let w = img.naturalWidth, hgt = img.naturalHeight;
      if (!w || !hgt) throw new Error("empty");
      const k = Math.min(1, max / Math.max(w, hgt));
      w = Math.round(w * k); hgt = Math.round(hgt * k);
      const c = GAS.makeCanvas(w, hgt);
      ctxOf(c).drawImage(img, 0, 0, w, hgt);
      const jpeg = /jpe?g/i.test(file.type);
      const dataURL = c.toDataURL(jpeg ? "image/jpeg" : "image/png", 0.9);
      const finalImg = await GAS.loadImage(dataURL);
      const id = GAS.uid("img");
      state.project.assets.images[id] = { dataURL, img: finalImg };
      return { id, w, h: hgt };
    } catch {
      GAS.ui.toast("Sorry, that picture couldn't be opened.");
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function importImage(file) {
    const a = await readImageFile(file);
    if (!a) return;
    const p = state.project;
    const k = Math.min(1, (p.width * 0.6) / a.w, (p.height * 0.6) / a.h);
    const o = model.baseObject("image", { assetId: a.id, x: p.width / 2, y: p.height / 2, w: a.w * k, h: a.h * k });
    GAS.selection.addObject(o, "Add picture");
    GAS.ui.toast("Picture added! Drag the corners to resize it.");
  }

  async function importBackgroundImage(file, scope) {
    const a = await readImageFile(file);
    if (!a) return;
    setBackground({ type: "image", imageId: a.id, fit: "cover", color: "#ffffff" }, scope);
  }

  /* ---------- after undo/redo ---------- */
  GAS.bus.on("history-applied", ({ entry, dir }) => {
    const p = state.project;
    if (!p) return;
    state.cur = clamp(state.cur, 0, p.frames.length - 1);
    if (state.selection && state.selection.kind === "object" && !GAS.selection.selectedObject()) state.selection = null;
    if (entry.frameId) {
      const i = GAS.frameIndex(entry.frameId);
      if (i >= 0) {
        p.frames[i].rev++;
        if (i !== state.cur) {
          state.cur = i;
          state.selection = null;
          GAS.bus.emit("frame-selected", i);
        }
      }
    } else {
      for (const f of p.frames) f.rev++;
    }
    GAS.view.refreshAll();
    GAS.bus.emit("frames-changed");
    GAS.bus.emit("selection-changed", state.selection);
    GAS.bus.emit("background-changed");
    GAS.ui.toast((entry.label || "Change") + " " + (dir === "undo" ? "undone" : "redone"), { quick: true });
  });

  GAS.bus.on("assets-loaded", () => { if (state.project) { GAS.view.refreshObjects(); GAS.view.refreshOnion(); GAS.bus.emit("frames-changed"); } });

  /* ---------- drag & drop files onto the app ---------- */
  function setupDrop() {
    window.addEventListener("dragover", (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) { e.preventDefault(); document.body.classList.add("is-dropping"); }
    });
    window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("is-dropping"); });
    window.addEventListener("drop", async (e) => {
      document.body.classList.remove("is-dropping");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      e.preventDefault();
      if (/\.(gabyanim|json)$/i.test(file.name)) { GAS.screens.closeWelcome(); await GAS.projects.openFile(file); return; }
      if (!state.project) return;
      if (/^image\//.test(file.type)) await importImage(file);
      else if (/^audio\//.test(file.type)) {
        const ref = await GAS.audio.importFile(file);
        if (ref) { setSound(GAS.curFrame(), { ref, volume: 1 }); GAS.ui.toast("Sound added to frame " + (state.cur + 1) + "!"); }
      }
    });
  }

  /* ---------- start ---------- */
  async function start() {
    GAS.view.init(document.getElementById("stage"));
    GAS.ui.init();
    GAS.panels.init();
    GAS.timeline.init(document.getElementById("timeline"));
    GAS.screens.init();
    GAS.keys.init();
    setupDrop();
    GAS.stickers.preloadAll();
    GAS.storage.persist();

    // A blank project sits behind the welcome screen so the editor is always ready.
    await newProject({});
    GAS.tools.set("pencil");
    GAS.screens.showWelcome();
  }

  GAS.app = {
    start, loadProject, newProject, goToFrame, addFrame, duplicateFrame, deleteFrame, moveFrame,
    copyFrame, pasteFrame, clearFrame, setHold, setSound, resizeCanvas,
    setBackground, setOwnBgLayer, clearBgLayer, setActiveLayer, importImage, importBackgroundImage,
    get hasFrameClipboard() { return !!frameClipboard; },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
