/*
 * AudioManager: every sound and all the music is synthesized with Web Audio, so there are
 * no files to load. The tunes are original chiptune sketches, written as scale degrees
 * and played by a small step sequencer: pulse lead, triangle bass, arpeggio and noise drums.
 */
(function (D) {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const DORIAN = [0, 2, 3, 5, 7, 9, 10];
  const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];

  // lead: scale degrees, one per eighth note (null = rest). chords: one degree per bar.
  const PATTERNS = [
    { scale: MIXOLYDIAN, chords: [0, 0, 6, 3], bass: "pump", drums: "four",
      lead: [0, null, 2, 4, null, 2, 4, 5, 4, null, 2, null, 0, null, null, null,
        0, null, 2, 4, null, 2, 4, 6, 7, null, 6, null, 4, null, null, null] },
    { scale: MINOR, chords: [0, 5, 3, 4], bass: "gallop", drums: "back",
      lead: [7, null, 7, 6, 4, null, 2, null, 3, 4, null, 2, 0, null, null, null,
        7, null, 7, 9, 8, null, 7, null, 6, 4, null, 6, 7, null, null, null] },
    { scale: DORIAN, chords: [0, 3, 0, 4], bass: "octave", drums: "four",
      lead: [4, 5, 7, null, 7, null, 5, 4, 3, null, 4, null, 2, null, null, null,
        4, 5, 7, null, 9, null, 7, 5, 4, null, 2, null, 0, null, null, null] },
    { scale: MAJOR, chords: [0, 4, 5, 3], bass: "pump", drums: "shuffle",
      lead: [2, 4, null, 7, null, 4, 5, null, 4, 2, null, 0, null, 2, null, null,
        2, 4, null, 7, null, 9, 8, null, 7, 5, null, 4, null, null, null, null] },
  ];

  const DANCE = { bpm: 164, root: 48, scale: MAJOR, chords: [0, 5, 3, 4], bass: "gallop", drums: "disco",
    lead: [7, null, 9, 7, 11, null, 9, 7, 9, null, 7, 4, 7, null, null, null,
      5, null, 7, 5, 9, null, 7, 5, 8, 7, 6, 8, 7, null, null, null] };
  const MENU = { bpm: 118, root: 45, scale: DORIAN, chords: [0, 0, 3, 4], bass: "octave", drums: "back",
    lead: [0, null, null, 4, null, null, 3, null, 2, null, null, 0, null, null, null, null,
      0, null, null, 4, null, null, 5, null, 7, null, 5, null, 4, null, null, null] };
  const GALAXY = { bpm: 150, root: 53, scale: MAJOR, chords: [0, 3, 4, 0, 5, 3, 1, 4], bass: "gallop", drums: "disco",
    lead: [0, 2, 4, 7, null, 4, 7, 9, 11, null, 9, null, 7, null, null, null,
      5, 7, 9, 7, null, 5, 4, 2, 4, null, 2, null, 0, null, null, null] };
  const POWER = { bpm: 172, root: 57, scale: MINOR, chords: [0, 1], bass: "gallop", drums: "four",
    lead: [0, 2, 4, 2, 7, 4, 2, 4, 1, 3, 5, 3, 8, 5, 3, 5] };

  const LOOKAHEAD = 0.14;

  class AudioManager {
    constructor(options) {
      this.options = options;
      this.ctx = null;
      this.song = null;
      this.baseSong = null;
      this.step = 0;
      this.nextTime = 0;
      this.playing = false;
      this.timer = null;
      this.gearFlip = false;
    }

    // Browsers only allow audio after a user gesture, so main.js calls this on the first one.
    unlock() {
      if (!this.ctx) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.ctx = new Context();
        this.master = this.ctx.createDynamicsCompressor();
        this.master.threshold.value = -14;
        this.output = this.ctx.createGain();
        this.master.connect(this.output).connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        const samples = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, samples, samples);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
        this.applyVolumes();
        if (this.song && !this.timer) this.begin();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    applyVolumes() {
      if (!this.ctx) return;
      const { music, sfx, muted, musicOn } = this.options;
      const now = this.ctx.currentTime;
      this.output.gain.setTargetAtTime(muted ? 0 : 1, now, 0.01);
      this.musicBus.gain.setTargetAtTime(musicOn ? music * 0.42 : 0, now, 0.01);
      this.sfxBus.gain.setTargetAtTime(sfx * 0.8, now, 0.01);
    }

    /* ---------- Synth voices ---------- */

    tone({ type = "square", f, to = null, at = 0, dur = 0.1, vol = 0.2, bus = this.sfxBus, attack = 0.004, when = null, curve = "exp" }) {
      if (!this.ctx) return;
      const start = when !== null ? when : this.ctx.currentTime + at;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, start);
      if (to !== null) {
        if (curve === "exp") osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
        else osc.frequency.linearRampToValueAtTime(to, start + dur);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(vol, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(bus);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }

    noise({ at = 0, dur = 0.1, vol = 0.2, filter = "bandpass", f = 1800, to = null, q = 1, bus = this.sfxBus, when = null }) {
      if (!this.ctx) return;
      const start = when !== null ? when : this.ctx.currentTime + at;
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      const shape = this.ctx.createBiquadFilter();
      shape.type = filter;
      shape.frequency.setValueAtTime(f, start);
      shape.Q.value = q;
      if (to !== null) shape.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      source.connect(shape).connect(gain).connect(bus);
      source.start(start, Math.random() * 0.8);
      source.stop(start + dur + 0.02);
    }

    /* ---------- Sound effects ---------- */

    sfx(name) {
      if (!this.ctx) return;
      const r = Math.random;
      switch (name) {
        case "gear":
          this.gearFlip = !this.gearFlip;
          this.tone({ type: "triangle", f: this.gearFlip ? 880 : 660, to: this.gearFlip ? 1180 : 880, dur: 0.05, vol: 0.14 });
          this.tone({ type: "square", f: 2640, dur: 0.02, vol: 0.025 });
          break;
        case "power":
          // A saber-style ignition: a rising buzz with a humming tail.
          this.tone({ type: "sawtooth", f: 70, to: 420, dur: 0.32, vol: 0.2, curve: "exp" });
          this.tone({ type: "sawtooth", f: 74, to: 150, at: 0.28, dur: 0.75, vol: 0.14 });
          this.tone({ type: "square", f: 110, to: 112, at: 0.28, dur: 0.75, vol: 0.05 });
          this.noise({ dur: 0.36, vol: 0.16, f: 500, to: 3600, q: 2 });
          break;
        case "defeat":
          this.tone({ type: "square", f: 1100, to: 110, dur: 0.3, vol: 0.18 });
          this.tone({ type: "sawtooth", f: 400, to: 60, at: 0.08, dur: 0.24, vol: 0.12 });
          this.noise({ dur: 0.25, vol: 0.2, f: 2400, to: 200, q: 1 });
          break;
        case "hurt":
          for (let i = 0; i < 7; i++) {
            this.tone({ type: "square", f: 900 - i * 110 + r() * 80, to: 300 - i * 30, at: i * 0.1, dur: 0.1, vol: 0.14 });
          }
          this.noise({ at: 0.7, dur: 0.5, vol: 0.28, filter: "lowpass", f: 1800, to: 80 });
          break;
        case "ready":
          [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => {
            this.tone({ f: midi(67 + n), at: i * 0.11, dur: 0.1, vol: 0.12 });
          });
          break;
        case "fanfare":
          [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => {
            this.tone({ f: midi(64 + n), at: i * 0.07, dur: 0.16, vol: 0.13 });
            this.tone({ type: "triangle", f: midi(52 + n), at: i * 0.07, dur: 0.2, vol: 0.14 });
          });
          break;
        case "galaxy":
          [0, 7, 12, 16, 12, 19, 24].forEach((n, i) => {
            this.tone({ f: midi(60 + n), at: i * 0.16, dur: 0.34, vol: 0.12 });
            this.tone({ type: "sawtooth", f: midi(48 + n), at: i * 0.16, dur: 0.34, vol: 0.09 });
          });
          break;
        case "gameover":
          [12, 11, 10, 9, 7, 4, 0, -12].forEach((n, i) => {
            this.tone({ f: midi(60 + n), at: i * 0.2, dur: 0.24, vol: 0.13 });
            this.tone({ type: "triangle", f: midi(48 + n), at: i * 0.2, dur: 0.26, vol: 0.14 });
          });
          break;
        case "unlock":
          [0, 7, 12, 19].forEach((n, i) => this.tone({ f: midi(72 + n), at: i * 0.08, dur: 0.14, vol: 0.12 }));
          break;
        case "move":
          this.tone({ type: "square", f: 520, to: 620, dur: 0.05, vol: 0.09 });
          break;
        case "select":
          this.tone({ type: "square", f: 620, dur: 0.06, vol: 0.11 });
          this.tone({ type: "square", f: 930, at: 0.06, dur: 0.1, vol: 0.11 });
          break;
        case "back":
          this.tone({ type: "square", f: 520, to: 300, dur: 0.1, vol: 0.1 });
          break;
        case "pause":
          this.tone({ type: "triangle", f: 700, dur: 0.07, vol: 0.14 });
          this.tone({ type: "triangle", f: 460, at: 0.08, dur: 0.1, vol: 0.14 });
          break;
        default:
          break;
      }
    }

    // Each droid has its own voice, used on selection, level starts and during its dance.
    voice(id) {
      if (!this.ctx) return;
      const r = Math.random;
      const bleep = (f, to, at, dur, vol = 0.11, type = "sine") => this.tone({ type, f, to, at, dur, vol });
      switch (id) {
        case "r2d2":
          for (let i = 0, at = 0; i < 6; i++) {
            const f = 1100 + r() * 2200;
            const dur = 0.05 + r() * 0.08;
            bleep(f, f * (0.6 + r()), at, dur, 0.1);
            at += dur + 0.01;
          }
          break;
        case "c3po":
          [0, 0.11, 0.24, 0.33].forEach((at, i) => {
            const f = 300 + (i % 2) * 70;
            bleep(f, f * 0.9, at, 0.09, 0.09, "sawtooth");
            bleep(f * 3.1, f * 2.9, at, 0.09, 0.03, "square");
          });
          break;
        case "bb8":
          for (let i = 0; i < 7; i++) {
            const f = 900 + Math.sin(i * 1.3) * 400 + i * 90;
            bleep(f, f * 1.25, i * 0.055, 0.06, 0.09);
          }
          break;
        case "k2so":
          bleep(165, 150, 0, 0.14, 0.13, "square");
          bleep(130, 110, 0.17, 0.22, 0.13, "square");
          break;
        case "chopper":
          for (let i = 0; i < 6; i++) {
            const f = 200 + r() * 380;
            bleep(f, f * (0.5 + r() * 1.2), i * 0.07, 0.07, 0.11, "sawtooth");
          }
          break;
        case "bd1":
          [1900, 2500, 2100, 2800].forEach((f, i) => bleep(f, f * 1.15, i * 0.07, 0.05, 0.1, "triangle"));
          break;
        case "b1":
          bleep(340, 300, 0, 0.13, 0.1, "square");
          bleep(280, 240, 0.17, 0.17, 0.1, "square");
          break;
        case "ig11":
          bleep(96, 92, 0, 0.3, 0.15, "sawtooth");
          bleep(440, 880, 0.05, 0.12, 0.05);
          bleep(660, 440, 0.2, 0.12, 0.05);
          break;
        case "probe":
          for (let i = 0; i < 4; i++) bleep(i % 2 ? 620 : 840, i % 2 ? 840 : 620, i * 0.13, 0.12, 0.06, "square");
          break;
        case "droideka":
          [0, 0.09, 0.18].forEach((at) => this.noise({ at, dur: 0.07, vol: 0.14, f: 3200, q: 6 }));
          bleep(120, 70, 0, 0.26, 0.1, "square");
          break;
        case "kx":
          this.noise({ dur: 0.14, vol: 0.2, filter: "lowpass", f: 500 });
          bleep(110, 85, 0.02, 0.26, 0.13, "sawtooth");
          break;
        case "ig":
          this.noise({ dur: 0.34, vol: 0.09, f: 2400, to: 700, q: 4 });
          bleep(1300, 300, 0, 0.3, 0.05, "square");
          break;
        default:
          break;
      }
    }

    /* ---------- Music ---------- */

    begin() {
      if (!this.ctx) return;
      this.playing = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.06;
      if (!this.timer) this.timer = setInterval(() => this.pump(), 30);
    }

    play(song) {
      this.song = song;
      this.baseSong = song;
      this.begin();
    }

    menuMusic() { this.play(MENU); }
    danceMusic() { this.play(DANCE); }
    galaxyMusic() { this.play(GALAXY); }

    levelMusic(spec) {
      this.play({ ...PATTERNS[spec.pattern], bpm: spec.bpm, root: spec.root });
    }

    // The power-up theme takes over without restarting the level tune.
    setPowerMood(on) {
      const next = on ? POWER : this.baseSong;
      if (next && this.song !== next) {
        this.song = next;
        this.step = 0;
      }
    }

    stopMusic() {
      this.playing = false;
      this.song = null;
      this.baseSong = null;
    }

    holdMusic(held) {
      if (!this.ctx) return;
      this.playing = !held && !!this.song;
      if (this.playing) this.nextTime = this.ctx.currentTime + 0.06;
    }

    pump() {
      if (!this.playing || !this.ctx || !this.song) return;
      const horizon = this.ctx.currentTime + LOOKAHEAD;
      // A tab that slept for a while shouldn't play the backlog all at once.
      if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.02;
      while (this.nextTime < horizon) {
        this.playStep(this.song, this.step, this.nextTime);
        this.nextTime += 60 / this.song.bpm / 4;
        this.step++;
      }
    }

    degree(song, deg) {
      const size = song.scale.length;
      const octave = Math.floor(deg / size);
      return song.root + song.scale[((deg % size) + size) % size] + octave * 12;
    }

    playStep(song, step, when) {
      const bus = this.musicBus;
      const s = step % 16;
      const barIndex = Math.floor(step / 16) % song.chords.length;
      const chord = song.chords[barIndex];
      const stepTime = 60 / song.bpm / 4;

      // Bass
      const bassNote = this.degree(song, chord) - 12;
      const bassHit = { pump: s % 4 === 0 || s % 4 === 2, gallop: s % 4 !== 1, octave: s % 2 === 0 }[song.bass];
      if (bassHit) {
        const up = song.bass === "octave" ? (s % 4 === 2 ? 12 : 0) : s % 8 === 6 ? 7 : 0;
        this.tone({ type: "triangle", f: midi(bassNote + up), dur: stepTime * 1.7, vol: 0.5, bus, when });
      }

      // Arpeggio
      const arp = [0, 2, 4, 7][s % 4];
      this.tone({ f: midi(this.degree(song, chord + arp) + 12), dur: stepTime * 0.8, vol: 0.05, bus, when });

      // Lead
      if (step % 2 === 0) {
        const deg = song.lead[(step / 2) % song.lead.length];
        if (deg !== null) {
          const note = this.degree(song, deg) + 12;
          this.tone({ f: midi(note), dur: stepTime * 1.9, vol: 0.16, bus, when });
          this.tone({ type: "triangle", f: midi(note + 12), dur: stepTime * 1.4, vol: 0.07, bus, when });
        }
      }

      // Drums
      const kick = { four: s % 4 === 0, back: s === 0 || s === 6 || s === 10, shuffle: s === 0 || s === 7 || s === 10, disco: s % 4 === 0 }[song.drums];
      const snare = s === 4 || s === 12;
      const hat = song.drums === "disco" ? s % 4 === 2 : s % 2 === 0;
      if (kick) this.tone({ type: "sine", f: 150, to: 45, dur: 0.1, vol: 0.55, bus, when });
      if (snare) this.noise({ dur: 0.1, vol: 0.2, f: 2100, q: 0.8, bus, when });
      if (hat) this.noise({ dur: song.drums === "disco" ? 0.08 : 0.03, vol: 0.08, filter: "highpass", f: 7500, bus, when });
    }
  }

  D.AudioManager = AudioManager;
})(window.DROID);
