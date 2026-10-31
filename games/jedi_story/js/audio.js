/*
 * AudioManager: every sound and all the music is synthesized with Web Audio unless
 * js/audio-config.js names a file to use instead. The music is original, an orchestra
 * sketched from detuned strings, brass stabs, a choir pad, harp and timpani.
 */
(function (J) {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
  };

  // chords: scale degrees, one per bar. lead: scale degrees per half beat (null = rest).
  const SONGS = {
    menu: { bpm: 84, root: 50, scale: "minor", chords: [0, 5, 3, 4], style: "heroic",
      lead: [0, null, 4, null, 7, null, null, 6, 5, null, 4, null, 2, null, null, null, 3, null, 4, 5, 4, null, 2, null, 4, null, null, null, null, null, null, null] },
    cinematic: { bpm: 66, root: 48, scale: "dorian", chords: [0, 3, 5, 4], style: "mystic",
      lead: [7, null, null, null, 6, null, 4, null, 5, null, null, null, null, null, null, null] },
    ending: { bpm: 80, root: 53, scale: "major", chords: [0, 3, 4, 0, 5, 3, 1, 4], style: "heroic",
      lead: [0, null, 2, 4, 7, null, null, null, 8, null, 7, null, 4, null, null, null, 5, null, 4, 2, 4, null, null, null, 2, null, null, null, null, null, null, null] },
    level1: { bpm: 104, root: 50, scale: "dorian", chords: [0, 3, 0, 6], style: "march",
      lead: [0, null, 0, 2, 4, null, 2, null, 3, null, 4, null, 2, null, null, null] },
    level2: { bpm: 96, root: 45, scale: "dorian", chords: [0, 6, 3, 4], style: "tribal",
      lead: [4, null, null, 3, 2, null, 0, null, null, null, 2, null, 3, null, null, null] },
    level3: { bpm: 92, root: 52, scale: "phrygian", chords: [0, 1, 0, 6], style: "desert",
      lead: [0, 1, null, 2, 4, null, null, 2, 1, null, 0, null, null, null, null, null] },
    level4: { bpm: 112, root: 40, scale: "harmonic", chords: [0, 5, 4, 0], style: "battle",
      lead: [7, null, 6, null, 5, null, 4, null, 3, null, 4, null, 0, null, null, null] },
    level5: { bpm: 80, root: 47, scale: "minor", chords: [0, 2, 5, 4], style: "mystic",
      lead: [4, null, null, null, 7, null, null, 6, 4, null, null, null, 2, null, null, null] },
    level6: { bpm: 118, root: 43, scale: "phrygian", chords: [0, 0, 1, 6], style: "pulse",
      lead: [0, null, 0, 1, null, 3, null, 1, 0, null, null, 6, 0, null, null, null] },
    level7: { bpm: 108, root: 46, scale: "minor", chords: [0, 5, 2, 6], style: "march",
      lead: [0, null, 2, null, 3, null, 4, 3, 2, null, 0, null, 6, null, null, null] },
    level8: { bpm: 120, root: 38, scale: "harmonic", chords: [0, 1, 5, 4], style: "battle",
      lead: [0, null, 0, null, 2, 3, 2, 0, 6, null, null, null, 0, null, null, null] },
    level9: { bpm: 88, root: 37, scale: "phrygian", chords: [0, 1, 6, 0], style: "dark",
      lead: [7, null, 8, null, 7, null, null, null, 5, null, 4, null, null, null, null, null] },
    level10: { bpm: 100, root: 36, scale: "harmonic", chords: [0, 5, 1, 4], style: "dark",
      lead: [0, null, 4, null, 7, null, 8, null, 7, null, 4, null, 3, null, null, null] },
    boss: { bpm: 140, root: 41, scale: "harmonic", chords: [0, 0, 1, 4], style: "boss",
      lead: [7, null, 7, 8, 7, null, 4, null, 5, null, 4, 3, 4, null, null, null] },
    bossMaul: { bpm: 150, root: 40, scale: "phrygian", chords: [0, 1, 0, 6], style: "boss",
      lead: [7, 8, 7, null, 5, null, 3, 5, 7, null, null, 8, 7, null, null, null] },
    bossDooku: { bpm: 126, root: 42, scale: "harmonic", chords: [0, 3, 4, 0], style: "boss",
      lead: [0, 2, 3, 4, 7, null, 6, null, 5, 4, 3, 2, 3, null, null, null] },
    bossVentress: { bpm: 156, root: 44, scale: "phrygian", chords: [0, 6, 1, 0], style: "boss",
      lead: [4, null, 5, null, 4, 3, 1, null, 0, null, 1, null, 3, null, null, null] },
    bossVader: { bpm: 112, root: 36, scale: "harmonic", chords: [0, 5, 0, 4], style: "boss",
      lead: [0, null, null, 0, 3, null, 2, null, 0, null, null, 6, 0, null, null, null] },
    bossPalpatine: { bpm: 132, root: 37, scale: "harmonic", chords: [0, 1, 5, 4, 0, 1, 3, 4], style: "boss",
      lead: [7, 6, 7, null, 8, null, 7, 5, 4, null, 3, null, 2, null, 0, null] },
  };

  // Which layers each style uses, and how the drums fall on a 16-step bar.
  const STYLES = {
    heroic: { pad: 0.34, choir: 0.1, harp: 0.14, brass: 0.2, lead: 0.2, kick: "x.......x.......", snare: "................", arp: true },
    mystic: { pad: 0.36, choir: 0.2, harp: 0.14, brass: 0, lead: 0.13, kick: "x...............", snare: "................", arp: true },
    march: { pad: 0.26, choir: 0, harp: 0, brass: 0.22, lead: 0.17, kick: "x...x...x...x...", snare: "....x..x....x.xx", arp: false },
    tribal: { pad: 0.24, choir: 0.08, harp: 0.14, brass: 0, lead: 0.16, kick: "x..x..x.x..x..x.", snare: "....x.......x...", arp: true },
    desert: { pad: 0.24, choir: 0.09, harp: 0.17, brass: 0, lead: 0.18, kick: "x.....x.x.......", snare: "............x...", arp: true },
    battle: { pad: 0.26, choir: 0.12, harp: 0, brass: 0.26, lead: 0.17, kick: "x..x..x.x..x..x.", snare: "....x.......x.xx", arp: false },
    pulse: { pad: 0.2, choir: 0, harp: 0.17, brass: 0.13, lead: 0.16, kick: "x...x...x...x...", snare: "....x.......x...", arp: true },
    dark: { pad: 0.3, choir: 0.24, harp: 0, brass: 0.18, lead: 0.11, kick: "x.......x..x....", snare: "................", arp: false },
    boss: { pad: 0.22, choir: 0.2, harp: 0, brass: 0.3, lead: 0.2, kick: "x.x.x.x.x.x.x.xx", snare: "....x.......x.xx", arp: false },
  };

  // Ambience per theme: noise filter settings plus a low drone.
  const AMBIENCE = {
    temple: { filter: 500, q: 0.5, gain: 0.05, drone: 55, wobble: 0.1 },
    kashyyyk: { filter: 2200, q: 0.3, gain: 0.05, drone: 0, wobble: 0.3 },
    tatooine: { filter: 900, q: 1.1, gain: 0.08, drone: 0, wobble: 0.5 },
    mustafar: { filter: 180, q: 0.7, gain: 0.16, drone: 41, wobble: 0.4 },
    hoth: { filter: 1300, q: 1.6, gain: 0.08, drone: 0, wobble: 0.7 },
    narshaddaa: { filter: 1500, q: 0.4, gain: 0.06, drone: 73, wobble: 0.1 },
    endor: { filter: 2600, q: 0.3, gain: 0.04, drone: 0, wobble: 0.2 },
    deathstar: { filter: 240, q: 0.8, gain: 0.1, drone: 49, wobble: 0.05 },
    exegol: { filter: 340, q: 1.3, gain: 0.13, drone: 36, wobble: 0.6 },
    throne: { filter: 260, q: 1.4, gain: 0.12, drone: 33, wobble: 0.3 },
  };

  class AudioManager {
    constructor(options) {
      this.options = options;
      this.ctx = null;
      this.lastPlayed = {};
      this.custom = { sfx: {} };
      this.song = null;
      this.songName = null;
      this.fileMusic = null;
      this.step = 0;
      this.nextStepTime = 0;
      this.ambientNodes = null;
      this.hum = null;
      this.loops = {};
    }

    // Browsers only allow audio to start after a user gesture.
    unlock() {
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        const c = this.ctx;
        this.master = c.createDynamicsCompressor();
        this.master.connect(c.destination);
        this.sfxBus = c.createGain();
        this.musicBus = c.createGain();
        this.reverb = c.createConvolver();
        this.reverb.buffer = this.makeImpulse(2.4);
        const wet = c.createGain();
        wet.gain.value = 0.32;
        this.reverb.connect(wet).connect(this.master);
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.noise = this.makeNoise();
        this.applyVolumes();
        this.loadCustomSfx();
        this.timer = setInterval(() => this.schedule(), 40);
        if (this.pendingMusic) this.playMusic(this.pendingMusic);
        if (this.pendingAmbient) this.playAmbient(this.pendingAmbient);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    applyVolumes() {
      if (!this.ctx) return;
      this.sfxBus.gain.value = this.options.sfx;
      this.musicBus.gain.value = this.options.music * 0.7;
      if (this.fileMusic) this.fileMusic.volume = this.options.music;
      if (this.ambientFile) this.ambientFile.volume = this.options.sfx * 0.6;
    }

    suspend() {
      if (this.ctx) this.ctx.suspend();
      if (this.fileMusic) this.fileMusic.pause();
      if (this.ambientFile) this.ambientFile.pause();
    }

    resume() {
      if (this.ctx) this.ctx.resume();
      if (this.fileMusic) this.fileMusic.play().catch(() => {});
      if (this.ambientFile) this.ambientFile.play().catch(() => {});
    }

    makeNoise() {
      const c = this.ctx;
      const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    }

    makeImpulse(seconds) {
      const c = this.ctx;
      const length = Math.floor(c.sampleRate * seconds);
      const buffer = c.createBuffer(2, length, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
      return buffer;
    }

    // ---------- Custom files ----------

    loadCustomSfx() {
      const files = J.AUDIO_FILES.sfx;
      for (const name of Object.keys(files)) {
        const url = files[name];
        if (!url) continue;
        // fetch fails on file://, so an <audio> element is the fallback there.
        fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error(response.status);
            return response.arrayBuffer();
          })
          .then((data) => this.ctx.decodeAudioData(data))
          .then((buffer) => { this.custom.sfx[name] = { buffer }; })
          .catch(() => {
            const element = new Audio(url);
            element.addEventListener("canplaythrough", () => { this.custom.sfx[name] = { element }; }, { once: true });
            element.addEventListener("error", () => console.warn(`Jedi Story: couldn't load sound "${name}" from ${url}`), { once: true });
          });
      }
    }

    playCustom(name, volume) {
      const sound = this.custom.sfx[name];
      if (!sound) return false;
      if (sound.buffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = sound.buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(this.sfxBus);
        source.start();
      } else {
        const clone = sound.element.cloneNode();
        clone.volume = J.U.clamp(this.options.sfx * volume, 0, 1);
        clone.play().catch(() => {});
      }
      return true;
    }

    // ---------- Synth building blocks ----------

    env(gainNode, t, attack, peak, decay) {
      gainNode.gain.setValueAtTime(0.0001, t);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    tone(type, f0, f1, dur, peak, { t = this.ctx.currentTime, bus = this.sfxBus, attack = 0.005, verb = false } = {}) {
      const c = this.ctx;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
      this.env(gain, t, attack, peak, dur);
      osc.connect(gain).connect(bus);
      if (verb) gain.connect(this.reverb);
      osc.start(t);
      osc.stop(t + attack + dur + 0.02);
      return osc;
    }

    burst(dur, peak, { type = "bandpass", f0 = 1000, f1 = f0, q = 1, t = this.ctx.currentTime, bus = this.sfxBus, attack = 0.003, verb = false } = {}) {
      const c = this.ctx;
      const source = c.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = type;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
      const gain = c.createGain();
      this.env(gain, t, attack, peak, dur);
      source.connect(filter).connect(gain).connect(bus);
      if (verb) gain.connect(this.reverb);
      source.start(t, Math.random());
      source.stop(t + attack + dur + 0.02);
    }

    // ---------- Sound effects ----------

    play(name, volume = 1) {
      if (!this.ctx || this.ctx.state !== "running") return;
      const now = this.ctx.currentTime;
      // The same sound firing in the same few milliseconds just gets louder, not better.
      if (this.lastPlayed[name] && now - this.lastPlayed[name] < 0.035) return;
      this.lastPlayed[name] = now;
      if (J.AUDIO_FILES.sfx[name] && this.playCustom(name, volume)) return;
      const fx = this.fx[name];
      if (fx) fx.call(this, volume);
    }

    get fx() {
      this.fxTable = this.fxTable || {
        saberOn(v) {
          this.tone("sawtooth", 60, 180, 0.55, 0.16 * v);
          this.tone("sawtooth", 62, 230, 0.5, 0.1 * v);
          this.burst(0.3, 0.1 * v, { f0: 500, f1: 2400, q: 2 });
        },
        saberOff(v) {
          this.tone("sawtooth", 200, 50, 0.4, 0.13 * v);
          this.burst(0.25, 0.07 * v, { f0: 1600, f1: 300, q: 2 });
        },
        swing(v) {
          const r = J.U.rand(0.85, 1.25);
          this.tone("sawtooth", 170 * r, 95 * r, 0.2, 0.11 * v);
          this.burst(0.17, 0.2 * v, { f0: 700 * r, f1: 2100 * r, q: 1.3 });
        },
        saberHit(v) {
          this.tone("sawtooth", 320, 90, 0.16, 0.16 * v);
          this.burst(0.14, 0.3 * v, { f0: 3400, f1: 800, q: 1 });
        },
        clash(v) {
          this.tone("square", 1250, 760, 0.1, 0.1 * v, { verb: true });
          this.tone("sawtooth", 95, 65, 0.3, 0.16 * v);
          this.burst(0.28, 0.38 * v, { f0: 5200, f1: 1100, q: 0.8, verb: true });
        },
        blaster(v) {
          const r = J.U.rand(0.92, 1.1);
          this.tone("sawtooth", 1500 * r, 150 * r, 0.14, 0.09 * v);
          this.tone("square", 800 * r, 90 * r, 0.11, 0.05 * v);
        },
        deflect(v) {
          this.tone("sine", 2000, 620, 0.12, 0.14 * v);
          this.burst(0.08, 0.2 * v, { f0: 4200, q: 3 });
        },
        perfect(v) {
          this.tone("sine", 1250, 2500, 0.16, 0.16 * v, { verb: true });
          this.tone("triangle", 1875, 3750, 0.2, 0.1 * v, { verb: true });
          this.burst(0.1, 0.24 * v, { f0: 5200, q: 3 });
        },
        push(v) {
          this.tone("sine", 220, 42, 0.4, 0.35 * v);
          this.burst(0.42, 0.34 * v, { f0: 300, f1: 1800, q: 0.7, type: "lowpass", verb: true });
        },
        jump(v) { this.tone("triangle", 200, 400, 0.11, 0.06 * v); },
        land(v) { this.burst(0.07, 0.1 * v, { f0: 300, type: "lowpass" }); },
        hurt(v) {
          this.tone("sawtooth", 260, 90, 0.22, 0.16 * v);
          this.burst(0.12, 0.13 * v, { f0: 900 });
        },
        enemyHit(v) {
          this.tone("square", 170, 70, 0.1, 0.09 * v);
          this.burst(0.09, 0.16 * v, { f0: 1500 });
        },
        droidHit(v) {
          this.tone("square", 880, 240, 0.09, 0.08 * v);
          this.burst(0.1, 0.2 * v, { f0: 3800, q: 2 });
        },
        explosion(v) {
          this.tone("sine", 130, 28, 0.6, 0.5 * v);
          this.burst(0.7, 0.55 * v, { f0: 1500, f1: 110, type: "lowpass", verb: true });
        },
        crystal(v) {
          const t = this.ctx.currentTime;
          this.tone("sine", 1320, 1320, 0.1, 0.09 * v, { t });
          this.tone("sine", 1976, 1976, 0.16, 0.08 * v, { t: t + 0.05 });
        },
        holocron(v) {
          const t = this.ctx.currentTime;
          [659, 880, 1109, 1319].forEach((f, i) => this.tone("triangle", f, f, 0.42, 0.11 * v, { t: t + i * 0.09, verb: true }));
        },
        heal(v) { this.tone("sine", 440, 880, 0.3, 0.13 * v, { verb: true }); },
        checkpoint(v) {
          const t = this.ctx.currentTime;
          [523, 784].forEach((f, i) => this.tone("sine", f, f, 0.4, 0.13 * v, { t: t + i * 0.12, verb: true }));
        },
        switch(v) {
          this.tone("square", 400, 180, 0.08, 0.1 * v);
          this.tone("square", 620, 620, 0.1, 0.07 * v, { t: this.ctx.currentTime + 0.08 });
        },
        door(v) {
          this.tone("sawtooth", 80, 200, 0.55, 0.12 * v);
          this.burst(0.5, 0.16 * v, { f0: 700, f1: 1700, q: 2 });
        },
        lightning(v) {
          for (let i = 0; i < 6; i++) {
            this.burst(0.08, 0.2 * v, { f0: J.U.rand(1600, 7000), q: 5, t: this.ctx.currentTime + i * 0.04 });
          }
          this.tone("sawtooth", 72, 54, 0.3, 0.14 * v);
        },
        choke(v) { this.tone("sawtooth", 120, 62, 0.8, 0.15 * v, { attack: 0.2 }); },
        bossIntro(v) {
          const t = this.ctx.currentTime;
          this.tone("sawtooth", 55, 55, 1.6, 0.28 * v, { t, attack: 0.1, verb: true });
          this.tone("sawtooth", 82.4, 82.4, 1.6, 0.2 * v, { t, attack: 0.1, verb: true });
          this.tone("sawtooth", 116.5, 116.5, 1.6, 0.17 * v, { t, attack: 0.1, verb: true });
          this.burst(1.4, 0.3 * v, { f0: 90, f1: 400, type: "lowpass", verb: true });
        },
        bossDown(v) {
          this.tone("sine", 220, 30, 1.3, 0.5 * v, { verb: true });
          this.burst(1.5, 0.6 * v, { f0: 2500, f1: 80, type: "lowpass", verb: true });
        },
        maulSting(v) {
          this.tone("sawtooth", 150, 75, 0.5, 0.2 * v, { verb: true });
          this.tone("sawtooth", 158, 70, 0.5, 0.15 * v, { verb: true });
        },
        dookuSting(v) { this.tone("sine", 880, 660, 0.45, 0.13 * v, { verb: true }); },
        ventressHiss(v) { this.burst(0.5, 0.2 * v, { f0: 6200, f1: 3200, q: 2, verb: true }); },
        vaderBreath(v) {
          const t = this.ctx.currentTime;
          this.burst(0.8, 0.13 * v, { f0: 700, f1: 950, q: 4, t, attack: 0.25 });
          this.burst(0.9, 0.11 * v, { f0: 500, f1: 320, q: 4, t: t + 1.15, attack: 0.25 });
        },
        // The Emperor's cackle, a stuttering falling voice.
        cackle(v) {
          const t = this.ctx.currentTime;
          for (let i = 0; i < 7; i++) {
            const f = 300 - i * 16;
            this.tone("sawtooth", f, f * 0.8, 0.09, 0.1 * v, { t: t + i * 0.12, verb: true });
          }
        },
        victory(v) {
          const t = this.ctx.currentTime;
          [523, 659, 784, 1047].forEach((f, i) => {
            this.tone("sawtooth", f, f, 0.5, 0.07 * v, { t: t + i * 0.14, verb: true });
            this.tone("triangle", f / 2, f / 2, 0.6, 0.11 * v, { t: t + i * 0.14, verb: true });
          });
        },
        defeat(v) {
          const t = this.ctx.currentTime;
          [392, 370, 311, 233].forEach((f, i) => this.tone("sawtooth", f, f, 0.7, 0.09 * v, { t: t + i * 0.28, verb: true }));
        },
        click(v) { this.tone("square", 800, 500, 0.05, 0.05 * v); },
        hover(v) { this.tone("sine", 900, 1000, 0.03, 0.025 * v); },
      };
      return this.fxTable;
    }

    // ---------- Continuous loops ----------

    // A held noise/tone voice, such as Force Lightning, that the caller starts and stops.
    startLoop(name, { filter = 3000, q = 3, gain = 0.2, tone = 0 } = {}) {
      if (!this.ctx || this.loops[name]) return;
      const c = this.ctx;
      const source = c.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = filter;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.06);
      source.connect(f).connect(g).connect(this.sfxBus);
      source.start();
      const nodes = [source];
      if (tone) {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = tone;
        const og = c.createGain();
        og.gain.value = gain * 0.4;
        osc.connect(og).connect(g);
        osc.start();
        nodes.push(osc);
      }
      this.loops[name] = { nodes, gain: g };
    }

    stopLoop(name) {
      const loop = this.loops[name];
      if (!loop) return;
      delete this.loops[name];
      const t = this.ctx.currentTime;
      loop.gain.gain.cancelScheduledValues(t);
      loop.gain.gain.setValueAtTime(Math.max(loop.gain.gain.value, 0.0002), t);
      loop.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      loop.nodes.forEach((node) => node.stop(t + 0.14));
    }

    stopAllLoops() { Object.keys(this.loops).forEach((name) => this.stopLoop(name)); }

    // The steady saber hum. Its pitch rises a little as the Jedi moves.
    startHum() {
      if (!this.ctx || this.hum) return;
      const c = this.ctx;
      const a = c.createOscillator();
      const b = c.createOscillator();
      a.type = "sawtooth";
      b.type = "sawtooth";
      a.frequency.value = 92;
      b.frequency.value = 93.5;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 340;
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.022, c.currentTime + 0.5);
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain).connect(this.sfxBus);
      a.start();
      b.start();
      this.hum = { a, b, gain, filter };
    }

    setHum(amount) {
      if (!this.hum) return;
      const t = this.ctx.currentTime;
      this.hum.a.frequency.setTargetAtTime(92 + amount * 22, t, 0.05);
      this.hum.b.frequency.setTargetAtTime(93.5 + amount * 26, t, 0.05);
      this.hum.filter.frequency.setTargetAtTime(340 + amount * 340, t, 0.05);
    }

    stopHum() {
      if (!this.hum) return;
      const { a, b, gain } = this.hum;
      const t = this.ctx.currentTime;
      gain.gain.setTargetAtTime(0.0001, t, 0.05);
      a.stop(t + 0.3);
      b.stop(t + 0.3);
      this.hum = null;
    }

    playAmbient(theme) {
      this.pendingAmbient = theme;
      if (!this.ctx) return;
      this.stopAmbient();
      const url = J.AUDIO_FILES.ambient[theme];
      if (url) {
        this.ambientFile = new Audio(url);
        this.ambientFile.loop = true;
        this.ambientFile.volume = this.options.sfx * 0.6;
        this.ambientFile.play().catch(() => {});
        return;
      }
      const a = AMBIENCE[theme];
      if (!a) return;
      const c = this.ctx;
      const source = c.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = a.filter;
      filter.Q.value = a.q;
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(a.gain, c.currentTime, 0.8);
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = c.createGain();
      lfoGain.gain.value = a.gain * a.wobble;
      lfo.connect(lfoGain).connect(gain.gain);
      source.connect(filter).connect(gain).connect(this.sfxBus);
      source.start();
      lfo.start();
      const nodes = [source, lfo];
      if (a.drone) {
        const osc = c.createOscillator();
        osc.frequency.value = a.drone;
        const droneGain = c.createGain();
        droneGain.gain.value = 0.04;
        osc.connect(droneGain).connect(gain);
        osc.start();
        nodes.push(osc);
      }
      this.ambientNodes = { nodes, gain };
    }

    stopAmbient() {
      this.pendingAmbient = null;
      if (this.ambientFile) {
        this.ambientFile.pause();
        this.ambientFile = null;
      }
      if (!this.ambientNodes) return;
      const { nodes, gain } = this.ambientNodes;
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0, t, 0.2);
      nodes.forEach((node) => node.stop(t + 1));
      this.ambientNodes = null;
    }

    // ---------- Music sequencer ----------

    playMusic(name) {
      this.pendingMusic = name;
      if (this.songName === name) return;
      if (!this.ctx) return;
      this.stopMusic();
      this.pendingMusic = name;
      this.songName = name;
      const url = J.AUDIO_FILES.music[name];
      if (url) {
        this.fileMusic = new Audio(url);
        this.fileMusic.loop = true;
        this.fileMusic.volume = this.options.music;
        this.fileMusic.addEventListener("error", () => {
          console.warn(`Jedi Story: couldn't load music "${name}" from ${url}, using the generated track.`);
          if (this.songName === name) this.startSong(name);
        }, { once: true });
        this.fileMusic.play().catch(() => {});
        return;
      }
      this.startSong(name);
    }

    startSong(name) {
      const base = SONGS[name] || SONGS.level1;
      this.song = { ...base, style: STYLES[base.style] };
      this.step = 0;
      this.nextStepTime = this.ctx.currentTime + 0.1;
    }

    stopMusic() {
      this.song = null;
      this.songName = null;
      this.pendingMusic = null;
      if (this.fileMusic) {
        this.fileMusic.pause();
        this.fileMusic = null;
      }
    }

    schedule() {
      if (!this.ctx || !this.song || this.ctx.state !== "running") return;
      const stepLength = 60 / this.song.bpm / 4;
      // After a stall, pick the beat back up instead of dumping every missed note at once.
      if (this.nextStepTime < this.ctx.currentTime - 0.2) this.nextStepTime = this.ctx.currentTime + 0.05;
      while (this.nextStepTime < this.ctx.currentTime + 0.14) {
        this.playStep(this.step, this.nextStepTime, stepLength);
        this.step++;
        this.nextStepTime += stepLength;
      }
    }

    note(degree, octave = 0) {
      const { scale, root } = this.song;
      const steps = SCALES[scale];
      const n = steps.length;
      const wrapped = ((degree % n) + n) % n;
      const octaves = Math.floor(degree / n) + octave;
      return root + steps[wrapped] + 12 * octaves;
    }

    playStep(step, t, stepLength) {
      const { song } = this;
      const style = song.style;
      const inBar = step % 16;
      const bar = Math.floor(step / 16);
      const chord = song.chords[bar % song.chords.length];
      const triad = [chord, chord + 2, chord + 4];
      const barLength = stepLength * 16;

      if (inBar === 0) {
        if (style.pad) this.padChord(triad, t, barLength, style.pad);
        if (style.choir) this.choirChord(triad, t, barLength, style.choir);
        this.bass(midi(this.note(chord, -1)), t, barLength * 0.9, 0.2);
      }
      if (style.kick[inBar] === "x") this.timpani(t, midi(this.note(chord, -1)));
      if (style.snare[inBar] === "x") this.snare(t);
      if (style.brass && (inBar === 0 || inBar === 10)) {
        triad.forEach((d) => this.brass(midi(this.note(d, 1)), t, stepLength * 4, style.brass));
      }
      if (style.harp && style.arp && inBar % 2 === 0) {
        const degree = triad[(inBar / 2) % 3] + (inBar % 8 >= 4 ? 7 : 0);
        this.harp(midi(this.note(degree, 2)), t, style.harp);
      }
      if (style.lead && inBar % 2 === 0) {
        // The melody rests every other time around so it doesn't wear thin.
        const leadStep = (step / 2) % song.lead.length;
        const degree = song.lead[leadStep];
        if (degree !== null && Math.floor(step / (song.lead.length * 2)) % 2 === 0) {
          this.lead(midi(this.note(degree, 2)), t, stepLength * 3.4, style.lead);
        }
      }
    }

    padChord(degrees, t, dur, level) {
      const c = this.ctx;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level * 0.2, t + dur * 0.3);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur * 1.08);
      filter.connect(gain);
      gain.connect(this.musicBus);
      gain.connect(this.reverb);
      for (const degree of degrees) {
        const freq = midi(this.note(degree, 1));
        for (const detune of [-7, 7]) {
          const osc = c.createOscillator();
          osc.type = "sawtooth";
          osc.frequency.value = freq;
          osc.detune.value = detune;
          osc.connect(filter);
          osc.start(t);
          osc.stop(t + dur * 1.1);
        }
      }
    }

    choirChord(degrees, t, dur, level) {
      const c = this.ctx;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level * 0.26, t + dur * 0.4);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
      gain.connect(this.musicBus);
      gain.connect(this.reverb);
      // Two formant peaks turn a sawtooth into something close to an "ah".
      const formants = [650, 1080].map((f) => {
        const filter = c.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = f;
        filter.Q.value = 6;
        filter.connect(gain);
        return filter;
      });
      for (const degree of degrees.slice(0, 2)) {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midi(this.note(degree, 2));
        formants.forEach((filter) => osc.connect(filter));
        osc.start(t);
        osc.stop(t + dur * 1.08);
      }
    }

    bass(freq, t, dur, level) {
      this.tone("triangle", freq, freq, dur, level, { t, bus: this.musicBus, attack: 0.05 });
    }

    brass(freq, t, dur, level) {
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(320, t);
      filter.frequency.linearRampToValueAtTime(1500, t + 0.08);
      filter.frequency.linearRampToValueAtTime(600, t + dur);
      const gain = c.createGain();
      this.env(gain, t, 0.03, level * 0.5, dur);
      osc.connect(filter).connect(gain);
      gain.connect(this.musicBus);
      gain.connect(this.reverb);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    lead(freq, t, dur, level) {
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const horn = c.createOscillator();
      horn.type = "sawtooth";
      horn.frequency.value = freq;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = freq * 2.4;
      const vibrato = c.createOscillator();
      vibrato.frequency.value = 5.2;
      const depth = c.createGain();
      depth.gain.value = freq * 0.008;
      vibrato.connect(depth);
      depth.connect(osc.frequency);
      depth.connect(horn.frequency);
      const hornGain = c.createGain();
      hornGain.gain.value = 0.3;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level * 0.55, t + 0.05);
      gain.gain.setValueAtTime(level * 0.5, t + dur * 0.7);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur * 1.2);
      osc.connect(filter);
      horn.connect(hornGain).connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBus);
      gain.connect(this.reverb);
      [osc, horn, vibrato].forEach((node) => { node.start(t); node.stop(t + dur * 1.25); });
    }

    harp(freq, t, level) {
      this.tone("triangle", freq, freq, 0.5, level * 0.4, { t, bus: this.musicBus, attack: 0.002, verb: true });
    }

    timpani(t, freq) {
      const f = Math.max(freq, 55);
      this.tone("sine", f * 1.5, f * 0.9, 0.35, 0.34, { t, bus: this.musicBus, attack: 0.003, verb: true });
      this.burst(0.05, 0.06, { f0: 200, type: "lowpass", t, bus: this.musicBus });
    }

    snare(t) {
      this.burst(0.09, 0.08, { f0: 2400, q: 0.8, t, bus: this.musicBus });
    }
  }

  J.AudioManager = AudioManager;
})(window.JEDI);
