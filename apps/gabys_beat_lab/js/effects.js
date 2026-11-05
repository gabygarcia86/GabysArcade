/* EffectsProcessor: ten real audio effects built from Web Audio nodes.
 * create(ctx, type, params, env) -> { input, output, set(params), dispose() }
 * env.bpm() gives the current tempo for tempo-synced effects. */
(function () {
  "use strict";
  const GBL = window.GBL;

  const SYNC = [
    { label: "1/16", beats: 0.25 }, { label: "1/8", beats: 0.5 }, { label: "1/8 dotted", beats: 0.75 },
    { label: "1/4", beats: 1 }, { label: "1/4 dotted", beats: 1.5 }, { label: "1/2", beats: 2 },
  ];
  const p = (id, name, min, max, def, step, unit, extra) => Object.assign({ id, name, min, max, def, step, unit: unit || "" }, extra || {});
  const pct = { fmt: (v) => Math.round(v * 100) + "%" };

  const DEFS = {
    reverb: { name: "Reverb", icon: "🏛️", color: "#60a5fa", tip: "Makes it sound like a big room or hall.",
      params: [p("size", "Size", 0.3, 6, 2, 0.1, "s"), p("mix", "Mix", 0, 1, 0.3, 0.01, "", pct), p("predelay", "Pre-delay", 0, 0.1, 0.01, 0.001, "s"), p("tone", "Tone", 1000, 16000, 8000, 100, "Hz")] },
    delay: { name: "Delay", icon: "⏱️", color: "#22d3ee", tip: "Repeats the sound in time with the beat.",
      params: [p("time", "Time", 0, 5, 1, 1, "", { type: "choice", options: SYNC.map((s) => s.label) }), p("feedback", "Repeats", 0, 0.9, 0.4, 0.01, "", pct), p("mix", "Mix", 0, 1, 0.3, 0.01, "", pct), p("tone", "Tone", 500, 16000, 9000, 100, "Hz")] },
    echo: { name: "Echo", icon: "🏔️", color: "#2dd4bf", tip: "Bounces darker echoes left and right.",
      params: [p("time", "Time", 0, 5, 3, 1, "", { type: "choice", options: SYNC.map((s) => s.label) }), p("feedback", "Repeats", 0, 0.9, 0.5, 0.01, "", pct), p("mix", "Mix", 0, 1, 0.35, 0.01, "", pct), p("tone", "Tone", 300, 8000, 2500, 50, "Hz")] },
    chorus: { name: "Chorus", icon: "👯", color: "#a78bfa", tip: "Makes one sound feel like many, wide and shimmery.",
      params: [p("rate", "Speed", 0.1, 5, 1.2, 0.05, "Hz"), p("depth", "Depth", 0, 1, 0.5, 0.01, "", pct), p("mix", "Mix", 0, 1, 0.5, 0.01, "", pct)] },
    phaser: { name: "Phaser", icon: "🌀", color: "#c084fc", tip: "A swooshy sweeping sound.",
      params: [p("rate", "Speed", 0.05, 5, 0.5, 0.05, "Hz"), p("depth", "Depth", 0, 1, 0.7, 0.01, "", pct), p("feedback", "Feedback", 0, 0.9, 0.4, 0.01, "", pct), p("mix", "Mix", 0, 1, 0.5, 0.01, "", pct)] },
    flanger: { name: "Flanger", icon: "✈️", color: "#f472b6", tip: "A jet-plane whoosh.",
      params: [p("rate", "Speed", 0.05, 3, 0.25, 0.05, "Hz"), p("depth", "Depth", 0, 1, 0.6, 0.01, "", pct), p("feedback", "Feedback", 0, 0.95, 0.6, 0.01, "", pct), p("mix", "Mix", 0, 1, 0.5, 0.01, "", pct)] },
    distortion: { name: "Distortion", icon: "🔥", color: "#f97316", tip: "Crunchy, gritty, loud!",
      params: [p("drive", "Drive", 0, 1, 0.5, 0.01, "", pct), p("tone", "Tone", 500, 12000, 4000, 100, "Hz"), p("mix", "Mix", 0, 1, 1, 0.01, "", pct), p("output", "Output", 0, 1, 0.6, 0.01, "", pct)] },
    compressor: { name: "Compressor", icon: "🗜️", color: "#facc15", tip: "Evens out loud and quiet parts so it punches.",
      params: [p("threshold", "Threshold", -60, 0, -20, 1, "dB"), p("ratio", "Ratio", 1, 20, 4, 0.5, ":1"), p("attack", "Attack", 0.001, 0.3, 0.01, 0.001, "s"), p("release", "Release", 0.02, 1, 0.2, 0.01, "s"), p("makeup", "Boost", 0, 24, 6, 0.5, "dB")] },
    eq: { name: "Equalizer", icon: "📊", color: "#4ade80", tip: "Turn the bass, middle and treble up or down.",
      params: [p("low", "Bass", -12, 12, 0, 0.5, "dB"), p("mid", "Middle", -12, 12, 0, 0.5, "dB"), p("midFreq", "Mid Freq", 200, 5000, 1000, 10, "Hz"), p("high", "Treble", -12, 12, 0, 0.5, "dB")] },
    filter: { name: "Filter", icon: "🎛️", color: "#ef4444", tip: "Cut highs or lows. Add wobble for a moving sound.",
      params: [p("mode", "Type", 0, 2, 0, 1, "", { type: "choice", options: ["Low-pass", "High-pass", "Band-pass"] }), p("cutoff", "Cutoff", 40, 18000, 1200, 10, "Hz", { log: true }), p("resonance", "Resonance", 0.1, 20, 1, 0.1, ""), p("wobble", "Wobble", 0, 8, 0, 0.1, "Hz"), p("wdepth", "Wobble Depth", 0, 1, 0.5, 0.01, "", pct)] },
  };
  const ORDER = ["reverb", "delay", "echo", "chorus", "phaser", "flanger", "distortion", "compressor", "eq", "filter"];

  function defaults(type) {
    const o = {};
    for (const q of DEFS[type].params) o[q.id] = q.def;
    return o;
  }

  function impulse(ctx, seconds, sr) {
    const len = Math.max(1, Math.floor(seconds * sr));
    const b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * (i < sr * 0.002 ? i / (sr * 0.002) : 1);
      }
    }
    return b;
  }

  function distCurve(drive) {
    const k = drive * 120 + 1;
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
  }

  const dB = (v) => Math.pow(10, v / 20);
  let instantSet = false;
  const setP = (param, v, ctx) => {
    if (instantSet) { param.value = v; return; }
    try { param.setTargetAtTime(v, ctx.currentTime, 0.015); } catch (e) { param.value = v; }
  };

  function create(ctx, type, params, env) {
    const P = Object.assign(defaults(type), params || {});
    const input = ctx.createGain(), output = ctx.createGain();
    const dry = ctx.createGain(), wet = ctx.createGain();
    input.connect(dry).connect(output);
    wet.connect(output);
    const nodes = [input, output, dry, wet];
    const oscs = [];
    const mk = (n) => { nodes.push(n); return n; };
    const lfo = (rate) => { const o = ctx.createOscillator(); o.frequency.value = rate; o.start(); oscs.push(o); nodes.push(o); return o; };
    const mix = (m) => { setP(dry.gain, Math.cos(m * Math.PI / 2), ctx); setP(wet.gain, Math.sin(m * Math.PI / 2), ctx); };
    let set;
    const bpm = () => (env && env.bpm ? env.bpm() : 120);
    const syncTime = (i) => Math.min(4, (SYNC[GBL.clamp(Math.round(i), 0, SYNC.length - 1)].beats * 60) / bpm());

    switch (type) {
      case "reverb": {
        const pre = mk(ctx.createDelay(0.2)), conv = mk(ctx.createConvolver()), lp = mk(ctx.createBiquadFilter());
        lp.type = "lowpass";
        input.connect(pre).connect(conv).connect(lp).connect(wet);
        let lastSize = -1, t = 0;
        const build = () => { conv.buffer = impulse(ctx, P.size, ctx.sampleRate); lastSize = P.size; };
        build();
        set = (o) => {
          Object.assign(P, o);
          mix(P.mix); setP(pre.delayTime, P.predelay, ctx); setP(lp.frequency, P.tone, ctx);
          if (P.size !== lastSize) { clearTimeout(t); if (!(window.AudioContext && ctx instanceof window.AudioContext)) build(); else t = setTimeout(build, 120); }
        };
        break;
      }
      case "delay": {
        const d = mk(ctx.createDelay(4)), fb = mk(ctx.createGain()), lp = mk(ctx.createBiquadFilter());
        lp.type = "lowpass";
        input.connect(d).connect(lp).connect(wet);
        lp.connect(fb).connect(d);
        set = (o) => { Object.assign(P, o); mix(P.mix); setP(d.delayTime, syncTime(P.time), ctx); setP(fb.gain, P.feedback, ctx); setP(lp.frequency, P.tone, ctx); };
        break;
      }
      case "echo": {
        const mono = mk(ctx.createGain());
        mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers";
        const dl = mk(ctx.createDelay(4)), dr = mk(ctx.createDelay(4)), fb = mk(ctx.createGain()), lp = mk(ctx.createBiquadFilter()), merge = mk(ctx.createChannelMerger(2));
        lp.type = "lowpass";
        input.connect(mono).connect(lp).connect(dl);
        dl.connect(dr);
        dr.connect(fb).connect(lp);
        dl.connect(merge, 0, 0);
        dr.connect(merge, 0, 1);
        merge.connect(wet);
        set = (o) => { Object.assign(P, o); mix(P.mix); const tm = syncTime(P.time); setP(dl.delayTime, tm, ctx); setP(dr.delayTime, tm, ctx); setP(fb.gain, P.feedback, ctx); setP(lp.frequency, P.tone, ctx); };
        break;
      }
      case "chorus": {
        const voices = [[0.018, -0.7, 1], [0.026, 0.7, 1.37]].map(([base, pan, rr]) => {
          const d = mk(ctx.createDelay(0.1)), pn = mk(ctx.createStereoPanner()), o = lfo(1), g = mk(ctx.createGain());
          d.delayTime.value = base; pn.pan.value = pan;
          o.connect(g).connect(d.delayTime);
          input.connect(d).connect(pn).connect(wet);
          return { d, o, g, rr };
        });
        set = (o) => { Object.assign(P, o); mix(P.mix); for (const v of voices) { setP(v.o.frequency, P.rate * v.rr, ctx); setP(v.g.gain, 0.006 * P.depth, ctx); } };
        break;
      }
      case "phaser": {
        const stages = [];
        let prev = input;
        const fbDelay = mk(ctx.createDelay(0.01)), fb = mk(ctx.createGain()), sum = mk(ctx.createGain());
        fbDelay.delayTime.value = 0.0005;
        input.connect(sum);
        prev = sum;
        const o = lfo(0.5), lg = mk(ctx.createGain());
        o.connect(lg);
        for (let i = 0; i < 4; i++) {
          const ap = mk(ctx.createBiquadFilter());
          ap.type = "allpass"; ap.frequency.value = 600 + i * 350; ap.Q.value = 0.6;
          lg.connect(ap.frequency);
          prev.connect(ap);
          prev = ap;
          stages.push(ap);
        }
        prev.connect(wet);
        prev.connect(fb).connect(fbDelay).connect(sum);
        set = (q) => { Object.assign(P, q); mix(P.mix); setP(o.frequency, P.rate, ctx); setP(lg.gain, 500 * P.depth, ctx); setP(fb.gain, P.feedback * 0.8, ctx); };
        break;
      }
      case "flanger": {
        const d = mk(ctx.createDelay(0.05)), fb = mk(ctx.createGain()), o = lfo(0.25), lg = mk(ctx.createGain());
        d.delayTime.value = 0.004;
        o.connect(lg).connect(d.delayTime);
        input.connect(d).connect(wet);
        d.connect(fb).connect(d);
        set = (q) => { Object.assign(P, q); mix(P.mix); setP(o.frequency, P.rate, ctx); setP(lg.gain, 0.0032 * P.depth, ctx); setP(fb.gain, P.feedback, ctx); };
        break;
      }
      case "distortion": {
        const pre = mk(ctx.createGain()), ws = mk(ctx.createWaveShaper()), lp = mk(ctx.createBiquadFilter()), out = mk(ctx.createGain());
        ws.oversample = "4x"; lp.type = "lowpass";
        input.connect(pre).connect(ws).connect(lp).connect(out).connect(wet);
        let lastDrive = -1;
        set = (q) => {
          Object.assign(P, q);
          setP(dry.gain, 1 - P.mix, ctx); setP(wet.gain, P.mix, ctx);
          if (P.drive !== lastDrive) { ws.curve = distCurve(P.drive); lastDrive = P.drive; }
          setP(pre.gain, 1 + P.drive * 3, ctx); setP(lp.frequency, P.tone, ctx); setP(out.gain, P.output * 1.2, ctx);
        };
        break;
      }
      case "compressor": {
        const c = mk(ctx.createDynamicsCompressor()), mg = mk(ctx.createGain());
        input.disconnect(dry);
        input.connect(c).connect(mg).connect(output);
        set = (q) => {
          Object.assign(P, q);
          setP(c.threshold, P.threshold, ctx); setP(c.ratio, P.ratio, ctx); setP(c.attack, P.attack, ctx); setP(c.release, P.release, ctx); c.knee.value = 6;
          setP(mg.gain, dB(P.makeup), ctx);
        };
        break;
      }
      case "eq": {
        const lo = mk(ctx.createBiquadFilter()), mid = mk(ctx.createBiquadFilter()), hi = mk(ctx.createBiquadFilter());
        lo.type = "lowshelf"; lo.frequency.value = 200;
        mid.type = "peaking"; mid.Q.value = 0.9;
        hi.type = "highshelf"; hi.frequency.value = 4000;
        input.disconnect(dry);
        input.connect(lo).connect(mid).connect(hi).connect(output);
        set = (q) => { Object.assign(P, q); setP(lo.gain, P.low, ctx); setP(mid.gain, P.mid, ctx); setP(mid.frequency, P.midFreq, ctx); setP(hi.gain, P.high, ctx); };
        break;
      }
      case "filter": {
        const f = mk(ctx.createBiquadFilter()), o = lfo(0), lg = mk(ctx.createGain());
        o.connect(lg).connect(f.frequency);
        input.disconnect(dry);
        input.connect(f).connect(output);
        set = (q) => {
          Object.assign(P, q);
          f.type = ["lowpass", "highpass", "bandpass"][GBL.clamp(Math.round(P.mode), 0, 2)];
          setP(f.frequency, P.cutoff, ctx); setP(f.Q, P.resonance, ctx);
          setP(o.frequency, P.wobble, ctx);
          setP(lg.gain, P.wobble > 0 ? P.cutoff * 0.9 * P.wdepth : 0, ctx);
        };
        break;
      }
      default:
        set = () => {};
    }
    // first set: apply instantly (no smoothing) so offline renders start correct
    instantSet = true;
    try { set({}); } finally { instantSet = false; }
    return {
      type, input, output,
      set,
      dispose() {
        for (const o of oscs) { try { o.stop(); } catch (e) { /* */ } }
        for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } }
      },
    };
  }

  GBL.effects = { DEFS, ORDER, SYNC, defaults, create, impulse };
})();
