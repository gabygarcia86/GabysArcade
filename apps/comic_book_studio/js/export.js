/* Export: PDF (hand-written writer, JPEG pages), PNG / JPEG / WEBP images (ZIP for several), project file. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, clear, clamp, prefs } = CBS;
  const doc = () => CBS.doc;
  const ui = () => CBS.ui;

  const MAX_SIDE = 10000;
  const PAPER = { exact: null, letter: [612, 792], a4: [595.28, 841.89] };

  /* ---------- PDF writer ---------- */
  function pdfString(s) {
    s = String(s || "");
    if (/^[\x20-\x7e]*$/.test(s)) return "(" + s.replace(/[\\()]/g, (c) => "\\" + c) + ")";
    let hex = "FEFF";
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp > 0xffff) { const v = cp - 0x10000; hex += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0"); }
      else hex += cp.toString(16).padStart(4, "0");
    }
    return "<" + hex.toUpperCase() + ">";
  }
  /* pages: [{ jpeg: Uint8Array, pxW, pxH, ptW, ptH, x, y, w, h }] */
  function buildPDF(pages, info) {
    const enc = new TextEncoder();
    const chunks = [];
    let offset = 0;
    const offsets = [];
    const push = (data) => { const b = typeof data === "string" ? enc.encode(data) : data; chunks.push(b); offset += b.length; };
    const obj = (n, body) => { offsets[n] = offset; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".replace(/[\u0080-ÿ]/g, (c) => c)); // binary marker comment
    const n = pages.length;
    const pageObj = (i) => 4 + i * 3, contentObj = (i) => 5 + i * 3, imageObj = (i) => 6 + i * 3;
    obj(1, () => push("<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>"));
    obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => pageObj(i) + " 0 R").join(" ")}] >>`));
    const now = new Date();
    const pad = (v) => String(v).padStart(2, "0");
    const date = `D:${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    obj(3, () => push(`<< /Title ${pdfString(info.title)} /Author ${pdfString(info.author)} /Subject ${pdfString(info.subject || "")} /Creator (Comic Book Studio) /Producer (Comic Book Studio) /CreationDate (${date}) >>`));
    pages.forEach((p, i) => {
      obj(pageObj(i), () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.ptW.toFixed(2)} ${p.ptH.toFixed(2)}] /Resources << /XObject << /Im${i} ${imageObj(i)} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentObj(i)} 0 R >>`));
      const stream = `q\n${p.w.toFixed(3)} 0 0 ${p.h.toFixed(3)} ${p.x.toFixed(3)} ${p.y.toFixed(3)} cm\n/Im${i} Do\nQ\n`;
      obj(contentObj(i), () => { push(`<< /Length ${enc.encode(stream).length} >>\nstream\n`); push(stream); push("endstream"); });
      obj(imageObj(i), () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
        push(p.jpeg);
        push("\nendstream");
      });
    });
    const total = 4 + n * 3;
    const xref = offset;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    push(x);
    push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: "application/pdf" });
  }

  /* ---------- rendering ---------- */
  function scaleFor(dpi) {
    const s = doc().size;
    let k = dpi / CBS.DOC_DPI;
    const big = Math.max(s.w, s.h) * k;
    if (big > MAX_SIDE) k = MAX_SIDE / Math.max(s.w, s.h);
    return k;
  }
  async function renderPage(pg, dpi, opts = {}) {
    await CBS.assets.ensureLoaded([pg]);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return CBS.render.pageCanvas(pg, scaleFor(dpi), { transparent: !!opts.transparent });
  }

  function pdfLayout(pxW, pxH, paper, orient) {
    const s = doc().size;
    if (paper === "exact" || !PAPER[paper]) {
      const ptW = (s.w / CBS.DOC_DPI) * 72, ptH = (s.h / CBS.DOC_DPI) * 72;
      return { ptW, ptH, x: 0, y: 0, w: ptW, h: ptH };
    }
    let [pw, ph] = PAPER[paper];
    const landscape = orient === "landscape" || (orient === "auto" && s.w > s.h);
    if (landscape) [pw, ph] = [ph, pw];
    const m = 18;
    const k = Math.min((pw - 2 * m) / pxW, (ph - 2 * m) / pxH);
    const w = pxW * k, hh = pxH * k;
    return { ptW: pw, ptH: ph, x: (pw - w) / 2, y: (ph - hh) / 2, w, h: hh };
  }

  async function run(cfg, progress) {
    const p = doc().project;
    const pages = cfg.pages.map((i) => p.pages[i]).filter(Boolean);
    if (!pages.length) throw new Error("Choose at least one page to export.");
    const base = CBS.safeFilename(p.title);
    if (cfg.format === "pdf") {
      const out = [];
      for (let i = 0; i < pages.length; i++) {
        progress(`Rendering page ${i + 1} of ${pages.length}…`, i / pages.length);
        await CBS.nextFrame();
        const c = await renderPage(pages[i], cfg.dpi);
        const blob = await CBS.canvasToBlob(c, "image/jpeg", cfg.quality);
        const jpeg = new Uint8Array(await blob.arrayBuffer());
        out.push(Object.assign({ jpeg, pxW: c.width, pxH: c.height }, pdfLayout(c.width, c.height, cfg.paper, cfg.orient)));
      }
      progress("Building PDF…", 0.98);
      const pdf = buildPDF(out, { title: p.title, author: p.author, subject: p.description });
      CBS.downloadBlob(pdf, base + ".pdf");
      return `Saved ${base}.pdf (${pages.length} page${pages.length > 1 ? "s" : ""})`;
    }
    const mime = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" }[cfg.format];
    const ext = cfg.format === "jpeg" ? "jpg" : cfg.format;
    const files = [];
    for (let i = 0; i < pages.length; i++) {
      progress(`Rendering page ${i + 1} of ${pages.length}…`, i / pages.length);
      await CBS.nextFrame();
      const transparent = cfg.transparent && cfg.format !== "jpeg";
      const c = await renderPage(pages[i], cfg.dpi, { transparent });
      const blob = await CBS.canvasToBlob(c, mime, cfg.quality);
      if (cfg.format === "webp" && blob.type !== "image/webp") throw new Error("This browser can't save WEBP images. Try PNG or JPEG.");
      const pg = pages[i];
      const name = pg.isCover ? `${base} - cover.${ext}` : `${base} - page ${String(CBS.pagesPanel.label(pg)).padStart(2, "0")}.${ext}`;
      files.push({ name, data: blob });
    }
    if (files.length === 1) { CBS.downloadBlob(files[0].data, files[0].name); return "Saved " + files[0].name; }
    progress("Packing a ZIP file…", 0.98);
    const zip = await CBS.makeZip(files);
    CBS.downloadBlob(zip, `${base} - ${cfg.format.toUpperCase()} pages.zip`);
    return `Saved ${files.length} images in a ZIP file`;
  }

  /* ---------- dialog ---------- */
  function open(initial = {}) {
    const p = doc().project;
    if (!p) return;
    CBS.editor.stopEditing();
    const cover = p.pages.find((pg) => pg.isCover);
    const cfg = {
      format: initial.format || prefs.get("exportFormat", "pdf"), dpi: prefs.get("exportDpi", 300), quality: prefs.get("exportQuality", 0.92),
      transparent: false, paper: prefs.get("exportPaper", "exact"), orient: "auto", pages: [],
    };
    const includeCover = p.settings.includeCover !== false;
    const selected = new Set(p.pages.map((pg, i) => i).filter((i) => !p.pages[i].isCover || includeCover));
    if (initial.current) { selected.clear(); selected.add(doc().pageIndex); }

    const formats = [
      ["pdf", "📕", "PDF", "The whole comic in one file. Great for printing and sharing"],
      ["png", "🖼️", "PNG", "Sharp images. Supports transparent backgrounds"],
      ["jpeg", "📷", "JPEG", "Smaller images for the web and email"],
      ["webp", "🌐", "WEBP", "Modern, small images for websites"],
      ["project", "💾", "Project file", "An editable copy you can open again later"],
    ];
    const fmtRow = h("div", { class: "fmt-cards" });
    const optsBox = h("div", { class: "exp-opts" });
    const pageGrid = h("div", { class: "exp-pages" });
    const rangeIn = h("input", { class: "input", placeholder: "e.g. 1-3, 5", "aria-label": "Page range" });
    const previewBox = h("div", { class: "exp-preview" });
    const sizeInfo = h("div", { class: "hint" });

    const drawFormats = () => {
      clear(fmtRow);
      for (const [k, icon, label, tip] of formats) fmtRow.append(h("button", { class: "fmt-card" + (cfg.format === k ? " on" : ""), onclick: () => { cfg.format = k; drawFormats(); drawOpts(); preview(); } }, h("span", { class: "fc-ico" }, icon), h("b", null, label), h("small", null, tip)));
    };
    const drawOpts = () => {
      clear(optsBox);
      if (cfg.format === "project") {
        optsBox.append(h("p", { class: "hint" }, "Downloads a .comic.json file with every page, layer, drawing and imported picture. Open it later with File › Import project file, on any computer."));
        pageGrid.parentElement && (pageGrid.parentElement.hidden = true);
        return;
      }
      pageGrid.parentElement && (pageGrid.parentElement.hidden = false);
      const dpiSel = ui().select([["72", "72 DPI · screen"], ["150", "150 DPI · good"], ["300", "300 DPI · print"], ["600", "600 DPI · high-end print"]], String(cfg.dpi), (v) => { cfg.dpi = parseInt(v, 10); updateSize(); });
      optsBox.append(ui().field("Resolution", dpiSel), sizeInfo);
      if (cfg.format !== "png") optsBox.append(ui().slider({ label: "Quality", min: 50, max: 100, value: Math.round(cfg.quality * 100), unit: "%", onInput: (v) => (cfg.quality = v / 100), onCommit: () => preview() }));
      if (cfg.format === "png" || cfg.format === "webp") optsBox.append(ui().toggle("Transparent background", cfg.transparent, (v) => { cfg.transparent = v; preview(); }, { tip: "Leaves the page color out, so only your artwork is saved" }));
      if (cfg.format === "pdf") {
        optsBox.append(
          ui().field("Paper", ui().select([["exact", "Same size as the comic page"], ["letter", "US Letter"], ["a4", "A4"]], cfg.paper, (v) => { cfg.paper = v; orientField.hidden = v === "exact"; })),
        );
        const orientField = ui().field("Orientation", ui().segmented([["auto", "Auto"], ["portrait", "Portrait"], ["landscape", "Landscape"]], cfg.orient, (v) => (cfg.orient = v), { small: true }));
        orientField.hidden = cfg.paper === "exact";
        optsBox.append(orientField);
      }
      updateSize();
    };
    const updateSize = () => {
      const s = doc().size, k = scaleFor(cfg.dpi);
      sizeInfo.textContent = `Each page: ${Math.round(s.w * k)} × ${Math.round(s.h * k)} pixels (${(s.w / 100).toFixed(2)} × ${(s.h / 100).toFixed(2)} in)`;
    };
    const drawPages = () => {
      clear(pageGrid);
      p.pages.forEach((pg, i) => {
        const c = CBS.render.pageCanvas(pg, 90 / doc().size.h);
        const lab = pg.isCover ? "Cover" : "Page " + CBS.pagesPanel.label(pg);
        const b = h("button", { class: "exp-page" + (selected.has(i) ? " on" : ""), "aria-pressed": String(selected.has(i)), "aria-label": lab, onclick: () => { if (selected.has(i)) selected.delete(i); else selected.add(i); drawPages(); preview(); } }, c, h("span", null, lab));
        pageGrid.append(b);
      });
    };
    let pvTimer = 0;
    const preview = () => {
      clearTimeout(pvTimer);
      pvTimer = setTimeout(async () => {
        clear(previewBox);
        if (cfg.format === "project") { previewBox.append(h("div", { class: "pv-ph" }, "💾")); return; }
        const first = [...selected].sort((a, b) => a - b)[0];
        if (first == null) { previewBox.append(h("div", { class: "pv-ph" }, "No pages chosen")); return; }
        const pg = p.pages[first];
        await CBS.assets.ensureLoaded([pg]);
        const transparent = cfg.transparent && cfg.format !== "jpeg" && cfg.format !== "pdf";
        const c = CBS.render.pageCanvas(pg, 320 / doc().size.h, { transparent });
        let shown = c;
        if (cfg.format === "jpeg" || cfg.format === "webp" || cfg.format === "pdf") {
          const url = c.toDataURL(cfg.format === "webp" ? "image/webp" : "image/jpeg", cfg.quality);
          shown = h("img", { src: url, alt: "Export preview" });
        }
        previewBox.append(h("div", { class: "pv-frame" + (transparent ? " checker" : "") }, shown), h("small", null, `Preview: ${pg.isCover ? "cover" : "page " + CBS.pagesPanel.label(pg)}${selected.size > 1 ? ` (+${selected.size - 1} more)` : ""}`));
      }, 120);
    };
    rangeIn.addEventListener("change", () => {
      const r = CBS.parseRange(rangeIn.value, p.pages.length);
      if (!r) { ui().toast("Use page numbers like 1-3, 5 (count the cover as page 1 if you have one)."); return; }
      selected.clear(); r.forEach((i) => selected.add(i));
      drawPages(); preview();
    });
    const quick = h("div", { class: "btn-row" },
      ui().button("All", () => { p.pages.forEach((_, i) => selected.add(i)); drawPages(); preview(); }, { small: true }),
      ui().button("None", () => { selected.clear(); drawPages(); preview(); }, { small: true }),
      ui().button("This page", () => { selected.clear(); selected.add(doc().pageIndex); drawPages(); preview(); }, { small: true }),
      cover ? ui().button("Cover only", () => { selected.clear(); selected.add(p.pages.indexOf(cover)); drawPages(); preview(); }, { small: true }) : null,
      rangeIn);
    const body = h("div", { class: "export" },
      fmtRow,
      h("div", { class: "exp-main" },
        h("div", { class: "exp-left" }, optsBox, h("div", { class: "exp-pages-wrap" }, h("div", { class: "psec-title" }, "Pages to export"), quick, pageGrid)),
        previewBox));
    drawFormats(); drawPages(); drawOpts(); preview();
    const d = ui().dialog({
      title: "⬇️ Export comic", wide: true, className: "export-dlg", body,
      buttons: [{ label: "Cancel", value: null }, {
        label: "Export", kind: "primary big", value: "go",
        onClick: () => { if (cfg.format !== "project" && !selected.size) { ui().toast("Choose at least one page."); return false; } },
      }],
    });
    d.promise.then(async (v) => {
      if (v !== "go") return;
      prefs.set("exportFormat", cfg.format); prefs.set("exportDpi", cfg.dpi); prefs.set("exportQuality", cfg.quality); prefs.set("exportPaper", cfg.paper);
      if (cfg.format === "project") { CBS.projects.exportFile(); return; }
      cfg.pages = [...selected].sort((a, b) => a - b);
      const busy = ui().busy("Getting ready…");
      try {
        const msg = await run(cfg, (m, f) => busy.set(m, f));
        ui().toast(msg + " 🎉", { kind: "ok", ms: 4000 });
      } catch (e) {
        console.error(e);
        ui().toast("Export failed: " + (e.message || e), { kind: "error" });
      } finally { busy.done(); }
    });
  }

  CBS.exporter = { open, run, buildPDF, renderPage };
})();
