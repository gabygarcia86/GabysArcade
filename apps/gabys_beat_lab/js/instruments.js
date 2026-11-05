/* InstrumentManager: original synthesized instruments built from Web Audio nodes.
 * The same voice code runs on the live AudioContext and on OfflineAudioContext for export. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { midiToFreq } = GBL.theory;

  /* ---------- per-context caches (periodic waves, noise) ---------- */
  const ctxCache = new WeakMap();
  function cacheFor(ctx) {
    let c = ctxCache.get(ctx);
    if (!c) { c = { waves: {}, noise: null }; ctxCache.set(ctx, c); }
    return c;
  }

  const WAVE_DEFS = {
    // harmonic amplitudes (index 1 = fundamental)
    organ: () => { const a = new Float32Array(17); a[1] = 1; a[2] = 0.8; a[3] = 0.6; a[4] = 0.5; a[6] = 0.35; a[8] = 0.3; a[10] = 0.12; a[12] = 0.1; a[16] = 0.06; return a; },
    piano: () => { const a = new Float32Array(32); for (let n = 1; n < 32; n++) a[n] = (1 / Math.pow(n, 1.55)) * (n % 7 === 0 ? 0.3 : 1); return a; },
    brassy: () => { const a = new Float32Array(24); for (let n = 1; n < 24; n++) a[n] = 1 / n * (n < 6 ? 1 : 0.6); return a; },
    pulse25: () => pulse(0.25),
    pulse12: () => pulse(0.125),
  };
  function pulse(duty) {
    const a = new Float32Array(64);
    for (let n = 1; n < 64; n++) a[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    return a;
  }
  function getWave(ctx, name) {
    const c = cacheFor(ctx);
    if (!c.waves[name]) {
      const real = WAVE_DEFS[name]();
      // use sine terms: put amplitudes in imag
      const imag = real;
      const re = new Float32Array(imag.length);
      c.waves[name] = ctx.createPeriodicWave(re, imag);
    }
    return c.waves[name];
  }
  function noiseBuffer(ctx) {
    const c = cacheFor(ctx);
    if (!c.noise) {
      const len = Math.floor(ctx.sampleRate * 2);
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      c.noise = b;
    }
    return c.noise;
  }
  function setOscType(ctx, osc, wave) {
    if (WAVE_DEFS[wave]) osc.setPeriodicWave(getWave(ctx, wave));
    else osc.type = wave || "sine";
  }

  /* ---------- Karplus-Strong plucked string, rendered in JS and cached ---------- */
  const pluckCache = new Map();
  function pluckBuffer(midi, sr, brightness, sustain) {
    const key = midi + ":" + sr + ":" + brightness + ":" + sustain;
    if (pluckCache.has(key)) return pluckCache.get(key);
    const f = midiToFreq(midi);
    const seconds = 3;
    const len = Math.floor(sr * seconds);
    const buf = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 });
    const out = buf.getChannelData(0);
    const period = sr / f;
    const N = Math.max(2, Math.floor(period));
    const frac = period - N;
    const line = new Float32Array(N + 2);
    // excitation: filtered noise burst (brightness controls how bright the pick is)
    let prev = 0;
    for (let i = 0; i < line.length; i++) {
      const r = Math.random() * 2 - 1;
      prev = prev + brightness * (r - prev);
      line[i] = prev;
    }
    let idx = 0;
    const damp = sustain; // e.g. 0.996
    let last = 0;
    for (let i = 0; i < len; i++) {
      const a = line[idx];
      const b = line[(idx + 1) % N];
      const v = a + frac * (b - a);
      out[i] = v;
      const nv = damp * 0.5 * (v + last);
      last = v;
      line[idx] = nv;
      idx = (idx + 1) % (N);
    }
    // normalise + gentle fade at end
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    const g = peak > 0 ? 0.8 / peak : 1;
    const fade = Math.floor(sr * 0.2);
    for (let i = 0; i < len; i++) out[i] *= g * (i > len - fade ? (len - i) / fade : 1);
    if (pluckCache.size > 400) pluckCache.delete(pluckCache.keys().next().value);
    pluckCache.set(key, buf);
    return buf;
  }

  /* ---------- Instrument definitions ---------- */
  const P = (name, attack, release, cutoff, reverb) => ({ name, attack, release, cutoff, reverb });
  const INSTRUMENTS = [
    // KEYBOARDS
    { id: "piano", name: "Grand Piano", cat: "Keyboards", icon: "🎹", color: "#60a5fa", gain: 0.55,
      layers: [{ wave: "piano", gain: 0.6 }, { wave: "piano", detune: 5, gain: 0.35 }, { wave: "sine", oct: 1, gain: 0.08 }],
      noise: { gain: 0.06, decay: 0.03, hp: 1800 },
      filter: { cutoff: 900, env: 5200, envDecay: 0.9, kt: 0.7, q: 0.4 },
      amp: { a: 0.003, d: 1.8, s: 0, r: 0.35, pitchDecay: true },
      presets: [P("Concert Hall", 0.003, 0.4, 1, 0.3), P("Soft Felt", 0.012, 0.6, 0.62, 0.35), P("Bright Pop", 0.002, 0.25, 1, 0.12), P("Dry Studio", 0.003, 0.3, 0.9, 0)] },
    { id: "epiano", name: "Electric Piano", cat: "Keyboards", icon: "🎛️", color: "#38bdf8", gain: 0.5,
      layers: [{ wave: "sine", gain: 0.8, fm: { ratio: 1, index: 1.6, decay: 0.6 } }, { wave: "sine", gain: 0.25, fm: { ratio: 14, index: 0.5, decay: 0.06 } }],
      filter: { cutoff: 9000 },
      amp: { a: 0.002, d: 2.2, s: 0.12, r: 0.45, pitchDecay: true },
      vib: { rate: 4.5, depth: 3, delay: 0.3 },
      presets: [P("Classic Tines", 0.002, 0.45, 1, 0.2), P("Lo-Fi Keys", 0.004, 0.5, 0.5, 0.3), P("Mellow", 0.01, 0.7, 0.65, 0.35)] },
    { id: "synthpiano", name: "Synth Piano", cat: "Keyboards", icon: "⌨️", color: "#818cf8", gain: 0.4,
      layers: [{ wave: "sawtooth", gain: 0.5 }, { wave: "square", detune: -6, gain: 0.3 }],
      filter: { cutoff: 600, env: 4200, envDecay: 0.35, kt: 0.5, q: 1.5 },
      amp: { a: 0.002, d: 0.9, s: 0.22, r: 0.3 },
      presets: [P("Pluck Keys", 0.002, 0.3, 1, 0.15), P("House Stab", 0.002, 0.15, 0.85, 0.2), P("Warm", 0.01, 0.4, 0.6, 0.25)] },
    { id: "organ", name: "Organ", cat: "Keyboards", icon: "⛪", color: "#f59e0b", gain: 0.32,
      layers: [{ wave: "organ", gain: 0.8 }, { wave: "organ", detune: 4, gain: 0.3 }],
      filter: { cutoff: 7000 },
      amp: { a: 0.01, d: 0.1, s: 1, r: 0.08 },
      vib: { rate: 6.2, depth: 9, delay: 0 },
      presets: [P("Church", 0.03, 0.4, 1, 0.5), P("Rock Organ", 0.005, 0.08, 1, 0.1), P("Reggae Bubble", 0.003, 0.05, 0.75, 0.05)] },
    // SYNTHESIZERS
    { id: "classic", name: "Classic Synth", cat: "Synthesizers", icon: "🎚️", color: "#a855f7", gain: 0.35,
      layers: [{ wave: "sawtooth", detune: -8, gain: 0.5 }, { wave: "sawtooth", detune: 8, gain: 0.5 }],
      filter: { cutoff: 900, env: 3200, envDecay: 0.3, kt: 0.4, q: 4 },
      amp: { a: 0.005, d: 0.4, s: 0.6, r: 0.25 },
      presets: [P("Analog Brass", 0.03, 0.3, 1, 0.2), P("Stab", 0.002, 0.12, 0.9, 0.15), P("Dark", 0.01, 0.35, 0.55, 0.25)] },
    { id: "retro", name: "Retro Synth", cat: "Synthesizers", icon: "📼", color: "#ec4899", gain: 0.33,
      layers: [{ wave: "pulse25", gain: 0.6 }, { wave: "square", detune: -10, oct: -1, gain: 0.3 }],
      filter: { cutoff: 1800, env: 1500, envDecay: 0.4, kt: 0.3, q: 2 },
      amp: { a: 0.01, d: 0.3, s: 0.7, r: 0.2 },
      vib: { rate: 5, depth: 10, delay: 0.25 },
      presets: [P("80s Drive", 0.01, 0.2, 1, 0.25), P("Tape Dream", 0.05, 0.5, 0.6, 0.4), P("Arcade", 0.002, 0.1, 1, 0.05)] },
    { id: "lead", name: "Lead Synth", cat: "Synthesizers", icon: "⚡", color: "#22d3ee", gain: 0.3,
      layers: [{ wave: "sawtooth", detune: -12, gain: 0.45 }, { wave: "sawtooth", detune: 12, gain: 0.45 }, { wave: "square", oct: 1, gain: 0.12 }],
      filter: { cutoff: 2500, env: 2500, envDecay: 0.3, kt: 0.3, q: 3 },
      amp: { a: 0.01, d: 0.2, s: 0.8, r: 0.15 },
      vib: { rate: 5.5, depth: 15, delay: 0.3 },
      presets: [P("Supersaw", 0.01, 0.2, 1, 0.3), P("Screamer", 0.003, 0.1, 1, 0.1), P("Soft Lead", 0.06, 0.35, 0.6, 0.35)] },
    { id: "ambient", name: "Ambient Synth", cat: "Synthesizers", icon: "🌌", color: "#2dd4bf", gain: 0.25,
      layers: [{ wave: "sawtooth", detune: -14, gain: 0.35 }, { wave: "sawtooth", gain: 0.35 }, { wave: "sawtooth", detune: 14, gain: 0.35 }, { wave: "sine", oct: -1, gain: 0.3 }],
      filter: { cutoff: 700, env: 900, envDecay: 2, kt: 0.2, q: 1.5 },
      amp: { a: 0.8, d: 1, s: 0.85, r: 1.8 },
      vib: { rate: 0.3, depth: 6, delay: 0 },
      presets: [P("Dreamy Pad", 0.8, 1.8, 0.8, 0.6), P("Glass Pad", 0.4, 1.2, 1, 0.5), P("Deep Space", 1.5, 3, 0.5, 0.8)] },
    { id: "bass_synth", name: "Bass Synth", cat: "Synthesizers", icon: "🔊", color: "#f97316", gain: 0.42,
      layers: [{ wave: "sawtooth", gain: 0.55 }, { wave: "square", oct: -1, gain: 0.4 }],
      filter: { cutoff: 380, env: 2200, envDecay: 0.2, kt: 0.2, q: 6 },
      amp: { a: 0.003, d: 0.3, s: 0.6, r: 0.1 },
      presets: [P("Funky", 0.003, 0.1, 1, 0), P("Acid", 0.002, 0.08, 0.8, 0.05), P("Round", 0.01, 0.15, 0.5, 0)] },
    // BASS
    { id: "ebass", name: "Electric Bass", cat: "Bass", icon: "🎸", color: "#ef4444", gain: 0.7, pluck: { brightness: 0.45, sustain: 0.998 },
      layers: [{ wave: "sine", gain: 0.25 }],
      filter: { cutoff: 1500, kt: 0.2, q: 0.6 },
      amp: { a: 0.002, d: 1, s: 1, r: 0.08 },
      presets: [P("Fingered", 0.002, 0.08, 0.8, 0), P("Slap Bright", 0.001, 0.06, 1, 0.05), P("Muted", 0.004, 0.05, 0.45, 0)] },
    { id: "synthbass", name: "Synth Bass", cat: "Bass", icon: "🟧", color: "#fb923c", gain: 0.4,
      layers: [{ wave: "square", gain: 0.5 }, { wave: "sawtooth", detune: 5, gain: 0.4 }],
      filter: { cutoff: 300, env: 1600, envDecay: 0.15, kt: 0.2, q: 8 },
      amp: { a: 0.002, d: 0.25, s: 0.7, r: 0.08 },
      presets: [P("Squelch", 0.002, 0.08, 1, 0), P("Pluck Bass", 0.002, 0.05, 0.7, 0.05), P("Wide", 0.01, 0.2, 0.9, 0.1)] },
    { id: "subbass", name: "Sub Bass", cat: "Bass", icon: "🫧", color: "#dc2626", gain: 0.7,
      layers: [{ wave: "sine", gain: 0.9 }, { wave: "triangle", gain: 0.15 }],
      filter: { cutoff: 500 },
      amp: { a: 0.005, d: 0.2, s: 1, r: 0.12 },
      presets: [P("Clean Sub", 0.005, 0.12, 1, 0), P("808 Long", 0.002, 0.5, 1, 0), P("Soft", 0.03, 0.2, 0.6, 0)] },
    // OTHER INSTRUMENTS
    { id: "guitar", name: "Guitar", cat: "Instruments", icon: "🎸", color: "#eab308", gain: 0.6, pluck: { brightness: 0.75, sustain: 0.996 },
      layers: [],
      filter: { cutoff: 6000, q: 0.5 },
      amp: { a: 0.001, d: 1, s: 1, r: 0.15 },
      presets: [P("Acoustic", 0.001, 0.2, 1, 0.2), P("Nylon", 0.002, 0.3, 0.6, 0.25), P("Bright Steel", 0.001, 0.15, 1, 0.1)] },
    { id: "strings", name: "Strings", cat: "Instruments", icon: "🎻", color: "#f472b6", gain: 0.27,
      layers: [{ wave: "sawtooth", detune: -10, gain: 0.4 }, { wave: "sawtooth", detune: 10, gain: 0.4 }, { wave: "sawtooth", detune: 0, oct: -1, gain: 0.2 }],
      filter: { cutoff: 2000, kt: 0.3, q: 0.5 },
      amp: { a: 0.35, d: 0.5, s: 0.9, r: 0.6 },
      vib: { rate: 5, depth: 10, delay: 0.2 },
      presets: [P("Orchestra", 0.35, 0.6, 0.85, 0.45), P("Pizzicato", 0.003, 0.15, 0.7, 0.3), P("Epic Swell", 0.9, 1.2, 1, 0.6)] },
    { id: "brass", name: "Brass", cat: "Instruments", icon: "🎺", color: "#facc15", gain: 0.3,
      layers: [{ wave: "brassy", detune: -5, gain: 0.5 }, { wave: "brassy", detune: 5, gain: 0.5 }],
      filter: { cutoff: 500, env: 2800, envDecay: 0.6, kt: 0.5, q: 1.2, attack: 0.05 },
      amp: { a: 0.06, d: 0.3, s: 0.85, r: 0.15 },
      vib: { rate: 5, depth: 7, delay: 0.3 },
      presets: [P("Section", 0.06, 0.15, 1, 0.3), P("Fanfare", 0.02, 0.1, 1, 0.4), P("Mellow Horn", 0.1, 0.3, 0.55, 0.3)] },
    { id: "bells", name: "Bells", cat: "Instruments", icon: "🔔", color: "#fde047", gain: 0.35,
      layers: [{ wave: "sine", gain: 0.8, fm: { ratio: 3.5, index: 3, decay: 1.2 } }, { wave: "sine", oct: 2, gain: 0.1 }],
      filter: { cutoff: 12000 },
      amp: { a: 0.001, d: 2.5, s: 0, r: 1.2 },
      presets: [P("Music Box", 0.001, 0.8, 1, 0.35), P("Church Bells", 0.001, 2, 0.8, 0.6), P("Glock", 0.001, 0.4, 1, 0.2)] },
    { id: "chiptune", name: "Chiptune", cat: "Instruments", icon: "👾", color: "#4ade80", gain: 0.22,
      layers: [{ wave: "square", gain: 1 }],
      filter: { cutoff: 12000 },
      amp: { a: 0.002, d: 0.1, s: 0.8, r: 0.05 },
      vib: { rate: 6, depth: 20, delay: 0.15 },
      presets: [P("Hero Lead", 0.002, 0.05, 1, 0.05), P("Soft Square", 0.01, 0.1, 0.5, 0.1), P("Echo Cave", 0.002, 0.1, 1, 0.4)] },
    { id: "retro8bit", name: "8-bit Retro", cat: "Instruments", icon: "🕹️", color: "#34d399", gain: 0.24,
      layers: [{ wave: "pulse12", gain: 0.9 }, { wave: "triangle", oct: -1, gain: 0.45 }],
      filter: { cutoff: 12000 },
      amp: { a: 0.001, d: 0.25, s: 0.4, r: 0.05 },
      presets: [P("Blip", 0.001, 0.05, 1, 0), P("Thin Pulse", 0.001, 0.08, 0.8, 0.1), P("Dungeon", 0.005, 0.2, 0.6, 0.35)] },
  ];
  const byId = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i]));
  const CATS = ["Keyboards", "Synthesizers", "Bass", "Instruments"];

  /* ---------- Voice ----------
   * playSynth(ctx, dest, inst, midi, vel, t, dur, params)
   * dur = null leaves the note held until voice.stop(time). Returns { stop(time), end }. */
  function playSynth(ctx, dest, inst, midi, vel, t, dur, params) {
    params = params || {};
    const f = midiToFreq(midi);
    const amp = inst.amp;
    const a = Math.max(0.001, params.attack != null ? params.attack : amp.a);
    const r = Math.max(0.01, params.release != null ? params.release : amp.r);
    let d = amp.d;
    if (amp.pitchDecay) d *= Math.pow(261.6 / f, 0.4);
    const s = amp.s;
    const peak = (inst.gain || 0.4) * Math.pow(GBL.clamp(vel, 0.05, 1), 1.2);

    const out = ctx.createGain();
    out.gain.value = 0;
    let node = out;
    const nodes = [out];
    const sources = [];

    // filter
    const fl = inst.filter || { cutoff: 12000 };
    let filter = null;
    if (fl.cutoff < 11000 || fl.env) {
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = fl.q || 0.7;
      const base = Math.min(18000, fl.cutoff * Math.pow(f / 261.6, fl.kt || 0));
      if (fl.env) {
        const top = Math.min(18000, base + fl.env * Math.pow(vel, 0.7));
        if (fl.attack) {
          filter.frequency.setValueAtTime(base, t);
          filter.frequency.linearRampToValueAtTime(top, t + fl.attack);
          filter.frequency.setTargetAtTime(base, t + fl.attack, (fl.envDecay || 0.3) / 3);
        } else {
          filter.frequency.setValueAtTime(top, t);
          filter.frequency.setTargetAtTime(base, t + 0.002, (fl.envDecay || 0.3) / 3);
        }
      } else filter.frequency.setValueAtTime(base, t);
      filter.connect(out);
      node = filter;
      nodes.push(filter);
    }

    // vibrato LFO
    let lfoGain = null;
    if (inst.vib && inst.vib.depth) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = inst.vib.rate;
      lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(inst.vib.depth, t + (inst.vib.delay || 0) + 0.25);
      lfo.connect(lfoGain);
      lfo.start(t);
      sources.push(lfo);
      nodes.push(lfoGain);
    }

    // pluck string
    if (inst.pluck) {
      const src = ctx.createBufferSource();
      src.buffer = pluckBuffer(midi, ctx.sampleRate, inst.pluck.brightness, inst.pluck.sustain);
      src.connect(node);
      src.start(t);
      sources.push(src);
    }

    for (const L of inst.layers) {
      const osc = ctx.createOscillator();
      setOscType(ctx, osc, L.wave);
      const lf = f * Math.pow(2, L.oct || 0);
      osc.frequency.setValueAtTime(lf, t);
      if (L.detune) osc.detune.setValueAtTime(L.detune, t);
      if (lfoGain) lfoGain.connect(osc.detune);
      const g = ctx.createGain();
      g.gain.value = L.gain;
      osc.connect(g).connect(node);
      nodes.push(g);
      if (L.fm) {
        const mod = ctx.createOscillator();
        mod.frequency.setValueAtTime(lf * L.fm.ratio, t);
        const mg = ctx.createGain();
        const idx = L.fm.index * lf * (0.4 + 0.6 * vel);
        mg.gain.setValueAtTime(idx, t);
        mg.gain.setTargetAtTime(idx * 0.15, t + 0.001, L.fm.decay / 3);
        mod.connect(mg).connect(osc.frequency);
        mod.start(t);
        sources.push(mod);
        nodes.push(mg);
      }
      osc.start(t);
      sources.push(osc);
    }

    if (inst.noise) {
      const ns = ctx.createBufferSource();
      ns.buffer = noiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = inst.noise.hp || 1000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(inst.noise.gain * vel, t);
      ng.gain.setTargetAtTime(0, t + 0.001, inst.noise.decay / 3);
      ns.connect(hp).connect(ng).connect(node);
      ns.start(t, Math.random());
      ns.stop(t + inst.noise.decay * 6 + 0.05);
      nodes.push(hp, ng);
    }

    // amp envelope
    const G = out.gain;
    G.setValueAtTime(0, t);
    const attEnd = t + a;
    G.linearRampToValueAtTime(peak, attEnd);
    G.setTargetAtTime(peak * s, attEnd, Math.max(0.01, d / 3));
    const envAt = (time) => {
      if (time <= t) return 0;
      if (time < attEnd) return (peak * (time - t)) / a;
      return peak * s + (peak - peak * s) * Math.exp(-(time - attEnd) / Math.max(0.01, d / 3));
    };

    out.connect(dest);
    let stopped = false;
    const voice = {
      end: Infinity,
      start: t,
      kill() {
        const now = ctx.currentTime;
        try { G.cancelScheduledValues(0); G.setValueAtTime(G.value, now); G.setTargetAtTime(0, now, 0.008); } catch (e) { /* */ }
        for (const sN of sources) { try { sN.stop(now + 0.06); } catch (e) { /* */ } }
        stopped = true;
        voice.end = now + 0.06;
      },
      stop(time) {
        if (stopped) return;
        stopped = true;
        time = Math.max(time, ctx.currentTime);
        if (time < attEnd) {
          const v = envAt(time);
          if (G.cancelAndHoldAtTime) G.cancelAndHoldAtTime(time);
          else { G.cancelScheduledValues(time); G.setValueAtTime(v, time); }
        }
        G.setTargetAtTime(0, time, r / 4);
        const endT = time + r * 1.5 + 0.05;
        for (const sN of sources) { try { sN.stop(endT); } catch (e) { /* already stopped */ } }
        voice.end = endT;
        const last = sources[sources.length - 1];
        if (last) last.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } } };
      },
    };
    if (dur != null) {
      // with zero sustain the note dies by itself; cap the tail length
      voice.stop(s === 0 ? Math.min(t + dur, t + a + d * 2.2) : t + dur);
    }
    return voice;
  }

  /* Convenience: render a single note into an offline context (used by the sample library). */
  function renderNote(ctx, dest, instId, midi, t, dur, vel = 0.9) {
    return playSynth(ctx, dest, byId[instId], midi, vel, t, dur, {});
  }

  GBL.instruments = { INSTRUMENTS, byId, CATS, playSynth, renderNote, noiseBuffer, pluckBuffer, getWave, setOscType };
})();
