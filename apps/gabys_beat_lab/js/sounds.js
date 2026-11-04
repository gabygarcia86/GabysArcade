/* SampleLibrary: every built-in sample is an original sound synthesized in code.
 * Each recipe is rendered once into an AudioBuffer with an OfflineAudioContext,
 * so samples behave exactly like imported audio files (waveforms, pitching, export). */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { midiToFreq } = GBL.theory;
  const SR = 44100;

  /* ---------- tiny synthesis toolkit for recipes ---------- */
  function O(c, type, f, t = 0) {
    const o = c.createOscillator();
    GBL.instruments.setOscType(c, o, type);
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function G(c, v = 1) { const g = c.createGain(); g.gain.value = v; return g; }
  function F(c, type, f, q = 0.7) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function N(c, t = 0, dur = 1) {
    const s = c.createBufferSource();
    s.buffer = GBL.instruments.noiseBuffer(c);
    s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    return s;
  }
  function chunkyNoise(c, t, dur, hold) {
    const len = Math.ceil(c.sampleRate * dur);
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) { if (i % hold === 0) v = Math.random() > 0.5 ? 1 : -1; d[i] = v; }
    const s = c.createBufferSource();
    s.buffer = b;
    s.start(t);
    return s;
  }
  /* exponential decay envelope on a gain param */
  function dec(param, t, peak, decay, attack = 0.001) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[0]; }
  function sweep(param, t, a, b, dur, lin) {
    param.setValueAtTime(a, t);
    if (lin) param.linearRampToValueAtTime(b, t + dur);
    else param.exponentialRampToValueAtTime(Math.max(0.0001, b), t + dur);
  }
  function tone(c, out, type, f, t, decay, peak = 0.5, f2, sweepT) {
    const o = O(c, type, f, t), g = G(c, 0);
    if (f2) sweep(o.frequency, t, f, f2, sweepT || decay);
    dec(g.gain, t, peak, decay);
    chain(o, g, out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  function noiseHit(c, out, t, decay, ftype, freq, q, peak = 0.6, attack = 0.001) {
    const n = N(c, t, decay + 0.05), f = F(c, ftype, freq, q), g = G(c, 0);
    dec(g.gain, t, peak, decay, attack);
    chain(n, f, g, out);
  }
  function metallic(c, out, t, decay, base = 40, hp = 7000, peak = 0.35) {
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    const bp = F(c, "bandpass", 10000, 0.8), hpf = F(c, "highpass", hp, 0.7), g = G(c, 0);
    for (const r of ratios) { const o = O(c, "square", base * r, t); o.connect(bp); o.start(t); o.stop(t + decay + 0.1); }
    dec(g.gain, t, peak, decay);
    chain(bp, hpf, g, out);
  }
  function kick(c, out, t, f1, f2, pitchT, decay, click = 0.3, drive = 0) {
    const o = O(c, "sine", f1, t), g = G(c, 0);
    sweep(o.frequency, t, f1, f2, pitchT);
    dec(g.gain, t, 1, decay);
    if (drive) {
      const ws = c.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * (1 + drive * 4)); }
      ws.curve = curve;
      chain(o, ws, g, out);
    } else chain(o, g, out);
    o.start(t);
    o.stop(t + decay + 0.1);
    if (click) noiseHit(c, out, t, 0.012, "bandpass", 3500, 1, click);
  }
  function formantVoice(c, out, t, dur, f0Points, vowels, opts = {}) {
    // vowels: array of [time, F1, F2, F3]
    const src = O(c, opts.wave || "sawtooth", f0Points[0][1], t);
    for (const [pt, f] of f0Points) src.frequency.linearRampToValueAtTime(f, t + pt);
    const vib = O(c, "sine", 5.5, t), vg = G(c, opts.vib == null ? 6 : opts.vib);
    chain(vib, vg, src.detune);
    const amp = G(c, 0);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(opts.peak || 0.6, t + (opts.attack || 0.04));
    amp.gain.setValueAtTime(opts.peak || 0.6, t + dur - (opts.release || 0.15));
    amp.gain.linearRampToValueAtTime(0, t + dur);
    const gains = [1, 0.5, 0.25];
    for (let k = 0; k < 3; k++) {
      const bp = F(c, "bandpass", vowels[0][k + 1], opts.q || 12);
      for (const v of vowels) bp.frequency.linearRampToValueAtTime(v[k + 1], t + v[0]);
      const g = G(c, gains[k] * 3);
      chain(src, bp, g, amp);
    }
    amp.connect(out);
    src.start(t); src.stop(t + dur + 0.05);
    vib.start(t); vib.stop(t + dur + 0.05);
    if (opts.breath) noiseHit(c, amp, t, 0.08, "highpass", 2500, 0.7, opts.breath);
  }
  function notes(c, out, instId, list) { for (const [m, t, d, v] of list) GBL.instruments.renderNote(c, out, instId, m, t, d, v || 0.9); }

  const V = { a: [800, 1150, 2900], e: [400, 2000, 2550], i: [300, 2300, 3000], o: [450, 800, 2830], u: [325, 700, 2530] };
  const vw = (time, v) => [time, ...V[v]];

  /* ---------- recipes ---------- */
  const R = [];
  const add = (cat, id, name, dur, fn, icon) => R.push({ id, name, cat, dur, fn, icon });

  // DRUMS
  add("Drums", "kick", "Kick", 0.6, (c, o) => kick(c, o, 0, 150, 45, 0.12, 0.5, 0.35), "🥁");
  add("Drums", "kick808", "Kick 808", 1.4, (c, o) => kick(c, o, 0, 70, 42, 0.18, 1.3, 0.25, 0.5), "🥁");
  add("Drums", "kick_punch", "Kick Punchy", 0.45, (c, o) => kick(c, o, 0, 190, 50, 0.07, 0.35, 0.5, 0.3), "🥁");
  add("Drums", "kick_soft", "Kick Soft", 0.5, (c, o) => kick(c, o, 0, 110, 48, 0.1, 0.42, 0.08), "🥁");
  add("Drums", "snare", "Snare", 0.35, (c, o) => {
    tone(c, o, "triangle", 190, 0, 0.12, 0.5, 150, 0.1);
    noiseHit(c, o, 0, 0.22, "highpass", 1400, 0.7, 0.55);
  }, "🪘");
  add("Drums", "snare_tight", "Snare Tight", 0.25, (c, o) => {
    tone(c, o, "triangle", 240, 0, 0.07, 0.5, 200);
    noiseHit(c, o, 0, 0.12, "bandpass", 4200, 0.8, 0.8);
  }, "🪘");
  add("Drums", "snare_lofi", "Snare Lo-Fi", 0.35, (c, o) => {
    const lp = F(c, "lowpass", 3200, 0.7); lp.connect(o);
    tone(c, lp, "triangle", 170, 0, 0.1, 0.5, 140);
    noiseHit(c, lp, 0, 0.25, "bandpass", 1800, 0.6, 0.6);
  }, "🪘");
  add("Drums", "clap", "Clap", 0.4, (c, o) => {
    for (const [t, p] of [[0, 0.7], [0.011, 0.6], [0.023, 0.65]]) noiseHit(c, o, t, 0.012, "bandpass", 1200, 1.2, p);
    noiseHit(c, o, 0.03, 0.22, "bandpass", 1100, 1.1, 0.6);
  }, "👏");
  add("Drums", "hat_closed", "Closed Hi-Hat", 0.12, (c, o) => metallic(c, o, 0, 0.06, 40, 7000, 0.5), "🎩");
  add("Drums", "hat_open", "Open Hi-Hat", 0.5, (c, o) => metallic(c, o, 0, 0.38, 40, 6500, 0.45), "🎩");
  add("Drums", "hat_pedal", "Pedal Hi-Hat", 0.15, (c, o) => { metallic(c, o, 0, 0.08, 42, 8000, 0.35); }, "🎩");
  add("Drums", "cymbal", "Crash Cymbal", 2, (c, o) => {
    metallic(c, o, 0, 1.6, 52, 5000, 0.35);
    noiseHit(c, o, 0, 1.7, "highpass", 5500, 0.6, 0.35);
  }, "💥");
  add("Drums", "ride", "Ride Cymbal", 1.4, (c, o) => {
    metallic(c, o, 0, 1.2, 70, 6000, 0.22);
    tone(c, o, "sine", 3200, 0, 0.9, 0.08);
    tone(c, o, "sine", 4650, 0, 0.6, 0.05);
  }, "🛎️");
  const tom = (f) => (c, o) => { tone(c, o, "sine", f * 1.6, 0, 0.45, 0.9, f, 0.2); noiseHit(c, o, 0, 0.02, "lowpass", 3000, 0.5, 0.2); };
  add("Drums", "tom", "Tom", 0.5, tom(130), "🥁");
  add("Drums", "tom_low", "Tom Low", 0.55, tom(85), "🥁");
  add("Drums", "tom_high", "Tom High", 0.45, tom(190), "🥁");
  add("Drums", "rim", "Rimshot", 0.12, (c, o) => { tone(c, o, "triangle", 1700, 0, 0.04, 0.5); noiseHit(c, o, 0, 0.03, "bandpass", 2500, 2, 0.5); }, "🥢");

  // PERCUSSION
  add("Percussion", "perc", "Conga", 0.4, (c, o) => { tone(c, o, "sine", 360, 0, 0.3, 0.8, 300, 0.05); noiseHit(c, o, 0, 0.01, "bandpass", 2000, 1, 0.3); }, "🪘");
  add("Percussion", "conga_low", "Conga Low", 0.45, (c, o) => { tone(c, o, "sine", 240, 0, 0.35, 0.8, 200, 0.05); noiseHit(c, o, 0, 0.01, "bandpass", 1500, 1, 0.3); }, "🪘");
  add("Percussion", "bongo", "Bongo", 0.25, (c, o) => { tone(c, o, "sine", 520, 0, 0.16, 0.8, 470, 0.03); }, "🪘");
  add("Percussion", "shaker", "Shaker", 0.15, (c, o) => noiseHit(c, o, 0, 0.08, "highpass", 6000, 0.7, 0.5, 0.025), "🧂");
  add("Percussion", "tambourine", "Tambourine", 0.4, (c, o) => {
    metallic(c, o, 0, 0.25, 90, 7000, 0.3);
    for (let i = 0; i < 4; i++) noiseHit(c, o, i * 0.012, 0.15, "highpass", 8000, 0.7, 0.3);
  }, "🪇");
  add("Percussion", "cowbell", "Cowbell", 0.4, (c, o) => {
    const bp = F(c, "bandpass", 1000, 1.2), g = G(c, 0);
    for (const f of [540, 800]) { const x = O(c, "square", f); x.connect(bp); x.start(0); x.stop(0.4); }
    dec(g.gain, 0, 0.6, 0.3);
    chain(bp, g, o);
  }, "🐄");
  add("Percussion", "woodblock", "Woodblock", 0.12, (c, o) => { tone(c, o, "sine", 1100, 0, 0.06, 0.8); noiseHit(c, o, 0, 0.01, "bandpass", 1100, 4, 0.3); }, "🪵");
  add("Percussion", "triangle", "Triangle", 1.5, (c, o) => { tone(c, o, "sine", 1800, 0, 1.3, 0.25); tone(c, o, "sine", 4580, 0, 1, 0.15); tone(c, o, "sine", 7200, 0, 0.6, 0.06); }, "🔺");
  add("Percussion", "claves", "Claves", 0.1, (c, o) => tone(c, o, "sine", 2500, 0, 0.05, 0.7), "🥢");
  add("Percussion", "snap", "Finger Snap", 0.12, (c, o) => { noiseHit(c, o, 0, 0.03, "bandpass", 2600, 2, 0.8); tone(c, o, "sine", 1600, 0, 0.02, 0.3); }, "🫰");

  // BASS
  add("Bass", "bass_hit", "808 Bass Hit", 1.6, (c, o) => kick(c, o, 0, 90, 55, 0.08, 1.5, 0.05, 0.8), "🔉");
  add("Bass", "sub_drop", "Sub Drop", 1.6, (c, o) => tone(c, o, "sine", 90, 0, 1.5, 0.9, 28, 1.4), "⬇️");
  add("Bass", "bass_pluck", "Bass Pluck", 0.6, (c, o) => notes(c, o, "synthbass", [[36, 0, 0.4]]), "🟧");
  add("Bass", "bass_wobble", "Bass Wobble", 1.2, (c, o) => {
    const x = O(c, "sawtooth", midiToFreq(33)), x2 = O(c, "square", midiToFreq(33) * 1.005);
    const lp = F(c, "lowpass", 400, 8), lfo = O(c, "sine", 6), lg = G(c, 900), g = G(c, 0);
    chain(lfo, lg, lp.frequency);
    x.connect(lp); x2.connect(lp);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.01); g.gain.setValueAtTime(0.5, 1); g.gain.linearRampToValueAtTime(0, 1.15);
    chain(lp, g, o);
    for (const s of [x, x2, lfo]) { s.start(0); s.stop(1.2); }
  }, "〰️");

  // SYNTHS
  add("Synths", "synth_stab", "Minor Stab", 0.7, (c, o) => notes(c, o, "classic", [[60, 0, 0.2], [63, 0, 0.2], [67, 0, 0.2]]), "🎹");
  add("Synths", "chord_stab", "Major Stab", 0.7, (c, o) => notes(c, o, "synthpiano", [[60, 0, 0.25], [64, 0, 0.25], [67, 0, 0.25]]), "🎹");
  add("Synths", "saw_pluck", "Saw Pluck", 0.5, (c, o) => notes(c, o, "lead", [[72, 0, 0.12]]), "⚡");
  add("Synths", "square_blip", "Square Blip", 0.3, (c, o) => tone(c, o, "square", midiToFreq(84), 0, 0.12, 0.3), "🟩");
  add("Synths", "riser", "Riser", 4, (c, o) => {
    const x = O(c, "sawtooth", 200), lp = F(c, "lowpass", 300, 4), g = G(c, 0);
    sweep(x.frequency, 0, 200, 1600, 3.8); sweep(lp.frequency, 0, 300, 9000, 3.8);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.35, 3.8); g.gain.linearRampToValueAtTime(0, 4);
    chain(x, lp, g, o); x.start(0); x.stop(4);
    const n = N(c, 0, 4), nf = F(c, "bandpass", 500, 1), ng = G(c, 0);
    sweep(nf.frequency, 0, 500, 9000, 3.8); ng.gain.setValueAtTime(0, 0); ng.gain.linearRampToValueAtTime(0.3, 3.8); ng.gain.linearRampToValueAtTime(0, 4);
    chain(n, nf, ng, o);
  }, "📈");
  add("Synths", "downlifter", "Downlifter", 2.5, (c, o) => {
    const n = N(c, 0, 2.5), nf = F(c, "bandpass", 8000, 1), ng = G(c, 0);
    sweep(nf.frequency, 0, 8000, 200, 2.4); dec(ng.gain, 0, 0.5, 2.4, 0.01);
    chain(n, nf, ng, o);
  }, "📉");

  // PIANO
  add("Piano", "piano_c", "Piano C", 2.5, (c, o) => notes(c, o, "piano", [[60, 0, 2]]), "🎹");
  add("Piano", "piano_chord", "Piano Chord", 2.5, (c, o) => notes(c, o, "piano", [[48, 0, 2], [60, 0, 2], [64, 0, 2], [67, 0, 2]]), "🎹");
  add("Piano", "piano_minor", "Piano Minor Chord", 2.5, (c, o) => notes(c, o, "piano", [[45, 0, 2], [57, 0, 2], [60, 0, 2], [64, 0, 2]]), "🎹");
  add("Piano", "epiano_chord", "E-Piano Chord", 2.5, (c, o) => notes(c, o, "epiano", [[57, 0, 1.5, 0.7], [60, 0, 1.5, 0.7], [64, 0, 1.5, 0.7], [67, 0, 1.5, 0.7]]), "🎛️");
  add("Piano", "organ_chord", "Organ Chord", 1.4, (c, o) => notes(c, o, "organ", [[60, 0, 1.2], [64, 0, 1.2], [67, 0, 1.2]]), "⛪");

  // INSTRUMENTS
  add("Instruments", "bell_hit", "Bell Hit", 2.5, (c, o) => notes(c, o, "bells", [[79, 0, 2]]), "🔔");
  add("Instruments", "marimba", "Marimba", 0.8, (c, o) => {
    const f = midiToFreq(67);
    tone(c, o, "sine", f, 0, 0.6, 0.6); tone(c, o, "sine", f * 4, 0, 0.08, 0.2);
  }, "🪵");
  add("Instruments", "guitar_strum", "Guitar Strum", 2.5, (c, o) => notes(c, o, "guitar", [[52, 0, 2], [57, 0.02, 2], [62, 0.04, 2], [67, 0.06, 2], [71, 0.08, 2], [76, 0.1, 2]]), "🎸");
  add("Instruments", "string_swell", "String Swell", 3, (c, o) => notes(c, o, "strings", [[57, 0, 2.4], [60, 0, 2.4], [64, 0, 2.4]]), "🎻");
  add("Instruments", "brass_stab", "Brass Stab", 0.9, (c, o) => notes(c, o, "brass", [[60, 0, 0.35], [64, 0, 0.35], [67, 0, 0.35]]), "🎺");
  add("Instruments", "flute", "Flute Note", 1.4, (c, o) => {
    const x = O(c, "sine", midiToFreq(76)), vib = O(c, "sine", 5), vg = G(c, 10), g = G(c, 0);
    chain(vib, vg, x.detune);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.08); g.gain.setValueAtTime(0.5, 1); g.gain.linearRampToValueAtTime(0, 1.3);
    chain(x, g, o); x.start(0); x.stop(1.4); vib.start(0); vib.stop(1.4);
    const n = N(c, 0, 1.3), bp = F(c, "bandpass", midiToFreq(76) * 2, 2), ng = G(c, 0);
    ng.gain.setValueAtTime(0, 0); ng.gain.linearRampToValueAtTime(0.15, 0.05); ng.gain.linearRampToValueAtTime(0.03, 0.3); ng.gain.setValueAtTime(0.03, 1); ng.gain.linearRampToValueAtTime(0, 1.3);
    chain(n, bp, ng, o);
  }, "🪈");

  // SOUND EFFECTS
  add("Sound Effects", "laser", "Laser", 0.35, (c, o) => tone(c, o, "square", 2200, 0, 0.3, 0.3, 90, 0.3), "🔫");
  add("Sound Effects", "explosion", "Explosion", 2.2, (c, o) => {
    const n = N(c, 0, 2.2), lp = F(c, "lowpass", 1200, 0.8), g = G(c, 0);
    sweep(lp.frequency, 0, 1800, 80, 2); dec(g.gain, 0, 1, 2, 0.005);
    chain(n, lp, g, o);
    tone(c, o, "sine", 90, 0, 0.8, 0.9, 30, 0.6);
  }, "💣");
  add("Sound Effects", "boing", "Boing", 0.9, (c, o) => {
    const x = O(c, "sine", 140), lfo = O(c, "sine", 18), lg = G(c, 60), g = G(c, 0);
    chain(lfo, lg, x.frequency);
    sweep(x.frequency, 0, 140, 380, 0.8);
    dec(g.gain, 0, 0.7, 0.8);
    sweep(lg.gain, 0, 80, 5, 0.8);
    chain(x, g, o); x.start(0); x.stop(0.9); lfo.start(0); lfo.stop(0.9);
  }, "🤸");
  add("Sound Effects", "whoosh", "Whoosh", 1.1, (c, o) => {
    const n = N(c, 0, 1.1), bp = F(c, "bandpass", 300, 1.5), g = G(c, 0);
    bp.frequency.setValueAtTime(300, 0); bp.frequency.exponentialRampToValueAtTime(3500, 0.5); bp.frequency.exponentialRampToValueAtTime(400, 1.05);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.8, 0.45); g.gain.linearRampToValueAtTime(0, 1.05);
    chain(n, bp, g, o);
  }, "💨");
  add("Sound Effects", "coin", "Coin", 0.5, (c, o) => { tone(c, o, "square", 988, 0, 0.08, 0.25); tone(c, o, "square", 1319, 0.08, 0.35, 0.25); }, "🪙");
  add("Sound Effects", "powerup", "Power Up", 0.8, (c, o) => {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(c, o, "square", midiToFreq(60 + s), i * 0.08, 0.12, 0.2));
  }, "⭐");
  add("Sound Effects", "jump", "Jump", 0.3, (c, o) => tone(c, o, "square", 220, 0, 0.25, 0.25, 880, 0.2), "🦘");
  add("Sound Effects", "siren", "Siren", 2.2, (c, o) => {
    const x = O(c, "sawtooth", 800), lfo = O(c, "triangle", 1.2), lg = G(c, 350), lp = F(c, "lowpass", 2500), g = G(c, 0);
    chain(lfo, lg, x.frequency);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.25, 0.05); g.gain.setValueAtTime(0.25, 2); g.gain.linearRampToValueAtTime(0, 2.2);
    chain(x, lp, g, o); x.start(0); x.stop(2.2); lfo.start(0); lfo.stop(2.2);
  }, "🚨");
  add("Sound Effects", "airhorn", "Air Horn", 1.4, (c, o) => {
    const bp = F(c, "bandpass", 1200, 0.8), g = G(c, 0);
    for (const [f, d] of [[440, 0], [443, 8], [554, -6]]) { const x = O(c, "sawtooth", f); x.detune.value = d; sweep(x.frequency, 0, f * 0.9, f, 0.08); x.connect(bp); x.start(0); x.stop(1.4); }
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.4, 0.04); g.gain.setValueAtTime(0.4, 1.15); g.gain.linearRampToValueAtTime(0, 1.35);
    chain(bp, g, o);
  }, "📯");
  add("Sound Effects", "scratch", "Record Scratch", 0.7, (c, o) => {
    const n = N(c, 0, 0.7), bp = F(c, "bandpass", 800, 3), g = G(c, 0);
    bp.frequency.setValueAtTime(400, 0); bp.frequency.exponentialRampToValueAtTime(2500, 0.15); bp.frequency.exponentialRampToValueAtTime(300, 0.35); bp.frequency.exponentialRampToValueAtTime(2000, 0.6);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.9, 0.02); g.gain.setValueAtTime(0.9, 0.55); g.gain.linearRampToValueAtTime(0, 0.68);
    chain(n, bp, g, o);
  }, "💿");
  add("Sound Effects", "pop", "Pop", 0.15, (c, o) => tone(c, o, "sine", 400, 0, 0.08, 0.8, 1500, 0.05), "🫧");
  add("Sound Effects", "splash", "Splash", 1, (c, o) => {
    noiseHit(c, o, 0, 0.9, "lowpass", 2500, 0.5, 0.7, 0.01);
    for (let i = 0; i < 8; i++) tone(c, o, "sine", 600 + Math.random() * 900, 0.05 + Math.random() * 0.4, 0.05, 0.15, 1800);
  }, "💦");
  add("Sound Effects", "badumtss", "Ba-Dum-Tss", 1.6, (c, o) => {
    tom(170)(c, o); const o2 = G(c, 1); o2.connect(o);
    tone(c, o, "sine", 210, 0.18, 0.4, 0.9, 120, 0.2);
    kick(c, o, 0.36, 150, 45, 0.1, 0.4, 0.2);
    metallic(c, o, 0.36, 1.1, 52, 5000, 0.35);
  }, "😆");
  add("Sound Effects", "slide_up", "Slide Whistle Up", 0.9, (c, o) => {
    const x = O(c, "sine", 400), g = G(c, 0);
    sweep(x.frequency, 0, 400, 1800, 0.8);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.05); g.gain.setValueAtTime(0.5, 0.75); g.gain.linearRampToValueAtTime(0, 0.85);
    chain(x, g, o); x.start(0); x.stop(0.9);
  }, "⤴️");
  add("Sound Effects", "slide_down", "Slide Whistle Down", 0.9, (c, o) => {
    const x = O(c, "sine", 1800), g = G(c, 0);
    sweep(x.frequency, 0, 1800, 350, 0.8);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.05); g.gain.setValueAtTime(0.5, 0.75); g.gain.linearRampToValueAtTime(0, 0.85);
    chain(x, g, o); x.start(0); x.stop(0.9);
  }, "⤵️");
  add("Sound Effects", "applause", "Applause", 3, (c, o) => {
    const r = GBL.rng(7);
    for (let i = 0; i < 140; i++) {
      const t = r() * 2.6;
      const env = t < 0.4 ? t / 0.4 : t > 2.1 ? (2.6 - t) / 0.5 : 1;
      noiseHit(c, o, t, 0.02 + r() * 0.02, "bandpass", 900 + r() * 1800, 1.5, 0.25 * env);
    }
  }, "👏");
  add("Sound Effects", "whoopee", "Whoopee Cushion", 1, (c, o) => {
    const x = O(c, "sawtooth", 110), lfo = O(c, "sine", 22), lg = G(c, 25), lp = F(c, "lowpass", 700, 4), g = G(c, 0);
    chain(lfo, lg, x.frequency);
    sweep(x.frequency, 0, 130, 70, 0.9);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.05); g.gain.linearRampToValueAtTime(0.35, 0.7); g.gain.linearRampToValueAtTime(0, 0.95);
    chain(x, lp, g, o); x.start(0); x.stop(1); lfo.start(0); lfo.stop(1);
  }, "🎈");
  add("Sound Effects", "thunder", "Thunder", 3.5, (c, o) => {
    const n = N(c, 0, 3.5), lp = F(c, "lowpass", 400, 0.7), g = G(c, 0);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.05); g.gain.linearRampToValueAtTime(0.4, 0.5); g.gain.linearRampToValueAtTime(0.8, 0.9); g.gain.exponentialRampToValueAtTime(0.001, 3.4);
    sweep(lp.frequency, 0, 900, 120, 3);
    chain(n, lp, g, o);
  }, "⛈️");
  add("Sound Effects", "bonk", "Cartoon Bonk", 0.4, (c, o) => { tone(c, o, "sine", 900, 0, 0.25, 0.7, 180, 0.2); tone(c, o, "sine", 1100, 0, 0.05, 0.3); }, "🔨");
  add("Sound Effects", "zap", "Zap", 0.3, (c, o) => {
    const x = O(c, "sawtooth", 1500), lfo = O(c, "square", 60), lg = G(c, 800), g = G(c, 0);
    chain(lfo, lg, x.frequency); dec(g.gain, 0, 0.3, 0.25);
    chain(x, g, o); x.start(0); x.stop(0.3); lfo.start(0); lfo.stop(0.3);
  }, "⚡");

  // VOCAL EFFECTS (formant synthesis, no recordings)
  add("Vocal Effects", "vox_aah", "Choir Aah", 2, (c, o) => {
    for (const [f, d] of [[220, 0], [221.5, 0], [329.6, 0]]) formantVoice(c, o, 0, 1.9, [[0, f]], [vw(0, "a")], { peak: 0.25, attack: 0.3, release: 0.5 });
  }, "🎶");
  add("Vocal Effects", "vox_ooh", "Choir Ooh", 2, (c, o) => {
    for (const f of [196, 247, 294]) formantVoice(c, o, 0, 1.9, [[0, f]], [vw(0, "u")], { peak: 0.3, attack: 0.3, release: 0.5 });
  }, "🎶");
  add("Vocal Effects", "vox_hey", "Hey!", 0.45, (c, o) => formantVoice(c, o, 0, 0.4, [[0, 330], [0.4, 250]], [vw(0, "e"), vw(0.4, "i")], { peak: 0.8, attack: 0.02, release: 0.12, breath: 0.4 }), "🙋");
  add("Vocal Effects", "vox_yeah", "Yeah!", 0.7, (c, o) => formantVoice(c, o, 0, 0.65, [[0, 200], [0.3, 230], [0.65, 170]], [vw(0, "i"), vw(0.15, "e"), vw(0.4, "a")], { peak: 0.75, attack: 0.03, release: 0.2 }), "🤘");
  add("Vocal Effects", "vox_whoa", "Whoa", 1, (c, o) => formantVoice(c, o, 0, 0.95, [[0, 260], [0.5, 300], [0.95, 220]], [vw(0, "u"), vw(0.3, "o"), vw(0.8, "a")], { peak: 0.7, attack: 0.05, release: 0.3 }), "😮");
  add("Vocal Effects", "robot_beep", "Robot Beep Boop", 0.8, (c, o) => {
    const ring = O(c, "sine", 30), rg = G(c, 0); chain(ring, rg.gain); ring.start(0); ring.stop(0.8);
    rg.connect(o);
    tone(c, rg, "square", 800, 0, 0.18, 0.5); tone(c, rg, "square", 400, 0.25, 0.25, 0.5); tone(c, rg, "square", 600, 0.55, 0.2, 0.5);
  }, "🤖");
  add("Vocal Effects", "robot_voice", "Robot Voice", 1.2, (c, o) => {
    const ring = O(c, "sine", 55), rg = G(c, 0); chain(ring, rg.gain); ring.start(0); ring.stop(1.2); rg.connect(o);
    formantVoice(c, rg, 0, 0.45, [[0, 110]], [vw(0, "o"), vw(0.4, "o")], { wave: "square", peak: 0.7, vib: 0, release: 0.05 });
    formantVoice(c, rg, 0.55, 0.55, [[0, 98]], [vw(0, "a"), vw(0.5, "o")], { wave: "square", peak: 0.7, vib: 0, release: 0.05 });
  }, "🤖");
  add("Vocal Effects", "vocal_chop", "Vocal Chop", 0.35, (c, o) => formantVoice(c, o, 0, 0.3, [[0, 392]], [vw(0, "a")], { peak: 0.7, attack: 0.01, release: 0.05 }), "✂️");

  // AMBIENT SOUNDS
  add("Ambient Sounds", "wind", "Wind", 5, (c, o) => {
    const n = N(c, 0, 5), bp = F(c, "bandpass", 500, 2), lfo = O(c, "sine", 0.35), lg = G(c, 350), g = G(c, 0);
    chain(lfo, lg, bp.frequency); lfo.start(0); lfo.stop(5);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.6, 1); g.gain.setValueAtTime(0.6, 4); g.gain.linearRampToValueAtTime(0, 5);
    chain(n, bp, g, o);
  }, "🌬️");
  add("Ambient Sounds", "rain", "Rain", 5, (c, o) => {
    const n = N(c, 0, 5), lp = F(c, "highpass", 1500, 0.5), g = G(c, 0);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.18, 0.8); g.gain.setValueAtTime(0.18, 4.2); g.gain.linearRampToValueAtTime(0, 5);
    chain(n, lp, g, o);
    const r = GBL.rng(3);
    for (let i = 0; i < 220; i++) { const t = r() * 4.8; const e = t < 0.8 ? t / 0.8 : t > 4.2 ? (5 - t) / 0.8 : 1; noiseHit(c, o, t, 0.006, "bandpass", 2500 + r() * 4000, 3, 0.35 * e); }
  }, "🌧️");
  add("Ambient Sounds", "ocean", "Ocean Waves", 6, (c, o) => {
    const n = N(c, 0, 6), lp = F(c, "lowpass", 600, 0.5), g = G(c, 0);
    g.gain.setValueAtTime(0, 0);
    for (let k = 0; k < 2; k++) { const b = k * 3; g.gain.linearRampToValueAtTime(0.7, b + 1.4); g.gain.linearRampToValueAtTime(0.08, b + 3); lp.frequency.linearRampToValueAtTime(1400, b + 1.4); lp.frequency.linearRampToValueAtTime(400, b + 3); }
    chain(n, lp, g, o);
  }, "🌊");
  add("Ambient Sounds", "space", "Space Drone", 6, (c, o) => {
    const lp = F(c, "lowpass", 400, 4), lfo = O(c, "sine", 0.15), lg = G(c, 300), g = G(c, 0);
    chain(lfo, lg, lp.frequency); lfo.start(0); lfo.stop(6);
    for (const [f, d] of [[55, -10], [55, 10], [82.4, 0], [110, 5]]) { const x = O(c, "sawtooth", f); x.detune.value = d; x.connect(lp); x.start(0); x.stop(6); }
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.3, 1.5); g.gain.setValueAtTime(0.3, 4.5); g.gain.linearRampToValueAtTime(0, 6);
    chain(lp, g, o);
  }, "🪐");
  add("Ambient Sounds", "birds", "Birds", 3, (c, o) => {
    const r = GBL.rng(11);
    for (let i = 0; i < 14; i++) { const t = r() * 2.6, f = 2500 + r() * 2000; tone(c, o, "sine", f, t, 0.08, 0.25, f * (1.2 + r() * 0.5), 0.06); }
  }, "🐦");
  add("Ambient Sounds", "crickets", "Crickets", 3, (c, o) => {
    const x = O(c, "sine", 4600), am = O(c, "square", 28), ag = G(c, 0.5), g = G(c, 0);
    chain(am, ag, g.gain);
    g.gain.value = 0;
    const env = G(c, 0);
    for (let k = 0; k < 6; k++) { const t = k * 0.48; env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.25, t + 0.02); env.gain.setValueAtTime(0.25, t + 0.22); env.gain.linearRampToValueAtTime(0, t + 0.24); }
    chain(x, g, env, o); x.start(0); x.stop(3); am.start(0); am.stop(3);
  }, "🦗");

  // RETRO SOUNDS
  add("Retro Sounds", "r_jump", "8-bit Jump", 0.3, (c, o) => tone(c, o, "pulse25", 180, 0, 0.25, 0.3, 700, 0.22), "🍄");
  add("Retro Sounds", "r_coin", "8-bit Coin", 0.45, (c, o) => { tone(c, o, "pulse25", 1046, 0, 0.06, 0.25); tone(c, o, "pulse25", 1568, 0.06, 0.35, 0.25); }, "🪙");
  add("Retro Sounds", "r_laser", "8-bit Laser", 0.3, (c, o) => tone(c, o, "pulse12", 1800, 0, 0.25, 0.3, 200, 0.25), "🔫");
  add("Retro Sounds", "r_explode", "8-bit Explosion", 0.9, (c, o) => { const s = chunkyNoise(c, 0, 0.9, 24), g = G(c, 0); dec(g.gain, 0, 0.5, 0.85); chain(s, g, o); }, "💥");
  add("Retro Sounds", "r_powerup", "8-bit Power Up", 0.9, (c, o) => { for (let i = 0; i < 10; i++) tone(c, o, "square", midiToFreq(60 + i * 2 + (i % 2) * 5), i * 0.07, 0.09, 0.2); }, "🌟");
  add("Retro Sounds", "r_gameover", "Game Over", 1.6, (c, o) => { [67, 64, 60, 55].forEach((m, i) => tone(c, o, "triangle", midiToFreq(m), i * 0.3, 0.32, 0.5)); }, "💀");
  add("Retro Sounds", "r_1up", "1-Up", 0.7, (c, o) => { [64, 67, 76, 72, 74, 79].forEach((m, i) => tone(c, o, "square", midiToFreq(m), i * 0.09, 0.1, 0.2)); }, "🍀");
  add("Retro Sounds", "r_hit", "8-bit Hit", 0.3, (c, o) => { const s = chunkyNoise(c, 0, 0.3, 6), g = G(c, 0); dec(g.gain, 0, 0.4, 0.2); chain(s, g, o); tone(c, o, "square", 300, 0, 0.15, 0.2, 80); }, "🥊");
  add("Retro Sounds", "r_select", "Menu Blip", 0.12, (c, o) => tone(c, o, "pulse25", 1318, 0, 0.07, 0.25), "🔘");
  add("Retro Sounds", "r_kick", "8-bit Kick", 0.3, (c, o) => tone(c, o, "triangle", 220, 0, 0.25, 0.8, 40, 0.12), "🥁");
  add("Retro Sounds", "r_snare", "8-bit Snare", 0.2, (c, o) => { const s = chunkyNoise(c, 0, 0.2, 2), g = G(c, 0); dec(g.gain, 0, 0.4, 0.15); chain(s, g, o); }, "🪘");
  add("Retro Sounds", "r_hat", "8-bit Hat", 0.08, (c, o) => { const s = chunkyNoise(c, 0, 0.08, 1), hp = F(c, "highpass", 6000), g = G(c, 0); dec(g.gain, 0, 0.3, 0.05); chain(s, hp, g, o); }, "🎩");

  const CATEGORIES = ["Drums", "Percussion", "Bass", "Synths", "Piano", "Instruments", "Sound Effects", "Vocal Effects", "Ambient Sounds", "Retro Sounds"];
  const byId = Object.fromEntries(R.map((r) => [r.id, r]));
  const buffers = new Map();
  const pending = new Map();

  function normalize(buf, target = 0.89) {
    let peak = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
    if (peak > 0) { const g = target / peak; for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= g; } }
    return buf;
  }

  function render(id) {
    if (buffers.has(id)) return Promise.resolve(buffers.get(id));
    if (pending.has(id)) return pending.get(id);
    const r = byId[id];
    if (!r) return Promise.resolve(null);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(1, Math.ceil(r.dur * SR), SR);
    try { r.fn(ctx, ctx.destination); } catch (e) { console.error("sample recipe failed", id, e); }
    const p = new Promise((res) => {
      const done = (buf) => { normalize(buf); buffers.set(id, buf); pending.delete(id); res(buf); };
      const ret = ctx.startRendering && ctx.startRendering();
      if (ret && ret.then) ret.then(done, (e) => { console.error(e); pending.delete(id); res(null); });
      else ctx.oncomplete = (e) => done(e.renderedBuffer);
    });
    pending.set(id, p);
    return p;
  }

  async function renderAll(ids, onProgress) {
    const list = ids || R.map((r) => r.id);
    let done = 0;
    const batch = 6;
    for (let i = 0; i < list.length; i += batch) {
      await Promise.all(list.slice(i, i + batch).map((id) => render(id)));
      done = Math.min(list.length, i + batch);
      onProgress && onProgress(done / list.length);
    }
  }

  GBL.samples = { LIST: R, byId, CATEGORIES, render, renderAll, get: (id) => buffers.get(id) || null, normalize };
})();
