/*
 * Audio: music and sound effects synthesized with the Web Audio API, so the game
 * needs no audio files. Custom files can replace any track or effect: list them in
 * XM.AUDIO_FILES below (audio/README.txt explains how). A file that fails to load
 * falls back to the built-in sound.
 */
(function (XM) {
  "use strict";

  // Add your own files here, for example:  menu: "audio/music/menu.mp3"
  // or  jump: "audio/sfx/jump.wav". Leave a name out to keep the built-in sound.
  XM.AUDIO_FILES = {
    music: {
      // menu: "audio/music/menu.mp3",
    },
    sfx: {
      // jump: "audio/sfx/jump.ogg",
    },
  };

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
  };

  // Each track is generated from these settings with a fixed seed, so it sounds the same every time.
  const TRACKS = {
    menu: { bpm: 118, root: 45, scale: "minor", prog: [0, 5, 3, 4], seed: 11, drums: "march", lead: "heroic", pad: true },
    story: { bpm: 84, root: 50, scale: "dorian", prog: [0, 3, 5, 4], seed: 21, drums: "soft", lead: "calm", pad: true },
    city: { bpm: 132, root: 43, scale: "minor", prog: [0, 5, 6, 4], seed: 31, drums: "rock", lead: "heroic", pad: false },
    industrial: { bpm: 138, root: 40, scale: "phrygian", prog: [0, 0, 1, 6], seed: 41, drums: "rock", lead: "tense", pad: false },
    mystic: { bpm: 108, root: 47, scale: "harmonic", prog: [0, 5, 3, 4], seed: 51, drums: "tribal", lead: "calm", pad: true },
    cosmic: { bpm: 112, root: 48, scale: "lydian", prog: [0, 1, 5, 4], seed: 61, drums: "soft", lead: "arp", pad: true },
    ice: { bpm: 120, root: 50, scale: "dorian", prog: [0, 6, 5, 4], seed: 71, drums: "soft", lead: "arp", pad: true },
    tense: { bpm: 128, root: 42, scale: "harmonic", prog: [0, 5, 1, 4], seed: 81, drums: "rock", lead: "tense", pad: false },
    boss: { bpm: 150, root: 40, scale: "harmonic", prog: [0, 1, 5, 4], seed: 91, drums: "double", lead: "tense", pad: false },
    finalboss: { bpm: 158, root: 38, scale: "phrygian", prog: [0, 1, 6, 4, 0, 1, 5, 6], seed: 101, drums: "double", lead: "heroic", pad: true },
    victory: { bpm: 126, root: 48, scale: "major", prog: [0, 3, 4, 0], seed: 111, drums: "march", lead: "heroic", pad: true, once: true },
    defeat: { bpm: 70, root: 45, scale: "minor", prog: [0, 5, 3, 4], seed: 121, drums: "none", lead: "calm", pad: true, once: true },
    credits: { bpm: 112, root: 48, scale: "major", prog: [0, 5, 3, 4, 0, 5, 1, 4], seed: 131, drums: "march", lead: "heroic", pad: true },
  };

  function buildTrack(def) {
    const rnd = XM.U.rng(def.seed);
    const scale = SCALES[def.scale];
    const bars = def.prog.length;
    const steps = bars * 16;
    const note = (degree, octave = 0) => {
      const len = scale.length;
      const d = ((degree % len) + len) % len;
      const o = Math.floor(degree / len);
      return def.root + scale[d] + 12 * (o + octave);
    };
    const bass = [];
    const lead = [];
    const chords = [];
    let walk = 7;
    for (let s = 0; s < steps; s++) {
      const bar = Math.floor(s / 16);
      const beat = s % 16;
      const deg = def.prog[bar];
      if (beat === 0) chords.push({ step: s, notes: [note(deg, 1), note(deg + 2, 1), note(deg + 4, 1)] });
      // Bass: driving eighths, with an octave jump on the off-beats for energy.
      if (beat % 2 === 0) bass.push({ step: s, n: note(deg, beat % 8 === 6 && def.drums !== "soft" ? 1 : 0), len: 0.18 });
      // Lead: a random walk over chord tones, more notes for busier styles.
      const density = def.lead === "arp" ? 1 : def.lead === "tense" ? 0.55 : def.lead === "calm" ? 0.28 : 0.42;
      if (def.lead === "arp") {
        if (beat % 2 === 0) lead.push({ step: s, n: note(deg + [0, 2, 4, 7][(beat / 2) % 4], 2), len: 0.16 });
      } else if (rnd() < density && (beat % 2 === 0 || rnd() < 0.3)) {
        walk += Math.round((rnd() - 0.5) * 4);
        walk = XM.U.clamp(walk, 3, 13);
        if (beat === 0) walk = deg + 7;
        lead.push({ step: s, n: note(walk, 1), len: def.lead === "calm" ? 0.5 : 0.22 });
      }
    }
    return { def, steps, bass, lead, chords, stepDur: 60 / def.bpm / 4 };
  }

  const Audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    noise: null,
    current: null,
    currentName: "",
    timer: 0,
    nextTime: 0,
    stepIndex: 0,
    built: {},
    buffers: {},
    musicEl: null,
    volumes: { master: 0.8, music: 0.55, sfx: 0.8 },
    lastPlayed: {},

    // Browsers only allow audio after a tap or key press, so the splash screen calls this.
    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
      } catch (error) {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.musicGain = c.createGain();
      this.sfxGain = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(comp);
      comp.connect(c.destination);
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.loadCustomSfx();
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend().catch(() => {});
        else this.ctx.resume().catch(() => {});
        if (this.musicEl) document.hidden ? this.musicEl.pause() : this.musicEl.play().catch(() => {});
      });
      if (this.pendingMusic) this.music(this.pendingMusic);
    },

    setVolumes(v) {
      Object.assign(this.volumes, v);
      this.applyVolumes();
    },

    applyVolumes() {
      const v = this.volumes;
      if (this.master) {
        this.master.gain.value = v.master;
        this.musicGain.gain.value = v.music * 0.5;
        this.sfxGain.gain.value = v.sfx * 0.7;
      }
      if (this.musicEl) this.musicEl.volume = XM.U.clamp(v.master * v.music, 0, 1);
    },

    loadCustomSfx() {
      const files = XM.AUDIO_FILES.sfx || {};
      for (const [name, url] of Object.entries(files)) {
        if (!url) continue;
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
          .then((buf) => this.ctx.decodeAudioData(buf))
          .then((decoded) => (this.buffers[name] = decoded))
          .catch(() => console.info(`Custom sound "${name}" not loaded; using the built-in one.`));
      }
    },

    music(name) {
      if (!this.ctx) {
        this.pendingMusic = name;
        return;
      }
      if (this.currentName === name) return;
      this.stopMusic();
      this.currentName = name;
      const file = (XM.AUDIO_FILES.music || {})[name];
      if (file) {
        const el = new window.Audio(file);
        el.loop = !(TRACKS[name] && TRACKS[name].once);
        el.volume = XM.U.clamp(this.volumes.master * this.volumes.music, 0, 1);
        el.play().catch(() => {});
        el.addEventListener("error", () => {
          if (this.musicEl === el) {
            this.musicEl = null;
            this.startSynth(name);
          }
        });
        this.musicEl = el;
        return;
      }
      this.startSynth(name);
    },

    startSynth(name) {
      const def = TRACKS[name];
      if (!def) return;
      this.current = this.built[name] || (this.built[name] = buildTrack(def));
      this.stepIndex = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    },

    stopMusic() {
      clearInterval(this.timer);
      this.timer = 0;
      this.current = null;
      this.currentName = "";
      if (this.musicEl) {
        this.musicEl.pause();
        this.musicEl = null;
      }
    },

    schedule() {
      const tr = this.current;
      if (!tr || !this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        const s = this.stepIndex % tr.steps;
        if (tr.def.once && this.stepIndex >= tr.steps) {
          clearInterval(this.timer);
          this.timer = 0;
          return;
        }
        this.playStep(tr, s, this.nextTime);
        this.nextTime += tr.stepDur;
        this.stepIndex++;
      }
    },

    playStep(tr, s, t) {
      const beat = s % 16;
      const d = tr.def;
      for (const b of tr.bass) if (b.step === s) this.tone(NOTE(b.n), t, b.len, "sawtooth", 0.16, this.musicGain, 700);
      for (const l of tr.lead) if (l.step === s) this.tone(NOTE(l.n), t, l.len, d.lead === "calm" ? "triangle" : "square", 0.07, this.musicGain, 2400);
      if (d.pad) for (const c of tr.chords) if (c.step === s) for (const n of c.notes) this.tone(NOTE(n), t, tr.stepDur * 15, "triangle", 0.045, this.musicGain, 1400, 0.3);
      const dr = d.drums;
      if (dr === "none") return;
      const kick = dr === "double" ? beat % 4 === 0 || beat === 10 || beat === 14 : dr === "tribal" ? beat % 6 === 0 : beat % 8 === 0 || (dr === "rock" && beat === 10);
      const snare = dr === "soft" ? beat === 12 : beat === 4 || beat === 12;
      if (kick) this.kick(t);
      if (snare) this.snare(t, dr === "soft" ? 0.08 : 0.16);
      if (dr !== "tribal" && beat % 2 === 0) this.hat(t, dr === "double" ? 0.05 : 0.035);
      if (dr === "march" && (beat === 14 || beat === 15)) this.snare(t, 0.07);
    },

    tone(freq, t, len, type, vol, dest, cutoff = 3000, attack = 0.005) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      o.type = type;
      o.frequency.value = freq;
      f.type = "lowpass";
      f.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + attack);
      o.connect(f);
      f.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + len + attack + 0.05);
    },

    kick(t) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g);
      g.connect(this.musicGain);
      o.start(t);
      o.stop(t + 0.22);
    },

    noiseHit(t, len, vol, type, freq, dest) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noise;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(f);
      f.connect(g);
      g.connect(dest);
      src.start(t, Math.random() * 0.5);
      src.stop(t + len + 0.02);
    },

    snare(t, vol) {
      this.noiseHit(t, 0.14, vol, "bandpass", 1800, this.musicGain);
    },

    hat(t, vol) {
      this.noiseHit(t, 0.04, vol, "highpass", 7000, this.musicGain);
    },

    // Sound effects. Each recipe is a few oscillators and noise bursts.
    sfx(name, opts = {}) {
      if (!this.ctx || this.ctx.state !== "running") return;
      const now = this.ctx.currentTime;
      // The same sound twice within 35 ms adds nothing but noise.
      if (this.lastPlayed[name] && now - this.lastPlayed[name] < 0.035) return;
      this.lastPlayed[name] = now;
      if (this.buffers[name]) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers[name];
        src.connect(this.sfxGain);
        src.start(now);
        return;
      }
      const recipe = SFX[name];
      if (recipe) recipe(this, now, opts);
    },

    sweep(t, f1, f2, len, type, vol, dest = this.sfxGain) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + len);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + len + 0.02);
    },

    noise2(t, len, vol, type, freq) {
      this.noiseHit(t, len, vol, type, freq, this.sfxGain);
    },
  };

  const SFX = {
    jump: (a, t) => a.sweep(t, 260, 520, 0.12, "square", 0.08),
    land: (a, t) => a.noise2(t, 0.06, 0.12, "lowpass", 500),
    step: (a, t) => a.noise2(t, 0.03, 0.04, "lowpass", 800),
    dodge: (a, t) => a.noise2(t, 0.18, 0.18, "bandpass", 1200),
    punch: (a, t) => {
      a.noise2(t, 0.08, 0.3, "lowpass", 900);
      a.sweep(t, 160, 60, 0.1, "sine", 0.3);
    },
    slash: (a, t) => {
      a.noise2(t, 0.12, 0.22, "highpass", 3000);
      a.sweep(t, 1800, 600, 0.1, "sawtooth", 0.05);
    },
    hit: (a, t) => {
      a.noise2(t, 0.07, 0.25, "bandpass", 1400);
      a.sweep(t, 300, 120, 0.08, "square", 0.08);
    },
    hitHeavy: (a, t) => {
      a.noise2(t, 0.18, 0.4, "lowpass", 700);
      a.sweep(t, 180, 40, 0.2, "sine", 0.4);
    },
    beam: (a, t) => {
      a.sweep(t, 900, 300, 0.35, "sawtooth", 0.1);
      a.sweep(t, 1800, 700, 0.35, "square", 0.04);
    },
    blast: (a, t) => {
      a.sweep(t, 700, 200, 0.2, "square", 0.1);
      a.noise2(t, 0.12, 0.1, "bandpass", 2000);
    },
    psychic: (a, t) => {
      a.sweep(t, 400, 1200, 0.25, "sine", 0.14);
      a.sweep(t + 0.05, 600, 1600, 0.2, "triangle", 0.08);
    },
    wind: (a, t) => a.noise2(t, 0.35, 0.22, "bandpass", 600),
    lightning: (a, t) => {
      a.noise2(t, 0.5, 0.5, "highpass", 1500);
      a.sweep(t, 120, 40, 0.5, "sawtooth", 0.25);
    },
    ice: (a, t) => {
      a.sweep(t, 2400, 1200, 0.18, "triangle", 0.1);
      a.noise2(t, 0.15, 0.1, "highpass", 5000);
    },
    fire: (a, t) => a.noise2(t, 0.4, 0.3, "lowpass", 1200),
    card: (a, t) => {
      a.sweep(t, 1200, 2200, 0.08, "square", 0.06);
      a.noise2(t, 0.05, 0.08, "highpass", 4000);
    },
    teleport: (a, t) => {
      a.noise2(t, 0.2, 0.3, "lowpass", 1500);
      a.sweep(t, 200, 900, 0.15, "sine", 0.15);
    },
    firework: (a, t) => {
      a.sweep(t, 300, 1600, 0.25, "triangle", 0.08);
      a.noise2(t + 0.22, 0.3, 0.25, "highpass", 2500);
    },
    explosion: (a, t) => {
      a.noise2(t, 0.6, 0.6, "lowpass", 600);
      a.sweep(t, 120, 30, 0.6, "sine", 0.5);
    },
    stomp: (a, t) => {
      a.sweep(t, 90, 30, 0.35, "sine", 0.6);
      a.noise2(t, 0.3, 0.35, "lowpass", 300);
    },
    orb: (a, t) => {
      a.sweep(t, 900, 1500, 0.08, "sine", 0.1);
      a.sweep(t + 0.06, 1300, 2000, 0.1, "sine", 0.08);
    },
    xsymbol: (a, t) => {
      [0, 4, 7, 12, 16].forEach((n, i) => a.sweep(t + i * 0.07, NOTE(72 + n), NOTE(72 + n), 0.25, "square", 0.07));
    },
    pickup: (a, t) => {
      a.sweep(t, 500, 1000, 0.1, "triangle", 0.12);
      a.sweep(t + 0.08, 750, 1500, 0.12, "triangle", 0.1);
    },
    heal: (a, t) => [0, 4, 7].forEach((n, i) => a.sweep(t + i * 0.06, NOTE(76 + n), NOTE(76 + n), 0.18, "sine", 0.1)),
    hurt: (a, t) => {
      a.sweep(t, 400, 120, 0.2, "sawtooth", 0.14);
      a.noise2(t, 0.1, 0.15, "lowpass", 1000);
    },
    enemyHurt: (a, t) => a.sweep(t, 260, 120, 0.1, "square", 0.07),
    enemyDie: (a, t) => {
      a.sweep(t, 300, 50, 0.3, "sawtooth", 0.12);
      a.noise2(t, 0.25, 0.2, "lowpass", 800);
    },
    shoot: (a, t) => a.sweep(t, 900, 250, 0.12, "square", 0.06),
    laser: (a, t) => a.sweep(t, 1600, 900, 0.3, "sawtooth", 0.06),
    charge: (a, t) => a.sweep(t, 200, 900, 0.5, "triangle", 0.08),
    roar: (a, t) => {
      a.sweep(t, 160, 70, 0.8, "sawtooth", 0.22);
      a.noise2(t, 0.8, 0.25, "lowpass", 700);
    },
    ui: (a, t) => a.sweep(t, 700, 900, 0.05, "square", 0.05),
    uiBack: (a, t) => a.sweep(t, 600, 400, 0.06, "square", 0.05),
    confirm: (a, t) => {
      a.sweep(t, 600, 600, 0.06, "square", 0.06);
      a.sweep(t + 0.06, 900, 900, 0.1, "square", 0.06);
    },
    denied: (a, t) => a.sweep(t, 200, 140, 0.18, "square", 0.08),
    levelup: (a, t) => [0, 4, 7, 12].forEach((n, i) => a.sweep(t + i * 0.09, NOTE(67 + n), NOTE(67 + n), 0.3, "square", 0.08)),
    unlock: (a, t) => [0, 7, 12].forEach((n, i) => a.sweep(t + i * 0.1, NOTE(72 + n), NOTE(72 + n), 0.35, "triangle", 0.12)),
    ultReady: (a, t) => [0, 7].forEach((n, i) => a.sweep(t + i * 0.12, NOTE(79 + n), NOTE(79 + n), 0.2, "sine", 0.12)),
    ultimate: (a, t) => {
      a.sweep(t, 100, 800, 0.6, "sawtooth", 0.18);
      a.noise2(t + 0.4, 0.8, 0.4, "lowpass", 900);
    },
    checkpoint: (a, t) => [0, 5, 9].forEach((n, i) => a.sweep(t + i * 0.08, NOTE(70 + n), NOTE(70 + n), 0.2, "triangle", 0.1)),
    break: (a, t) => {
      a.noise2(t, 0.25, 0.4, "bandpass", 900);
      a.sweep(t, 220, 80, 0.2, "square", 0.1);
    },
    secret: (a, t) => [0, 3, 7, 10, 14].forEach((n, i) => a.sweep(t + i * 0.08, NOTE(64 + n), NOTE(64 + n), 0.3, "sine", 0.1)),
    alarm: (a, t) => {
      a.sweep(t, 700, 500, 0.25, "square", 0.08);
      a.sweep(t + 0.25, 700, 500, 0.25, "square", 0.08);
    },
    achievement: (a, t) => [0, 4, 7, 11, 14].forEach((n, i) => a.sweep(t + i * 0.07, NOTE(74 + n), NOTE(74 + n), 0.3, "triangle", 0.09)),
    bossDie: (a, t) => {
      for (let i = 0; i < 4; i++) a.noise2(t + i * 0.25, 0.5, 0.5, "lowpass", 500 + i * 150);
      a.sweep(t, 200, 30, 1.4, "sawtooth", 0.25);
    },
    type: (a, t) => a.sweep(t, 1100, 1000, 0.02, "square", 0.02),
    magnet: (a, t) => {
      a.sweep(t, 80, 160, 0.5, "sawtooth", 0.15);
      a.sweep(t, 160, 320, 0.5, "square", 0.05);
    },
  };

  XM.Audio = Audio;
})(window.XM);
