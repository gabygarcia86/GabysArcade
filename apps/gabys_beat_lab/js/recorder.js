/* Recording (microphone) and audio import. Recordings are stored as WAV so every browser can reopen them. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, bus, uid } = GBL;
  const M = GBL.model;
  const S = M.state;
  const A = GBL.audio;

  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  /* ---------- import ---------- */
  async function importFiles(files, target) {
    const ids = [];
    for (const f of Array.from(files)) {
      if (!/^audio\//.test(f.type) && !/\.(wav|mp3|ogg|oga|m4a|aac|flac|webm|aif|aiff)$/i.test(f.name)) { GBL.ui.toast(f.name + " isn't an audio file"); continue; }
      try {
        const bytes = await f.arrayBuffer();
        const id = await GBL.projects.addAsset(f.name.replace(/\.[^.]+$/, ""), bytes, f.type || "audio/*");
        ids.push(id);
        if (target === "channel") M.addChannel({ kind: "sample", sound: "asset:" + id, name: f.name.replace(/\.[^.]+$/, "").slice(0, 30) });
      } catch (e) {
        GBL.ui.alert("Couldn't open " + f.name, "This browser couldn't read that audio file. WAV and MP3 work everywhere.");
      }
    }
    if (ids.length) {
      if (target !== "channel") M.changed("assets");
      bus.emit("assets");
      GBL.ui.toast("Imported " + ids.length + " sound" + (ids.length > 1 ? "s" : "") + " into My Sounds");
    }
    return ids;
  }

  function importDialog(target) {
    const input = h("input", { type: "file", accept: "audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aif,.aiff", multiple: true, style: { display: "none" } });
    document.body.append(input);
    input.onchange = () => { if (input.files.length) importFiles(input.files, target); input.remove(); };
    input.click();
  }

  /* ---------- microphone recorder ---------- */
  function open(opts = {}) {
    if (!canRecord) {
      GBL.ui.alert("Recording isn't available", "This browser can't record from a microphone. Try the latest Chrome, Edge, Firefox or Safari on a computer, and make sure the page is opened over https.");
      return;
    }
    const ctx = A.engine.ensure();
    let stream = null, rec = null, chunks = [], startPos = 0, startedAt = 0, raf = 0, analyser = null, srcNode = null, buffer = null;
    const level = h("canvas", { class: "rec-level", width: 300, height: 26 });
    const timeEl = h("div", { class: "rec-time" }, "0:00.0");
    const status = h("p", { class: "hint" }, "Press the big red button to start. Your browser will ask for permission to use the microphone.");
    const withMusic = h("input", { type: "checkbox", checked: !!opts.withMusic });
    const recBtn = h("button", { class: "rec-big", "aria-label": "Start recording" }, "⏺");
    const wave = h("canvas", { class: "rec-wave", hidden: true });
    const playB = h("button", { class: "btn", hidden: true }, "▶ Listen");
    const toSong = h("button", { class: "btn primary", hidden: true }, "🎞️ Put in my song");
    const toCh = h("button", { class: "btn", hidden: true }, "🥁 Make it a Channel");
    const toLib = h("button", { class: "btn", hidden: true }, "📚 Save to My Sounds");
    const body = h("div", { class: "recorder" },
      h("label", { class: "check" }, withMusic, " Play my song while I record (records into the Playlist at the playhead)"),
      h("div", { class: "rec-row" }, recBtn, h("div", {}, timeEl, level)),
      status, wave, h("div", { class: "rec-actions" }, playB, toSong, toCh, toLib));
    const dlg = GBL.ui.modal({ title: "Record with the microphone", icon: "🎤", body, onClose: cleanup });

    function meter() {
      if (!analyser) return;
      const lvl = A.engine.level(analyser);
      const c = level.getContext("2d");
      c.clearRect(0, 0, 300, 26);
      c.fillStyle = "rgba(255,255,255,0.1)"; c.fillRect(0, 0, 300, 26);
      c.fillStyle = lvl > 0.9 ? "#ef4444" : lvl > 0.6 ? "#facc15" : "#22c55e";
      c.fillRect(0, 0, Math.min(1, lvl * 1.3) * 300, 26);
      if (rec && rec.state === "recording") timeEl.textContent = GBL.fmtTime(ctx.currentTime - startedAt);
      raf = requestAnimationFrame(meter);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (e) {
        status.textContent = "Microphone permission was blocked. Allow the microphone in your browser's address bar, then try again.";
        return;
      }
      srcNode = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      srcNode.connect(analyser);
      chunks = [];
      try { rec = new MediaRecorder(stream); } catch (e) { status.textContent = "Recording failed to start: " + e.message; return; }
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = finish;
      if (withMusic.checked) {
        if (S.project.mode !== "song") { S.project.mode = "song"; bus.emit("mode"); }
        startPos = GBL.audio.transport.position();
        GBL.audio.transport.play();
      } else startPos = GBL.audio.transport.position();
      rec.start();
      startedAt = ctx.currentTime;
      recBtn.classList.add("on");
      recBtn.textContent = "⏹";
      recBtn.setAttribute("aria-label", "Stop recording");
      status.textContent = "Recording… press the button again to stop.";
      meter();
    }
    function stop() {
      if (rec && rec.state === "recording") rec.stop();
      if (withMusic.checked) GBL.audio.transport.pause();
      recBtn.classList.remove("on");
      recBtn.textContent = "⏺";
      recBtn.setAttribute("aria-label", "Start recording");
    }
    async function finish() {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      status.textContent = "Processing…";
      try {
        const blob = new Blob(chunks, { type: (rec && rec.mimeType) || "audio/webm" });
        const decoded = await A.decodeAudio(await blob.arrayBuffer());
        // compensate for latency when recording along with the song
        let trimmed = decoded;
        if (withMusic.checked) {
          const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
          const skip = Math.floor(lat * decoded.sampleRate);
          if (skip > 0 && skip < decoded.length) {
            trimmed = new AudioBuffer({ length: decoded.length - skip, numberOfChannels: decoded.numberOfChannels, sampleRate: decoded.sampleRate });
            for (let c = 0; c < decoded.numberOfChannels; c++) trimmed.getChannelData(c).set(decoded.getChannelData(c).subarray(skip));
          }
        }
        buffer = trimmed;
        drawWave();
        status.textContent = "Nice! " + buffer.duration.toFixed(1) + " seconds recorded. Listen, then choose where it goes.";
        for (const b of [playB, toSong, toCh, toLib]) b.hidden = false;
        wave.hidden = false;
      } catch (e) {
        status.textContent = "Sorry, that recording couldn't be read (" + (e.message || e) + ").";
      }
    }
    function drawWave() {
      const w = 420, hh = 70;
      wave.hidden = false;
      const c = GBL.fitCanvas(wave, w, hh);
      const d = buffer.getChannelData(0), per = Math.max(1, Math.floor(d.length / w));
      c.clearRect(0, 0, w, hh);
      c.fillStyle = "#f472b6";
      for (let x = 0; x < w; x++) { let m = 0; for (let j = 0; j < per; j += 4) m = Math.max(m, Math.abs(d[x * per + j] || 0)); c.fillRect(x, hh / 2 - (m * hh) / 2, 1, Math.max(1, m * hh)); }
    }
    async function store(name) {
      const bytes = await GBL.exporter.encodeWav(buffer, 16).arrayBuffer();
      const id = await GBL.projects.addAsset(name, bytes, "audio/wav", buffer);
      bus.emit("assets");
      return id;
    }
    const count = () => Object.keys(S.project.assets).length + 1;
    recBtn.onclick = () => { if (rec && rec.state === "recording") stop(); else start(); };
    playB.onclick = () => A.engine.previewBuffer(buffer);
    toSong.onclick = async () => {
      const id = await store("Recording " + count());
      const p = S.project;
      let tr = p.tracks.find((t) => t.type === "Vocals");
      if (!tr) { tr = { id: uid("trk"), name: "Vocals", type: "Vocals", color: "#f472b6", mute: false, solo: false, insert: null }; p.tracks.push(tr); }
      if (!tr.insert) { const ins = M.addInsert(tr.name, tr.color); tr.insert = ins.id; }
      GBL.playlist.addAudioClip("asset:" + id, tr.id, withMusic.checked ? Math.max(0, startPos) : Math.floor(GBL.audio.transport.position()));
      GBL.layout.showEditor("playlist");
      dlg.close();
      GBL.ui.toast("🎤 Recording added to the Vocals track");
    };
    toCh.onclick = async () => { const name = "Recording " + count(); const id = await store(name); M.addChannel({ kind: "sample", sound: "asset:" + id, name }); dlg.close(); };
    toLib.onclick = async () => { await store("Recording " + count()); M.changed("assets"); dlg.close(); GBL.ui.toast("Saved to My Sounds"); };
    function cleanup() {
      cancelAnimationFrame(raf);
      if (rec && rec.state === "recording") { rec.onstop = null; rec.stop(); }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (srcNode) srcNode.disconnect();
    }
    if (opts.autoStart) start();
  }

  GBL.recorder = { importFiles, importDialog, open, canRecord };
})();
