/* ExportManager: WAV (16/24/32-bit float), MP3 (vendored lamejs, loaded on demand) and MIDI. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h } = GBL;
  const M = GBL.model;

  /* ---------- WAV ---------- */
  function encodeWav(buf, bitDepth = 16) {
    const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
    const float = bitDepth === 32;
    const bps = bitDepth / 8;
    const dataLen = len * ch * bps;
    const ab = new ArrayBuffer(44 + dataLen);
    const v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + dataLen, true); w(8, "WAVE");
    w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, float ? 3 : 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * bps, true); v.setUint16(32, ch * bps, true); v.setUint16(34, bitDepth, true);
    w(36, "data"); v.setUint32(40, dataLen, true);
    const chans = [];
    for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        let s = Math.max(-1, Math.min(1, chans[c][i]));
        if (float) { v.setFloat32(o, s, true); o += 4; }
        else if (bitDepth === 24) { const x = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff); v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3; }
        else { v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
      }
    }
    return new Blob([ab], { type: "audio/wav" });
  }

  /* ---------- MP3 ---------- */
  let lamePromise = null;
  function loadLame() {
    if (window.lamejs) return Promise.resolve(window.lamejs);
    if (!lamePromise) {
      lamePromise = new Promise((res, rej) => {
        const s = h("script", { src: "libs/lame.min.js" });
        s.onload = () => (window.lamejs ? res(window.lamejs) : rej(new Error("MP3 encoder failed to load")));
        s.onerror = () => { lamePromise = null; rej(new Error("MP3 encoder failed to load")); };
        document.head.append(s);
      });
    }
    return lamePromise;
  }

  async function encodeMp3(buf, kbps, onProgress) {
    const lame = await loadLame();
    const ch = Math.min(2, buf.numberOfChannels);
    const enc = new lame.Mp3Encoder(ch, buf.sampleRate, kbps);
    const toInt = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7fff; } return o; };
    const L = toInt(buf.getChannelData(0));
    const R = ch > 1 ? toInt(buf.getChannelData(1)) : L;
    const parts = [];
    const block = 1152 * 20;
    for (let i = 0; i < L.length; i += block) {
      const out = ch > 1 ? enc.encodeBuffer(L.subarray(i, i + block), R.subarray(i, i + block)) : enc.encodeBuffer(L.subarray(i, i + block));
      if (out.length) parts.push(new Uint8Array(out));
      if ((i / block) % 10 === 0) { onProgress && onProgress(i / L.length); await new Promise((r) => setTimeout(r, 0)); }
    }
    const end = enc.flush();
    if (end.length) parts.push(new Uint8Array(end));
    onProgress && onProgress(1);
    return new Blob(parts, { type: "audio/mpeg" });
  }

  /* ---------- MIDI (type 1) ---------- */
  const GM_DRUM = { kick: 36, kick808: 36, kick_punch: 36, kick_soft: 35, snare: 38, snare_tight: 40, snare_lofi: 38, clap: 39, hat_closed: 42, hat_open: 46, hat_pedal: 44,
    cymbal: 49, ride: 51, tom: 47, tom_low: 45, tom_high: 50, rim: 37, perc: 63, conga_low: 64, bongo: 60, shaker: 70, tambourine: 54, cowbell: 56, woodblock: 76, triangle: 81, claves: 75, snap: 39,
    r_kick: 36, r_snare: 38, r_hat: 42 };
  const GM_PROG = { piano: 0, epiano: 4, synthpiano: 2, organ: 16, classic: 81, retro: 80, lead: 81, ambient: 89, bass_synth: 38, ebass: 33, synthbass: 38, subbass: 38, guitar: 25, strings: 48, brass: 61, bells: 14, chiptune: 80, retro8bit: 80 };

  function vlq(n) {
    const bytes = [n & 0x7f];
    while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
    return bytes;
  }
  function encodeMidi(p, range) {
    const PPQ = 480, tpStep = PPQ / 4;
    const tracks = [];
    // tempo + time signature track
    const tempo = Math.round(60000000 / p.bpm);
    const den = Math.log2(p.timeSig[1]);
    const name = Array.from(new TextEncoder().encode(p.name || "Song"));
    tracks.push([0, 0xff, 0x03, ...vlq(name.length), ...name, 0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
      0, 0xff, 0x58, 4, p.timeSig[0], den, 24, 8, 0, 0xff, 0x2f, 0]);
    // gather events per channel
    const per = new Map();
    const emit = (ev, pos) => {
      if (ev.type !== "hit") return;
      if (!per.has(ev.ch.id)) per.set(ev.ch.id, []);
      per.get(ev.ch.id).push({ pos, ev });
    };
    if (range === "pattern" || !p.clips.length) GBL.audio.collect(p, "pattern", p.currentPattern, 0, M.patternLength(M.getPattern()), emit);
    else GBL.audio.collect(p, "song", null, 0, M.songLength(p), emit);
    let melodicCh = 0;
    for (const ch of p.channels) {
      const list = per.get(ch.id);
      if (!list || !list.length) continue;
      const isDrum = ch.kind === "sample";
      let mch = 9;
      if (!isDrum) { mch = melodicCh; melodicCh = (melodicCh + 1) % 16; if (melodicCh === 9) melodicCh = 10; }
      const evs = [];
      for (const { pos, ev } of list) {
        let note = isDrum ? (GM_DRUM[ch.sound] || 38) : ev.pitch + (ch.pitch || 0);
        if (isDrum && ev.note) note = GM_DRUM[ch.sound] || ev.pitch;
        note = Math.max(0, Math.min(127, Math.round(note)));
        const vel = Math.max(1, Math.min(127, Math.round(ev.vel * 127)));
        const on = Math.round(pos * tpStep), off = Math.round((pos + Math.max(0.25, isDrum && !ev.note ? 0.5 : ev.len)) * tpStep);
        evs.push([on, 1, [0x90 | mch, note, vel]], [off, 0, [0x80 | mch, note, 0]]);
      }
      evs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const nm = Array.from(new TextEncoder().encode(ch.name));
      const data = [0, 0xff, 0x03, ...vlq(nm.length), ...nm];
      if (!isDrum) data.push(0, 0xc0 | mch, GM_PROG[ch.inst] || 0);
      let last = 0;
      for (const [t, , bytes] of evs) { data.push(...vlq(t - last), ...bytes); last = t; }
      data.push(0, 0xff, 0x2f, 0);
      tracks.push(data);
    }
    const out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255];
    for (const t of tracks) out.push(0x4d, 0x54, 0x72, 0x6b, (t.length >>> 24) & 255, (t.length >>> 16) & 255, (t.length >>> 8) & 255, t.length & 255, ...t);
    return new Blob([new Uint8Array(out)], { type: "audio/midi" });
  }

  /* ---------- Export dialog ---------- */
  function openDialog() {
    const p = M.state.project;
    const hasSong = p.clips.length > 0;
    if (!GBL.audio.OAC) { GBL.ui.alert("Export isn't available", "This browser can't render audio offline. Try the latest Chrome, Edge, Firefox or Safari."); return; }
    const f = {
      name: h("input", { type: "text", value: p.name, maxlength: 80 }),
      format: h("select", {}, h("option", { value: "wav" }, "WAV (best quality)"), h("option", { value: "mp3" }, "MP3 (small file)"), h("option", { value: "mid" }, "MIDI (notes only)")),
      range: h("select", {}, h("option", { value: "song", selected: hasSong }, "Whole song (Playlist)"), h("option", { value: "pattern", selected: !hasSong }, "Current pattern")),
      loops: h("input", { type: "number", min: 1, max: 64, value: 4 }),
      bars: h("input", { type: "number", min: 0, max: 999, value: 0 }),
      sr: h("select", {}, h("option", { value: "44100" }, "44,100 Hz (CD)"), h("option", { value: "48000" }, "48,000 Hz (video)")),
      bits: h("select", {}, h("option", { value: "16" }, "16-bit"), h("option", { value: "24" }, "24-bit"), h("option", { value: "32" }, "32-bit float")),
      kbps: h("select", {}, h("option", { value: "128" }, "128 kbps (smaller)"), h("option", { value: "192", selected: true }, "192 kbps (good)"), h("option", { value: "256" }, "256 kbps (great)"), h("option", { value: "320" }, "320 kbps (best)")),
      tail: h("input", { type: "number", min: 0, max: 10, step: 0.5, value: 2 }),
    };
    const row = (label, el, cls) => h("label", { class: "form-row " + (cls || "") }, h("span", {}, label), el);
    const rows = {
      loops: row("Repeat pattern", f.loops, "only-pattern"),
      bits: row("Bit depth", f.bits, "only-wav adv"),
      kbps: row("Audio quality", f.kbps, "only-mp3"),
      sr: row("Sample rate", f.sr, "no-mid adv"),
      bars: row("Stop after bars (0 = all)", f.bars, "adv no-mid"),
      tail: row("Extra seconds for echoes", f.tail, "adv no-mid"),
    };
    const bar = h("div", { class: "progress" }, h("div", { class: "progress-fill" }));
    const status = h("div", { class: "progress-label" }, "");
    const goBtn = h("button", { class: "btn primary big" }, "⬇ Export");
    const body = h("div", { class: "export-form" },
      row("Song name", f.name), row("Format", f.format), row("What to export", f.range), rows.loops, rows.kbps, rows.bits, rows.sr, rows.bars, rows.tail,
      h("div", { class: "export-progress", hidden: true }, bar, status));
    const update = () => {
      const fmt = f.format.value;
      body.querySelectorAll(".only-wav").forEach((e) => (e.hidden = fmt !== "wav"));
      body.querySelectorAll(".only-mp3").forEach((e) => (e.hidden = fmt !== "mp3"));
      body.querySelectorAll(".no-mid").forEach((e) => (e.hidden = fmt === "mid"));
      body.querySelectorAll(".only-pattern").forEach((e) => (e.hidden = f.range.value !== "pattern" || fmt === "mid"));
    };
    f.format.onchange = update; f.range.onchange = update;
    update();
    const dlg = GBL.ui.modal({ title: "Export your song", icon: "💾", body, actions: [goBtn], wide: false });
    const setProg = (frac, label) => {
      body.querySelector(".export-progress").hidden = false;
      bar.firstChild.style.width = Math.round(frac * 100) + "%";
      status.textContent = label + " " + Math.round(frac * 100) + "%";
    };
    goBtn.onclick = async () => {
      goBtn.disabled = true;
      const fmt = f.format.value;
      const songName = f.name.value.trim() || p.name;
      try {
        if (fmt === "mid") {
          const blob = encodeMidi(p, f.range.value);
          GBL.downloadBlob(blob, GBL.safeFileName(songName, "mid"));
          setProg(1, "Done!");
        } else {
          setProg(0, "Mixing your song…");
          const buf = await GBL.audio.renderOffline(GBL.deepClone(p), {
            range: f.range.value, loops: +f.loops.value || 1, bars: +f.bars.value || 0, sampleRate: +f.sr.value, tail: +f.tail.value,
            onProgress: (x) => setProg(x * (fmt === "mp3" ? 0.6 : 0.9), "Mixing your song…"),
          });
          let blob;
          if (fmt === "wav") { setProg(0.95, "Writing WAV…"); await new Promise((r) => setTimeout(r, 20)); blob = encodeWav(buf, +f.bits.value); }
          else blob = await encodeMp3(buf, +f.kbps.value, (x) => setProg(0.6 + x * 0.4, "Making MP3…"));
          setProg(1, "Done!");
          GBL.downloadBlob(blob, GBL.safeFileName(songName, fmt));
          GBL.bus.emit("exported", fmt);
        }
        status.textContent = "Done! Check your downloads 🎉";
        GBL.ui.confetti && GBL.ui.confetti();
      } catch (e) {
        console.error(e);
        status.textContent = "Export failed: " + (e.message || e);
      }
      goBtn.disabled = false;
    };
    return dlg;
  }

  GBL.exporter = { encodeWav, encodeMp3, encodeMidi, openDialog, loadLame };
})();
