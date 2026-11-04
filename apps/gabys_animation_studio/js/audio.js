/* Sound effects. Every built-in sound is synthesized right here with code (no audio files), so
 * they are original and need no license. Kids can also import their own WAV, MP3 or OGG files. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const SR = 44100;
  const TAU = Math.PI * 2;

  /* ---------- tiny DSP kit ---------- */
  const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
  const noise = () => Math.random() * 2 - 1;

  function biquad(type, freq, q) {
    let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    function set(f, Q = q) {
      const w = (TAU * Math.min(f, SR * 0.45)) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
      let n0, n1, n2;
      if (type === "lp") { n0 = (1 - cs) / 2; n1 = 1 - cs; n2 = (1 - cs) / 2; }
      else if (type === "hp") { n0 = (1 + cs) / 2; n1 = -(1 + cs); n2 = (1 + cs) / 2; }
      else { n0 = al; n1 = 0; n2 = -al; } // band-pass
      const a0 = 1 + al;
      b0 = n0 / a0; b1 = n1 / a0; b2 = n2 / a0; a1 = (-2 * cs) / a0; a2 = (1 - al) / a0;
    }
    set(freq, q);
    const f = (x) => {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    };
    f.set = set;
    return f;
  }

  /* Band-limited sawtooth-ish voice from a few harmonics. */
  function harmonics(phase, n, tilt = 1) {
    let s = 0;
    for (let k = 1; k <= n; k++) s += Math.sin(phase * k) / Math.pow(k, tilt);
    return s;
  }

  function normalize(d, peak = 0.85) {
    let m = 0;
    for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
    if (m > 0) for (let i = 0; i < d.length; i++) d[i] = (d[i] / m) * peak;
    // tiny fade so nothing clicks at the end
    const fade = Math.min(400, d.length);
    for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
    return d;
  }

  /* ---------- the sounds ---------- */
  const SYNTH = {
    pop() {
      const d = buf(0.14); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, f = 900 * Math.exp(-t * 30) + 180;
        ph += (TAU * f) / SR;
        d[i] = Math.sin(ph) * Math.exp(-t * 38) + (t < 0.004 ? noise() * 0.5 : 0);
      }
      return d;
    },
    boing() {
      const d = buf(0.8); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const f = (150 + 170 * (1 - Math.exp(-t * 7))) * (1 + 0.28 * Math.sin(TAU * 13 * t) * Math.exp(-t * 2.5));
        ph += (TAU * f) / SR;
        d[i] = (Math.sin(ph) + 0.3 * Math.sin(ph * 2)) * Math.exp(-t * 4.2) * Math.min(1, t * 300);
      }
      return d;
    },
    whoosh() {
      const dur = 0.75, d = buf(dur), bp = biquad("bp", 400, 1.4);
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, u = t / dur;
        if (i % 64 === 0) bp.set(300 + 2800 * Math.sin(Math.PI * u) ** 2);
        d[i] = bp(noise()) * Math.sin(Math.PI * u) ** 2;
      }
      return d;
    },
    jump() {
      const d = buf(0.32), lp = biquad("lp", 4000, 0.7); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, f = 260 * Math.pow(3.6, Math.min(1, t / 0.22));
        ph += f / SR;
        d[i] = lp((ph % 1 < 0.5 ? 1 : -1) * 0.5) * Math.exp(-t * 5);
      }
      return d;
    },
    bell() {
      const d = buf(1.8), parts = [[1, 1, 2.6], [2.756, 0.5, 4], [5.404, 0.25, 6], [8.933, 0.12, 8]];
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let s = 0;
        for (const [r, a, k] of parts) s += Math.sin(TAU * 880 * r * t) * a * Math.exp(-t * k);
        d[i] = s * Math.min(1, t * 2000);
      }
      return d;
    },
    clap() {
      const d = buf(0.38), bp = biquad("bp", 1400, 1.1);
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let e = 0;
        for (const t0 of [0, 0.011, 0.023]) if (t >= t0) e = Math.max(e, Math.exp(-(t - t0) * 90));
        e += 0.35 * Math.exp(-Math.max(0, t - 0.03) * 16) * (t > 0.03 ? 1 : 0);
        d[i] = bp(noise()) * e;
      }
      return d;
    },
    boom() {
      const d = buf(1.5), lp = biquad("lp", 1200, 0.8); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        if (i % 64 === 0) lp.set(150 + 1100 * Math.exp(-t * 4));
        const f = 35 + 60 * Math.exp(-t * 6);
        ph += (TAU * f) / SR;
        const s = lp(noise()) * 1.6 * Math.exp(-t * 2.6) + Math.sin(ph) * Math.exp(-t * 3.5) * 0.9;
        d[i] = Math.tanh(s * 1.8) * Math.min(1, t * 500);
      }
      return d;
    },
    meow() {
      const dur = 0.75, d = buf(dur), f1 = biquad("bp", 400, 4), f2 = biquad("bp", 2200, 6); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, u = t / dur;
        const f0 = u < 0.3 ? 480 + (780 - 480) * (u / 0.3) : 780 - (780 - 430) * ((u - 0.3) / 0.7);
        ph += (TAU * f0) / SR;
        if (i % 64 === 0) { f1.set(320 + 450 * Math.min(1, u * 1.6)); f2.set(2400 - 1300 * u); }
        const src = harmonics(ph, 10, 1);
        const e = Math.min(1, t / 0.06) * Math.min(1, (dur - t) / 0.2);
        d[i] = (f1(src) * 1.2 + f2(src) * 0.8) * e;
      }
      return d;
    },
    woof() {
      const d = buf(0.62), lp = biquad("lp", 1400, 1);
      const bark = (t, t0) => {
        const u = t - t0;
        if (u < 0 || u > 0.22) return 0;
        const f0 = 230 - 90 * (u / 0.22);
        return (harmonics(TAU * f0 * u, 12, 0.8) + noise() * 0.7) * Math.min(1, u * 120) * Math.exp(-u * 13);
      };
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        d[i] = lp(bark(t, 0) + bark(t, 0.32) * 0.9);
      }
      return d;
    },
    quack() {
      const d = buf(0.42), b1 = biquad("bp", 1150, 3), b2 = biquad("bp", 2500, 4); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, f0 = 290 - 70 * (t / 0.42);
        ph += (TAU * f0) / SR;
        const src = harmonics(ph, 16, 0.7) * (1 + 0.4 * Math.sin(TAU * 32 * t));
        const e = Math.min(1, t * 80) * Math.exp(-t * 4) * Math.min(1, (0.42 - t) * 30);
        d[i] = (b1(src) + b2(src) * 0.7) * e;
      }
      return d;
    },
    tweet() {
      const d = buf(0.55); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let s = 0;
        for (const t0 of [0, 0.15, 0.3]) {
          const u = t - t0;
          if (u >= 0 && u < 0.1) {
            const f = 2600 + 1800 * Math.sin(Math.PI * (u / 0.1));
            ph += (TAU * f) / SR;
            s = Math.sin(ph) * Math.sin(Math.PI * (u / 0.1));
          }
        }
        d[i] = s;
      }
      return d;
    },
    moo() {
      const dur = 1.3, d = buf(dur), lp = biquad("lp", 600, 3); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, u = t / dur;
        const f0 = 125 - 22 * u + 3 * Math.sin(TAU * 5 * t);
        ph += (TAU * f0) / SR;
        if (i % 64 === 0) lp.set(380 + 500 * Math.sin(Math.PI * Math.min(1, u * 1.3)));
        const e = Math.min(1, t / 0.15) * Math.min(1, (dur - t) / 0.3);
        d[i] = lp(harmonics(ph, 24, 0.9)) * e;
      }
      return d;
    },
    footsteps() {
      const d = buf(1.1), lp = biquad("lp", 700, 0.8);
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let s = 0;
        for (const [k, t0] of [0, 0.27, 0.54, 0.81].entries()) {
          const u = t - t0;
          if (u >= 0 && u < 0.18) s += (noise() * 0.8 * Math.exp(-u * 55) + Math.sin(TAU * 75 * u) * Math.exp(-u * 35)) * (k % 2 ? 0.8 : 1);
        }
        d[i] = lp(s);
      }
      return d;
    },
    twinkle() {
      const d = buf(1.0), notes = [1318.5, 1568, 1975.5, 2637];
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let s = 0;
        notes.forEach((f, k) => {
          const u = t - k * 0.08;
          if (u >= 0) s += Math.sin(TAU * f * u) * Math.exp(-u * 6) * (1 + 0.3 * Math.sin(TAU * 9 * u));
        });
        d[i] = s;
      }
      return d;
    },
    slide() {
      const d = buf(0.75); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, u = t / 0.75;
        const f = (550 + 1300 * u * u) * (1 + 0.015 * Math.sin(TAU * 7 * t));
        ph += (TAU * f) / SR;
        d[i] = (Math.sin(ph) + 0.15 * Math.sin(ph * 2)) * Math.min(1, t * 40) * Math.min(1, (0.75 - t) * 12);
      }
      return d;
    },
    splat() {
      const d = buf(0.4), lp = biquad("lp", 2000, 1.5); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        if (i % 64 === 0) lp.set(300 + 2400 * Math.exp(-t * 12));
        ph += (TAU * (180 * Math.exp(-t * 8) + 60)) / SR;
        d[i] = (lp(noise()) * 1.4 + Math.sin(ph) * 0.6) * Math.exp(-t * 9) * Math.min(1, t * 400);
      }
      return d;
    },
    honk() {
      const d = buf(0.75), lp = biquad("lp", 1800, 1);
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const on = (t < 0.28) || (t > 0.38 && t < 0.72);
        const s = ((t * 392) % 1 < 0.5 ? 1 : -1) + ((t * 494) % 1 < 0.5 ? 1 : -1);
        d[i] = on ? lp(s * 0.5) : lp(0);
      }
      return d;
    },
    zap() {
      const d = buf(0.3); let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR, f = 2200 * Math.exp(-t * 11) + 180;
        ph += (TAU * f) / SR;
        d[i] = (Math.sin(ph) > 0 ? 1 : -1) * 0.45 * Math.exp(-t * 7);
      }
      return d;
    },
    tada() {
      const d = buf(1.4), notes = [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.3]], lp = biquad("lp", 3000, 0.7);
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let s = 0;
        for (const [f, t0] of notes) {
          const u = t - t0;
          if (u >= 0) s += harmonics(TAU * f * u, 5, 1.3) * Math.min(1, u * 60) * Math.exp(-u * (t0 === 0.3 ? 1.8 : 5));
        }
        d[i] = lp(s);
      }
      return d;
    },
  };

  const LIBRARY = [
    { id: "pop", label: "Pop", emoji: "💥" },
    { id: "boing", label: "Boing", emoji: "🌀" },
    { id: "whoosh", label: "Whoosh", emoji: "💨" },
    { id: "jump", label: "Jump", emoji: "⬆️" },
    { id: "bell", label: "Bell", emoji: "🔔" },
    { id: "clap", label: "Clap", emoji: "👏" },
    { id: "boom", label: "Ka-boom", emoji: "🎆" },
    { id: "footsteps", label: "Footsteps", emoji: "👣" },
    { id: "meow", label: "Meow", emoji: "🐱" },
    { id: "woof", label: "Woof", emoji: "🐶" },
    { id: "quack", label: "Quack", emoji: "🦆" },
    { id: "tweet", label: "Tweet", emoji: "🐦" },
    { id: "moo", label: "Moo", emoji: "🐮" },
    { id: "twinkle", label: "Magic", emoji: "✨" },
    { id: "slide", label: "Slide whistle", emoji: "🎺" },
    { id: "splat", label: "Splat", emoji: "🫧" },
    { id: "honk", label: "Honk", emoji: "🚗" },
    { id: "zap", label: "Zap", emoji: "⚡" },
    { id: "tada", label: "Ta-da!", emoji: "🎉" },
  ];

  /* ---------- playback ---------- */
  let ctx = null;
  const buffers = new Map(); // ref -> AudioBuffer
  const decoding = new Map();
  let muted = GAS.prefs.get("muted", false);

  function audioCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function builtinBuffer(id) {
    const ref = "builtin:" + id;
    if (buffers.has(ref)) return buffers.get(ref);
    const gen = SYNTH[id];
    const c = audioCtx();
    if (!gen || !c) return null;
    const data = normalize(gen());
    const b = c.createBuffer(1, data.length, SR);
    b.getChannelData(0).set(data);
    buffers.set(ref, b);
    return b;
  }

  /* Returns an AudioBuffer (maybe after decoding). */
  async function getBuffer(ref) {
    if (!ref) return null;
    if (buffers.has(ref)) return buffers.get(ref);
    if (ref.startsWith("builtin:")) return builtinBuffer(ref.slice(8));
    if (ref.startsWith("asset:")) {
      if (decoding.has(ref)) return decoding.get(ref);
      const id = ref.slice(6);
      const asset = GAS.state.project && GAS.state.project.assets.audio[id];
      const c = audioCtx();
      if (!asset || !c) return null;
      const p = (async () => {
        try {
          const blob = GAS.dataURLToBlob(asset.dataURL);
          const arr = await blob.arrayBuffer();
          const b = await new Promise((res, rej) => {
            const r = c.decodeAudioData(arr, res, rej);
            if (r && r.then) r.then(res, rej);
          });
          buffers.set(ref, b);
          return b;
        } catch (err) {
          console.warn("Could not decode audio", err);
          return null;
        } finally {
          decoding.delete(ref);
        }
      })();
      decoding.set(ref, p);
      return p;
    }
    return null;
  }

  let lastVoice = null;
  async function play(ref, volume = 1, opts = {}) {
    if (muted && !opts.force) return;
    const c = audioCtx();
    if (!c) return;
    const b = await getBuffer(ref);
    if (!b) return;
    const src = c.createBufferSource();
    src.buffer = b;
    const g = c.createGain();
    g.gain.value = Math.max(0, Math.min(1.5, volume));
    src.connect(g).connect(c.destination);
    src.start();
    lastVoice = src;
    return src;
  }
  function stopAll() {
    try { if (lastVoice) lastVoice.stop(); } catch { /* already stopped */ }
  }

  function label(ref) {
    if (!ref) return "";
    if (ref.startsWith("builtin:")) {
      const s = LIBRARY.find((x) => x.id === ref.slice(8));
      return s ? s.label : "Sound";
    }
    const a = GAS.state.project && GAS.state.project.assets.audio[ref.slice(6)];
    return a ? a.name : "My sound";
  }
  function emoji(ref) {
    if (ref && ref.startsWith("builtin:")) {
      const s = LIBRARY.find((x) => x.id === ref.slice(8));
      if (s) return s.emoji;
    }
    return "🎵";
  }

  /* Import an audio file into the project. Returns the new ref. */
  async function importFile(file) {
    if (!/^audio\//.test(file.type) && !/\.(wav|mp3|ogg|oga|m4a|webm)$/i.test(file.name)) {
      GAS.ui.toast("That doesn't look like a sound file. Try WAV, MP3 or OGG.");
      return null;
    }
    if (file.size > 8 * 1024 * 1024) {
      GAS.ui.toast("That sound is very big. Try one shorter than a few seconds.");
      return null;
    }
    const dataURL = await GAS.blobToDataURL(file);
    const id = GAS.uid("a");
    const p = GAS.state.project;
    p.assets.audio[id] = { name: file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "My sound", dataURL };
    const ref = "asset:" + id;
    const b = await getBuffer(ref);
    if (!b) {
      delete p.assets.audio[id];
      GAS.ui.toast("Sorry, this browser can't play that sound file.");
      return null;
    }
    GAS.bus.emit("dirty");
    return ref;
  }

  function forgetAssets() {
    for (const k of Array.from(buffers.keys())) if (k.startsWith("asset:")) buffers.delete(k);
  }

  GAS.audio = {
    LIBRARY, SR, audioCtx, getBuffer, play, stopAll, label, emoji, importFile, forgetAssets,
    get muted() { return muted; },
    set muted(v) { muted = !!v; GAS.prefs.set("muted", muted); GAS.bus.emit("mute-changed", muted); },
  };
})();
