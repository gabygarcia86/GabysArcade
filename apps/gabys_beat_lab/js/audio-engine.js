/* AudioEngine + TransportController + MixerEngine.
 * A Graph builds the full signal chain (channels -> mixer inserts -> FX -> master) on any
 * BaseAudioContext, so live playback and offline export share exactly the same processing.
 * Timing uses a look-ahead scheduler on the audio clock; UI timers never time audio. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { clamp, bus } = GBL;
  const M = GBL.model;

  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const cutoffHz = (c) => (c >= 0.999 ? 22000 : 40 * Math.pow(2, c * 9));
  const dbToGain = (v) => Math.pow(10, v / 20);

  /* ---------- asset registry (imported / recorded audio) ---------- */
  const assets = {
    map: new Map(),
    get(id) { return this.map.get(id) || null; },
    add(a) { this.map.set(a.id, a); return a; },
    remove(id) { this.map.delete(id); },
  };
  function decodeAudio(bytes) {
    const ctx = engine.ctx || new OAC(1, 1, 44100);
    return new Promise((res, rej) => {
      const copy = bytes.slice(0);
      const pr = ctx.decodeAudioData(copy, res, rej);
      if (pr && pr.then) pr.then(res, rej);
    });
  }
  function resolveBuffer(ref) {
    if (!ref) return null;
    if (ref.startsWith("asset:")) { const a = assets.get(ref.slice(6)); return a ? a.buffer : null; }
    return GBL.samples.get(ref);
  }
  function refName(ref) {
    if (!ref) return "";
    if (ref.startsWith("asset:")) { const a = assets.get(ref.slice(6)); return a ? a.name : "Missing audio"; }
    const s = GBL.samples.byId[ref];
    return s ? s.name : ref;
  }

  /* ---------- Graph ---------- */
  class Graph {
    constructor(ctx, opts = {}) {
      this.ctx = ctx;
      this.live = !!opts.live;
      this.bpm = opts.bpm || (() => 120);
      this.inserts = new Map();
      this.channels = new Map();
      this.active = new Set();
      const c = ctx;
      this.masterIn = c.createGain();
      this.eqLow = c.createBiquadFilter(); this.eqLow.type = "lowshelf"; this.eqLow.frequency.value = 220;
      this.eqMid = c.createBiquadFilter(); this.eqMid.type = "peaking"; this.eqMid.frequency.value = 1200; this.eqMid.Q.value = 0.8;
      this.eqHigh = c.createBiquadFilter(); this.eqHigh.type = "highshelf"; this.eqHigh.frequency.value = 4500;
      this.masterGain = c.createGain();
      this.limiter = c.createDynamicsCompressor();
      this.limiter.threshold.value = -1.5; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.002; this.limiter.release.value = 0.12;
      this.ceiling = c.createGain();
      this.ceiling.gain.value = 0.93;
      this.eqLow.connect(this.eqMid).connect(this.eqHigh).connect(this.masterGain).connect(this.limiter).connect(this.ceiling);
      if (this.live) {
        this.analyser = c.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.75;
        this.ceiling.connect(this.analyser);
      }
      this.ceiling.connect(c.destination);
      this.masterFx = [];
      this.masterSig = null;
      this.rechainMaster();
      // shared reverb send used by each channel's "Reverb" knob
      this.revIn = c.createGain();
      this.rev = c.createConvolver();
      this.rev.buffer = GBL.effects.impulse(c, 2.4, c.sampleRate);
      this.revLp = c.createBiquadFilter(); this.revLp.type = "lowpass"; this.revLp.frequency.value = 7000;
      this.revIn.connect(this.rev).connect(this.revLp).connect(this.masterIn);
      this.revIn.gain.value = 0.9;
      // previews / playground go straight to the master
      this.preview = c.createGain();
      this.preview.connect(this.masterIn);
    }

    setP(param, v) {
      if (!this.live) { param.value = v; return; }
      param.setTargetAtTime(v, this.ctx.currentTime, 0.012);
    }

    rechainMaster() {
      this.masterIn.disconnect();
      for (const u of this.masterFx) { try { u.unit.output.disconnect(); } catch (e) { /* */ } }
      let prev = this.masterIn;
      for (const u of this.masterFx) { prev.connect(u.unit.input); prev = u.unit.output; }
      prev.connect(this.eqLow);
    }

    syncFxList(list, fxDefs, rechain) {
      // list: current [{id, unit}], fxDefs: project fx array. Returns new list.
      const on = fxDefs.filter((f) => f.on && GBL.effects.DEFS[f.type]);
      const sig = on.map((f) => f.id + ":" + f.type).join("|");
      let changedChain = false;
      if (list.sig !== sig) {
        const keep = new Map(list.map((u) => [u.id, u]));
        const next = [];
        for (const f of on) {
          let u = keep.get(f.id);
          if (u && u.type === f.type) keep.delete(f.id);
          else u = { id: f.id, type: f.type, unit: GBL.effects.create(this.ctx, f.type, f.params, { bpm: this.bpm }) };
          next.push(u);
        }
        for (const u of keep.values()) u.unit.dispose();
        list.length = 0;
        list.push(...next);
        list.sig = sig;
        changedChain = true;
      }
      for (const u of list) { const f = on.find((x) => x.id === u.id); if (f) u.unit.set(f.params); }
      if (changedChain) rechain();
    }

    sync(p) {
      const c = this.ctx;
      // master
      const m = p.mixer.master;
      this.setP(this.masterGain.gain, clamp(m.vol, 0, 1.25));
      this.setP(this.eqLow.gain, m.eq.low || 0);
      this.setP(this.eqMid.gain, m.eq.mid || 0);
      this.setP(this.eqHigh.gain, m.eq.high || 0);
      this.syncFxList(this.masterFx, m.fx, () => this.rechainMaster());

      // inserts
      const anySolo = p.mixer.inserts.some((i) => i.solo);
      const seen = new Set();
      for (const ins of p.mixer.inserts) {
        seen.add(ins.id);
        let n = this.inserts.get(ins.id);
        if (!n) {
          n = { input: c.createGain(), fx: [], pan: c.createStereoPanner(), fader: c.createGain(), mute: c.createGain(), analyser: null };
          n.pan.connect(n.fader).connect(n.mute).connect(this.masterIn);
          if (this.live) { n.analyser = c.createAnalyser(); n.analyser.fftSize = 512; n.mute.connect(n.analyser); }
          n.rechain = () => {
            n.input.disconnect();
            for (const u of n.fx) { try { u.unit.output.disconnect(); } catch (e) { /* */ } }
            let prev = n.input;
            for (const u of n.fx) { prev.connect(u.unit.input); prev = u.unit.output; }
            prev.connect(n.pan);
          };
          n.rechain();
          this.inserts.set(ins.id, n);
        }
        this.setP(n.pan.pan, clamp(ins.pan, -1, 1));
        this.setP(n.fader.gain, clamp(ins.vol, 0, 1.25));
        const audible = !ins.mute && (!anySolo || ins.solo);
        this.setP(n.mute.gain, audible ? 1 : 0);
        this.syncFxList(n.fx, ins.fx, n.rechain);
      }
      for (const [id, n] of this.inserts) {
        if (seen.has(id)) continue;
        for (const u of n.fx) u.unit.dispose();
        for (const k of ["input", "pan", "fader", "mute", "analyser"]) { try { n[k] && n[k].disconnect(); } catch (e) { /* */ } }
        this.inserts.delete(id);
      }

      // channels
      const chSeen = new Set();
      for (const ch of p.channels) {
        chSeen.add(ch.id);
        this.syncChannel(ch);
      }
      for (const [id, n] of this.channels) {
        if (chSeen.has(id) || id.startsWith("tmp_")) continue;
        for (const k of ["input", "gain", "pan", "send"]) { try { n[k].disconnect(); } catch (e) { /* */ } }
        this.channels.delete(id);
      }
    }

    syncChannel(ch) {
      const c = this.ctx;
      let n = this.channels.get(ch.id);
      if (!n) {
        n = { input: c.createBiquadFilter(), gain: c.createGain(), pan: c.createStereoPanner(), send: c.createGain(), dest: null };
        n.input.type = "lowpass";
        n.input.Q.value = 0.7;
        n.input.connect(n.gain).connect(n.pan);
        n.pan.connect(n.send).connect(this.revIn);
        this.channels.set(ch.id, n);
      }
      const ins = ch.insert ? this.inserts.get(ch.insert) : null;
      const dest = ins ? ins.input : this.masterIn;
      if (n.dest !== dest) {
        if (n.dest) { try { n.pan.disconnect(n.dest); } catch (e) { /* */ } }
        n.pan.connect(dest);
        n.dest = dest;
      }
      this.setP(n.input.frequency, cutoffHz(ch.cutoff == null ? 1 : ch.cutoff));
      this.setP(n.gain.gain, clamp(ch.vol, 0, 1.25));
      this.setP(n.pan.pan, clamp(ch.pan || 0, -1, 1));
      this.setP(n.send.gain, clamp(ch.reverb || 0, 0, 1) * 0.8);
      return n;
    }

    /* Play one event. ev: {ch, type:'step'|'note', pitch, vel, dur(seconds)} at audio time t. */
    playChannelNote(ch, pitch, vel, t, dur) {
      const n = this.channels.get(ch.id) || this.syncChannel(ch);
      if (ch.kind === "synth") {
        const inst = GBL.instruments.byId[ch.inst];
        if (!inst) return null;
        const v = GBL.instruments.playSynth(this.ctx, n.input, inst, pitch + (ch.pitch || 0), vel, t, dur, { attack: ch.attack, release: ch.release });
        this.track(v);
        return v;
      }
      const buf = resolveBuffer(ch.sound);
      if (!buf) return null;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const semis = pitch - (ch.root || 60) + (ch.pitch || 0);
      src.playbackRate.value = Math.pow(2, semis / 12);
      const g = this.ctx.createGain();
      const a = Math.max(0.0005, ch.attack || 0.0005);
      const peak = Math.pow(clamp(vel, 0.05, 1), 1.1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      src.connect(g).connect(n.input);
      src.start(t);
      const ctx = this.ctx;
      const rel = Math.max(0.01, ch.release == null ? 1.5 : ch.release);
      const natural = t + buf.duration / src.playbackRate.value;
      let stopped = false;
      const voice = {
        start: t, end: natural,
        stop(time) {
          if (stopped) return;
          stopped = true;
          time = Math.max(time, t + a);
          g.gain.setTargetAtTime(0, time, rel / 4);
          const e = Math.min(natural, time + rel * 1.6 + 0.02);
          try { src.stop(e); } catch (er) { /* */ }
          voice.end = e;
        },
        kill() {
          const now = ctx.currentTime;
          try { g.gain.cancelScheduledValues(0); g.gain.setValueAtTime(g.gain.value, now); g.gain.setTargetAtTime(0, now, 0.006); src.stop(now + 0.05); } catch (er) { /* */ }
          stopped = true; voice.end = now + 0.05;
        },
      };
      src.onended = () => { try { g.disconnect(); } catch (er) { /* */ } };
      if (dur != null) voice.stop(t + dur);
      this.track(voice);
      return voice;
    }

    playAudioClip(p, clip, t, offsetSec, stepDur) {
      const buf = resolveBuffer(clip.ref);
      if (!buf) return;
      const track = p.tracks.find((x) => x.id === clip.track);
      const ins = track && track.insert ? this.inserts.get(track.insert) : null;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      const off = (clip.offset || 0) + offsetSec;
      const durSec = clip.len * stepDur - offsetSec;
      if (off >= buf.duration || durSec <= 0) return;
      const len = Math.min(durSec, buf.duration - off);
      const gain = clamp(clip.gain == null ? 1 : clip.gain, 0, 2);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.004);
      g.gain.setValueAtTime(gain, t + Math.max(0.005, len - 0.008));
      g.gain.linearRampToValueAtTime(0, t + len);
      src.connect(g).connect(ins ? ins.input : this.masterIn);
      src.start(t, off, len + 0.01);
      const ctx = this.ctx;
      this.track({ start: t, end: t + len, kill() { try { src.stop(ctx.currentTime + 0.02); } catch (e) { /* */ } } });
    }

    track(v) {
      if (!this.live || !v) return;
      this.active.add(v);
      if (this.active.size > 300) {
        const now = this.ctx.currentTime;
        for (const x of this.active) if (x.end < now) this.active.delete(x);
      }
    }
    killAll() {
      for (const v of this.active) { try { v.kill && v.kill(); } catch (e) { /* */ } }
      this.active.clear();
    }

    /* A temporary channel that is not part of the project (playground / previews). */
    tempChannel(cfg) {
      const n = this.syncChannel(cfg);
      if (n.dest !== this.masterIn) { try { n.pan.disconnect(n.dest); } catch (e) { /* */ } n.pan.connect(this.masterIn); n.dest = this.masterIn; }
      return n;
    }

    dispose() {
      this.killAll();
      try { this.masterIn.disconnect(); this.limiter.disconnect(); } catch (e) { /* */ }
    }
  }

  /* ---------- Event collection (shared by live scheduler and export) ----------
   * emit(ev, stepPos). ev = {type:'hit', ch, pitch, vel, len(steps)} or {type:'audio', clip, offsetSteps} */
  function collectPattern(p, pat, a, b, offset, emit, clipEnd) {
    for (const ch of p.channels) {
      if (!M.channelAudible(ch, p)) continue;
      const steps = pat.steps[ch.id];
      if (steps) {
        const end = Math.min(b, pat.length);
        for (let i = Math.max(0, Math.ceil(a - 1e-9)); i < end; i++) {
          const v = steps[i];
          if (v > 0) emit({ type: "hit", ch, pitch: ch.root || 60, vel: v, len: 1 }, offset + i);
        }
      }
      const notes = pat.notes[ch.id];
      if (notes) {
        for (const nt of notes) {
          if (nt.s >= a && nt.s < b && nt.s < pat.length) {
            let len = nt.l;
            if (clipEnd != null) len = Math.min(len, clipEnd - (offset + nt.s));
            if (len > 0) emit({ type: "hit", ch, pitch: nt.p, vel: nt.v == null ? 0.8 : nt.v, len, note: true }, offset + nt.s);
          }
        }
      }
    }
  }

  function collect(p, mode, patId, a, b, emit, seek) {
    if (mode === "pattern") {
      const pat = M.getPattern(patId) || p.patterns[0];
      collectPattern(p, pat, a, b, 0, emit, null);
      return;
    }
    for (const c of p.clips) {
      const tr = p.tracks.find((t) => t.id === c.track);
      if (!M.trackAudible(tr, p)) continue;
      const cEnd = c.start + c.len;
      if (c.type === "audio") {
        if (c.start >= a && c.start < b) emit({ type: "audio", clip: c, offsetSteps: 0 }, c.start);
        else if (seek && c.start < a && cEnd > a) emit({ type: "audio", clip: c, offsetSteps: a - c.start }, a);
        continue;
      }
      const pat = p.patterns.find((x) => x.id === c.ref);
      if (!pat) continue;
      const la = Math.max(a, c.start) - c.start, lb = Math.min(b, cEnd) - c.start;
      if (la >= lb) continue;
      const L = Math.max(1, pat.length);
      for (let k = Math.floor(la / L); k * L < lb; k++) {
        const base = k * L;
        const wa = Math.max(la, base), wb = Math.min(lb, base + L);
        if (wa < wb) collectPattern(p, pat, wa - base, wb - base, c.start + base, emit, cEnd);
      }
    }
  }

  function swingOffset(p, pos, stepDur) {
    if (!p.swing) return 0;
    const r = pos - Math.floor(pos);
    if (r > 0.01) return 0;
    return Math.floor(pos) % 2 === 1 ? p.swing * 0.45 * stepDur : 0;
  }

  /* ---------- Engine (live) ---------- */
  const LOOKAHEAD = 0.12;
  const engine = {
    ctx: null,
    graph: null,
    supported: !!AC,
    offlineSupported: !!OAC,
    unlocked: false,
    ensure() {
      if (!AC) return null;
      if (!this.ctx) {
        try { this.ctx = new AC({ latencyHint: "interactive" }); } catch (e) { this.ctx = new AC(); }
        this.graph = new Graph(this.ctx, { live: true, bpm: () => M.state.project.bpm });
        this.metro = this.ctx.createGain();
        this.metro.gain.value = 0.5;
        this.metro.connect(this.ctx.destination);
        this.ctx.onstatechange = () => bus.emit("audio:state", this.ctx.state);
        if (M.state.project) this.graph.sync(M.state.project);
      }
      if (this.ctx.state !== "running") { const pr = this.ctx.resume(); if (pr && pr.catch) pr.catch(() => {}); }
      return this.ctx;
    },
    get running() { return this.ctx && this.ctx.state === "running"; },
    sync() { if (this.graph && M.state.project) this.graph.sync(M.state.project); },

    /* live note input (keyboards, pads) */
    noteOn(ch, pitch, vel = 0.85) {
      if (!this.ensure()) return null;
      const t = this.ctx.currentTime + 0.005;
      if (ch.id.startsWith("tmp_")) this.graph.tempChannel(ch);
      return this.graph.playChannelNote(ch, pitch, vel, t, null);
    },
    noteOff(v) { if (v && this.ctx) v.stop(this.ctx.currentTime); },
    hit(ch, pitch, vel = 0.85, len = 0.25) {
      if (!this.ensure()) return;
      if (ch.id.startsWith("tmp_")) this.graph.tempChannel(ch);
      const isSample = ch.kind === "sample";
      this.graph.playChannelNote(ch, pitch == null ? ch.root || 60 : pitch, vel, this.ctx.currentTime + 0.005, isSample ? 0.15 : len);
    },
    previewSrc: null,
    previewBuffer(buf, rate = 1) {
      if (!buf || !this.ensure()) return;
      this.stopPreview();
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(this.graph.preview);
      src.start();
      this.previewSrc = src;
      src.onended = () => { if (this.previewSrc === src) this.previewSrc = null; };
    },
    stopPreview() { if (this.previewSrc) { try { this.previewSrc.stop(); } catch (e) { /* */ } this.previewSrc = null; } },
    level(analyser) {
      if (!analyser) return 0;
      const a = this._buf && this._buf.length === analyser.fftSize ? this._buf : (this._buf = new Float32Array(analyser.fftSize));
      analyser.getFloatTimeDomainData(a);
      let pk = 0;
      for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > pk) pk = v; }
      return pk;
    },
  };

  /* ---------- Transport ---------- */
  const transport = {
    playing: false,
    pos: 0,            // musical position (steps) when stopped/paused
    metronome: false,
    recordNotes: false,
    segs: [],
    timer: null,
    worker: null,
    onEvent: null,     // hook for visual feedback
    loopLen() {
      const p = M.state.project;
      return p.mode === "song" ? M.songLength(p) : M.patternLength(M.getPattern());
    },
    stepDur() { return 60 / M.state.project.bpm / 4; },
    play() {
      if (this.playing) return;
      if (!engine.ensure()) { bus.emit("toast", "Sound isn't supported in this browser."); return; }
      engine.sync();
      const ctx = engine.ctx;
      const L = this.loopLen();
      if (this.pos >= L) this.pos = 0;
      this.playing = true;
      this.curPos = this.pos;
      this.lastTime = ctx.currentTime + 0.06;
      this.seek = true;
      this.segs = [{ t: this.lastTime, pos: this.curPos, sd: this.stepDur() }];
      this.startTimer();
      this.tick();
      bus.emit("transport", "play");
    },
    pause() {
      if (!this.playing) return;
      this.pos = this.position();
      this.halt();
      bus.emit("transport", "pause");
    },
    stop() {
      const was = this.playing;
      if (was) this.halt();
      this.pos = 0;
      bus.emit("transport", "stop");
    },
    toggle() { if (this.playing) this.pause(); else this.play(); },
    halt() {
      this.playing = false;
      this.stopTimer();
      if (engine.graph) engine.graph.killAll();
    },
    setPos(step) {
      const L = this.loopLen();
      step = clamp(step, 0, Math.max(0, L - 0.001));
      if (this.playing) {
        if (engine.graph) engine.graph.killAll();
        this.curPos = step;
        this.lastTime = engine.ctx.currentTime + 0.03;
        this.seek = true;
        this.segs = [{ t: this.lastTime, pos: step, sd: this.stepDur() }];
      } else this.pos = step;
      bus.emit("transport", "seek");
    },
    /* current playhead (steps) */
    position() {
      if (!this.playing || !engine.ctx) return this.pos;
      const now = engine.ctx.currentTime - (engine.ctx.outputLatency || engine.ctx.baseLatency || 0) * 0.5;
      let seg = this.segs[0];
      for (const s of this.segs) if (s.t <= now) seg = s;
      const pos = seg.pos + Math.max(0, now - seg.t) / seg.sd;
      return Math.max(0, pos);
    },
    startTimer() {
      this.stopTimer();
      const tickFn = () => this.tick();
      try {
        if (!this.worker) {
          const src = "let id=null;onmessage=(e)=>{clearInterval(id);if(e.data==='start')id=setInterval(()=>postMessage(0),25);};";
          this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
        }
        this.worker.onmessage = tickFn;
        this.worker.postMessage("start");
      } catch (e) {
        this.worker = null;
        this.timer = setInterval(tickFn, 25);
      }
    },
    stopTimer() {
      if (this.worker) this.worker.postMessage("stop");
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    tick() {
      if (!this.playing) return;
      const p = M.state.project;
      const ctx = engine.ctx;
      const target = ctx.currentTime + LOOKAHEAD;
      if (this.lastTime < ctx.currentTime - 0.25) {
        // the tab was asleep; jump forward instead of bursting a backlog of notes
        const sd = this.stepDur();
        this.curPos += (ctx.currentTime - this.lastTime) / sd;
        this.lastTime = ctx.currentTime + 0.02;
        const L = this.loopLen();
        if (this.curPos >= L) this.curPos = p.loop ? this.curPos % L : L;
        this.seek = true;
        this.segs.push({ t: this.lastTime, pos: this.curPos, sd });
      }
      let guard = 0;
      while (this.lastTime < target && this.playing && guard++ < 8) {
        const sd = this.stepDur();
        const L = this.loopLen();
        const avail = (target - this.lastTime) / sd;
        let end = this.curPos + avail;
        if (end >= L) {
          this.window(this.curPos, L, sd);
          this.lastTime += (L - this.curPos) * sd;
          if (!p.loop) {
            const stopAt = this.lastTime;
            const delay = Math.max(0, (stopAt - ctx.currentTime) * 1000);
            this.playing = false;
            this.stopTimer();
            setTimeout(() => { this.pos = 0; bus.emit("transport", "stop"); }, delay + 30);
            return;
          }
          this.curPos = 0;
          this.seek = true;
          this.segs.push({ t: this.lastTime, pos: 0, sd });
          bus.emit("transport:loop");
          continue;
        }
        this.window(this.curPos, end, sd);
        this.curPos = end;
        this.lastTime = target;
        if (this.segs.length > 16) this.segs.splice(0, this.segs.length - 16);
        const last = this.segs[this.segs.length - 1];
        if (Math.abs(last.sd - sd) > 1e-9) this.segs.push({ t: this.lastTime - avail * sd, pos: end - avail, sd });
      }
    },
    window(a, b, sd) {
      if (b <= a) return;
      const p = M.state.project;
      const g = engine.graph;
      const t0 = this.lastTime;
      const toTime = (pos) => t0 + (pos - a) * sd + swingOffset(p, pos, sd);
      const seek = this.seek;
      this.seek = false;
      collect(p, p.mode, p.currentPattern, a, b, (ev, pos) => {
        const t = Math.max(engine.ctx.currentTime, toTime(pos));
        if (ev.type === "audio") g.playAudioClip(p, ev.clip, t, ev.offsetSteps * sd, sd);
        else {
          const dur = ev.ch.kind === "sample" && !ev.note ? (ev.ch.release == null ? null : ev.len * sd) : ev.len * sd;
          g.playChannelNote(ev.ch, ev.pitch, ev.vel, t, dur);
          if (this.onEvent) this.onEvent(ev.ch.id, t);
        }
      }, seek);
      if (this.metronome) {
        const spb = M.stepsPerBeat(p), bar = M.stepsPerBar(p);
        for (let s = Math.ceil(a / spb) * spb; s < b; s += spb) {
          const t = toTime(s);
          const o = engine.ctx.createOscillator(), gg = engine.ctx.createGain();
          o.frequency.value = s % bar === 0 ? 1760 : 1100;
          gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.6, t + 0.001); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          o.connect(gg).connect(engine.metro);
          o.start(t); o.stop(t + 0.06);
        }
      }
    },
  };

  /* ---------- Offline render (export) ---------- */
  async function ensureBuffers(p) {
    const ids = new Set();
    for (const c of p.channels) if (c.kind === "sample" && c.sound && !c.sound.startsWith("asset:")) ids.add(c.sound);
    for (const c of p.clips) if (c.type === "audio" && c.ref && !c.ref.startsWith("asset:")) ids.add(c.ref);
    await Promise.all([...ids].map((id) => GBL.samples.render(id)));
  }

  /* opts: {range:'song'|'pattern', loops, bars, sampleRate, tail, onProgress} -> AudioBuffer */
  async function renderOffline(p, opts) {
    await ensureBuffers(p);
    const sr = opts.sampleRate || 44100;
    const sd = 60 / p.bpm / 4;
    let mode = "song", L;
    if (opts.range === "pattern" || !p.clips.length) {
      mode = "pattern";
      L = M.patternLength(M.getPattern()) * Math.max(1, opts.loops || 1);
    } else L = M.songLength(p);
    if (opts.bars) L = Math.min(L, opts.bars * M.stepsPerBar(p));
    const tail = opts.tail == null ? 2 : opts.tail;
    const seconds = L * sd + tail;
    const ctx = new OAC(2, Math.ceil(seconds * sr), sr);
    const g = new Graph(ctx, { live: false, bpm: () => p.bpm });
    g.sync(p);
    const start = 0.02;
    if (mode === "pattern") {
      const pl = M.patternLength(M.getPattern());
      for (let k = 0; k * pl < L; k++) {
        collect(p, "pattern", p.currentPattern, 0, Math.min(pl, L - k * pl), (ev, pos) => {
          const absPos = pos + k * pl;
          schedule(ev, absPos);
        });
      }
    } else collect(p, "song", null, 0, L, (ev, pos) => schedule(ev, pos), false);
    function schedule(ev, pos) {
      const t = start + pos * sd + swingOffset(p, pos, sd);
      if (ev.type === "audio") g.playAudioClip(p, ev.clip, t, ev.offsetSteps * sd, sd);
      else {
        const dur = ev.ch.kind === "sample" && !ev.note ? (ev.ch.release == null ? null : ev.len * sd) : ev.len * sd;
        g.playChannelNote(ev.ch, ev.pitch, ev.vel, t, dur);
      }
    }
    // progress through suspend() checkpoints where supported
    if (opts.onProgress && ctx.suspend) {
      const n = 20;
      for (let i = 1; i < n; i++) {
        const t = (seconds * i) / n;
        try {
          ctx.suspend(t).then(() => { opts.onProgress(i / n); ctx.resume(); });
        } catch (e) { break; }
      }
    }
    const buf = await new Promise((res, rej) => {
      const r = ctx.startRendering();
      if (r && r.then) r.then(res, rej);
      else ctx.oncomplete = (e) => res(e.renderedBuffer);
    });
    opts.onProgress && opts.onProgress(1);
    return buf;
  }

  // keep the live graph in step with the project
  bus.on("change", () => engine.sync());
  bus.on("project:loaded", () => { if (engine.graph) { engine.graph.killAll(); engine.sync(); } });

  GBL.audio = { engine, transport, Graph, collect, renderOffline, assets, decodeAudio, resolveBuffer, refName, cutoffHz, dbToGain, ensureBuffers, AC, OAC };
})();
