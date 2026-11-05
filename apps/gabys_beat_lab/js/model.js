/* Project data model, editor state and undo/redo history.
 * Time is measured in steps (1 step = one 16th note) everywhere. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { uid, deepClone, bus, clamp, PALETTE } = GBL;

  const FORMAT = "beatlab";
  const VERSION = 1;

  const DRUM_DEFAULTS = [
    ["Kick", "kick", "#ff4f8b"], ["Snare", "snare", "#ff8a3d"], ["Clap", "clap", "#ffd23f"], ["Closed Hi-Hat", "hat_closed", "#4ade80"],
    ["Open Hi-Hat", "hat_open", "#2dd4bf"], ["Cymbal", "cymbal", "#22d3ee"], ["Tom", "tom", "#818cf8"], ["Percussion", "perc", "#c084fc"],
  ];
  const TRACK_TYPES = [
    { type: "Drums", color: "#ff4f8b", icon: "🥁" }, { type: "Bass", color: "#ff8a3d", icon: "🎸" }, { type: "Melody", color: "#22d3ee", icon: "🎵" },
    { type: "Chords", color: "#a855f7", icon: "🎹" }, { type: "Synth", color: "#3b82f6", icon: "🎛️" }, { type: "Vocals", color: "#f472b6", icon: "🎤" },
    { type: "Sound Effects", color: "#4ade80", icon: "💥" },
  ];

  function stepsPerBar(p) { const [n, d] = p.timeSig; return Math.round(n * (16 / d)); }
  function stepsPerBeat(p) { return Math.round(16 / p.timeSig[1]); }

  function newInsert(name, color) {
    return { id: uid("ins"), name: name || "Insert", color: color || "#64748b", vol: 0.8, pan: 0, mute: false, solo: false, fx: [] };
  }

  function newChannel(project, opts) {
    const o = Object.assign({ kind: "sample", sound: "kick", inst: null, name: "Channel" }, opts);
    const ch = {
      id: uid("ch"), name: o.name, kind: o.kind, sound: o.kind === "sample" ? o.sound : null, inst: o.kind === "synth" ? o.inst : null,
      color: o.color || PALETTE[project.channels.length % PALETTE.length], vol: o.vol != null ? o.vol : 0.8, pan: 0, mute: false, solo: false,
      attack: 0.001, release: o.kind === "sample" ? 1.5 : 0.2, cutoff: 1, reverb: 0, pitch: 0, root: 60, preset: "", insert: null,
    };
    if (ch.kind === "synth") {
      const inst = GBL.instruments.byId[ch.inst] || GBL.instruments.INSTRUMENTS[0];
      ch.inst = inst.id;
      ch.color = o.color || inst.color;
      applyPreset(ch, inst.presets[0]);
    }
    const ins = newInsert(ch.name, ch.color);
    project.mixer.inserts.push(ins);
    ch.insert = ins.id;
    return ch;
  }

  function applyPreset(ch, preset) {
    if (!preset) return;
    ch.preset = preset.name;
    ch.attack = preset.attack; ch.release = preset.release; ch.cutoff = preset.cutoff; ch.reverb = preset.reverb;
  }

  function newPattern(project, name, length) {
    const n = project.patterns.length + 1;
    return { id: uid("pat"), name: name || "Pattern " + n, color: PALETTE[(n - 1) % PALETTE.length], length: length || 16, steps: {}, notes: {} };
  }

  function createProject(opts = {}) {
    const p = {
      format: FORMAT, version: VERSION, id: uid("prj"), name: opts.name || "My Song", created: Date.now(),
      bpm: 120, timeSig: [4, 4], swing: 0, masterVol: 0.85, mode: "pattern", loop: true,
      channels: [], patterns: [], currentPattern: null, tracks: [], clips: [], markers: [],
      mixer: { inserts: [], master: { vol: 0.85, eq: { low: 0, mid: 0, high: 0 }, fx: [] } },
      assets: {},
    };
    if (!opts.empty) {
      for (const [name, sound, color] of DRUM_DEFAULTS) p.channels.push(newChannel(p, { kind: "sample", sound, name, color }));
      p.channels.push(newChannel(p, { kind: "synth", inst: "piano", name: "Grand Piano" }));
      p.channels.push(newChannel(p, { kind: "synth", inst: "bass_synth", name: "Bass Synth" }));
    }
    const pat = newPattern(p, "Pattern 1", 16);
    p.patterns.push(pat);
    p.currentPattern = pat.id;
    TRACK_TYPES.forEach((t, i) => p.tracks.push({ id: uid("trk"), name: t.type, type: t.type, color: t.color, mute: false, solo: false, insert: null }));
    p.tracks.push({ id: uid("trk"), name: "Extra", type: "Melody", color: "#94a3b8", mute: false, solo: false, insert: null });
    return p;
  }

  /* Make sure an object loaded from disk has every field we expect. */
  function normalize(raw) {
    const base = createProject({ empty: true });
    const p = Object.assign(base, raw || {});
    p.format = FORMAT;
    p.bpm = clamp(Number(p.bpm) || 120, 30, 300);
    if (!Array.isArray(p.timeSig) || p.timeSig.length !== 2) p.timeSig = [4, 4];
    p.mixer = Object.assign({ inserts: [], master: {} }, p.mixer);
    p.mixer.master = Object.assign({ vol: 0.85, eq: { low: 0, mid: 0, high: 0 }, fx: [] }, p.mixer.master);
    p.mixer.inserts = (p.mixer.inserts || []).map((i) => Object.assign(newInsert(), i, { fx: (i.fx || []).filter((f) => GBL.effects.DEFS[f.type]) }));
    p.mixer.master.fx = (p.mixer.master.fx || []).filter((f) => GBL.effects.DEFS[f.type]);
    const insIds = new Set(p.mixer.inserts.map((i) => i.id));
    p.channels = (p.channels || []).map((c) => {
      const ch = Object.assign({ attack: 0.001, release: c.kind === "sample" ? 1.5 : 0.2, cutoff: 1, reverb: 0, pitch: 0, root: 60, vol: 0.8, pan: 0, mute: false, solo: false, preset: "" }, c);
      if (ch.insert && !insIds.has(ch.insert)) ch.insert = null;
      return ch;
    });
    p.patterns = (p.patterns || []).map((pt) => Object.assign({ steps: {}, notes: {}, length: 16, color: "#a855f7" }, pt));
    if (!p.patterns.length) p.patterns.push(newPattern(p));
    if (!p.patterns.find((x) => x.id === p.currentPattern)) p.currentPattern = p.patterns[0].id;
    p.tracks = (p.tracks || []).map((t) => Object.assign({ mute: false, solo: false, insert: null, type: "Melody", color: "#94a3b8" }, t));
    if (!p.tracks.length) TRACK_TYPES.forEach((t) => p.tracks.push({ id: uid("trk"), name: t.type, type: t.type, color: t.color, mute: false, solo: false, insert: null }));
    p.clips = (p.clips || []).filter((c) => p.tracks.find((t) => t.id === c.track));
    p.markers = p.markers || [];
    p.assets = p.assets || {};
    return p;
  }

  /* ---------- editor state (not saved in the project) ---------- */
  const state = {
    project: null,
    selectedChannel: null,
    pianoRollChannel: null,
    clipboard: { pattern: null, notes: null },
  };

  const getPattern = (id) => state.project.patterns.find((x) => x.id === (id || state.project.currentPattern));
  const getChannel = (id) => state.project.channels.find((c) => c.id === id);
  const getInsert = (id) => state.project.mixer.inserts.find((i) => i.id === id);
  const getTrack = (id) => state.project.tracks.find((t) => t.id === id);

  function patternLength(pat) { return pat ? pat.length : 16; }

  /* Song length in steps (rounded up to whole bars, at least one bar). */
  function songLength(p) {
    p = p || state.project;
    const spb = stepsPerBar(p);
    let end = 0;
    for (const c of p.clips) end = Math.max(end, c.start + c.len);
    return Math.max(spb, Math.ceil(end / spb) * spb);
  }

  /* ---------- history ---------- */
  const history = {
    past: [], future: [], current: null, limit: 120,
    reset() { this.past = []; this.future = []; this.current = JSON.stringify(state.project); bus.emit("history"); },
    commit(label) {
      const s = JSON.stringify(state.project);
      if (s === this.current) return false;
      if (this.current) this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
      this.current = s;
      this.future = [];
      bus.emit("history");
      bus.emit("dirty", label);
      return true;
    },
    canUndo() { return this.past.length > 0; },
    canRedo() { return this.future.length > 0; },
    undo() {
      if (!this.past.length) return;
      this.future.push(this.current);
      this.current = this.past.pop();
      restore(this.current);
    },
    redo() {
      if (!this.future.length) return;
      this.past.push(this.current);
      this.current = this.future.pop();
      restore(this.current);
    },
  };
  function restore(json) {
    const keepId = state.project && state.project.id;
    state.project = normalize(JSON.parse(json));
    state.project.id = keepId || state.project.id;
    fixSelection();
    bus.emit("project:loaded", { fromHistory: true });
    bus.emit("history");
    bus.emit("dirty", "history");
  }

  function fixSelection() {
    const p = state.project;
    if (!getChannel(state.selectedChannel)) state.selectedChannel = p.channels[0] ? p.channels[0].id : null;
    if (!getChannel(state.pianoRollChannel)) {
      const synth = p.channels.find((c) => c.kind === "synth");
      state.pianoRollChannel = synth ? synth.id : state.selectedChannel;
    }
  }

  function setProject(p, opts = {}) {
    state.project = normalize(p);
    fixSelection();
    history.reset();
    bus.emit("project:loaded", opts);
  }

  /* Notify that the project changed. `scope` lets views skip work. commit=false for live drags. */
  function changed(scope, commit = true) {
    bus.emit("change", scope || "all");
    if (commit) history.commit(scope);
  }

  /* ---------- common operations ---------- */
  function addChannel(opts) {
    const p = state.project;
    const ch = newChannel(p, opts);
    p.channels.push(ch);
    state.selectedChannel = ch.id;
    if (ch.kind === "synth") state.pianoRollChannel = ch.id;
    changed("channels");
    return ch;
  }

  function removeChannel(id) {
    const p = state.project;
    const ch = getChannel(id);
    if (!ch) return;
    p.channels = p.channels.filter((c) => c.id !== id);
    for (const pat of p.patterns) { delete pat.steps[id]; delete pat.notes[id]; }
    // remove its insert if nobody else uses it
    if (ch.insert && !p.channels.some((c) => c.insert === ch.insert) && !p.tracks.some((t) => t.insert === ch.insert)) {
      p.mixer.inserts = p.mixer.inserts.filter((i) => i.id !== ch.insert);
    }
    fixSelection();
    changed("channels");
  }

  function duplicateChannel(id) {
    const p = state.project;
    const ch = getChannel(id);
    if (!ch) return;
    const copy = deepClone(ch);
    copy.id = uid("ch");
    copy.name = ch.name + " 2";
    const ins = newInsert(copy.name, copy.color);
    const old = getInsert(ch.insert);
    if (old) { ins.fx = deepClone(old.fx).map((f) => Object.assign(f, { id: uid("fx") })); ins.vol = old.vol; ins.pan = old.pan; }
    p.mixer.inserts.push(ins);
    copy.insert = ins.id;
    const idx = p.channels.indexOf(ch);
    p.channels.splice(idx + 1, 0, copy);
    for (const pat of p.patterns) {
      if (pat.steps[id]) pat.steps[copy.id] = pat.steps[id].slice();
      if (pat.notes[id]) pat.notes[copy.id] = pat.notes[id].map((n) => Object.assign({}, n, { id: uid("n") }));
    }
    state.selectedChannel = copy.id;
    changed("channels");
  }

  function stepsFor(pat, chId) {
    let a = pat.steps[chId];
    if (!a) a = pat.steps[chId] = [];
    while (a.length < pat.length) a.push(0);
    return a;
  }
  function notesFor(pat, chId) {
    if (!pat.notes[chId]) pat.notes[chId] = [];
    return pat.notes[chId];
  }

  function setPatternLength(pat, len) {
    pat.length = len;
    for (const k of Object.keys(pat.steps)) {
      const a = pat.steps[k];
      if (a.length > len) a.length = len;
      while (a.length < len) a.push(0);
    }
  }

  function addPattern(name, fromId) {
    const p = state.project;
    let pat;
    if (fromId) {
      const src = getPattern(fromId);
      pat = deepClone(src);
      pat.id = uid("pat");
      pat.name = name || src.name + " copy";
      pat.color = PALETTE[p.patterns.length % PALETTE.length];
      for (const k of Object.keys(pat.notes)) pat.notes[k] = pat.notes[k].map((n) => Object.assign(n, { id: uid("n") }));
    } else pat = newPattern(p, name, getPattern() ? getPattern().length : 16);
    p.patterns.push(pat);
    p.currentPattern = pat.id;
    changed("patterns");
    return pat;
  }

  function removePattern(id) {
    const p = state.project;
    if (p.patterns.length <= 1) return false;
    p.patterns = p.patterns.filter((x) => x.id !== id);
    p.clips = p.clips.filter((c) => !(c.type === "pattern" && c.ref === id));
    if (p.currentPattern === id) p.currentPattern = p.patterns[0].id;
    changed("patterns");
    return true;
  }

  function addInsert(name, color) {
    const ins = newInsert(name, color);
    state.project.mixer.inserts.push(ins);
    return ins;
  }

  function newFx(type) { return { id: uid("fx"), type, on: true, params: GBL.effects.defaults(type) }; }

  /* Solo/mute helpers used by the engine and the UI. */
  function channelAudible(ch, p) {
    p = p || state.project;
    if (ch.mute) return false;
    const anySolo = p.channels.some((c) => c.solo);
    return !anySolo || ch.solo;
  }
  function trackAudible(t, p) {
    p = p || state.project;
    if (!t || t.mute) return false;
    const anySolo = p.tracks.some((x) => x.solo);
    return !anySolo || t.solo;
  }

  function channelHasNotes(pat, chId) { return !!(pat.notes[chId] && pat.notes[chId].length); }

  GBL.model = {
    FORMAT, VERSION, DRUM_DEFAULTS, TRACK_TYPES, state, history,
    createProject, normalize, setProject, changed, newChannel, newPattern, newInsert, newFx, applyPreset,
    getPattern, getChannel, getInsert, getTrack, patternLength, songLength, stepsPerBar, stepsPerBeat,
    addChannel, removeChannel, duplicateChannel, stepsFor, notesFor, setPatternLength, addPattern, removePattern, addInsert,
    channelAudible, trackAudible, channelHasNotes, fixSelection,
  };
})();
