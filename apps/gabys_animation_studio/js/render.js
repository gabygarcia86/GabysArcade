/* Rendering of finished frames: background fill, background painting, drawing layer and
 * objects (stickers, images, text, effects). Used by the editor, thumbnails, onion skins,
 * playback and every export, so what you see is exactly what you export. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { model } = GAS;

  const FONTS = [
    { id: "Fredoka", label: "Bubbly", css: '"Fredoka", "Trebuchet MS", sans-serif' },
    { id: "Bangers", label: "Comic Book", css: '"Bangers", Impact, sans-serif' },
    { id: "Pacifico", label: "Swirly", css: '"Pacifico", "Brush Script MT", cursive' },
    { id: "Permanent Marker", label: "Marker", css: '"Permanent Marker", "Comic Sans MS", cursive' },
    { id: "Patrick Hand", label: "Handwriting", css: '"Patrick Hand", "Comic Sans MS", cursive' },
    { id: "Comic", label: "Comic", css: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive' },
    { id: "Serif", label: "Storybook", css: 'Georgia, "Times New Roman", serif' },
    { id: "Mono", label: "Typewriter", css: '"Courier New", Courier, monospace' },
  ];
  const fontCss = (id) => (FONTS.find((f) => f.id === id) || FONTS[0]).css;

  /* ---------- backgrounds ---------- */
  const BG_PRESETS = [
    { id: "white", label: "White", fill: { type: "color", color: "#ffffff" } },
    { id: "black", label: "Black", fill: { type: "color", color: "#111018" } },
    { id: "transparent", label: "See-through", fill: { type: "transparent" } },
    { id: "sky", label: "Sky", fill: { type: "gradient", color: "#7ec8ff", color2: "#e8f7ff", angle: 180 } },
    { id: "sunset", label: "Sunset", fill: { type: "gradient", color: "#ff7eb3", color2: "#ffd36e", angle: 180 } },
    { id: "space", label: "Space", fill: { type: "gradient", color: "#0b0b2b", color2: "#3a1c71", angle: 180 } },
    { id: "ocean", label: "Ocean", fill: { type: "gradient", color: "#48cae4", color2: "#023e8a", angle: 180 } },
    { id: "meadow", label: "Meadow", fill: { type: "gradient", color: "#c7f9cc", color2: "#57cc99", angle: 180 } },
    { id: "bubblegum", label: "Bubblegum", fill: { type: "gradient", color: "#ffd6ff", color2: "#bbd0ff", angle: 135, radial: true } },
    { id: "checker", label: "Checkers", fill: { type: "checker", color: "#ffffff", color2: "#ffe0ef", size: 32 } },
    { id: "grid", label: "Grid paper", fill: { type: "grid", color: "#ffffff", color2: "#b8d8f8", size: 24 } },
    { id: "lined", label: "Lined paper", fill: { type: "lined", color: "#fffdf2", color2: "#9cc3ef", size: 28 } },
  ];

  function drawBgFill(ctx, fill, w, h, project) {
    if (!fill) return;
    switch (fill.type) {
      case "transparent":
        return;
      case "color":
        ctx.fillStyle = fill.color || "#fff";
        ctx.fillRect(0, 0, w, h);
        return;
      case "gradient": {
        let g;
        if (fill.radial) {
          g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
        } else {
          const a = ((fill.angle ?? 180) - 90) * (Math.PI / 180);
          const len = (Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h) / 2;
          const cx = w / 2, cy = h / 2;
          g = ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        }
        g.addColorStop(0, fill.color || "#fff");
        g.addColorStop(1, fill.color2 || "#000");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        return;
      }
      case "checker": {
        const s = Math.max(4, fill.size || 32);
        ctx.fillStyle = fill.color || "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = fill.color2 || "#ddd";
        for (let y = 0; y < h; y += s) for (let x = ((y / s) % 2) * s; x < w; x += s * 2) ctx.fillRect(x, y, s, s);
        return;
      }
      case "grid": {
        const s = Math.max(4, fill.size || 24);
        ctx.fillStyle = fill.color || "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = fill.color2 || "#b8d8f8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = s; x < w; x += s) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
        for (let y = s; y < h; y += s) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
        ctx.stroke();
        return;
      }
      case "lined": {
        const s = Math.max(8, fill.size || 28);
        ctx.fillStyle = fill.color || "#fffdf2";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = fill.color2 || "#9cc3ef";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let y = s * 2; y < h; y += s) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
        ctx.strokeStyle = "#ff8fa3";
        ctx.beginPath();
        ctx.moveTo(Math.round(w * 0.1) + 0.5, 0);
        ctx.lineTo(Math.round(w * 0.1) + 0.5, h);
        ctx.stroke();
        return;
      }
      case "image": {
        ctx.fillStyle = fill.color || "#fff";
        ctx.fillRect(0, 0, w, h);
        const asset = project && project.assets.images[fill.imageId];
        const img = asset && asset.img;
        if (!img || !img.complete || !img.naturalWidth) return;
        const iw = img.naturalWidth, ih = img.naturalHeight;
        let dw = w, dh = h;
        if (fill.fit !== "stretch") {
          const s = fill.fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
          dw = iw * s; dh = ih * s;
        }
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return;
      }
    }
  }

  /* ---------- text ---------- */
  const measureCtx = GAS.makeCanvas(4, 4).getContext("2d");
  const textFont = (o) => `${o.italic ? "italic " : ""}${o.bold ? "bold " : ""}${Math.max(4, o.size)}px ${fontCss(o.font)}`;

  function layoutText(o) {
    measureCtx.font = textFont(o);
    const lines = String(o.text || " ").split("\n");
    const widths = lines.map((l) => measureCtx.measureText(l || " ").width);
    const lineH = o.size * 1.25;
    const pad = Math.max(4, (o.outline ? o.outlineWidth || 6 : 0) + o.size * 0.12);
    return { lines, widths, lineH, pad, w: Math.max(...widths) + pad * 2, h: lines.length * lineH + pad * 2 };
  }
  /* Recalculate a text object's box after its text or style changes. */
  function fitText(o) {
    const L = layoutText(o);
    o.w = L.w;
    o.h = L.h;
  }

  function drawText(ctx, o) {
    const L = layoutText(o);
    // The box can be stretched by older versions; scale to it so handles always match.
    const sx = o.w / L.w || 1, sy = o.h / L.h || 1;
    ctx.scale(sx, sy);
    ctx.font = textFont(o);
    ctx.textBaseline = "middle";
    ctx.textAlign = o.align === "left" ? "left" : o.align === "right" ? "right" : "center";
    const x = o.align === "left" ? -L.w / 2 + L.pad : o.align === "right" ? L.w / 2 - L.pad : 0;
    const top = -L.h / 2 + L.pad + L.lineH / 2;
    ctx.lineJoin = "round";
    L.lines.forEach((line, i) => {
      const y = top + i * L.lineH;
      if (o.shadow) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = o.size * 0.12;
        ctx.shadowOffsetX = o.size * 0.06;
        ctx.shadowOffsetY = o.size * 0.08;
        ctx.fillStyle = o.color;
        ctx.fillText(line, x, y);
        ctx.restore();
      }
      if (o.outline) {
        ctx.strokeStyle = o.outlineColor || "#fff";
        ctx.lineWidth = (o.outlineWidth || 6) * 2;
        ctx.strokeText(line, x, y);
      }
      ctx.fillStyle = o.color;
      ctx.fillText(line, x, y);
    });
  }

  /* ---------- objects ---------- */
  function drawObject(ctx, o, project) {
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flipX || o.flipY) ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
    ctx.globalAlpha *= o.opacity ?? 1;
    switch (o.type) {
      case "sticker": {
        const img = GAS.stickers.get(o.key);
        if (img) ctx.drawImage(img, -o.w / 2, -o.h / 2, o.w, o.h);
        break;
      }
      case "image": {
        const a = project && project.assets.images[o.assetId];
        if (a && a.img && a.img.complete && a.img.naturalWidth) ctx.drawImage(a.img, -o.w / 2, -o.h / 2, o.w, o.h);
        break;
      }
      case "text":
        drawText(ctx, o);
        break;
      case "effect":
        GAS.effects.draw(ctx, o);
        break;
    }
    ctx.restore();
  }

  /* Draws a whole frame. opts: {bg: false} skips the background, {objects: false} skips objects,
   * {scale} draws at another size, {exclude: objectId} hides one object. */
  function renderFrame(ctx, project, frame, opts = {}) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (opts.scale && opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
    if (opts.bg !== false) {
      drawBgFill(ctx, model.frameBgFill(project, frame), project.width, project.height, project);
      const bl = model.frameBgLayer(project, frame);
      if (bl && !bl.empty) ctx.drawImage(bl.canvas, 0, 0);
    }
    if (!frame.draw.empty) ctx.drawImage(frame.draw.canvas, 0, 0);
    if (opts.objects !== false) {
      for (const o of frame.objects) if (o.id !== opts.exclude) drawObject(ctx, o, project);
    }
    ctx.restore();
  }

  /* Image keys the frame needs before it can be drawn completely. */
  function stickerKeys(project) {
    const keys = new Set();
    for (const f of project.frames) for (const o of f.objects) if (o.type === "sticker") keys.add(o.key);
    return [...keys];
  }
  async function whenReady(project) {
    await GAS.stickers.ready(stickerKeys(project));
    const imgs = Object.values(project.assets.images).map((a) =>
      a.img && !a.img.complete ? new Promise((r) => { a.img.onload = a.img.onerror = r; }) : null);
    await Promise.all(imgs);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  }

  GAS.render = { FONTS, fontCss, BG_PRESETS, drawBgFill, layoutText, fitText, textFont, drawObject, renderFrame, whenReady };
})();
