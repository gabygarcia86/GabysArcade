/* Left side: the tool rail (big colorful buttons) and the panel next to it, which shows the
 * settings for whatever you picked: brush settings, colors, stickers, effects, backgrounds,
 * sounds, text styles or the selected object. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, h, clamp } = GAS;

  const RAIL = [
    { id: "pencil", kind: "tool", icon: "pencil", color: "#ff6b6b" },
    { id: "brush", kind: "tool", icon: "brush", color: "#ff9f1c" },
    { id: "eraser", kind: "tool", icon: "eraser", color: "#f15bb5" },
    { id: "fill", kind: "tool", icon: "fill", color: "#00b4d8" },
    { id: "eyedropper", kind: "tool", icon: "eyedropper", color: "#06d6a0" },
    { id: "line", kind: "tool", icon: "line", color: "#9b5de5" },
    { id: "shape", kind: "tool", icon: "shape", color: "#ffbe0b" },
    { id: "select", kind: "tool", icon: "select", color: "#3a86ff" },
    { id: "text", kind: "tool", icon: "text", color: "#ef476f" },
    { id: "hand", kind: "tool", icon: "hand", color: "#8d99ae" },
    "-",
    { id: "stickers", kind: "tab", icon: "sticker", color: "#ff9f1c", label: "Stickers", tip: "Stickers: animals, monsters, robots and more" },
    { id: "effects", kind: "tab", icon: "effects", color: "#f15bb5", label: "Effects", tip: "Cartoon effects: sparkles, speed lines, POW!" },
    { id: "background", kind: "tab", icon: "background", color: "#06d6a0", label: "Scenes", tip: "Backgrounds and scenery" },
    { id: "sounds", kind: "tab", icon: "sound", color: "#3a86ff", label: "Sounds", tip: "Sound effects for your frames" },
    { id: "picture", kind: "action", icon: "image", color: "#9b5de5", label: "Picture", tip: "Add your own picture (PNG, JPG or WebP)" },
  ];

  let rail, panel, panelBody, panelTitle, colorsEl, colorChip;
  let tab = "tool";
  let bgScope = "all";
  let stickerCat = GAS.prefs.get("stickerCat", "animals");

  function init() {
    rail = document.getElementById("rail");
    panel = document.getElementById("panel");
    buildRail();
    const I = GAS.icons.svg;
    panelTitle = h("h2", { class: "panel-title" });
    const collapse = h("button", { class: "icon-btn small panel-collapse", type: "button", tip: "Hide this panel", "aria-label": "Hide panel", onclick: () => setOpen(false) }, I("close"));
    panelBody = h("div", { class: "panel-body" });
    panel.append(h("div", { class: "panel-head" }, panelTitle, collapse), panelBody);
    colorsEl = GAS.colors.panel();
    // On phones the panel is a sheet that sits just above the tool rail.
    new ResizeObserver(() => document.documentElement.style.setProperty("--rail-h", rail.offsetHeight + "px")).observe(rail);

    GAS.bus.on("tool-changed", () => { if (!keepTab) tab = "tool"; syncRail(); render(); });
    GAS.bus.on("selection-changed", () => { if (tab === "tool" && !keepTab) render(); });
    GAS.bus.on("project-loaded", () => render());
    GAS.bus.on("background-changed", () => { if (tab === "background") render(); });
    GAS.bus.on("layer-changed", () => { if (tab === "background") render(); });
    GAS.bus.on("frame-selected", () => { if (tab === "background" || tab === "sounds") render(); });
    GAS.bus.on("sound-changed", () => { if (tab === "sounds") render(); });
    GAS.bus.on("color-changed", () => { colorChip.style.setProperty("--c", state.primary); colorChip.style.setProperty("--c2", state.secondary); });
    GAS.bus.on("edit-text", () => {
      tab = "tool"; syncRail(); render(); setOpen(true);
      setTimeout(() => { const ta = panel.querySelector(".text-area"); if (ta) { ta.focus(); ta.select(); } }, 60);
    });
    const refreshSel = GAS.debounce(() => {
      if (tab === "tool" && (state.tool === "select" || state.tool === "text") && !panel.contains(document.activeElement)) render();
    }, 250);
    GAS.bus.on("frame-changed", refreshSel);
    GAS.bus.emit("color-changed");
    setOpen(!matchMedia("(max-width: 760px)").matches);
  }

  /* ---------- rail ---------- */
  function buildRail() {
    const I = GAS.icons.svg;
    const list = h("div", { class: "rail-list" });
    for (const item of RAIL) {
      if (item === "-") { list.appendChild(h("hr", { class: "rail-sep" })); continue; }
      const info = item.kind === "tool" ? GAS.tools.TOOL_INFO[item.id] : null;
      const b = h("button", {
        class: "rail-btn", type: "button", style: { "--tool": item.color },
        dataset: { id: item.id, kind: item.kind, ...(info ? { key: info.key } : {}) },
        tip: info ? info.tip : item.tip, "aria-label": info ? info.label : item.label,
      }, h("span", { class: "rail-icon" }, I(item.icon)), h("span", { class: "rail-label" }, info ? info.label : item.label));
      b.addEventListener("click", () => onRail(item));
      list.appendChild(b);
    }
    colorChip = h("button", { class: "color-chip", type: "button", tip: "Your colors (main and fill)", "aria-label": "Colors", onclick: () => { tab = "tool"; if (["select", "hand", "stickers"].includes(state.tool)) GAS.tools.set(state.lastDrawTool || "pencil"); syncRail(); render(); setOpen(true); setTimeout(() => colorsEl.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } },
      h("span", { class: "chip-main" }), h("span", { class: "chip-fill" }));
    list.appendChild(colorChip); // fills the spare slot next to "Picture"
    rail.append(list);
    syncRail();
  }

  function onRail(item) {
    if (item.kind === "action") {
      GAS.projects.pickFile("image/png,image/jpeg,image/webp,image/gif").then((f) => f && GAS.app.importImage(f));
      return;
    }
    const wasActive = item.kind === "tool" ? tab === "tool" && state.tool === item.id : tab === item.id;
    if (item.kind === "tool") {
      GAS.tools.set(item.id);
    } else {
      tab = item.id;
      syncRail();
      render();
    }
    // Tapping the active button again shows or hides the panel (handy on small screens).
    if (wasActive) setOpen(!isOpen());
    else if (!isOpen() && !matchMedia("(max-width: 760px)").matches) setOpen(true);
    else if (!isOpen() && item.kind === "tab") setOpen(true);
  }

  function syncRail() {
    rail.querySelectorAll(".rail-btn").forEach((b) => {
      const on = b.dataset.kind === "tool" ? tab === "tool" && b.dataset.id === state.tool : b.dataset.id === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on);
    });
  }

  const isOpen = () => document.body.classList.contains("panel-open");
  function setOpen(on) {
    document.body.classList.toggle("panel-open", on);
    GAS.bus.emit("panel-toggled", on);
  }

  /* ---------- panel rendering ---------- */
  function section(title, ...kids) {
    return h("section", { class: "panel-section" }, title ? h("div", { class: "section-head" }, h("h3", null, title)) : null, ...kids);
  }
  function hint(text) { return h("p", { class: "hint" }, text); }

  function render() {
    if (!panelBody || !state.project) return;
    const scroll = panelBody.scrollTop;
    const sameView = panelBody.dataset.view === tab + ":" + state.tool;
    panelBody.innerHTML = "";
    panelBody.dataset.view = tab + ":" + state.tool;
    let title = "";
    if (tab === "tool") {
      const info = GAS.tools.TOOL_INFO[state.tool];
      title = info.label;
      renderTool(state.tool);
    } else if (tab === "stickers") { title = "Stickers"; renderStickers(); }
    else if (tab === "effects") { title = "Cartoon effects"; renderEffects(); }
    else if (tab === "background") { title = "Scenes & backgrounds"; renderBackground(); }
    else if (tab === "sounds") { title = "Sounds"; renderSounds(); }
    panelTitle.textContent = title;
    if (sameView) panelBody.scrollTop = scroll;
  }

  function sizeSlider(s, label = "Size", max = 100) {
    return GAS.ui.slider({ label, min: 1, max, value: s.size, format: (v) => v + " px", onInput: (v) => { s.size = v; GAS.view.queueOverlay(); } });
  }
  function opacitySlider(s, label = "See-through") {
    return GAS.ui.slider({ label: label === "See-through" ? "Strength" : label, min: 5, max: 100, value: Math.round(s.opacity * 100), format: (v) => v + "%", onInput: (v) => { s.opacity = v / 100; } });
  }
  function smoothSlider(s) {
    return GAS.ui.slider({ label: "Smoothing", min: 0, max: 90, value: Math.round(s.smoothing * 100), format: (v) => (v < 10 ? "Off" : v < 45 ? "A little" : "Lots"), onInput: (v) => { s.smoothing = v / 100; }, tip: "Smooths out wobbly lines" });
  }

  function renderTool(tool) {
    const T = state.tools;
    const add = (...els) => panelBody.append(...els);
    switch (tool) {
      case "pencil":
        add(section(null, hint("Draw crisp lines. Use a pen? Press harder for thicker lines."), sizeSlider(T.pencil), opacitySlider(T.pencil), smoothSlider(T.pencil)), colorsEl);
        break;
      case "brush": {
        const s = T.brush;
        const styles = GAS.ui.segmented(GAS.tools.BRUSH_STYLES.map((b) => ({ value: b.id, label: b.label })), s.style, (v) => { s.style = v; render(); }, "is-grid3");
        const els = [styles, sizeSlider(s), opacitySlider(s)];
        if (s.style === "soft") els.push(GAS.ui.slider({ label: "Edge", min: 0, max: 95, value: Math.round(s.hardness * 100), format: (v) => (v < 30 ? "Fuzzy" : v < 70 ? "Soft" : "Sharp"), onInput: (v) => { s.hardness = v / 100; } }));
        els.push(smoothSlider(s));
        add(section("Brush style", ...els), colorsEl);
        break;
      }
      case "eraser": {
        const s = T.eraser;
        add(section(null, hint("Rub out mistakes. Press Undo if you erase too much!"), sizeSlider(s, "Size", 200), opacitySlider(s),
          GAS.ui.slider({ label: "Edge", min: 0, max: 100, value: Math.round(s.hardness * 100), format: (v) => (v < 40 ? "Soft" : "Sharp"), onInput: (v) => { s.hardness = Math.min(0.98, v / 100); } })));
        if (state.activeLayer === "bg") add(hint("You're erasing the background painting."));
        break;
      }
      case "fill": {
        const s = T.fill;
        add(section(null, hint("Tap inside a closed shape to pour in your main color."),
          GAS.ui.slider({ label: "How close colors must be", min: 0, max: 100, value: s.tolerance, format: (v) => v + "%", onInput: (v) => { s.tolerance = v; }, tip: "Bigger numbers fill over more similar colors" }),
          opacitySlider(s),
          GAS.ui.toggle("Smooth edges (no white gaps)", s.antialias, (v) => { s.antialias = v; }),
          GAS.ui.toggle("Look at everything I can see", !!s.sampleAll, (v) => { s.sampleAll = v; })), colorsEl);
        break;
      }
      case "eyedropper":
        add(section(null, hint("Tap anywhere on your picture to grab that color. Tip: hold Alt while drawing to pick a color quickly.")), colorsEl);
        break;
      case "line":
        add(section(null, hint("Drag to draw a straight line. Hold Shift to snap to neat angles."), sizeSlider(T.line), opacitySlider(T.line)), colorsEl);
        break;
      case "shape": {
        const s = T.shape;
        const grid = h("div", { class: "shape-grid" }, GAS.tools.SHAPES.map((sh) => {
          const c = h("canvas", { width: 44, height: 44 });
          const ctx = c.getContext("2d");
          GAS.tools.drawShape(ctx, sh.id, sh.id === "circle" ? { x: 8, y: 8, w: 28, h: 28 } : sh.id === "ellipse" ? { x: 4, y: 11, w: 36, h: 22 } : { x: 7, y: 7, w: 30, h: 30 }, { size: 3, fillMode: "both", sides: s.sides }, "#2b2340", "#ffd23f");
          const b = h("button", { class: "shape-btn" + (s.kind === sh.id ? " is-active" : ""), type: "button", tip: sh.label, "aria-label": sh.label }, c);
          b.addEventListener("click", () => { s.kind = sh.id; render(); });
          return b;
        }));
        const style = GAS.ui.segmented([
          { value: "outline", label: "Outline" }, { value: "fill", label: "Filled" }, { value: "both", label: "Both", tip: "Filled with your fill color, outlined with your main color" },
        ], s.fillMode, (v) => { s.fillMode = v; });
        const els = [grid, style];
        if (s.kind === "polygon") els.push(GAS.ui.slider({ label: "Sides", min: 3, max: 12, value: s.sides, onInput: (v) => { s.sides = v; }, onChange: () => render() }));
        els.push(sizeSlider(s, "Line thickness", 60), opacitySlider(s), hint("Drag on the canvas. Hold Shift for perfect squares and circles, Alt to draw from the middle."));
        add(section("Pick a shape", ...els), colorsEl);
        break;
      }
      case "select":
        renderSelectPanel();
        break;
      case "text":
        renderSelectPanel(true);
        break;
      case "hand": {
        const I = GAS.icons.svg;
        add(section(null, hint("Drag the canvas to move around. Pinch with two fingers, or hold Ctrl and scroll, to zoom."),
          h("div", { class: "btn-row" },
            h("button", { class: "btn", type: "button", onclick: () => GAS.view.zoomBy(1.25) }, I("zoomIn"), h("span", null, "Zoom in")),
            h("button", { class: "btn", type: "button", onclick: () => GAS.view.zoomBy(0.8) }, I("zoomOut"), h("span", null, "Zoom out")),
            h("button", { class: "btn", type: "button", onclick: () => GAS.view.fit() }, I("fit"), h("span", null, "Fit")))));
        break;
      }
    }
  }

  /* ---------- selection & text ---------- */
  function actionBtn(icon, label, fn, cls) {
    const I = GAS.icons.svg;
    return h("button", { class: "btn small " + (cls || ""), type: "button", onclick: fn }, I(icon), h("span", null, label));
  }

  function renderSelectPanel(textMode) {
    const o = GAS.selection.selectedObject();
    const add = (...els) => panelBody.append(...els);
    const S = GAS.selection;
    if (state.float) {
      add(section("Your selection",
        hint("Drag it to move. Pull the corners to resize, or the yellow dot to spin it."),
        h("div", { class: "btn-grid" },
          actionBtn("check", "Done", () => S.commitFloat(), "btn-primary"),
          actionBtn("copy", "Duplicate", () => S.duplicate()),
          actionBtn("flipH", "Flip ↔", () => S.flip("x")),
          actionBtn("flipV", "Flip ↕", () => S.flip("y")),
          actionBtn("copy", "Copy", () => S.copy()),
          actionBtn("trash", "Delete", () => S.deleteSelection(), "btn-danger"))));
      return;
    }
    if (!o) {
      add(section(null,
        hint(textMode ? "Tap anywhere on the canvas to add words. Tap words you already added to change them." : "Tap a sticker, picture, text or effect to pick it up. Or drag a box around part of your drawing to move it."),
        textMode ? null : h("div", { class: "btn-grid" },
          actionBtn("select", "Select all drawing", () => S.selectAll()),
          actionBtn("paste", "Paste", () => S.paste()))));
      if (textMode) add(textStyleSection(null));
      return;
    }
    const names = { sticker: "Sticker", image: "Picture", text: "Text", effect: "Effect" };
    if (o.type === "text") add(textStyleSection(o));
    if (o.type === "effect") add(effectSection(o));
    add(section(names[o.type] || "Object",
      GAS.ui.slider({ label: "See-through", min: 10, max: 100, value: Math.round((o.opacity ?? 1) * 100), format: (v) => v + "%", onInput: (v) => S.editObject({ opacity: v / 100 }, "Opacity") }),
      GAS.ui.slider({ label: "Turn", min: -180, max: 180, value: Math.round(((o.rot || 0) * 180) / Math.PI), format: (v) => v + "°", onInput: (v) => S.editObject({ rot: (v * Math.PI) / 180 }, "Rotate") }),
      h("div", { class: "btn-grid" },
        actionBtn("flipH", "Flip ↔", () => S.flip("x")),
        actionBtn("flipV", "Flip ↕", () => S.flip("y")),
        actionBtn("copy", "Duplicate", () => S.duplicate()),
        actionBtn("nextFrame", "To next frame", () => S.copyToNextFrame()),
        actionBtn("forward", "To front", () => S.reorder("front")),
        actionBtn("backward", "To back", () => S.reorder("back")),
        actionBtn("trash", "Delete", () => S.deleteSelection(), "btn-danger"))));
    if (o.type === "text" || o.type === "effect") add(colorsEl);
  }

  function textStyleSection(o) {
    const S = GAS.selection;
    const d = state.textDefaults;
    const cur = o || d;
    const apply = (changes, label) => {
      Object.assign(d, changes);
      delete d.text;
      if (o) S.editObject(changes, label);
    };
    const els = [];
    if (o) {
      const ta = h("textarea", { class: "text-area", rows: 3, maxlength: 400, spellcheck: "true", "aria-label": "Your text" });
      ta.value = o.text;
      ta.addEventListener("input", () => S.editObject({ text: ta.value || " " }, "Edit text"));
      els.push(h("label", { class: "field" }, h("span", { class: "field-label" }, "Your words"), ta));
    }
    const fonts = h("div", { class: "font-grid" }, GAS.render.FONTS.map((f) => {
      const b = h("button", { class: "font-btn" + (cur.font === f.id ? " is-active" : ""), type: "button", style: { fontFamily: f.css }, tip: f.label }, "Abc");
      b.addEventListener("click", () => { apply({ font: f.id }, "Font"); fonts.querySelectorAll(".font-btn").forEach((x) => x.classList.toggle("is-active", x === b)); });
      return b;
    }));
    els.push(h("div", { class: "field" }, h("span", { class: "field-label" }, "Letter style"), fonts));
    els.push(GAS.ui.slider({ label: "Size", min: 8, max: 220, value: Math.round(cur.size), format: (v) => v + " px", onInput: (v) => apply({ size: v }, "Text size") }));
    const I = GAS.icons.svg;
    const tbtn = (icon, key, tip) => {
      const b = h("button", { class: "seg-btn" + (cur[key] ? " is-active" : ""), type: "button", tip, "aria-label": tip }, I(icon));
      b.addEventListener("click", () => { const v = !b.classList.contains("is-active"); b.classList.toggle("is-active", v); apply({ [key]: v }, tip); });
      return b;
    };
    els.push(h("div", { class: "btn-row" },
      h("div", { class: "segmented" }, tbtn("bold", "bold", "Bold"), tbtn("italic", "italic", "Italic")),
      GAS.ui.segmented([{ value: "left", icon: "alignLeft", tip: "Line up left" }, { value: "center", icon: "alignCenter", tip: "Line up center" }, { value: "right", icon: "alignRight", tip: "Line up right" }], cur.align, (v) => apply({ align: v }, "Align"))));
    els.push(h("div", { class: "color-pair" },
      h("label", { class: "color-field" }, GAS.ui.colorInput(cur.color, (v) => apply({ color: v }, "Text color")), h("span", null, "Letters")),
      h("label", { class: "color-field" }, GAS.ui.colorInput(cur.outlineColor || "#ffffff", (v) => apply({ outlineColor: v, outline: true }, "Outline color")), h("span", null, "Outline"))));
    els.push(GAS.ui.toggle("Outline", cur.outline, (v) => apply({ outline: v }, "Outline")));
    els.push(GAS.ui.slider({ label: "Outline thickness", min: 1, max: 20, value: cur.outlineWidth || 6, format: (v) => v + " px", onInput: (v) => apply({ outlineWidth: v, outline: true }, "Outline") }));
    els.push(GAS.ui.toggle("Shadow", cur.shadow, (v) => apply({ shadow: v }, "Shadow")));
    return section(o ? "Text" : "Text style for new words", ...els);
  }

  function effectSection(o) {
    const S = GAS.selection;
    const els = [hint("Tap a color below to recolor this effect.")];
    if (o.kind === "impact") {
      const chips = h("div", { class: "chip-row" }, GAS.effects.IMPACT_WORDS.map((w) => {
        const b = h("button", { class: "chip-btn" + (o.text === w ? " is-active" : ""), type: "button" }, w);
        b.addEventListener("click", () => { S.editObject({ text: w }, "Impact word"); chips.querySelectorAll(".chip-btn").forEach((x) => x.classList.toggle("is-active", x === b)); });
        return b;
      }));
      const input = h("input", { class: "text-input", type: "text", maxlength: 12, value: o.text || "", "aria-label": "Your own word" });
      input.addEventListener("input", () => S.editObject({ text: input.value.toUpperCase() }, "Impact word"));
      els.push(chips, h("label", { class: "field" }, h("span", { class: "field-label" }, "Or type your own"), input));
    }
    els.push(actionBtn("sparkle", "Shuffle the pattern", () => S.editObject({ seed: Math.floor(Math.random() * 1e9) }, "Shuffle")));
    return section("Effect", ...els);
  }

  /* ---------- stickers ---------- */
  function stickerSize() {
    const p = state.project;
    return Math.round(Math.min(p.width, p.height) * 0.32);
  }
  /* Adding from the Stickers or Effects tab keeps that tab open, so you can add several in a row. */
  let keepTab = false;
  function addAt(obj, x, y) {
    obj.x = x; obj.y = y;
    keepTab = true;
    try { GAS.selection.addObject(obj, obj.type === "effect" ? "Add effect" : "Add sticker"); }
    finally { keepTab = false; }
  }
  function centerPos() {
    const p = state.project;
    const j = () => (Math.random() - 0.5) * Math.min(p.width, p.height) * 0.2;
    return [p.width / 2 + j(), p.height / 2 + j()];
  }

  /* Drag something from the panel onto the canvas (mouse & pen). A plain tap adds it to the middle. */
  function draggable(el, make, preview) {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost = null;
      const touch = e.pointerType === "touch";
      const move = (ev) => {
        if (!ghost && !touch && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
          ghost = preview();
          ghost.classList.add("drag-ghost");
          document.body.appendChild(ghost);
          el.setPointerCapture(ev.pointerId);
        }
        if (ghost) ghost.style.transform = `translate(${ev.clientX - 40}px, ${ev.clientY - 40}px)`;
      };
      const up = (ev) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        if (ghost) {
          ghost.remove();
          const stage = GAS.view.stage.getBoundingClientRect();
          if (ev.clientX >= stage.left && ev.clientX <= stage.right && ev.clientY >= stage.top && ev.clientY <= stage.bottom) {
            const p = GAS.view.toArt(ev.clientX, ev.clientY);
            addAt(make(), p.x, p.y);
          }
          el._dragged = true;
          setTimeout(() => { el._dragged = false; }, 0);
        }
      };
      const cancel = () => { if (ghost) ghost.remove(); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    });
    el.addEventListener("click", () => {
      if (el._dragged) return;
      const [x, y] = centerPos();
      addAt(make(), x, y);
      if (matchMedia("(max-width: 760px)").matches) setOpen(false);
    });
  }

  function renderStickers() {
    const I = GAS.icons.svg;
    const lib = GAS.stickers.LIB;
    const cats = h("div", { class: "chip-row cat-row" }, Object.entries(lib).map(([id, def]) => {
      const b = h("button", { class: "chip-btn" + (id === stickerCat ? " is-active" : ""), type: "button" }, def.label);
      b.addEventListener("click", () => { stickerCat = id; GAS.prefs.set("stickerCat", id); render(); });
      return b;
    }));
    const grid = h("div", { class: "sticker-grid" });
    for (const name of Object.keys(lib[stickerCat].items)) {
      const key = stickerCat + "/" + name;
      const img = h("img", { src: GAS.stickers.url(key), alt: name, draggable: "false" });
      const b = h("button", { class: "sticker-btn", type: "button", tip: "Tap to add, or drag onto the canvas", "aria-label": "Add " + name + " sticker" }, img);
      draggable(b, () => {
        const s = stickerSize();
        return GAS.model.baseObject("sticker", { key, w: s, h: s });
      }, () => h("img", { src: GAS.stickers.url(key), width: 80, height: 80 }));
      grid.appendChild(b);
    }
    panelBody.append(
      section(null,
        h("button", { class: "btn btn-wide", type: "button", onclick: () => GAS.projects.pickFile("image/png,image/jpeg,image/webp,image/gif").then((f) => f && GAS.app.importImage(f)) }, I("upload"), h("span", null, "Add my own picture")),
        cats, grid,
        hint("Stickers belong to this frame. Use “Copy to next frame” to keep them in your animation.")));
  }

  /* ---------- effects ---------- */
  function effectThumb(def, size = 76) {
    const c = h("canvas", { width: size * 2, height: size * 2, style: { width: size + "px", height: size + "px" } });
    const ctx = c.getContext("2d");
    const o = GAS.effects.create(def.kind, size, size);
    o.seed = 11;
    const k = (size * 1.7) / Math.max(o.w, o.h);
    o.w *= k; o.h *= k;
    GAS.render.drawObject(ctx, o, state.project);
    return c;
  }
  function renderEffects() {
    const grid = h("div", { class: "effect-grid" });
    for (const def of GAS.effects.LIST) {
      const b = h("button", { class: "effect-btn", type: "button", tip: "Tap to add, or drag onto the canvas", "aria-label": "Add " + def.label }, effectThumb(def), h("span", null, def.label));
      draggable(b, () => {
        const o = GAS.effects.create(def.kind, 0, 0);
        const k = Math.min(state.project.width, state.project.height) / 360;
        o.w *= k; o.h *= k;
        return o;
      }, () => { const g = h("div", { class: "ghost-box" }, effectThumb(def, 80)); return g; });
      grid.appendChild(b);
    }
    panelBody.append(section(null, grid, hint("Effects can be moved, resized, spun and recolored. They only show on the frame you add them to.")));
  }

  /* ---------- background ---------- */
  function bgThumb(fill) {
    const c = h("canvas", { width: 72, height: 54 });
    const ctx = c.getContext("2d");
    const f = { ...fill };
    if (f.size) f.size = Math.max(4, f.size / 4);
    GAS.render.drawBgFill(ctx, f, 72, 54, state.project);
    return c;
  }
  function renderBackground() {
    const p = state.project, f = GAS.curFrame();
    const I = GAS.icons.svg;
    const fill = GAS.model.frameBgFill(p, f);
    const set = (nf) => GAS.app.setBackground(nf, bgScope);
    const add = (...els) => panelBody.append(...els);

    add(section("What am I painting on?",
      GAS.ui.segmented([
        { value: "draw", label: "✏️ Drawing", tip: "Draw on top (most of the time)" },
        { value: "bg", label: "🏞️ Background", tip: "Paint scenery behind your drawing" },
      ], state.activeLayer, (v) => GAS.app.setActiveLayer(v)),
      hint(state.activeLayer === "bg" ? "Pencil, brush, eraser, fill and shapes now paint the scenery behind your drawing." : "Switch to Background to paint scenery that sits behind your drawing.")));

    const scope = GAS.ui.segmented([
      { value: "all", label: "Every frame" },
      { value: "frame", label: "This frame only" },
    ], bgScope, (v) => { bgScope = v; });
    const presets = h("div", { class: "bg-grid" }, GAS.render.BG_PRESETS.map((pr) => {
      const active = JSON.stringify(pr.fill) === JSON.stringify(fill);
      const b = h("button", { class: "bg-btn" + (active ? " is-active" : "") + (pr.fill.type === "transparent" ? " is-clear" : ""), type: "button", tip: pr.label }, bgThumb(pr.fill), h("span", null, pr.label));
      b.addEventListener("click", () => set(pr.fill));
      return b;
    }));
    const solid = h("label", { class: "color-field" }, GAS.ui.colorInput(fill.type === "color" ? fill.color : "#ffffff", (v, live) => { if (!live) set({ type: "color", color: v }); }), h("span", null, "Any color"));
    const g1 = fill.type === "gradient" ? fill.color : "#7ec8ff", g2 = fill.type === "gradient" ? fill.color2 : "#ffffff";
    const grad = h("div", { class: "color-pair" },
      h("label", { class: "color-field" }, GAS.ui.colorInput(g1, (v, live) => { if (!live) set({ type: "gradient", color: v, color2: fill.type === "gradient" ? fill.color2 : g2, angle: fill.angle ?? 180, radial: !!fill.radial }); }), h("span", null, "Top")),
      h("label", { class: "color-field" }, GAS.ui.colorInput(g2, (v, live) => { if (!live) set({ type: "gradient", color: fill.type === "gradient" ? fill.color : g1, color2: v, angle: fill.angle ?? 180, radial: !!fill.radial }); }), h("span", null, "Bottom")));
    const els = [scope, presets, h("div", { class: "mini-head" }, "Make your own"), h("div", { class: "btn-row" }, solid), h("div", { class: "mini-head" }, "Two-color blend"), grad];
    if (fill.type === "gradient") {
      els.push(GAS.ui.segmented([
        { value: "180", label: "↓" }, { value: "90", label: "→" }, { value: "135", label: "↘" }, { value: "radial", label: "◎" },
      ], fill.radial ? "radial" : String(fill.angle ?? 180), (v) => set({ ...fill, radial: v === "radial", angle: v === "radial" ? fill.angle : +v })));
    }
    if (["grid", "lined", "checker"].includes(fill.type)) {
      els.push(GAS.ui.slider({ label: "Square size", min: 8, max: 96, value: fill.size || 24, format: (v) => v + " px", onChange: (v) => set({ ...fill, size: v }) }));
    }
    els.push(h("button", { class: "btn btn-wide", type: "button", onclick: () => GAS.projects.pickFile("image/png,image/jpeg,image/webp").then((file) => file && GAS.app.importBackgroundImage(file, bgScope)) }, I("upload"), h("span", null, "Use my own picture")));
    if (fill.type === "image") {
      els.push(GAS.ui.segmented([{ value: "cover", label: "Fill" }, { value: "contain", label: "Fit" }, { value: "stretch", label: "Stretch" }], fill.fit || "cover", (v) => set({ ...fill, fit: v })));
    }
    if (f.bgFill) els.push(hint("This frame has its own background. Pick “Every frame” and choose a background to make them all match again."));
    add(section("Background", ...els));

    const own = !!f.bgLayer;
    add(section("Background painting",
      GAS.ui.segmented([{ value: "shared", label: "Same on all frames" }, { value: "own", label: "Only this frame" }], own ? "own" : "shared", (v) => GAS.app.setOwnBgLayer(v === "own")),
      hint(own ? "This frame has its own scenery painting." : "Scenery you paint on the background shows on every frame. Great for a still backdrop!"),
      actionBtn("clear", "Clear background painting", () => GAS.app.clearBgLayer())));
  }

  /* ---------- sounds ---------- */
  function renderSounds() {
    const f = GAS.curFrame();
    const I = GAS.icons.svg;
    const A = GAS.audio;
    const add = (...els) => panelBody.append(...els);
    const cur = f.sound;
    const current = cur
      ? h("div", { class: "frame-sound" },
        h("span", { class: "sound-emoji" }, A.emoji(cur.ref)),
        h("span", { class: "sound-name" }, A.label(cur.ref)),
        h("button", { class: "icon-btn small", type: "button", tip: "Listen", "aria-label": "Listen", onclick: () => A.play(cur.ref, cur.volume, { force: true }) }, I("play")),
        h("button", { class: "icon-btn small is-danger", type: "button", tip: "Remove sound", "aria-label": "Remove sound", onclick: () => GAS.app.setSound(f, null) }, I("trash")))
      : hint("No sound on this frame yet. Pick one below!");
    const els = [current];
    if (cur) {
      els.push(GAS.ui.slider({ label: "Volume", min: 0, max: 150, value: Math.round((cur.volume ?? 1) * 100), format: (v) => v + "%", onChange: (v) => GAS.app.setSound(f, { ...cur, volume: v / 100 }) }));
    }
    add(section("Frame " + (state.cur + 1) + " sound", ...els));

    const tile = (ref, emoji, label) => {
      const play = h("button", { class: "sound-play", type: "button", tip: "Listen", "aria-label": "Listen to " + label, onclick: () => A.play(ref, 1, { force: true }) }, h("span", { class: "sound-emoji" }, emoji), h("span", null, label));
      const use = h("button", { class: "sound-add" + (cur && cur.ref === ref ? " is-active" : ""), type: "button", tip: "Put this sound on frame " + (state.cur + 1), onclick: () => { GAS.app.setSound(f, { ref, volume: cur ? cur.volume : 1 }); A.play(ref, 1, { force: true }); } },
        cur && cur.ref === ref ? I("check") : I("plus"), h("span", null, cur && cur.ref === ref ? "On frame" : "Add"));
      return h("div", { class: "sound-tile" }, play, use);
    };
    add(section("Sound library", h("div", { class: "sound-grid" }, A.LIBRARY.map((s) => tile("builtin:" + s.id, s.emoji, s.label)))));

    const mine = Object.entries(state.project.assets.audio);
    add(section("My sounds",
      mine.length ? h("div", { class: "sound-grid" }, mine.map(([id, a]) => tile("asset:" + id, "🎵", a.name))) : hint("Add your own WAV, MP3 or OGG sound files."),
      h("button", { class: "btn btn-wide", type: "button", onclick: async () => {
        const file = await GAS.projects.pickFile("audio/*,.wav,.mp3,.ogg");
        if (!file) return;
        const ref = await A.importFile(file);
        if (ref) { GAS.app.setSound(f, { ref, volume: 1 }); GAS.ui.toast("Sound added to frame " + (state.cur + 1) + "!"); render(); }
      } }, I("upload"), h("span", null, "Import a sound")),
      GAS.ui.toggle("Play sounds when I press Play", !A.muted, (v) => { A.muted = !v; }),
      hint("Sounds play when their frame shows up. Videos keep your sounds; GIFs can't have sound.")));
  }

  GAS.panels = {
    init, render, setOpen, isOpen,
    showTab(t) { tab = t; syncRail(); render(); setOpen(true); },
    get tab() { return tab; },
  };
})();
