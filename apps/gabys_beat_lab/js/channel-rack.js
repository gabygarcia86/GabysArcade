/* StepSequencer view: the Channel Rack. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, $, clear, bus, uid } = GBL;
  const M = GBL.model;
  const S = M.state;

  let root, rowsEl, headEl;
  const stepEls = new Map(); // chId -> [buttons]
  const ledEls = new Map();
  let lastNow = -1;
  let paint = null;

  function build(el) {
    root = el;
    headEl = h("div", { class: "panel-head rack-head" });
    rowsEl = h("div", { class: "rack-rows", tabindex: -1 });
    const foot = h("div", { class: "rack-foot" },
      h("button", { class: "btn add-ch", tip: "Add a new instrument or sound to the rack", onclick: (e) => addMenu(e.currentTarget) }, "➕ Add Channel"),
      h("span", { class: "hint beginner-only" }, "Tip: click the squares to turn sounds on. Drag across to paint!"));
    root.append(headEl, rowsEl, foot);
    setupDrops(rowsEl);
    rowsEl.addEventListener("contextmenu", (e) => { if (e.target.closest(".step")) e.preventDefault(); });
    bus.on("project:loaded", render);
    bus.on("change", (scope) => { if (scope !== "steps" && scope !== "live") render(); });
    bus.on("select", render);
    bus.on("frame", frame);
    bus.on("settings", (k) => { if (k === "beginner") render(); });
    GBL.audio.transport.onEvent = flash;
    render();
  }

  function patternSelect() {
    const p = S.project;
    const sel = h("select", { class: "pat-select", "aria-label": "Pattern", tip: "Choose which pattern you are editing" },
      p.patterns.map((pt) => h("option", { value: pt.id, selected: pt.id === p.currentPattern }, pt.name)));
    sel.onchange = () => { p.currentPattern = sel.value; M.changed("pattern-select", false); bus.emit("pattern:select"); };
    return sel;
  }

  function renderHead() {
    const p = S.project;
    const pat = M.getPattern();
    clear(headEl);
    const lenSel = h("select", { "aria-label": "Pattern length", tip: "How many steps the pattern has (16 = one bar)" },
      [16, 32, 48, 64].map((n) => h("option", { value: n, selected: pat.length === n }, n + " steps")));
    if (![16, 32, 48, 64].includes(pat.length)) lenSel.append(h("option", { value: pat.length, selected: true }, pat.length + " steps"));
    lenSel.onchange = () => { M.setPatternLength(pat, +lenSel.value); M.changed("pattern"); };
    const swing = GBL.ui.knob({ label: "Swing", min: 0, max: 1, value: p.swing, def: 0, size: 30, color: "var(--pink)", fmt: (v) => Math.round(v * 100) + "%",
      tip: "Swing: delays every other step for a bouncy groove",
      onInput: (v) => { p.swing = v; M.changed("live", false); }, onChange: () => M.changed("swing") });
    swing.classList.add("adv");
    const presets = h("button", { class: "btn adv", tip: "Load a ready-made drum pattern", onclick: (e) => presetMenu(e.currentTarget) }, "🥁 Beat Presets ▾");
    headEl.append(
      h("button", { class: "icon-btn collapse-btn", tip: "Collapse / expand the Channel Rack", "aria-label": "Collapse Channel Rack", onclick: () => GBL.layout.toggle("rack") }, "▾"),
      h("h2", { class: "panel-title" }, "🥁 Channel Rack"),
      h("div", { class: "pat-group" },
        patternSelect(),
        h("button", { class: "icon-btn", tip: "New empty pattern", "aria-label": "New pattern", onclick: () => { M.addPattern(); } }, "➕"),
        h("button", { class: "icon-btn", tip: "Duplicate this pattern (make a variation)", "aria-label": "Duplicate pattern", onclick: () => M.addPattern(null, pat.id) }, "⧉"),
        h("button", { class: "icon-btn", tip: "Rename this pattern", "aria-label": "Rename pattern", onclick: renamePattern }, "✏️"),
        h("button", { class: "icon-btn adv", tip: "Delete this pattern", "aria-label": "Delete pattern", onclick: deletePattern }, "🗑️")),
      lenSel, swing,
      h("div", { class: "btn-group adv" },
        h("button", { class: "btn small", tip: "Copy this pattern", onclick: copyPattern }, "Copy"),
        h("button", { class: "btn small", tip: "Paste a copied pattern here", onclick: pastePattern, disabled: !S.clipboard.pattern }, "Paste"),
        h("button", { class: "btn small", tip: "Clear every step and note in this pattern", onclick: clearPattern }, "Clear")),
      presets,
      h("button", { class: "btn mega", tip: "Make a random drum beat for this pattern", onclick: makeMeABeat }, "✨ MAKE ME A BEAT!"));
  }

  function renamePattern() {
    const pat = M.getPattern();
    GBL.ui.prompt("Rename pattern", pat.name).then((n) => { if (n != null && n.trim()) { pat.name = n.trim(); M.changed("pattern"); } });
  }
  async function deletePattern() {
    const pat = M.getPattern();
    if (S.project.patterns.length <= 1) { GBL.ui.toast("You need at least one pattern."); return; }
    if (await GBL.ui.confirm("Delete pattern?", "Delete “" + pat.name + "”? It will also be removed from the Playlist.", "Delete")) M.removePattern(pat.id);
  }
  function copyPattern() { S.clipboard.pattern = GBL.deepClone(M.getPattern()); GBL.ui.toast("Pattern copied"); render(); }
  function pastePattern() {
    const src = S.clipboard.pattern;
    if (!src) return;
    const pat = M.getPattern();
    pat.length = src.length;
    pat.steps = GBL.deepClone(src.steps);
    pat.notes = {};
    for (const [k, list] of Object.entries(src.notes)) pat.notes[k] = list.map((n) => Object.assign({}, n, { id: uid("n") }));
    M.changed("pattern");
    GBL.ui.toast("Pattern pasted");
  }
  async function clearPattern() {
    if (!(await GBL.ui.confirm("Clear pattern?", "Remove every step and note from “" + M.getPattern().name + "”?", "Clear"))) return;
    const pat = M.getPattern();
    pat.steps = {};
    pat.notes = {};
    M.changed("pattern");
  }
  function makeMeABeat() {
    const style = GBL.generator.randomBeat(S.project, M.getPattern());
    M.changed("pattern");
    GBL.ui.uiSound("success");
    GBL.ui.toast("🎉 Here's a " + style + " beat! Press Play ▶");
    if (!GBL.audio.transport.playing) GBL.audio.transport.play();
  }
  function presetMenu(anchor) {
    const names = { hiphop: "Hip-Hop Boom Bap", trap: "Trap", edm: "EDM Four-on-the-Floor", rock: "Rock", pop: "Pop", jazz: "Jazz Swing", lofi: "Lo-Fi", retro: "Retro 8-bit", cinematic: "Cinematic", funk: "Funk", reggae: "Reggae One Drop", spooky: "Spooky" };
    GBL.ui.menu(anchor, Object.keys(GBL.generator.DRUM_STYLES).map((k) => ({
      label: names[k] || k, icon: "🥁",
      onClick: () => { GBL.generator.makeBeat(S.project, M.getPattern(), k, {}); M.changed("pattern"); GBL.ui.toast("Loaded the " + (names[k] || k) + " beat"); },
    })));
  }

  function addMenu(anchor) {
    GBL.ui.menu(anchor, [
      { label: "Instrument (piano, synth, bass…)", icon: "🎹", onClick: () => pickInstrument((inst) => M.addChannel({ kind: "synth", inst: inst.id, name: inst.name })) },
      { label: "Drum or sound sample", icon: "🥁", onClick: () => pickSample((s) => M.addChannel({ kind: "sample", sound: s.id, name: s.name })) },
      { label: "Import an audio file…", icon: "📂", onClick: () => GBL.recorder.importDialog("channel") },
      { label: "Record a sound with the microphone…", icon: "🎤", onClick: () => GBL.recorder.open({ target: "channel" }) },
    ]);
  }

  function pickInstrument(cb, current) {
    const body = h("div", { class: "picker" });
    let m;
    for (const cat of GBL.instruments.CATS) {
      body.append(h("h3", {}, cat));
      const grid = h("div", { class: "picker-grid" });
      for (const inst of GBL.instruments.INSTRUMENTS.filter((i) => i.cat === cat)) {
        const b = h("button", { class: "pick-card" + (inst.id === current ? " current" : ""), style: { "--c": inst.color } },
          h("span", { class: "pick-icon" }, inst.icon), h("span", {}, inst.name));
        b.onclick = () => { m.close(); cb(inst); };
        b.onpointerenter = () => { if (GBL.audio.engine.running) GBL.audio.engine.hit({ id: "tmp_pick", kind: "synth", inst: inst.id, vol: 0.7, cutoff: 1, reverb: 0.2, attack: inst.presets[0].attack, release: inst.presets[0].release }, 60, 0.7, 0.3); };
        grid.append(b);
      }
      body.append(grid);
    }
    m = GBL.ui.modal({ title: "Choose an instrument", icon: "🎹", body, wide: true });
  }

  function pickSample(cb, current) {
    const body = h("div", { class: "picker" });
    let m;
    for (const cat of GBL.samples.CATEGORIES) {
      body.append(h("h3", {}, cat));
      const grid = h("div", { class: "picker-grid small" });
      for (const s of GBL.samples.LIST.filter((x) => x.cat === cat)) {
        const b = h("button", { class: "pick-card" + (s.id === current ? " current" : "") }, h("span", { class: "pick-icon" }, s.icon || "🔊"), h("span", {}, s.name));
        b.onclick = () => { m.close(); cb(s); };
        b.onpointerenter = () => { if (GBL.audio.engine.running) GBL.samples.render(s.id).then((buf) => GBL.audio.engine.previewBuffer(buf)); };
        grid.append(b);
      }
      body.append(grid);
    }
    const mine = Object.entries(S.project.assets);
    if (mine.length) {
      body.append(h("h3", {}, "My Sounds"));
      const grid = h("div", { class: "picker-grid small" });
      for (const [id, a] of mine) {
        const b = h("button", { class: "pick-card" }, h("span", { class: "pick-icon" }, "🎙️"), h("span", {}, a.name));
        b.onclick = () => { m.close(); cb({ id: "asset:" + id, name: a.name }); };
        grid.append(b);
      }
      body.append(grid);
    }
    m = GBL.ui.modal({ title: "Choose a sound", icon: "🥁", body, wide: true });
  }

  function chMenu(anchor, ch) {
    const p = S.project;
    const idx = p.channels.indexOf(ch);
    GBL.ui.menu(anchor, [
      { label: "Open in Piano Roll", icon: "🎹", onClick: () => openPianoRoll(ch) },
      { label: "Rename…", icon: "✏️", onClick: () => GBL.ui.prompt("Rename channel", ch.name).then((n) => { if (n && n.trim()) { ch.name = n.trim(); const ins = M.getInsert(ch.insert); if (ins && p.channels.filter((c) => c.insert === ins.id).length === 1) ins.name = ch.name; M.changed("channels"); } }) },
      { label: ch.kind === "synth" ? "Change instrument…" : "Change sound…", icon: "🔁", onClick: () => (ch.kind === "synth" ? pickInstrument((inst) => { setInstrument(ch, inst); }, ch.inst) : pickSample((s) => { ch.sound = s.id; ch.name = s.name; M.changed("channels"); }, ch.sound)) },
      { label: "Color", icon: "🎨", onClick: () => colorMenu(anchor, ch) },
      { label: "Duplicate", icon: "⧉", onClick: () => M.duplicateChannel(ch.id) },
      { label: "Move up", icon: "⬆️", disabled: idx === 0, onClick: () => { p.channels.splice(idx, 1); p.channels.splice(idx - 1, 0, ch); M.changed("channels"); } },
      { label: "Move down", icon: "⬇️", disabled: idx === p.channels.length - 1, onClick: () => { p.channels.splice(idx, 1); p.channels.splice(idx + 1, 0, ch); M.changed("channels"); } },
      { label: "Clear steps & notes in this pattern", icon: "🧹", onClick: () => { const pat = M.getPattern(); delete pat.steps[ch.id]; delete pat.notes[ch.id]; M.changed("pattern"); } },
      { sep: true },
      { label: "Delete channel", icon: "🗑️", onClick: async () => { if (await GBL.ui.confirm("Delete channel?", "Delete “" + ch.name + "” and all of its steps and notes?", "Delete")) M.removeChannel(ch.id); } },
    ]);
  }
  function setInstrument(ch, inst) {
    const was = GBL.instruments.byId[ch.inst];
    if (was && ch.name === was.name) ch.name = inst.name;
    ch.inst = inst.id;
    M.applyPreset(ch, inst.presets[0]);
    M.changed("channels");
  }
  function colorMenu(anchor, ch) {
    const body = h("div", { class: "swatches" }, GBL.PALETTE.concat(["#94a3b8", "#f8fafc"]).map((c) =>
      h("button", { class: "swatch", style: { background: c }, "aria-label": "Color " + c, onclick: () => { ch.color = c; const ins = M.getInsert(ch.insert); if (ins) ins.color = c; M.changed("channels"); m.close(); } })));
    const m = GBL.ui.modal({ title: "Pick a color", icon: "🎨", body });
  }
  function openPianoRoll(ch) {
    S.pianoRollChannel = ch.id;
    S.selectedChannel = ch.id;
    bus.emit("select");
    GBL.layout.showEditor("pianoroll");
  }

  function render() {
    if (!root || !S.project) return;
    renderHead();
    const p = S.project;
    const pat = M.getPattern();
    clear(rowsEl);
    stepEls.clear();
    ledEls.clear();
    const anySolo = p.channels.some((c) => c.solo);
    for (const ch of p.channels) {
      const sel = ch.id === S.selectedChannel;
      const led = h("button", { class: "led" + (ch.mute ? " off" : "") + (anySolo && !ch.solo ? " dim" : ""), tip: ch.mute ? "Muted: click to hear it again" : "Click to mute this channel", "aria-label": (ch.mute ? "Unmute " : "Mute ") + ch.name, "aria-pressed": String(!ch.mute) });
      led.onclick = () => { ch.mute = !ch.mute; GBL.ui.uiSound(ch.mute ? "off" : "on"); M.changed("channels"); };
      const solo = h("button", { class: "solo-btn adv" + (ch.solo ? " on" : ""), tip: "Solo: hear only this channel", "aria-label": "Solo " + ch.name, "aria-pressed": String(!!ch.solo) }, "S");
      solo.onclick = () => { ch.solo = !ch.solo; M.changed("channels"); };
      const pan = GBL.ui.knob({ label: "", min: -1, max: 1, value: ch.pan, def: 0, size: 24, bipolar: true, showValue: false, color: "var(--cyan)", tip: "Pan (left / right). Double-click to center.",
        onInput: (v) => { ch.pan = v; M.changed("live", false); }, onChange: () => M.changed("steps") });
      const vol = GBL.ui.knob({ label: "", min: 0, max: 1.25, value: ch.vol, def: 0.8, size: 24, showValue: false, color: "var(--green)", tip: "Volume. Double-click to reset.",
        onInput: (v) => { ch.vol = v; M.changed("live", false); }, onChange: () => M.changed("steps") });
      pan.classList.add("adv");
      const icon = ch.kind === "synth" ? (GBL.instruments.byId[ch.inst] || {}).icon || "🎹" : (GBL.samples.byId[ch.sound] || {}).icon || "🎙️";
      const nameBtn = h("button", { class: "ch-name" + (sel ? " selected" : ""), style: { "--c": ch.color }, tip: "Click to select and edit. Click again to hear it.", "aria-label": "Select " + ch.name },
        h("span", { class: "ch-ico" }, icon), h("span", { class: "ch-label" }, ch.name));
      ledEls.set(ch.id, nameBtn);
      nameBtn.onclick = () => {
        if (S.selectedChannel === ch.id) GBL.audio.engine.hit(ch, ch.kind === "synth" ? 60 : null, 0.85);
        S.selectedChannel = ch.id;
        if (ch.kind === "synth") S.pianoRollChannel = ch.id;
        bus.emit("select");
        GBL.layout.reveal("inspector");
      };
      nameBtn.oncontextmenu = (e) => { e.preventDefault(); chMenu(nameBtn, ch); };
      const more = h("button", { class: "icon-btn tiny", tip: "Channel options", "aria-label": ch.name + " options", onclick: (e) => chMenu(e.currentTarget, ch) }, "⋯");
      const row = h("div", { class: "rack-row" + (sel ? " selected" : ""), "data-ch": ch.id },
        h("div", { class: "rack-ctl" }, led, solo, pan, vol, nameBtn, more));
      if (M.channelHasNotes(pat, ch.id)) {
        const prev = h("canvas", { class: "notes-preview", tip: "This channel has piano roll notes. Click to edit them.", style: { "--c": ch.color } });
        prev.onclick = () => openPianoRoll(ch);
        row.append(h("div", { class: "rack-steps preview-wrap" }, prev));
        requestAnimationFrame(() => drawPreview(prev, pat, ch));
      } else {
        const steps = M.stepsFor(pat, ch.id);
        const wrap = h("div", { class: "rack-steps", role: "group", "aria-label": ch.name + " steps" });
        const els = [];
        const spBeat = M.stepsPerBeat(p);
        for (let i = 0; i < pat.length; i++) {
          const v = steps[i] || 0;
          const b = h("button", {
            class: "step" + (v > 0 ? " on" : "") + (Math.floor(i / spBeat) % 2 ? " alt" : "") + (i % M.stepsPerBar(p) === 0 ? " bar" : ""),
            style: { "--c": ch.color, "--v": v || 1 }, "data-i": i, "aria-label": ch.name + " step " + (i + 1), "aria-pressed": String(v > 0),
          });
          els.push(b);
          wrap.append(b);
        }
        stepEls.set(ch.id, els);
        wrap.addEventListener("pointerdown", (e) => stepDown(e, ch, steps, els));
        wrap.addEventListener("keydown", (e) => {
          const b = e.target.closest(".step");
          if (!b) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleStep(ch, steps, els, +b.dataset.i); M.changed("steps"); }
        });
        row.append(wrap);
      }
      setupRowDrop(row, ch);
      rowsEl.append(row);
    }
    lastNow = -1;
  }

  function setStep(ch, steps, els, i, v) {
    steps[i] = v;
    const b = els[i];
    b.classList.toggle("on", v > 0);
    b.style.setProperty("--v", v || 1);
    b.setAttribute("aria-pressed", String(v > 0));
  }
  function toggleStep(ch, steps, els, i) {
    const on = !(steps[i] > 0);
    setStep(ch, steps, els, i, on ? 1 : 0);
    if (on && !GBL.audio.transport.playing) GBL.audio.engine.hit(ch, null, 0.9);
    return on;
  }

  function stepDown(e, ch, steps, els) {
    const b = e.target.closest(".step");
    if (!b) return;
    e.preventDefault();
    const i = +b.dataset.i;
    if (e.button === 2 || e.shiftKey) {
      // cycle velocity: loud -> medium -> soft
      const v = steps[i] || 0;
      const nv = v === 0 ? 1 : v > 0.8 ? 0.6 : v > 0.45 ? 0.3 : 1;
      setStep(ch, steps, els, i, nv);
      GBL.audio.engine.hit(ch, null, nv);
      M.changed("steps");
      return;
    }
    const on = toggleStep(ch, steps, els, i);
    paint = { on, ch, steps, els, last: i };
    // long press = velocity menu on touch
    let lp = e.pointerType === "touch" ? setTimeout(() => {
      paint = null;
      setStep(ch, steps, els, i, steps[i] > 0.8 ? 0.6 : steps[i] > 0.45 ? 0.3 : 1);
      M.changed("steps");
      GBL.ui.toast("Step volume: " + Math.round(steps[i] * 100) + "%");
    }, 550) : 0;
    const move = (ev) => {
      if (!paint) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const sb = el && el.closest && el.closest(".step");
      if (!sb || !paint.els.includes(sb)) return;
      const j = +sb.dataset.i;
      if (j === paint.last) return;
      clearTimeout(lp);
      paint.last = j;
      const want = paint.on ? 1 : 0;
      if ((steps[j] > 0) !== paint.on) { setStep(ch, steps, els, j, want); if (paint.on && !GBL.audio.transport.playing) GBL.audio.engine.hit(ch, null, 0.8); }
    };
    const up = () => {
      clearTimeout(lp);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (paint) { paint = null; M.changed("steps"); }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function drawPreview(cv, pat, ch) {
    const w = cv.clientWidth || 300, hh = cv.clientHeight || 24;
    const ctx = GBL.fitCanvas(cv, w, hh);
    ctx.clearRect(0, 0, w, hh);
    const notes = pat.notes[ch.id] || [];
    if (!notes.length) return;
    let lo = 127, hi = 0;
    for (const n of notes) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }
    const range = Math.max(6, hi - lo + 1);
    ctx.fillStyle = ch.color;
    for (const n of notes) {
      const x = (n.s / pat.length) * w, nw = Math.max(2, (n.l / pat.length) * w - 1);
      const y = hh - 3 - ((n.p - lo + 0.5) / range) * (hh - 6);
      ctx.globalAlpha = 0.5 + 0.5 * (n.v == null ? 0.8 : n.v);
      ctx.fillRect(x, y - 1.5, nw, 3);
    }
    ctx.globalAlpha = 1;
  }

  function frame(pos) {
    const p = S.project;
    const tr = GBL.audio.transport;
    let now = -1;
    if (tr.playing || tr.pos > 0) {
      if (p.mode === "pattern") now = Math.floor(pos) % M.getPattern().length;
      else {
        // in song mode, light the steps of the current pattern when one of its clips is under the playhead
        const c = p.clips.find((c) => c.type === "pattern" && c.ref === p.currentPattern && pos >= c.start && pos < c.start + c.len);
        if (c) now = Math.floor(pos - c.start) % M.getPattern().length;
      }
    }
    if (now === lastNow) return;
    for (const els of stepEls.values()) {
      if (lastNow >= 0 && els[lastNow]) els[lastNow].classList.remove("now");
      if (now >= 0 && els[now]) els[now].classList.add("now");
    }
    lastNow = now;
  }

  function flash(chId, t) {
    const el = ledEls.get(chId);
    if (!el) return;
    const delay = Math.max(0, (t - GBL.audio.engine.ctx.currentTime) * 1000);
    setTimeout(() => { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }, delay);
    bus.emit("note:visual", chId, delay);
  }

  /* ---------- drag & drop ---------- */
  function readDrop(e) {
    try { return JSON.parse(e.dataTransfer.getData("application/x-gbl") || "null"); } catch (err) { return null; }
  }
  function setupRowDrop(row, ch) {
    row.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("application/x-gbl")) { e.preventDefault(); e.stopPropagation(); row.classList.add("drop"); } });
    row.addEventListener("dragleave", () => row.classList.remove("drop"));
    row.addEventListener("drop", (e) => {
      const d = readDrop(e);
      row.classList.remove("drop");
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      if (d.kind === "sample") {
        if (ch.kind !== "sample") { ch.kind = "sample"; ch.inst = null; ch.release = 1.5; }
        ch.sound = d.ref;
        ch.name = GBL.audio.refName(d.ref);
        GBL.ui.toast("Replaced the sound on this channel");
      } else if (d.kind === "instrument") {
        const inst = GBL.instruments.byId[d.id];
        ch.kind = "synth"; ch.sound = null;
        setInstrument(ch, inst);
        return;
      }
      M.changed("channels");
    });
  }
  function setupDrops(el) {
    el.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("application/x-gbl") || e.dataTransfer.types.includes("Files")) { e.preventDefault(); el.classList.add("drop"); } });
    el.addEventListener("dragleave", (e) => { if (e.target === el) el.classList.remove("drop"); });
    el.addEventListener("drop", async (e) => {
      el.classList.remove("drop");
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length) { GBL.recorder.importFiles(e.dataTransfer.files, "channel"); return; }
      const d = readDrop(e);
      if (!d) return;
      if (d.kind === "sample") M.addChannel({ kind: "sample", sound: d.ref, name: GBL.audio.refName(d.ref) });
      if (d.kind === "instrument") { const inst = GBL.instruments.byId[d.id]; M.addChannel({ kind: "synth", inst: inst.id, name: inst.name }); }
    });
  }

  GBL.rack = { build, render, pickInstrument, pickSample, setInstrument, openPianoRoll, chMenu, makeMeABeat };
})();
