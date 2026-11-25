/*
 * Sound effects and music, all synthesized with the Web Audio API (no audio files).
 * Browsers only allow sound after a tap or key press, so the context starts on the first
 * one. Both tunes are original: a jolly sleigh-bell march for the menus and a sneaky,
 * bouncy tune for smashing.
 */
(function (G) {
  "use strict";

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---------------------------------------------------------------- Tunes (eighth notes)

  // Menu: G major, bouncy march.
  const MENU_MELODY = [
    67, 0, 71, 0, 74, 0, 71, 0, 72, 74, 76, 0, 74, 0, 0, 0,
    71, 0, 74, 0, 79, 0, 78, 76, 74, 0, 71, 0, 69, 0, 0, 0,
    67, 0, 71, 0, 74, 0, 76, 74, 72, 0, 76, 0, 79, 0, 78, 0,
    76, 74, 72, 71, 69, 0, 71, 0, 67, 0, 0, 0, 0, 0, 0, 0,
  ];
  const MENU_BASS = [43, 50, 47, 50, 43, 50, 47, 50, 48, 55, 52, 55, 50, 57, 54, 57];

  // Play: E minor, sneaky and mischievous, with a skip in its step.
  const PLAY_MELODY = [
    64, 0, 67, 64, 71, 0, 70, 0, 69, 0, 67, 0, 64, 0, 0, 0,
    64, 0, 67, 64, 71, 0, 74, 0, 72, 71, 69, 0, 71, 0, 0, 0,
    76, 0, 74, 0, 72, 0, 71, 0, 69, 71, 72, 0, 71, 0, 67, 0,
    69, 0, 66, 0, 63, 0, 66, 69, 67, 0, 64, 0, 0, 0, 0, 0,
  ];
  const PLAY_BASS = [40, 47, 40, 47, 45, 52, 45, 52, 40, 47, 40, 47, 47, 54, 47, 51];

  const A = {
    ctx: null,
    master: null,
    musicBus: null,
    sfxBus: null,
    noiseBuf: null,
    settings: null,
    track: null,
    wantTrack: null,
    step: 0,
    nextTime: 0,
    timer: null,
    tempo: 1,
    lastPlayed: {},

    init(settings) {
      this.settings = settings;
      const unlock = () => {
        this.ensure();
        if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      };
      window.addEventListener("pointerdown", unlock, true);
      window.addEventListener("keydown", unlock, true);
      window.addEventListener("touchend", unlock, true);
    },

    ensure() {
      if (this.ctx) return true;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      try {
        this.ctx = new Ctx();
      } catch (error) {
        return false;
      }
      const c = this.ctx;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.musicBus = c.createGain();
      this.sfxBus = c.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.wantTrack) this.startTrack(this.wantTrack);
      return true;
    },

    applyVolumes() {
      if (!this.ctx) return;
      const s = this.settings;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.03);
      this.musicBus.gain.setTargetAtTime(s.music * 0.4, t, 0.03);
      this.sfxBus.gain.setTargetAtTime(s.sfx * 0.9, t, 0.03);
    },

    setMuted(m) {
      this.settings.muted = m;
      this.applyVolumes();
    },

    // ---------------------------------------------------------------- Building blocks

    tone(freq, start, dur, o = {}) {
      const c = this.ctx;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(freq, start);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), start + (o.slideTime || dur));
      if (o.vibrato) {
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = o.vibratoRate || 7;
        lg.gain.value = o.vibrato;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(start);
        lfo.stop(start + dur + 0.05);
      }
      const vol = o.vol == null ? 0.3 : o.vol;
      const atk = o.attack || 0.005;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      let node = osc;
      if (o.filter) {
        const f = c.createBiquadFilter();
        f.type = o.filter;
        f.frequency.value = o.cutoff || 1200;
        f.Q.value = o.q || 1;
        osc.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(o.bus || this.sfxBus);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    },

    noise(start, dur, o = {}) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = o.rate || 1;
      const f = c.createBiquadFilter();
      f.type = o.filter || "bandpass";
      f.frequency.setValueAtTime(o.freq || 1500, start);
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, start + dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      const vol = o.vol == null ? 0.3 : o.vol;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(f);
      f.connect(g);
      g.connect(o.bus || this.sfxBus);
      src.start(start, Math.random() * 0.5);
      src.stop(start + dur + 0.05);
    },

    // A metallic bell: inharmonic partials with a long ring.
    bellTone(freq, start, vol, len = 1.6) {
      const partials = [1, 2.4, 3.0, 4.5, 5.4];
      partials.forEach((m, i) => this.tone(freq * m, start, len / (1 + i * 0.6), { vol: vol / (1 + i * 0.9), type: "sine" }));
    },

    // ---------------------------------------------------------------- Effects

    // Plays a named effect. `x` (0..1) and `power` vary some of them.
    play(name, power = 1) {
      if (!this.ensure() || this.settings.muted) return;
      const c = this.ctx;
      if (c.state !== "running") return;
      const now = c.currentTime;
      // Don't stack the same sound too densely.
      const gap = { impact: 0.05, glass: 0.04, paper: 0.05, wood: 0.05, snow: 0.05, bell: 0.08, smash: 0.03, combo: 0.15, ice: 0.05, candy: 0.05, crunch: 0.05, cloth: 0.05, tree: 0.2 }[name] || 0.02;
      if (this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return;
      this.lastPlayed[name] = now;
      const t = now + 0.005;
      const p = G.clamp(power, 0.2, 2);
      const v = (x) => x * Math.min(1.2, 0.45 + p * 0.55);
      switch (name) {
        case "click":
          this.tone(880, t, 0.06, { vol: 0.12, type: "triangle" });
          break;
        case "stretch":
          this.tone(180 + p * 200, t, 0.12, { vol: 0.06, type: "sawtooth", filter: "lowpass", cutoff: 900, slide: 220 + p * 260 });
          break;
        case "launch":
          this.noise(t, 0.35, { freq: 500, sweep: 2600, q: 0.8, vol: v(0.35) });
          this.tone(200, t, 0.18, { vol: 0.2, type: "triangle", slide: 520 });
          this.tone(90, t, 0.12, { vol: 0.2, type: "sine", slide: 50 });
          break;
        case "snow":
          this.noise(t, 0.22, { filter: "lowpass", freq: 900, sweep: 200, vol: v(0.35) });
          this.tone(110, t, 0.12, { vol: v(0.15), slide: 60 });
          break;
        case "impact":
          this.noise(t, 0.12, { filter: "lowpass", freq: 700, vol: v(0.22) });
          this.tone(140, t, 0.1, { vol: v(0.14), slide: 70 });
          break;
        case "wood":
          this.tone(320 + Math.random() * 120, t, 0.09, { vol: v(0.22), type: "triangle" });
          this.noise(t, 0.06, { freq: 2200, q: 3, vol: v(0.15) });
          break;
        case "glass":
          for (let i = 0; i < 2; i++) this.tone(2400 + Math.random() * 2000, t + i * 0.03, 0.18, { vol: v(0.08), type: "sine" });
          break;
        case "paper":
          this.noise(t, 0.1, { freq: 1400, q: 0.7, vol: v(0.2) });
          this.tone(180, t, 0.08, { vol: v(0.12), slide: 120 });
          break;
        case "ice":
          this.tone(1800 + Math.random() * 800, t, 0.12, { vol: v(0.09), type: "triangle" });
          this.noise(t, 0.06, { freq: 5000, q: 2, vol: v(0.1) });
          break;
        case "candy":
          this.tone(900 + Math.random() * 300, t, 0.07, { vol: v(0.12), type: "square", filter: "lowpass", cutoff: 2000 });
          break;
        case "crunch":
          this.noise(t, 0.12, { freq: 1800, q: 1.4, vol: v(0.22), rate: 0.7 });
          break;
        case "cloth":
          this.noise(t, 0.1, { filter: "lowpass", freq: 600, vol: v(0.18) });
          break;
        case "tree":
          this.noise(t, 0.2, { filter: "lowpass", freq: 500, vol: v(0.3) });
          this.tone(90, t, 0.25, { vol: v(0.2), slide: 50 });
          break;
        case "bell":
          this.bellTone(660 + Math.random() * 120, t, v(0.16), 1.1);
          break;
        case "ring":
          this.bellTone(523, t, 0.25, 2.4);
          this.bellTone(784, t + 0.08, 0.16, 2.0);
          this.bellTone(1046, t + 0.16, 0.1, 1.6);
          break;
        // Breakage, by material.
        case "smashGlass":
          this.noise(t, 0.25, { filter: "highpass", freq: 3000, vol: 0.28 });
          for (let i = 0; i < 6; i++) this.tone(2000 + Math.random() * 3500, t + Math.random() * 0.12, 0.25, { vol: 0.07 });
          break;
        case "smashPaper":
          this.noise(t, 0.22, { freq: 1100, q: 0.6, vol: 0.32, sweep: 500 });
          this.tone(300, t, 0.12, { vol: 0.18, type: "square", filter: "lowpass", cutoff: 900, slide: 120 });
          this.tone(880, t + 0.05, 0.1, { vol: 0.1, type: "triangle", slide: 1400 });
          break;
        case "smashWood":
          this.noise(t, 0.05, { freq: 3000, q: 2, vol: 0.4 });
          this.noise(t + 0.02, 0.25, { filter: "lowpass", freq: 900, vol: 0.3 });
          this.tone(160, t, 0.2, { vol: 0.25, type: "triangle", slide: 70 });
          break;
        case "smashIce":
          this.noise(t, 0.3, { filter: "highpass", freq: 2500, vol: 0.25 });
          for (let i = 0; i < 4; i++) this.tone(1500 + Math.random() * 2000, t + Math.random() * 0.1, 0.3, { vol: 0.07, type: "triangle" });
          break;
        case "smashSnow":
          this.noise(t, 0.4, { filter: "lowpass", freq: 1200, sweep: 200, vol: 0.4 });
          this.tone(120, t, 0.25, { vol: 0.2, slide: 55 });
          break;
        case "smashCrunch":
          for (let i = 0; i < 3; i++) this.noise(t + i * 0.05, 0.08, { freq: 1600 + i * 300, q: 1.5, vol: 0.28, rate: 0.6 });
          break;
        case "smashCandy":
          for (let i = 0; i < 3; i++) this.tone(1200 + i * 400, t + i * 0.03, 0.08, { vol: 0.1, type: "square", filter: "lowpass", cutoff: 2600 });
          this.noise(t, 0.12, { freq: 2600, q: 1, vol: 0.2 });
          break;
        case "smashBell":
          this.bellTone(392, t, 0.26, 2.2);
          this.noise(t, 0.15, { freq: 3000, q: 1, vol: 0.2 });
          break;
        case "smashCloth":
          this.noise(t, 0.18, { filter: "lowpass", freq: 900, vol: 0.3 });
          this.tone(500, t, 0.1, { vol: 0.12, type: "triangle", slide: 300 });
          break;
        case "timber":
          // A creak and then a big crash.
          this.tone(140, t, 0.5, { vol: 0.2, type: "sawtooth", filter: "lowpass", cutoff: 600, slide: 70, vibrato: 12, vibratoRate: 18 });
          this.noise(t + 0.4, 0.6, { filter: "lowpass", freq: 700, sweep: 150, vol: 0.45 });
          this.tone(70, t + 0.4, 0.5, { vol: 0.3, slide: 40 });
          break;
        case "boom":
          this.noise(t, 0.7, { filter: "lowpass", freq: 1400, sweep: 120, vol: 0.6 });
          this.tone(90, t, 0.6, { vol: 0.45, slide: 30 });
          this.noise(t, 0.2, { freq: 3000, q: 0.5, vol: 0.25 });
          break;
        case "poof":
          this.noise(t, 0.25, { filter: "lowpass", freq: 1500, sweep: 300, vol: 0.2 });
          break;
        case "snap":
          this.tone(700, t, 0.25, { vol: 0.2, type: "sawtooth", filter: "lowpass", cutoff: 2000, slide: 120 });
          for (let i = 0; i < 4; i++) this.tone(1800 + i * 500, t + i * 0.04, 0.1, { vol: 0.06, type: "square", filter: "lowpass", cutoff: 4000 });
          break;
        case "split":
          for (let i = 0; i < 3; i++) this.tone(900 + i * 300, t + i * 0.04, 0.12, { vol: 0.12, type: "triangle" });
          break;
        case "rainbow":
          [72, 76, 79, 84, 88].forEach((n, i) => this.tone(midi(n), t + i * 0.04, 0.2, { vol: 0.08, type: "triangle" }));
          break;
        case "combo": {
          const base = 72 + Math.min(12, Math.round(p * 4));
          [0, 4, 7, 12].forEach((n, i) => this.tone(midi(base + n), t + i * 0.06, 0.22, { vol: 0.14, type: "square", filter: "lowpass", cutoff: 3000 }));
          break;
        }
        case "bonus":
          [79, 84, 88, 91].forEach((n, i) => this.tone(midi(n), t + i * 0.07, 0.3, { vol: 0.12, type: "triangle" }));
          this.sleigh(t, 0.4);
          break;
        case "star":
          this.tone(midi(84 + Math.round(p * 2)), t, 0.4, { vol: 0.16, type: "triangle" });
          this.tone(midi(91 + Math.round(p * 2)), t + 0.05, 0.4, { vol: 0.1, type: "sine" });
          break;
        case "complete":
          [67, 72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), t + i * 0.11, 0.35, { vol: 0.16, type: "square", filter: "lowpass", cutoff: 2800 }));
          [60, 64, 67].forEach((n) => this.tone(midi(n), t + 0.55, 0.8, { vol: 0.1, type: "triangle" }));
          this.sleigh(t + 0.5, 0.8);
          break;
        case "fail":
          [62, 61, 60, 59].forEach((n, i) => this.tone(midi(n - 12), t + i * 0.28, i === 3 ? 0.8 : 0.26, { vol: 0.2, type: "sawtooth", filter: "lowpass", cutoff: 900, vibrato: i === 3 ? 6 : 0 }));
          break;
        case "unlock":
          [72, 79, 84, 88, 91, 96].forEach((n, i) => this.tone(midi(n), t + i * 0.06, 0.3, { vol: 0.1, type: "triangle" }));
          break;
        case "event":
          this.sleigh(t, 0.6);
          [76, 79, 83].forEach((n, i) => this.tone(midi(n), t + i * 0.08, 0.2, { vol: 0.12, type: "triangle" }));
          break;
        case "laugh":
          this.voice(t, [[260, 0.11], [240, 0.11], [225, 0.11], [205, 0.11], [190, 0.13], [175, 0.18]], "ah", 0.26);
          break;
        case "heh":
          this.voice(t, [[230, 0.09], [215, 0.09], [200, 0.12]], "eh", 0.22);
          break;
        case "grr":
          this.tone(95, t, 0.6, { vol: 0.3, type: "sawtooth", filter: "lowpass", cutoff: 500, vibrato: 14, vibratoRate: 26 });
          this.noise(t, 0.5, { filter: "lowpass", freq: 400, vol: 0.12 });
          break;
        case "hmph":
          this.voice(t, [[170, 0.12], [120, 0.35]], "uh", 0.22);
          break;
        case "whoa":
          this.tone(180, t, 0.4, { vol: 0.2, type: "sawtooth", filter: "bandpass", cutoff: 900, q: 3, slide: 420 });
          break;
        case "woof":
          for (let i = 0; i < 2; i++) {
            this.tone(330, t + i * 0.2, 0.1, { vol: 0.25, type: "sawtooth", filter: "bandpass", cutoff: 800, q: 2, slide: 180 });
            this.noise(t + i * 0.2, 0.08, { freq: 900, q: 1, vol: 0.15 });
          }
          break;
        case "swing":
          this.noise(t, 0.18, { freq: 900, sweep: 300, q: 1, vol: 0.1 });
          break;
        default:
          break;
      }
    },

    // A sleigh-bell shake.
    sleigh(t, dur) {
      for (let i = 0; i < 8; i++) this.noise(t + i * (dur / 8), 0.06, { filter: "highpass", freq: 6000, vol: 0.06 });
    },

    // A rough cartoon voice: a buzzy tone through two vowel formants.
    voice(t, syllables, vowel, vol) {
      const F = { ah: [800, 1200], eh: [550, 1800], uh: [500, 1000] }[vowel] || [700, 1200];
      let at = t;
      for (const [f, d] of syllables) {
        for (const formant of F) {
          this.tone(f, at, d, { vol: vol * 0.5, type: "sawtooth", filter: "bandpass", cutoff: formant, q: 4, slide: f * 0.85, attack: 0.01 });
        }
        at += d + 0.03;
      }
    },

    // ---------------------------------------------------------------- Music

    music(track) {
      this.wantTrack = track;
      if (!this.ctx) return;
      if (this.track === track) return;
      this.startTrack(track);
    },

    startTrack(track) {
      this.track = track;
      this.step = 0;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (!track) return;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    },

    schedule() {
      const c = this.ctx;
      if (!c || !this.track || c.state !== "running") return;
      const eighth = (this.track === "menu" ? 0.2 : 0.17) / this.tempo;
      while (this.nextTime < c.currentTime + 0.12) {
        this.playStep(this.step, this.nextTime, eighth);
        this.step = (this.step + 1) % 64;
        this.nextTime += eighth;
      }
    },

    playStep(i, t, eighth) {
      const bus = this.musicBus;
      if (this.track === "menu") {
        const n = MENU_MELODY[i];
        if (n) this.tone(midi(n), t, eighth * 1.6, { vol: 0.13, type: "triangle", bus });
        if (i % 2 === 0) {
          const root = MENU_BASS[(i / 2) % MENU_BASS.length];
          this.tone(midi(root), t, eighth * 1.2, { vol: 0.12, type: "sine", bus });
        }
        if (i % 2 === 1) this.noise(t, 0.05, { filter: "highpass", freq: 7000, vol: 0.035, bus });
        if (i % 8 === 4) this.noise(t, 0.08, { filter: "highpass", freq: 5000, vol: 0.05, bus });
      } else {
        const n = PLAY_MELODY[i];
        // Plucky, swung lead.
        const swing = i % 2 === 1 ? eighth * 0.18 : 0;
        if (n) this.tone(midi(n), t + swing, eighth * 0.9, { vol: 0.12, type: "square", filter: "lowpass", cutoff: 1800, bus });
        if (i % 2 === 0) {
          const root = PLAY_BASS[(i / 2) % PLAY_BASS.length];
          this.tone(midi(root - 12), t, eighth * 0.8, { vol: 0.16, type: "triangle", bus });
        }
        if (i % 4 === 2) this.noise(t + swing, 0.04, { filter: "highpass", freq: 6000, vol: 0.04, bus });
        if (i % 8 === 4) this.noise(t, 0.09, { filter: "bandpass", freq: 1800, q: 0.8, vol: 0.05, bus });
      }
    },
  };

  G.Audio = A;
})(window.GS);
