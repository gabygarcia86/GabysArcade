// All sound is synthesized with the Web Audio API: engine, water rush, splashes, boosts,
// trick stings, countdown beeps and two procedural tropical music tracks.

export class AudioEngine {
  constructor(save) {
    this.save = save;
    this.ctx = null;
    this.ready = false;
    this.track = null;
    this.engineOn = false;
  }

  // Must be called from a user gesture.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    this.music.disconnect();
    this.music.connect(comp);
    comp.connect(this.master);
    this.applyVolumes();
    // White noise buffer shared by splashes, wind and percussion.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.buildEngine();
    this.buildAmbience();
    this.ready = true;
    if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.playMusic(t); }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.save.settings;
    this.sfx.gain.value = s.sfx;
    this.music.gain.value = s.music * 0.55;
  }

  noiseSource(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    return src;
  }

  // ---------------------------------------------------------------- Engine and water
  buildEngine() {
    const c = this.ctx;
    this.eng = {};
    const e = this.eng;
    e.out = c.createGain();
    e.out.gain.value = 0;
    e.out.connect(this.sfx);
    e.filter = c.createBiquadFilter();
    e.filter.type = 'lowpass';
    e.filter.frequency.value = 900;
    e.filter.Q.value = 2;
    e.filter.connect(e.out);
    e.o1 = c.createOscillator(); e.o1.type = 'sawtooth';
    e.o2 = c.createOscillator(); e.o2.type = 'square';
    e.o3 = c.createOscillator(); e.o3.type = 'sawtooth';
    const g1 = c.createGain(); g1.gain.value = 0.35;
    const g2 = c.createGain(); g2.gain.value = 0.18;
    const g3 = c.createGain(); g3.gain.value = 0.12;
    e.o1.connect(g1).connect(e.filter);
    e.o2.connect(g2).connect(e.filter);
    e.o3.connect(g3).connect(e.filter);
    // Amplitude wobble gives the two-stroke burble.
    e.lfo = c.createOscillator();
    e.lfo.frequency.value = 18;
    const lg = c.createGain(); lg.gain.value = 0.25;
    e.lfo.connect(lg).connect(g1.gain);
    for (const o of [e.o1, e.o2, e.o3, e.lfo]) o.start();
    // Water rush.
    e.water = this.noiseSource(true);
    e.wFilter = c.createBiquadFilter();
    e.wFilter.type = 'bandpass';
    e.wFilter.frequency.value = 1200;
    e.wFilter.Q.value = 0.6;
    e.wGain = c.createGain();
    e.wGain.gain.value = 0;
    e.water.connect(e.wFilter).connect(e.wGain).connect(this.sfx);
    e.water.start();
    // Boost hiss.
    e.boost = this.noiseSource(true);
    e.bFilter = c.createBiquadFilter();
    e.bFilter.type = 'highpass';
    e.bFilter.frequency.value = 2500;
    e.bGain = c.createGain();
    e.bGain.gain.value = 0;
    e.boost.connect(e.bFilter).connect(e.bGain).connect(this.sfx);
    e.boost.start();
    // Distant rival engines.
    e.rival = c.createOscillator(); e.rival.type = 'sawtooth';
    e.rFilter = c.createBiquadFilter(); e.rFilter.type = 'lowpass'; e.rFilter.frequency.value = 500;
    e.rGain = c.createGain(); e.rGain.gain.value = 0;
    e.rival.connect(e.rFilter).connect(e.rGain).connect(this.sfx);
    e.rival.start();
  }

  buildAmbience() {
    const c = this.ctx;
    this.amb = {};
    const src = this.noiseSource(true);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 450;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.sfx);
    src.start();
    this.amb.gain = g;
    this.amb.filter = f;
    // Slow swell of the surf.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = c.createGain();
    lg.gain.value = 120;
    lfo.connect(lg).connect(f.frequency);
    lfo.start();
    // Rain.
    const rain = this.noiseSource(true);
    const rf = c.createBiquadFilter();
    rf.type = 'highpass';
    rf.frequency.value = 3000;
    this.amb.rain = c.createGain();
    this.amb.rain.gain.value = 0;
    rain.connect(rf).connect(this.amb.rain).connect(this.sfx);
    rain.start();
  }

  // s: { rpm 0..1, speed m/s, wet 0..1, boost bool, on bool, rivalDist }
  updateEngine(s) {
    if (!this.ready) return;
    const e = this.eng;
    const t = this.ctx.currentTime;
    const on = s.on ? 1 : 0;
    const f = 42 + s.rpm * 120 + (s.airborne ? 30 : 0);
    e.o1.frequency.setTargetAtTime(f, t, 0.06);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    e.o3.frequency.setTargetAtTime(f * 1.51, t, 0.06);
    e.lfo.frequency.setTargetAtTime(10 + s.rpm * 30, t, 0.1);
    e.filter.frequency.setTargetAtTime(500 + s.rpm * 2200 + (s.airborne ? 800 : 0), t, 0.08);
    e.out.gain.setTargetAtTime(on * (0.1 + s.rpm * 0.16), t, 0.08);
    e.wGain.gain.setTargetAtTime(on * s.wet * Math.min(1, s.speed / 25) * 0.32, t, 0.08);
    e.wFilter.frequency.setTargetAtTime(500 + s.speed * 60, t, 0.1);
    e.bGain.gain.setTargetAtTime(on * (s.boost ? 0.12 : 0), t, 0.05);
    const rv = s.rivalDist != null ? Math.max(0, 1 - s.rivalDist / 60) : 0;
    e.rival.frequency.setTargetAtTime(70 + rv * 40, t, 0.2);
    e.rGain.gain.setTargetAtTime(on * rv * 0.05, t, 0.2);
  }

  setAmbience(level, rain) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.amb.gain.gain.setTargetAtTime(level * 0.14, t, 0.5);
    this.amb.rain.gain.setTargetAtTime(rain * 0.09, t, 0.5);
  }

  silenceEngine() {
    if (!this.ready) return;
    this.updateEngine({ rpm: 0, speed: 0, wet: 0, boost: false, on: false });
  }

  // ---------------------------------------------------------------- One-shots
  burst(dur, freq, q, gain, type = 'bandpass', sweep = 0) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const src = this.noiseSource();
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tone(freq, dur, type = 'sine', gain = 0.2, when = 0, slide = 0, dest = null) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  splash(strength = 1) {
    this.burst(0.25 + strength * 0.5, 900, 0.7, 0.25 + strength * 0.35, 'lowpass', 0.3);
    this.burst(0.15 + strength * 0.2, 3000, 0.5, 0.12 * strength, 'highpass');
  }
  land(strength) { this.splash(Math.min(1.4, strength)); this.tone(70, 0.25, 'sine', 0.3 * strength, 0, 0.5); }
  bump() { this.tone(110, 0.15, 'triangle', 0.25, 0, 0.6); this.burst(0.12, 400, 1, 0.2); }
  boostStart() { this.burst(0.5, 800, 1, 0.2, 'bandpass', 4); this.tone(220, 0.35, 'sawtooth', 0.06, 0, 2); }
  jump() { this.burst(0.3, 1500, 0.8, 0.12, 'bandpass', 0.4); }
  trickStart() { this.tone(660, 0.12, 'triangle', 0.08, 0, 1.5); }
  trickLand(mult) {
    const base = 523.25;
    const notes = [1, 1.25, 1.5, 2, 2.5].slice(0, Math.min(5, mult + 1));
    notes.forEach((n, i) => this.tone(base * n, 0.22, 'triangle', 0.12, i * 0.07));
  }
  crash() { this.burst(0.9, 600, 0.5, 0.45, 'lowpass', 0.2); this.tone(160, 0.5, 'sawtooth', 0.12, 0, 0.3); }
  coin() { this.tone(988, 0.08, 'square', 0.06); this.tone(1319, 0.2, 'square', 0.06, 0.07); }
  shell() { [0, 0.08, 0.16, 0.24].forEach((w, i) => this.tone(880 * [1, 1.26, 1.5, 2][i], 0.3, 'sine', 0.12, w)); }
  click() { this.tone(900, 0.05, 'triangle', 0.05); }
  countdown(go) { this.tone(go ? 880 : 440, go ? 0.6 : 0.25, 'square', 0.12); }
  checkpoint() { this.tone(784, 0.1, 'triangle', 0.09); this.tone(1175, 0.18, 'triangle', 0.09, 0.08); }
  lap() { [0, 0.1, 0.2].forEach((w, i) => this.tone([659, 784, 1047][i], 0.25, 'triangle', 0.1, w)); }
  wrong() { this.tone(200, 0.3, 'square', 0.08, 0, 0.7); }
  thunder() { this.burst(2.5, 160, 0.3, 0.55, 'lowpass', 0.4); }
  wave() { this.burst(2, 300, 0.4, 0.3, 'lowpass', 2.5); }
  finish(win) {
    const seq = win ? [523, 659, 784, 1047, 784, 1047] : [523, 659, 784, 659];
    seq.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, i * 0.14));
  }

  // ---------------------------------------------------------------- Music
  playMusic(name) {
    if (!this.ready) { this.pendingTrack = name; return; }
    if (this.track === name) return;
    this.track = name;
    if (this.seqTimer) clearInterval(this.seqTimer);
    if (!name) return;
    const tracks = {
      menu: { bpm: 96, root: 55, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], mood: 'chill' },
      race: { bpm: 128, root: 50, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], mood: 'drive' },
      stunt: { bpm: 120, root: 52, chords: [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [3, 7, 10]], mood: 'drive' },
    };
    const tr = tracks[name];
    const stepDur = 60 / tr.bpm / 4;
    let step = 0;
    let next = this.ctx.currentTime + 0.1;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const lead = [0, 2, 4, 7, 9, 7, 4, 2, 0, -3, 0, 2, 4, 4, 2, 0];
    const leadRhythm = tr.mood === 'chill'
      ? [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]
      : [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
    const schedule = () => {
      while (next < this.ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 16) % tr.chords.length;
        const s = step % 16;
        const chord = tr.chords[bar];
        const root = tr.root + chord[0];
        // Bass.
        if (s % 4 === 0 || (tr.mood === 'drive' && s % 4 === 3)) this.note(mtof(root - 12 + (s === 8 ? 7 : 0)), stepDur * 1.8, 'triangle', 0.22, next);
        // Marimba / steel drum plucks on the chord.
        if (s % 2 === 0) {
          const n = chord[(s / 2) % chord.length];
          this.pluck(mtof(tr.root + 12 + n), stepDur * 3, next, tr.mood === 'chill' ? 0.08 : 0.06);
        }
        // Lead melody.
        if (leadRhythm[s] && (Math.floor(step / 64) % 2 === 1 || tr.mood === 'chill')) {
          const m = tr.root + 24 + lead[(s + bar * 3) % 16] + chord[0] * 0;
          this.steel(mtof(m), stepDur * 2.5, next, 0.07);
        }
        // Drums.
        if (tr.mood === 'drive') {
          if (s % 4 === 0) this.kick(next);
          if (s % 8 === 4) this.snare(next);
          this.hat(next, s % 2 ? 0.03 : 0.05);
        } else {
          if (s % 8 === 0) this.kick(next, 0.5);
          if (s % 2 === 1) this.hat(next, 0.025);
          if (s === 6 || s === 14) this.shaker(next);
        }
        next += stepDur;
        step++;
      }
    };
    schedule();
    this.seqTimer = setInterval(schedule, 60);
  }

  note(freq, dur, type, gain, t) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  pluck(freq, dur, t, gain) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 4;
    const g = c.createGain();
    const g2 = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g2.gain.setValueAtTime(gain * 0.4, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.25);
    o.connect(g).connect(this.music);
    o2.connect(g2).connect(this.music);
    o.start(t); o2.start(t);
    o.stop(t + dur); o2.stop(t + dur);
  }

  steel(freq, dur, t, gain) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.music);
    for (const [mul, amp] of [[1, 1], [2, 0.5], [2.98, 0.25], [4.2, 0.12]]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * mul * 1.01, t);
      o.frequency.exponentialRampToValueAtTime(freq * mul, t + 0.05);
      const og = c.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur);
    }
  }

  kick(t, gain = 0.6) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.3);
  }

  snare(t) {
    const c = this.ctx;
    const src = this.noiseSource();
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random());
    src.stop(t + 0.2);
  }

  hat(t, gain) {
    const c = this.ctx;
    const src = this.noiseSource();
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random());
    src.stop(t + 0.08);
  }

  shaker(t) {
    const c = this.ctx;
    const src = this.noiseSource();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 5000;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random());
    src.stop(t + 0.15);
  }
}
