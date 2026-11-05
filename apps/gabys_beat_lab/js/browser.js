/* SampleBrowser: sounds, instruments and presets with search, previews, waveforms, favorites and drag-and-drop. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clear, bus, store } = GBL;
  const M = GBL.model;
  const S = M.state;

  let root, listEl, chipsEl, searchEl;
  const V = { tab: "sounds", cat: "All", q: "" };
  let favs = new Set(store.get("favorites", []));
  let observer = null;

  function build(el) {
    root = el;
    searchEl = h("input", { type: "search", placeholder: "🔍 Search sounds…", "aria-label": "Search sounds", class: "browser-search" });
    searchEl.oninput = () => { V.q = searchEl.value.trim().toLowerCase(); renderList(); };
    const tabs = h("div", { class: "browser-tabs", role: "tablist" });
    for (const [id, label] of [["sounds", "🔊 Sounds"], ["instruments", "🎹 Instruments"], ["presets", "⭐ Presets"]]) {
      const b = h("button", { class: "tab" + (V.tab === id ? " on" : ""), role: "tab", "aria-selected": String(V.tab === id), "data-tab": id }, label);
      b.onclick = () => { V.tab = id; tabs.querySelectorAll(".tab").forEach((t) => { t.classList.toggle("on", t.dataset.tab === id); t.setAttribute("aria-selected", String(t.dataset.tab === id)); }); renderAll(); };
      tabs.append(b);
    }
    chipsEl = h("div", { class: "chips" });
    listEl = h("div", { class: "browser-list" });
    root.append(
      h("div", { class: "panel-head" },
        h("button", { class: "icon-btn collapse-btn", tip: "Collapse / expand the browser", "aria-label": "Collapse browser", onclick: () => GBL.layout.toggle("browser") }, "◂"),
        h("h2", { class: "panel-title" }, "📚 Browser")),
      tabs, searchEl, chipsEl, listEl,
      h("div", { class: "browser-foot" },
        h("button", { class: "btn small", tip: "Import WAV, MP3, OGG or other audio files", onclick: () => GBL.recorder.importDialog(null) }, "📂 Import"),
        h("button", { class: "btn small", tip: "Record a sound with your microphone", onclick: () => GBL.recorder.open({ target: null }) }, "🎤 Record")));
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) { observer.unobserve(en.target); drawWave(en.target); }
      }, { root: listEl });
    }
    bus.on("project:loaded", renderAll);
    bus.on("assets", renderAll);
    bus.on("samples:ready", renderList);
    bus.on("change", (s) => { if (V.tab === "presets" && s !== "live" && s !== "steps" && s !== "mixer-live") renderList(); });
    renderAll();
  }

  function renderAll() { renderChips(); renderList(); }

  function renderChips() {
    clear(chipsEl);
    let cats = [];
    if (V.tab === "sounds") cats = ["All", "⭐ Favorites", "🎙️ My Sounds"].concat(GBL.samples.CATEGORIES);
    else if (V.tab === "instruments") cats = ["All"].concat(GBL.instruments.CATS);
    else cats = [];
    if (!cats.includes(V.cat)) V.cat = "All";
    for (const c of cats) {
      const b = h("button", { class: "chip" + (c === V.cat ? " on" : "") }, c);
      b.onclick = () => { V.cat = c; renderAll(); };
      chipsEl.append(b);
    }
    chipsEl.hidden = !cats.length;
    searchEl.hidden = V.tab === "presets";
  }

  function dragData(e, data) {
    e.dataTransfer.setData("application/x-gbl", JSON.stringify(data));
    e.dataTransfer.setData("text/plain", data.name || "sound");
    e.dataTransfer.effectAllowed = "copy";
  }

  function soundItem(ref, name, icon, catLabel) {
    const fav = favs.has(ref);
    const wave = h("canvas", { class: "mini-wave", "data-ref": ref, "aria-hidden": "true" });
    const favB = h("button", { class: "icon-btn tiny fav" + (fav ? " on" : ""), tip: fav ? "Remove from favorites" : "Add to favorites", "aria-label": (fav ? "Unfavorite " : "Favorite ") + name, "aria-pressed": String(fav) }, fav ? "★" : "☆");
    favB.onclick = (e) => { e.stopPropagation(); if (favs.has(ref)) favs.delete(ref); else favs.add(ref); store.set("favorites", [...favs]); renderList(); };
    const addB = h("button", { class: "icon-btn tiny add", tip: "Add to your song", "aria-label": "Add " + name }, "＋");
    addB.onclick = (e) => { e.stopPropagation(); addMenu(addB, ref, name); };
    const item = h("div", { class: "b-item", draggable: "true", tabindex: 0, role: "button", "aria-label": "Preview " + name, tip: "Click to hear it. Drag it onto the Channel Rack or Playlist." },
      h("span", { class: "b-icon" }, icon || "🔊"), h("span", { class: "b-text" }, h("span", { class: "b-name" }, name), catLabel ? h("span", { class: "b-cat" }, catLabel) : null), wave, favB, addB);
    item.onclick = () => preview(ref, item);
    item.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); preview(ref, item); } };
    item.ondragstart = (e) => dragData(e, { kind: "sample", ref, name });
    if (observer) observer.observe(wave); else requestAnimationFrame(() => drawWave(wave));
    return item;
  }

  async function preview(ref, item) {
    GBL.audio.engine.ensure();
    let buf = GBL.audio.resolveBuffer(ref);
    if (!buf && !ref.startsWith("asset:")) buf = await GBL.samples.render(ref);
    if (!buf) return;
    GBL.audio.engine.previewBuffer(buf);
    if (item) { item.classList.remove("playing"); void item.offsetWidth; item.classList.add("playing"); }
  }

  function addMenu(anchor, ref, name) {
    const ch = M.getChannel(S.selectedChannel);
    GBL.ui.menu(anchor, [
      { label: "Add as a new Channel Rack channel", icon: "🥁", onClick: async () => { if (!ref.startsWith("asset:")) await GBL.samples.render(ref); M.addChannel({ kind: "sample", sound: ref, name }); GBL.ui.toast("Added “" + name + "” to the Channel Rack"); } },
      ch ? { label: "Replace the sound on “" + ch.name + "”", icon: "🔁", onClick: async () => { if (!ref.startsWith("asset:")) await GBL.samples.render(ref); ch.kind = "sample"; ch.inst = null; ch.sound = ref; ch.name = name; M.changed("channels"); } } : null,
      { label: "Put in the Playlist at the playhead", icon: "🎞️", onClick: async () => {
        if (!ref.startsWith("asset:")) await GBL.samples.render(ref);
        const p = S.project;
        const tr = p.tracks.find((t) => t.type === "Sound Effects") || p.tracks[p.tracks.length - 1];
        GBL.playlist.addAudioClip(ref, tr.id, Math.floor(GBL.audio.transport.position()));
        GBL.layout.showEditor("playlist");
      } },
    ]);
  }

  function drawWave(cv) {
    const ref = cv.dataset.ref;
    const buf = GBL.audio.resolveBuffer(ref);
    if (!buf) { if (!ref.startsWith("asset:")) GBL.samples.render(ref).then((b) => b && drawWave(cv)); return; }
    const w = 54, hh = 22;
    const ctx = GBL.fitCanvas(cv, w, hh);
    const d = buf.getChannelData(0);
    const per = Math.max(1, Math.floor(d.length / w));
    ctx.clearRect(0, 0, w, hh);
    ctx.fillStyle = "rgba(125, 211, 252, 0.85)";
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let j = 0; j < per; j += 8) m = Math.max(m, Math.abs(d[x * per + j] || 0));
      m = Math.sqrt(m);
      ctx.fillRect(x, hh / 2 - (m * hh) / 2, 1, Math.max(1, m * hh));
    }
  }

  function instItem(inst) {
    const item = h("div", { class: "b-item", draggable: "true", tabindex: 0, role: "button", style: { "--c": inst.color }, "aria-label": "Preview " + inst.name, tip: "Click to hear it. Drag onto the Channel Rack, or press ＋ to add it." },
      h("span", { class: "b-icon" }, inst.icon), h("span", { class: "b-text" }, h("span", { class: "b-name" }, inst.name), h("span", { class: "b-cat" }, inst.cat)),
      h("button", { class: "icon-btn tiny add", tip: "Add this instrument", "aria-label": "Add " + inst.name, onclick: (e) => { e.stopPropagation(); M.addChannel({ kind: "synth", inst: inst.id, name: inst.name }); GBL.ui.toast("Added " + inst.name + ". Open the Piano Roll to write notes!"); } }, "＋"));
    const tmp = () => ({ id: "tmp_browser", kind: "synth", inst: inst.id, vol: 0.8, pan: 0, cutoff: inst.presets[0].cutoff, reverb: inst.presets[0].reverb, attack: inst.presets[0].attack, release: inst.presets[0].release, pitch: 0 });
    const play = () => {
      const ch = tmp();
      const base = inst.cat === "Bass" ? 36 : 60;
      [0, 4, 7, 12].forEach((s, i) => setTimeout(() => GBL.audio.engine.hit(ch, base + s, 0.8, 0.25), i * 140));
      item.classList.remove("playing"); void item.offsetWidth; item.classList.add("playing");
    };
    item.onclick = play;
    item.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); } };
    item.ondragstart = (e) => dragData(e, { kind: "instrument", id: inst.id, name: inst.name });
    return item;
  }

  function section(title) { return h("h3", { class: "b-section" }, title); }

  function renderList() {
    if (!listEl) return;
    clear(listEl);
    const q = V.q;
    const match = (s) => !q || s.toLowerCase().includes(q);
    if (V.tab === "sounds") {
      const mine = Object.entries(S.project.assets).map(([id, a]) => ({ ref: "asset:" + id, name: a.name, icon: "🎙️", cat: "My Sounds" }));
      let list = GBL.samples.LIST.map((s) => ({ ref: s.id, name: s.name, icon: s.icon, cat: s.cat }));
      if (V.cat === "🎙️ My Sounds") list = mine;
      else if (V.cat === "⭐ Favorites") list = mine.concat(list).filter((s) => favs.has(s.ref));
      else if (V.cat !== "All") list = list.filter((s) => s.cat === V.cat);
      else list = mine.concat(list);
      list = list.filter((s) => match(s.name) || match(s.cat));
      if (!list.length) listEl.append(h("p", { class: "hint pad" }, V.cat === "⭐ Favorites" ? "Tap ☆ on a sound to keep it here." : V.cat === "🎙️ My Sounds" ? "Import or record sounds and they'll show up here." : "No sounds match your search."));
      let lastCat = null;
      for (const s of list) {
        if (V.cat === "All" && !q && s.cat !== lastCat) { listEl.append(section(s.cat)); lastCat = s.cat; }
        listEl.append(soundItem(s.ref, s.name, s.icon, V.cat === "All" && !q ? null : s.cat));
      }
    } else if (V.tab === "instruments") {
      let lastCat = null;
      for (const inst of GBL.instruments.INSTRUMENTS) {
        if (V.cat !== "All" && inst.cat !== V.cat) continue;
        if (!match(inst.name) && !match(inst.cat)) continue;
        if (inst.cat !== lastCat) { listEl.append(section(inst.cat)); lastCat = inst.cat; }
        listEl.append(instItem(inst));
      }
    } else {
      listEl.append(section("🎸 Genre starters (new song)"));
      for (const g of GBL.generator.GENRES) {
        const b = h("button", { class: "b-item preset", tip: "Start a brand-new " + g.name + " song with drums, bass, chords and melody" }, h("span", { class: "b-icon" }, g.emoji), h("span", { class: "b-text" }, h("span", { class: "b-name" }, g.name), h("span", { class: "b-cat" }, g.bpm + " BPM")));
        b.onclick = () => GBL.fun.startGenre(g.id);
        listEl.append(b);
      }
      listEl.append(section("🥁 Drum patterns (current pattern)"));
      for (const k of Object.keys(GBL.generator.DRUM_STYLES)) {
        const b = h("button", { class: "b-item preset", tip: "Replace the drums in the current pattern with this beat" }, h("span", { class: "b-icon" }, "🥁"), h("span", { class: "b-text" }, h("span", { class: "b-name" }, k[0].toUpperCase() + k.slice(1) + " beat")));
        b.onclick = () => { GBL.generator.makeBeat(S.project, M.getPattern(), k, {}); M.changed("pattern"); GBL.ui.toast("Loaded a " + k + " beat"); };
        listEl.append(b);
      }
      listEl.append(section("🏗️ Song structures (Playlist)"));
      for (const st of GBL.generator.STRUCTURES) {
        const b = h("button", { class: "b-item preset", tip: "Arrange the current pattern into this song structure" }, h("span", { class: "b-icon" }, "🏗️"), h("span", { class: "b-text" }, h("span", { class: "b-name" }, st.name)));
        b.onclick = () => { GBL.generator.applyStructure(S.project, st.id); M.changed("arrangement"); bus.emit("mode"); GBL.layout.showEditor("playlist"); GBL.ui.toast("Song arranged! Press Play."); };
        listEl.append(b);
      }
      listEl.append(section("🧩 Patterns (drag to Playlist)"));
      for (const pt of S.project.patterns) {
        const b = h("div", { class: "b-item", draggable: "true", style: { "--c": pt.color }, tip: "Drag this pattern into the Playlist" }, h("span", { class: "b-icon" }, "🧩"), h("span", { class: "b-text" }, h("span", { class: "b-name" }, pt.name), h("span", { class: "b-cat" }, pt.length + " steps")));
        b.ondragstart = (e) => dragData(e, { kind: "pattern", id: pt.id, name: pt.name });
        b.onclick = () => { S.project.currentPattern = pt.id; bus.emit("pattern:select"); M.changed("pattern-select", false); };
        listEl.append(b);
      }
    }
  }

  GBL.browser = { build, renderAll, preview };
})();
