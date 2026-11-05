/* Instrument Panel: edit the selected channel, plus the on-screen / computer keyboard. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clear, bus, clamp } = GBL;
  const M = GBL.model;
  const S = M.state;
  const T = GBL.theory;

  /* ---------- reusable on-screen keyboard ---------- */
  // computer keys -> semitone offsets from the keyboard's base octave
  const KEYMAP = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ",": 12, l: 13, ".": 14, ";": 15, "/": 16,
    q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24, 9: 25, o: 26, 0: 27, p: 28 };
  const LABELS = {};
  for (const [k, v] of Object.entries(KEYMAP)) if (!(v in LABELS) || (/[a-z]/.test(k) && !/[A-Z]/.test(LABELS[v]))) LABELS[v] = k.toUpperCase();

  function keyboard(opts) {
    // opts: { octaves, base (midi), getChannel(), onNote(pitch, on), big }
    const el = h("div", { class: "piano" + (opts.big ? " big" : ""), role: "group", "aria-label": "Piano keyboard" });
    const keys = new Map();
    const voices = new Map();
    let base = opts.base || 48;
    function render() {
      clear(el);
      keys.clear();
      const octs = opts.octaves || 2;
      const whites = [];
      for (let m = base; m < base + octs * 12 + 1; m++) {
        const black = T.isBlack(m);
        const label = LABELS[m - base] ? h("span", { class: "kb-hint" }, LABELS[m - base]) : null;
        const k = h("div", { class: "key " + (black ? "black" : "white"), "data-m": m, "aria-label": T.noteName(m) }, !black && m % 12 === 0 ? h("span", { class: "kb-name" }, T.noteName(m)) : null, label);
        keys.set(m, k);
        if (!black) whites.push(k);
        el.append(k);
      }
      // position black keys between whites
      const wcount = whites.length;
      let wi = 0;
      for (let m = base; m < base + octs * 12 + 1; m++) {
        const k = keys.get(m);
        if (T.isBlack(m)) { k.style.left = "calc(" + (wi / wcount) * 100 + "% - " + (100 / wcount) * 0.3 + "%)"; k.style.width = (100 / wcount) * 0.6 + "%"; }
        else { k.style.left = (wi / wcount) * 100 + "%"; k.style.width = 100 / wcount + "%"; wi++; }
      }
    }
    const active = new Map(); // pointerId -> midi
    function on(m, vel = 0.85) {
      const ch = opts.getChannel();
      if (!ch || voices.has(m)) return;
      voices.set(m, GBL.audio.engine.noteOn(ch, m, vel));
      const k = keys.get(m);
      if (k) { k.classList.add("down"); k.style.setProperty("--c", ch.color || "#22d3ee"); }
      opts.onNote && opts.onNote(m, true, vel);
    }
    function off(m) {
      const v = voices.get(m);
      if (v !== undefined) { GBL.audio.engine.noteOff(v); voices.delete(m); }
      const k = keys.get(m);
      if (k) k.classList.remove("down");
      opts.onNote && opts.onNote(m, false);
    }
    const midiFromPoint = (x, y) => { const e = document.elementFromPoint(x, y); const k = e && e.closest && e.closest(".key"); return k && el.contains(k) ? +k.dataset.m : null; };
    el.addEventListener("pointerdown", (e) => {
      const m = midiFromPoint(e.clientX, e.clientY);
      if (m == null) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      const k = keys.get(m);
      const r = k.getBoundingClientRect();
      const vel = clamp(0.45 + ((e.clientY - r.top) / r.height) * 0.55, 0.3, 1);
      active.set(e.pointerId, m);
      on(m, vel);
    });
    el.addEventListener("pointermove", (e) => {
      if (!active.has(e.pointerId)) return;
      const m = midiFromPoint(e.clientX, e.clientY);
      const cur = active.get(e.pointerId);
      if (m != null && m !== cur) { off(cur); active.set(e.pointerId, m); on(m, 0.8); }
    });
    const up = (e) => { if (!active.has(e.pointerId)) return; off(active.get(e.pointerId)); active.delete(e.pointerId); };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    render();
    return {
      el, on, off,
      get base() { return base; },
      setBase(b) { for (const m of [...voices.keys()]) off(m); base = clamp(b, 12, 96); render(); },
      setOctaves(n) { opts.octaves = n; render(); },
      allOff() { for (const m of [...voices.keys()]) off(m); },
      keyOn(k, vel) { if (k in KEYMAP) { on(base + KEYMAP[k], vel); return true; } return false; },
      keyOff(k) { if (k in KEYMAP) { off(base + KEYMAP[k]); return true; } return false; },
    };
  }

  /* ---------- the panel ---------- */
  let root, body, kb, octLabel;
  const SAMPLE_PRESETS = [
    { name: "Natural", attack: 0.001, release: 1.5, cutoff: 1, reverb: 0 },
    { name: "Tight & Short", attack: 0.001, release: 0.08, cutoff: 1, reverb: 0 },
    { name: "Soft", attack: 0.02, release: 0.6, cutoff: 0.62, reverb: 0.1 },
    { name: "Big Room", attack: 0.001, release: 1.5, cutoff: 1, reverb: 0.5 },
    { name: "Lo-Fi", attack: 0.004, release: 0.5, cutoff: 0.48, reverb: 0.2 },
  ];

  function build(el) {
    root = el;
    body = h("div", { class: "insp-body" });
    kb = keyboard({ octaves: 2, base: 48, getChannel: () => M.getChannel(S.selectedChannel), onNote: recordHook });
    octLabel = h("span", { class: "oct-label" });
    const kbBar = h("div", { class: "kb-bar" },
      h("button", { class: "icon-btn", tip: "Octave down ( [ )", "aria-label": "Octave down", onclick: () => shiftOct(-12) }, "◀"),
      octLabel,
      h("button", { class: "icon-btn", tip: "Octave up ( ] )", "aria-label": "Octave up", onclick: () => shiftOct(12) }, "▶"),
      h("span", { class: "hint" }, "Play with your mouse, fingers or computer keys Z–M and Q–U"));
    root.append(
      h("div", { class: "panel-head" },
        h("button", { class: "icon-btn collapse-btn", tip: "Collapse / expand", "aria-label": "Collapse Instrument panel", onclick: () => GBL.layout.toggle("inspector") }, "▸"),
        h("h2", { class: "panel-title" }, "🎛️ Instrument")),
      body, h("div", { class: "insp-kb" }, kbBar, kb.el));
    bus.on("project:loaded", render);
    bus.on("select", render);
    bus.on("change", (s) => { if (s === "channels" || s === "all" || s === "assistant" || s === "history" || s === "steps" || s === "mixer") render(); });
    updateOct();
    render();
  }
  function shiftOct(d) { kb.setBase(kb.base + d); updateOct(); }
  function updateOct() { if (octLabel) octLabel.textContent = T.noteName(kb.base) + " – " + T.noteName(kb.base + 24); }

  function recordHook(pitch, isOn, vel) {
    if (isOn) GBL.pianoRoll.recordOn(pitch, vel);
    else GBL.pianoRoll.recordOff(pitch);
  }

  function render() {
    if (!root || !S.project) return;
    clear(body);
    const ch = M.getChannel(S.selectedChannel);
    if (!ch) { body.append(h("p", { class: "hint" }, "Select a channel in the Channel Rack to edit it.")); return; }
    const p = S.project;
    const nameIn = h("input", { type: "text", value: ch.name, class: "insp-name", "aria-label": "Channel name", maxlength: 40 });
    nameIn.onchange = () => { ch.name = nameIn.value.trim() || ch.name; M.changed("channels"); };
    const color = h("button", { class: "swatch big", style: { background: ch.color }, tip: "Change color", "aria-label": "Change color", onclick: (e) => GBL.ui.menu(e.currentTarget, GBL.PALETTE.map((c) => ({ label: c, icon: "●", onClick: () => { ch.color = c; const ins = M.getInsert(ch.insert); if (ins) ins.color = c; M.changed("channels"); } }))) });

    // sound / instrument chooser
    let soundSel;
    if (ch.kind === "synth") {
      soundSel = h("select", { "aria-label": "Instrument" }, GBL.instruments.CATS.map((cat) => h("optgroup", { label: cat }, GBL.instruments.INSTRUMENTS.filter((i) => i.cat === cat).map((i) => h("option", { value: i.id, selected: i.id === ch.inst }, i.icon + " " + i.name)))));
      soundSel.onchange = () => GBL.rack.setInstrument(ch, GBL.instruments.byId[soundSel.value]);
    } else {
      const groups = GBL.samples.CATEGORIES.map((cat) => h("optgroup", { label: cat }, GBL.samples.LIST.filter((s) => s.cat === cat).map((s) => h("option", { value: s.id, selected: s.id === ch.sound }, s.name))));
      const mine = Object.entries(p.assets);
      if (mine.length) groups.unshift(h("optgroup", { label: "My Sounds" }, mine.map(([id, a]) => h("option", { value: "asset:" + id, selected: ch.sound === "asset:" + id }, a.name))));
      soundSel = h("select", { "aria-label": "Sound" }, groups);
      soundSel.onchange = async () => {
        const was = GBL.audio.refName(ch.sound);
        ch.sound = soundSel.value;
        if (ch.name === was) ch.name = GBL.audio.refName(ch.sound);
        if (!ch.sound.startsWith("asset:")) await GBL.samples.render(ch.sound);
        M.changed("channels");
        GBL.audio.engine.hit(ch, null, 0.9);
      };
    }
    const presets = ch.kind === "synth" ? (GBL.instruments.byId[ch.inst] || { presets: [] }).presets : SAMPLE_PRESETS;
    const presetSel = h("select", { "aria-label": "Preset", tip: "Presets set Attack, Release, Cutoff and Reverb for you" },
      h("option", { value: "" }, "— Custom —"), presets.map((pr) => h("option", { value: pr.name, selected: pr.name === ch.preset }, pr.name)));
    presetSel.onchange = () => { const pr = presets.find((x) => x.name === presetSel.value); if (pr) { M.applyPreset(ch, pr); M.changed("channels"); GBL.audio.engine.hit(ch, 60, 0.85, 0.4); } };

    const markCustom = () => { if (ch.preset) { ch.preset = ""; presetSel.value = ""; } };
    const kn = (label, key, min, max, def, extra) => GBL.ui.knob(Object.assign({
      label, min, max, value: ch[key], def, size: 44,
      onInput: (v) => { ch[key] = v; if (["attack", "release", "cutoff", "reverb"].includes(key)) markCustom(); M.changed("live", false); },
      onChange: () => M.changed("inspector"),
    }, extra));
    const fmtS = (v) => (v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s");
    const knobs = h("div", { class: "knob-grid" },
      kn("Volume", "vol", 0, 1.25, 0.8, { color: "var(--green)", fmt: (v) => Math.round((v / 0.8) * 100) + "%", tip: "How loud this channel is" }),
      kn("Pan", "pan", -1, 1, 0, { color: "var(--cyan)", bipolar: true, fmt: (v) => (Math.abs(v) < 0.02 ? "Center" : v < 0 ? "L " + Math.round(-v * 100) : "R " + Math.round(v * 100)), tip: "Move the sound left or right" }),
      kn("Attack", "attack", 0.001, 2, 0.001, { color: "var(--orange)", log: true, fmt: fmtS, tip: "How slowly the sound fades in" }),
      kn("Release", "release", 0.01, 4, ch.kind === "sample" ? 1.5 : 0.2, { color: "var(--orange)", log: true, fmt: fmtS, tip: "How long the sound rings after the note ends" }),
      kn("Cutoff", "cutoff", 0, 1, 1, { color: "var(--purple)", fmt: (v) => { const hz = GBL.audio.cutoffHz(v); return v >= 0.999 ? "Open" : hz >= 1000 ? (hz / 1000).toFixed(1) + " kHz" : Math.round(hz) + " Hz"; }, tip: "Filter: turn down to make it darker and muffled" }),
      kn("Reverb", "reverb", 0, 1, 0, { color: "var(--blue)", fmt: (v) => Math.round(v * 100) + "%", tip: "Adds a room / hall echo" }),
      kn("Pitch", "pitch", -24, 24, 0, { color: "var(--pink)", step: 1, bipolar: true, fmt: (v) => (v > 0 ? "+" : "") + Math.round(v) + " st", tip: "Tune the sound up or down in semitones" }));

    const insSel = h("select", { "aria-label": "Mixer insert", tip: "Which Mixer insert this channel plays through" },
      h("option", { value: "", selected: !ch.insert }, "Master (no insert)"), p.mixer.inserts.map((i) => h("option", { value: i.id, selected: i.id === ch.insert }, i.name)));
    insSel.onchange = () => { ch.insert = insSel.value || null; M.changed("channels"); };

    const wave = ch.kind === "sample" ? h("canvas", { class: "insp-wave", "aria-label": "Waveform" }) : null;
    const kindSwitch = h("button", { class: "btn small adv", tip: ch.kind === "synth" ? "Turn this into a sample channel" : "Turn this into an instrument channel" },
      ch.kind === "synth" ? "🥁 Use a sample instead" : "🎹 Use an instrument instead");
    kindSwitch.onclick = () => {
      if (ch.kind === "synth") { ch.kind = "sample"; ch.sound = "kick"; ch.inst = null; ch.release = 1.5; ch.name = "Kick"; }
      else { ch.kind = "synth"; ch.sound = null; ch.inst = "piano"; ch.name = "Grand Piano"; M.applyPreset(ch, GBL.instruments.byId.piano.presets[0]); }
      M.changed("channels");
    };

    body.append(
      h("div", { class: "insp-row" }, color, nameIn),
      h("label", { class: "form-row" }, h("span", {}, ch.kind === "synth" ? "Instrument" : "Sound"), soundSel),
      h("label", { class: "form-row" }, h("span", {}, "Preset"), presetSel),
      wave,
      knobs,
      h("label", { class: "form-row adv" }, h("span", {}, "Mixer"), insSel),
      h("div", { class: "insp-actions" },
        h("button", { class: "btn small", tip: "Open this channel in the Piano Roll", onclick: () => GBL.rack.openPianoRoll(ch) }, "🎹 Piano Roll"),
        h("button", { class: "btn small", tip: "Hear it", onclick: () => GBL.audio.engine.hit(ch, 60, 0.9, 0.5) }, "🔈 Test"),
        h("button", { class: "btn small adv", tip: "Duplicate this channel", onclick: () => M.duplicateChannel(ch.id) }, "⧉"),
        kindSwitch));
    if (wave) {
      requestAnimationFrame(() => drawWave(wave, ch));
      if (window.ResizeObserver) { let lastW = 0; new ResizeObserver(() => { if (wave.clientWidth && wave.clientWidth !== lastW) { lastW = wave.clientWidth; drawWave(wave, ch); } }).observe(wave); }
    }
  }

  function drawWave(cv, ch) {
    const buf = GBL.audio.resolveBuffer(ch.sound);
    const w = cv.clientWidth || 220, hh = 56;
    const ctx = GBL.fitCanvas(cv, w, hh);
    ctx.clearRect(0, 0, w, hh);
    if (!buf) { GBL.samples.render(ch.sound).then((b) => { if (b) drawWave(cv, ch); }); return; }
    const d = buf.getChannelData(0);
    const per = Math.max(1, Math.floor(d.length / w));
    ctx.fillStyle = ch.color;
    for (let x = 0; x < w; x++) {
      let mx = 0;
      for (let j = 0; j < per; j += 2) mx = Math.max(mx, Math.abs(d[x * per + j] || 0));
      ctx.fillRect(x, hh / 2 - (mx * hh) / 2, 1, Math.max(1, mx * hh));
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "600 10px Fredoka, system-ui, sans-serif";
    ctx.fillText(buf.duration.toFixed(2) + " s", 4, 12);
  }

  GBL.keyboardUI = { keyboard, KEYMAP };
  GBL.inspector = {
    build, render,
    get kb() { return kb; },
    shiftOct,
  };
})();
