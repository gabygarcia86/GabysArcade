/* Comic covers: templates, cover page creation, and the cover details form.
 * Text objects on a cover can carry `bind`, a template like "No. {issue}". Editing the cover details
 * rewrites every bound object, so the title, issue number and credits stay in sync. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus } = CBS;
  const doc = () => CBS.doc;

  const FIELDS = [
    ["title", "Comic title"], ["subtitle", "Subtitle / tagline"], ["issue", "Issue number"], ["volume", "Volume"],
    ["author", "Written by"], ["artist", "Art by"], ["publisher", "Publisher"], ["price", "Price"],
  ];
  const fill = (tpl, info) => tpl.replace(/\{(\w+)\}/g, (m, k) => (info[k] != null ? info[k] : ""));

  /* Each template returns { background, items: [[layerType, kind, props]] } for a W x H page. */
  const TEMPLATES = {
    classic: {
      name: "Classic Superhero",
      build(W, H) {
        const m = W * 0.045;
        return {
          background: "#ffd23f",
          items: [
            ["panel", "panel", { bind: "art", x: m, y: H * 0.24, w: W - 2 * m, h: H * 0.62, borderWidth: 6, fill: "#7dd3fc" }],
            ["text", "sfx", { bind: "{title}", x: m, y: H * 0.055, w: W - 2 * m, h: H * 0.17, font: "Bangers", fill: "#ff3b3b", fill2: "#ffd23f", gradient: true, outlineColor: "#111111", outlineWidth: 6, extrude: 9, extrudeAngle: 135, extrudeColor: "#1e3a8a", shadow: true, distort: "arcUp", distortAmount: 0.35, skew: -6 }],
            ["effects", "shape", { x: W - m - W * 0.2, y: m * 0.6, w: W * 0.2, h: W * 0.13, shape: "rect", fill: "#ffffff", fillOn: true, stroke: "#111111", strokeWidth: 3 }],
            ["text", "text", { bind: "No. {issue}", x: W - m - W * 0.2, y: m * 0.6 + W * 0.02, w: W * 0.2, h: 30, font: "Bangers", fontSize: W * 0.05, align: "center", color: "#111111" }],
            ["text", "text", { bind: "{price}", x: W - m - W * 0.2, y: m * 0.6 + W * 0.075, w: W * 0.2, h: 20, font: "Comic Neue", fontSize: W * 0.026, bold: true, align: "center", color: "#111111" }],
            ["text", "text", { bind: "{publisher}", x: m, y: m * 0.5, w: W * 0.5, h: 20, font: "Bungee", fontSize: W * 0.025, align: "left", color: "#111111", uppercase: true }],
            ["bubble", "bubble", { bind: "{subtitle}", type: "narration", x: m * 1.6, y: H * 0.79, w: W * 0.55, h: H * 0.06, fill: "#fff3a8", tailOn: false, align: "left", fontSize: W * 0.03 }],
            ["text", "text", { bind: "WRITTEN BY {author} · ART BY {artist}", x: m, y: H * 0.9, w: W - 2 * m, h: 24, font: "Comic Neue", fontSize: W * 0.025, bold: true, align: "center", color: "#111111", uppercase: true }],
          ],
        };
      },
    },
    manga: {
      name: "Manga Volume",
      build(W, H) {
        return {
          background: "#ffffff",
          items: [
            ["panel", "panel", { bind: "art", x: 0, y: H * 0.2, w: W, h: H * 0.68, borderWidth: 0, fill: "#fbcfe8" }],
            ["effects", "shape", { x: 0, y: 0, w: W, h: H * 0.2, shape: "rect", fill: "#e11d48", fillOn: true, strokeWidth: 0 }],
            ["text", "text", { bind: "{title}", x: W * 0.05, y: H * 0.035, w: W * 0.7, h: 60, font: "Bungee", fontSize: W * 0.085, color: "#ffffff", uppercase: true, lineHeight: 1 }],
            ["text", "text", { bind: "{subtitle}", x: W * 0.05, y: H * 0.15, w: W * 0.7, h: 20, font: "Comic Neue", fontSize: W * 0.03, bold: true, color: "#ffe4e6" }],
            ["effects", "shape", { x: W * 0.77, y: H * 0.03, w: W * 0.19, h: W * 0.19, shape: "ellipse", fill: "#ffffff", fillOn: true, stroke: "#111111", strokeWidth: 3 }],
            ["text", "text", { bind: "{volume}", x: W * 0.77, y: H * 0.03 + W * 0.045, w: W * 0.19, h: 40, font: "Bungee", fontSize: W * 0.08, align: "center", color: "#e11d48" }],
            ["effects", "shape", { x: 0, y: H * 0.88, w: W, h: H * 0.12, shape: "rect", fill: "#111111", fillOn: true, strokeWidth: 0 }],
            ["text", "text", { bind: "{author}", x: W * 0.05, y: H * 0.905, w: W * 0.6, h: 24, font: "Comic Neue", fontSize: W * 0.035, bold: true, color: "#ffffff" }],
            ["text", "text", { bind: "{publisher}", x: W * 0.55, y: H * 0.915, w: W * 0.4, h: 20, font: "Comic Neue", fontSize: W * 0.024, align: "right", color: "#fda4af" }],
          ],
        };
      },
    },
    modern: {
      name: "Modern Minimal",
      build(W, H) {
        const m = W * 0.06;
        return {
          background: "#0f172a",
          items: [
            ["panel", "panel", { bind: "art", x: 0, y: 0, w: W, h: H, borderWidth: 0, fill: "#334155" }],
            ["text", "text", { bind: "#{issue} · {publisher}", x: m, y: m * 0.8, w: W - 2 * m, h: 20, font: "Fredoka", fontSize: W * 0.028, color: "#e2e8f0", uppercase: true, letterSpacing: 0.15 }],
            ["text", "text", { bind: "{title}", x: m, y: H * 0.7, w: W - 2 * m, h: 80, font: "Bungee", fontSize: W * 0.1, color: "#ffffff", outlineColor: "#0f172a", outlineWidth: 2, lineHeight: 1, uppercase: true }],
            ["text", "text", { bind: "{subtitle}", x: m, y: H * 0.86, w: W - 2 * m, h: 24, font: "Fredoka", fontSize: W * 0.034, color: "#facc15" }],
            ["text", "text", { bind: "{author} & {artist}", x: m, y: H * 0.92, w: W - 2 * m, h: 20, font: "Fredoka", fontSize: W * 0.026, color: "#cbd5e1" }],
          ],
        };
      },
    },
    golden: {
      name: "Golden Age Retro",
      build(W, H) {
        const m = W * 0.04;
        return {
          background: "#f5e6c4",
          items: [
            ["panel", "panel", { bind: "art", x: m, y: H * 0.22, w: W - 2 * m, h: H * 0.7, borderWidth: 5, fill: "#fca5a5", borderColor: "#3b1d0e" }],
            ["effects", "shape", { x: m, y: m, w: W - 2 * m, h: H * 0.19, shape: "rect", fill: "#c0392b", fillOn: true, stroke: "#3b1d0e", strokeWidth: 4 }],
            ["text", "sfx", { bind: "{title}", x: m * 2, y: m * 1.4, w: W - 4 * m, h: H * 0.15, font: "Luckiest Guy", fill: "#fff3b0", fill2: "#f59e0b", gradient: true, outlineColor: "#3b1d0e", outlineWidth: 5, extrude: 6, extrudeAngle: 120, extrudeColor: "#3b1d0e", shadow: false, distort: "arcUp", distortAmount: 0.5, skew: 0 }],
            ["effects", "shape", { x: W * 0.68, y: H * 0.18, w: W * 0.28, h: W * 0.28, shape: "burst", sides: 16, innerRatio: 0.72, fill: "#facc15", fillOn: true, stroke: "#3b1d0e", strokeWidth: 3, rot: 12 }],
            ["text", "text", { bind: "No. {issue}", x: W * 0.7, y: H * 0.18 + W * 0.1, w: W * 0.24, h: 30, font: "Bangers", fontSize: W * 0.05, align: "center", color: "#3b1d0e", rot: 12 }],
            ["text", "text", { bind: "{price}", x: m * 1.5, y: H * 0.235, w: W * 0.2, h: 20, font: "Special Elite", fontSize: W * 0.03, color: "#3b1d0e" }],
            ["bubble", "bubble", { bind: "{subtitle}", type: "narration", x: m * 2, y: H * 0.84, w: W * 0.6, h: H * 0.055, fill: "#fff3a8", tailOn: false, align: "left", fontSize: W * 0.028 }],
            ["text", "text", { bind: "{publisher} presents", x: m, y: H * 0.94, w: W - 2 * m, h: 20, font: "Special Elite", fontSize: W * 0.024, align: "center", color: "#3b1d0e", uppercase: true }],
          ],
        };
      },
    },
    horror: {
      name: "Spooky Horror",
      build(W, H) {
        const m = W * 0.05;
        return {
          background: "#12051f",
          items: [
            ["panel", "panel", { bind: "art", x: m, y: H * 0.2, w: W - 2 * m, h: H * 0.66, borderWidth: 4, borderColor: "#a3e635", fill: "#2e1065" }],
            ["text", "sfx", { bind: "{title}", x: m, y: H * 0.03, w: W - 2 * m, h: H * 0.16, font: "Creepster", fill: "#bef264", fill2: "#15803d", gradient: true, outlineColor: "#000000", outlineWidth: 4, extrude: 4, extrudeAngle: 90, extrudeColor: "#581c87", shadow: true, distort: "wave", distortAmount: 0.35, skew: 0 }],
            ["text", "text", { bind: "{subtitle}", x: m, y: H * 0.88, w: W - 2 * m, h: 24, font: "Creepster", fontSize: W * 0.05, align: "center", color: "#f87171" }],
            ["text", "text", { bind: "#{issue} · {publisher} · {price}", x: m, y: H * 0.95, w: W - 2 * m, h: 20, font: "Special Elite", fontSize: W * 0.024, align: "center", color: "#d8b4fe" }],
          ],
        };
      },
    },
    kids: {
      name: "Fun for Kids",
      build(W, H) {
        const m = W * 0.05;
        return {
          background: "#7dd3fc",
          items: [
            ["panel", "panel", { bind: "art", x: m, y: H * 0.23, w: W - 2 * m, h: H * 0.6, borderWidth: 6, radius: 40, fill: "#fef9c3", borderColor: "#1e3a8a" }],
            ["text", "sfx", { bind: "{title}", x: m, y: H * 0.04, w: W - 2 * m, h: H * 0.17, font: "Luckiest Guy", fill: "#ffffff", fill2: "#fde047", gradient: true, outlineColor: "#1e3a8a", outlineWidth: 6, extrude: 7, extrudeAngle: 120, extrudeColor: "#ec4899", shadow: true, distort: "bulge", distortAmount: 0.4, skew: 0 }],
            ["effects", "shape", { x: W * 0.7, y: H * 0.74, w: W * 0.26, h: W * 0.26, shape: "star", sides: 5, innerRatio: 0.5, fill: "#fde047", fillOn: true, stroke: "#1e3a8a", strokeWidth: 4, rot: -10 }],
            ["text", "text", { bind: "#{issue}", x: W * 0.72, y: H * 0.74 + W * 0.1, w: W * 0.22, h: 30, font: "Luckiest Guy", fontSize: W * 0.055, align: "center", color: "#1e3a8a", rot: -10 }],
            ["bubble", "bubble", { bind: "{subtitle}", type: "speech", x: m, y: H * 0.85, w: W * 0.62, h: H * 0.09, fontSize: W * 0.03, tail: { x: W * 0.1, y: -H * 0.07 }, tailOn: true }],
            ["text", "text", { bind: "by {author}", x: m, y: H * 0.955, w: W - 2 * m, h: 20, font: "Fredoka", fontSize: W * 0.027, align: "center", color: "#1e3a8a" }],
          ],
        };
      },
    },
  };

  /* Build cover objects into a page (replacing any existing ones). Keeps the cover art image. */
  function applyTemplate(page, templateId, project) {
    const t = TEMPLATES[templateId] || TEMPLATES.classic;
    const { w: W, h: H } = project.pageSize;
    const built = t.build(W, H);
    const artImages = [];
    for (const l of page.layers) for (const o of l.objects) if (o.kind === "image" && o.coverArt) artImages.push(o);
    for (const l of page.layers) if (l.type !== "drawing") l.objects = [];
    page.background = built.background;
    let artPanel = null;
    for (const [ltype, kind, props] of built.items) {
      const o = CBS.createObject(kind, props);
      if (kind === "bubble") { CBS.lettering.applyBubbleType(o, props.type || "speech"); Object.assign(o, props); }
      if (props.bind === "art") { artPanel = o; delete o.bind; o.coverArtPanel = true; }
      let layer = page.layers.find((l) => l.type === ltype);
      if (!layer) layer = doc().insertLayer(CBS.createLayer(ltype), page);
      layer.objects.push(o);
    }
    const imgLayer = page.layers.find((l) => l.type === "image") || doc().insertLayer(CBS.createLayer("image"), page);
    for (const img of artImages) {
      img.clip = artPanel ? artPanel.id : null;
      imgLayer.objects.push(img);
      if (artPanel) fitInto(img, artPanel);
    }
    project.cover.template = templateId;
    syncBindings(page, project.cover);
    return artPanel;
  }
  function fitInto(img, panel) {
    const a = CBS.assets.find(img.assetId);
    const iw = a ? a.w : img.w, ih = a ? a.h : img.h;
    const k = Math.max(panel.w / iw, panel.h / ih);
    img.w = iw * k; img.h = ih * k;
    img.x = panel.x + panel.w / 2 - img.w / 2; img.y = panel.y + panel.h / 2 - img.h / 2;
  }

  function syncBindings(page, info) {
    for (const l of page.layers) for (const o of l.objects) {
      if (!o.bind) continue;
      let text = fill(o.bind, info).replace(/\s+·\s+(·\s+)*$/g, "").replace(/^\s*·\s*/, "").replace(/\s*·\s*·\s*/g, " · ").trim();
      text = text.replace(/^(WRITTEN BY|by)\s*(·|&)?\s*$/i, "").replace(/\s*&\s*$/, "").replace(/^&\s*/, "");
      if (/^(No\.|#)\s*$/.test(text)) text = "";
      o.text = text;
      if (o.kind === "text") CBS.lettering.fitTextHeight(o);
    }
  }

  function createCoverPage(project, templateId) {
    const page = CBS.createPage({ isCover: true, name: "" });
    page.layers.find((l) => l.type === "drawing").name = "Cover drawing";
    applyTemplate(page, templateId, project);
    return page;
  }
  function coverPage() { const p = doc().project; return p ? p.pages.find((pg) => pg.isCover) || null : null; }
  function artPanelOf(page) {
    for (const l of page.layers) for (const o of l.objects) if (o.coverArtPanel) return o;
    return doc().panels(page)[0] || null;
  }

  function addCover() {
    const p = doc().project;
    if (coverPage()) { doc().setPage(coverPage().id); return; }
    const page = createCoverPage(p, p.cover.template || "classic");
    doc().edit("Add cover", () => p.pages.unshift(page), "doc");
    doc().setPage(page.id);
    bus.emit("pages:changed");
  }

  async function setCoverArt(asset) {
    const page = coverPage();
    if (!page) return;
    const panel = artPanelOf(page);
    const imgLayer = page.layers.find((l) => l.type === "image") || page.layers[0];
    const o = CBS.createObject("image", { assetId: asset.id, coverArt: true, clip: panel ? panel.id : null, x: 0, y: 0, w: asset.w, h: asset.h, name: "Cover art" });
    if (panel) fitInto(o, panel);
    doc().edit("Cover artwork", () => {
      for (const l of page.layers) l.objects = l.objects.filter((x) => !x.coverArt);
      imgLayer.objects.push(o);
    });
  }

  /* Cover details form (shown in the properties panel when the cover page is open). */
  function form() {
    const p = doc().project;
    const info = p.cover;
    const page = doc().page;
    let open = false;
    const inputs = FIELDS.map(([key, label]) => {
      const inp = h("input", { class: "input", value: info[key] || "", "aria-label": label, maxlength: 80 });
      inp.addEventListener("input", () => {
        if (!open) { CBS.history.begin("doc"); open = true; }
        info[key] = inp.value;
        if (key === "title" && (!p.title || p.title === "Untitled Comic" || p._titleFollowsCover)) { p.title = inp.value || "Untitled Comic"; p._titleFollowsCover = true; bus.emit("project:renamed"); }
        syncBindings(page, info);
        CBS.editor.requestRender();
      });
      inp.addEventListener("change", () => { if (open) { CBS.history.end("Cover details"); open = false; } doc().changed(); });
      return CBS.ui.field(label, inp);
    });
    const tplSel = CBS.ui.select(Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, t.name])), info.template || "classic", async (v) => {
      if (!(await CBS.ui.confirm("Switch cover design? The cover's text and shapes are rebuilt from your cover details. Your cover art stays. You can undo this.", { ok: "Switch design" }))) { tplSel.value = info.template; return; }
      doc().edit("Cover design", () => applyTemplate(page, v, p), "doc");
      bus.emit("layers:changed");
      bus.emit("pages:changed");
    });
    return h("div", { class: "psec cover-sec" },
      h("div", { class: "psec-title" }, "📕 Cover details"),
      CBS.ui.field("Cover design", tplSel),
      ...inputs,
      h("div", { class: "btn-row" },
        CBS.ui.button("Cover art…", async () => {
          const f = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg");
          if (!f) return;
          const [a] = await CBS.assets.importFiles([f], "characters");
          if (a) setCoverArt(a);
        }, { icon: "🖼️", tip: "Import the main cover illustration" }),
        CBS.ui.button("From library", () => CBS.library.open({ panel: artPanelOf(page), coverArt: true }), { icon: "🗂️" })),
      CBS.ui.toggle("Include the cover when exporting", p.settings.includeCover !== false, (v) => doc().edit("Cover export setting", () => (p.settings.includeCover = v), "doc")),
      h("p", { class: "hint" }, "Every cover element can be moved, restyled or deleted like anything else on a page."));
  }

  CBS.cover = { TEMPLATES, FIELDS, createCoverPage, applyTemplate, syncBindings, addCover, coverPage, setCoverArt, form, artPanelOf };
})();
