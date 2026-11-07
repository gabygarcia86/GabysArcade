/* Right sidebar: context-sensitive properties (tool options, page, cover, selected objects). */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clear, clamp } = CBS;
  const ui = () => CBS.ui;
  const doc = () => CBS.doc;
  const R = () => CBS.render;
  const E = () => CBS.editor;

  let root = null;
  const collapsed = new Set(CBS.prefs.get("collapsedSections", []));

  /* Live edit wrapper: one undo step per drag/typing session. */
  function live(objs, label, apply, after) {
    let open = false;
    const start = () => { if (!open) { CBS.history.begin("page"); open = true; } };
    return {
      onStart: start,
      onInput(v) { start(); objs.forEach((o) => apply(o, v)); if (after) objs.forEach(after); E().requestRender(); },
      onCommit(v) {
        if (v !== undefined) { start(); objs.forEach((o) => apply(o, v)); if (after) objs.forEach(after); }
        if (open) { CBS.history.end(label); open = false; }
        doc().changed();
      },
    };
  }
  function set(objs, label, key, after) { return live(objs, label, (o, v) => { o[key] = v; }, after); }
  function commit(label, fn) { doc().edit(label, fn); refresh(); }

  /* Common control builders bound to object keys */
  function sl(objs, key, label, min, max, o = {}) {
    const L = set(objs, label, key, o.after);
    return ui().slider({ label, min, max, step: o.step || 1, value: objs[0][key] ?? min, unit: o.unit, format: o.format, tip: o.tip, onStart: L.onStart, onInput: L.onInput, onCommit: L.onCommit, hardMax: o.hardMax, hardMin: o.hardMin });
  }
  function col(objs, key, label, o = {}) {
    const L = set(objs, label + " color", key, o.after);
    return ui().field(label, ui().colorButton(objs[0][key], (c, final) => { L.onInput(c); if (final) L.onCommit(); }, { label, allowNone: o.allowNone, onStart: L.onStart }), { inline: true });
  }
  function tog(objs, key, label, o = {}) {
    return ui().toggle(label, !!objs[0][key], (v) => { commit(label, () => objs.forEach((x) => { x[key] = v; if (o.after) o.after(x); })); }, { tip: o.tip });
  }
  function sel(objs, key, label, options, o = {}) {
    return ui().field(label, ui().select(options, objs[0][key], (v) => commit(label, () => objs.forEach((x) => { x[key] = o.number ? parseFloat(v) : v; if (o.after) o.after(x); }))));
  }
  function seg(objs, key, label, options, o = {}) {
    return ui().field(label, ui().segmented(options, objs[0][key], (v) => commit(label, () => objs.forEach((x) => { x[key] = v; if (o.after) o.after(x); })), { small: true }));
  }

  function section(id, title, ...children) {
    const isCol = collapsed.has(id);
    const body = h("div", { class: "psec-body", hidden: isCol });
    body.append(...children.flat().filter(Boolean));
    const head = h("button", {
      class: "psec-title clickable" + (isCol ? " collapsed" : ""), "aria-expanded": String(!isCol),
      onclick: () => {
        const c = !body.hidden;
        body.hidden = c;
        head.classList.toggle("collapsed", c);
        head.setAttribute("aria-expanded", String(!c));
        if (c) collapsed.add(id); else collapsed.delete(id);
        CBS.prefs.set("collapsedSections", [...collapsed]);
      },
    }, h("span", { class: "chev" }, "▾"), title);
    return h("div", { class: "psec" }, head, body);
  }

  /* ---------- page ---------- */
  function respacePanels(panels, starts, oldG, newG) {
    const d = (newG - oldG) / 2;
    panels.forEach((p, i) => Object.assign(p, starts[i]));
    const tol = 2.5;
    for (const a of panels) for (const b of panels) {
      if (a === b) continue;
      const sa = starts[panels.indexOf(a)], sb = starts[panels.indexOf(b)];
      const gx = sb.x - (sa.x + sa.w);
      if (Math.abs(gx - oldG) < tol && sa.y < sb.y + sb.h && sa.y + sa.h > sb.y) { a.w -= d; b.x += d; b.w -= d; }
      const gy = sb.y - (sa.y + sa.h);
      if (Math.abs(gy - oldG) < tol && sa.x < sb.x + sb.w && sa.x + sa.w > sb.x) { a.h -= d; b.y += d; b.h -= d; }
    }
  }
  function pageSection() {
    const page = doc().page, p = doc().project;
    const out = [];
    const nameIn = h("input", { class: "input", value: page.name || "", placeholder: page.isCover ? "Cover" : "Optional, e.g. “The chase”", "aria-label": "Page name" });
    nameIn.addEventListener("change", () => { commit("Rename page", () => (page.name = nameIn.value.trim())); bus.emit("pages:changed"); });
    const bgL = live([page], "Page color", (pg, v) => (pg.background = v));
    out.push(section("page", page.isCover ? "📕 Cover page" : "📄 Page " + CBS.pagesPanel.label(page),
      ui().field("Page name", nameIn),
      ui().field("Page color", ui().colorButton(page.background, (c, final) => { bgL.onInput(c); if (final) { bgL.onCommit(); bus.emit("pages:changed"); } }, { label: "Page color", onStart: bgL.onStart }), { inline: true }),
      h("div", { class: "btn-row" },
        ui().button("Layouts…", () => CBS.pagesPanel.layoutPicker(), { icon: "▦", tip: "Pick a panel layout for this page" }),
        ui().button("Save layout", async () => {
          if (!doc().panels().length) { ui().toast("Add some panels first."); return; }
          const name = await ui().prompt("Name your layout:", "My layout", { title: "Save custom layout" });
          if (name) { CBS.layouts.saveCustom(name, page, p); ui().toast("Saved! Find it under Custom in the layout picker."); }
        }, { icon: "💾", tip: "Save this page's panels as a reusable layout" }))));

    const panels = doc().panels();
    // panel spacing (gutters)
    let starts = null, oldG = p.settings.gutter;
    const gutter = ui().slider({
      label: "Spacing", min: 0, max: 60, value: p.settings.gutter, tip: "The gap (gutter) between panels",
      onStart() { CBS.history.begin("doc"); starts = panels.map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h })); oldG = p.settings.gutter; },
      onInput(v) { if (!starts) this.onStart(); respacePanels(panels.filter((x) => x.shape !== "poly" && !x.rot), starts.filter((s, i) => panels[i].shape !== "poly" && !panels[i].rot), oldG, v); p.settings.gutter = v; E().requestRender(); },
      onCommit() { starts = null; CBS.history.end("Panel spacing"); doc().changed(); bus.emit("pages:changed"); },
    });
    const margin = ui().slider({
      label: "Margin", min: 0, max: 120, value: p.settings.margin, tip: "Space around the edge of the page used by layouts",
      onStart() { CBS.history.begin("doc"); }, onInput(v) { p.settings.margin = v; E().requestRender(); }, onCommit() { CBS.history.end("Page margin"); doc().changed(); },
    });
    const extra = [];
    if (panels.length) {
      const bw = live(panels, "Panel borders", (o, v) => (o.borderWidth = v));
      const rad = live(panels.filter((x) => x.shape !== "poly"), "Panel corners", (o, v) => (o.radius = v));
      const bc = live(panels, "Panel border color", (o, v) => (o.borderColor = v));
      const fc = live(panels, "Panel color", (o, v) => (o.fill = v));
      extra.push(
        ui().slider({ label: "Borders", min: 0, max: 20, value: panels[0].borderWidth, onStart: bw.onStart, onInput: bw.onInput, onCommit: bw.onCommit, tip: "Border thickness for every panel on this page" }),
        ui().slider({ label: "Corners", min: 0, max: 60, value: panels[0].radius || 0, onStart: rad.onStart, onInput: rad.onInput, onCommit: rad.onCommit, tip: "Round the corners of every panel" }),
        h("div", { class: "frow" },
          ui().field("Border", ui().colorButton(panels[0].borderColor, (c, f) => { bc.onInput(c); if (f) bc.onCommit(); }, { onStart: bc.onStart, label: "Border color" }), { inline: true }),
          ui().field("Inside", ui().colorButton(panels[0].fill, (c, f) => { fc.onInput(c); if (f) fc.onCommit(); }, { onStart: fc.onStart, label: "Panel color", allowNone: true }), { inline: true })));
    }
    out.push(section("panels-all", `▦ Panels on this page (${panels.length})`, gutter, margin, extra,
      panels.length ? null : h("p", { class: "hint" }, "No panels yet. Pick a layout, or use the Panel tool (P) to draw your own.")));
    if (page.isCover && CBS.cover) out.unshift(CBS.cover.form());
    return out;
  }

  /* ---------- per-kind sections ---------- */
  function panelProps(objs) {
    const o = objs[0];
    const out = [
      sl(objs, "borderWidth", "Border", 0, 30),
      o.shape !== "poly" ? sl(objs, "radius", "Corners", 0, 80, { tip: "Round the panel corners" }) : null,
      h("div", { class: "frow" }, col(objs, "borderColor", "Border"), col(objs, "fill", "Inside", { allowNone: true })),
    ];
    if (objs.length === 1) {
      out.push(h("div", { class: "btn-row" },
        ui().button("Picture", () => CBS.actions.importIntoPanel(o), { icon: "🖼️", tip: "Import a picture clipped inside this panel" }),
        ui().button("Library", () => CBS.library.open({ panel: o }), { icon: "🗂️", tip: "Place art from the asset library in this panel" })));
      out.push(h("div", { class: "btn-row" },
        ui().button("Split ◫", () => CBS.actions.splitPanel(o, "v"), { tip: "Split into two panels side by side" }),
        ui().button("Split ⊟", () => CBS.actions.splitPanel(o, "h"), { tip: "Split into top and bottom panels" }),
        E().editPoints && E().editPoints.id === o.id
          ? ui().button("Done", () => { E().editPoints = null; refresh(); }, { kind: "primary" })
          : ui().button("Corners", () => CBS.actions.editPoints(o), { icon: "⬠", tip: "Drag the corners to make diagonal or custom shapes" })));
      if (o.shape === "poly") out.push(ui().button("Make it a rectangle again", () => CBS.actions.panelToRect(o), { small: true }));
      out.push(h("p", { class: "hint" }, "Draw inside a panel and your strokes stay inside it. Drag the gap between panels with the Panel tool to resize both."));
    }
    return section("panel", "▦ Panel", out);
  }

  function imageProps(objs) {
    const o = objs[0];
    const asset = CBS.assets.find(o.assetId);
    const out = [];
    if (objs.length === 1) {
      out.push(h("div", { class: "img-info" }, asset ? `${asset.name} · ${asset.w}×${asset.h}` : "Missing image"));
      const panels = doc().panels();
      const opts = [["", "Not clipped"]].concat(panels.map((p, i) => [p.id, "Panel " + (i + 1)]));
      out.push(ui().field("Clip to", ui().select(opts, o.clip || "", (v) => commit("Clip to panel", () => (o.clip = v || null)))));
      out.push(h("div", { class: "btn-row" },
        ui().button(E().cropMode ? "Done cropping" : "Crop", () => CBS.actions.toggleCrop(), { icon: "✂️", kind: E().cropMode ? "primary" : "" }),
        o.clip ? ui().button("Fill panel", () => CBS.actions.fitImageToPanel(o), { icon: "⤢", tip: "Scale to fill the panel" }) : null,
        ui().button("Replace", async () => {
          const f = await CBS.pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg");
          if (!f) return;
          const [a] = await CBS.assets.importFiles([f], asset ? asset.category : "misc");
          if (a) commit("Replace image", () => { o.assetId = a.id; o.crop = { l: 0, t: 0, r: 0, b: 0 }; });
        }, { icon: "🔁" })));
      const crop = o.crop || { l: 0, t: 0, r: 0, b: 0 };
      const cropL = (side) => live(objs, "Crop image", (x, v) => { x.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, x.crop, { [side]: clamp(v / 100, 0, 0.95) }); });
      const cs = [["l", "Left"], ["r", "Right"], ["t", "Top"], ["b", "Bottom"]].map(([k, l]) => { const L = cropL(k); return ui().slider({ label: l, min: 0, max: 90, value: Math.round(crop[k] * 100), unit: "%", onStart: L.onStart, onInput: L.onInput, onCommit: L.onCommit }); });
      out.push(h("details", { class: "subsec" }, h("summary", null, "Crop by numbers"), ...cs,
        ui().button("Reset crop", () => commit("Reset crop", () => (o.crop = { l: 0, t: 0, r: 0, b: 0 })), { small: true }),
        ui().button("Fix squashed proportions", () => CBS.actions.resetImageSize(o), { small: true })));
    }
    // filters
    const f = Object.assign({}, R().FILTER_DEFAULTS, o.filters);
    const fl = (key) => live(objs, "Image filter", (x, v) => { x.filters = Object.assign({}, R().FILTER_DEFAULTS, x.filters, { [key]: v }); });
    const fs = [["brightness", "Brightness", 0, 200, "%"], ["contrast", "Contrast", 0, 200, "%"], ["saturate", "Saturation", 0, 300, "%"], ["grayscale", "Grayscale", 0, 100, "%"], ["sepia", "Sepia", 0, 100, "%"], ["hue", "Hue shift", -180, 180, "°"], ["blur", "Blur", 0, 20, "px"], ["invert", "Invert", 0, 100, "%"]]
      .map(([k, l, mn, mx, u]) => { const L = fl(k); return ui().slider({ label: l, min: mn, max: mx, value: f[k], unit: u, step: k === "blur" ? 0.5 : 1, onStart: L.onStart, onInput: L.onInput, onCommit: L.onCommit }); });
    const presets = h("div", { class: "chip-row" }, Object.entries(R().FILTER_PRESETS).map(([k, p]) => h("button", { class: "chip", onclick: () => commit("Filter preset", () => objs.forEach((x) => (x.filters = Object.assign({}, R().FILTER_DEFAULTS, p.f)))) }, p.label)));
    out.push(h("div", { class: "frow" },
      ui().button("⇋ Flip", () => CBS.actions.flip("x"), { small: true }), ui().button("⇵ Flip", () => CBS.actions.flip("y"), { small: true })));
    const filtersSec = section("filters", "🎨 Filters & effects",
      sel(objs, "effect", "Comic effect", R().IMAGE_EFFECTS), presets, ...fs,
      R().canvasFilterSupported ? null : h("p", { class: "hint" }, "Your browser doesn't support live canvas filters, so they're applied with a slower fallback."));
    return [section("image", "🖼️ Image", out), filtersSec];
  }

  function textCommon(objs, o) {
    const fitAfter = (x) => { if (x.kind === "bubble" && x.autoGrow) CBS.lettering.fitBubble(x); if (x.kind === "text") CBS.lettering.fitTextHeight(x); };
    const ta = ui().textarea(o.text, (v) => { L.onInput(v); }, { rows: 3, label: "Text", onStart: () => L.onStart(), onCommit: () => L.onCommit() });
    const L = set(objs, "Edit text", "text", fitAfter);
    return {
      fitAfter,
      nodes: [
        ui().field("Words", ta),
        ui().field("Font", CBS.tools.fontSelect(o.font, (v) => commit("Font", () => objs.forEach((x) => { x.font = v; fitAfter(x); })))),
        sl(objs, "fontSize", "Size", 6, 160, { after: fitAfter, hardMax: 600 }),
        h("div", { class: "frow wrap" },
          ui().toggle("Bold", !!o.bold, (v) => commit("Bold", () => objs.forEach((x) => { x.bold = v; fitAfter(x); }))),
          ui().toggle("Italic", !!o.italic, (v) => commit("Italic", () => objs.forEach((x) => { x.italic = v; fitAfter(x); }))),
          ui().toggle("CAPS", !!o.uppercase, (v) => commit("Capitals", () => objs.forEach((x) => { x.uppercase = v; fitAfter(x); })), { tip: "Comic lettering is usually all capitals" })),
        seg(objs, "align", "Align", [["left", "⇤ Left"], ["center", "≡ Center"], ["right", "Right ⇥"]], { after: fitAfter }),
        sl(objs, "lineHeight", "Line spacing", 0.7, 2.5, { step: 0.05, after: fitAfter }),
        sl(objs, "letterSpacing", "Letter spacing", -0.1, 0.5, { step: 0.01, after: fitAfter }),
        col(objs, "color", "Text color"),
      ],
    };
  }

  function bubbleProps(objs) {
    const o = objs[0];
    const tc = textCommon(objs, o);
    const types = h("div", { class: "brush-grid" });
    for (const [k, t] of Object.entries(CBS.lettering.BUBBLE_TYPES)) {
      types.append(h("button", { class: "brush-btn" + (k === o.type ? " on" : ""), onclick: () => commit("Bubble type", () => objs.forEach((x) => { CBS.lettering.applyBubbleType(x, k); tc.fitAfter(x); })) }, h("span", { class: "bb-ico" }, t.icon), h("span", null, t.label)));
    }
    const shapeBits = o.type === "custom" ? [
      sel(objs, "shape", "Shape", CBS.lettering.BUBBLE_SHAPES, { after: tc.fitAfter }),
      seg(objs, "dash", "Outline", [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]]),
      o.shape === "roundrect" ? sl(objs, "radius", "Roundness", 0, 120) : null,
    ] : [];
    const tail = [
      ui().toggle("Show tail", !!o.tailOn, (v) => commit("Bubble tail", () => objs.forEach((x) => { x.tailOn = v; if (v && (!x.tail || Math.hypot(x.tail.x, x.tail.y) < 5)) x.tail = { x: -x.w * 0.2, y: x.h * 0.95 }; }))),
      o.tailOn ? sel(objs, "tailStyle", "Tail style", CBS.lettering.TAIL_STYLES) : null,
      o.tailOn ? sl(objs, "tailWidth", "Tail width", 0.05, 0.9, { step: 0.01 }) : null,
      o.tailOn && (o.tailStyle || CBS.lettering.resolveBubble(o).tailStyle) === "curved" ? sl(objs, "tailCurve", "Tail bend", -1, 1, { step: 0.05 }) : null,
      o.tailOn ? h("div", { class: "btn-row" },
        ui().button("⇋ Flip tail", () => commit("Flip tail", () => objs.forEach((x) => (x.tail = { x: -x.tail.x, y: x.tail.y }))), { small: true }),
        ui().button("⇵ Flip tail", () => commit("Flip tail", () => objs.forEach((x) => (x.tail = { x: x.tail.x, y: -x.tail.y }))), { small: true })) : null,
      o.tailOn ? h("p", { class: "hint" }, "Drag the pink dot on the page to aim the tail at the speaker.") : null,
    ];
    return [
      section("bubble", "💬 Speech bubble", types, ...shapeBits, tc.nodes[0],
        h("div", { class: "frow" }, col(objs, "fill", "Bubble", { allowNone: true }), col(objs, "stroke", "Outline")),
        sl(objs, "strokeWidth", "Outline width", 0, 12, { step: 0.5 }),
        sl(objs, "padding", "Inner space", 0, 50, { after: tc.fitAfter }),
        ui().toggle("Grow to fit the words", !!o.autoGrow, (v) => commit("Auto-size bubble", () => objs.forEach((x) => { x.autoGrow = v; tc.fitAfter(x); }))),
        ui().button("Fit bubble to words now", () => commit("Fit bubble", () => objs.forEach((x) => { const w = x.w, hh = x.h; x.w = Math.min(x.w, 120); x.h = Math.min(x.h, 60); x.x += (w - x.w) / 2; x.y += (hh - x.h) / 2; CBS.lettering.fitBubble(x); })), { small: true })),
      section("bubble-tail", "↘ Tail", tail),
      section("bubble-text", "🔤 Lettering", tc.nodes.slice(1)),
    ];
  }

  function textProps(objs) {
    const o = objs[0];
    const tc = textCommon(objs, o);
    return section("text", "🔤 Text", tc.nodes,
      h("div", { class: "frow" }, col(objs, "outlineColor", "Outline"), col(objs, "bg", "Box", { allowNone: true })),
      sl(objs, "outlineWidth", "Outline width", 0, 12, { step: 0.5 }),
      sl(objs, "padding", "Box padding", 0, 40, { after: tc.fitAfter }),
      h("div", { class: "frow" }, tog(objs, "shadow", "Drop shadow"), o.shadow ? col(objs, "shadowColor", "Shadow") : null));
  }

  function sfxProps(objs) {
    const o = objs[0];
    const word = h("input", { class: "input big-word", value: o.text, "aria-label": "Sound effect word", maxlength: 40 });
    const WL = set(objs, "Edit sound effect", "text");
    word.addEventListener("input", () => WL.onInput(word.value));
    word.addEventListener("change", () => WL.onCommit());
    const chips = h("div", { class: "chip-row" }, CBS.lettering.SFX_WORDS.slice(0, 12).map((w) => h("button", { class: "chip", onclick: () => commit("Sound effect word", () => objs.forEach((x) => (x.text = w))) }, w)));
    const presets = h("div", { class: "sfx-presets" }, CBS.lettering.SFX_PRESETS.map((p) => h("button", {
      class: "sfx-preset", tip: p.label,
      onclick: () => commit("Lettering style", () => objs.forEach((x) => { const c = Object.assign({}, p); delete c.id; delete c.label; Object.assign(x, c); })),
    }, CBS.tools.sfxPreview(p, (o.text || "POW!").slice(0, 8)))));
    return [
      section("sfx", "💥 Sound effect", ui().field("Word", word), chips, h("div", { class: "psec-sub" }, "Lettering styles"), presets,
        ui().field("Font", CBS.tools.fontSelect(o.font, (v) => commit("Font", () => objs.forEach((x) => (x.font = v)))))),
      section("sfx-color", "🎨 Color & outline",
        h("div", { class: "frow" }, col(objs, "fill", "Top"), o.gradient ? col(objs, "fill2", "Bottom") : null),
        tog(objs, "gradient", "Two-color gradient"),
        h("div", { class: "frow" }, col(objs, "outlineColor", "Outline")),
        sl(objs, "outlineWidth", "Outline", 0, 20, { step: 0.5 }),
        h("div", { class: "frow" }, tog(objs, "shadow", "Shadow"), o.shadow ? col(objs, "shadowColor", "Shadow") : null)),
      section("sfx-3d", "🧊 3D extrusion",
        sl(objs, "extrude", "Depth", 0, 30, { step: 0.5 }),
        sl(objs, "extrudeAngle", "Direction", 0, 360, { unit: "°" }),
        col(objs, "extrudeColor", "Side color")),
      section("sfx-warp", "〰️ Distortion",
        sel(objs, "distort", "Warp", CBS.lettering.SFX_DISTORT),
        sl(objs, "distortAmount", "Amount", 0, 1, { step: 0.05 }),
        sl(objs, "skew", "Slant", -40, 40, { unit: "°" }),
        sl(objs, "letterSpacing", "Spacing", -0.2, 0.6, { step: 0.01 }),
        h("div", { class: "frow" }, tog(objs, "burst", "Burst behind")),
        o.burst ? h("div", { class: "frow" }, col(objs, "burstColor", "Burst"), col(objs, "burstStroke", "Edge", { allowNone: true })) : null),
    ];
  }

  function shapeProps(objs) {
    const o = objs[0];
    const many = ["ngon", "star", "burst", "focus", "speed"].includes(o.shape);
    const isFx = o.shape === "focus" || o.shape === "speed";
    return section("shape", "⬟ Shape",
      sel(objs, "shape", "Shape", Object.fromEntries(Object.entries(R().SHAPES).filter(([k]) => (o.shape === "line" || o.shape === "poly" ? k === o.shape : k !== "line" && k !== "poly"))), {
        after: (x) => { if (x.shape === "focus") { x.sides = 64; x.innerRatio = 0.45; } if (x.shape === "burst" && (x.innerRatio < 0.5)) x.innerRatio = 0.7; },
      }),
      !isFx && o.shape !== "line" ? h("div", { class: "frow" }, tog(objs, "fillOn", "Fill"), o.fillOn ? col(objs, "fill", "Fill") : null) : null,
      h("div", { class: "frow" }, col(objs, "stroke", isFx ? "Lines" : "Line")),
      sl(objs, "strokeWidth", isFx ? "Thickness" : "Line width", 0, 40, { step: 0.5 }),
      !isFx ? seg(objs, "dash", "Style", [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]]) : null,
      o.shape === "rect" ? sl(objs, "radius", "Corners", 0, 120) : null,
      many ? sl(objs, "sides", o.shape === "ngon" ? "Sides" : o.shape === "star" ? "Points" : "Count", 3, o.shape === "focus" || o.shape === "speed" ? 200 : 40) : null,
      ["star", "burst", "focus"].includes(o.shape) ? sl(objs, "innerRatio", o.shape === "focus" ? "Clear center" : "Inner size", 0.05, 0.95, { step: 0.01 }) : null,
      o.shape === "line" ? tog(objs, "arrowEnd", "Arrowhead") : null,
      (o.shape === "poly" || o.shape === "line") && objs.length === 1
        ? ui().button(E().editPoints && E().editPoints.id === o.id ? "Done editing points" : "Edit points", () => { if (E().editPoints) { E().editPoints = null; refresh(); } else CBS.actions.editPoints(o); }, { small: true }) : null);
  }

  function transformSection(objs) {
    const o = objs[0];
    const page = doc().page;
    const layer = doc().layerOf(o.id);
    const num = (key, label) => ui().numberInput({
      label, value: Math.round(o[key] * 10) / 10, step: 1,
      onChange: (v) => commit("Transform", () => {
        if ((key === "w" || key === "h") && v < 1) v = 1;
        if (o.kind === "bubble" && (key === "w" || key === "h") && o.tail) o.tail[key === "w" ? "x" : "y"] *= v / o[key];
        o[key] = v;
        if (o.kind === "text" && key === "w") CBS.lettering.fitTextHeight(o);
      }),
    });
    const layerOpts = page.layers.filter((l) => l.type !== "drawing").map((l) => [l.id, `${CBS.LAYER_TYPES[l.type].icon} ${l.name}`]).reverse();
    return section("transform", "📐 Position & arrange",
      h("div", { class: "grid4" }, num("x", "X"), num("y", "Y"), num("w", "W"), num("h", "H")),
      sl(objs, "rot", "Rotate", -180, 180, { unit: "°", step: 0.5 }),
      opacitySlider(objs),
      ui().field("Layer", ui().select(layerOpts, layer ? layer.id : "", (v) => CBS.actions.moveToLayer(v))),
      h("div", { class: "btn-row icons" },
        iconBtn("⤒", "Bring to front", () => CBS.actions.arrange("front")), iconBtn("↑", "Bring forward", () => CBS.actions.arrange("forward")),
        iconBtn("↓", "Send backward", () => CBS.actions.arrange("backward")), iconBtn("⤓", "Send to back", () => CBS.actions.arrange("back")),
        iconBtn(o.locked ? "🔒" : "🔓", o.locked ? "Unlock" : "Lock in place", () => CBS.actions.toggleLock())),
      alignRow(),
      h("div", { class: "btn-row" },
        ui().button("Duplicate", () => CBS.actions.duplicate(), { icon: "⧉" }),
        ui().button("Delete", () => CBS.actions.del(), { icon: "🗑", kind: "danger" })));
  }
  function opacitySlider(objs) {
    const L = live(objs, "Opacity", (o, v) => (o.opacity = clamp(v / 100, 0, 1)));
    return ui().slider({ label: "Opacity", min: 0, max: 100, value: Math.round((objs[0].opacity ?? 1) * 100), unit: "%", onStart: L.onStart, onInput: L.onInput, onCommit: L.onCommit });
  }
  function iconBtn(icon, tip, fn) { return h("button", { class: "icon-btn", tip, "aria-label": tip, onclick: fn }, icon); }
  function alignRow() {
    const A = CBS.actions;
    return h("div", { class: "btn-row icons" },
      iconBtn("⫷", "Align left", () => A.align("left")), iconBtn("⫼", "Align centers horizontally", () => A.align("centerX")), iconBtn("⫸", "Align right", () => A.align("right")),
      iconBtn("⊤", "Align top", () => A.align("top")), iconBtn("⊝", "Align middles", () => A.align("centerY")), iconBtn("⊥", "Align bottom", () => A.align("bottom")));
  }

  function multiSection(objs) {
    const kinds = new Set(objs.map((o) => o.kind));
    const out = [section("multi", `🧩 ${objs.length} items selected`,
      h("p", { class: "hint" }, "Align to each other, or to the page when only one item is selected."),
      alignRow(),
      h("div", { class: "btn-row" },
        ui().button("Spread across", () => CBS.actions.distribute("h"), { small: true, tip: "Even horizontal spacing" }),
        ui().button("Spread down", () => CBS.actions.distribute("v"), { small: true, tip: "Even vertical spacing" })),
      opacitySlider(objs),
      h("div", { class: "btn-row" },
        ui().button("Duplicate", () => CBS.actions.duplicate(), { icon: "⧉" }),
        ui().button("Delete", () => CBS.actions.del(), { icon: "🗑", kind: "danger" })))];
    if (kinds.size === 1) {
      const k = [...kinds][0];
      if (k === "panel") out.push(panelProps(objs));
      if (k === "bubble") out.push(...[].concat(bubbleProps(objs)));
    }
    return out;
  }

  /* ---------- build ---------- */
  function build() {
    if (!root) return;
    const scroll = root.scrollTop;
    clear(root);
    if (!doc().project) return;
    const tool = CBS.tools.current;
    const sel = doc().selected();
    const parts = [];
    if (tool && tool.options && tool.id !== "select") {
      parts.push(h("div", { class: "psec tool-sec" }, h("div", { class: "psec-title" }, h("span", { class: "tool-ico" }, tool.icon), tool.label), tool.options()));
    }
    if (sel.length === 1) {
      const o = sel[0];
      const kindSec = { panel: panelProps, image: imageProps, bubble: bubbleProps, text: textProps, sfx: sfxProps, shape: shapeProps }[o.kind];
      if (kindSec) parts.push(...[].concat(kindSec([o])));
      parts.push(transformSection([o]));
    } else if (sel.length > 1) parts.push(...multiSection(sel));
    else parts.push(...pageSection());
    root.append(...parts);
    root.scrollTop = scroll;
  }
  const refresh = CBS.debounce(build, 30);
  refresh.now = build;

  function pageColorPicker(at) {
    const page = doc().page;
    const anchor = h("div", { style: { position: "fixed", left: at.x + "px", top: at.y + "px", width: "1px", height: "1px" } });
    document.body.append(anchor);
    const L = live([page], "Page color", (pg, v) => (pg.background = v));
    ui().colorPopover(anchor, page.background, (c, final) => { L.onInput(c); if (final) { L.onCommit(); bus.emit("pages:changed"); } });
    setTimeout(() => anchor.remove(), 100);
  }

  function init() {
    root = document.getElementById("props-body");
    bus.on("selection:changed", refresh);
    bus.on("tool:changed", refresh);
    bus.on("props:refresh", refresh);
    bus.on("page:changed", refresh);
    bus.on("doc:loaded", refresh);
    bus.on("layers:changed", () => { if (!doc().selection.length) refresh(); });
  }

  CBS.props = { init, refresh, live, pageColorPicker, respacePanels };
})();
