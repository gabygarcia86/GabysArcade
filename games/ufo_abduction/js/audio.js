/*
 * Every sound and song is synthesized with the Web Audio API, so there are no files to load.
 * Browsers only allow sound after the player interacts, so nothing is created until the
 * first tap, click or key press.
 */
(function (U) {
  "use strict";

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];

  // Songs. Lead tokens are scale degrees per eighth note ("_" rest, "~" hold the last note).
  // Drum, bass and arpeggio patterns use 16 steps per bar.
  const TRACKS = {
    menu: {
      bpm: 116, root: 60, scale: MAJOR, chords: [0, 5, 3, 4],
      lead: "4 _ 2 4 7 _ 6 4 | 5 _ 4 2 0 _ 2 _ | 3 _ 5 3 7 _ 5 3 | 4 ~ 6 ~ 8 ~ ~ _",
      bass: "x...x.o.x...x.o.",
      kick: "x.......x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.",
      lw: "square", arp: true,
    },
    farm: {
      bpm: 132, root: 55, scale: MAJOR, chords: [0, 3, 0, 4, 0, 3, 4, 0],
      lead:
        "0 2 4 4 4 2 4 _ | 3 3 5 5 3 _ 1 _ | 0 2 4 4 7 6 4 _ | 4 3 2 1 2 ~ _ _ |" +
        " 0 2 4 4 4 2 4 _ | 3 3 5 5 7 _ 5 _ | 4 4 3 3 2 2 1 1 | 0 ~ 4 ~ 0 ~ _ _",
      bass: "x...5...x...5...",
      kick: "x.......x.......", snare: "....x.......x...", hat: "..x...x...x...x.",
      lw: "square", arp: false,
    },
    suburbia: {
      bpm: 120, root: 53, scale: MAJOR, chords: [0, 5, 1, 4],
      lead: "4 _ 5 4 2 _ 0 _ | 2 _ 4 2 0 _ -2 _ | 1 _ 3 1 -1 _ 1 2 | 4 ~ 3 ~ 2 ~ 1 _",
      bass: "x..x..x.x..x..x.",
      kick: "x.....x...x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.",
      lw: "square", arp: true,
    },
    desert: {
      bpm: 104, root: 57, scale: MINOR, chords: [0, 5, 6, 0],
      lead: "0 ~ 4 ~ 3 2 0 _ | 5 ~ ~ 4 3 ~ 2 _ | 6 ~ 5 4 3 ~ 4 _ | 0 ~ ~ ~ _ _ -1 _",
      bass: "x..xx..xx..xx..x",
      kick: "x.......x.......", snare: "......x.......x.", hat: "x.x.x.x.x.x.x.x.",
      lw: "triangle", vibrato: 6, arp: false,
    },
    city: {
      bpm: 138, root: 50, scale: MINOR, chords: [0, 5, 2, 6],
      lead: "4 4 _ 4 3 _ 2 _ | 0 _ 2 _ 3 2 0 _ | 4 4 _ 4 6 _ 7 _ | 6 ~ 4 ~ 3 ~ 2 _",
      bass: "x.x.x.x.o.x.x.x.",
      kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.",
      lw: "sawtooth", arp: true,
    },
    island: {
      bpm: 108, root: 53, scale: MAJOR, chords: [0, 4, 5, 3],
      lead: "4 _ 4 5 4 _ 2 _ | 1 _ 1 2 1 _ -1 _ | 2 _ 2 4 5 _ 4 2 | 3 ~ 2 ~ 0 ~ _ _",
      bass: "x..x..x.x..x..x.",
      kick: "x..x..x.........", snare: "....x.......x...", hat: "..x...x...x..x.x",
      lw: "sine", pluck: true, arp: true,
    },
  };

  function parseLead(text) {
    return text.replace(/\|/g, " ").trim().split(/\s+/);
  }
  for (const key in TRACKS) TRACKS[key].tokens = parseLead(TRACKS[key].lead);

  const A = (U.Audio = {
    ctx: null,
    settings: null,
    lastPlayed: Object.create(null),
    track: null,
    trackName: null,
    wantTrack: null,

    init(settings) {
      this.settings = settings;
      const unlock = () => this.unlock();
      window.addEventListener("pointerdown", unlock, true);
      window.addEventListener("keydown", unlock, true);
      window.addEventListener("touchend", unlock, true);
    },

    unlock() {
      if (!this.ctx) this.create();
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    },

    create() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (error) {
        return;
      }
      const c = this.ctx;
      this.out = c.createDynamicsCompressor();
      this.out.threshold.value = -10;
      this.out.ratio.value = 4;
      this.out.connect(c.destination);
      this.master = c.createGain();
      this.master.connect(this.out);
      this.musicBus = c.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = c.createGain();
      this.sfxBus.connect(this.master);

      const length = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, length, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

      this.createLoops();
      this.applyVolumes();
      if (this.wantTrack) this.playMusic(this.wantTrack);
    },

    applyVolumes() {
      if (!this.ctx) return;
      const s = this.settings;
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, now, 0.03);
      this.musicBus.gain.setTargetAtTime(s.music * 0.55, now, 0.03);
      this.sfxBus.gain.setTargetAtTime(s.sfx, now, 0.03);
    },

    // Quietens the music for a moment, as during the family reunion fanfare.
    duck(seconds) {
      if (!this.ctx) return;
      const g = this.musicBus.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(this.settings.music * 0.12, now, 0.05);
      g.setTargetAtTime(this.settings.music * 0.55, now + seconds, 0.4);
    },

    // ---------- Building blocks ----------

    tone(o) {
      const c = this.ctx;
      const t = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.2;
      const osc = c.createOscillator();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.points) {
        for (const [at, f] of o.points) osc.frequency.linearRampToValueAtTime(f, t + at * dur);
      } else if (o.to) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
      }
      const g = c.createGain();
      const vol = o.vol == null ? 0.2 : o.vol;
      const attack = o.attack || 0.008;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      if (o.hold) g.gain.setValueAtTime(vol, t + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.filter) {
        const f = c.createBiquadFilter();
        f.type = o.filter;
        f.frequency.value = o.ff || 1200;
        f.Q.value = o.q || 1;
        node.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(o.dest || this.sfxBus);
      if (o.vibrato) {
        const lfo = c.createOscillator();
        const depth = c.createGain();
        lfo.frequency.value = o.vibrato;
        depth.gain.value = o.vdepth || o.freq * 0.03;
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.05);
      }
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    noise(o) {
      const c = this.ctx;
      const t = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.2;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = o.filter || "lowpass";
      f.frequency.setValueAtTime(o.ff || 1000, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      f.Q.value = o.q || 0.8;
      const g = c.createGain();
      const vol = o.vol == null ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(o.dest || this.sfxBus);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    },

    notes(list, o = {}) {
      list.forEach((n, i) => {
        if (n == null) return;
        this.tone({ type: o.type || "triangle", freq: midiToFreq(n), dur: o.dur || 0.16, vol: o.vol || 0.14, delay: (o.delay || 0) + i * (o.step || 0.08), vibrato: o.vibrato });
      });
    },

    // ---------- Sound effects ----------

    play(name, opts) {
      // sfxOff silences the attract-mode demo behind the title screen.
      if (!this.ctx || this.ctx.state !== "running" || (this.sfxOff && name !== "click")) return;
      const fx = SFX[name];
      if (!fx) return;
      const now = this.ctx.currentTime;
      const gap = fx.gap == null ? 0.05 : fx.gap;
      if (this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return;
      this.lastPlayed[name] = now;
      try {
        fx.run.call(this, opts || {});
      } catch (error) {
        // A failed sound must never interrupt the game.
      }
    },

    // ---------- Continuous engine and beam hum ----------

    createLoops() {
      const c = this.ctx;
      // Engine: a low saw with a slow wobble.
      this.engineGain = c.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter = c.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 320;
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxBus);
      const e1 = c.createOscillator();
      e1.type = "sawtooth";
      e1.frequency.value = 58;
      const e2 = c.createOscillator();
      e2.type = "sine";
      e2.frequency.value = 116;
      const wob = c.createOscillator();
      wob.frequency.value = 5;
      const wobDepth = c.createGain();
      wobDepth.gain.value = 4;
      wob.connect(wobDepth);
      wobDepth.connect(e1.frequency);
      wobDepth.connect(e2.frequency);
      e1.connect(this.engineFilter);
      e2.connect(this.engineFilter);
      this.engineOsc = e1;
      e1.start();
      e2.start();
      wob.start();

      // Tractor beam: two warbling tones through a band-pass.
      this.beamGain = c.createGain();
      this.beamGain.gain.value = 0;
      const bf = c.createBiquadFilter();
      bf.type = "bandpass";
      bf.frequency.value = 700;
      bf.Q.value = 0.7;
      bf.connect(this.beamGain);
      this.beamGain.connect(this.sfxBus);
      const b1 = c.createOscillator();
      b1.type = "sine";
      b1.frequency.value = 330;
      const b2 = c.createOscillator();
      b2.type = "triangle";
      b2.frequency.value = 495;
      const warble = c.createOscillator();
      warble.frequency.value = 9;
      const warbleDepth = c.createGain();
      warbleDepth.gain.value = 26;
      warble.connect(warbleDepth);
      warbleDepth.connect(b1.frequency);
      warbleDepth.connect(b2.frequency);
      b1.connect(bf);
      b2.connect(bf);
      this.beamOscs = [b1, b2];
      b1.start();
      b2.start();
      warble.start();
    },

    setEngine(level) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(level <= 0 ? 0 : 0.035 + level * 0.05, now, 0.12);
      this.engineFilter.frequency.setTargetAtTime(260 + level * 520, now, 0.12);
      this.engineOsc.frequency.setTargetAtTime(52 + level * 22, now, 0.2);
    },

    setBeam(on, big) {
      if (!this.ctx) return;
      if (this.sfxOff) on = false;
      const now = this.ctx.currentTime;
      this.beamGain.gain.setTargetAtTime(on ? (big ? 0.11 : 0.075) : 0, now, on ? 0.04 : 0.06);
      this.beamOscs[0].frequency.setTargetAtTime(big ? 262 : 330, now, 0.1);
      this.beamOscs[1].frequency.setTargetAtTime(big ? 393 : 495, now, 0.1);
    },

    silenceLoops() {
      this.setEngine(0);
      this.setBeam(false);
    },

    // ---------- Music ----------

    playMusic(name) {
      this.wantTrack = name;
      if (!this.ctx) return;
      if (this.trackName === name && this.track) return;
      this.track = TRACKS[name] || null;
      this.trackName = name;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
    },

    stopMusic() {
      this.track = null;
      this.trackName = null;
      this.wantTrack = null;
    },

    schedule() {
      const c = this.ctx;
      const tr = this.track;
      if (!c || !tr || c.state !== "running") {
        if (c && tr) this.nextTime = c.currentTime + 0.1;
        return;
      }
      const stepTime = 60 / tr.bpm / 4;
      if (this.nextTime < c.currentTime - 0.3) this.nextTime = c.currentTime + 0.05;
      while (this.nextTime < c.currentTime + 0.14) {
        this.playStep(tr, this.step, this.nextTime, stepTime);
        this.nextTime += stepTime;
        this.step++;
      }
    },

    degree(tr, n) {
      const oct = Math.floor(n / 7);
      const idx = ((n % 7) + 7) % 7;
      return tr.root + tr.scale[idx] + 12 * oct;
    },

    playStep(tr, step, t, st) {
      const c = this.ctx;
      const bars = tr.chords.length;
      const loopSteps = bars * 16;
      const s = step % loopSteps;
      const pass = Math.floor(step / loopSteps);
      const i = s % 16;
      const chord = tr.chords[Math.floor(s / 16)];
      const delay = t - c.currentTime;
      const bus = this.musicBus;

      if (tr.kick[i] === "x") {
        this.tone({ type: "sine", freq: 150, to: 42, dur: 0.16, vol: 0.42, delay, dest: bus });
      }
      if (tr.snare[i] === "x") {
        this.noise({ filter: "bandpass", ff: 1900, q: 0.7, dur: 0.13, vol: 0.2, delay, dest: bus });
        this.tone({ type: "triangle", freq: 210, to: 150, dur: 0.07, vol: 0.1, delay, dest: bus });
      }
      if (tr.hat[i] === "x" || (pass % 2 === 1 && i % 2 === 1 && tr.bpm < 130)) {
        this.noise({ filter: "highpass", ff: 7500, dur: 0.035, vol: 0.06, delay, dest: bus });
      }

      const b = tr.bass[i];
      if (b && b !== ".") {
        let note = this.degree(tr, chord) - 12;
        if (b === "o") note += 12;
        if (b === "5") note = this.degree(tr, chord + 4) - 12;
        this.tone({ type: "triangle", freq: midiToFreq(note), dur: st * 1.8, vol: 0.2, delay, dest: bus });
      }

      if (tr.arp && i % 2 === 0) {
        const offsets = [0, 2, 4, 7];
        const note = this.degree(tr, chord + offsets[(i / 2) % 4]) + 12;
        this.tone({ type: "sine", freq: midiToFreq(note), dur: st * 1.5, vol: 0.035, delay, dest: bus });
      }

      if (i % 2 === 0) {
        const idx = (s / 2) % tr.tokens.length;
        const token = tr.tokens[idx];
        if (token !== "_" && token !== "~") {
          let len = 1;
          while (tr.tokens[(idx + len) % tr.tokens.length] === "~" && len < 8) len++;
          const note = this.degree(tr, parseInt(token, 10)) + 12 + (pass % 2 === 1 ? 12 : 0);
          const dur = tr.pluck ? Math.min(0.5, st * 2 * len) : st * 2 * len * 0.92;
          this.tone({
            type: tr.lw,
            freq: midiToFreq(note),
            dur,
            vol: tr.lw === "sawtooth" ? 0.05 : tr.lw === "square" ? 0.06 : 0.11,
            delay,
            dest: bus,
            filter: "lowpass",
            ff: tr.lw === "sine" ? 4000 : 2600,
            vibrato: tr.vibrato || (len > 2 ? 5.5 : 0),
            vdepth: midiToFreq(note) * 0.012,
          });
          if (tr.pluck) {
            this.tone({ type: "sine", freq: midiToFreq(note + 12), dur: dur * 0.5, vol: 0.04, delay, dest: bus });
          }
        }
      }
    },
  });

  // Each effect runs with `this` set to the audio object.
  const SFX = {
    click: { run() { this.tone({ type: "square", freq: 880, to: 1320, dur: 0.06, vol: 0.06 }); } },
    beamOn: {
      gap: 0.15,
      run() {
        this.tone({ type: "sine", freq: 200, to: 760, dur: 0.25, vol: 0.12 });
        this.tone({ type: "triangle", freq: 600, to: 1500, dur: 0.18, vol: 0.05, delay: 0.05 });
      },
    },
    abduct: {
      gap: 0.04,
      run({ combo = 0 }) {
        const lift = Math.min(combo, 12);
        this.tone({ type: "sine", freq: 380 + lift * 30, to: 1300 + lift * 60, dur: 0.22, vol: 0.18 });
        this.notes([84 + lift, 88 + lift, 91 + lift], { type: "triangle", step: 0.05, dur: 0.1, vol: 0.07, delay: 0.12 });
      },
    },
    moo: {
      gap: 0.3,
      run() {
        const p = U.rand(0.9, 1.15);
        this.tone({ type: "sawtooth", freq: 150 * p, points: [[0.25, 175 * p], [1, 105 * p]], dur: 0.75, vol: 0.16, attack: 0.08, filter: "lowpass", ff: 650, vibrato: 5, vdepth: 6 });
      },
    },
    squeal: {
      gap: 0.25,
      run() {
        this.tone({ type: "square", freq: 900, points: [[0.3, 1600], [1, 1150]], dur: 0.38, vol: 0.07, vibrato: 18, vdepth: 60, filter: "lowpass", ff: 3000 });
      },
    },
    cluck: {
      gap: 0.2,
      run() {
        for (let i = 0; i < 3; i++) this.tone({ type: "square", freq: 760 - i * 40, to: 480, dur: 0.06, vol: 0.06, delay: i * 0.085, filter: "bandpass", ff: 1100, q: 2 });
      },
    },
    bark: {
      gap: 0.2,
      run() {
        for (let i = 0; i < 2; i++) {
          this.noise({ filter: "bandpass", ff: 900, q: 1.5, dur: 0.1, vol: 0.16, delay: i * 0.16 });
          this.tone({ type: "square", freq: 420, to: 210, dur: 0.1, vol: 0.07, delay: i * 0.16, filter: "lowpass", ff: 1300 });
        }
      },
    },
    meow: {
      gap: 0.3,
      run() {
        this.tone({ type: "sawtooth", freq: 520, points: [[0.4, 880], [1, 480]], dur: 0.45, vol: 0.07, filter: "bandpass", ff: 1400, q: 2 });
      },
    },
    neigh: {
      gap: 0.4,
      run() {
        this.tone({ type: "sawtooth", freq: 500, points: [[0.2, 950], [0.7, 700], [1, 420]], dur: 0.7, vol: 0.08, vibrato: 22, vdepth: 70, filter: "bandpass", ff: 1300, q: 1.4 });
      },
    },
    baa: {
      gap: 0.3,
      run() {
        this.tone({ type: "sawtooth", freq: 310, to: 280, dur: 0.55, vol: 0.09, vibrato: 11, vdepth: 22, filter: "bandpass", ff: 900, q: 1.2 });
      },
    },
    quack: {
      gap: 0.2,
      run() {
        for (let i = 0; i < 2; i++) this.tone({ type: "sawtooth", freq: 560, to: 330, dur: 0.11, vol: 0.08, delay: i * 0.14, filter: "bandpass", ff: 1100, q: 4 });
      },
    },
    squawk: {
      gap: 0.25,
      run() {
        this.tone({ type: "sawtooth", freq: 1300, points: [[0.3, 1700], [1, 900]], dur: 0.3, vol: 0.06, filter: "bandpass", ff: 2000, q: 3 });
      },
    },
    clack: {
      gap: 0.2,
      run() {
        for (let i = 0; i < 3; i++) this.noise({ filter: "highpass", ff: 3000, dur: 0.03, vol: 0.14, delay: i * 0.06 });
      },
    },
    human: {
      gap: 0.25,
      run({ pitch = 1 }) {
        const p = pitch * U.rand(0.9, 1.15);
        this.tone({ type: "sawtooth", freq: 210 * p, points: [[0.3, 380 * p], [1, 300 * p]], dur: 0.5, vol: 0.08, vibrato: 8, vdepth: 14, filter: "bandpass", ff: 1100, q: 1.6 });
        this.tone({ type: "triangle", freq: 420 * p, points: [[0.3, 760 * p], [1, 600 * p]], dur: 0.5, vol: 0.04 });
      },
    },
    alien: {
      gap: 0.2,
      run({ pitch = 1 }) {
        for (let i = 0; i < 6; i++) {
          const f = U.rand(600, 1500) * pitch;
          this.tone({ type: "sine", freq: f, to: f * U.rand(0.7, 1.4), dur: 0.07, vol: 0.09, delay: i * 0.065 });
        }
      },
    },
    drop: {
      gap: 0.08,
      run() {
        this.tone({ type: "sine", freq: 520, to: 160, dur: 0.25, vol: 0.12 });
        this.tone({ type: "sine", freq: 240, to: 320, dur: 0.12, vol: 0.08, delay: 0.25 });
      },
    },
    alarm: {
      gap: 0.4,
      run() {
        for (let i = 0; i < 4; i++) this.tone({ type: "square", freq: i % 2 ? 660 : 880, dur: 0.12, vol: 0.07, delay: i * 0.13, hold: 0.1 });
      },
    },
    hit: {
      gap: 0.1,
      run() {
        this.noise({ filter: "lowpass", ff: 1400, to: 120, dur: 0.45, vol: 0.4 });
        this.tone({ type: "square", freq: 300, to: 60, dur: 0.35, vol: 0.12 });
      },
    },
    zap: {
      gap: 0.12,
      run() {
        this.noise({ filter: "highpass", ff: 2500, dur: 0.35, vol: 0.18 });
        for (let i = 0; i < 5; i++) this.tone({ type: "sawtooth", freq: U.rand(80, 200), dur: 0.05, vol: 0.06, delay: i * 0.06 });
      },
    },
    crackle: {
      gap: 0.3,
      run() {
        for (let i = 0; i < 4; i++) this.noise({ filter: "highpass", ff: 4000, dur: 0.03, vol: 0.06, delay: i * U.rand(0.03, 0.09) });
      },
    },
    thunder: {
      gap: 0.5,
      run() {
        this.noise({ filter: "lowpass", ff: 900, to: 90, dur: 1.3, vol: 0.35, attack: 0.02 });
        this.noise({ filter: "highpass", ff: 3000, dur: 0.2, vol: 0.15 });
      },
    },
    stun: {
      gap: 0.2,
      run() {
        this.tone({ type: "sine", freq: 900, points: [[0.25, 500], [0.5, 800], [0.75, 400], [1, 600]], dur: 0.6, vol: 0.12 });
      },
    },
    fried: {
      gap: 0.3,
      run() {
        this.tone({ type: "sawtooth", freq: 300, to: 60, dur: 0.7, vol: 0.1, vibrato: 30, vdepth: 40 });
        this.noise({ filter: "highpass", ff: 3500, dur: 0.6, vol: 0.12 });
      },
    },
    nope: {
      gap: 0.25,
      run() {
        this.tone({ type: "square", freq: 220, dur: 0.14, vol: 0.09, hold: 0.1 });
        this.tone({ type: "square", freq: 165, dur: 0.3, vol: 0.09, delay: 0.16, hold: 0.24 });
      },
    },
    warn: {
      gap: 0.5,
      run() {
        this.tone({ type: "triangle", freq: 1200, dur: 0.08, vol: 0.06 });
        this.tone({ type: "triangle", freq: 1200, dur: 0.08, vol: 0.06, delay: 0.12 });
      },
    },
    shoot: {
      gap: 0.08,
      run() {
        this.noise({ filter: "lowpass", ff: 2000, to: 300, dur: 0.18, vol: 0.18 });
        this.tone({ type: "square", freq: 700, to: 200, dur: 0.12, vol: 0.06 });
      },
    },
    throw: {
      gap: 0.1,
      run() {
        this.noise({ filter: "bandpass", ff: 600, to: 2400, q: 2, dur: 0.25, vol: 0.12 });
      },
    },
    splat: {
      gap: 0.08,
      run() {
        this.noise({ filter: "lowpass", ff: 900, to: 200, dur: 0.18, vol: 0.18 });
      },
    },
    boom: {
      gap: 0.1,
      run() {
        this.noise({ filter: "lowpass", ff: 2200, to: 80, dur: 0.8, vol: 0.4 });
        this.tone({ type: "sine", freq: 120, to: 35, dur: 0.6, vol: 0.3 });
      },
    },
    siren: {
      gap: 1.5,
      run() {
        for (let i = 0; i < 4; i++) this.tone({ type: "square", freq: i % 2 ? 700 : 950, dur: 0.22, vol: 0.04, delay: i * 0.22, hold: 0.2, filter: "lowpass", ff: 1800 });
      },
    },
    rotor: {
      gap: 1.0,
      run() {
        for (let i = 0; i < 8; i++) this.noise({ filter: "lowpass", ff: 500, dur: 0.06, vol: 0.12, delay: i * 0.09 });
      },
    },
    screech: {
      gap: 0.6,
      run() {
        this.tone({ type: "sawtooth", freq: 1900, points: [[0.3, 2300], [1, 1200]], dur: 0.55, vol: 0.06, vibrato: 30, vdepth: 80, filter: "bandpass", ff: 2200, q: 2 });
      },
    },
    snort: {
      gap: 0.6,
      run() {
        this.noise({ filter: "bandpass", ff: 500, q: 1, dur: 0.25, vol: 0.2 });
        this.noise({ filter: "bandpass", ff: 400, q: 1, dur: 0.3, vol: 0.2, delay: 0.3 });
      },
    },
    grumble: {
      gap: 0.6,
      run() {
        this.tone({ type: "sawtooth", freq: 110, points: [[0.3, 140], [0.6, 100], [1, 120]], dur: 0.6, vol: 0.12, vibrato: 14, vdepth: 10, filter: "lowpass", ff: 700 });
      },
    },
    stomp: {
      gap: 0.25,
      run() {
        this.tone({ type: "sine", freq: 90, to: 35, dur: 0.25, vol: 0.3 });
      },
    },
    honk: {
      gap: 1,
      run() {
        this.tone({ type: "square", freq: 330, dur: 0.18, vol: 0.06, hold: 0.15, filter: "lowpass", ff: 1200 });
        this.tone({ type: "square", freq: 330, dur: 0.25, vol: 0.06, delay: 0.22, hold: 0.2, filter: "lowpass", ff: 1200 });
      },
    },
    whoosh: {
      gap: 0.5,
      run() {
        this.noise({ filter: "bandpass", ff: 300, to: 1200, q: 1, dur: 0.9, vol: 0.14 });
      },
    },
    power: {
      run() {
        this.notes([72, 76, 79, 84, 88], { type: "square", step: 0.06, dur: 0.12, vol: 0.06 });
        this.notes([84, 88, 91, 96], { type: "triangle", step: 0.06, dur: 0.14, vol: 0.08, delay: 0.03 });
      },
    },
    repair: {
      run() {
        this.notes([67, 72, 76, 79, 84], { type: "triangle", step: 0.07, dur: 0.16, vol: 0.12 });
        this.tone({ type: "sine", freq: 1400, to: 2200, dur: 0.3, vol: 0.05, delay: 0.3 });
      },
    },
    shieldBlock: {
      gap: 0.15,
      run() {
        this.tone({ type: "triangle", freq: 1800, to: 900, dur: 0.35, vol: 0.12 });
        this.tone({ type: "sine", freq: 2600, to: 1500, dur: 0.25, vol: 0.06 });
      },
    },
    combo: {
      gap: 0.1,
      run({ level = 1 }) {
        const base = 72 + Math.min(level, 8) * 2;
        this.notes([base, base + 4, base + 7, base + 12], { type: "square", step: 0.05, dur: 0.1, vol: 0.06 });
      },
    },
    streak: {
      run() {
        this.notes([72, 76, 79, 84, 79, 84, 88], { type: "square", step: 0.07, dur: 0.12, vol: 0.07 });
        this.notes([60, 64, 67, 72], { type: "triangle", step: 0.12, dur: 0.24, vol: 0.12 });
      },
    },
    rescue: {
      run() {
        this.notes([72, 76, 79, 84, 88, 91], { type: "triangle", step: 0.08, dur: 0.18, vol: 0.13 });
        this.notes([79, 84, 88, 96], { type: "square", step: 0.08, dur: 0.14, vol: 0.05, delay: 0.48 });
        SFX.alien.run.call(this, { pitch: 1.2 });
      },
    },
    reunion: {
      run() {
        // A short fanfare: rising call, held chord, sparkle.
        this.notes([67, 72, 76, 79, null, 76, 79, 84], { type: "square", step: 0.13, dur: 0.22, vol: 0.08 });
        this.notes([55, 60, 64, 67, null, 64, 67, 72], { type: "triangle", step: 0.13, dur: 0.24, vol: 0.12 });
        for (const n of [72, 76, 79, 84]) {
          this.tone({ type: "triangle", freq: midiToFreq(n), dur: 1.6, vol: 0.07, delay: 1.1, attack: 0.05, vibrato: 5 });
          this.tone({ type: "square", freq: midiToFreq(n + 12), dur: 1.4, vol: 0.025, delay: 1.1, attack: 0.05 });
        }
        this.notes([96, 100, 103, 108, 103, 108, 112], { type: "sine", step: 0.06, dur: 0.12, vol: 0.05, delay: 1.3 });
      },
    },
    firework: {
      gap: 0.05,
      run() {
        const d = U.rand(0, 0.1);
        this.tone({ type: "sine", freq: U.rand(500, 900), to: U.rand(1500, 2500), dur: 0.25, vol: 0.04, delay: d });
        this.noise({ filter: "highpass", ff: U.rand(1500, 3000), dur: 0.5, vol: 0.14, delay: d + 0.25 });
      },
    },
    tick: { gap: 0.3, run() { this.tone({ type: "square", freq: 1046, dur: 0.07, vol: 0.06 }); } },
    go: {
      run() {
        this.notes([72, 79, 84], { type: "square", step: 0.09, dur: 0.16, vol: 0.08 });
      },
    },
    timeUp: {
      run() {
        this.tone({ type: "square", freq: 880, dur: 0.5, vol: 0.08, hold: 0.4 });
        this.tone({ type: "square", freq: 440, dur: 0.5, vol: 0.06, hold: 0.4 });
      },
    },
    levelClear: {
      run() {
        this.notes([72, 74, 76, 79, 76, 79, 84], { type: "square", step: 0.1, dur: 0.16, vol: 0.07 });
        this.notes([48, 55, 60, 64], { type: "triangle", step: 0.17, dur: 0.3, vol: 0.13 });
      },
    },
    gameOver: {
      run() {
        // Sad trombone.
        const steps = [[311, 0], [294, 0.45], [277, 0.9], [262, 1.35]];
        steps.forEach(([f, d], i) =>
          this.tone({ type: "sawtooth", freq: f, to: i === 3 ? f * 0.9 : f * 0.97, dur: i === 3 ? 1.1 : 0.42, vol: 0.09, delay: d, filter: "lowpass", ff: 1200, vibrato: i === 3 ? 6 : 0, vdepth: 8 }),
        );
      },
    },
    crash: {
      run() {
        this.tone({ type: "sine", freq: 1200, to: 200, dur: 1.1, vol: 0.12, vibrato: 10, vdepth: 50 });
        this.noise({ filter: "lowpass", ff: 2400, to: 100, dur: 1.2, vol: 0.35, delay: 1.0 });
      },
    },
  };

  U.SFX = SFX;
})(window.UFO);
