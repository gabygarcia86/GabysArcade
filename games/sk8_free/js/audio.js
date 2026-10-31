/*
 * All sound is synthesized with the Web Audio API, so there are no audio files.
 * The context can only start from a user gesture, so ui.js calls unlock() from
 * the first tap or key press. Every method is safe to call before that.
 */
const NOTE = (semitone) => 110 * 2 ** (semitone / 12);

// A little 16-step loop: bass and lead, as semitones above A2. null is a rest.
const BASS = [0, null, 0, 12, 0, null, 7, null, 5, null, 5, 12, 3, null, 7, null];
const LEAD = [24, null, 27, null, 24, 22, null, 19, null, 24, null, 22, 19, null, 17, 19];

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.rollGain = null;
    this.rollFilter = null;
    this.noise = null;
    this.lastPlayed = new Map();
    this.musicTimer = null;
    this.nextStepTime = 0;
    this.step = 0;
    this.tension = 0;
  }

  unlock() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.sound ? 0.55 : 0;
      this.master.connect(this.ctx.destination);

      const length = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, length, length);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

      this.startRollingLoop();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.syncMusic();
  }

  setSound(on) {
    this.settings.sound = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.02);
    this.syncMusic();
  }

  setMusic(on) {
    this.settings.music = on;
    this.syncMusic();
  }

  // Tension from 0 to 1 speeds the music up during the chase.
  setTension(value) {
    this.tension = value;
  }

  /* ---------- Building blocks ---------- */

  tone(type, from, to, start, duration, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    return { osc, gain };
  }

  burst(filterType, frequency, start, duration, volume) {
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = filterType;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start, Math.random() * 0.8);
    source.stop(start + duration + 0.02);
  }

  // Skips a sound if the same one played very recently, so swarms don't stack.
  ready(name, cooldown) {
    if (!this.ctx || !this.settings.sound) return false;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -9) < cooldown) return false;
    this.lastPlayed.set(name, now);
    return true;
  }

  /* ---------- Rolling loop ---------- */

  startRollingLoop() {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    this.rollFilter = this.ctx.createBiquadFilter();
    this.rollFilter.type = "bandpass";
    this.rollFilter.frequency.value = 500;
    this.rollFilter.Q.value = 0.8;
    this.rollGain = this.ctx.createGain();
    this.rollGain.gain.value = 0;
    source.connect(this.rollFilter).connect(this.rollGain).connect(this.master);
    source.start();
  }

  // Volume and pitch follow the speed. Pass 0 when airborne or stopped.
  setRolling(speed) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.rollGain.gain.setTargetAtTime(speed > 0 ? 0.035 + speed / 7000 : 0, now, 0.04);
    this.rollFilter.frequency.setTargetAtTime(280 + speed * 3, now, 0.08);
  }

  /* ---------- Sound effects ---------- */

  ollie() {
    if (!this.ready("ollie", 0.05)) return;
    const t = this.ctx.currentTime;
    this.burst("highpass", 1800, t, 0.05, 0.3);
    this.tone("square", 240, 620, t, 0.14, 0.13);
  }

  land() {
    if (!this.ready("land", 0.1)) return;
    const t = this.ctx.currentTime;
    this.burst("lowpass", 900, t, 0.08, 0.32);
    this.tone("square", 130, 70, t, 0.07, 0.15);
  }

  ramp() {
    if (!this.ready("ramp", 0.1)) return;
    const t = this.ctx.currentTime;
    this.tone("square", 200, 1100, t, 0.3, 0.14);
  }

  crash() {
    if (!this.ready("crash", 0.15)) return;
    const t = this.ctx.currentTime;
    this.burst("lowpass", 1800, t, 0.3, 0.55);
    this.tone("sawtooth", 300, 45, t, 0.34, 0.24);
    this.tone("square", 900, 280, t + 0.08, 0.1, 0.09);
    this.tone("square", 760, 240, t + 0.2, 0.1, 0.07);
  }

  thud() {
    if (!this.ready("thud", 0.12)) return;
    const t = this.ctx.currentTime;
    this.burst("lowpass", 420, t, 0.12, 0.34);
  }

  splash() {
    if (!this.ready("splash", 0.2)) return;
    const t = this.ctx.currentTime;
    this.burst("bandpass", 2200, t, 0.22, 0.26);
    this.tone("sine", 900, 260, t, 0.12, 0.1);
  }

  pickup() {
    if (!this.ready("pickup", 0.05)) return;
    const t = this.ctx.currentTime;
    [660, 880, 1320].forEach((frequency, i) => {
      this.tone("square", frequency, frequency, t + i * 0.055, 0.09, 0.12);
    });
  }

  shield() {
    if (!this.ready("shield", 0.1)) return;
    const t = this.ctx.currentTime;
    this.tone("triangle", 1500, 500, t, 0.22, 0.28);
    this.tone("square", 900, 300, t, 0.1, 0.08);
  }

  bark() {
    if (!this.ready("bark", 0.45)) return;
    const t = this.ctx.currentTime;
    for (const offset of [0, 0.15]) {
      this.tone("sawtooth", 520, 200, t + offset, 0.09, 0.2);
      this.burst("bandpass", 900, t + offset, 0.05, 0.14);
    }
  }

  flap() {
    if (!this.ready("flap", 0.4)) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this.burst("bandpass", 1400 + i * 120, t + i * 0.055, 0.04, 0.16);
  }

  whistle() {
    if (!this.ready("whistle", 0.5)) return;
    const t = this.ctx.currentTime;
    const { osc } = this.tone("square", 2300, 2150, t, 0.5, 0.11);
    const wobble = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    wobble.frequency.value = 26;
    depth.gain.value = 170;
    wobble.connect(depth).connect(osc.frequency);
    wobble.start(t);
    wobble.stop(t + 0.5);
  }

  yell() {
    if (!this.ready("yell", 0.5)) return;
    const t = this.ctx.currentTime;
    // A sawtooth through a sweeping filter makes a rough "wah" voice.
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.linearRampToValueAtTime(470, t + 0.12);
    osc.frequency.linearRampToValueAtTime(390, t + 0.28);
    osc.frequency.linearRampToValueAtTime(520, t + 0.42);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.6);
    filter.type = "bandpass";
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.linearRampToValueAtTime(1500, t + 0.15);
    filter.frequency.linearRampToValueAtTime(800, t + 0.3);
    filter.frequency.linearRampToValueAtTime(1600, t + 0.45);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.04);
    gain.gain.setValueAtTime(0.32, t + 0.48);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.64);
  }

  warning() {
    if (!this.ready("warning", 0.5)) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const high = i % 2 === 0;
      this.tone("square", high ? 880 : 587, high ? 860 : 575, t + i * 0.16, 0.15, 0.14);
    }
  }

  gameOver() {
    if (!this.ready("gameOver", 0.5)) return;
    const t = this.ctx.currentTime;
    [392, 370, 349, 330].forEach((frequency, i) => {
      this.tone("square", frequency, frequency * (i === 3 ? 0.5 : 0.98), t + i * 0.26, i === 3 ? 0.7 : 0.24, 0.13);
    });
  }

  click() {
    if (!this.ready("click", 0.03)) return;
    this.tone("square", 720, 520, this.ctx.currentTime, 0.05, 0.08);
  }

  /* ---------- Optional music ---------- */

  syncMusic() {
    const wanted = this.ctx && this.settings.music && this.settings.sound;
    if (wanted && !this.musicTimer) {
      this.nextStepTime = this.ctx.currentTime + 0.05;
      this.musicTimer = setInterval(() => this.scheduleMusic(), 60);
    } else if (!wanted && this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  scheduleMusic() {
    const stepLength = 0.15 - this.tension * 0.05;
    while (this.nextStepTime < this.ctx.currentTime + 0.14) {
      const bass = BASS[this.step % 16];
      const lead = LEAD[this.step % 16];
      if (bass !== null) this.tone("triangle", NOTE(bass), NOTE(bass), this.nextStepTime, stepLength * 1.4, 0.16);
      if (lead !== null) this.tone("square", NOTE(lead), NOTE(lead), this.nextStepTime, stepLength * 0.8, 0.035);
      this.nextStepTime += stepLength;
      this.step++;
    }
  }
}
