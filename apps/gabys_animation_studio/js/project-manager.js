/* Saving and loading.
 * - .gabyanim files: JSON with every layer embedded as a base64 PNG, plus imported images and
 *   sounds, so one file holds the whole project.
 * - Autosave: the open project is saved to IndexedDB a moment after every change. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, Layer, model, ctxOf } = GAS;

  const FORMAT = "gabyanim";
  const FORMAT_VERSION = 1;
  const MAX_SIDE = 4096;

  /* ---------- serialize ---------- */
  const blobCache = new WeakMap(); // layer -> {v, blob}
  async function layerBlob(layer) {
    if (!layer || layer.empty) return null;
    const c = blobCache.get(layer);
    if (c && c.v === layer.v) return c.blob;
    const v = layer.v;
    const blob = await GAS.canvasToBlob(layer.canvas, "image/png");
    blobCache.set(layer, { v, blob });
    return blob;
  }

  async function serialize(p, asDataURL) {
    const enc = async (layer) => {
      const b = await layerBlob(layer);
      if (!b) return null;
      return asDataURL ? GAS.blobToDataURL(b) : b;
    };
    const frames = [];
    for (const f of p.frames) {
      frames.push({
        id: f.id,
        hold: f.hold || 1,
        bgFill: f.bgFill ? { ...f.bgFill } : null,
        hasOwnBackground: !!f.bgLayer,
        layers: { drawing: await enc(f.draw), background: f.bgLayer ? await enc(f.bgLayer) : null },
        objects: f.objects.map((o) => ({ ...o })),
        sound: f.sound ? { ...f.sound } : null,
      });
    }
    const images = {};
    for (const [id, a] of Object.entries(p.assets.images)) images[id] = a.dataURL;
    const audio = {};
    for (const [id, a] of Object.entries(p.assets.audio)) audio[id] = { name: a.name, dataURL: a.dataURL };
    return {
      format: FORMAT,
      version: FORMAT_VERSION,
      app: "Gaby's Animation Studio",
      id: p.id,
      name: p.name,
      width: p.width,
      height: p.height,
      fps: p.fps,
      loop: p.loop,
      speed: p.speed,
      onion: { ...p.onion },
      createdAt: p.createdAt,
      updatedAt: Date.now(),
      background: { fill: { ...p.bgFill }, layer: await enc(p.bgLayer) },
      frames,
      assets: { images, audio },
    };
  }

  /* ---------- deserialize ---------- */
  async function decodeInto(layer, src) {
    if (!src) return;
    let img, url = null;
    if (src instanceof Blob) {
      if (window.createImageBitmap) img = await createImageBitmap(src);
      else { url = URL.createObjectURL(src); img = await GAS.loadImage(url); }
    } else {
      img = await GAS.loadImage(src);
    }
    ctxOf(layer.canvas).drawImage(img, 0, 0);
    if (url) URL.revokeObjectURL(url);
    if (img.close) img.close();
    layer.empty = false;
    layer.v = 0;
    if (src instanceof Blob) blobCache.set(layer, { v: 0, blob: src });
  }

  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const OBJECT_TYPES = new Set(["sticker", "image", "text", "effect"]);

  function cleanObject(o) {
    if (!o || !OBJECT_TYPES.has(o.type)) return null;
    const c = { ...o };
    c.id = typeof o.id === "string" ? o.id : GAS.uid("o");
    for (const k of ["x", "y", "w", "h", "rot"]) c[k] = num(o[k], k === "w" || k === "h" ? 100 : 0);
    c.opacity = GAS.clamp(num(o.opacity, 1), 0, 1);
    c.flipX = !!o.flipX;
    c.flipY = !!o.flipY;
    if (c.type === "text") {
      c.text = String(o.text ?? "");
      c.size = GAS.clamp(num(o.size, 48), 4, 1000);
    }
    return c;
  }

  async function deserialize(data) {
    if (!data || data.format !== FORMAT || !Array.isArray(data.frames)) throw new Error("This isn't a Gaby's Animation Studio project file.");
    const width = Math.round(num(data.width, 640)), height = Math.round(num(data.height, 480));
    if (width < 16 || height < 16 || width > MAX_SIDE || height > MAX_SIDE) throw new Error("The canvas size in this file isn't supported.");
    const p = model.newProject({ width, height, frames: 0 });
    p.id = typeof data.id === "string" ? data.id : p.id;
    p.name = String(data.name || "My Animation").slice(0, 60);
    p.fps = GAS.clamp(Math.round(num(data.fps, 8)), 1, 60);
    p.loop = data.loop !== false;
    p.speed = GAS.anim.SPEEDS.includes(data.speed) ? data.speed : 1;
    p.onion = { ...model.DEFAULT_ONION, ...(data.onion || {}) };
    p.createdAt = num(data.createdAt, Date.now());
    p.updatedAt = num(data.updatedAt, Date.now());
    if (data.background && data.background.fill) p.bgFill = { ...data.background.fill };

    const assets = data.assets || {};
    for (const [id, dataURL] of Object.entries(assets.images || {})) {
      if (typeof dataURL !== "string" || !dataURL.startsWith("data:image/")) continue;
      try { p.assets.images[id] = { dataURL, img: await GAS.loadImage(dataURL) }; } catch { /* skip broken image */ }
    }
    for (const [id, a] of Object.entries(assets.audio || {})) {
      if (a && typeof a.dataURL === "string" && a.dataURL.startsWith("data:")) p.assets.audio[id] = { name: String(a.name || "My sound"), dataURL: a.dataURL };
    }

    await decodeInto(p.bgLayer, data.background && data.background.layer);
    const frames = [];
    for (const fd of data.frames) {
      const f = model.newFrame(p);
      if (typeof fd.id === "string") f.id = fd.id;
      f.hold = GAS.clamp(Math.round(num(fd.hold, 1)), 1, 24);
      f.bgFill = fd.bgFill || null;
      const layers = fd.layers || {};
      await decodeInto(f.draw, layers.drawing);
      if (fd.hasOwnBackground) {
        f.bgLayer = Layer.create(width, height);
        await decodeInto(f.bgLayer, layers.background);
      }
      f.objects = (fd.objects || []).map(cleanObject).filter(Boolean);
      if (fd.sound && typeof fd.sound.ref === "string") f.sound = { ref: fd.sound.ref, volume: GAS.clamp(num(fd.sound.volume, 1), 0, 1.5) };
      frames.push(f);
    }
    if (!frames.length) frames.push(model.newFrame(p));
    p.frames = frames;
    return p;
  }

  /* ---------- thumbnails ---------- */
  async function thumbBlob(p, frameIndex = 0) {
    const w = 240, hgt = Math.round((240 * p.height) / p.width);
    const c = GAS.makeCanvas(w, hgt);
    const ctx = ctxOf(c);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, hgt);
    GAS.render.renderFrame(ctx, p, p.frames[frameIndex] || p.frames[0], { scale: w / p.width });
    return GAS.canvasToBlob(c, "image/png");
  }

  /* ---------- autosave ---------- */
  let dirty = false, saving = false, timer = 0, lastSaved = 0;
  let enabled = GAS.prefs.get("autosave", true);

  function status(s) {
    GAS.bus.emit("autosave-status", { state: s, time: lastSaved, enabled });
  }
  function markDirty() {
    if (!state.project) return;
    dirty = true;
    if (!enabled) { status("off"); return; }
    status("pending");
    clearTimeout(timer);
    timer = setTimeout(autosaveNow, 1800);
  }

  async function autosaveNow() {
    clearTimeout(timer);
    const p = state.project;
    if (!p || !enabled || !dirty) return;
    if (saving) { timer = setTimeout(autosaveNow, 800); return; }
    saving = true;
    dirty = false;
    status("saving");
    try {
      p.updatedAt = Date.now();
      const record = await serialize(p, false);
      const card = {
        id: p.id, name: p.name, updatedAt: p.updatedAt, width: p.width, height: p.height,
        frames: p.frames.length, thumb: await thumbBlob(p),
      };
      await GAS.storage.saveProject(record, card);
      await GAS.storage.setMeta("lastProjectId", p.id);
      lastSaved = Date.now();
      status("saved");
    } catch (err) {
      console.warn("Autosave failed", err);
      dirty = true;
      status("error");
    } finally {
      saving = false;
      if (dirty && enabled) timer = setTimeout(autosaveNow, 4000);
    }
  }

  function setAutosave(on) {
    enabled = !!on;
    GAS.prefs.set("autosave", enabled);
    if (enabled && dirty) markDirty();
    status(enabled ? (dirty ? "pending" : "saved") : "off");
  }

  async function loadFromStorage(id) {
    const rec = await GAS.storage.loadProject(id);
    if (!rec) throw new Error("Project not found");
    return deserialize(rec);
  }

  /* ---------- files ---------- */
  let fileHandle = null;
  const canPickFiles = () => {
    try { return "showSaveFilePicker" in window && window.self === window.top; } catch { return false; }
  };

  async function saveToFile(saveAs) {
    const p = state.project;
    if (!p) return;
    GAS.selection.commitFloat();
    GAS.selection.flushEdit();
    if (saveAs || !p.savedOnce) {
      const name = await GAS.ui.prompt({
        title: saveAs ? "Save a copy as…" : "Save your animation",
        label: "What's the name of your animation?",
        value: p.name,
        ok: "Save",
        icon: "save",
      });
      if (name == null) return;
      if (name.trim() && name.trim() !== p.name) { p.name = name.trim().slice(0, 60); GAS.bus.emit("project-renamed"); }
    }
    const busy = GAS.ui.busy("Packing up your animation…");
    let blob;
    try {
      const data = await serialize(p, true);
      blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    } catch (err) {
      busy.close();
      GAS.ui.alert({ title: "Oops!", text: "Something went wrong while saving. Your work is still here, try again." });
      return;
    }
    busy.close();
    const fname = GAS.safeFileName(p.name) + ".gabyanim";
    if (canPickFiles()) {
      try {
        if (!fileHandle || saveAs || fileHandle._projectId !== p.id) {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: fname,
            types: [{ description: "Gaby's Animation Studio project", accept: { "application/json": [".gabyanim"] } }],
          });
          fileHandle._projectId = p.id;
        }
        const w = await fileHandle.createWritable();
        await w.write(blob);
        await w.close();
        p.savedOnce = true;
        GAS.ui.toast("Saved! ⭐ " + fileHandle.name);
        GAS.bus.emit("file-saved");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        console.warn("File picker failed, downloading instead", err);
      }
    }
    GAS.downloadBlob(blob, fname);
    p.savedOnce = true;
    GAS.ui.toast("Saved to your Downloads folder! ⭐");
    GAS.bus.emit("file-saved");
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = GAS.h("input", { type: "file", accept, style: { display: "none" } });
      input.addEventListener("change", () => { resolve(input.files[0] || null); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }

  async function openFile(file) {
    let handle = null;
    if (!file) {
      if (canPickFiles() && window.showOpenFilePicker) {
        try {
          [handle] = await window.showOpenFilePicker({
            types: [{ description: "Gaby's Animation Studio project", accept: { "application/json": [".gabyanim", ".json"] } }],
          });
          file = await handle.getFile();
        } catch (err) {
          if (err && err.name === "AbortError") return false;
          file = await pickFile(".gabyanim,.json,application/json");
        }
      } else {
        file = await pickFile(".gabyanim,.json,application/json");
      }
    }
    if (!file) return false;
    const busy = GAS.ui.busy("Opening your animation…");
    try {
      const data = JSON.parse(await file.text());
      const p = await deserialize(data);
      // If this device already has a newer version of the same project, keep both.
      const cards = await GAS.storage.listProjects().catch(() => []);
      const local = cards.find((c) => c.id === p.id);
      if (local && local.updatedAt > p.updatedAt + 1000) { p.id = GAS.uid("p"); p.name = p.name + " (file)"; }
      p.savedOnce = true;
      await GAS.app.loadProject(p);
      if (handle) { fileHandle = handle; fileHandle._projectId = p.id; }
      busy.close();
      GAS.ui.toast("Opened “" + p.name + "”!");
      markDirty();
      return true;
    } catch (err) {
      busy.close();
      console.warn(err);
      GAS.ui.alert({ title: "Hmm, that didn't open", text: err.message && err.message.length < 120 ? err.message : "That file couldn't be opened. Is it a .gabyanim file?" });
      return false;
    }
  }

  function forgetFileHandle() { fileHandle = null; }

  window.addEventListener("beforeunload", (e) => {
    if (dirty && state.project) {
      autosaveNow();
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && dirty) autosaveNow();
  });

  GAS.bus.on("dirty", markDirty);

  GAS.projects = {
    serialize, deserialize, thumbBlob, autosaveNow, setAutosave, loadFromStorage, saveToFile, openFile, pickFile, forgetFileHandle,
    get autosaveEnabled() { return enabled; },
    get lastSaved() { return lastSaved; },
    get isDirty() { return dirty; },
    clearDirty() { dirty = false; clearTimeout(timer); status("saved"); },
  };
})();
