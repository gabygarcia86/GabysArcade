/* ProjectManager: New / Save / Save As / Load / Recent, .beatlab files, autosave and recovery. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { bus, debounce, uid, store } = GBL;
  const M = GBL.model;
  const S = GBL.storage;
  const A = () => GBL.audio;

  const pm = {
    dirty: false,
    fileHandle: null,
    savedOnce: false,
    lastSaved: 0,
  };

  /* ---------- assets ---------- */
  async function addAsset(name, bytes, mime, buffer) {
    const id = uid("aud");
    if (!buffer) buffer = await A().decodeAudio(bytes);
    A().assets.add({ id, name, bytes, mime: mime || "audio/wav", buffer, duration: buffer.duration });
    M.state.project.assets[id] = { name, duration: buffer.duration };
    if (S.available) { try { await S.put("assets", { id, name, bytes, mime: mime || "audio/wav" }); } catch (e) { console.warn("asset save failed", e); } }
    return id;
  }

  async function loadAssets(p) {
    const missing = [];
    for (const id of Object.keys(p.assets || {})) {
      if (A().assets.get(id)) continue;
      let rec = null;
      if (S.available) { try { rec = await S.get("assets", id); } catch (e) { /* */ } }
      if (!rec) { missing.push(p.assets[id].name || id); continue; }
      try {
        const buffer = await A().decodeAudio(rec.bytes);
        A().assets.add({ id, name: rec.name, bytes: rec.bytes, mime: rec.mime, buffer, duration: buffer.duration });
      } catch (e) { missing.push(rec.name); }
    }
    if (missing.length) bus.emit("toast", "Some audio couldn't be found: " + missing.slice(0, 3).join(", "));
  }

  async function prepareProject(p) {
    await loadAssets(p);
    await A().ensureBuffers(p);
  }

  /* ---------- package (.beatlab) ---------- */
  function buildPackage() {
    const p = M.state.project;
    const assets = {};
    for (const id of Object.keys(p.assets)) {
      const a = A().assets.get(id);
      if (a && a.bytes) assets[id] = { name: a.name, mime: a.mime, data: GBL.arrayBufferToBase64(a.bytes) };
    }
    return JSON.stringify({ format: "beatlab", version: M.VERSION, app: "Gaby's Beat Lab", saved: new Date().toISOString(), project: p, assets });
  }

  async function readPackage(text) {
    const data = JSON.parse(text);
    if (!data || data.format !== "beatlab" || !data.project) throw new Error("This isn't a Beat Lab project file.");
    for (const [id, a] of Object.entries(data.assets || {})) {
      const bytes = GBL.base64ToArrayBuffer(a.data);
      try {
        const buffer = await A().decodeAudio(bytes);
        A().assets.add({ id, name: a.name, bytes, mime: a.mime, buffer, duration: buffer.duration });
        if (S.available) await S.put("assets", { id, name: a.name, bytes, mime: a.mime });
      } catch (e) { console.warn("could not decode asset", a.name); }
    }
    return data.project;
  }

  /* ---------- open / save ---------- */
  async function saveToBrowser() {
    if (!S.available) { bus.emit("toast", "Saving in the browser isn't available here. Use Download instead."); return false; }
    const p = M.state.project;
    p.updated = Date.now();
    await S.put("projects", { id: p.id, name: p.name, updated: p.updated, bpm: p.bpm, json: JSON.stringify(p) });
    pm.savedOnce = true;
    pm.dirty = false;
    pm.lastSaved = Date.now();
    store.set("lastProject", p.id);
    bus.emit("saved");
    return true;
  }

  async function saveToFile(forcePicker) {
    const text = buildPackage();
    const name = GBL.safeFileName(M.state.project.name, "beatlab");
    if (window.showSaveFilePicker) {
      try {
        if (!pm.fileHandle || forcePicker) {
          pm.fileHandle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "Beat Lab project", accept: { "application/json": [".beatlab"] } }] });
        }
        const w = await pm.fileHandle.createWritable();
        await w.write(text);
        await w.close();
        bus.emit("toast", "Saved " + pm.fileHandle.name);
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;
        console.warn("file picker failed, downloading instead", e);
      }
    }
    GBL.downloadBlob(new Blob([text], { type: "application/json" }), name);
    bus.emit("toast", "Downloaded " + name);
    return true;
  }

  pm.save = async function () {
    if (!pm.savedOnce && (M.state.project.name === "My Song" || !M.state.project.name)) {
      const name = await GBL.ui.prompt("Name your song", M.state.project.name || "My Song", "Save");
      if (name == null) return;
      M.state.project.name = name.trim() || "My Song";
      M.changed("name");
    }
    const ok = await saveToBrowser();
    if (pm.fileHandle) await saveToFile(false);
    if (ok) bus.emit("toast", "Saved “" + M.state.project.name + "” ✔");
    clearRecovery();
  };

  pm.saveAs = async function () {
    const res = await GBL.ui.form("Save As", [
      { id: "name", label: "Song name", type: "text", value: M.state.project.name },
      { id: "where", label: "Save to", type: "choice", value: "browser", options: [["browser", "My Projects (this browser)"], ["file", "A .beatlab file on my device"], ["both", "Both"]] },
    ], "Save");
    if (!res) return;
    const p = M.state.project;
    const newName = (res.name || "My Song").trim();
    if (pm.savedOnce && newName !== p.name) { p.id = uid("prj"); pm.fileHandle = null; }
    p.name = newName;
    M.changed("name");
    if (res.where !== "file") await saveToBrowser();
    if (res.where !== "browser") await saveToFile(true);
    if (res.where !== "file") bus.emit("toast", "Saved “" + p.name + "” ✔");
    clearRecovery();
  };

  pm.downloadFile = () => saveToFile(true);

  pm.loadProjectObject = async function (obj, opts = {}) {
    GBL.audio.transport.stop();
    const p = M.normalize(obj);
    await prepareProject(p);
    M.setProject(p, opts);
    pm.savedOnce = !!opts.saved;
    pm.dirty = !!opts.dirty;
    pm.fileHandle = opts.fileHandle || null;
    store.set("lastProject", p.id);
  };

  pm.openStored = async function (id) {
    const rec = await S.get("projects", id);
    if (!rec) { bus.emit("toast", "That project couldn't be found."); return; }
    await pm.loadProjectObject(JSON.parse(rec.json), { saved: true });
    bus.emit("toast", "Opened “" + rec.name + "”");
  };

  pm.openFile = async function (file, handle) {
    try {
      const text = await file.text();
      const proj = await readPackage(text);
      await pm.loadProjectObject(proj, { saved: false, fileHandle: handle || null });
      bus.emit("toast", "Opened " + file.name);
    } catch (e) {
      GBL.ui.alert("Couldn't open that file", String(e.message || e));
    }
  };

  pm.pickFile = async function () {
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({ types: [{ description: "Beat Lab project", accept: { "application/json": [".beatlab", ".json"] } }] });
        const f = await h.getFile();
        return pm.openFile(f, h);
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const input = GBL.h("input", { type: "file", accept: ".beatlab,.json,application/json", style: { display: "none" } });
    document.body.append(input);
    input.onchange = () => { if (input.files[0]) pm.openFile(input.files[0]); input.remove(); };
    input.click();
  };

  pm.list = async function () {
    if (!S.available) return [];
    try { const all = await S.all("projects"); return all.sort((a, b) => b.updated - a.updated); } catch (e) { return []; }
  };
  pm.remove = async function (id) { await S.del("projects", id); };

  pm.newProject = async function (template) {
    if (pm.dirty && !(await GBL.ui.confirm("Start a new song?", "Your current song has unsaved changes. It's kept in recovery, but save it first if you want to keep it in My Projects.", "Start new"))) return false;
    const p = template ? template() : M.createProject();
    await pm.loadProjectObject(p, { saved: false });
    clearRecovery();
    return true;
  };

  /* ---------- autosave & recovery ---------- */
  const autosave = debounce(async () => {
    if (!M.state.project) return;
    const json = JSON.stringify(M.state.project);
    if (S.available) {
      try {
        await S.put("meta", { key: "recovery", projectId: M.state.project.id, name: M.state.project.name, time: Date.now(), json, saved: pm.savedOnce });
        if (pm.savedOnce && GBL.settings.get("autosave")) await saveToBrowser();
      } catch (e) { console.warn("autosave failed", e); }
    }
    bus.emit("autosaved");
  }, 1500);

  function clearRecovery() {
    if (S.available) S.del("meta", "recovery").catch(() => {});
    try { localStorage.removeItem("gbl.recovery"); } catch (e) { /* */ }
  }

  bus.on("dirty", () => { pm.dirty = true; autosave(); });
  window.addEventListener("beforeunload", () => {
    if (!pm.dirty || !M.state.project) return;
    try {
      const json = JSON.stringify(M.state.project);
      if (json.length < 2e6) localStorage.setItem("gbl.recovery", JSON.stringify({ time: Date.now(), json, projectId: M.state.project.id, saved: pm.savedOnce }));
    } catch (e) { /* storage full */ }
    autosave.flush();
  });

  /* Decide what to open at startup. Returns true if something was opened. */
  pm.startup = async function () {
    await S.check();
    let rec = null;
    if (S.available) { try { rec = await S.get("meta", "recovery"); } catch (e) { /* */ } }
    try {
      const ls = JSON.parse(localStorage.getItem("gbl.recovery") || "null");
      if (ls && (!rec || ls.time > rec.time)) rec = ls;
    } catch (e) { /* */ }
    if (rec && rec.json) {
      let stored = null;
      if (rec.saved && S.available) { try { stored = await S.get("projects", rec.projectId); } catch (e) { /* */ } }
      if (!stored || stored.updated < rec.time - 1000) {
        const when = new Date(rec.time).toLocaleString();
        const yes = await GBL.ui.confirm("Recover your work?", "We found unsaved changes to “" + (JSON.parse(rec.json).name || "My Song") + "” from " + when + ". Do you want to keep working on it?", "Recover", "No thanks");
        if (yes) {
          await pm.loadProjectObject(JSON.parse(rec.json), { saved: !!stored, dirty: true });
          bus.emit("toast", "Recovered your song ✔");
          return true;
        }
        clearRecovery();
      }
    }
    const last = store.get("lastProject", null);
    if (last && S.available) {
      try {
        const r2 = await S.get("projects", last);
        if (r2) { await pm.loadProjectObject(JSON.parse(r2.json), { saved: true }); return true; }
      } catch (e) { /* */ }
    }
    await pm.loadProjectObject(M.createProject(), { saved: false });
    return false;
  };

  pm.addAsset = addAsset;
  GBL.projects = pm;
})();
