/**
 * Procedural audio with the Web Audio API, in the style of Galactic Squadron:
 * synthesized effects, a continuous engine voice that follows the player's
 * speed and boost, an ambient bed per environment, and step-sequenced music
 * (a different groove for every track). Nothing is downloaded. The context is
 * created on the first user gesture; until then every call is a no-op.
 */

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const SONGS = {
  menu: { bpm: 104, roots: [45, 41, 43, 40], minor: [true, false, false, true], bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], wave: 'triangle', kick: [0, 8], snare: [4, 12], lead: [0, 0, 7, 0, 0, 5, 0, 3] },
  imperial: { bpm: 132, roots: [38, 38, 41, 36], minor: [true, true, false, true], bass: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0], wave: 'sawtooth', kick: [0, 4, 8, 12], snare: [4, 12], lead: [12, 0, 10, 0, 7, 0, 10, 12] },
  desert: { bpm: 124, roots: [43, 46, 41, 43], minor: [true, false, false, true], bass: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0], wave: 'triangle', kick: [0, 6, 8, 14], snare: [4, 12], lead: [7, 8, 7, 5, 3, 5, 7, 0] },
  ice: { bpm: 118, roots: [47, 43, 45, 42], minor: [true, false, true, true], bass: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0], wave: 'sine', kick: [0, 8, 10], snare: [4, 12], lead: [12, 14, 15, 19, 15, 14, 12, 10] },
  forest: { bpm: 112, roots: [43, 48, 45, 50], minor: [false, false, true, false], bass: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0], wave: 'triangle', kick: [0, 7, 8], snare: [4, 12], lead: [7, 9, 12, 9, 7, 4, 2, 4] },
  station: { bpm: 138, roots: [40, 40, 43, 38], minor: [true, true, true, true], bass: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1], wave: 'square', kick: [0, 4, 8, 12], snare: [4, 12, 14], lead: [0, 3, 7, 3, 10, 7, 3, 0] },
  asteroid: { bpm: 128, roots: [42, 45, 40, 44], minor: [true, false, true, false], bass: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], wave: 'sawtooth', kick: [0, 3, 8, 11], snare: [4, 12], lead: [12, 7, 15, 7, 12, 19, 15, 7] },
  lava: { bpm: 146, roots: [37, 37, 40, 35], minor: [true, true, false, true], bass: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1], wave: 'sawtooth', kick: [0, 2, 4, 8, 10, 12], snare: [4, 12], lead: [0, 1, 0, 3, 0, 1, 7, 6] },
  city: { bpm: 126, roots: [45, 41, 48, 43], minor: [true, false, false, false], bass: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1], wave: 'square', kick: [0, 4, 8, 12], snare: [4, 12], lead: [12, 16, 19, 16, 12, 19, 24, 19] },
  graveyard: { bpm: 116, roots: [41, 44, 39, 41], minor: [true, false, false, true], bass: [1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0], wave: 'triangle', kick: [0, 10], snare: [4, 12], lead: [5, 3, 0, 3, 5, 8, 7, 5] },
  grandprix: { bpm: 140, roots: [48, 45, 41, 43], minor: [false, true, false, false], bass: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1], wave: 'sawtooth', kick: [0, 4, 8, 12], snare: [4, 12], lead: [12, 16, 19, 24, 19, 16, 12, 19] },
  results: { bpm: 100, roots: [48, 43, 45, 41], minor: [false, false, true, false], bass: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], wave: 'triangle', kick: [0, 8], snare: [4, 12], lead: [12, 0, 16, 0, 19, 0, 16, 0] },
};

const ARP = [0, 1, 2, 3, 2, 1, 2, 3];

const AMBIENT = {
  base: { type: 'lowpass', freq: 220, q: 0.7, vol: 0.06, lfo: 0.08, depth: 0.3, drone: 55 },
  wind: { type: 'bandpass', freq: 520, q: 0.8, vol: 0.09, lfo: 0.12, depth: 0.7 },
  blizzard: { type: 'bandpass', freq: 1300, q: 0.6, vol: 0.1, lfo: 0.18, depth: 0.6 },
  forest: { type: 'lowpass', freq: 700, q: 0.4, vol: 0.035, lfo: 0.06, depth: 0.4, chirps: true },
  hum: { type: 'lowpass', freq: 160, q: 1, vol: 0.05, lfo: 0.05, depth: 0.2, drone: 60 },
  space: { type: 'lowpass', freq: 140, q: 1.5, vol: 0.05, lfo: 0.03, depth: 0.5, drone: 41 },
  lava: { type: 'lowpass', freq: 180, q: 1, vol: 0.12, lfo: 0.2, depth: 0.5, crackle: true },
  city: { type: 'bandpass', freq: 340, q: 0.6, vol: 0.06, lfo: 0.07, depth: 0.4, drone: 73 },
  crowd: { type: 'bandpass', freq: 900, q: 0.5, vol: 0.08, lfo: 0.3, depth: 0.5, cheer: true },
};

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.last = Object.create(null);
    this.voices = 0;
    this.musicTimer = null;
    this.musicMode = null;
    this.wantMusic = null;
    this.engine = null;
    this.ambient = null;
    this.wantAmbient = null;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(comp).connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applySettings();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (this.wantMusic) this.startMusic(this.wantMusic);
      if (this.wantAmbient) this.startAmbient(this.wantAmbient);
    } catch {
      this.ctx = null;
    }
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.02);
    this.musicGain.gain.setTargetAtTime(s.music * 0.5, t, 0.02);
    this.sfxGain.gain.setTargetAtTime(s.sfx, t, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /* ------------------------------------------------------------ synthesis */

  tone(o) {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    const attack = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(o.dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
    this.track(osc);
  }

  noiseBurst(o) {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.ftype || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 2000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t + o.dur);
    if (o.q) f.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(o.dest || this.sfxGain);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
    this.track(src);
  }

  track(node) {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
  }

  notes(freqs, step, o) {
    freqs.forEach((f, i) => this.tone({ ...o, freq: f, delay: (o.delay || 0) + i * step }));
  }

  /** Plays a named effect. Rate-limited per sound and globally capped. `vol` scales it (distance). */
  play(name, vol = 1) {
    if (!this.ready || vol <= 0.02) return;
    const now = this.ctx.currentTime;
    const gap = { wall: 0.09, bump: 0.1, hazard: 0.12, shock: 0.15, rock: 0.15, tick: 0.03, drift: 0.2, warn: 0.3, pad: 0.15, explode: 0.08 }[name] || 0;
    if (gap && now - (this.last[name] || 0) < gap) return;
    if (this.voices > 46 && name !== 'finish' && name !== 'go') return;
    this.last[name] = now;
    const v = (x) => x * vol;

    switch (name) {
      case 'count':
        this.tone({ type: 'square', freq: midi(69), dur: 0.22, vol: 0.08, filter: 3000 });
        break;
      case 'go':
        this.tone({ type: 'square', freq: midi(81), dur: 0.5, vol: 0.09, filter: 4000 });
        this.tone({ type: 'sawtooth', freq: midi(69), dur: 0.5, vol: 0.05, filter: 2500 });
        break;
      case 'rocket':
        this.noiseBurst({ freq: 400, to: 5000, dur: 0.6, vol: 0.2, ftype: 'bandpass', q: 1.5 });
        this.notes([midi(76), midi(83), midi(88)], 0.05, { type: 'square', dur: 0.12, vol: 0.05, filter: 5000 });
        break;
      case 'stall':
        this.tone({ type: 'sawtooth', freq: 140, to: 60, dur: 0.5, vol: 0.08, filter: 700 });
        break;
      case 'boost':
        this.noiseBurst({ freq: 300, to: 3500, dur: 0.45, vol: v(0.22), ftype: 'bandpass', q: 1.2 });
        this.tone({ type: 'sawtooth', freq: 180, to: 520, dur: 0.35, vol: v(0.06), filter: 2200 });
        break;
      case 'pad':
        this.notes([midi(84), midi(91)], 0.05, { type: 'triangle', dur: 0.12, vol: v(0.07) });
        this.noiseBurst({ freq: 800, to: 4000, dur: 0.3, vol: v(0.1), ftype: 'bandpass', q: 2 });
        break;
      case 'drift1':
      case 'drift2':
      case 'drift3': {
        const k = +name[5];
        this.notes([midi(72 + k * 2), midi(79 + k * 2)], 0.05, { type: 'square', dur: 0.1, vol: v(0.05), filter: 4000 });
        this.noiseBurst({ freq: 1200, to: 6000, dur: 0.25 + k * 0.08, vol: v(0.08 + k * 0.03), ftype: 'bandpass', q: 2 });
        break;
      }
      case 'wall':
        this.noiseBurst({ freq: 2600, to: 300, dur: 0.18, vol: v(0.22) });
        this.tone({ type: 'square', freq: 160, to: 70, dur: 0.12, vol: v(0.08), filter: 900 });
        break;
      case 'bump':
        this.noiseBurst({ freq: 1600, to: 200, dur: 0.16, vol: v(0.18) });
        this.tone({ type: 'triangle', freq: 220, to: 110, dur: 0.12, vol: v(0.1) });
        break;
      case 'hazard':
        this.noiseBurst({ freq: 3000, to: 200, dur: 0.4, vol: v(0.28) });
        this.tone({ type: 'sawtooth', freq: 320, to: 60, dur: 0.35, vol: v(0.1), filter: 1500 });
        break;
      case 'shock':
        for (let i = 0; i < 4; i++) this.tone({ type: 'square', freq: 1800 + Math.random() * 900, dur: 0.05, vol: v(0.05), delay: i * 0.04, filter: 6000 });
        this.noiseBurst({ freq: 5000, dur: 0.3, vol: v(0.14), ftype: 'highpass' });
        break;
      case 'zap':
        this.noiseBurst({ freq: 4000, dur: 0.25, vol: v(0.08), ftype: 'highpass' });
        break;
      case 'explode':
        this.noiseBurst({ freq: 1800, to: 120, dur: 0.8, vol: v(0.32) });
        this.tone({ type: 'sine', freq: 100, to: 30, dur: 0.7, vol: v(0.3) });
        break;
      case 'rock':
        this.noiseBurst({ freq: 900, to: 90, dur: 0.5, vol: v(0.3) });
        this.tone({ type: 'sine', freq: 80, to: 35, dur: 0.4, vol: v(0.25) });
        break;
      case 'warn':
        this.tone({ type: 'square', freq: 880, dur: 0.08, vol: v(0.04), filter: 3000 });
        this.tone({ type: 'square', freq: 660, dur: 0.08, vol: v(0.04), filter: 3000, delay: 0.1 });
        break;
      case 'probe':
        this.tone({ type: 'sawtooth', freq: 900, to: 300, dur: 0.25, vol: v(0.07), filter: 3000 });
        break;
      case 'respawn':
        this.tone({ type: 'sine', freq: 300, to: 900, dur: 0.35, vol: v(0.1), attack: 0.03 });
        break;
      case 'lap':
        this.notes([midi(72), midi(76), midi(79)], 0.07, { type: 'square', dur: 0.16, vol: 0.06, filter: 4000 });
        break;
      case 'finalLap':
        this.notes([midi(72), midi(76), midi(79), midi(84)], 0.08, { type: 'square', dur: 0.2, vol: 0.07, filter: 4000 });
        this.notes([midi(60), midi(64), midi(67), midi(72)], 0.08, { type: 'sawtooth', dur: 0.2, vol: 0.03, filter: 2000 });
        break;
      case 'posUp':
        this.notes([midi(79), midi(84)], 0.06, { type: 'triangle', dur: 0.12, vol: 0.08 });
        break;
      case 'posDown':
        this.notes([midi(76), midi(71)], 0.06, { type: 'triangle', dur: 0.12, vol: 0.06 });
        break;
      case 'finish':
        this.notes([midi(72), midi(76), midi(79), midi(84), midi(88)], 0.09, { type: 'square', dur: 0.3, vol: 0.07, filter: 4000 });
        this.noiseBurst({ freq: 1200, to: 300, dur: 1.2, vol: 0.06, ftype: 'bandpass', q: 0.6, delay: 0.1 });
        break;
      case 'win':
        this.notes([midi(72), midi(76), midi(79), midi(84), midi(79), midi(84), midi(88), midi(91)], 0.11, { type: 'square', dur: 0.28, vol: 0.07, filter: 4500 });
        break;
      case 'firework':
        this.noiseBurst({ freq: 2500, to: 200, dur: 0.6, vol: v(0.16) });
        this.tone({ type: 'sine', freq: 1200, to: 300, dur: 0.3, vol: v(0.03) });
        break;
      case 'click':
        this.tone({ type: 'square', freq: 880, to: 1320, dur: 0.05, vol: 0.03, filter: 4000 });
        break;
      case 'tick':
        this.tone({ type: 'square', freq: 1320, dur: 0.025, vol: 0.02, filter: 5000 });
        break;
      case 'select':
        this.notes([midi(76), midi(83)], 0.06, { type: 'square', dur: 0.1, vol: 0.05, filter: 4000 });
        break;
      case 'back':
        this.tone({ type: 'square', freq: 660, to: 440, dur: 0.08, vol: 0.03, filter: 3000 });
        break;
      case 'denied':
        this.tone({ type: 'square', freq: 180, dur: 0.1, vol: 0.05, filter: 1200 });
        break;
    }
  }

  /* --------------------------------------------------------------- engine */

  startEngine() {
    if (!this.ctx || this.engine) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 2;
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = 'sawtooth';
    b.type = 'square';
    a.frequency.value = 60;
    b.frequency.value = 60.7;
    const bg = ctx.createGain();
    bg.gain.value = 0.5;
    a.connect(filter);
    b.connect(bg).connect(filter);
    filter.connect(out).connect(this.sfxGain);
    // boost roar: filtered noise
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 900;
    nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0;
    n.connect(nf).connect(ng).connect(this.sfxGain);
    a.start();
    b.start();
    n.start();
    this.engine = { out, filter, a, b, n, nf, ng };
  }

  updateEngine(ratio, throttle, boosting, slide) {
    const e = this.engine;
    if (!e || !this.ready) return;
    const t = this.ctx.currentTime;
    const f = 48 + ratio * 150 + throttle * 12;
    e.a.frequency.setTargetAtTime(f, t, 0.05);
    e.b.frequency.setTargetAtTime(f * 1.012 + (boosting ? 4 : 0), t, 0.05);
    e.filter.frequency.setTargetAtTime(380 + ratio * 1600 + throttle * 300 + (boosting ? 1400 : 0), t, 0.06);
    e.out.gain.setTargetAtTime(0.035 + throttle * 0.025 + ratio * 0.03, t, 0.08);
    e.nf.frequency.setTargetAtTime(boosting ? 1400 + ratio * 1800 : 700 + slide * 2000, t, 0.08);
    e.ng.gain.setTargetAtTime(boosting ? 0.14 : slide * 0.05, t, 0.08);
  }

  stopEngine() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.out.gain.setTargetAtTime(0, t, 0.05);
    e.ng.gain.setTargetAtTime(0, t, 0.05);
    for (const node of [e.a, e.b, e.n]) node.stop(t + 0.3);
  }

  /* -------------------------------------------------------------- ambient */

  startAmbient(kind) {
    this.wantAmbient = kind;
    if (!this.ctx || this.ambient?.kind === kind) return;
    this.stopAmbient(true);
    const A = AMBIENT[kind];
    if (!A) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = A.type;
    f.frequency.value = A.freq;
    f.Q.value = A.q;
    const g = ctx.createGain();
    g.gain.value = A.vol;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = A.lfo;
    const lg = ctx.createGain();
    lg.gain.value = A.vol * A.depth;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start();
    lfo.start();
    const nodes = [src, lfo];
    if (A.drone) {
      const d = ctx.createOscillator();
      d.type = 'sine';
      d.frequency.value = A.drone;
      const dg = ctx.createGain();
      dg.gain.value = 0.03;
      d.connect(dg).connect(this.sfxGain);
      d.start();
      nodes.push(d);
    }
    const timer = setInterval(() => {
      if (!this.ready) return;
      if (A.chirps && Math.random() < 0.35) {
        const base = 2000 + Math.random() * 1500;
        this.notes([base, base * 1.2, base * 0.9], 0.07, { type: 'sine', dur: 0.06, vol: 0.012 });
      }
      if (A.crackle && Math.random() < 0.5) this.noiseBurst({ freq: 3000 + Math.random() * 2000, dur: 0.04, vol: 0.02, ftype: 'highpass' });
      if (A.cheer && Math.random() < 0.12) this.noiseBurst({ freq: 1000, dur: 1.4, vol: 0.05, ftype: 'bandpass', q: 0.4, attack: 0.3 });
    }, 400);
    this.ambient = { kind, nodes, g, timer };
  }

  stopAmbient(keepWant) {
    if (!keepWant) this.wantAmbient = null;
    const a = this.ambient;
    if (!a) return;
    this.ambient = null;
    clearInterval(a.timer);
    const t = this.ctx.currentTime;
    a.g.gain.cancelScheduledValues(t);
    a.g.gain.setTargetAtTime(0, t, 0.2);
    for (const n of a.nodes) n.stop(t + 1);
  }

  /* ---------------------------------------------------------------- music */

  startMusic(mode) {
    this.wantMusic = mode;
    if (!this.ctx) return;
    if (this.musicMode !== mode) {
      this.musicMode = mode;
      this.step = 0;
    }
    if (this.musicTimer) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.step = this.step || 0;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic() {
    this.wantMusic = null;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicMode = null;
  }

  scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const song = SONGS[this.musicMode] || SONGS.menu;
    const stepDur = 60 / song.bpm / 4;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(song, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(song, step, t, stepDur) {
    const ctx = this.ctx;
    const out = this.musicGain;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const root = song.roots[bar];
    const chord = song.minor[bar] ? [0, 3, 7, 12] : [0, 4, 7, 12];

    const voice = (type, freq, dur, vol, filter) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (filter) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = filter;
        osc.connect(f);
        node = f;
      }
      node.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };

    if (song.bass[s]) voice(song.wave, midi(root + (s % 8 === 6 ? 12 : 0)), stepDur * 0.9, 0.15, 700);
    voice('triangle', midi(root + 24 + chord[ARP[s % 8]]), stepDur * 0.8, 0.04);
    if (s === 0) for (const iv of chord.slice(0, 3)) voice('sawtooth', midi(root + 12 + iv), stepDur * 14, 0.022, 900);
    if (song.lead && s % 2 === 0 && bar % 2 === 1) {
      const note = song.lead[(s / 2) % song.lead.length];
      if (note) voice('square', midi(root + 24 + note), stepDur * 1.6, 0.03, 2600);
    }

    if (song.kick.includes(s)) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    const hat = s % 2 === 1;
    const snare = song.snare.includes(s);
    if (hat || snare) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = snare ? 'bandpass' : 'highpass';
      f.frequency.value = snare ? 1800 : 7000;
      const g = ctx.createGain();
      const dur = snare ? 0.14 : 0.035;
      g.gain.setValueAtTime(snare ? 0.13 : 0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.02);
    }
  }
}
