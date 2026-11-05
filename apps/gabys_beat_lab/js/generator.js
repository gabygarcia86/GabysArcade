/* MusicGenerator: procedural drums, chords, melodies, basslines, genre templates,
 * song-structure templates and the built-in "Beat Buddy" assistant. Everything it makes
 * is ordinary, editable project data. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { uid, pick, clamp, deepClone } = GBL;
  const M = GBL.model;
  const T = GBL.theory;

  /* ---------- drum styles: rows of 16 steps. x = loud, o = soft ---------- */
  const DRUM_STYLES = {
    hiphop: { kick: "x......x..x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", perc: "...........o...." },
    trap: { kick: "x......x..x....x", clap: "........x.......", hat: "x.x.x.x.xxx.x.xx", ohat: "..............x." },
    edm: { kick: "x...x...x...x...", clap: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", ohat: "..x...x...x...x." },
    rock: { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", cym: "x..............." },
    pop: { kick: "x.....x.x.......", clap: "....x.......x...", hat: "xoxoxoxoxoxoxoxo", perc: "......o.......o." },
    jazz: { kick: "x.........o.....", snare: ".....o.......o..", hat: "....x.......x...", cym: "x..x.xx..x.xx..." },
    lofi: { kick: "x......x..x.....", snare: "....x.......x...", hat: "x.o.x.o.x.o.x.oo", perc: ".......o........" },
    retro: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
    cinematic: { kick: "x.......x.......", tom: "x.....x.x.....x.", snare: "............x...", cym: "x..............." },
    funk: { kick: "x..x..x...x..x..", snare: "....x..o.o..x..o", hat: "xoxoxoxoxoxoxoxo" },
    reggae: { kick: "........x.......", snare: "........x.......", hat: "..x...x...x...x.", perc: "x..............." },
    spooky: { kick: "x.......x..x....", snare: "....x.......x...", hat: "x...x...x...x...", tom: "..............xx" },
  };
  const ROLE_SOUNDS = {
    kick: ["kick", "kick808", "kick_punch", "kick_soft", "r_kick"], snare: ["snare", "snare_tight", "snare_lofi", "r_snare", "rim"], clap: ["clap", "snap"],
    hat: ["hat_closed", "hat_pedal", "r_hat", "shaker"], ohat: ["hat_open"], cym: ["cymbal", "ride"], tom: ["tom", "tom_low", "tom_high"],
    perc: ["perc", "conga_low", "bongo", "cowbell", "woodblock", "tambourine", "claves", "triangle"],
  };
  const ROLE_NAMES = { kick: "Kick", snare: "Snare", clap: "Clap", hat: "Closed Hi-Hat", ohat: "Open Hi-Hat", cym: "Cymbal", tom: "Tom", perc: "Percussion" };
  const ROLE_COLORS = { kick: "#ff4f8b", snare: "#ff8a3d", clap: "#ffd23f", hat: "#4ade80", ohat: "#2dd4bf", cym: "#22d3ee", tom: "#818cf8", perc: "#c084fc" };

  function roleOfChannel(ch) {
    if (ch.kind !== "sample") return null;
    for (const [role, list] of Object.entries(ROLE_SOUNDS)) if (list.includes(ch.sound)) return role;
    return null;
  }
  function findRole(p, role, kit) {
    let ch = p.channels.find((c) => roleOfChannel(c) === role);
    if (!ch) {
      const sound = (kit && kit[role]) || ROLE_SOUNDS[role][0];
      ch = M.newChannel(p, { kind: "sample", sound, name: ROLE_NAMES[role], color: ROLE_COLORS[role] });
      p.channels.push(ch);
    }
    return ch;
  }
  const MEL_ROLE = {
    bass: ["ebass", "synthbass", "subbass", "bass_synth"],
    chords: ["piano", "epiano", "synthpiano", "organ", "strings", "ambient"],
    lead: ["lead", "chiptune", "retro8bit", "retro", "bells", "classic", "guitar", "brass"],
  };
  function findMelodic(p, role, instId) {
    let ch = p.channels.find((c) => c.kind === "synth" && (instId ? c.inst === instId : MEL_ROLE[role].includes(c.inst)));
    if (!ch && !instId) ch = null;
    if (!ch) {
      const inst = GBL.instruments.byId[instId || MEL_ROLE[role][0]];
      ch = M.newChannel(p, { kind: "synth", inst: inst.id, name: inst.name });
      p.channels.push(ch);
    }
    return ch;
  }

  function parseRow(str, len) {
    const out = new Array(len).fill(0);
    for (let i = 0; i < len; i++) { const c = str[i % str.length]; out[i] = c === "x" ? 1 : c === "o" ? 0.55 : 0; }
    return out;
  }

  /* ---------- drums ---------- */
  function makeBeat(p, pat, style, opts = {}) {
    const st = DRUM_STYLES[style] || DRUM_STYLES[pick(Object.keys(DRUM_STYLES))];
    const r = opts.rand || Math.random;
    const len = pat.length;
    if (opts.clear !== false) {
      for (const ch of p.channels) if (ch.kind === "sample" && pat.steps[ch.id]) pat.steps[ch.id] = new Array(len).fill(0);
    }
    for (const [role, row] of Object.entries(st)) {
      const ch = findRole(p, role, opts.kit);
      const steps = parseRow(row, len);
      if (opts.variation) {
        for (let i = 0; i < len; i++) {
          // a little variety in later bars and some ghost notes
          if (role === "hat" && !steps[i] && r() < 0.08) steps[i] = 0.4;
          if (role === "kick" && i % 16 > 8 && !steps[i] && r() < 0.06) steps[i] = 0.8;
          if (role === "snare" && i % 16 === 15 && r() < 0.3) steps[i] = 0.5;
        }
        if (len >= 32 && (role === "snare" || role === "clap") && r() < 0.6) { steps[len - 2] = 0.7; steps[len - 1] = 0.9; }
      }
      pat.steps[ch.id] = steps;
    }
  }

  function randomBeat(p, pat) {
    const styles = Object.keys(DRUM_STYLES);
    const style = pick(styles);
    const r = Math.random;
    makeBeat(p, pat, style, { variation: true });
    // extra spice: random percussion pattern
    if (r() < 0.6) {
      const ch = findRole(p, "perc");
      const s = new Array(pat.length).fill(0);
      for (let i = 0; i < pat.length; i++) if (r() < 0.12) s[i] = r() < 0.5 ? 0.6 : 1;
      pat.steps[ch.id] = s;
    }
    if (r() < 0.4) { const oh = findRole(p, "ohat"); const s = pat.steps[oh.id] || new Array(pat.length).fill(0); for (let i = 2; i < pat.length; i += 4) if (r() < 0.5) s[i] = 0.8; pat.steps[oh.id] = s; }
    return style;
  }

  /* ---------- harmony ---------- */
  function voiceLead(prev, chord) {
    if (!prev) return chord;
    const cands = [];
    for (let inv = 0; inv < 3; inv++) {
      let c = chord.slice();
      for (let k = 0; k < inv; k++) { c.push(c.shift() + 12); }
      for (const shift of [-12, 0, 12]) cands.push(c.map((n) => n + shift));
    }
    const avgPrev = prev.reduce((a, b) => a + b, 0) / prev.length;
    let best = chord, bd = Infinity;
    for (const c of cands) {
      const avg = c.reduce((a, b) => a + b, 0) / c.length;
      const d = Math.abs(avg - avgPrev) + (c[0] < 50 || c[c.length - 1] > 79 ? 20 : 0);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function progression(scale, style) {
    if (style === "jazz") return scale.mode === "minor" ? [1, 4, 0, 0] : [1, 4, 0, 5];
    if (style === "spooky") return [0, 5, 1, 4];
    if (style === "reggae") return scale.mode === "minor" ? [0, 3, 0, 4] : [0, 3, 4, 3];
    const list = T.PROGRESSIONS[scale.mode || "major"];
    return pick(list);
  }

  /* Chord rhythm patterns per bar (start, length) in steps for a 16-step bar. */
  const CHORD_RHYTHMS = {
    sustain: [[0, 16]], half: [[0, 8], [8, 8]], reggae: [[2, 1], [6, 1], [10, 1], [14, 1]], funk: [[0, 2], [3, 2], [7, 1], [10, 2], [14, 2]],
    jazz: [[0, 3], [6, 4], [12, 2]], pulse: [[0, 3], [4, 3], [8, 3], [12, 3]], house: [[2, 2], [6, 2], [10, 2], [14, 2]],
  };

  function makeChords(p, pat, ch, scale, opts = {}) {
    const spb = M.stepsPerBar(p);
    const bars = Math.max(1, Math.round(pat.length / spb));
    const prog = opts.prog || progression(scale, opts.style);
    const rhythm = CHORD_RHYTHMS[opts.rhythm || "sustain"];
    const notes = (pat.notes[ch.id] = opts.keep ? pat.notes[ch.id] || [] : []);
    let prev = null;
    const chords = [];
    for (let b = 0; b < bars; b++) {
      const deg = prog[b % prog.length];
      let chord = T.diatonicChord(scale, deg, opts.base || 60, opts.seventh);
      chord = voiceLead(prev, chord);
      prev = chord;
      chords.push({ deg, notes: chord, start: b * spb });
      for (const [s, l] of rhythm) {
        if (s >= spb) continue;
        const L = Math.min(l, spb - s);
        for (const n of chord) notes.push({ id: uid("n"), p: n, s: b * spb + s, l: L, v: opts.vel || 0.7 });
      }
    }
    return chords;
  }

  function chordsFor(p, pat, scale, prog, opts) {
    const spb = M.stepsPerBar(p);
    const bars = Math.max(1, Math.round(pat.length / spb));
    const out = [];
    for (let b = 0; b < bars; b++) out.push({ deg: prog[b % prog.length], notes: T.diatonicChord(scale, prog[b % prog.length], 60), start: b * spb });
    return out;
  }

  function makeMelody(p, pat, ch, scale, chords, opts = {}) {
    const r = opts.rand || Math.random;
    const density = opts.density == null ? 0.55 : opts.density;
    const lo = opts.lo || 67, hi = opts.hi || 84;
    const pool = T.scaleNotes(scale.mode ? scale : T.SCALES[1], lo, hi);
    const notes = (pat.notes[ch.id] = []);
    const spb = M.stepsPerBar(p);
    let idx = Math.floor(pool.length / 2);
    // build a 2-bar motif and repeat it with variation, like real tunes do
    const motifLen = Math.min(pat.length, spb * 2);
    const rhythm = [];
    for (let s = 0; s < motifLen; s++) {
      const strong = s % 4 === 0;
      const prob = strong ? density + 0.25 : s % 2 === 0 ? density * 0.6 : density * 0.25;
      if (r() < prob) rhythm.push(s);
    }
    if (!rhythm.length) rhythm.push(0);
    for (let rep = 0; rep * motifLen < pat.length; rep++) {
      const base = rep * motifLen;
      const last = base + motifLen >= pat.length;
      for (let k = 0; k < rhythm.length; k++) {
        const s = base + rhythm[k];
        if (s >= pat.length) break;
        const chord = chords.slice().reverse().find((c) => c.start <= s) || chords[0];
        const strong = rhythm[k] % 4 === 0;
        if (strong || r() < 0.3) {
          // move to the nearest chord tone
          const tones = pool.map((n, i) => [n, i]).filter(([n]) => chord.notes.some((c) => ((c - n) % 12 + 12) % 12 === 0));
          if (tones.length) {
            let best = tones[0], bd = 99;
            for (const t of tones) { const d = Math.abs(t[1] - idx) + r() * 1.5; if (d < bd) { bd = d; best = t; } }
            idx = best[1];
          }
        } else {
          idx += pick([-2, -1, -1, 1, 1, 2, 0], r);
        }
        if (rep % 2 === 1 && k === rhythm.length - 1) idx += pick([-1, 1], r);
        idx = clamp(idx, 0, pool.length - 1);
        const next = k + 1 < rhythm.length ? base + rhythm[k + 1] : base + motifLen;
        const len = clamp(next - s, 1, opts.maxLen || 4);
        notes.push({ id: uid("n"), p: pool[idx], s, l: len, v: strong ? 0.85 : 0.7 });
      }
      if (last && notes.length) {
        // end the phrase on the root
        const n = notes[notes.length - 1];
        const root = pool.filter((x) => ((x - scale.root) % 12 + 12) % 12 === 0);
        if (root.length) n.p = root.reduce((a, b) => (Math.abs(b - n.p) < Math.abs(a - n.p) ? b : a));
      }
    }
  }

  const BASS_STYLES = {
    follow: null, // follows the kick drum
    eighths: [0, 2, 4, 6, 8, 10, 12, 14],
    offbeat: [2, 6, 10, 14],
    funk: [0, 3, 6, 7, 10, 12, 14],
    sustain: [0],
    reggae: [0, 3, 6, 8, 11],
    walk: [0, 4, 8, 12],
  };
  function makeBass(p, pat, ch, scale, chords, opts = {}) {
    const style = opts.bassStyle || "follow";
    const spb = M.stepsPerBar(p);
    const notes = (pat.notes[ch.id] = []);
    let hits;
    if (style === "follow") {
      const kick = p.channels.find((c) => roleOfChannel(c) === "kick");
      const ks = kick && pat.steps[kick.id];
      hits = [];
      for (let s = 0; s < pat.length; s++) if (ks && ks[s] > 0) hits.push(s);
      if (!hits.length) for (let s = 0; s < pat.length; s += 4) hits.push(s);
    } else {
      hits = [];
      const row = BASS_STYLES[style];
      for (let b = 0; b * spb < pat.length; b++) for (const s of row) if (s < spb && b * spb + s < pat.length) hits.push(b * spb + s);
    }
    const base = opts.base || 36;
    for (let i = 0; i < hits.length; i++) {
      const s = hits[i];
      const chord = chords.slice().reverse().find((c) => c.start <= s) || chords[0];
      let root = chord.notes[0];
      while (root > base + 11) root -= 12;
      while (root < base) root += 12;
      let pitch = root;
      if (style === "funk" && i % 3 === 2) pitch = root + 12;
      if (style === "reggae" && i % 5 === 3) pitch = root + 7;
      if (style === "walk") { const tones = [0, 4, 7, 9]; pitch = T.snapToScale(root + tones[i % 4], scale); }
      const next = i + 1 < hits.length ? hits[i + 1] : pat.length;
      const len = style === "sustain" ? spb : clamp(next - s, 1, style === "offbeat" ? 2 : 4);
      notes.push({ id: uid("n"), p: pitch, s, l: len, v: 0.85 });
    }
  }

  function extendPattern(pat, len) {
    if (pat.length >= len) return;
    const old = pat.length;
    for (const k of Object.keys(pat.steps)) {
      const a = pat.steps[k];
      const src = a.slice(0, old);
      const out = [];
      for (let i = 0; i < len; i++) out.push(src[i % old] || 0);
      pat.steps[k] = out;
    }
    for (const k of Object.keys(pat.notes)) {
      const add = [];
      for (let rep = 1; rep * old < len; rep++) for (const n of pat.notes[k]) if (n.s < old) add.push(Object.assign({}, n, { id: uid("n"), s: n.s + rep * old }));
      pat.notes[k].push(...add);
    }
    pat.length = len;
  }

  /* ---------- genre templates ---------- */
  const GENRES = [
    { id: "hiphop", name: "Hip-Hop", emoji: "🧢", bpm: 92, swing: 0.25, scale: "A-minor", drums: "hiphop", kit: { kick: "kick_punch", snare: "snare" },
      inst: { chords: "epiano", bass: "subbass", lead: "bells" }, chordRhythm: "half", bassStyle: "follow", density: 0.35, fx: { chords: [["reverb", { mix: 0.25 }]] } },
    { id: "edm", name: "EDM", emoji: "🎆", bpm: 126, swing: 0, scale: "F-major", drums: "edm", kit: { kick: "kick_punch" },
      inst: { chords: "synthpiano", bass: "bass_synth", lead: "lead" }, chordRhythm: "house", bassStyle: "offbeat", density: 0.6, fx: { lead: [["delay", { mix: 0.25 }], ["reverb", { mix: 0.3 }]], chords: [["reverb", { mix: 0.3 }]] } },
    { id: "rock", name: "Rock", emoji: "🎸", bpm: 128, swing: 0, scale: "E-minor", drums: "rock", kit: {},
      inst: { chords: "guitar", bass: "ebass", lead: "lead" }, chordRhythm: "pulse", bassStyle: "eighths", density: 0.5, fx: { chords: [["distortion", { drive: 0.55, mix: 0.9 }]] } },
    { id: "pop", name: "Pop", emoji: "🎤", bpm: 115, swing: 0, scale: "C-major", drums: "pop", kit: {},
      inst: { chords: "piano", bass: "synthbass", lead: "classic" }, chordRhythm: "pulse", bassStyle: "follow", density: 0.55, fx: { chords: [["reverb", { mix: 0.25 }]], lead: [["chorus", {}]] } },
    { id: "jazz", name: "Jazz", emoji: "🎷", bpm: 104, swing: 0.55, scale: "F-major", drums: "jazz", kit: { kick: "kick_soft", snare: "snare_lofi", cym: "ride" },
      inst: { chords: "epiano", bass: "ebass", lead: "brass" }, chordRhythm: "jazz", bassStyle: "walk", seventh: true, density: 0.5, fx: { chords: [["reverb", { mix: 0.3 }]] } },
    { id: "lofi", name: "Lo-Fi", emoji: "☕", bpm: 80, swing: 0.35, scale: "D-major", drums: "lofi", kit: { kick: "kick_soft", snare: "snare_lofi" },
      inst: { chords: "epiano", bass: "subbass", lead: "bells" }, chordRhythm: "sustain", bassStyle: "follow", seventh: true, density: 0.3,
      fx: { chords: [["filter", { cutoff: 2200 }], ["reverb", { mix: 0.35 }]], drums: [["filter", { cutoff: 4500 }]] } },
    { id: "retro", name: "Retro Video Game", emoji: "👾", bpm: 140, swing: 0, scale: "C-major", drums: "retro", kit: { kick: "r_kick", snare: "r_snare", hat: "r_hat" },
      inst: { chords: "retro8bit", bass: "retro8bit", lead: "chiptune" }, chordRhythm: "pulse", bassStyle: "eighths", density: 0.7, fx: { lead: [["echo", { mix: 0.2 }]] } },
    { id: "cinematic", name: "Cinematic", emoji: "🎬", bpm: 90, swing: 0, scale: "C-minor", drums: "cinematic", kit: { tom: "tom_low" },
      inst: { chords: "strings", bass: "subbass", lead: "brass" }, chordRhythm: "sustain", bassStyle: "sustain", density: 0.35, fx: { chords: [["reverb", { size: 4, mix: 0.45 }]], lead: [["reverb", { size: 3.5, mix: 0.4 }]] } },
    { id: "funk", name: "Funk", emoji: "🕺", bpm: 108, swing: 0.12, scale: "E-minor", drums: "funk", kit: { kick: "kick_punch", snare: "snare_tight" },
      inst: { chords: "organ", bass: "ebass", lead: "brass" }, chordRhythm: "funk", bassStyle: "funk", seventh: true, density: 0.55, fx: { chords: [["phaser", { mix: 0.4 }]] } },
    { id: "reggae", name: "Reggae", emoji: "🌴", bpm: 76, swing: 0.1, scale: "G-major", drums: "reggae", kit: { snare: "rim", perc: "cowbell" },
      inst: { chords: "organ", bass: "ebass", lead: "guitar" }, chordRhythm: "reggae", bassStyle: "reggae", density: 0.4, fx: { chords: [["echo", { mix: 0.2 }]], drums: [["reverb", { mix: 0.15 }]] } },
  ];
  const SPOOKY = { id: "spooky", name: "Spooky", emoji: "🎃", bpm: 100, swing: 0, scale: "C-minor", drums: "spooky", kit: { tom: "tom_low" },
    inst: { chords: "organ", bass: "subbass", lead: "bells" }, chordRhythm: "half", bassStyle: "sustain", density: 0.4, fx: { chords: [["reverb", { size: 4, mix: 0.45 }]], lead: [["echo", { mix: 0.35 }]] } };
  const genreById = (id) => GENRES.find((g) => g.id === id) || (id === "spooky" ? SPOOKY : null);

  function addFx(p, ch, list) {
    const ins = p.mixer.inserts.find((i) => i.id === ch.insert);
    if (!ins || !list) return;
    for (const [type, params] of list) {
      const fx = M.newFx(type);
      Object.assign(fx.params, params);
      ins.fx.push(fx);
    }
  }

  function strip(pat, keepIds) {
    const out = deepClone(pat);
    out.id = uid("pat");
    for (const k of Object.keys(out.steps)) if (!keepIds.includes(k)) delete out.steps[k];
    for (const k of Object.keys(out.notes)) if (!keepIds.includes(k)) delete out.notes[k];
    return out;
  }

  /* Build a complete new project for a genre. */
  function genreProject(gid) {
    const g = genreById(gid) || pick(GENRES);
    const p = M.createProject({ empty: true, name: g.name + " Jam" });
    p.bpm = g.bpm; p.swing = g.swing;
    p.patterns = [];
    const scale = T.scaleById(g.scale);
    const spb = M.stepsPerBar(p);
    const len = spb * 4;
    // drums
    const drums = M.newPattern(p, "Drums", len);
    p.patterns.push(drums);
    makeBeat(p, drums, g.drums, { kit: g.kit, variation: true });
    const drumChs = p.channels.filter((c) => c.kind === "sample");
    // melodic channels
    const chordCh = findMelodic(p, "chords", g.inst.chords);
    const bassCh = g.inst.bass === g.inst.chords ? (() => { const inst = GBL.instruments.byId[g.inst.bass]; const c = M.newChannel(p, { kind: "synth", inst: inst.id, name: inst.name + " Bass" }); p.channels.push(c); return c; })() : findMelodic(p, "bass", g.inst.bass);
    const leadCh = [g.inst.chords, g.inst.bass].includes(g.inst.lead) ? (() => { const inst = GBL.instruments.byId[g.inst.lead]; const c = M.newChannel(p, { kind: "synth", inst: inst.id, name: inst.name + " Lead" }); p.channels.push(c); return c; })() : findMelodic(p, "lead", g.inst.lead);
    if (g.id === "retro") bassCh.pitch = -12;
    const prog = progression(scale, g.id);
    const chordsPat = M.newPattern(p, "Chords", len);
    chordsPat.color = "#a855f7";
    const chords = makeChords(p, chordsPat, chordCh, scale, { prog, rhythm: g.chordRhythm, seventh: g.seventh, style: g.id });
    const bassPat = M.newPattern(p, "Bass", len);
    bassPat.color = "#ff8a3d";
    // bass follows the kick of the drum pattern
    bassPat.steps = {};
    const tmp = Object.assign({}, bassPat, { steps: drums.steps });
    makeBass(p, tmp, bassCh, scale, chords, { bassStyle: g.bassStyle });
    bassPat.notes = tmp.notes;
    const melPat = M.newPattern(p, "Melody", len);
    melPat.color = "#22d3ee";
    makeMelody(p, melPat, leadCh, scale, chords, { density: g.density });
    const intro = strip(drums, drumChs.filter((c) => ["hat", "perc", "ohat"].includes(roleOfChannel(c))).map((c) => c.id));
    intro.name = "Drums Intro"; intro.color = "#4ade80";
    p.patterns.push(chordsPat, bassPat, melPat, intro);
    drums.color = "#ff4f8b";
    // fx
    addFx(p, chordCh, g.fx.chords);
    addFx(p, leadCh, g.fx.lead);
    if (g.fx.drums) for (const c of drumChs) addFx(p, c, g.fx.drums);
    if (["hiphop", "lofi", "edm", "pop"].includes(g.id)) { const kc = drumChs.find((c) => roleOfChannel(c) === "kick"); if (kc) addFx(p, kc, [["compressor", { threshold: -18, ratio: 4 }]]); }
    // arrangement
    const trk = (type) => p.tracks.find((t) => t.type === type);
    const sections = [["Intro", ["intro", "chords"]], ["Verse", ["drums", "bass", "chords"]], ["Chorus", ["drums", "bass", "chords", "melody"]],
      ["Verse", ["drums", "bass", "chords"]], ["Chorus", ["drums", "bass", "chords", "melody"]], ["Outro", ["intro", "chords"]]];
    const map = { intro: [intro, "Drums"], drums: [drums, "Drums"], bass: [bassPat, "Bass"], chords: [chordsPat, "Chords"], melody: [melPat, "Melody"] };
    sections.forEach(([name, parts], i) => {
      const start = i * len;
      p.markers.push({ id: uid("mk"), start, name });
      for (const part of parts) {
        const [pat, type] = map[part];
        p.clips.push({ id: uid("clip"), track: trk(type).id, type: "pattern", ref: pat.id, start, len });
      }
    });
    p.mode = "song";
    p.currentPattern = drums.id;
    p.genre = g.id;
    return p;
  }

  /* ---------- song structure templates (applied to the current project) ---------- */
  const STRUCTURES = [
    { id: "classic", name: "Intro → Verse → Chorus → Verse → Chorus → Outro", parts: ["Intro", "Verse", "Chorus", "Verse", "Chorus", "Outro"] },
    { id: "short", name: "Verse → Chorus → Verse → Chorus", parts: ["Verse", "Chorus", "Verse", "Chorus"] },
    { id: "edm", name: "Intro → Build-Up → Drop → Break → Drop → Outro", parts: ["Intro", "Build-Up", "Drop", "Break", "Drop", "Outro"] },
    { id: "abab", name: "A → B → A → B (simple)", parts: ["A", "B", "A", "B"] },
  ];

  function makeVariation(p, base, kind) {
    const v = deepClone(base);
    v.id = uid("pat");
    for (const k of Object.keys(v.notes)) v.notes[k] = v.notes[k].map((n) => Object.assign(n, { id: uid("n") }));
    const roles = (id) => roleOfChannel(M.getChannel(id) || p.channels.find((c) => c.id === id) || {});
    if (kind === "light") {
      for (const k of Object.keys(v.steps)) if (["kick", "snare", "clap", "tom", "cym"].includes(roles(k))) v.steps[k] = v.steps[k].map(() => 0);
      for (const k of Object.keys(v.notes)) { const ch = p.channels.find((c) => c.id === k); if (ch && MEL_ROLE.bass.includes(ch.inst)) v.notes[k] = []; }
    } else if (kind === "big") {
      const cym = findRole(p, "cym");
      const s = v.steps[cym.id] || new Array(v.length).fill(0);
      s[0] = 1;
      v.steps[cym.id] = s;
    } else if (kind === "build") {
      const sn = findRole(p, "snare");
      const s = new Array(v.length).fill(0);
      const half = Math.floor(v.length / 2);
      for (let i = 0; i < v.length; i++) if ((i < half && i % 4 === 0) || (i >= half && i % 2 === 0) || i >= v.length - 4) s[i] = 0.5 + (i / v.length) * 0.5;
      v.steps[sn.id] = s;
      for (const k of Object.keys(v.steps)) if (roles(k) === "kick") v.steps[k] = v.steps[k].map((x, i) => (i < half ? x : 0));
    }
    return v;
  }

  function applyStructure(p, sid) {
    const st = STRUCTURES.find((s) => s.id === sid) || STRUCTURES[0];
    const base = M.getPattern();
    const len = base.length;
    const kinds = { Intro: "light", Outro: "light", Break: "light", "Build-Up": "build", Chorus: "big", Drop: "big", B: "big" };
    const made = {};
    const track = p.tracks.find((t) => t.type === "Drums") || p.tracks[0];
    p.clips = p.clips.filter((c) => c.track !== track.id);
    p.markers = [];
    st.parts.forEach((part, i) => {
      const kind = kinds[part];
      let pat = base;
      if (kind) {
        if (!made[part]) {
          made[part] = makeVariation(p, base, kind);
          made[part].name = base.name + " " + part;
          made[part].color = GBL.PALETTE[(p.patterns.length + 2) % GBL.PALETTE.length];
          p.patterns.push(made[part]);
        }
        pat = made[part];
      }
      const start = i * len;
      p.markers.push({ id: uid("mk"), start, name: part });
      p.clips.push({ id: uid("clip"), track: track.id, type: "pattern", ref: pat.id, start, len });
    });
    p.mode = "song";
  }

  /* ---------- Beat Buddy: the built-in music assistant ---------- */
  const KEYWORDS = [
    [/hip ?hop|rap|boom ?bap/, "hiphop"], [/trap/, "trap"], [/edm|dance|electronic|house|techno|club|rave/, "edm"], [/rock|metal|punk/, "rock"],
    [/pop/, "pop"], [/jazz|swing/, "jazz"], [/lo-?fi|chill|study|relax/, "lofi"], [/video ?game|8-?bit|retro|chiptune|arcade|game/, "retro"],
    [/cinematic|movie|film|epic|trailer|orchestra/, "cinematic"], [/funk|disco|groove/, "funk"], [/reggae|island/, "reggae"],
    [/spooky|halloween|scary|creepy|ghost|haunted|monster/, "spooky"],
  ];

  function detectGenre(text) {
    for (const [re, g] of KEYWORDS) if (re.test(text)) return g;
    return null;
  }

  function assistant(text) {
    const t = " " + text.toLowerCase() + " ";
    const p = M.state.project;
    let pat = M.getPattern();
    const genre = detectGenre(t);
    const g = genre === "trap" ? Object.assign({}, genreById("hiphop"), { drums: "trap", bpm: 140, kit: { kick: "kick808" } }) : genreById(genre);
    const happy = /happy|cheer|bright|sunny|fun/.test(t), sad = /sad|dark|moody|lonely/.test(t);
    let scale = T.scaleById(g ? g.scale : happy ? "C-major" : sad ? "A-minor" : "C-major");
    if (happy && scale.mode === "minor") scale = T.scaleById("C-major");
    if (sad && scale.mode === "major") scale = T.scaleById("A-minor");
    const said = [];

    // modifiers on the existing song
    if (/futuristic|space|robot|sci-?fi|future/.test(t) && !/beat|melody|bass|song|intro/.test(t)) {
      let n = 0;
      for (const ch of p.channels) {
        if (ch.kind !== "synth") continue;
        const was = ch.inst;
        ch.inst = MEL_ROLE.bass.includes(was) ? "bass_synth" : was === "piano" || was === "epiano" || was === "organ" ? "ambient" : "lead";
        ch.name = GBL.instruments.byId[ch.inst].name;
        const ins = p.mixer.inserts.find((i) => i.id === ch.insert);
        if (ins && !ins.fx.some((f) => f.type === "phaser")) { ins.fx.push(M.newFx("phaser")); const d = M.newFx("delay"); d.params.mix = 0.25; ins.fx.push(d); }
        n++;
      }
      M.changed("assistant");
      return n ? "🚀 Zoom! I swapped " + n + " instrument" + (n > 1 ? "s" : "") + " for spacey synths and added Phaser + Delay effects in the Mixer." : "Add a melody or bass first, then ask me again to make it futuristic!";
    }
    if (/faster|speed up|quicker/.test(t)) { p.bpm = clamp(p.bpm + 15, 40, 220); M.changed("bpm"); return "⏩ Faster! Tempo is now " + p.bpm + " BPM."; }
    if (/slower|slow down/.test(t)) { p.bpm = clamp(p.bpm - 15, 40, 220); M.changed("bpm"); return "🐢 Slowed it down to " + p.bpm + " BPM."; }
    if (/more reverb|echoey|bigger room|spacious/.test(t)) {
      for (const ch of p.channels) ch.reverb = clamp((ch.reverb || 0) + 0.25, 0, 1);
      M.changed("assistant");
      return "🏛️ Added more reverb to every instrument. Turn individual Reverb knobs down in the Instrument panel if it's too much.";
    }

    const wantsSong = /song|track|soundtrack|tune for|full|whole|music for/.test(t) && !/melody|bass|beat only/.test(t);
    const wantsIntro = /intro/.test(t);
    if (wantsSong && !wantsIntro) return { newProject: genreProject(genre === "trap" ? "hiphop" : genre || pick(GENRES).id), message: "🎉 I built a whole " + (g ? g.name : "new") + " song with drums, bass, chords and a melody, arranged as Intro → Verse → Chorus → Verse → Chorus → Outro. Press Play, then change anything you like!" };

    const wantsBeat = /beat|drum|rhythm|groove/.test(t);
    const wantsMelody = /melody|tune|lead|riff/.test(t);
    const wantsBass = /bass/.test(t);
    const wantsChords = /chord|harmony|pad/.test(t);
    const none = !wantsBeat && !wantsMelody && !wantsBass && !wantsChords && !wantsIntro;

    if (g) { p.bpm = g.bpm; p.swing = g.swing; said.push("set the tempo to " + p.bpm + " BPM"); }

    if (wantsIntro) {
      const intro = M.addPattern("Intro");
      pat = intro;
      M.setPatternLength(pat, M.stepsPerBar(p) * 4);
      const st = g ? g.drums : "lofi";
      makeBeat(p, pat, st, { kit: g && g.kit });
      for (const ch of p.channels) if (["kick", "snare", "clap"].includes(roleOfChannel(ch))) pat.steps[ch.id] = new Array(pat.length).fill(0);
      const chordCh = findMelodic(p, "chords", g ? g.inst.chords : "ambient");
      const chords = makeChords(p, pat, chordCh, scale, { rhythm: "sustain", style: genre });
      const lead = findMelodic(p, "lead", g ? g.inst.lead : "bells");
      makeMelody(p, pat, lead, scale, chords, { density: 0.25 });
      M.changed("assistant");
      return "🌅 I made a calm \"Intro\" pattern (hi-hats, sustained " + T.scaleById(scale.id).name + " chords and a gentle melody). Put it at the start of your Playlist!";
    }

    if (none && !g) return "I can make beats, melodies, basslines, chords or whole songs! Try: “Make me a hip-hop beat”, “Create a happy video game melody” or “Make a spooky Halloween soundtrack”.";

    const needsMelodic = wantsMelody || wantsBass || wantsChords || none;
    if (needsMelodic && pat.length < M.stepsPerBar(p) * 4) { extendPattern(pat, M.stepsPerBar(p) * 4); said.push("made the pattern 4 bars long"); }

    if (wantsBeat || none) {
      const style = genre || pick(Object.keys(DRUM_STYLES));
      makeBeat(p, pat, style === "trap" ? "trap" : (g && g.drums) || style, { kit: g && g.kit, variation: true });
      said.push("made a " + (g ? g.name : style) + " drum beat");
    }
    const prog = progression(scale, genre);
    let chords = chordsFor(p, pat, scale, prog);
    if (wantsChords || none) {
      const ch = findMelodic(p, "chords", g ? g.inst.chords : null);
      chords = makeChords(p, pat, ch, scale, { prog, rhythm: g ? g.chordRhythm : "sustain", seventh: g && g.seventh, style: genre });
      said.push("wrote " + scale.name + " chords on " + ch.name);
      GBL.model.state.pianoRollChannel = ch.id;
    }
    if (wantsBass || none) {
      const ch = findMelodic(p, "bass", g ? g.inst.bass : null);
      makeBass(p, pat, ch, scale, chords, { bassStyle: g ? g.bassStyle : pick(["follow", "eighths", "funk", "offbeat"]) });
      said.push("added a bassline on " + ch.name);
      GBL.model.state.pianoRollChannel = ch.id;
    }
    if (wantsMelody || none) {
      const ch = findMelodic(p, "lead", g ? g.inst.lead : happy ? "chiptune" : null);
      makeMelody(p, pat, ch, scale, chords, { density: g ? g.density : happy ? 0.65 : 0.45 });
      said.push("composed a " + (happy ? "happy " : sad ? "moody " : "") + "melody on " + ch.name);
      GBL.model.state.pianoRollChannel = ch.id;
    }
    M.changed("assistant");
    return "✨ Done! I " + said.join(", ") + ". Everything is editable in the Channel Rack and Piano Roll.";
  }

  GBL.generator = {
    DRUM_STYLES, GENRES, SPOOKY, STRUCTURES, genreById, makeBeat, randomBeat, makeChords, makeMelody, makeBass, chordsFor, progression,
    extendPattern, genreProject, applyStructure, assistant, roleOfChannel, findMelodic, findRole, CHORD_RHYTHMS, BASS_STYLES,
  };
})();
