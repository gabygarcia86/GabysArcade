/*
 * Sound effects and music, all synthesized with the Web Audio API (no audio files).
 * Browsers only allow sound after a tap or key press, so the context starts on the
 * first one. Both tunes are original: a bouncy waltz for the menus and a sneaky
 * tiptoe tune for heists, which gains drums during a chase and speeds up near the end.
 */
(function (G) {
  "use strict";

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---------------------------------------------------------------- Tunes

  // Heist tune, D minor, eighth notes. Two four-bar phrases.
  const PLAY_MELODY = [
    62, 0, 65, 0, 69, 67, 65, 64, 65, 0, 62, 0, 58, 0, 0, 0,
    67, 0, 70, 0, 69, 67, 65, 67, 69, 0, 64, 0, 61, 0, 57, 0,
    74, 0, 72, 0, 70, 69, 67, 65, 70, 0, 69, 0, 67, 65, 64, 62,
    64, 65, 67, 0, 70, 69, 67, 64, 62, 0, 57, 0, 62, 0, 0, 0,
  ];
  const PLAY_COUNTER = [
    0, 0, 0, 0, 74, 0, 0, 0, 0, 0, 77, 0, 0, 0, 74, 0,
    0, 0, 0, 0, 79, 0, 0, 0, 0, 0, 76, 0, 0, 0, 73, 0,
    0, 0, 0, 0, 77, 0, 0, 0, 0, 0, 74, 0, 0, 0, 70, 0,
    0, 0, 0, 0, 76, 0, 0, 0, 0, 0, 73, 0, 74, 0, 0, 0,
  ];
  const PLAY_BASS = [
    38, 0, 45, 0, 38, 0, 45, 0, 34, 0, 41, 0, 34, 0, 41, 0,
    31, 0, 38, 0, 31, 0, 38, 0, 33, 0, 40, 0, 33, 37, 40, 45,
    38, 0, 45, 0, 38, 0, 45, 0, 31, 0, 38, 0, 34, 0, 41, 0,
    34, 0, 41, 0, 33, 0, 40, 0, 38, 0, 45, 0, 38, 0, 38, 0,
  ];

  // Menu waltz, C major, one note per beat, three beats a bar.
  const MENU_MELODY = [
    64, 67, 72, 71, 69, 67, 69, 65, 69, 72, 0, 0,
    71, 67, 74, 72, 71, 69, 67, 64, 60, 67, 0, 0,
    69, 72, 77, 76, 74, 72, 76, 72, 67, 64, 0, 0,
    74, 71, 67, 65, 64, 62, 60, 64, 67, 72, 0, 0,
  ];
  const MENU_ROOTS = [48, 48, 53, 53, 43, 43, 48, 48, 53, 53, 48, 48, 43, 43, 48, 48];
  const MENU_CHORDS = {
    48: [52, 55, 60],
    53: [53, 57, 60],
    43: [50, 55, 59],
  };

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
    loop: 0,
    nextTime: 0,
    timer: null,
    chase: false,
    hurry: false,
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
      comp.threshold.value = -14;
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
      this.musicBus.gain.setTargetAtTime(s.music * 0.42, t, 0.03);
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
        f.frequency.value = o.filterFreq || 1200;
        f.Q.value = o.q || 1;
        osc.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(o.dest || this.sfxBus);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    },

    noise(start, dur, o = {}) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = o.filter || "bandpass";
      f.frequency.setValueAtTime(o.freq || 1500, start);
      if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, start + dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      const vol = o.vol == null ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(f);
      f.connect(g);
      g.connect(o.dest || this.sfxBus);
      src.start(start, Math.random() * 0.5);
      src.stop(start + dur + 0.02);
    },

    bell(freq, start, dur, vol, dest) {
      this.tone(freq, start, dur, { vol, dest });
      this.tone(freq * 2.76, start, dur * 0.45, { vol: vol * 0.35, dest });
      this.tone(freq * 5.4, start, dur * 0.2, { vol: vol * 0.15, dest });
    },

    jingle(start, count, vol, dest) {
      for (let i = 0; i < count; i++) {
        const t = start + i * 0.055 + Math.random() * 0.02;
        this.noise(t, 0.07, { filter: "highpass", freq: 6500, vol: vol * (0.6 + Math.random() * 0.4), dest });
        this.tone(2400 + Math.random() * 900, t, 0.06, { vol: vol * 0.25, type: "triangle", dest });
      }
    },

    // ---------------------------------------------------------------- Sound effects

    play(name, opt = {}) {
      if (!this.ensure()) return;
      if (this.settings.muted || this.settings.sfx <= 0) return;
      const now = this.ctx.currentTime;
      // Very quick repeats of the same sound get merged.
      const gap = opt.gap == null ? 0.04 : opt.gap;
      if (this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return;
      this.lastPlayed[name] = now;
      const t = now + 0.005;
      const fn = SFX[name];
      if (fn) fn.call(this, t, opt);
    },

    // ---------------------------------------------------------------- Music

    playMusic(track) {
      this.wantTrack = track;
      if (!this.ctx) return;
      if (this.track === track) return;
      this.startTrack(track);
    },

    startTrack(track) {
      this.stopTrack();
      this.track = track;
      if (!track) return;
      this.step = 0;
      this.loop = 0;
      this.nextTime = this.ctx.currentTime + 0.12;
      this.timer = setInterval(() => this.schedule(), 30);
    },

    stopTrack() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.track = null;
    },

    setIntensity(chase, hurry) {
      this.chase = chase;
      this.hurry = hurry;
    },

    schedule() {
      if (!this.ctx || !this.track) return;
      if (this.ctx.state !== "running") {
        this.nextTime = this.ctx.currentTime + 0.1;
        return;
      }
      if (this.nextTime < this.ctx.currentTime - 0.3) this.nextTime = this.ctx.currentTime + 0.05;
      while (this.nextTime < this.ctx.currentTime + 0.16) {
        const dur = this.track === "menu" ? this.menuStep(this.nextTime) : this.playStep(this.nextTime);
        this.nextTime += dur;
      }
    },

    playStep(t) {
      const bpm = this.hurry ? 168 : this.chase ? 146 : 128;
      const stepDur = 60 / bpm / 2;
      const i = this.step % PLAY_MELODY.length;
      const bus = this.musicBus;
      const m = PLAY_MELODY[i];
      if (m) {
        if (this.loop % 2 === 0) {
          this.tone(midi(m), t, stepDur * 1.6, { type: "triangle", vol: 0.22, dest: bus });
          this.tone(midi(m + 12), t, stepDur * 0.6, { type: "sine", vol: 0.05, dest: bus });
        } else {
          this.bell(midi(m + 12), t, stepDur * 2.6, 0.13, bus);
        }
      }
      if (this.loop % 2 === 1 && PLAY_COUNTER[i]) {
        this.tone(midi(PLAY_COUNTER[i]), t, stepDur * 3, { type: "sine", vol: 0.07, dest: bus });
      }
      const b = PLAY_BASS[i];
      if (b) {
        this.tone(midi(b), t, stepDur * 0.9, {
          type: "square",
          vol: 0.12,
          filter: "lowpass",
          filterFreq: 520,
          dest: bus,
        });
      }
      // Sleigh shaker on the off-beats, always.
      if (i % 4 === 2) this.noise(t, 0.06, { filter: "highpass", freq: 7000, vol: 0.05, dest: bus });
      if (this.chase || this.hurry) {
        if (i % 4 === 0) {
          this.tone(130, t, 0.16, { type: "sine", slide: 45, vol: 0.32, dest: bus });
        }
        if (i % 8 === 4) this.noise(t, 0.12, { filter: "bandpass", freq: 1800, q: 0.7, vol: 0.14, dest: bus });
        this.noise(t, 0.03, { filter: "highpass", freq: 9000, vol: 0.035, dest: bus });
      }
      this.step++;
      if (this.step % PLAY_MELODY.length === 0) this.loop++;
      return stepDur;
    },

    menuStep(t) {
      const beat = 60 / 150;
      const i = this.step % MENU_MELODY.length;
      const bus = this.musicBus;
      const bar = Math.floor(this.step / 3) % MENU_ROOTS.length;
      const root = MENU_ROOTS[bar];
      const m = MENU_MELODY[i];
      if (m) this.bell(midi(m + 12), t, beat * 2.2, 0.12, bus);
      if (m && this.loop % 2 === 1) this.tone(midi(m), t, beat * 0.9, { type: "triangle", vol: 0.07, dest: bus });
      const inBar = this.step % 3;
      if (inBar === 0) {
        this.tone(midi(root - 12), t, beat * 0.9, { type: "triangle", vol: 0.2, dest: bus });
      } else {
        for (const n of MENU_CHORDS[root]) this.tone(midi(n), t, beat * 0.5, { type: "triangle", vol: 0.045, dest: bus });
        this.noise(t, 0.05, { filter: "highpass", freq: 7500, vol: 0.04, dest: bus });
      }
      this.step++;
      if (this.step % MENU_MELODY.length === 0) this.loop++;
      return beat;
    },
  };

  // Every sound effect, by name. `this` is the audio engine; `t` is the start time.
  const SFX = {
    click(t) {
      this.tone(720, t, 0.06, { type: "triangle", vol: 0.18 });
    },
    collect(t) {
      this.bell(midi(79), t, 0.25, 0.16);
      this.bell(midi(86), t + 0.07, 0.35, 0.14);
    },
    present(t) {
      this.bell(midi(79), t, 0.3, 0.17);
      this.bell(midi(83), t + 0.06, 0.3, 0.14);
      this.bell(midi(86), t + 0.12, 0.45, 0.14);
    },
    candy(t) {
      this.noise(t, 0.05, { freq: 3000, q: 2, vol: 0.18 });
      this.noise(t + 0.06, 0.05, { freq: 2600, q: 2, vol: 0.14 });
      this.tone(midi(84), t + 0.04, 0.15, { type: "triangle", vol: 0.1 });
    },
    goldBell(t) {
      [72, 76, 79, 84].forEach((n, k) => this.bell(midi(n + 12), t + k * 0.08, 1.3, 0.14));
      this.jingle(t + 0.1, 6, 0.12);
    },
    bigLoot(t) {
      [67, 71, 74, 79, 83].forEach((n, k) => this.bell(midi(n + 12), t + k * 0.06, 0.6, 0.12));
    },
    laugh(t) {
      // "Heh heh heh heh": short buzzy pulses through a vowel-like filter, dropping in pitch.
      for (let k = 0; k < 4; k++) {
        const s = t + k * 0.13;
        const f = 230 - k * 18;
        this.tone(f, s, 0.1, { type: "sawtooth", vol: 0.16, filter: "bandpass", filterFreq: 900, q: 3, slide: f * 0.85 });
        this.noise(s, 0.06, { freq: 2500, q: 1.5, vol: 0.05 });
      }
    },
    startled(t) {
      this.tone(220, t, 0.28, { type: "square", vol: 0.12, slide: 880, slideTime: 0.2, filter: "lowpass", filterFreq: 2400, vibrato: 30 });
      this.tone(1320, t + 0.02, 0.12, { type: "sine", vol: 0.08 });
    },
    caught(t) {
      this.tone(330, t, 0.32, { type: "sawtooth", vol: 0.14, slide: 290, filter: "lowpass", filterFreq: 900 });
      this.tone(290, t + 0.34, 0.32, { type: "sawtooth", vol: 0.14, slide: 250, filter: "lowpass", filterFreq: 900 });
      this.tone(250, t + 0.68, 0.7, { type: "sawtooth", vol: 0.14, slide: 170, filter: "lowpass", filterFreq: 800, vibrato: 8 });
    },
    shout(t, o) {
      const p = o.pitch || 1;
      this.tone(420 * p, t, 0.16, { type: "square", vol: 0.1, slide: 640 * p, filter: "bandpass", filterFreq: 1300, q: 2 });
      this.tone(640 * p, t + 0.16, 0.14, { type: "square", vol: 0.08, slide: 520 * p, filter: "bandpass", filterFreq: 1300, q: 2 });
      this.noise(t, 0.08, { freq: 2200, vol: 0.06 });
    },
    hmm(t) {
      this.tone(260, t, 0.3, { type: "triangle", vol: 0.12, slide: 330, vibrato: 6 });
    },
    bark(t, o) {
      const p = o.pitch || 1;
      for (let k = 0; k < 2; k++) {
        const s = t + k * 0.17;
        this.noise(s, 0.09, { freq: 700 * p, q: 2, vol: 0.22 });
        this.tone(200 * p, s, 0.1, { type: "square", vol: 0.12, slide: 120 * p, filter: "lowpass", filterFreq: 1200 });
      }
    },
    maxBark(t) {
      this.noise(t, 0.07, { freq: 1100, q: 2, vol: 0.2 });
      this.tone(380, t, 0.09, { type: "square", vol: 0.11, slide: 240, filter: "lowpass", filterFreq: 1800 });
      this.noise(t + 0.13, 0.07, { freq: 1200, q: 2, vol: 0.2 });
      this.tone(420, t + 0.13, 0.09, { type: "square", vol: 0.11, slide: 260, filter: "lowpass", filterFreq: 1800 });
    },
    maxAppear(t) {
      this.jingle(t, 5, 0.12);
      SFX.maxBark.call(this, t + 0.25);
    },
    snowball(t) {
      this.noise(t, 2.6, { filter: "lowpass", freq: 260, q: 0.8, vol: 0.35, attack: 0.3 });
      this.tone(55, t, 2.6, { type: "sine", vol: 0.15, attack: 0.3, vibrato: 4, vibratoRate: 9 });
    },
    powerup(t) {
      [72, 76, 79, 84, 88].forEach((n, k) => this.tone(midi(n), t + k * 0.05, 0.18, { type: "triangle", vol: 0.13 }));
    },
    golden(t) {
      [84, 88, 91, 96].forEach((n, k) => this.bell(midi(n), t + k * 0.07, 0.7, 0.12));
    },
    getaway(t) {
      this.jingle(t, 14, 0.14);
      this.noise(t + 0.2, 0.9, { filter: "bandpass", freq: 400, slide: 3000, q: 0.8, vol: 0.18 });
      [67, 72, 76, 79, 84].forEach((n, k) => this.bell(midi(n + 12), t + 0.3 + k * 0.09, 0.8, 0.12));
    },
    levelComplete(t) {
      const notes = [72, 76, 79, 84, 0, 79, 84];
      notes.forEach((n, k) => {
        if (n) this.bell(midi(n), t + k * 0.13, 0.7, 0.15);
      });
      this.tone(midi(48), t, 0.9, { type: "triangle", vol: 0.15 });
      this.tone(midi(55), t + 0.52, 1.0, { type: "triangle", vol: 0.15 });
    },
    fail(t) {
      [67, 66, 65, 64].forEach((n, k) =>
        this.tone(midi(n - 12), t + k * 0.32, k === 3 ? 0.9 : 0.3, {
          type: "sawtooth",
          vol: 0.12,
          filter: "lowpass",
          filterFreq: 900,
          vibrato: k === 3 ? 8 : 0,
        }),
      );
    },
    tick(t) {
      this.tone(1500, t, 0.04, { type: "square", vol: 0.06, filter: "lowpass", filterFreq: 3000 });
    },
    drop(t) {
      for (let k = 0; k < 5; k++) {
        this.tone(500 + Math.random() * 900, t + k * 0.05, 0.08, { type: "triangle", vol: 0.1 });
      }
      this.noise(t, 0.2, { freq: 1500, vol: 0.08 });
    },
    bonk(t) {
      this.tone(180, t, 0.25, { type: "sine", vol: 0.3, slide: 70 });
      this.noise(t, 0.08, { filter: "lowpass", freq: 600, vol: 0.25 });
      this.tone(900, t + 0.05, 0.25, { type: "sine", vol: 0.07, vibrato: 40, vibratoRate: 18 });
    },
    dig(t) {
      for (let k = 0; k < 4; k++) this.noise(t + k * 0.12, 0.08, { filter: "lowpass", freq: 900, vol: 0.15 });
    },
    jingleShort(t) {
      this.jingle(t, 6, 0.12);
    },
    event(t) {
      this.bell(midi(81), t, 0.3, 0.13);
      this.bell(midi(76), t + 0.12, 0.4, 0.13);
    },
    timber(t) {
      this.tone(160, t, 0.7, { type: "sawtooth", vol: 0.08, slide: 90, filter: "lowpass", filterFreq: 600, vibrato: 12, vibratoRate: 20 });
      this.noise(t + 0.75, 0.4, { filter: "lowpass", freq: 300, vol: 0.4 });
      this.tone(70, t + 0.75, 0.35, { type: "sine", vol: 0.3, slide: 40 });
    },
    boost(t) {
      this.noise(t, 0.3, { filter: "bandpass", freq: 600, slide: 2600, q: 1.2, vol: 0.14 });
    },
    lifeUp(t) {
      [72, 79, 84, 91].forEach((n, k) => this.tone(midi(n), t + k * 0.07, 0.2, { type: "square", vol: 0.07, filter: "lowpass", filterFreq: 3000 }));
    },
    beep(t, o) {
      this.tone(o.high ? 1046 : 660, t, 0.18, { type: "triangle", vol: 0.2 });
    },
    slip(t) {
      this.tone(900, t, 0.3, { type: "sine", vol: 0.1, slide: 300, vibrato: 20 });
    },
    stamp(t) {
      this.noise(t, 0.12, { filter: "lowpass", freq: 500, vol: 0.25 });
      this.tone(90, t, 0.12, { type: "square", vol: 0.1, slide: 50, filter: "lowpass", filterFreq: 400 });
    },
    party(t) {
      [72, 76, 79, 76, 84].forEach((n, k) => this.tone(midi(n), t + k * 0.08, 0.12, { type: "square", vol: 0.06, filter: "lowpass", filterFreq: 2500 }));
      this.noise(t, 0.3, { filter: "highpass", freq: 4000, vol: 0.08 });
    },
    whoosh(t) {
      this.noise(t, 0.4, { filter: "bandpass", freq: 300, slide: 1800, q: 0.9, vol: 0.15 });
    },
  };

  G.Audio = A;
})(window.GH);
