/* Exporting: animated GIF, video (WebM, or MP4 on Safari), PNG frames (one ZIP or separate
 * files) and sprite sheets. Everything is made in the browser and downloaded straight away. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, h, ctxOf, clamp } = GAS;

  const FORMATS = [
    { id: "gif", label: "Animated GIF", icon: "gif", tip: "A moving picture that plays almost anywhere" },
    { id: "video", label: "Video", icon: "video", tip: "A movie file, with your sounds" },
    { id: "png", label: "PNG frames", icon: "images", tip: "Every frame as its own picture" },
    { id: "sprite", label: "Sprite sheet", icon: "grid", tip: "All frames on one big picture, for games" },
  ];

  /* ---------- rendering helpers ---------- */
  function outputSize(p, scale) {
    let w = Math.max(16, Math.round(p.width * scale)), hh = Math.max(16, Math.round(p.height * scale));
    return { w, h: hh };
  }

  function renderOut(p, frame, w, hh, transparent, matte) {
    const c = GAS.makeCanvas(w, hh, true);
    const ctx = ctxOf(c);
    if (matte) { ctx.fillStyle = matte; ctx.fillRect(0, 0, w, hh); }
    GAS.render.renderFrame(ctx, p, frame, { scale: w / p.width, bg: !transparent });
    return c;
  }

  const sceneIsTransparent = (p) =>
    p.bgFill.type === "transparent" && p.bgLayer.empty && p.frames.every((f) => (!f.bgFill || f.bgFill.type === "transparent") && (!f.bgLayer || f.bgLayer.empty));

  function centiDelays(p, fps) {
    let err = 0;
    return p.frames.map((f) => {
      const cs = GAS.anim.frameMs(p, f, fps, 1) / 10 + err;
      const r = Math.max(2, Math.round(cs));
      err = cs - r;
      return r;
    });
  }

  /* ---------- GIF ---------- */
  async function exportGif(p, o, progress) {
    const { w, h: hh } = outputSize(p, o.scale);
    const transparent = o.transparent || sceneIsTransparent(p);
    const frames = [];
    for (let i = 0; i < p.frames.length; i++) {
      const c = renderOut(p, p.frames[i], w, hh, o.transparent, null);
      frames.push(ctxOf(c).getImageData(0, 0, w, hh).data);
      progress(0.3 * ((i + 1) / p.frames.length), "Drawing frames…");
      if (i % 8 === 7) await GAS.nextFrame();
    }
    const blob = await GAS.gif.encode(frames, centiDelays(p, o.fps), w, hh,
      { loop: o.loop ? 0 : -1, transparent, dither: o.dither },
      (f) => progress(0.3 + 0.7 * f, "Making your GIF…"));
    return { blob, name: GAS.safeFileName(p.name) + ".gif" };
  }

  /* ---------- video ---------- */
  function videoMime() {
    if (!window.MediaRecorder) return null;
    const list = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"];
    return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || null;
  }
  const canVideo = () => !!(videoMime() && HTMLCanvasElement.prototype.captureStream);

  async function exportVideo(p, o, progress, cancelled) {
    const mime = videoMime();
    if (!mime) throw new Error("This browser can't record videos. Try Chrome, Edge or Firefox, or export a GIF instead.");
    let { w, h: hh } = outputSize(p, o.scale);
    w -= w % 2; hh -= hh % 2;
    const canvas = GAS.makeCanvas(w, hh);
    Object.assign(canvas.style, { position: "fixed", left: "-99999px", top: "0", pointerEvents: "none" });
    document.body.appendChild(canvas);
    const ctx = ctxOf(canvas);
    const matte = p.bgFill.type === "transparent" ? "#ffffff" : null;
    const draw = (f) => {
      ctx.fillStyle = matte || "#ffffff";
      ctx.fillRect(0, 0, w, hh);
      GAS.render.renderFrame(ctx, p, f, { scale: w / p.width });
    };
    draw(p.frames[0]);

    const manual = typeof CanvasCaptureMediaStreamTrack !== "undefined" && "requestFrame" in CanvasCaptureMediaStreamTrack.prototype;
    const stream = canvas.captureStream(manual ? 0 : Math.max(o.fps, 12));
    const vtrack = stream.getVideoTracks()[0];

    // Sounds go through a separate audio graph into the recording.
    let actx = null, dest = null;
    const sounds = o.sound ? p.frames.filter((f) => f.sound) : [];
    if (sounds.length) {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      dest = actx.createMediaStreamDestination();
      stream.addTrack(dest.stream.getAudioTracks()[0]);
      for (const f of sounds) await GAS.audio.getBuffer(f.sound.ref);
    }

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: clamp(w * hh * 12, 1500000, 12000000) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });

    // Build the timeline: frames (and loops) with start times.
    const timeline = [];
    let t = 0;
    for (let r = 0; r < o.repeats; r++) {
      for (const f of p.frames) {
        timeline.push({ f, t });
        t += GAS.anim.frameMs(p, f, o.fps, 1);
      }
    }
    const total = t;

    rec.start(200);
    if (actx && actx.state === "suspended") await actx.resume();
    await GAS.wait(150);
    const t0 = performance.now() + 60;
    const a0 = actx ? actx.currentTime + 0.06 : 0;
    if (actx) {
      for (const item of timeline) {
        if (!item.f.sound) continue;
        const b = await GAS.audio.getBuffer(item.f.sound.ref);
        if (!b) continue;
        const src = actx.createBufferSource();
        src.buffer = b;
        const g = actx.createGain();
        g.gain.value = item.f.sound.volume ?? 1;
        src.connect(g).connect(dest);
        src.start(a0 + item.t / 1000);
      }
    }

    for (let i = 0; i < timeline.length; i++) {
      if (cancelled()) break;
      const item = timeline[i];
      const due = t0 + item.t;
      const wait = due - performance.now();
      if (wait > 0) await GAS.wait(wait);
      draw(item.f);
      if (manual && vtrack.requestFrame) vtrack.requestFrame();
      progress(item.t / total, "Recording your movie…");
    }
    const endWait = t0 + total - performance.now();
    if (endWait > 0 && !cancelled()) await GAS.wait(endWait);
    if (manual && vtrack.requestFrame) vtrack.requestFrame();
    await GAS.wait(120);
    rec.stop();
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());
    if (actx) actx.close();
    canvas.remove();
    if (cancelled()) return null;
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    return { blob: new Blob(chunks, { type: mime.split(";")[0] }), name: GAS.safeFileName(p.name) + "." + ext };
  }

  /* ---------- PNG frames ---------- */
  async function exportPngs(p, o, progress) {
    const { w, h: hh } = outputSize(p, o.scale);
    const base = GAS.safeFileName(p.name);
    const pad = String(p.frames.length).length < 3 ? 3 : String(p.frames.length).length;
    const files = [];
    for (let i = 0; i < p.frames.length; i++) {
      const c = renderOut(p, p.frames[i], w, hh, o.transparent, null);
      const blob = await GAS.canvasToBlob(c, "image/png");
      files.push({ name: `${base}-frame-${String(i + 1).padStart(pad, "0")}.png`, blob });
      progress((i + 1) / p.frames.length, "Saving frame " + (i + 1) + "…");
    }
    if (o.zip) {
      const entries = [];
      for (const f of files) entries.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
      return { blob: GAS.zip.zip(entries), name: base + "-frames.zip" };
    }
    return { many: files };
  }

  /* ---------- sprite sheet ---------- */
  function sheetLayout(p, o) {
    const n = p.frames.length;
    const { w, h: hh } = outputSize(p, o.scale);
    const cols = clamp(o.cols || Math.ceil(Math.sqrt(n)), 1, n);
    const rows = Math.ceil(n / cols);
    const sp = Math.max(0, o.spacing | 0);
    return { cols, rows, fw: w, fh: hh, sp, W: cols * w + (cols - 1) * sp, H: rows * hh + (rows - 1) * sp };
  }
  async function renderSheet(p, o, progress) {
    const L = sheetLayout(p, o);
    if (L.W > 16384 || L.H > 16384 || L.W * L.H > 200e6) throw new Error("That sprite sheet would be too big. Make the size smaller or change the columns.");
    const sheet = GAS.makeCanvas(L.W, L.H);
    const ctx = ctxOf(sheet);
    p.frames.forEach((f, i) => {
      const x = (i % L.cols) * (L.fw + L.sp), y = Math.floor(i / L.cols) * (L.fh + L.sp);
      ctx.save();
      ctx.translate(x, y);
      GAS.render.renderFrame(ctx, p, f, { scale: L.fw / p.width, bg: !o.transparent });
      ctx.restore();
      if (progress) progress((i + 1) / p.frames.length, "Building sprite sheet…");
    });
    return sheet;
  }
  async function exportSprite(p, o, progress) {
    const sheet = await renderSheet(p, o, progress);
    const blob = await GAS.canvasToBlob(sheet, "image/png");
    return { blob, name: GAS.safeFileName(p.name) + "-spritesheet.png" };
  }

  /* ---------- export window ---------- */
  function open(initialFormat) {
    const p = state.project;
    if (!p) return;
    if (state.playing) GAS.anim.pause();
    GAS.selection.commitFloat();
    const I = GAS.icons.svg;
    const opts = {
      format: initialFormat || GAS.prefs.get("exportFormat", "gif"),
      scale: 1, fps: p.fps, loop: p.loop, dither: false, transparent: false,
      sound: true, repeats: 1, zip: true, cols: 0, spacing: 0,
    };
    if (opts.format === "video" && !canVideo()) opts.format = "gif";

    const previewBox = h("div", { class: "export-preview" });
    const previewCanvas = h("canvas", { class: "export-preview-canvas" });
    previewBox.appendChild(previewCanvas);
    const info = h("p", { class: "export-info" });
    const settings = h("div", { class: "export-settings" });
    const progressWrap = h("div", { class: "export-progress", hidden: true },
      h("div", { class: "export-progress-label" }, "Working…"),
      h("div", { class: "progress" }, h("div", { class: "progress-bar" })));

    const formatBtns = FORMATS.map((f) => {
      const disabled = f.id === "video" && !canVideo();
      return h("button", {
        class: "format-card", type: "button", dataset: { format: f.id }, disabled,
        tip: disabled ? "Your browser can't record video. GIF works great!" : f.tip,
        onclick: () => { opts.format = f.id; GAS.prefs.set("exportFormat", f.id); refresh(); },
      }, h("span", { class: "format-icon" }, I(f.icon)), h("span", null, f.label));
    });

    let player = null;
    function restartPreview() {
      if (player) player.stop();
      const maxW = Math.min(420, previewBox.clientWidth || 420), maxH = 260;
      const s = Math.min(maxW / p.width, maxH / p.height, 2);
      if (opts.format === "sprite") {
        renderSheet(p, opts).then((sheet) => {
          const k = Math.min(maxW / sheet.width, maxH / sheet.height, 1);
          previewCanvas.width = Math.max(1, Math.round(sheet.width * k));
          previewCanvas.height = Math.max(1, Math.round(sheet.height * k));
          const c = ctxOf(previewCanvas);
          c.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          c.imageSmoothingQuality = "high";
          c.drawImage(sheet, 0, 0, previewCanvas.width, previewCanvas.height);
        }).catch((err) => { info.textContent = err.message; });
        previewBox.classList.toggle("is-transparent", true);
        return;
      }
      previewCanvas.width = Math.round(p.width * s);
      previewCanvas.height = Math.round(p.height * s);
      const transparent = opts.format !== "video" && (opts.transparent || sceneIsTransparent(p));
      previewBox.classList.toggle("is-transparent", transparent);
      const proj = opts.transparent && opts.format !== "video" ? { ...p, bgFill: { type: "transparent" }, bgLayer: { empty: true }, frames: p.frames.map((f) => ({ ...f, bgFill: null, bgLayer: null })) } : p;
      player = new GAS.anim.Player(previewCanvas, {
        project: proj, fps: opts.fps, loop: opts.format === "gif" ? opts.loop : true, speed: 1,
        sound: false, matte: opts.format === "video" && p.bgFill.type === "transparent" ? "#ffffff" : null,
        onEnd: () => setTimeout(() => player && player.start(0), 800),
      });
      player.start(0);
    }

    function row(label, control, hint) {
      return h("label", { class: "field" }, h("span", { class: "field-label" }, label), control, hint ? h("span", { class: "field-hint" }, hint) : null);
    }

    function refresh() {
      formatBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.format === opts.format));
      settings.innerHTML = "";
      const { w, h: hh } = outputSize(p, opts.scale);
      const scales = [0.25, 0.5, 0.75, 1, 1.5, 2].filter((s) => p.width * s >= 16 && p.width * s <= 4096);
      settings.appendChild(row("Size", GAS.ui.select(scales.map((s) => ({ value: s, label: `${Math.round(s * 100)}%  (${Math.round(p.width * s)} × ${Math.round(p.height * s)})` })), opts.scale, (v) => { opts.scale = +v; refresh(); })));
      if (opts.format === "gif" || opts.format === "video") {
        settings.appendChild(row("Speed", GAS.ui.select(GAS.anim.FPS_CHOICES.map((f) => ({ value: f, label: f + " frames per second" })), opts.fps, (v) => { opts.fps = +v; refresh(); })));
      }
      if (opts.format === "gif") {
        settings.appendChild(GAS.ui.toggle("Loop forever", opts.loop, (v) => { opts.loop = v; refresh(); }));
        settings.appendChild(GAS.ui.toggle("Smooth gradients (dithering)", opts.dither, (v) => { opts.dither = v; }));
      }
      if (opts.format === "video") {
        settings.appendChild(row("Play it", GAS.ui.select([1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 1 ? "Once" : n + " times in a row" })), opts.repeats, (v) => { opts.repeats = +v; refresh(); })));
        const hasSound = p.frames.some((f) => f.sound);
        settings.appendChild(GAS.ui.toggle(hasSound ? "Include my sounds" : "Include sounds (no sounds added yet)", opts.sound && hasSound, (v) => { opts.sound = v; }, !hasSound));
      }
      if (opts.format === "gif" || opts.format === "png" || opts.format === "sprite") {
        settings.appendChild(GAS.ui.toggle("See-through background", opts.transparent, (v) => { opts.transparent = v; refresh(); }));
      }
      if (opts.format === "png") {
        settings.appendChild(GAS.ui.toggle("Put all frames in one ZIP file", opts.zip, (v) => { opts.zip = v; }));
      }
      if (opts.format === "sprite") {
        const L = sheetLayout(p, opts);
        const n = p.frames.length;
        settings.appendChild(row("Columns", GAS.ui.select(Array.from({ length: Math.min(n, 30) }, (_, i) => ({ value: i + 1, label: `${i + 1} across × ${Math.ceil(n / (i + 1))} down` })), L.cols, (v) => { opts.cols = +v; refresh(); })));
        settings.appendChild(row("Spacing", GAS.ui.select([0, 1, 2, 4, 8, 16, 32].map((s) => ({ value: s, label: s ? s + " px between frames" : "No gaps" })), opts.spacing, (v) => { opts.spacing = +v; refresh(); })));
      }
      // Summary line
      const secs = GAS.anim.duration(p, opts.fps);
      const fmt = {
        gif: `${p.frames.length} frame${p.frames.length === 1 ? "" : "s"} · ${w} × ${hh} · ${secs.toFixed(1)} s${opts.loop ? " · loops" : ""}`,
        video: `${w - (w % 2)} × ${hh - (hh % 2)} · ${(secs * opts.repeats).toFixed(1)} s. Recording plays in real time, so keep this window open.`,
        png: `${p.frames.length} PNG picture${p.frames.length === 1 ? "" : "s"} · ${w} × ${hh}`,
        sprite: (() => { const L = sheetLayout(p, opts); return `One picture · ${L.W} × ${L.H} · ${L.cols} × ${L.rows} frames of ${L.fw} × ${L.fh}`; })(),
      };
      info.textContent = fmt[opts.format];
      if (opts.format === "gif" && p.frames.length * w * hh > 80e6) info.textContent += " · This is a big one! A smaller size will be faster.";
      restartPreview();
    }

    let working = false, cancelFlag = false;
    const m = GAS.ui.modal({
      title: "Share your animation",
      icon: "export",
      wide: true,
      className: "export-modal",
      body: h("div", { class: "export-layout" },
        h("div", { class: "export-left" }, h("div", { class: "format-grid" }, formatBtns), settings),
        h("div", { class: "export-right" }, previewBox, info, progressWrap)),
      actions: [
        { label: "Close", kind: "ghost", onClick: () => { if (working) { cancelFlag = true; return false; } return true; } },
        { label: "Export!", kind: "primary", icon: "download", onClick: () => { run(); return false; } },
      ],
      onClose: () => { if (player) player.stop(); cancelFlag = true; },
    });

    async function run() {
      if (working) return;
      working = true;
      cancelFlag = false;
      const bar = progressWrap.querySelector(".progress-bar"), lbl = progressWrap.querySelector(".export-progress-label");
      progressWrap.hidden = false;
      m.el.classList.add("is-working");
      const progress = (f, text) => { bar.style.width = Math.round(clamp(f, 0, 1) * 100) + "%"; if (text) lbl.textContent = text; };
      progress(0, "Getting ready…");
      try {
        await GAS.render.whenReady(p);
        let result;
        if (opts.format === "gif") result = await exportGif(p, opts, progress);
        else if (opts.format === "video") result = await exportVideo(p, opts, progress, () => cancelFlag);
        else if (opts.format === "png") result = await exportPngs(p, opts, progress);
        else result = await exportSprite(p, opts, progress);
        if (!result) { lbl.textContent = "Stopped."; return; }
        progress(1, "Done! 🎉");
        if (result.many) {
          for (const f of result.many) { GAS.downloadBlob(f.blob, f.name); await GAS.wait(300); }
          GAS.ui.toast(`Downloaded ${result.many.length} pictures!`);
        } else {
          GAS.downloadBlob(result.blob, result.name);
          GAS.ui.toast("Your " + (opts.format === "gif" ? "GIF" : opts.format === "video" ? "video" : "file") + " is in your Downloads folder! 🎉 (" + GAS.fmtBytes(result.blob.size) + ")");
        }
        GAS.ui.celebrate();
      } catch (err) {
        console.error(err);
        lbl.textContent = "Oops: " + (err.message || "something went wrong");
        bar.style.width = "0%";
      } finally {
        working = false;
        m.el.classList.remove("is-working");
      }
    }

    requestAnimationFrame(refresh);
  }

  GAS.exporter = { open, exportGif, exportVideo, exportPngs, exportSprite, renderSheet, canVideo, FORMATS };
})();
