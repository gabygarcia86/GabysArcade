// Web Audio sound effects and music. Everything is synthesized, so the game ships no audio
// files. Sound effects and music have separate volumes, and both follow the mute button.

const STORAGE_KEYS = {
  muted: 'turkeyToss.muted',
  sfx: 'turkeyToss.sfxVolume',
  music: 'turkeyToss.musicVolume',
};
const DEFAULT_SFX_VOLUME = 0.8;
const DEFAULT_MUSIC_VOLUME = 0.5;
// Full-slider output levels, set so music sits under the effects.
const SFX_LEVEL = 0.7;
const MUSIC_LEVEL = 0.32;

function readStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: the setting just won't persist.
  }
}

const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);

// An original 6/8 harvest jig in D major. Each bar is six eighth notes as MIDI numbers; 0 is
// a rest. CHORDS gives each bar's root, third and fifth.
const MELODY = [
  [62, 66, 69, 74, 69, 66], [67, 71, 74, 79, 74, 71], [69, 73, 76, 81, 76, 73], [74, 73, 71, 69, 0, 66],
  [62, 66, 69, 74, 69, 66], [67, 71, 74, 76, 74, 71], [69, 66, 62, 64, 66, 64], [62, 0, 0, 62, 0, 0],
  [74, 76, 78, 79, 78, 76], [74, 73, 71, 69, 71, 73], [71, 73, 74, 76, 74, 73], [71, 69, 67, 66, 67, 69],
  [74, 76, 78, 81, 78, 76], [79, 78, 76, 74, 73, 71], [69, 71, 73, 74, 76, 73], [74, 0, 69, 74, 0, 0],
];
const D = [50, 54, 57];
const G = [43, 47, 50];
const A = [45, 49, 52];
const EM = [40, 43, 47];
const CHORDS = [D, G, A, D, D, G, A, D, D, A, EM, G, D, G, A, D];
const STEPS_PER_BAR = 6;
const MODES = {
  menu: { stepSeconds: 0.21, melodyEvery: 2, melodyLevel: 0.12 },
  gameplay: { stepSeconds: 0.14, melodyEvery: 1, melodyLevel: 0.17 },
};

/**
 * Schedules the jig a moment ahead of the audio clock. Browsers block sound until a user
 * gesture, so a requested mode is remembered and started once the context exists.
 */
class MusicSynth {
  constructor(manager) {
    this.manager = manager;
    this.mode = null;
    this.paused = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = 0;
    document.addEventListener('visibilitychange', () => this._sync());
  }

  playMenu() {
    this._play('menu');
  }

  playGameplay() {
    this._play('gameplay');
  }

  _play(mode) {
    // Asking for a track (e.g. restarting from the pause menu) also ends any pause.
    this.paused = false;
    if (this.mode !== mode) this.step = 0;
    this.mode = mode;
    this._sync();
  }

  pause() {
    this.paused = true;
    this._sync();
  }

  resume() {
    this.paused = false;
    this._sync();
  }

  _sync() {
    const context = this.manager.context;
    const shouldRun = !!context && !!this.mode && !this.paused && !document.hidden;
    if (shouldRun && !this.timer) {
      this.nextTime = context.currentTime + 0.08;
      this.timer = setInterval(() => this._schedule(), 60);
    } else if (!shouldRun && this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  _schedule() {
    const { context } = this.manager;
    const mode = MODES[this.mode];
    if (this.nextTime < context.currentTime) this.nextTime = context.currentTime + 0.02;
    while (this.nextTime < context.currentTime + 0.3) {
      this._playStep(this.step, this.nextTime, mode);
      this.step = (this.step + 1) % (MELODY.length * STEPS_PER_BAR);
      this.nextTime += mode.stepSeconds;
    }
  }

  _playStep(step, time, mode) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const beat = step % STEPS_PER_BAR;
    const chord = CHORDS[bar];
    const note = (midi, type, peak, duration) => {
      this.manager.musicNote(time, midiToHz(midi), type, peak, duration);
    };
    if (beat === 0) note(chord[0], 'sine', 0.26, 0.34);
    if (beat === 3) note(chord[2], 'sine', 0.2, 0.28);
    if (beat === 2 || beat === 5) {
      note(chord[0] + 12, 'triangle', 0.07, 0.16);
      note(chord[1] + 12, 'triangle', 0.07, 0.16);
      note(chord[2] + 12, 'triangle', 0.07, 0.16);
    }
    const melody = MELODY[bar][beat];
    if (melody && beat % mode.melodyEvery === 0) {
      note(melody, 'triangle', mode.melodyLevel, mode.stepSeconds * 1.7);
      note(melody + 12, 'sine', mode.melodyLevel * 0.3, mode.stepSeconds * 1.1);
    }
  }
}

export class AudioManager {
  constructor() {
    this.context = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.muted = readStored(STORAGE_KEYS.muted, 0) === 1;
    this.sfxVolume = readStored(STORAGE_KEYS.sfx, DEFAULT_SFX_VOLUME);
    this.musicVolume = readStored(STORAGE_KEYS.music, DEFAULT_MUSIC_VOLUME);
    this.music = new MusicSynth(this);
  }

  /**
   * Browsers only allow audio after a user gesture, so call this from a click/tap handler.
   * Safe to call repeatedly; it creates the context once and resumes it if suspended.
   */
  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        this.context = new AudioContextClass();
      } catch {
        return;
      }
      this.sfxGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain.connect(this.context.destination);
      this.musicGain.connect(this.context.destination);
      this._applyLevels(0);
      this._createNoiseBuffer();
      this.music._sync();
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  _applyLevels(smoothing = 0.02) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const sfx = this.muted ? 0 : this.sfxVolume * SFX_LEVEL;
    const music = this.muted ? 0 : this.musicVolume * MUSIC_LEVEL;
    if (smoothing > 0) {
      this.sfxGain.gain.setTargetAtTime(sfx, now, smoothing);
      this.musicGain.gain.setTargetAtTime(music, now, smoothing);
    } else {
      this.sfxGain.gain.value = sfx;
      this.musicGain.gain.value = music;
    }
  }

  toggleMuted() {
    this.muted = !this.muted;
    writeStored(STORAGE_KEYS.muted, this.muted ? 1 : 0);
    this._applyLevels();
    return this.muted;
  }

  setSfxVolume(value) {
    this.sfxVolume = value;
    writeStored(STORAGE_KEYS.sfx, value);
    this._applyLevels();
  }

  setMusicVolume(value) {
    this.musicVolume = value;
    writeStored(STORAGE_KEYS.music, value);
    this._applyLevels();
  }

  _createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 1);
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  get ready() {
    // A context that is still resuming will play scheduled sounds once it starts.
    return !!this.context && this.context.state !== 'closed' && !this.muted;
  }

  /** Plays a named effect. `detail` is passed to the synth (e.g. a plate's points). */
  play(name, detail) {
    if (!this.ready) return;
    const synth = this[`_${name}`];
    if (synth) synth.call(this, this.context.currentTime, detail);
  }

  /** One plucked note on the music bus. */
  musicNote(start, frequency, type, peak, duration) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.musicGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  // ---- Synth building blocks ----

  _envelope(gainNode, start, attack, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(peak, start + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  _tone(start, { type = 'sine', from, to = from, duration, peak = 0.3, attack = 0.005 }) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    this._envelope(gain, start, attack, peak, duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + attack + duration + 0.05);
  }

  _noise(start, { duration, peak = 0.3, filter = 'bandpass', from = 1000, to = from, q = 1, attack = 0.005 }) {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const biquad = this.context.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(from, start);
    if (to !== from) biquad.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = this.context.createGain();
    this._envelope(gain, start, attack, peak, duration);
    source.connect(biquad).connect(gain).connect(this.sfxGain);
    source.start(start, Math.random() * 0.5);
    source.stop(start + attack + duration + 0.05);
  }

  // One gobbling syllable: a raspy tone through a vocal-ish filter.
  _warble(start, pitch, peak) {
    const oscillator = this.context.createOscillator();
    const biquad = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(pitch * 1.25, start);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.72, start + 0.07);
    biquad.type = 'bandpass';
    biquad.frequency.value = 1250;
    biquad.Q.value = 2.2;
    this._envelope(gain, start, 0.008, peak, 0.075);
    oscillator.connect(biquad).connect(gain).connect(this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + 0.12);
  }

  // ---- Sound effects ----

  _click(t) {
    this._tone(t, { type: 'triangle', from: 1100, to: 700, duration: 0.05, peak: 0.18 });
  }

  _pickup(t) {
    this._noise(t, { duration: 0.09, peak: 0.12, filter: 'bandpass', from: 900, to: 1700, q: 1.2 });
    this._tone(t, { type: 'sine', from: 340, to: 560, duration: 0.09, peak: 0.13 });
  }

  _toss(t) {
    this._noise(t, { duration: 0.28, peak: 0.28, filter: 'bandpass', from: 450, to: 2200, q: 1.4, attack: 0.03 });
    this._tone(t, { type: 'sine', from: 220, to: 420, duration: 0.18, peak: 0.12 });
  }

  // A soft slap on china, with a chime that climbs with the plate's value.
  _plate(t, points = 1) {
    this._noise(t, { duration: 0.09, peak: 0.22, filter: 'lowpass', from: 1100, q: 0.6 });
    this._tone(t, { type: 'triangle', from: 1450, duration: 0.2, peak: 0.1 });
    const chime = 880 * 2 ** (Math.min(10, points) / 12);
    this._tone(t + 0.05, { type: 'triangle', from: chime, duration: 0.26, peak: 0.13 });
    this._tone(t + 0.11, { type: 'triangle', from: chime * 1.5, duration: 0.3, peak: 0.1 });
  }

  _thud(t) {
    this._tone(t, { type: 'sine', from: 150, to: 60, duration: 0.14, peak: 0.26 });
    this._noise(t, { duration: 0.08, peak: 0.12, filter: 'lowpass', from: 700, q: 0.5 });
  }

  // Thick, wet plop.
  _cranberry(t) {
    this._tone(t, { type: 'sine', from: 300, to: 85, duration: 0.2, peak: 0.42 });
    this._noise(t, { duration: 0.32, peak: 0.26, filter: 'bandpass', from: 1300, to: 500, q: 0.9 });
    for (let i = 0; i < 3; i++) {
      this._tone(t + 0.09 + i * 0.08, { type: 'sine', from: 420 + i * 90, to: 880, duration: 0.05, peak: 0.13 });
    }
  }

  // Slower and deeper than the cranberry.
  _gravy(t) {
    this._tone(t, { type: 'sine', from: 210, to: 62, duration: 0.3, peak: 0.45 });
    this._noise(t, { duration: 0.48, peak: 0.24, filter: 'lowpass', from: 950, to: 260, q: 1 });
    for (let i = 0; i < 3; i++) {
      this._tone(t + 0.14 + i * 0.11, { type: 'sine', from: 240 + i * 50, to: 520, duration: 0.08, peak: 0.13 });
    }
  }

  // A big rubbery boing: pitch swoops up while it wobbles.
  _bounce(t) {
    const oscillator = this.context.createOscillator();
    const vibrato = this.context.createOscillator();
    const depth = this.context.createGain();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(130, t);
    oscillator.frequency.exponentialRampToValueAtTime(760, t + 0.3);
    vibrato.frequency.value = 22;
    depth.gain.setValueAtTime(100, t);
    depth.gain.exponentialRampToValueAtTime(8, t + 0.42);
    vibrato.connect(depth).connect(oscillator.frequency);
    this._envelope(gain, t, 0.008, 0.36, 0.45);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(t);
    vibrato.start(t);
    oscillator.stop(t + 0.5);
    vibrato.stop(t + 0.5);
  }

  _gobble(t) {
    for (let call = 0; call < 2; call++) {
      for (let i = 0; i < 5; i++) {
        this._warble(t + call * 0.48 + i * 0.075, 560 - i * 34 - call * 30, 0.2);
      }
    }
  }

  _flyingHit(t) {
    // A startled squawk, a puff of feathers and a win jingle.
    for (let i = 0; i < 6; i++) this._warble(t + i * 0.05, 860 + (i % 2) * 240, 0.2);
    this._noise(t, { duration: 0.34, peak: 0.2, filter: 'highpass', from: 1600, to: 4200, q: 0.7 });
    [1046.5, 1318.5, 1568, 2093].forEach((frequency, i) => {
      this._tone(t + 0.3 + i * 0.07, { type: 'triangle', from: frequency, duration: 0.2, peak: 0.13 });
    });
  }

  _multiplier(t) {
    [659.3, 830.6, 987.8, 1318.5].forEach((frequency, i) => {
      this._tone(t + 0.04 + i * 0.065, { type: 'triangle', from: frequency, duration: 0.2, peak: 0.13 });
    });
  }

  // Little register "ching" when a multiplied score is added.
  _score(t) {
    this._tone(t + 0.12, { type: 'sine', from: 2093, duration: 0.14, peak: 0.1 });
    this._tone(t + 0.19, { type: 'sine', from: 2637, duration: 0.22, peak: 0.1 });
  }

  // Fanfare when the ninth plate fills.
  _tableComplete(t) {
    [587.3, 740, 880, 1174.7, 1480, 1760].forEach((frequency, i) => {
      this._tone(t + i * 0.08, { type: 'triangle', from: frequency, duration: 0.4, peak: 0.14 });
    });
    this._tone(t + 0.5, { type: 'sine', from: 587.3, duration: 1.1, peak: 0.14 });
    this._tone(t + 0.5, { type: 'sine', from: 880, duration: 1.1, peak: 0.1 });
    this._tone(t + 0.5, { type: 'sine', from: 1174.7, duration: 1.1, peak: 0.08 });
  }

  _tick(t) {
    this._tone(t, { type: 'sine', from: 1000, duration: 0.06, peak: 0.14 });
  }

  _go(t) {
    this._tone(t, { type: 'triangle', from: 587.3, duration: 0.12, peak: 0.2 });
    this._tone(t + 0.12, { type: 'triangle', from: 880, duration: 0.25, peak: 0.22 });
  }

  _gameOver(t) {
    const notes = [587.3, 740, 880, 1174.7];
    notes.forEach((frequency, i) => {
      this._tone(t + i * 0.13, { type: 'triangle', from: frequency, duration: 0.35, peak: 0.18 });
    });
    this._tone(t + 0.55, { type: 'sine', from: 293.7, duration: 0.8, peak: 0.16 });
    this._tone(t + 0.55, { type: 'sine', from: 440, duration: 0.8, peak: 0.12 });
  }
}
